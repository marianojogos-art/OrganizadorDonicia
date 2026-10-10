import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import vm from 'node:vm';
import {sqlite} from '../scripts/sqlite-adapter.mjs';
import {collectSupervision,snapshotAdapter} from '../src/supervision.mjs';
import {loadSupervision,saveSupervision,updateTargets} from '../src/supervision-store.mjs';
import {handle} from '../src/worker.mjs';
const origin='https://school.example',base='https://www.sgebr.net.br/sge8105/',classId='106801:2026:1:1:1:11',actor='d@prof.pmf.sc.gov.br';
async function setup(){const DB=sqlite();for(const m of ['0001_initial.sql','0005_supervision.sql'])DB.exec(await readFile(new URL('../migrations/'+m,import.meta.url),'utf8'));DB.exec(`INSERT INTO users VALUES('${actor}','Direção fictícia','direction',1),('t@prof.pmf.sc.gov.br','Docente fictício','teacher',1)`);return DB}
function fixture(){const path='/classes/'+encodeURIComponent(classId)+'/teachers',teachers=[{id:'mat-1',assignmentId:'202:1',name:'Ana',subject:'Português',url:base+'teacher.aspx'},{id:'mat-2',assignmentId:'202:2',name:'Bia',subject:'Português',url:base+'teacher.aspx'}];return {classIds:[classId],scope:'classes',teacher:'',snapshot:{directory:{complete:true,sourceUrl:base+'classes.aspx',classes:[{id:classId,name:'Turma fictícia',url:base+'classes.aspx'}]},entries:[{path,data:{classId,complete:true,teachers}},...teachers.map(t=>({path:path+'/'+encodeURIComponent(t.assignmentId)+'/planning',data:{classId,teacherId:t.id,assignmentId:t.assignmentId,name:t.name+' Fictícia',complete:true,plans:[{id:'1',title:'Março',trimester:1,situation:'Não enviado para análise',url:base+'detail.aspx'},{id:'2',title:'Junho',trimester:2,situation:'Planejamento finalizado',url:base+'detail.aspx'}]}}))]}}}
const read=f=>collectSupervision({SGE:snapshotAdapter(f.snapshot)},f);
const options={actor,actorName:'Direção fictícia'};
test('shared class snapshots persist, preserve failed readings and reject concurrent overwrites',async()=>{
 const DB=await setup(),f=fixture(),empty=await loadSupervision(DB),fresh=await read(f);fresh.updatedAt='2026-10-06T10:00:00Z';
 const saved=await saveSupervision(DB,empty,fresh,options);assert.equal(saved.version,1);assert.equal((await loadSupervision(DB)).teachers[0].plans.length,2);
 f.snapshot.entries[1]={path:f.snapshot.entries[1].path,error:'Falha'};const partial=await read(f);partial.updatedAt='2026-10-06T11:00:00Z';
 const next=await saveSupervision(DB,saved,partial,options);assert.equal(next.complete,false);assert.equal(next.teachers[0].plans.length,2);assert.equal(next.teachers[0].plans[0].checkedAt,'2026-10-06T10:00:00Z');assert.equal(next.teachers[0].assignments[0].ok,false);assert.equal(next.teachers[0].assignments[0].lastAttemptAt,partial.updatedAt);
 await assert.rejects(saveSupervision(DB,saved,fresh,options),/Outra pessoa/);const loaded=await loadSupervision(DB);assert.equal(loaded.version,2);assert.equal(loaded.complete,false);assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM audit').first()).n,2);
});
test('selective update follows saved situation, preserves other timestamps and includes new plans',async()=>{
 const DB=await setup(),f=fixture(),fresh=await read(f);fresh.updatedAt='2026-10-06T10:00:00Z';const saved=await saveSupervision(DB,await loadSupervision(DB),fresh,options);
 const input={...f,teacher:'Ana',updateSituation:'Não enviado para análise'};const targets=updateTargets(saved,input);assert.deepEqual(targets,[{classId,assignmentId:'202:1'}]);
 const plans=f.snapshot.entries[1].data.plans;plans[0].situation='Planejamento finalizado';plans[1].situation='Em análise';plans.push({...plans[1],id:'3',title:'Novo outubro',trimester:3});
 const current=await read({...input,targetAssignments:targets});current.updatedAt='2026-10-06T11:00:00Z';const report=await saveSupervision(DB,saved,current,{...options,situation:input.updateSituation});
 const ana=report.teachers.find(t=>t.id==='mat-1'),bia=report.teachers.find(t=>t.id==='mat-2');ana.plans.sort((a,b)=>a.id.localeCompare(b.id));assert.equal(ana.plans[0].situation,'Planejamento finalizado');assert.equal(ana.plans[0].checkedAt,current.updatedAt);assert.equal(ana.plans[1].situation,'Planejamento finalizado');assert.equal(ana.plans[1].checkedAt,fresh.updatedAt);assert.equal(ana.plans[2].isNew,true);assert.equal(ana.summary.total,3);assert.equal(bia.plans[0].checkedAt,fresh.updatedAt);assert.equal(report.selective,true);
});
test('save API validates shared revision, direction, origin and targets against persisted data',async()=>{
 const DB=await setup(),f=fixture();const call=(path,method='GET',data,who=actor,requestOrigin=origin)=>handle(new Request(origin+'/api/supervision/'+path,{method,headers:{Origin:requestOrigin,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined}),{DB},async()=>who);
 assert.equal((await call('saved','GET',null,'t@prof.pmf.sc.gov.br')).status,403);assert.equal((await call('save','POST',{...f,version:0},actor,'https://evil.example')).status,403);
 const first=await call('save','POST',{...f,version:0});assert.equal(first.status,200);const report=await first.json();assert.equal(report.updatedByName,'Direção fictícia');assert.equal((await call('saved')).status,200);
 assert.equal((await call('save','POST',{...f,version:0})).status,409);assert.equal((await call('save','POST',{...f,version:1,updateSituation:'Inexistente'})).status,400);
 const selected=await call('save','POST',{...f,version:1,teacher:'Ana',updateSituation:'Não enviado para análise',targetAssignments:[{classId,assignmentId:'202:2'}]});assert.equal(selected.status,200);const updated=await selected.json();assert.equal(updated.teachers.find(t=>t.id==='mat-2').plans[0].checkedAt,report.teachers.find(t=>t.id==='mat-2').plans[0].checkedAt);
});
test('UI loads shared results without SGE, shows timestamps and confirms selective scope',async()=>{
 const DB=await setup(),f=fixture(),fresh=await read(f);fresh.updatedAt='2026-10-06T10:00:00Z';const saved=await saveSupervision(DB,await loadSupervision(DB),fresh,options);
 const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8'),{document,window}=parseHTML(html),context=vm.createContext({document,window,URL,Date,Intl,setTimeout:()=>{},FormData});const script=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('});boot();','});');vm.runInContext(script,context);context.saved=saved;context.directory=f.snapshot.directory;
 vm.runInContext("currentUser={role:'direction'};api=async()=>saved;state.section='supervisao'",context);await vm.runInContext('loadSavedSupervision()',context);assert.match(document.querySelector('#page').textContent,/Responsável: Direção fictícia/);assert.match(document.querySelector('#page').textContent,/Consultado em/);
 vm.runInContext("supervision.directory=directory;supervision.selected=new Set([directory.classes[0].id]);supervision.teacher='Ana';supervision.updateSituation='Não enviado para análise';render()",context);assert.equal(document.querySelector('[data-supervision-update]').disabled,false);assert.match(document.querySelector('[data-supervision-update-controls]').textContent,/1 vínculo/);
 vm.runInContext("supervisionBridge=async()=>({});collectSupervisionSnapshot=async input=>{globalThis.sent=input;return {}}",context);await vm.runInContext('confirmSupervision(true)',context);assert.equal(context.sent.version,1);assert.equal(context.sent.targetAssignments.length,1);assert.equal(context.sent.targetAssignments[0].assignmentId,'202:1');
});

