import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {sqlite} from '../scripts/sqlite-adapter.mjs';
import {handle} from '../src/worker.mjs';

const migrationFiles=(await readdir(new URL('../migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')).sort();
const migrations=await Promise.all(migrationFiles.map(name=>readFile(new URL('../migrations/'+name,import.meta.url),'utf8')));
const emails={direction:'director@prof.pmf.sc.gov.br',supervision:'supervisor@prof.pmf.sc.gov.br',guidance:'guidance@prof.pmf.sc.gov.br',teacher:'teacher@prof.pmf.sc.gov.br',other:'other@prof.pmf.sc.gov.br'};
function setup(){
 const DB=sqlite();for(const migration of migrations)DB.exec('BEGIN;'+migration+'COMMIT;');
 DB.exec("INSERT INTO users VALUES('director@prof.pmf.sc.gov.br','Direção fictícia','direction',1),('supervisor@prof.pmf.sc.gov.br','Supervisão fictícia','supervision',1),('guidance@prof.pmf.sc.gov.br','Orientação fictícia','guidance',1),('teacher@prof.pmf.sc.gov.br','Docente fictício','teacher',1),('other@prof.pmf.sc.gov.br','Outro docente','teacher',1)");
 return {DB,ASSETS:{fetch:async request=>new Response(new URL(request.url).pathname)}};
}
async function send(env,path,method='GET',data,role='direction'){
 const response=await handle(new Request('https://school.example'+path,{method,headers:{Origin:'https://school.example','Content-Type':'application/json'},body:['GET','HEAD'].includes(method)?undefined:JSON.stringify(data)}),env,async()=>emails[role]||null);
 const raw=await response.text();let body;try{body=JSON.parse(raw)}catch{body=raw}return {status:response.status,body,headers:response.headers};
}
const booking={space:'Biblioteca',date:'2026-10-19',start:'09:00',end:'10:00',purpose:'Leitura fictícia',responsible:'Pessoa fictícia'};
const event={title:'Evento fictício',date:'2026-10-19',type:'Evento escolar',visibility:'internal'};
const training={title:'Formação fictícia',area:'Linguagens',date:'2026-10-20',start:'14:00',end:'16:00',location:'Sala de formação',notes:'Material de leitura'};

test('migration preserves dependent rows and keeps legacy calendar private',async()=>{
 const DB=sqlite();for(const migration of migrations.slice(0,-1))DB.exec('BEGIN;'+migration+'COMMIT;');
 DB.exec("INSERT INTO users VALUES('legacy@prof.pmf.sc.gov.br','Pessoa fictícia','direction',1); INSERT INTO reservations(id,space,date,start,end,owner,purpose,responsible) VALUES('old','Biblioteca','2026-10-19','09:00','10:00','legacy@prof.pmf.sc.gov.br','Leitura','Pessoa fictícia'); INSERT INTO events(id,title,date,type,creator) VALUES('old-event','Reunião interna','2026-10-19','Reunião','legacy@prof.pmf.sc.gov.br'); INSERT INTO audit(id,actor,action,target) VALUES('audit-old','legacy@prof.pmf.sc.gov.br','POST','/api/reservations/old')");
 DB.exec('BEGIN;'+migrations.at(-1)+'COMMIT;');
 assert.equal((await DB.prepare('SELECT status FROM reservations').first()).status,'Aprovada');
 assert.equal((await DB.prepare('SELECT visibility FROM events').first()).visibility,'internal');
 assert.equal((await DB.prepare('SELECT actor FROM audit').first()).actor,'legacy@prof.pmf.sc.gov.br');
 assert.deepEqual((await DB.prepare('PRAGMA foreign_key_check').all()).results,[]);
 assert.equal((await DB.prepare('PRAGMA foreign_keys').first()).foreign_keys,1);
 assert.throws(()=>DB.exec("DELETE FROM users WHERE email='legacy@prof.pmf.sc.gov.br'"),/FOREIGN KEY/);
 DB.exec("INSERT INTO users VALUES('new@prof.pmf.sc.gov.br','Supervisão','supervision',1)");
 DB.close();
});

test('anonymous portal serves only public assets and explicitly published content',async()=>{
 const env=setup();
 await send(env,'/api/events','POST',event);
 await send(env,'/api/events','POST',{...event,title:'Festa pública',visibility:'public'});
 await send(env,'/api/notices','POST',{title:'Rascunho',body:'Conteúdo não publicado',date:'2026-10-19',published:false});
 await send(env,'/api/notices','POST',{title:'Aviso público',body:'Comunicado às famílias',date:'2026-10-19',published:true});
 const portal=await send(env,'/api/public','GET',undefined,'anonymous');assert.equal(portal.status,200);
 assert.deepEqual(Object.keys(portal.body).sort(),['events','notices','school']);assert.equal(portal.body.events.length,1);assert.equal(portal.body.notices.length,1);
 assert.deepEqual(Object.keys(portal.body.events[0]).sort(),['date','id','title','type']);assert.deepEqual(Object.keys(portal.body.notices[0]).sort(),['body','date','id','title']);
 assert.equal(JSON.stringify(portal.body).includes('@prof.pmf.sc.gov.br'),false);assert.equal(JSON.stringify(portal.body).includes('Rascunho'),false);
 for(const path of ['/','/public.html','/public.js'])assert.equal((await send(env,path,'GET',undefined,'anonymous')).status,200);
 assert.equal((await send({},'/api/public','GET',undefined,'anonymous')).status,503);
 const asset=await send({ASSETS:env.ASSETS},'/','GET',undefined,'anonymous');assert.equal(asset.body,'/public.html');assert.match(asset.headers.get('content-security-policy'),/script-src 'self'/);
 for(const path of ['/equipe','/equipe/','/equipe/app.js','/index.html','/app.js','/api/events','/api/trainings','/sge-connector.zip'])assert.equal((await send(env,path,'GET',undefined,'anonymous')).status,401,path);
 assert.equal((await send(env,'/equipe','GET',undefined,'teacher')).body,'/index.html');assert.equal((await send(env,'/equipe/app.js','GET',undefined,'teacher')).body,'/app.js');
 assert.equal((await send(env,'/sge-connector.zip','GET',undefined,'teacher')).status,403);
 for(const role of ['direction','supervision','guidance'])assert.equal((await send(env,'/sge-connector.zip','GET',undefined,role)).body,'/sge-connector.zip');
 assert.equal((await send(env,'/api/public','POST',{},'anonymous')).status,405);
 env.DB.close();
});

test('teacher API allowlist blocks internal reads and writes while all pedagogical roles retain access',async()=>{
 const env=setup();
 for(const path of ['tasks','minutes','users','teachers','substitutions','auxiliaries','settings','audit','school','notices','supervision/saved']){
  assert.equal((await send(env,'/api/'+path,'GET',undefined,'teacher')).status,403,path);
  assert.equal((await send(env,'/api/'+path,'POST',{},'teacher')).status,403,path);
 }
 for(const path of ['me','reservations','fixed-occupancy','xerox','events','trainings'])assert.equal((await send(env,'/api/'+path,'GET',undefined,'teacher')).status,200,path);
 for(const role of ['direction','supervision','guidance']){
  for(const path of ['tasks','minutes','users','audit','school','notices','supervision/saved'])assert.equal((await send(env,'/api/'+path,'GET',undefined,role)).status,200,role+' '+path);
  assert.equal((await send(env,'/api/events','POST',{...event,title:role},role)).status,201);
 }
 assert.equal((await send(env,'/api/events','POST',event,'teacher')).status,403);
 assert.equal((await send(env,'/api/trainings','POST',training,'teacher')).status,403);
 const calendar=(await send(env,'/api/events','GET',undefined,'teacher')).body;assert.equal(calendar.some(row=>Object.hasOwn(row,'creator')),false);
 const fixed={space:booking.space,weekday:1,start:booking.start,end:booking.end,from_date:'2026-10-19',to_date:'2026-12-31',purpose:'Aula regular'};
 assert.equal((await send(env,'/api/fixed-occupancy','POST',fixed)).status,201);
 const occupancy=(await send(env,'/api/fixed-occupancy','GET',undefined,'teacher')).body;assert.equal(occupancy.length,1);assert.equal(Object.hasOwn(occupancy[0],'creator'),false);
 env.DB.close();
});

test('reservation approval is atomic, concurrent requests may wait, and teacher only sees own requests',async()=>{
 const env=setup();
 const first=await send(env,'/api/reservations','POST',booking,'teacher'),second=await send(env,'/api/reservations','POST',booking,'other');
 assert.equal(first.status,201);assert.equal(second.status,201);assert.equal(first.body.status,'Pendente');
 assert.equal((await send(env,'/api/reservations','GET',undefined,'teacher')).body.length,1);
 assert.equal((await send(env,'/api/reservations/'+first.body.id,'PATCH',{version:1,status:'Aprovada'},'teacher')).status,403);
 const approvals=await Promise.all([first,second].map(created=>send(env,'/api/reservations/'+created.body.id,'PATCH',{version:1,status:'Aprovada'},'supervision')));
 assert.deepEqual(approvals.map(row=>row.status).sort(),[200,409]);
 const rows=(await send(env,'/api/reservations')).body;assert.equal(rows.filter(row=>row.status==='Aprovada').length,1);assert.equal(rows.filter(row=>row.status==='Pendente').length,1);
 const approved=rows.find(row=>row.status==='Aprovada'),ownerRole=approved.owner===emails.teacher?'teacher':'other',outsider=ownerRole==='teacher'?'other':'teacher';
 const publicToTeacher=(await send(env,'/api/reservations','GET',undefined,outsider)).body.find(row=>row.id===approved.id);assert.equal(publicToTeacher.owner,'');
 assert.equal((await send(env,'/api/reservations/'+approved.id,'PATCH',{...booking,edit:true,version:2},ownerRole)).status,409);
 assert.equal((await send(env,'/api/reservations/'+approved.id,'DELETE',{version:2},outsider)).status,403);
 assert.equal((await send(env,'/api/reservations/'+approved.id,'DELETE',{version:1},ownerRole)).status,409);
 assert.equal((await send(env,'/api/reservations/'+approved.id,'DELETE',{version:2},ownerRole)).status,200);
 assert.equal((await send(env,'/api/audit')).body.length,4,'two requests, one approval and cancellation only');
 env.DB.close();
});

test('refused reservation edits resubmit and fixed occupancy blocks approval in both directions',async()=>{
 const env=setup(),created=await send(env,'/api/reservations','POST',booking,'teacher'),path='/api/reservations/'+created.body.id;
 assert.equal((await send(env,path,'PATCH',{version:1,status:'Recusada'},'guidance')).status,200);
 assert.equal((await send(env,path,'PATCH',{...booking,edit:true,version:2},'teacher')).status,200);
 assert.equal((await send(env,'/api/reservations','GET',undefined,'teacher')).body[0].status,'Pendente');
 const fixed={space:booking.space,weekday:1,start:booking.start,end:booking.end,from_date:'2026-10-19',to_date:'2026-12-31',purpose:'Aula regular'};
 const fixedCreated=await send(env,'/api/fixed-occupancy','POST',fixed);assert.equal(fixedCreated.status,201,'pending requests do not block a fixed schedule');
 assert.equal((await send(env,path,'PATCH',{version:3,status:'Aprovada'})).status,409);
 assert.equal((await send(env,'/api/fixed-occupancy/'+fixedCreated.body.id,'DELETE',{version:1})).status,200);
 assert.equal((await send(env,path,'PATCH',{version:3,status:'Aprovada'})).status,200);
 assert.equal((await send(env,'/api/fixed-occupancy','POST',fixed)).status,409,'approved reservations block fixed schedule');
 assert.equal((await send(env,path,'PATCH',{...booking,date:'2026-10-20',edit:true,version:4},'direction')).status,200);
 env.DB.close();
});

test('school profile, notices and calendar enforce explicit publication and optimistic concurrency',async()=>{
 const env=setup(),school=(await send(env,'/api/school')).body;
 assert.equal((await send(env,'/api/school','PATCH',{...school,introduction:'Apresentação revisada'},'guidance')).status,200);
 assert.equal((await send(env,'/api/school','PATCH',school)).status,409);
 assert.equal((await send(env,'/api/public','GET',undefined,'anonymous')).body.school.introduction,'Apresentação revisada');
 assert.equal((await send(env,'/api/events','POST',{...event,visibility:undefined})).status,400);
 const created=await send(env,'/api/events','POST',event),path='/api/events/'+created.body.id;
 assert.equal((await send(env,path,'PATCH',{...event,edit:true,visibility:'public',version:1})).status,200);
 assert.equal((await send(env,'/api/public','GET',undefined,'anonymous')).body.events.length,1);
 assert.equal((await send(env,path,'PATCH',{...event,edit:true,visibility:'public',version:1})).status,409);
 assert.equal((await send(env,path,'PATCH',{...event,edit:true,visibility:'internal',version:2})).status,200);
 assert.equal((await send(env,'/api/public','GET',undefined,'anonymous')).body.events.length,0);
 const notice={title:'Comunicado',body:'Detalhes',date:'2026-10-20',published:false},n=await send(env,'/api/notices','POST',notice);
 assert.equal((await send(env,'/api/notices/'+n.body.id,'PATCH',{...notice,published:true,version:1})).status,200);
 assert.equal((await send(env,'/api/notices')).body[0].published,true);
 assert.equal((await send(env,'/api/notices/'+n.body.id,'DELETE',{version:1})).status,409);
 assert.equal((await send(env,'/api/notices/'+n.body.id,'DELETE',{version:2})).status,200);
 env.DB.close();
});

test('training calendar supports area, optional paired times, permissions and versioned CRUD',async()=>{
 const env=setup();
 for(const invalid of [{...training,area:''},{...training,date:'2026-02-30'},{...training,end:'13:00'},{...training,start:'25:00'},{...training,start:''},{...training,start:false,end:false}])assert.equal((await send(env,'/api/trainings','POST',invalid)).status,400);
 const created=await send(env,'/api/trainings','POST',training,'supervision');assert.equal(created.status,201);
 const noTime=await send(env,'/api/trainings','POST',{...training,title:'Data reservada',start:null,end:null});assert.equal(noTime.status,201);
 const rows=(await send(env,'/api/trainings','GET',undefined,'teacher')).body;assert.equal(rows.length,2);assert.equal(rows.some(row=>row.start===''&&row.end===''),true);assert.equal(JSON.stringify(rows).includes('@prof.pmf.sc.gov.br'),false);
 const path='/api/trainings/'+created.body.id;
 assert.equal((await send(env,path,'PATCH',{...training,title:'Formação revisada',version:1},'teacher')).status,403);
 assert.equal((await send(env,path,'PATCH',{...training,title:'Formação revisada',version:1},'guidance')).status,200);
 assert.equal((await send(env,path,'PATCH',{...training,version:1})).status,409);
 assert.equal((await send(env,path,'DELETE',{version:2})).status,200);
 env.DB.close();
});

test('failed audit rolls back publication and reservation approval',async()=>{
 const env=setup(),created=await send(env,'/api/reservations','POST',booking,'teacher');
 env.DB.exec('DROP TABLE audit');
 assert.equal((await send(env,'/api/reservations/'+created.body.id,'PATCH',{status:'Aprovada',version:1})).status,503);
 assert.equal((await send(env,'/api/reservations')).body[0].status,'Pendente');
 assert.equal((await send(env,'/api/notices','POST',{title:'Aviso',body:'Texto',date:'2026-10-20',published:true})).status,503);
 assert.equal((await send(env,'/api/public','GET',undefined,'anonymous')).body.notices.length,0);
 env.DB.close();
});
