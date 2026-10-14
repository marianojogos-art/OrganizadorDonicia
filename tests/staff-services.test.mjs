import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sqlite} from '../scripts/sqlite-adapter.mjs';
import {handleStaffServices,isStaffServicesRoute} from '../src/staff-services.mjs';
const initial=await readFile(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8');
const migration=await readFile(new URL('../migrations/0012_staff_services.sql',import.meta.url),'utf8');
const teacher={email:'one@example.test',name:'Professor fictício',role:'teacher'},other={email:'two@example.test',name:'Outra pessoa fictícia',role:'teacher'},direction={email:'direction@example.test',name:'Direção fictícia',role:'direction'};
function setup(){const DB=sqlite();DB.exec(initial+migration);for(const u of [teacher,other,direction])DB.exec(`INSERT INTO users VALUES('${u.email}','${u.name}','${u.role}',1)`);return DB}
async function send(DB,path,method='GET',data,user=direction){const response=await handleStaffServices(new Request('https://school.example/api/'+path,{method}),DB,user,data);return response?{status:response.status,body:response.headers.get('Content-Type')?.includes('application/json')?await response.json():new Uint8Array(await response.arrayBuffer()),headers:response.headers}:null}
const requestData={type:'message',title:'Aviso fictício',classes:'Turmas 61 e 62',description:'Comunicação fictícia sem dados de alunos',deadline:'2026-10-20'};
const photo={authorization_confirmed:true,title:'Registro fictício',description:'Foto sintética',date:'2026-10-14',attachment:{name:'foto.png',type:'image/png',base64:Buffer.from([137,80,78,71,13,10,26,10,0]).toString('base64')}};
const resource={title:'Documento de referência cadastrado',category:'bncc',url:'https://example.test/documento.pdf',description:'Referência fictícia para teste'};
test('routes are exact and fail closed for unknown profiles, methods and private resources',async()=>{
 const DB=setup();assert.equal(isStaffServicesRoute('/api/staff-requests'),true);assert.equal(isStaffServicesRoute('/api/pedagogical-album/a/attachment'),true);
 for(const path of ['/api/resource-library/a/attachment','/api/staff-requests/a/extra','/api/staff-requests/a/b/c','/api/staff-requests/'])assert.equal(await send(DB,path),null);
 assert.equal((await send(DB,'staff-requests','GET',null,null)).status,403);
 assert.equal((await send(DB,'staff-requests','GET',null,{...teacher,role:'external'})).status,403);
 for(const kind of ['pedagogical-album','resource-library'])for(const method of ['GET','POST'])assert.equal((await send(DB,kind,method,{},teacher)).status,403);
 assert.equal((await send(DB,'staff-requests','PUT',{})).status,405);
 assert.equal((await send(DB,'staff-requests','DELETE',{})).status,405);
});
test('requests isolate teacher ownership, preserve authenticated identity and let pedagogical staff manage status',async()=>{
 const DB=setup();const created=await send(DB,'staff-requests','POST',requestData,teacher);assert.equal(created.status,201);const path='staff-requests/'+created.body.id;
 assert.deepEqual((await send(DB,'staff-requests','GET',null,other)).body,[]);assert.equal((await send(DB,path,'GET',null,other)).status,404);
 assert.equal((await send(DB,path,'PATCH',{version:1,title:'Intrusão'},other)).status,404);
 assert.equal((await send(DB,path,'DELETE',{version:1},other)).status,404);
 assert.equal((await send(DB,path,'PATCH',{version:1,status:'Aprovada'},teacher)).status,403);
 assert.equal((await send(DB,path,'PATCH',{version:1,title:'Título revisado'},teacher)).status,200);
 assert.equal((await send(DB,path,'GET')).body.requester,teacher.email);
 assert.equal((await send(DB,path,'PATCH',{version:2,status:'Em análise'})).status,200);
 assert.equal((await send(DB,path,'PATCH',{version:3,title:'Tarde demais'},teacher)).status,409);
 assert.equal((await send(DB,path,'DELETE',{version:3},teacher)).status,409);
 for(const [version,status] of [[3,'Aprovada'],[4,'Concluída']])assert.equal((await send(DB,path,'PATCH',{version,status})).status,200);
 for(const role of ['supervision','guidance'])assert.equal((await send(DB,'staff-requests','GET',null,{...direction,role})).body.length,1);
 assert.equal((await send(DB,'staff-requests','POST',{...requestData,type:'material'},teacher)).status,201);
 assert.equal((await send(DB,'staff-requests','POST',{...requestData,requester:other.email},teacher)).status,400);
 assert.equal((await send(DB,'staff-requests','POST',{...requestData,status:'Concluída'})).status,400);
});
test('request validation rejects malformed data, impossible dates and overlong text',async()=>{
 const DB=setup();for(const change of [{type:'mail'},{classes:''},{deadline:'2026-02-30'},{deadline:12},{title:'x'.repeat(161)},{description:'x'.repeat(4001)},{classes:'x'.repeat(301)},{title:'bad\u0000text'}])assert.equal((await send(DB,'staff-requests','POST',{...requestData,...change},teacher)).status,400);
 for(const data of [null,[],42])assert.equal((await send(DB,'staff-requests','POST',data,teacher)).status,400);
 const created=await send(DB,'staff-requests','POST',requestData,teacher),path='staff-requests/'+created.body.id;
 for(const version of [undefined,0,'1',1.5])assert.equal((await send(DB,path,'DELETE',{version},teacher)).status,400);
 assert.equal((await send(DB,path,'PATCH',{version:1,status:'Enviada'})).status,400);
 assert.equal((await send(DB,path,'DELETE',{version:1},teacher)).status,200);
 assert.equal((await send(DB,path)).status,404);
});
test('album stores private JPEG/PNG, lists only metadata and downloads only for pedagogical profiles',async()=>{
 const DB=setup(),created=await send(DB,'pedagogical-album','POST',photo);assert.equal(created.status,201);const path='pedagogical-album/'+created.body.id;
 const stored=await DB.prepare('SELECT * FROM pedagogical_album WHERE id=?').bind(created.body.id).first();assert.equal(stored.authorization_confirmed,undefined);
 const list=await send(DB,'pedagogical-album');assert.equal(list.body[0].attachment_data,undefined);assert.equal((await send(DB,path)).body.attachment_data,undefined);assert.match(list.headers.get('Cache-Control'),/no-store/);
 assert.equal((await send(DB,path+'/attachment','GET',null,teacher)).status,403);
 const download=await send(DB,path+'/attachment');assert.equal(download.status,200);assert.deepEqual([...download.body],[137,80,78,71,13,10,26,10,0]);assert.equal(download.headers.get('Content-Type'),'image/png');assert.match(download.headers.get('Content-Disposition'),/^attachment;/);assert.match(download.headers.get('Content-Security-Policy'),/sandbox/);
 assert.equal((await send(DB,path,'PATCH',{version:1,title:'Novo título'})).status,200);assert.deepEqual((await send(DB,path+'/attachment')).body,download.body);
 assert.equal((await send(DB,path,'PATCH',{version:2,attachment:photo.attachment})).status,400);
 assert.equal((await send(DB,path,'PATCH',{version:2,authorization_confirmed:true,attachment:{name:'outra.jpg',type:'image/jpeg',base64:Buffer.from([255,216,255,217]).toString('base64')}})).status,200);
 assert.equal((await send(DB,path+'/attachment')).headers.get('Content-Type'),'image/jpeg');
 assert.equal((await send(DB,path,'DELETE',{version:3})).status,200);assert.equal((await send(DB,path+'/attachment')).status,404);
});
test('album rejects non-images, mismatched signatures, bad filenames/base64 and attachments over 256 KiB',async()=>{
 const DB=setup();
 for(const authorization_confirmed of [undefined,false,'true'])assert.equal((await send(DB,'pedagogical-album','POST',{...photo,authorization_confirmed})).status,400);
 for(const attachment of [null,{name:'x.svg',type:'image/svg+xml',base64:'AAAA'},{name:'x.pdf',type:'application/pdf',base64:'JVBERi0='},{...photo.attachment,name:'../x.png'},{...photo.attachment,base64:'AAAA'},{...photo.attachment,base64:'%%%='},{...photo.attachment,name:'x.jpg'}])assert.equal((await send(DB,'pedagogical-album','POST',{...photo,attachment})).status,400);
 assert.equal((await send(DB,'pedagogical-album','POST',{...photo,attachment:undefined})).status,400);
 assert.equal((await send(DB,'pedagogical-album','POST',{...photo,remove_attachment:true})).status,400);
 const bytes=Buffer.alloc(256*1024);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);
 assert.equal((await send(DB,'pedagogical-album','POST',{...photo,attachment:{...photo.attachment,base64:bytes.toString('base64')}})).status,201);
 assert.equal((await send(DB,'pedagogical-album','POST',{...photo,attachment:{...photo.attachment,base64:Buffer.concat([bytes,Buffer.from([0])]).toString('base64')}})).status,413);
 await assert.rejects(DB.prepare('UPDATE pedagogical_album SET attachment_data=?').bind('A'.repeat(349529)).run(),/CHECK constraint failed/);
});
test('resource library contains only entered references, validates HTTPS and does not execute or fetch links',async()=>{
 const DB=setup();assert.deepEqual((await send(DB,'resource-library')).body,[]);
 for(const url of ['http://example.test','javascript:alert(1)','data:text/html,hi','https://u:p@example.test','not a url','https://example.test/\\evil'])assert.equal((await send(DB,'resource-library','POST',{...resource,url})).status,400);
 assert.equal((await send(DB,'resource-library','POST',{...resource,category:'invented'})).status,400);
 for(const category of ['bncc','matriz','documentos'])assert.equal((await send(DB,'resource-library','POST',{...resource,category})).status,201);
 const created=await send(DB,'resource-library','POST',resource),path='resource-library/'+created.body.id;
 assert.equal((await send(DB,path,'PATCH',{version:1,url:'https://example.test/nova'})).status,200);
 assert.equal((await send(DB,path)).body.url,'https://example.test/nova');
 assert.equal((await send(DB,path,'PATCH',{version:1,title:'stale'})).status,409);
 assert.equal((await send(DB,path,'DELETE',{version:2})).status,200);
});
test('concurrent updates have one winner; audit logs only metadata and rolls back when business transaction fails',async()=>{
 const DB=setup(),created=await send(DB,'staff-requests','POST',requestData,teacher),path='staff-requests/'+created.body.id;
 const results=await Promise.all(['Aprovada','Recusada'].map(status=>send(DB,path,'PATCH',{version:1,status})));
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const audit=(await DB.prepare('SELECT * FROM audit').all()).results;assert.equal(audit.length,2);assert.ok(audit.every(row=>!JSON.stringify(row).includes(requestData.description)));
 DB.exec("CREATE TRIGGER fail_staff_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END;");
 assert.equal((await send(DB,path,'PATCH',{version:2,title:'Should roll back'})).status,503);
 assert.equal((await send(DB,path)).body.version,2);assert.equal((await send(DB,path)).body.title,requestData.title);
});
