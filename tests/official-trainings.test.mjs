import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sqlite} from '../scripts/sqlite-adapter.mjs';
import {migrateLocal} from '../scripts/migrate-local.mjs';
import {handle} from '../src/worker.mjs';
import {officialTrainingCalendar,officialTrainingSessions} from '../src/official-trainings.mjs';

test('SME snapshot preserves every dated source row, intervals and undated activities',async()=>{
 const source=JSON.parse(await readFile(new URL('./fixtures/sme-outubro-2026.json',import.meta.url),'utf8'));
 const clean=value=>value.replace(/[\u200b\u200c\u200d\ufeff]/g,'').trim();
 const dated=source.tables.flatMap(table=>table.rows.map((row,index)=>({table:table.index,row:index,cells:row.map(clean)}))).filter(x=>x.cells.some(cell=>/^\d{2}\/10\/2026$/.test(cell)));
 assert.equal(dated.length,82);
 assert.equal(officialTrainingSessions.length,100);
 assert.equal(new Set(officialTrainingSessions.map(x=>x.id)).size,100);
 assert.equal(new Set(officialTrainingSessions.map(x=>x.area)).size,19);
 for(const row of dated){
  const sessions=officialTrainingSessions.filter(x=>Number(x.id.split('-')[3])===row.table&&x.sourceRow===row.row);
  assert.ok(sessions.length>0,'Missing source row '+row.table+'/'+row.row);
  const originalDate=row.cells.find(x=>/^\d{2}\/10\/2026$/.test(x)).split('/').reverse().join('-');
  assert.ok(sessions.every(x=>x.date===originalDate),'Changed source date');
 }
 for(const entry of officialTrainingSessions){
  assert.match(entry.date,/^2026-10-\d{2}$/);assert.match(entry.start,/^([01]\d|2[0-3]):[0-5]\d$/);assert.match(entry.end,/^([01]\d|2[0-3]):[0-5]\d$/);
  assert.ok(entry.end>entry.start);assert.equal(entry.official,true);assert.ok(entry.sourcePage>=4&&entry.sourcePage<=25);assert.ok(entry.group);
  assert.ok(dated.some(x=>x.table===Number(entry.id.split('-')[3])&&x.row===entry.sourceRow),'Invented source row');
 }
 const ranges=(area,group,date)=>officialTrainingSessions.filter(x=>x.area===area&&x.group===group&&x.date===date).map(x=>x.start+'-'+x.end).sort();
 assert.deepEqual(ranges('Matemática','Grupo 3','2026-10-08'),['09:00-12:00','13:00-16:00']);
 assert.deepEqual(ranges('Educação Física','Grupo 4','2026-10-06'),['09:00-11:00','13:00-16:00']);
 assert.deepEqual(ranges('Professor Auxiliar de Ensino Fundamental','Grupo 2','2026-10-21'),['13:30-15:30']);
 assert.deepEqual(ranges('5º ano','Grupo B','2026-10-21'),['13:00-15:00']);
 assert.equal(officialTrainingCalendar.unscheduled.length,4);
 assert.deepEqual(officialTrainingCalendar.unscheduled.map(x=>x.area+'/'+x.group),['Matemática/Grupo 1','Matemática/Grupo 3','Matemática/Grupo 4','Estudos Matemáticos/Grupo 1']);
 assert.ok(officialTrainingSessions.filter(x=>['Artes','Educação Física'].includes(x.area)&&x.notes.includes('Confirme com a SME.')).length>0);
 const csv=await readFile(new URL('../src/staff-assets/formacao-outubro-2026.csv',import.meta.url),'utf8');
 assert.equal(csv.charCodeAt(0),0xfeff);assert.equal(csv.trim().split(/\r?\n/).length,105);assert.ok(csv.includes('"Matemática";"Grupo 3";"Formação central";"08/10/2026";"09:00";"12:00"'));
});

test('official schedule and CSV require active staff, remain read-only and never reach the public calendar',async()=>{
 const DB=sqlite();await migrateLocal(DB);
 DB.exec("INSERT INTO users VALUES('team@prof.pmf.sc.gov.br','Equipe fictícia','direction',1),('teacher@prof.pmf.sc.gov.br','Docente fictício','teacher',1),('inactive@prof.pmf.sc.gov.br','Inativo fictício','teacher',0)");
 const assets=[];const env={DB,ASSETS:{async fetch(request){assets.push(new URL(request.url).pathname);return new Response('synthetic CSV',{headers:{'Content-Type':'text/csv; charset=utf-8'}})}}};
 const request=(path,method='GET',body,email='teacher@prof.pmf.sc.gov.br')=>handle(new Request('https://school.example'+path,{method,headers:{Origin:'https://school.example','Content-Type':'application/json'},body:['GET','HEAD'].includes(method)?undefined:JSON.stringify(body||{})}),env,async()=>email);
 try{
  for(const path of ['/api/official-trainings',officialTrainingCalendar.downloadPath]){
   assert.equal((await request(path,'GET',undefined,null)).status,401);
   assert.equal((await request(path,'GET',undefined,'inactive@prof.pmf.sc.gov.br')).status,403);
  }
  for(const email of ['team@prof.pmf.sc.gov.br','teacher@prof.pmf.sc.gov.br']){
   const response=await request('/api/official-trainings','GET',undefined,email);assert.equal(response.status,200);const data=await response.json();
   assert.equal(data.sessions.length,100);assert.equal(data.calendar.period,'2026-10');
   const download=await request(officialTrainingCalendar.downloadPath,'GET',undefined,email);assert.equal(download.status,200);assert.equal(download.headers.get('Content-Type'),'text/csv; charset=utf-8');
  }
  assert.deepEqual(assets,['/formation-outubro-2026.csv','/formation-outubro-2026.csv']);
  assert.equal((await request('/api/official-trainings','POST',{})).status,403);
  assert.ok((await request('/api/official-trainings','POST',{},'team@prof.pmf.sc.gov.br')).status>=400);
  assert.equal((await request('/formation-outubro-2026.csv','GET',undefined,null)).status,401);
  assert.equal((await request('/api/trainings/'+officialTrainingSessions[0].id,'DELETE',{version:1},'team@prof.pmf.sc.gov.br')).status,404);
  const publicData=await (await request('/public/api','GET',undefined,null)).json();assert.deepEqual(publicData.events,[]);
  assert.equal((await DB.prepare('SELECT COUNT(*) AS count FROM events').first()).count,0);
  assert.equal((await DB.prepare('SELECT COUNT(*) AS count FROM audit').first()).count,0);
 }finally{DB.close()}
});