test('D1 runtime executes atomic class snapshots and consistent shared reads',async()=>{
 const {Miniflare,convertV4MiniflareOptions}=await import('miniflare');
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-10-03',cf:false,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{DB:'synthetic-supervision'}}));
 try{
  const DB=await mf.getD1Database('DB');for(const m of ['0001_initial.sql','0005_supervision.sql']){const sql=await readFile(new URL('../migrations/'+m,import.meta.url),'utf8');for(const line of sql.split(/\r?\n/).filter(x=>x.trim()&&!x.startsWith('PRAGMA')&&!x.trim().startsWith('--')))await DB.prepare(line).run()}
  await DB.prepare('INSERT INTO users VALUES(?,?,?,1)').bind(actor,'Direção fictícia','direction').run();
  const saved=await loadSupervision(DB),fresh=await read(fixture());await saveSupervision(DB,saved,fresh,options);const result=await loadSupervision(DB);assert.equal(result.version,1);assert.equal(result.teachers.length,2);assert.equal(result.teachers[0].plans.length,2);
  await assert.rejects(saveSupervision(DB,saved,fresh,options),/Outra pessoa/);assert.equal((await loadSupervision(DB)).version,1);
 }finally{await mf.dispose()}
});

test('teacher summary survives class snapshots with identical planning IDs across classes',async()=>{
 const DB=await setup(),f=fixture(),other=classId.replace(/11$/,'12');
 f.classIds.push(other);f.snapshot.directory.classes.push({...f.snapshot.directory.classes[0],id:other,name:'Outra turma fictícia'});
 for(const entry of [...f.snapshot.entries]){const copy=structuredClone(entry);copy.path=copy.path.replace(encodeURIComponent(classId),encodeURIComponent(other));copy.data.classId=other;f.snapshot.entries.push(copy)}
 const saved=await saveSupervision(DB,await loadSupervision(DB),await read(f),options);const loaded=await loadSupervision(DB);assert.equal(loaded.teachers[0].summary.total,4);assert.equal(loaded.teachers[0].summary.classes.length,2);
 const selective={...f,classIds:[classId],teacher:'Ana',updateSituation:'Não enviado para análise'};f.snapshot.entries[1].data.plans[0].situation='Planejamento finalizado';const fresh=await read({...selective,targetAssignments:updateTargets(saved,selective)});await saveSupervision(DB,saved,fresh,{...options,situation:selective.updateSituation});const result=await loadSupervision(DB);
 assert.equal(result.teachers[0].plans.find(p=>p.classId===other&&p.id==='1').situation,'Não enviado para análise');assert.equal(result.teachers[0].plans.find(p=>p.classId===classId&&p.id==='1').situation,'Planejamento finalizado');
});
test('empty readings differ from failures and disappearing plans remain visibly preserved',async()=>{
 const DB=await setup(),f=fixture(),saved=await saveSupervision(DB,await loadSupervision(DB),await read(f),options);
 f.snapshot.entries[1].data.plans=[];const fresh=await read(f),next=await saveSupervision(DB,saved,fresh,options);assert.ok(next.teachers[0].plans.every(p=>p.notFound));assert.equal(next.teachers[0].assignments[0].ok,true);
 const newDB=await setup(),empty=await saveSupervision(newDB,await loadSupervision(newDB),fresh,options);assert.equal(empty.teachers[0].summary.total,0);assert.equal(empty.teachers[0].summary.failedAssignments,0);
 f.snapshot.entries[1]={path:f.snapshot.entries[1].path,error:'Falha'};const fail=await saveSupervision(newDB,empty,await read(f),options);assert.equal(fail.teachers[0].summary.failedAssignments,1);
});
