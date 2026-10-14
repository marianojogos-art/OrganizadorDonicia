import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {build} from 'esbuild';import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

function statements(sql){const result=[];let current='';for(const line of sql.split(/\r?\n/)){if(!line.trim()||line.trim().startsWith('--'))continue;current+=line+'\n';if(line.trimEnd().endsWith(';')){result.push(current);current=''}}assert.equal(current.trim(),'');return result}

test('Workers and D1 enforce private notes and bounded xerox files using production route code',async()=>{
 // Test-only identity injection; no bypass is exported to the application.
 const bundle=await build({stdin:{contents:"import {handle} from './src/worker.mjs';export default {fetch(r,e){return handle(r,e,async()=>r.headers.get('X-Test-Login'))}}",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-10-03',cf:false,script:bundle.outputFiles[0].text,d1Databases:{DB:'synthetic-new-modules'}}));
 try{
  const DB=await mf.getD1Database('DB');for(const name of ['0001_initial.sql','0004_reservation_responsible.sql','0006_reservation_context.sql','0007_xerox_attachments.sql','0008_formation_calendar.sql','0009_personal_notes.sql','0010_public_portal.sql','0012_staff_services.sql','0013_task_review_contacts.sql']){const sql=await readFile(new URL('../migrations/'+name,import.meta.url),'utf8');await DB.batch(statements(sql).map(statement=>DB.prepare(statement)))}
  const one='one@prof.pmf.sc.gov.br',two='two@prof.pmf.sc.gov.br',direction='direction@prof.pmf.sc.gov.br',staffOne='supervision@prof.pmf.sc.gov.br',staffTwo='guidance@prof.pmf.sc.gov.br';for(const [email,role] of [[one,'teacher'],[two,'teacher'],[direction,'direction'],[staffOne,'supervision'],[staffTwo,'guidance']])await DB.prepare('INSERT INTO users VALUES(?,?,?,1)').bind(email,'Pessoa fictícia',role).run();
  const call=(login,path,method='GET',data)=>mf.dispatchFetch('https://school.example/api/'+path,{method,headers:{Origin:'https://school.example','Content-Type':'application/json','X-Test-Login':login},body:method==='GET'?undefined:JSON.stringify(data)});
  const requested=await call(one,'staff-requests','POST',{type:'message',title:'Mensagem fictícia',classes:'Turma fictícia',description:'Somente pedido interno',deadline:'2026-10-20'});assert.equal(requested.status,201);const reqId=(await requested.json()).id;
  assert.deepEqual(await (await call(two,'staff-requests')).json(),[]);assert.equal((await call(two,'staff-requests/'+reqId)).status,404);assert.equal((await call(one,'pedagogical-album')).status,403);assert.equal((await call(one,'resource-library')).status,403);
  assert.equal((await call(staffOne,'staff-requests/'+reqId,'PATCH',{version:1,status:'Aprovada'})).status,200);
  const picture=await call(staffOne,'pedagogical-album','POST',{title:'Imagem sintética',description:'Sem pessoas',date:'2026-10-20',authorization_confirmed:true,attachment:{name:'sintetica.png',type:'image/png',base64:btoa(String.fromCharCode(137,80,78,71,13,10,26,10,0))}});assert.equal(picture.status,201);const pictureId=(await picture.json()).id;
  assert.equal((await call(one,'pedagogical-album/'+pictureId+'/attachment')).status,403);assert.equal((await call(direction,'pedagogical-album/'+pictureId+'/attachment')).status,200);
  const n=await call(staffOne,'notes','POST',{title:'Nota fictícia',content:'Conteúdo privado fictício',color:'rosa'});assert.equal(n.status,201);const id=(await n.json()).id;
  for(const login of [staffTwo,direction]){assert.deepEqual(await (await call(login,'notes')).json(),[]);assert.equal((await call(login,'notes/'+id)).status,404);assert.equal((await call(login,'notes/'+id,'DELETE',{version:1})).status,404)}
  assert.equal((await call(staffOne,'notes/'+id,'PATCH',{title:'Nota revisada',content:'Outro texto fictício',color:'verde',version:1})).status,200);assert.equal((await call(staffOne,'notes/'+id,'DELETE',{version:1})).status,409);
  for(const login of [one,two]){assert.equal((await call(login,'notes')).status,403);assert.equal((await call(login,'notes/'+id)).status,403);assert.equal((await call(login,'notes/'+id,'DELETE',{version:2})).status,403)}
  const payload='%PDF-1.4\n'+ 'F'.repeat(256*1024-9);assert.equal(payload.length,256*1024);
  const file=await call(one,'xerox','POST',{title:'Arquivo fictício no limite',copies:1,deadline:'2026-10-20',attachment:{name:'ficticio.pdf',type:'application/pdf',base64:btoa(payload)}});assert.equal(file.status,201);const x=(await file.json()).id;
  const download=await call(one,'xerox/'+x+'/attachment');assert.equal(download.status,200);assert.equal(await download.text(),payload);assert.equal((await call(two,'xerox/'+x+'/attachment')).status,404);
  const list=await (await call(direction,'xerox')).json();assert.equal(list[0].attachment_data,undefined);assert.equal(list[0].attachment_name,'ficticio.pdf');
  const formation=await call(direction,'events','POST',{title:'Formação fictícia',date:'2026-10-20',type:'Formação',visibility:'internal'});assert.equal(formation.status,201);assert.equal((await (await call(one,'events')).json())[0].type,'Formação');
  assert.equal((await call(staffOne,'notes/'+id,'DELETE',{version:2})).status,200);assert.equal((await call(staffOne,'notes/'+id)).status,404);
 }finally{await mf.dispose()}
});
