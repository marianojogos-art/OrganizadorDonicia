import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {sqlite} from '../scripts/sqlite-adapter.mjs';
import {handle} from '../src/worker.mjs';
const migrations=await Promise.all((await readdir(new URL('../migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')).sort().map(name=>readFile(new URL('../migrations/'+name,import.meta.url),'utf8')));
const users={secretary:'secretary.demo@prof.pmf.sc.gov.br',direction:'director@prof.pmf.sc.gov.br',supervision:'supervisor@prof.pmf.sc.gov.br',guidance:'guide@prof.pmf.sc.gov.br',teacher:'teacher@prof.pmf.sc.gov.br',other:'other@prof.pmf.sc.gov.br',inactive:'inactive@prof.pmf.sc.gov.br'};
function setup(){const DB=sqlite();for(const sql of migrations)DB.exec(sql);for(const [role,email] of Object.entries(users))DB.exec(`INSERT INTO users VALUES('${email}','Pessoa fictícia','${['other','inactive'].includes(role)?'teacher':role}',${['inactive','secretary'].includes(role)?0:1})`);return {DB,ASSETS:{fetch:async()=>new Response('asset')}}}
async function request(env,path,data,role='anonymous',options={}){const response=await handle(new Request('https://school.test'+path,{method:options.method||'POST',headers:{Origin:'https://school.test','Content-Type':'application/json',...options.headers},body:options.method==='GET'?undefined:JSON.stringify(data)}),env,async()=>users[role]||null);return {status:response.status,headers:response.headers,body:await response.json()}}
const ask=(env,question,role='anonymous',extra={})=>request(env,role==='anonymous'?'/public/assistant':'/api/assistant',{question,...extra},role);
test('calendar excerpts use Portuguese labels and Brazilian dates without changing event dates or times',async()=>{
 const env=setup();
 const event={title:'Encontro fictício',date:'2026-03-01',start:'08:30',end:'09:45',type:'Evento escolar',location:'Pátio fictício',details:'Orientação fictícia',visibility:'public'};
 assert.equal((await request(env,'/api/events',event,'direction')).status,201);
 const published=await ask(env,'calendário');const publicEvent=published.body.sources.find(item=>item.url==='/#calendario');
 assert.ok(publicEvent);assert.equal(publicEvent.excerpt,'Data: 01/03/2026\nInício: 08:30\nTérmino: 09:45\nLocal: Pátio fictício\nTipo: Evento escolar');assert.equal(publicEvent.date,'2026-03-01','metadata retains the original date');
 const internal=await ask(env,'calendário','teacher');const excerpt=internal.body.sources[0].excerpt;
 for(const expected of ['Título: Encontro fictício','Data: 01/03/2026','Início: 08:30','Término: 09:45','Local: Pátio fictício','Informações: Orientação fictícia'])assert.ok(excerpt.includes(expected),expected);
 assert.doesNotMatch(excerpt,/^(title|date|start|end|location|details):/m);
 const original=await env.DB.prepare("SELECT date,start,end,type,location,details FROM events WHERE title='Encontro fictício'").first();assert.equal(original.date,event.date);assert.equal(original.start,event.start);assert.equal(original.end,event.end);assert.equal(original.type,event.type);env.DB.close();
});
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
test('family intake stays disabled regardless of active profiles, grants and environment flags',async()=>{
 const env=setup(),path='/public/secretariat-requests',data={id:crypto.randomUUID(),kind:'documents',name:'Responsável fictício',contact:'familia@example.test',consent:true};
 env.DB.exec("UPDATE users SET active=1 WHERE role='secretary'; INSERT INTO secretariat_access(email,granted_by) VALUES('secretary.demo@prof.pmf.sc.gov.br','director@prof.pmf.sc.gov.br')");
 for(const flag of [undefined,'true','false']){env.SECRETARIAT_INTAKE_ENABLED=flag;assert.deepEqual((await request(env,path,undefined,'anonymous',{method:'GET'})).body,{enabled:false});assert.equal((await request(env,path,data)).status,503)}
 assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM secretariat_requests').first()).n,0);env.DB.close();
});
test('request forwarding and attendance require evidence, ordered states and versioned audit',async()=>{
 const env=setup();env.SECRETARIAT_INTAKE_ENABLED='true';env.DB.exec("UPDATE users SET active=1 WHERE role='secretary'");env.DB.exec("INSERT INTO secretariat_access(email,granted_by) VALUES('secretary.demo@prof.pmf.sc.gov.br','director@prof.pmf.sc.gov.br')");const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO secretariat_requests(id,kind,name,contact) VALUES(?,'vacancy','Fictício','familia@example.test')").bind(id).run();const path='/api/secretariat-requests/'+id;
 assert.equal((await request(env,path,{version:1,status:'Atendido',evidence:'Confirmação fictícia'},'secretary',{method:'PATCH'})).status,409);
 assert.equal((await request(env,path,{version:1,status:'Encaminhado',evidence:''},'secretary',{method:'PATCH'})).status,400);
 const update={version:1,status:'Encaminhado',evidence:'Encaminhado manualmente à secretaria por canal confirmado (fictício)'};
 assert.equal((await request(env,path,update,'teacher',{method:'PATCH'})).status,403);
 assert.equal((await request(env,path,update,'secretary',{method:'PATCH'})).status,200);
 assert.equal((await request(env,path,update,'secretary',{method:'PATCH'})).status,409);
 assert.equal((await request(env,path,{version:2,status:'Atendido',evidence:'Retorno confirmado (fictício)'},'secretary',{method:'PATCH'})).status,200);
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

test('Secretariat has an isolated inbox and cannot use pedagogical or teacher APIs',async()=>{
 const env=setup();env.DB.exec("UPDATE users SET active=1 WHERE role='secretary'");
 assert.equal((await request(env,'/public/secretariat-requests',undefined,'anonymous',{method:'GET'})).body.enabled,false);
 assert.equal((await request(env,'/api/secretariat-requests',undefined,'secretary',{method:'GET'})).status,403,'role alone grants nothing');env.DB.exec("INSERT INTO secretariat_access(email,granted_by) VALUES('secretary.demo@prof.pmf.sc.gov.br','director@prof.pmf.sc.gov.br')");
 assert.equal((await request(env,'/api/secretariat-requests',undefined,'secretary',{method:'GET'})).status,200);
 assert.equal((await request(env,'/api/me',undefined,'secretary',{method:'GET'})).body.role,'secretary');
 for(const role of ['direction','supervision','guidance','teacher','other','inactive'])assert.equal((await request(env,'/api/secretariat-requests',undefined,role,{method:'GET'})).status,403);
 for(const path of ['/api/notes','/api/users','/api/tasks','/api/events','/api/xerox','/api/staff-requests','/api/audit','/api/supervision/saved','/api/assistant','/api/assistant/execute'])for(const method of ['GET','POST','PATCH','DELETE'])assert.equal((await request(env,path,{},'secretary',{method})).status,403,path+' '+method);
 env.ASSETS.fetch=async request=>new Response(new URL(request.url).pathname);
 const page=await handle(new Request('https://school.test/equipe'),env,async()=>users.secretary);assert.equal(page.status,200);assert.equal(await page.text(),'/secretariat.html');
 env.DB.exec("UPDATE users SET active=0 WHERE role='secretary'");assert.equal((await request(env,'/public/secretariat-requests',undefined,'anonymous',{method:'GET'})).body.enabled,false);assert.equal((await request(env,'/api/secretariat-requests',undefined,'secretary',{method:'GET'})).status,403);
 env.DB.close();
});

test('Secretariat role migration preserves existing identities and dependent rows without assigning access',async()=>{
 const DB=sqlite(),roleMigration=migrations.findIndex(sql=>sql.includes('CREATE TABLE users_secretariat'));for(const sql of migrations.slice(0,roleMigration))DB.exec('BEGIN;'+sql+'COMMIT;');
 DB.exec("INSERT INTO users VALUES('legacy@prof.pmf.sc.gov.br','Pessoa fictícia','direction',1); INSERT INTO personal_notes(id,owner,title,content) VALUES('legacy-note','legacy@prof.pmf.sc.gov.br','Nota privada','Conteúdo fictício'); INSERT INTO tasks(id,title,owner,due,creator) VALUES('legacy-task','Tarefa','legacy@prof.pmf.sc.gov.br','2026-11-01','legacy@prof.pmf.sc.gov.br'); INSERT INTO assistant_operations(owner,operation_id,request_hash,record_id,action) VALUES('legacy@prof.pmf.sc.gov.br','old-op','old-hash','old-id','xerox')");
 DB.exec('BEGIN;'+migrations[roleMigration]+'COMMIT;');
 assert.deepEqual((await DB.prepare('SELECT role FROM users').all()).results.map(x=>x.role),['direction']);assert.equal((await DB.prepare('SELECT count(*) AS n FROM personal_notes').first()).n,1);assert.equal((await DB.prepare('SELECT count(*) AS n FROM tasks').first()).n,1);assert.equal((await DB.prepare('SELECT count(*) AS n FROM assistant_operations').first()).n,1);assert.deepEqual((await DB.prepare('PRAGMA foreign_key_check').all()).results,[]);
 assert.throws(()=>DB.exec("DELETE FROM users WHERE email='legacy@prof.pmf.sc.gov.br'"),/FOREIGN KEY/);DB.close();
});

function grantSetup(){const env=setup();env.DB.exec("UPDATE users SET active=0; UPDATE users SET role='direction',active=1 WHERE email IN ('director@prof.pmf.sc.gov.br','supervisor@prof.pmf.sc.gov.br','guide@prof.pmf.sc.gov.br')");return env}
const approvedFixture={emails:[users.direction,users.supervision,users.guidance],confirmed:true};
test('one-time named grant is atomic, preserves direction, excludes future/inactive accounts and never enables intake',async()=>{
 const env=grantSetup(),path='/api/secretariat-access';
 assert.deepEqual((await request(env,path,undefined,'direction',{method:'GET'})).body,{initialized:false,members:[],publicIntakeEnabled:false});
 assert.equal((await request(env,'/api/secretariat-requests',undefined,'direction',{method:'GET'})).status,403);
 const responses=await Promise.all([request(env,path,approvedFixture,'direction'),request(env,path,approvedFixture,'direction')]);assert.deepEqual(responses.map(x=>x.status).sort(),[200,201]);
 assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM audit').first()).n,1);
 for(const role of ['direction','supervision','guidance']){
  assert.equal((await request(env,'/api/secretariat-access/me',undefined,role,{method:'GET'})).body.allowed,true);
  assert.equal((await request(env,'/api/me',undefined,role,{method:'GET'})).body.role,'direction');
  assert.equal((await request(env,'/api/tasks',undefined,role,{method:'GET'})).status,200);
  assert.equal((await request(env,'/api/secretariat-requests',undefined,role,{method:'GET'})).status,200);
 }
 env.DB.exec("UPDATE users SET active=0 WHERE email='guide@prof.pmf.sc.gov.br'; UPDATE users SET active=1,role='direction' WHERE email='other@prof.pmf.sc.gov.br'");
 assert.equal((await request(env,'/api/secretariat-requests',undefined,'guidance',{method:'GET'})).status,403);
 assert.equal((await request(env,'/api/secretariat-access/me',undefined,'other',{method:'GET'})).body.allowed,false);
 assert.equal((await request(env,'/api/secretariat-requests',undefined,'other',{method:'GET'})).status,403);
 assert.equal((await request(env,path,{...approvedFixture,emails:[users.direction,users.supervision,users.other]},'direction')).status,409);
 assert.equal((await request(env,path,approvedFixture,'direction')).body.applied,false);
 assert.deepEqual((await request(env,'/public/secretariat-requests',undefined,'anonymous',{method:'GET'})).body,{enabled:false});env.DB.close();
});
test('grant rejects directory changes, role-wide access, unconfirmed input and rolls back on audit failure',async()=>{
 const env=grantSetup(),path='/api/secretariat-access';
 assert.equal((await request(env,path,{...approvedFixture,confirmed:false},'direction')).status,400);
 assert.equal((await request(env,path,{...approvedFixture,role:'direction'},'direction')).status,400);
 assert.equal((await request(env,path,approvedFixture,'direction',{headers:{Origin:'https://evil.test'}})).status,403);
 env.DB.exec("UPDATE users SET active=1 WHERE email='other@prof.pmf.sc.gov.br'");
 assert.equal((await request(env,path,approvedFixture,'direction')).status,409,'an additional active account requires a fresh review');
 env.DB.exec("UPDATE users SET active=0 WHERE email='other@prof.pmf.sc.gov.br'; UPDATE users SET role='teacher' WHERE email='guide@prof.pmf.sc.gov.br'");
 assert.equal((await request(env,path,approvedFixture,'direction')).status,409);assert.equal((await request(env,path,approvedFixture,'guidance')).status,403);
 env.DB.exec("UPDATE users SET role='direction' WHERE email='guide@prof.pmf.sc.gov.br'; DROP TABLE audit");
 assert.equal((await request(env,path,approvedFixture,'direction')).status,503);
 assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM secretariat_access').first()).n,0);assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM secretariat_access_initialization').first()).n,0);env.DB.close();
});
