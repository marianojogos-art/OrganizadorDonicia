import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {sqlite} from '../scripts/sqlite-adapter.mjs';
import {handle} from '../src/worker.mjs';
import {clampPosition,pageContext} from '../src/public-assets/feedback.js';
import {parseHTML} from 'linkedom';
const files=(await readdir(new URL('../migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')).sort();
const migrations=await Promise.all(files.map(name=>readFile(new URL('../migrations/'+name,import.meta.url),'utf8')));
function setup(){
 const DB=sqlite();for(const sql of migrations)DB.exec('BEGIN;'+sql+'COMMIT;');
 DB.exec("INSERT INTO users(email,name,role,active) VALUES('direction@prof.pmf.sc.gov.br','Direção fictícia','direction',1),('teacher@prof.pmf.sc.gov.br','Docente fictício','teacher',1),('supervision@prof.pmf.sc.gov.br','Supervisão fictícia','supervision',1),('guidance@prof.pmf.sc.gov.br','Orientação fictícia','guidance',1)");
 return {DB,ASSETS:{fetch:async request=>new Response(new URL(request.url).pathname)}};
}
function draft(extra={}){return {id:crypto.randomUUID(),visitorId:crypto.randomUUID(),kind:'improvement',message:'Melhorar o acesso ao calendário.',contributor:'',page:{path:'/',section:'calendario',title:'Calendário público'},website:'',...extra}}
async function send(env,path,method='GET',data,role='anonymous',extraHeaders={}){
 const response=await handle(new Request('https://school.example'+path,{method,headers:{Origin:'https://school.example','Content-Type':'application/json',...extraHeaders},body:['GET','HEAD'].includes(method)?undefined:JSON.stringify(data)}),env,async()=>role==='anonymous'?null:role+'@prof.pmf.sc.gov.br');
 const text=await response.text();let body;try{body=JSON.parse(text)}catch{body=text}return {status:response.status,body,headers:response.headers};
}
test('anonymous contribution records its exact page and is not exposed to visitors or teachers',async()=>{
 const env=setup(),input=draft({contributor:'Pessoa fictícia'}),result=await send(env,'/public/feedback','POST',input);
 assert.equal(result.status,201);
 assert.equal((await send(env,'/public/feedback')).status,405);
 assert.equal((await send(env,'/public/feedback','HEAD')).status,204);
 assert.equal((await send(env,'/api/feedback')).status,401);
 assert.equal((await send(env,'/api/feedback','GET',undefined,'teacher')).status,403);
 for(const path of ['/public-assets/feedback.js','/public-assets/feedback.css'])assert.equal((await send({ASSETS:env.ASSETS},path)).status,200);
 for(const role of ['direction','supervision','guidance']){
  const read=await send(env,'/api/feedback','GET',undefined,role);assert.equal(read.status,200);assert.equal(read.body.items.length,1);
  assert.equal(read.body.items[0].page_path,'/');assert.equal(read.body.items[0].page_section,'calendario');assert.equal(read.body.items[0].page_title,'Calendário público');assert.equal(read.body.items[0].contributor,'Pessoa fictícia');assert.equal(Object.hasOwn(read.body.items[0],'visitor_id'),false);
 }
 const portal=await send(env,'/public/api');assert.equal(JSON.stringify(portal.body).includes(input.message),false);
 env.DB.close();
});
test('retries are idempotent while conflicting payloads and repeated sends are bounded',async()=>{
 const env=setup(),input=draft();
 const results=await Promise.all(Array.from({length:4},()=>send(env,'/public/feedback','POST',input)));
 assert.deepEqual(results.map(x=>x.status).sort(),[200,200,200,201]);
 assert.equal((await env.DB.prepare('SELECT count(*) AS count FROM site_feedback').first()).count,1);
 assert.equal((await send(env,'/public/feedback','POST',{...input,message:'Outro texto'})).status,409);
 for(let i=1;i<12;i++)assert.equal((await send(env,'/public/feedback','POST',{...input,id:crypto.randomUUID()})).status,201);
 const limited=await send(env,'/public/feedback','POST',{...input,id:crypto.randomUUID()});assert.equal(limited.status,429);assert.equal(limited.headers.get('Retry-After'),'3600');
 assert.equal((await send(env,'/public/feedback','POST',input)).status,200);
 env.DB.close();
});
test('foreign origins, invalid page paths, excessive bodies and invalid note fields cannot be saved',async()=>{
 const env=setup();
 assert.equal((await send(env,'/public/feedback','POST',draft(),'anonymous',{Origin:'https://other.example'})).status,403);
 assert.equal((await send(env,'/public/feedback','POST',draft(),'anonymous',{'Content-Type':'text/plain'})).status,415);
 for(const patch of [{message:' '},{message:'x'.repeat(3001)},{kind:'script'},{visitorId:'guess'},{id:'guess'},{contributor:'x'.repeat(81)},{page:{path:'https://other.example',section:'',title:'X'}},{page:{path:'/../private',section:'',title:'X'}},{page:{path:'/',section:'<img>',title:'X'}},{page:{path:'/',section:'',title:''}}]){
  assert.equal((await send(env,'/public/feedback','POST',draft(patch))).status,400,JSON.stringify(patch).slice(0,100));
 }
 assert.equal((await send(env,'/public/feedback','POST',draft({message:'😀'.repeat(1500),website:'x'.repeat(20000)}))).status,413);
 assert.equal((await send(env,'/public/feedback','POST',draft({website:'bot'}))).status,201);
 assert.equal((await env.DB.prepare('SELECT count(*) AS count FROM site_feedback').first()).count,0);
 env.DB.close();
});
test('page filters distinguish public anchors and staff sections; pagination preserves every contribution',async()=>{
 const env=setup();
 const entries=[draft({page:{path:'/',section:'',title:'Página inicial'}}),draft(),draft({kind:'feature',page:{path:'/equipe',section:'calendario',title:'Calendário da equipe'}})];
 for(const input of entries)assert.equal((await send(env,'/public/feedback','POST',input)).status,201);
 let read=await send(env,'/api/feedback?page=%2F&section=','GET',undefined,'direction');assert.equal(read.body.total,1);assert.equal(read.body.items[0].id,entries[0].id);
 read=await send(env,'/api/feedback?page=%2Fequipe&section=calendario&kind=feature&status=Nova','GET',undefined,'direction');assert.equal(read.body.total,1);assert.equal(read.body.pages.length,3);assert.equal(read.body.items[0].id,entries[2].id);
 for(let i=0;i<32;i++)await send(env,'/public/feedback','POST',draft());
 const first=await send(env,'/api/feedback','GET',undefined,'direction'),next=await send(env,'/api/feedback?offset=30','GET',undefined,'direction');
 assert.equal(first.body.total,35);assert.equal(first.body.items.length,30);assert.equal(next.body.items.length,5);assert.equal(new Set([...first.body.items,...next.body.items].map(x=>x.id)).size,35);
 assert.equal((await send(env,'/api/feedback?status=invalid','GET',undefined,'direction')).status,400);
 assert.equal((await send(env,'/api/feedback?offset=-1','GET',undefined,'direction')).status,400);
 env.DB.close();
});
test('triage requires the pedagogical role, detects concurrent changes and audits atomically',async()=>{
 const env=setup(),input=draft();await send(env,'/public/feedback','POST',input);
 const path='/api/feedback/'+input.id;
 assert.equal((await send(env,path,'PATCH',{status:'Planejada',version:1},'teacher')).status,403);
 assert.equal((await send(env,path,'PATCH',{status:'Planejada',version:1})).status,401);
 assert.equal((await send(env,path,'PATCH',{status:'bad',version:1},'direction')).status,400);
 const results=await Promise.all(['direction','supervision'].map(role=>send(env,path,'PATCH',{status:'Planejada',version:1},role)));
 assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
 assert.equal((await env.DB.prepare('SELECT version FROM site_feedback').first()).version,2);
 assert.equal((await env.DB.prepare("SELECT count(*) AS count FROM audit WHERE target=?").bind(path).first()).count,1);
 env.DB.exec("CREATE TRIGGER reject_feedback_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT,'test_failure'); END");
 assert.equal((await send(env,path,'PATCH',{status:'Implementada',version:2,reply:'Atendido em ambiente fictício',evidence:'Publicação e teste fictícios verificados'},'direction')).status,503);
 assert.equal((await env.DB.prepare('SELECT status FROM site_feedback').first()).status,'Planejada');
 env.DB.close();
});
test('drag positions stay fully visible after resize and visual viewport movement',()=>{
 assert.deepEqual(clampPosition({x:-999,y:-999},{width:368,height:510},{width:1440,height:900}),{x:8,y:8});
 assert.deepEqual(clampPosition({x:9999,y:9999},{width:304,height:400},{width:320,height:480}),{x:8,y:72});
 assert.deepEqual(clampPosition({x:0,y:0},{width:250,height:150},{left:40,top:200,width:300,height:240}),{x:48,y:208});
 const result=clampPosition({x:NaN,y:undefined},{width:304,height:200},{width:320,height:240});assert.deepEqual(result,{x:8,y:8});
});
test('page context captures the public anchor, staff section and open form without URL query secrets',()=>{
 let {document}=parseHTML('<title>Escola</title><h1>Boas-vindas</h1><section id="calendario"><h2>Nosso calendário</h2></section>');
 assert.deepEqual(pageContext(document,{pathname:'/',hash:'#calendario',search:'?token=private'}),{path:'/',section:'calendario',title:'Nosso calendário'});
 ({document}=parseHTML('<h1 id="title">Calendário</h1><nav id="nav"><button data-section="calendario" aria-current="page">Calendário</button></nav><div class="modal" aria-label="Novo evento"></div>'));
 assert.deepEqual(pageContext(document,{pathname:'/equipe',hash:''}),{path:'/equipe',section:'calendario',title:'Calendário · Novo evento'});
});


test('followups preserve source, require implementation evidence, and keep an immutable private history',async()=>{
 const env=setup(),input=draft({contributor:'Autoria fictícia',message:'<script>Pedido original</script>'});await send(env,'/public/feedback','POST',input);const path='/api/feedback/'+input.id;
 const original=await env.DB.prepare('SELECT message,contributor,created_at FROM site_feedback WHERE id=?').bind(input.id).first();
 for(const role of ['anonymous','teacher'])assert.equal((await send(env,path+'/history','GET',undefined,role)).status,role==='anonymous'?401:403);
 for(const patch of [{status:'Implementada',reply:'Parcial'},{status:'Implementada',evidence:'Teste'},{status:'Nova'},{status:'Nova',reply:42},{status:'Nova',reply:'x'.repeat(2501)},{status:'Nova',evidence:'x'.repeat(1501)}])assert.equal((await send(env,path,'PATCH',{version:1,...patch},'direction')).status,400);
 assert.equal((await send(env,path,'PATCH',{status:'Em análise',version:1,reply:'Análise inicial <img src=x>',evidence:''},'supervision')).status,200);
 assert.equal((await send(env,path,'PATCH',{status:'Planejada',version:2,reply:'Atendimento parcial; falta concluir o pedido.'},'guidance')).status,200);
 assert.equal((await send(env,path,'PATCH',{status:'Implementada',version:3,reply:'Pedido completo verificado com dados fictícios.',evidence:'https://example.invalid/deploy · teste fictício aprovado'},'direction')).status,200);
 const history=await send(env,path+'/history','GET',undefined,'direction');assert.equal(history.body.total,3);assert.deepEqual(history.body.items.map(item=>item.feedback_version),[4,3,2]);
 assert.equal(history.body.items[0].from_status,'Planejada');assert.equal(history.body.items[0].actor_name,'Direção fictícia');assert.equal(history.body.items[2].actor,'supervision@prof.pmf.sc.gov.br');
 assert.deepEqual(await env.DB.prepare('SELECT message,contributor,created_at FROM site_feedback WHERE id=?').bind(input.id).first(),original);
 assert.throws(()=>env.DB.exec("UPDATE site_feedback_history SET reply='changed'"),/feedback_history_immutable/);
 assert.throws(()=>env.DB.exec('DELETE FROM site_feedback_history'),/feedback_history_immutable/);
 assert.equal((await send(env,path,'DELETE',{},'direction')).status,405);
 assert.equal(JSON.stringify((await send(env,'/public/api')).body).includes('Análise inicial'),false);
 assert.equal((await send(env,path+'/history?offset=-1','GET',undefined,'direction')).status,400);assert.equal((await send(env,'/api/feedback/missing/history','GET',undefined,'direction')).status,404);
 env.DB.close();
});

test('history pagination, concurrency and audit failure do not lose or invent followups',async()=>{
 const env=setup(),input=draft();await send(env,'/public/feedback','POST',input);const path='/api/feedback/'+input.id;
 const concurrent=await Promise.all(['direction','guidance'].map(role=>send(env,path,'PATCH',{version:1,status:'Em análise',reply:'Resposta concorrente fictícia'},role)));assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
 for(let version=2;version<=33;version++)assert.equal((await send(env,path,'PATCH',{version,status:'Em análise',reply:'Atualização fictícia '+version},'direction')).status,200);
 const first=await send(env,path+'/history','GET',undefined,'direction'),next=await send(env,path+'/history?offset=30','GET',undefined,'direction');assert.equal(first.body.total,33);assert.equal(first.body.items.length,30);assert.equal(next.body.items.length,3);assert.equal(new Set([...first.body.items,...next.body.items].map(item=>item.id)).size,33);
 env.DB.exec("CREATE TRIGGER fail_followup_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT,'test_failure'); END");
 assert.equal((await send(env,path,'PATCH',{version:34,status:'Planejada',reply:'Deve ser desfeito'},'direction')).status,503);
 assert.equal((await send(env,path+'/history','GET',undefined,'direction')).body.total,33);assert.equal((await env.DB.prepare('SELECT version FROM site_feedback WHERE id=?').bind(input.id).first()).version,34);
 env.DB.close();
});

test('additive followup migration preserves existing authors, status and original dates without fabricated history',async()=>{
 const DB=sqlite();for(const sql of migrations.slice(0,-1))DB.exec('BEGIN;'+sql+'COMMIT;');
 DB.exec("INSERT INTO site_feedback(id,visitor_id,kind,message,contributor,page_path,page_title,status,version,created_at,updated_at) VALUES('legacy-fixture','fictitious','improvement','Pedido antigo fictício','Autoria preservada','/','Página fictícia','Planejada',7,'2026-01-01 12:00:00','2026-01-02 12:00:00')");
 const original=await DB.prepare('SELECT * FROM site_feedback').first();DB.exec('BEGIN;'+migrations.at(-1)+'COMMIT;');
 assert.deepEqual(await DB.prepare('SELECT * FROM site_feedback').first(),original);assert.equal((await DB.prepare('SELECT count(*) AS n FROM site_feedback_history').first()).n,0);DB.close();
});
