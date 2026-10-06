import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sqlite} from '../scripts/sqlite-adapter.mjs';
import {migrateLocal} from '../scripts/migrate-local.mjs';
import {handle} from '../src/worker.mjs';
import {parseSchoolGrade,teacherSource} from '../src/teachers.mjs';
import {consecutiveDates,makeSubstitutionPlan} from '../src/substitution-plan.mjs';

const html=await readFile(new URL('./fixtures/webhorario-grade.html',import.meta.url),'utf8');
const grade=parseSchoolGrade(html);
const directory={teachers:grade.names,schedule:grade.schedule,sourceVersion:grade.sourceVersion,sourceUrl:teacherSource,updatedAt:new Date().toISOString(),stale:false};
async function setup(){const DB=sqlite();await migrateLocal(DB);DB.exec("INSERT INTO users VALUES('director@prof.pmf.sc.gov.br','Direção','direction',1),('teacher@prof.pmf.sc.gov.br','Professor','teacher',1)");await DB.prepare('INSERT INTO teacher_directory(id,names,schedule,source_version,fetched_at) VALUES(1,?,?,?,?)').bind(JSON.stringify(grade.names),JSON.stringify(grade.schedule),grade.sourceVersion,new Date().toISOString()).run();return {DB}}
async function call(env,path,method='GET',data,email='director@prof.pmf.sc.gov.br'){
 const response=await handle(new Request('https://school.example/api/'+path,{method,headers:{Origin:'https://school.example','Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(data)}),env,async()=>email);
 return {status:response.status,body:await response.json()};
}
const preview=(env,date='2000-01-03',extraDays=1)=>call(env,'substitutions/preview?teacher='+encodeURIComponent('Ágata')+'&date='+date+'&extraDays='+extraDays);
const creation=(plan,overrides=[])=>({teacher:plan.teacher,date:plan.startDate,extraDays:plan.extraDays,fingerprint:plan.fingerprint,auxiliary:'aux-example-ana',overrides});

test('calendar days include weekends and grade supplies exact classes and variable bell times',async()=>{
 assert.deepEqual(consecutiveDates('2026-10-09',3),['2026-10-09','2026-10-10','2026-10-11','2026-10-12']);
 assert.throws(()=>consecutiveDates('2026-02-30',2));assert.throws(()=>consecutiveDates('2026-10-09',31));
 const weekend=await makeSubstitutionPlan(directory,'agata','2026-10-09',3);assert.equal(weekend.totalDays,4);assert.deepEqual(weekend.days.map(day=>day.lessons.length),[0,0,0,2]);assert.equal(weekend.teacher,'Ágata');
 const weekday=await makeSubstitutionPlan(directory,'Ágata','2000-01-03',2);assert.equal(weekday.lessonCount,4);assert.deepEqual(weekday.lessons.map(lesson=>[lesson.class,lesson.start,lesson.end]),[['71','07:30','08:15'],['72','08:15','09:00'],['62','08:15','09:00'],['81','14:30','15:15']]);
});
test('full-grade parser refuses partial or changed schedules and assigns pair schedules to both teachers',()=>{
 assert.throws(()=>parseSchoolGrade(html.replace('Ágata - 4 aulas','Ágata - 5 aulas')),/Quantidade/);
 assert.throws(()=>parseSchoolGrade(html.replace('07:30-08:15','horário removido')),/Aula/);
 assert.throws(()=>parseSchoolGrade(html.replace('<th>SEG</th>','<th>Dia desconhecido</th>')),/Dias/);
 const pairs=parseSchoolGrade(html.replace('Ágata - 4 aulas','Marina e Paula - 4 aulas'));assert.equal(pairs.schedule.Marina.length,4);assert.deepEqual(pairs.schedule.Marina,pairs.schedule.Paula);
});
test('all grade lessons default to one auxiliary, with per-lesson overrides and authoritative source times',async()=>{
 const env=await setup(),plan=(await preview(env)).body;
 assert.equal(plan.totalDays,2);assert.equal(plan.newLessonCount,3);
 const result=await call(env,'substitutions/from-schedule','POST',{...creation(plan,[{key:plan.lessons[1].key,auxiliary:'aux-example-beatriz'}]),class:'forged',start:'01:00',lessons:[{class:'invented'}]});assert.equal(result.status,201);assert.equal(result.body.count,3);
 const rows=(await call(env,'substitutions')).body;assert.deepEqual(rows.map(row=>row.auxiliary),['aux-example-ana','aux-example-beatriz','aux-example-ana']);assert.deepEqual(rows.map(row=>row.class),['71','72','62']);assert.equal(rows[0].start,'07:30');assert.ok(rows.every(row=>row.subject==='ARTES'&&row.absence_id===result.body.absenceId));
 const absence=await env.DB.prepare('SELECT * FROM substitution_absences').first();assert.equal(absence.total_days,2);assert.equal(absence.teacher,'Ágata');
 const weekly=(await call(env,'auxiliaries/weekly?date=2000-01-03')).body;assert.equal(weekly.auxiliaries.find(aux=>aux.id==='aux-example-ana').total,2);assert.equal(weekly.auxiliaries.find(aux=>aux.id==='aux-example-beatriz').total,1);
 assert.equal((await call(env,'substitutions/preview?teacher=Agata&date=2000-01-03','GET',undefined,'teacher@prof.pmf.sc.gov.br')).status,403);assert.equal((await call(env,'substitutions/from-schedule','POST',creation(plan),'teacher@prof.pmf.sc.gov.br')).status,403);
});
test('weekly limit or concurrent auxiliary conflict rolls back the whole plan and its absence record',async()=>{
 const env=await setup();env.DB.exec("UPDATE settings SET value=2 WHERE key='auxiliary_weekly_limit'");
 const plan=(await preview(env)).body;const overflow=await call(env,'substitutions/from-schedule','POST',creation(plan));assert.equal(overflow.status,409);
 for(const table of ['substitutions','substitution_absences','audit'])assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM '+table).first()).n,0);
 const split=await call(env,'substitutions/from-schedule','POST',creation(plan,[{key:plan.lessons[1].key,auxiliary:'aux-example-beatriz'}]));assert.equal(split.status,201);
 const concurrent=await setup(),before=(await preview(concurrent)).body;
 await call(concurrent,'substitutions','POST',{date:'2000-01-03',start:'07:30',end:'08:15',class:'Outra turma',teacher:'Outro professor',auxiliary:'aux-example-ana'});
 const clash=await call(concurrent,'substitutions/from-schedule','POST',creation(before));assert.equal(clash.status,409);assert.equal((await concurrent.DB.prepare('SELECT COUNT(*) AS n FROM substitution_absences').first()).n,0);assert.equal((await call(concurrent,'substitutions')).body.length,1);
});
test('changed grade fingerprints and forged or duplicate overrides cannot create lessons',async()=>{
 const env=await setup(),plan=(await preview(env)).body;
 for(const overrides of [[{key:'forged',auxiliary:'aux-example-ana'}],[{key:plan.lessons[0].key,auxiliary:'not-active'}],[{key:plan.lessons[0].key,auxiliary:null},{key:plan.lessons[0].key,auxiliary:null}]])assert.equal((await call(env,'substitutions/from-schedule','POST',creation(plan,overrides))).status,400);
 env.DB.exec("UPDATE teacher_directory SET source_version='new-version'");assert.equal((await call(env,'substitutions/from-schedule','POST',creation(plan))).status,409);assert.equal((await call(env,'substitutions')).body.length,0);
 assert.equal((await call(env,'substitutions/preview?teacher=Unknown&date=2000-01-03')).status,400);assert.equal((await preview(env,'2026-02-30')).status,400);
});
test('already registered lessons are preserved and only missing grade lessons are added',async()=>{
 const env=await setup();const existing=await call(env,'substitutions','POST',{date:'2000-01-03',start:'07:30',end:'08:15',class:'71',teacher:'Ágata',auxiliary:'aux-example-carla'});
 const plan=(await preview(env)).body;assert.equal(plan.lessonCount,3);assert.equal(plan.newLessonCount,2);assert.equal(plan.lessons[0].existing.id,existing.body.id);
 const result=await call(env,'substitutions/from-schedule','POST',creation(plan));assert.equal(result.status,201);assert.equal(result.body.count,2);assert.equal((await call(env,'substitutions')).body.find(row=>row.id===existing.body.id).auxiliary,'aux-example-carla');
 const repeat=(await preview(env)).body;assert.equal(repeat.newLessonCount,0);assert.equal((await call(env,'substitutions/from-schedule','POST',creation(repeat))).status,409);
 const partial=await setup();await call(partial,'substitutions','POST',{date:'2000-01-03',start:'07:30',end:'08:00',class:'71',teacher:'Ágata'});const conflicting=(await preview(partial)).body;assert.equal(conflicting.conflictCount,1);assert.equal((await call(partial,'substitutions/from-schedule','POST',creation(conflicting))).status,409);
});
test('a month of absence saves multiple D1-sized insert chunks atomically',async()=>{
 const env=await setup(),plan=(await preview(env,'2000-01-03',30)).body;assert.equal(plan.totalDays,31);assert.equal(plan.lessonCount,20);
 const result=await call(env,'substitutions/from-schedule','POST',creation(plan));assert.equal(result.status,201);assert.equal(result.body.count,20);assert.equal((await call(env,'substitutions')).body.length,20);
});
