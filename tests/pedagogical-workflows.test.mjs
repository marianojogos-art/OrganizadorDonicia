import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {sqlite} from '../scripts/sqlite-adapter.mjs';
import {handle} from '../src/worker.mjs';
import {highlightFields} from '../src/pedagogical-workflows.mjs';
const roles={direction:'team',supervision:'supervision',guidance:'guidance',teacher:'teacher',other:'other'};
async function setup(){
 const DB=sqlite();for(const name of (await readdir(new URL('../migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort())DB.exec(await readFile(new URL('../migrations/'+name,import.meta.url),'utf8'));
 for(const [role,name] of Object.entries(roles))await DB.prepare('INSERT INTO users VALUES(?,?,?,1)').bind(name+'@example.test',name,role==='other'?'teacher':role).run();
 return {DB};
}
async function send(env,path,method='GET',data,role='direction'){
 const response=await handle(new Request('https://school.example'+path,{method,headers:{Origin:'https://school.example','Content-Type':'application/json'},body:['GET','HEAD'].includes(method)?undefined:JSON.stringify(data)}),env,async()=>roles[role]?roles[role]+'@example.test':null);
 return {status:response.status,body:response.headers.get('Content-Type')?.includes('json')?await response.json():await response.arrayBuffer()};
}
const reservation={space:'Biblioteca',date:'2026-11-10',start:'09:00',end:'10:00',responsible:'Docente fictício',purpose:'Leitura',class:'Turma fictícia',subject:'Leitura'};
const request={type:'material',title:'Papel',classes:'Turma fictícia',description:'Dez folhas',deadline:'2026-11-10'};
test('all three pedagogical roles require a reason, cannot approve before resubmission, and preserve ownership, audit and versions',async()=>{
 for(const role of ['direction','supervision','guidance']){
 const env=await setup();try{
 for(const [kind,data] of [['reservations',reservation],['staff-requests',request],['xerox',{title:'Atividade',copies:10,deadline:'2026-11-10'}]]){
  const created=await send(env,'/api/'+kind,'POST',data,'teacher');assert.equal(created.status,201,JSON.stringify(created));const path='/api/'+kind+'/'+created.body.id,status=kind==='xerox'?'Devolvido para ajustes':'Devolvida para ajustes';
  assert.equal((await send(env,path,'PATCH',{status,version:1},role)).status,400);
  assert.equal((await send(env,path,'PATCH',{status,review_reason:' ',version:1},role)).status,400);
  assert.equal((await send(env,path,'PATCH',{status,review_reason:'Informe as quantidades.',version:1},'teacher')).status,403);
  assert.equal((await send(env,path,'PATCH',{status,review_reason:'Informe as quantidades.',version:1},role)).status,200);
  const own=(await send(env,'/api/'+kind,'GET',null,'teacher')).body[0];assert.equal(own.status,status);assert.equal(own.review_reason,'Informe as quantidades.');assert.equal(own.version,2);
  const foreign=(await send(env,'/api/'+kind,'GET',null,'other')).body;assert.equal(foreign.some(x=>x.id===created.body.id),false);
  assert.ok((await send(env,path,'PATCH',{status:kind==='xerox'?'Aprovado':'Aprovada',version:2},role)).status>=400);
  const corrected={...data,version:2,...(kind==='reservations'?{edit:true,purpose:'Leitura corrigida'}:{resubmit:true})};
  assert.ok((await send(env,path,'PATCH',corrected,'other')).status>=400);
  assert.equal((await send(env,path,'PATCH',corrected,'teacher')).status,200);
  assert.equal((await send(env,path,'PATCH',corrected,'teacher')).status,409);
  assert.equal((await send(env,path,'PATCH',{status:kind==='xerox'?'Aprovado':'Aprovada',version:3},role)).status,200);
  const row=(await send(env,'/api/'+kind,'GET',null,'teacher')).body[0];assert.equal(row.version,4);assert.equal(row.review_reason,'Informe as quantidades.');
  if(kind==='reservations'){const shared=(await send(env,'/api/reservations','GET',null,'other')).body[0];assert.equal(shared.review_reason,'');assert.equal(shared.owner,'')}
  assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM audit WHERE target=?').bind(path).first()).n,4);
 }
 }finally{env.DB.close()}
 }
});
test('highlight dates are independent of publication, and drafts and private images never reach anonymous responses',async()=>{
 const env=await setup();try{
 const content={kind:'project',title:'Projeto fictício',description:'Texto autorizado',category:'Cultura',url:'',published:true,authorization_confirmed:true,featured:true,highlight_from:'2000-01-01',highlight_until:'2999-12-31'};
 const active=await send(env,'/api/public-content','POST',content);assert.equal(active.status,201);
 const expired=await send(env,'/api/public-content','POST',{...content,title:'Destaque encerrado',highlight_until:'2001-01-01'});assert.equal(expired.status,201);
 await send(env,'/api/public-content','POST',{...content,title:'Rascunho secreto',published:false});
 const notFeatured=await send(env,'/api/notices','POST',{title:'Aviso sem destaque',body:'Mural',date:'2000-01-01',published:true,featured:false});assert.equal(notFeatured.status,201);
 let list=await send(env,'/public/highlights','GET',null,null);assert.deepEqual(list.body.items.map(x=>x.title),['Projeto fictício']);assert.doesNotMatch(JSON.stringify(list.body),/creator|example.test|version|attachment_data/);
 const published=await send(env,'/public/content','GET',null,null);assert.equal(published.body.items.length,2);
 assert.equal((await send(env,'/api/public-content/'+active.body.id+'/image','GET',null,null)).status,401);
 assert.equal((await send(env,'/api/public-content/'+active.body.id+'/image','GET',null,'teacher')).status,403);
 assert.equal((await send(env,'/api/public-content','POST',{...content,highlight_from:'2026-02-30'})).status,400);
 assert.equal((await send(env,'/api/public-content','POST',{...content,highlight_until:'1999-01-01'})).status,400);
 assert.equal((await send(env,'/api/public-content/'+active.body.id,'PATCH',{...content,published:false,version:1})).status,200);
 list=await send(env,'/public/highlights','GET',null,null);assert.equal(list.body.items.length,0);
 }finally{env.DB.close()}
 assert.deepEqual(highlightFields({featured:true,highlight_from:'2026-10-15',highlight_until:'2026-10-15'}),[1,'2026-10-15','2026-10-15']);
});
