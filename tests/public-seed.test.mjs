import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {sqlite} from '../scripts/sqlite-adapter.mjs';
import {handle} from '../src/worker.mjs';

const migrationName='0018_verified_public_content.sql';
const seed=await readFile(new URL('../migrations/'+migrationName,import.meta.url),'utf8');
async function setup(){
 const DB=sqlite();
 for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')&&name<migrationName).sort())DB.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 return DB;
}
function statements(sql){
 const result=[];let current='';
 for(const line of sql.split(/\r?\n/)){if(!line.trim()||line.trim().startsWith('--'))continue;current+=line+'\n';if(line.trimEnd().endsWith(';')){result.push(current);current=''}}
 assert.equal(current.trim(),'');return result;
}
async function apply(DB){await DB.batch(statements(seed).map(sql=>DB.prepare(sql)))}
async function rows(DB,table){return (await DB.prepare('SELECT * FROM '+table+' ORDER BY 1').all()).results}
const syntheticUsers="INSERT INTO users VALUES('inactive@example.test','Inativo fictício','direction',0),('teacher@example.test','Professor fictício','teacher',1),('guidance@example.test','Orientação fictícia','guidance',1)";

test('verified seed uses an existing active manager and publishes only documented public data',async()=>{
 const DB=await setup();try{
  DB.exec(syntheticUsers);await apply(DB);
  const content=await rows(DB,'public_content'),events=await rows(DB,'events'),notices=await rows(DB,'notices');
  assert.equal(content.filter(row=>row.kind==='project').length,3);
  assert.equal(content.filter(row=>row.kind==='document').length,3);
  assert.equal(events.length,6);assert.equal(notices.length,1);
  for(const row of [...content,...events,...notices])assert.equal(row.creator,'guidance@example.test');
  for(const row of content){assert.equal(row.published,1);assert.equal(new URL(row.url).protocol,'https:');assert.equal(row.attachment_data,'');assert.equal(row.image_alt,'');assert.equal(row.featured,0)}
  assert.deepEqual(events.map(row=>row.date).sort(),['2026-11-02','2026-11-15','2026-11-20','2026-12-18','2026-12-19','2026-12-31']);
  for(const row of events){assert.equal(row.visibility,'public');assert.equal(row.formation,0);assert.equal(row.start,'');assert.equal(row.end,'');assert.match(row.details,/Fonte oficial: https:\/\/www\.pmf\.sc\.gov\.br\//)}
  assert.match(events.find(row=>row.date==='2026-12-31').details,/não informa a volta às aulas de 2027/);
  assert.deepEqual([notices[0].date,notices[0].expires_on,notices[0].highlight_from,notices[0].highlight_until,notices[0].featured],['2026-10-22','2026-12-31','2026-10-22','2026-10-31',1]);
  const profile=await DB.prepare('SELECT * FROM school_profile').first();
  assert.equal(profile.phone,'(48) 3238-2299');assert.equal(profile.email,'ebm.donicia@sme.pmf.sc.gov.br');assert.equal(profile.hours,'');assert.match(profile.introduction,/1º ao 9º ano/);
  assert.equal((await rows(DB,'users')).length,3);assert.equal((await rows(DB,'audit')).length,14);
  for(const endpoint of ['/public/content','/public/api']){
   const response=await handle(new Request('https://school.example'+endpoint),{DB},async()=>null);
   assert.equal(response.status,200);const data=await response.json();
   assert.equal(JSON.stringify(data).includes('@example.test'),false);
   assert.equal(JSON.stringify(data).includes('"creator"'),false);
   if(endpoint==='/public/content')assert.equal(data.items.length,6);
   else assert.equal(data.events.length,6);
  }
  assert.deepEqual((await DB.prepare('PRAGMA foreign_key_check').all()).results,[]);
 }finally{DB.close()}
});

test('verified seed preserves colliding administrator records, later edits and nonempty contact fields on replay',async()=>{
 const DB=await setup();try{
  DB.exec(syntheticUsers);
  DB.exec("INSERT INTO public_content(id,kind,title,creator,published) VALUES('public-casan-saneamento-2025','project','Rascunho preservado','guidance@example.test',0)");
  DB.exec("INSERT INTO events(id,title,date,type,creator,visibility) VALUES('public-rede-2026-finados','Evento interno preservado','2026-11-02','Reunião','guidance@example.test','internal')");
  DB.exec("UPDATE school_profile SET phone='Telefone institucional personalizado',hours='Horário informado pela equipe',introduction='Apresentação personalizada',whatsapp_secretaria='5548000000000'");
  await apply(DB);
  assert.equal((await DB.prepare("SELECT title FROM public_content WHERE id='public-casan-saneamento-2025'").first()).title,'Rascunho preservado');
  assert.equal((await DB.prepare("SELECT visibility FROM events WHERE id='public-rede-2026-finados'").first()).visibility,'internal');
  assert.equal((await DB.prepare("SELECT COUNT(*) AS n FROM audit WHERE target IN ('/api/public-content/public-casan-saneamento-2025','/api/events/public-rede-2026-finados')").first()).n,0);
  DB.exec("UPDATE public_content SET published=0,title='Conteúdo retirado pela gestão',version=version+1 WHERE id='public-mind-lab-acervo-2020'");
  DB.exec("UPDATE notices SET published=0,featured=0,body='Aviso editado pela gestão',version=version+1 WHERE id='public-matriculas-orientacoes-2026-10'");
  const tables=['public_content','events','notices','school_profile','audit','users'];
  const before=await Promise.all(tables.map(table=>rows(DB,table)));
  await apply(DB);
  assert.deepEqual(await Promise.all(tables.map(table=>rows(DB,table))),before);
  const profile=await DB.prepare('SELECT * FROM school_profile').first();
  assert.equal(profile.phone,'Telefone institucional personalizado');assert.equal(profile.hours,'Horário informado pela equipe');assert.equal(profile.introduction,'Apresentação personalizada');assert.equal(profile.whatsapp_secretaria,'5548000000000');
 }finally{DB.close()}
});

test('verified seed does not create identities or publish content without an active manager',async()=>{
 const DB=await setup();try{
  DB.exec("INSERT INTO users VALUES('inactive@example.test','Inativo fictício','direction',0),('teacher@example.test','Professor fictício','teacher',1)");
  const profile=await rows(DB,'school_profile'),users=await rows(DB,'users');
  await apply(DB);
  for(const table of ['public_content','events','notices','audit'])assert.equal((await rows(DB,table)).length,0);
  assert.deepEqual(await rows(DB,'school_profile'),profile);assert.deepEqual(await rows(DB,'users'),users);
 }finally{DB.close()}
});

test('a failed audit rolls back the complete seed batch',async()=>{
 const DB=await setup();try{
  DB.exec(syntheticUsers);
  DB.exec("CREATE TRIGGER reject_seed_audit BEFORE INSERT ON audit WHEN NEW.target='/api/events/public-rede-2026-finados' BEGIN SELECT RAISE(ABORT,'synthetic_audit_failure'); END");
  const profile=await rows(DB,'school_profile');
  await assert.rejects(()=>apply(DB),/synthetic_audit_failure/);
  for(const table of ['public_content','events','notices','audit'])assert.equal((await rows(DB,table)).length,0);
  assert.deepEqual(await rows(DB,'school_profile'),profile);
 }finally{DB.close()}
});
