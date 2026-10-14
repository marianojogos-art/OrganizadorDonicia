import test from 'node:test';import assert from 'node:assert/strict';import {readdir,readFile} from 'node:fs/promises';import {sqlite} from '../scripts/sqlite-adapter.mjs';import {handle} from '../src/worker.mjs';
async function fixture(){const DB=sqlite();for(const name of (await readdir(new URL('../migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort())DB.exec('BEGIN;'+await readFile(new URL('../migrations/'+name,import.meta.url),'utf8')+'COMMIT;');for(const [email,role] of [['director@prof.pmf.sc.gov.br','direction'],['verifier@prof.pmf.sc.gov.br','guidance'],['teacher@prof.pmf.sc.gov.br','teacher']])await DB.prepare('INSERT INTO users VALUES(?,?,?,1)').bind(email,'Pessoa fictícia',role).run();return {DB}}
const email=key=>key+'@prof.pmf.sc.gov.br';
async function send(env,path,method='GET',body,login='director',origin='https://school.example'){const r=await handle(new Request('https://school.example'+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(body)}),env,async()=>login?email(login):null);return {status:r.status,body:await r.json()}}
test('task verification is assigned, versioned and invalidated by edits or reopening',async()=>{
 const e=await fixture(),payload={title:'Tarefa fictícia',owner:email('director'),due:'2026-10-14',restricted:true,verifier:email('verifier')};
 const create=await send(e,'/api/tasks','POST',payload);assert.equal(create.status,201);const path='/api/tasks/'+create.body.id;
 assert.equal((await send(e,path+'/verify','POST',{version:1},'verifier')).status,409);
 assert.equal((await send(e,path,'PATCH',{status:'Concluída',version:1})).status,200);
 assert.equal((await send(e,path+'/verify','POST',{version:2})).status,403,'direction cannot impersonate verifier');
 assert.equal((await send(e,path+'/verify','POST',{version:2},'teacher')).status,403);
 assert.equal((await send(e,path+'/verify','POST',{version:2},'verifier','https://foreign.example')).status,403);
 assert.equal((await send(e,path+'/verify','POST',{version:2},'verifier')).status,200);
 let row=(await send(e,'/api/tasks')).body[0];assert.equal(row.verified_by,email('verifier'));assert.ok(row.verified_at);
 assert.equal((await send(e,path+'/verify','POST',{version:2},'verifier')).status,409);
 assert.equal((await send(e,path,'PATCH',{...payload,edit:true,version:3})).status,200);row=(await send(e,'/api/tasks')).body[0];assert.equal(row.verified_by,'');
 assert.equal((await send(e,'/api/tasks','POST',{...payload,verifier:email('teacher')})).status,400);
 assert.equal((await send(e,'/api/tasks','POST',{...payload,verifier:'missing@prof.pmf.sc.gov.br'})).status,400);
});
test('authorized secretary WhatsApp is seeded exactly, guidance stays blank and only pedagogical staff configure',async()=>{
 const e=await fixture(),profile=(await send(e,'/api/school')).body;assert.equal(profile.whatsapp_secretaria,'554888734629');assert.equal(profile.whatsapp_orientacao,'');
 const p={...profile,whatsapp_secretaria:'5511000000000',whatsapp_orientacao:''};
 assert.equal((await send(e,'/api/school','PATCH',p,'teacher')).status,403);
 assert.equal((await send(e,'/api/school','PATCH',{...p,whatsapp_secretaria:'javascript:alert(1)'})).status,400);
 assert.equal((await send(e,'/api/school','PATCH',p)).status,200);
 const response=await handle(new Request('https://school.example/public/api'),e,async()=>null);assert.equal(response.status,200);const data=await response.json();assert.equal(data.school.whatsapp_secretaria,p.whatsapp_secretaria);assert.equal(data.school.whatsapp_orientacao,'');assert.equal(data.school.phone,profile.phone);
});
