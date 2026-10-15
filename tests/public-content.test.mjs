import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {sqlite} from '../scripts/sqlite-adapter.mjs';
import {handle} from '../src/worker.mjs';
async function setup(){
 const DB=sqlite();for(const file of (await readdir(new URL('../migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort())DB.exec(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 DB.exec("INSERT INTO users VALUES('team@example.test','Equipe fictícia','direction',1),('teacher@example.test','Docente fictício','teacher',1),('supervision@example.test','Supervisão','supervision',1),('guidance@example.test','Orientação','guidance',1)");
 return {DB};
}
async function send(env,path,method='GET',data,role='team',origin='https://school.example'){
 const response=await handle(new Request('https://school.example'+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},body:method==='GET'||method==='HEAD'?undefined:JSON.stringify(data)}),env,async()=>role?role+'@example.test':null);
 return {status:response.status,headers:response.headers,body:response.headers.get('Content-Type')?.includes('json')?await response.json():await response.arrayBuffer()};
}
const content={kind:'project',title:'Projeto fictício',description:'Descrição autorizada',category:'Cultura',url:'',published:false};
const png={name:'imagem.png',type:'image/png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG6kAAAAASUVORK5CYII='};
test('public content isolates drafts, private images and author data, and revokes published images immediately',async()=>{
 const env=await setup();try{
 const created=await send(env,'/api/public-content','POST',{...content,attachment:png,image_alt:'Imagem fictícia'});assert.equal(created.status,201);
 const id=created.body.id,path='/api/public-content/'+id,image='/public/projects/'+id+'/image';
 assert.equal((await send(env,'/public/content','GET',undefined,null)).body.items.length,0);assert.equal((await send(env,image,'GET',undefined,null)).status,404);
 assert.equal((await send(env,path,'PATCH',{...content,published:true,version:1})).status,400);
 assert.equal((await send(env,path,'PATCH',{...content,published:true,image_alt:'Imagem fictícia',authorization_confirmed:true,version:1})).status,200);
 const item=(await send(env,'/public/content','GET',undefined,null)).body.items[0];assert.equal(item.image,image);
 assert.deepEqual(Object.keys(item).sort(),['category','description','id','image','image_alt','kind','title','updated_at','url']);
 assert.equal(JSON.stringify(item).includes('example.test'),false);
 const picture=await send(env,image,'GET',undefined,null);assert.equal(picture.status,200);assert.equal(picture.headers.get('Content-Type'),'image/png');assert.equal(picture.headers.get('Cache-Control'),'no-store');
 assert.equal((await send(env,path,'PATCH',{...content,published:true,image_alt:'Imagem fictícia',authorization_confirmed:true,version:1})).status,409);
 assert.equal((await send(env,path,'PATCH',{...content,image_alt:'Imagem fictícia',version:2})).status,200);
 assert.equal((await send(env,image,'GET',undefined,null)).status,404);
 assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM audit WHERE target=?").bind(path).first()).n,3);
 assert.equal((await send(env,path,'DELETE',{version:3})).status,200);
 }finally{env.DB.close()}
});
test('publication enforces roles, CSRF, consent, accessible image descriptions and safe document links',async()=>{
 const env=await setup();try{
 for(const role of [null,'teacher'])for(const method of ['GET','POST'])assert.equal((await send(env,'/api/public-content',method,method==='POST'?content:undefined,role)).status,role?403:401);
 assert.equal((await send(env,'/api/public-content','POST',content,'team','https://other.example')).status,403);
 for(const role of ['team','supervision','guidance'])assert.equal((await send(env,'/api/public-content','POST',content,role)).status,201);
 assert.equal((await send(env,'/api/public-content','POST',{...content,attachment:png})).status,400);
 assert.equal((await send(env,'/api/public-content','POST',{...content,attachment:{...png,type:'text/html'},image_alt:'Imagem'})).status,400);
 for(const url of ['javascript:alert(1)','http://example.test','https://user:password@example.test',''])assert.equal((await send(env,'/api/public-content','POST',{...content,kind:'document',url,published:true,authorization_confirmed:true})).status,400);
 const document=await send(env,'/api/public-content','POST',{...content,kind:'document',url:'https://example.test/documento',published:true,authorization_confirmed:true});assert.equal(document.status,201);
 const items=(await send(env,'/public/content','GET',undefined,null)).body.items;assert.equal(items.length,1);assert.equal(items[0].image,'');assert.ok(items[0].updated_at);
 assert.equal((await send(env,'/public/content','POST',{},null)).status,405);
 }finally{env.DB.close()}
});
test('notice expiry is inclusive in the school timezone, validates ranges and preserves legacy notices',async()=>{
 const env=await setup();try{
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const data={title:'Aviso',body:'Texto público',date:'2020-01-01',published:true};
 for(const expires_on of ['2020-01-02',today,''])assert.equal((await send(env,'/api/notices','POST',{...data,expires_on})).status,201);
 assert.equal((await send(env,'/public/api','GET',undefined,null)).body.notices.length,2);
 assert.equal((await send(env,'/api/notices')).body.length,3);
 for(const expires_on of ['2019-12-31','2026-02-30','invalid'])assert.equal((await send(env,'/api/notices','POST',{...data,expires_on})).status,400);
 const old=(await send(env,'/api/notices')).body.find(x=>x.expires_on===today);
 assert.equal((await send(env,'/api/notices/'+old.id,'PATCH',{...data,version:old.version})).status,200);
 assert.equal((await env.DB.prepare('SELECT expires_on FROM notices WHERE id=?').bind(old.id).first()).expires_on,today);
 assert.deepEqual((await env.DB.prepare('PRAGMA foreign_key_check').all()).results,[]);
 }finally{env.DB.close()}
});
