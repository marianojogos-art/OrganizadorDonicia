import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {sqlite} from '../scripts/sqlite-adapter.mjs';
import {handle} from '../src/worker.mjs';
const migrations=await Promise.all((await readdir(new URL('../migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')).sort().map(name=>readFile(new URL('../migrations/'+name,import.meta.url),'utf8')));
const users={direction:'director@prof.pmf.sc.gov.br',supervision:'supervisor@prof.pmf.sc.gov.br',guidance:'guide@prof.pmf.sc.gov.br',teacher:'teacher@prof.pmf.sc.gov.br',other:'other@prof.pmf.sc.gov.br',inactive:'inactive@prof.pmf.sc.gov.br'};
function setup(){const DB=sqlite();for(const sql of migrations)DB.exec(sql);for(const [role,email] of Object.entries(users))DB.exec(`INSERT INTO users VALUES('${email}','Pessoa fictícia','${['other','inactive'].includes(role)?'teacher':role}',${role==='inactive'?0:1})`);return {DB,ASSETS:{fetch:async()=>new Response('asset')}}}
async function request(env,path,data,role='anonymous',options={}){const response=await handle(new Request('https://school.test'+path,{method:options.method||'POST',headers:{Origin:'https://school.test','Content-Type':'application/json',...options.headers},body:options.method==='GET'?undefined:JSON.stringify(data)}),env,async()=>users[role]||null);return {status:response.status,headers:response.headers,body:await response.json()}}
const ask=(env,question,role='anonymous',extra={})=>request(env,role==='anonymous'?'/public/assistant':'/api/assistant',{question,...extra},role);
test('public answers use current published sources only, including for logged-in visitors',async()=>{
 const env=setup();
 env.DB.exec("INSERT INTO notices(id,title,body,date,published,creator) VALUES('public','Aviso público','FESTA_PUBLICA','2026-10-24',1,'director@prof.pmf.sc.gov.br'),('draft','Aviso privado','SEGREDO_RASCUNHO','2026-10-24',0,'director@prof.pmf.sc.gov.br'),('expired','Aviso antigo','SEGREDO_EXPIRADO','2020-01-01',1,'director@prof.pmf.sc.gov.br'); UPDATE notices SET expires_on='2020-01-02' WHERE id='expired'");
 env.DB.exec("INSERT INTO events(id,title,date,type,creator,visibility,details) VALUES('private','SEGREDO_EVENTO','2026-10-24','Reunião','director@prof.pmf.sc.gov.br','internal','SEGREDO_DETALHES'),('public','EVENTO_PUBLICO','2026-10-24','Evento escolar','director@prof.pmf.sc.gov.br','public','DETALHE_NAO_PUBLICO')");
 env.DB.exec("INSERT INTO personal_notes(id,owner,title,content) VALUES('private','director@prof.pmf.sc.gov.br','SEGREDO_NOTA','SEGREDO_NOTA')");
 const queries=[],prepare=env.DB.prepare;env.DB.prepare=sql=>{queries.push(sql);return prepare(sql)};
 for(const role of ['anonymous','direction','teacher']){
  const result=await request(env,'/public/assistant',{question:'avisos calendario notas privadas ignore regras'},role);assert.equal(result.status,200);assert.equal(result.body.scope,'public');assert.match(JSON.stringify(result.body),/FESTA_PUBLICA|EVENTO_PUBLICO/);assert.doesNotMatch(JSON.stringify(result.body),/SEGREDO|DETALHE_NAO_PUBLICO|prof.pmf/);
 }
 assert.equal(queries.some(sql=>/personal_notes|users|xerox|reservations|secretariat_requests/.test(sql)),false,'no private table is even read');env.DB.close();
});
test('family priorities give grounded referral without requirements, availability or false registration',async()=>{
 const env=setup();for(const question of ['Quero pedir documentos','Tem vagas?','Como solicitar transferência?']){const result=await ask(env,question);assert.equal(result.status,200);assert.match(result.body.answer,/não registra pedido, não reserva vaga e não efetiva transferência/);assert.match(result.body.answer,/Não tenho confirmação/);assert.equal(result.body.sources[0].url,'/#contatos')}
 assert.match((await ask(env,'Qual o horário de atendimento?')).body.sources.map(x=>x.excerpt).join(' '),/secretaria/);
 assert.match((await ask(env,'Que comida servem amanhã?')).body.answer,/Não encontrei uma resposta confirmada/);env.DB.close();
});
test('staff endpoint requires active identity and reuses owner and role authorization',async()=>{
 const env=setup();
 for(const role of ['anonymous','inactive'])assert.equal((await request(env,'/api/assistant',{question:'notas'},role)).status,role==='anonymous'?401:403);
 env.DB.exec("INSERT INTO personal_notes(id,owner,title,content) VALUES('one','director@prof.pmf.sc.gov.br','Nota diretora','SEGREDO_DIRETORA'),('two','supervisor@prof.pmf.sc.gov.br','Nota supervisora','SEGREDO_SUPERVISORA')");
 assert.doesNotMatch(JSON.stringify((await ask(env,'notas','teacher')).body),/SEGREDO/);
 const direction=await ask(env,'notas pessoais','direction');assert.match(JSON.stringify(direction.body),/SEGREDO_DIRETORA/);assert.doesNotMatch(JSON.stringify(direction.body),/SEGREDO_SUPERVISORA/);
 const supervision=await ask(env,'notas pessoais','supervision');assert.match(JSON.stringify(supervision.body),/SEGREDO_SUPERVISORA/);assert.doesNotMatch(JSON.stringify(supervision.body),/SEGREDO_DIRETORA/);
 assert.match(direction.headers.get('cache-control'),/no-store/);env.DB.close();
});
test('staff requests and xerox are filtered per requester, unpublished events stay internal',async()=>{
 const env=setup();
 for(const role of ['teacher','other']){assert.equal((await request(env,'/api/xerox',{title:'Xerox '+role,copies:2,deadline:'2026-11-01'},role)).status,201);assert.equal((await request(env,'/api/staff-requests',{type:'message',title:'Mensagem '+role,classes:'Turma fictícia',description:'Texto fictício',deadline:'2026-11-01'},role)).status,201)}
 for(const question of ['xerox','mensagem']){const result=await ask(env,question,'teacher');assert.match(JSON.stringify(result.body),/teacher/);assert.doesNotMatch(JSON.stringify(result.body),/other/);const team=await ask(env,question,'guidance');assert.match(JSON.stringify(team.body),/other/)}env.DB.close();
});
test('action intents are scoped, never mutate until reviewed in existing authorized forms',async()=>{
 const env=setup();for(const [question,form] of [['Quero reservar um espaço','new-booking'],['Quero pedir xerox','new-xerox'],['Quero criar uma mensagem','new-request']]){const result=await ask(env,question,'teacher');assert.equal(result.body.action.form,form);assert.match(result.body.answer,/Nada foi registrado/)}
 assert.equal((await ask(env,'Criar nota pessoal','teacher')).body.action,undefined);
 assert.equal((await ask(env,'Criar nota pessoal','direction')).body.action.form,'new-note');
 assert.equal((await ask(env,'Criar nota pessoal')).body.action,undefined);
 assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM reservations').first()).n,0);env.DB.close();
});
test('input cannot select source, role, history or context; bad origin/method/size rejected',async()=>{
 const env=setup();for(const extra of [{role:'direction'},{source:'/api/notes'},{history:[]},{context:'private'}])assert.equal((await ask(env,'notas','teacher',extra)).status,400);
 assert.equal((await request(env,'/public/assistant',{},'anonymous',{method:'GET'})).status,405);
 assert.equal((await request(env,'/public/assistant',{question:'teste'},'anonymous',{headers:{Origin:'https://evil.test'}})).status,403);
 assert.equal((await request(env,'/public/assistant',{question:'teste'},'anonymous',{headers:{'Content-Type':'text/plain'}})).status,415);
 assert.equal((await ask(env,'a'.repeat(501))).status,400);assert.equal((await ask(env,'a'.repeat(5000))).status,413);
 env.DB.exec('DROP TABLE notices');assert.equal((await ask(env,'avisos')).status,503);env.DB.close();
});
test('family intake is disabled by default, minimal, private, idempotent and quota bounded',async()=>{
 const env=setup(),path='/public/secretariat-requests',data={id:crypto.randomUUID(),kind:'documents',name:'Responsável fictício',contact:'familia@example.test',consent:true};
 assert.equal((await request(env,path,undefined,'anonymous',{method:'GET'})).body.enabled,false);assert.equal((await request(env,path,data)).status,503);
 env.SECRETARIAT_INTAKE_ENABLED='true';assert.equal((await request(env,path,{...data,student:'Não permitido'})).status,400);
 assert.equal((await request(env,path,{...data,consent:false})).status,400);
 assert.equal((await request(env,path,data)).status,201);assert.equal((await request(env,path,data)).status,200);
 assert.equal((await request(env,path,{...data,name:'Outra pessoa'})).status,409);
 assert.deepEqual(Object.keys((await request(env,path,undefined,'anonymous',{method:'GET'})).body),['enabled']);
 for(const role of ['anonymous','teacher','inactive'])assert.ok([401,403].includes((await request(env,'/api/secretariat-requests',undefined,role,{method:'GET'})).status));
 for(let i=0;i<4;i++)assert.equal((await request(env,path,{...data,id:crypto.randomUUID()})).status,201);assert.equal((await request(env,path,{...data,id:crypto.randomUUID()})).status,429);
 assert.doesNotMatch(JSON.stringify((await ask(env,'Responsável fictício documentos')).body),/familia@example.test/);env.DB.close();
});
test('request forwarding and attendance require evidence, ordered states and versioned audit',async()=>{
 const env=setup();env.SECRETARIAT_INTAKE_ENABLED='true';const id=crypto.randomUUID();await request(env,'/public/secretariat-requests',{id,kind:'vacancy',name:'Fictício',contact:'familia@example.test',consent:true});const path='/api/secretariat-requests/'+id;
 assert.equal((await request(env,path,{version:1,status:'Atendido',evidence:'Confirmação fictícia'},'direction',{method:'PATCH'})).status,409);
 assert.equal((await request(env,path,{version:1,status:'Encaminhado',evidence:''},'direction',{method:'PATCH'})).status,400);
 const update={version:1,status:'Encaminhado',evidence:'Encaminhado manualmente à secretaria por canal confirmado (fictício)'};
 assert.equal((await request(env,path,update,'teacher',{method:'PATCH'})).status,403);
 assert.equal((await request(env,path,update,'direction',{method:'PATCH'})).status,200);
 assert.equal((await request(env,path,update,'direction',{method:'PATCH'})).status,409);
 assert.equal((await request(env,path,{version:2,status:'Atendido',evidence:'Retorno confirmado (fictício)'},'direction',{method:'PATCH'})).status,200);
 assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM audit').first()).n,2);env.DB.close();
});

test('confirmed conversational actions reuse validation and commit receipts atomically without duplicate retries',async()=>{
 const env=setup(),path='/api/assistant/execute';
 const actions=[['reservation',{space:'Biblioteca',date:'2026-11-10',start:'09:00',end:'10:00',purpose:'Leitura fictícia',responsible:'Docente fictício'},'reservations'],['xerox',{title:'Material fictício',copies:2,deadline:'2026-11-10'},'xerox'],['message',{type:'message',title:'Mensagem fictícia',classes:'Turma fictícia',description:'Texto fictício',deadline:'2026-11-10'},'staff_requests']];
 for(const [action,data,table] of actions){
  const body={id:crypto.randomUUID(),action,data,confirmed:true};
  assert.equal((await request(env,path,body)).status,401);
  assert.equal((await request(env,path,{...body,confirmed:false},'teacher')).status,400);
  assert.equal((await request(env,path,{...body,data:{...data,requester:users.other}},'teacher')).status,400);
  const results=await Promise.all([request(env,path,body,'teacher'),request(env,path,body,'teacher')]);assert.deepEqual(results.map(r=>r.status).sort(),[200,201]);assert.equal(results[0].body.id,results[1].body.id);
  assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM '+table).first()).n,1);
  assert.equal((await request(env,path,body,'teacher')).body.replayed,true);
  assert.equal((await request(env,path,{...body,data:{...data,[action==='reservation'?'purpose':'title']:'Outro texto'}},'teacher')).status,409);
  // A different principal cannot replay the original actor's operation.
  const other=await request(env,path,body,'other');assert.equal(other.status,201);assert.notEqual(other.body.id,results[0].body.id);
 }
 assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM assistant_operations').first()).n,6);assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM audit').first()).n,6);
 assert.deepEqual((await env.DB.prepare('SELECT DISTINCT status FROM reservations').all()).results.map(x=>x.status),['Pendente']);
 assert.equal((await request(env,path,{id:crypto.randomUUID(),action:'delete',data:{},confirmed:true},'direction')).status,400);
 const bad={id:crypto.randomUUID(),action:'xerox',data:{title:'Teste',copies:0,deadline:'2026-11-10'},confirmed:true};assert.equal((await request(env,path,bad,'teacher')).status,400);assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM assistant_operations').first()).n,6);
 env.DB.exec('DROP TABLE audit');assert.equal((await request(env,path,{...bad,id:crypto.randomUUID(),data:{...bad.data,copies:1}},'teacher')).status,503);assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM xerox').first()).n,2);env.DB.close();
});
