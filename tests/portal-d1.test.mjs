import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {handle} from '../src/worker.mjs';

// Repository migrations keep each trigger on one line; accumulate multiline INSERTs.
function statements(sql){
 const result=[];let current='';
 for(const line of sql.split(/\r?\n/)){if(!line.trim()||line.trim().startsWith('--'))continue;current+=line+'\n';if(line.trimEnd().endsWith(';')){result.push(current);current=''}}
 assert.equal(current.trim(),'','migration must end with a complete SQL statement');return result;
}

test('D1 migration preserves referenced users and atomically resolves approval conflicts',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-10-03',cf:false,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{DB:'synthetic-public-portal'}}));
 try{
  const DB=await mf.getD1Database('DB');
  const files=(await readdir(new URL('../migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')).sort();
  for(const file of files.slice(0,-1)){const sql=await readFile(new URL('../migrations/'+file,import.meta.url),'utf8');await DB.batch(statements(sql).map(statement=>DB.prepare(statement)))}
  await DB.batch([
   DB.prepare("INSERT INTO users VALUES('team@prof.pmf.sc.gov.br','Equipe fictícia','direction',1),('teacher@prof.pmf.sc.gov.br','Professor fictício','teacher',1)"),
   DB.prepare("INSERT INTO reservations(id,space,date,start,end,owner,purpose,responsible) VALUES('legacy','Biblioteca','2026-10-19','09:00','10:00','teacher@prof.pmf.sc.gov.br','Leitura','Professor fictício')"),
   DB.prepare("INSERT INTO events(id,title,date,type,creator) VALUES('legacy-event','Reunião interna','2026-10-19','Reunião','team@prof.pmf.sc.gov.br')"),
   DB.prepare("INSERT INTO personal_notes(id,owner,title,content) VALUES('legacy-note','teacher@prof.pmf.sc.gov.br','Nota fictícia','Texto fictício')"),
   DB.prepare("INSERT INTO audit(id,actor,action,target) VALUES('legacy-audit','team@prof.pmf.sc.gov.br','POST','/api/reservations/legacy')")
  ]);
  const migration=await readFile(new URL('../migrations/'+files.at(-1),import.meta.url),'utf8');
  await DB.batch(statements(migration).map(statement=>DB.prepare(statement)));
  assert.deepEqual((await DB.prepare('PRAGMA foreign_key_check').all()).results,[]);
  assert.equal((await DB.prepare("SELECT status FROM reservations WHERE id='legacy'").first()).status,'Aprovada');
  assert.equal((await DB.prepare("SELECT visibility FROM events WHERE id='legacy-event'").first()).visibility,'internal');
  assert.equal((await DB.prepare("SELECT actor FROM audit WHERE id='legacy-audit'").first()).actor,'team@prof.pmf.sc.gov.br');
  assert.equal((await DB.prepare("SELECT content FROM personal_notes WHERE id='legacy-note'").first()).content,'Texto fictício');
  await assert.rejects(()=>DB.prepare("DELETE FROM users WHERE email='teacher@prof.pmf.sc.gov.br'").run(),/FOREIGN KEY/);
  await DB.prepare("UPDATE users SET role='supervision' WHERE email='team@prof.pmf.sc.gov.br'").run();
  const env={DB};
  async function send(path,method='GET',data,email='team@prof.pmf.sc.gov.br'){
   const response=await handle(new Request('https://school.example'+path,{method,headers:{Origin:'https://school.example','Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(data)}),env,async()=>email);
   return {status:response.status,body:await response.json()};
  }
  assert.equal((await send('/api/public','GET',undefined,null)).body.events.length,0);
  const booking={space:'Auditório',date:'2026-10-20',start:'09:00',end:'10:00',purpose:'Atividade fictícia',responsible:'Professor fictício'};
  const first=await send('/api/reservations','POST',booking,'teacher@prof.pmf.sc.gov.br'),second=await send('/api/reservations','POST',booking,'teacher@prof.pmf.sc.gov.br');
  assert.equal(first.status,201);assert.equal(second.status,201);
  const approval=await Promise.all([first,second].map(created=>send('/api/reservations/'+created.body.id,'PATCH',{status:'Aprovada',version:1})));
  assert.deepEqual(approval.map(result=>result.status).sort(),[200,409]);
  assert.equal((await DB.prepare("SELECT COUNT(*) AS total FROM audit WHERE target LIKE '/api/reservations/%'").first()).total,4);
  const formation=await send('/api/events','POST',{title:'Formação fictícia',date:'2026-10-21',type:'Formação',visibility:'internal',details:'Prévia',area:'Linguagens'});
  assert.equal(formation.status,201);
  const list=(await send('/api/trainings','GET',undefined,'teacher@prof.pmf.sc.gov.br')).body;assert.equal(list[0].id,formation.body.id);assert.equal(list[0].notes,'Prévia');
  assert.equal((await send('/api/trainings/'+formation.body.id,'PATCH',{title:'Formação revisada',date:'2026-10-21',area:'Linguagens',notes:'Revisão',version:1})).status,200);
  assert.equal((await DB.prepare('SELECT details FROM events WHERE id=?').bind(formation.body.id).first()).details,'Revisão');
  assert.deepEqual((await DB.prepare('PRAGMA foreign_key_check').all()).results,[]);
 }finally{await mf.dispose()}
});
