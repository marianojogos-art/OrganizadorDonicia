import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sqlite} from '../scripts/sqlite-adapter.mjs';
import {migrateLocal} from '../scripts/migrate-local.mjs';
import {parseTeachers,readTeachers,teacherSource} from '../src/teachers.mjs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';

const grade=`<h1>Donícia 2026</h1><p>Versão: 2026-08-20_15-40-49</p><table class="tableProf"><tr><th>Ágata - 2 aulas - 2 de ARTES</th></tr><tr><td>Nome que aparece somente numa aula</td></tr></table><table class="tableProf"><tr><th>Bruna &amp; equipe - 1 aula - 1 de APOIO</th></tr></table><table class="tableProf"><tr><th>Ágata - 2 aulas - 2 de ARTES</th></tr></table>`;
test('WebHorário parser reads only teacher headings, deduplicates and validates the school and format',()=>{
 const result=parseTeachers(grade);assert.deepEqual(result.names,['Ágata','Bruna & equipe']);assert.equal(result.sourceVersion,'2026-08-20_15-40-49');
 assert.throws(()=>parseTeachers(grade.replace('Donícia','Outra escola')));
 assert.throws(()=>parseTeachers('<h1>Donícia</h1><p>Login necessário</p>'));
 assert.throws(()=>parseTeachers(grade.replace('Ágata - 2 aulas','Formato alterado')));
 assert.deepEqual(parseTeachers('<h1>Donícia 2026</h1><table class="tableProf"><tr><th>Marina e Paula - 2 aulas</th></tr></table>').names,['Marina','Paula']);
});
test('directory survives source outage without replacing the previous verified names',async()=>{
 const DB=sqlite();await migrateLocal(DB);let calls=0;
 const fetcher=async url=>{assert.equal(url,teacherSource);calls++;return new Response(grade,{headers:{'Content-Type':'text/html; charset=UTF-8'}})};
 const now=Date.parse('2026-10-05T20:00:00Z');
 const first=await readTeachers(DB,{fetcher,now});assert.equal(first.stale,false);assert.equal(first.teachers.length,2);
 await readTeachers(DB,{fetcher,now:now+1000});assert.equal(calls,1);
 const stale=await readTeachers(DB,{force:true,fetcher:async()=>new Response('<h1>Donícia</h1>'),now:now+2000});assert.equal(stale.stale,true);assert.deepEqual(stale.teachers,first.teachers);assert.equal(stale.updatedAt,first.updatedAt);
 const redirect=await readTeachers(DB,{force:true,fetcher:async()=>new Response('',{status:302,headers:{Location:'https://other.example'}}),now});assert.equal(redirect.stale,true);
 DB.exec('DELETE FROM teacher_directory');await assert.rejects(readTeachers(DB,{fetcher:async()=>{throw Error('offline')},now}),/Não foi possível ler/);
 DB.close();
});
test('planning migration upgrades existing demo data once and seeds exactly three fictional auxiliaries',async()=>{
 const DB=sqlite();DB.exec(await readFile(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
 DB.exec("INSERT INTO auxiliaries(id,name) VALUES('real-existing','Auxiliar já cadastrada')");
 await migrateLocal(DB);await migrateLocal(DB);
 const rows=(await DB.prepare('SELECT * FROM auxiliaries').all()).results;assert.equal(rows.length,4);assert.equal(rows.filter(x=>x.name.includes('(fictícia)')).length,3);
 assert.ok(rows.some(x=>x.id==='real-existing'));DB.close();
});
test('directory fetch and parsing run in the actual Workers runtime',async()=>{
 const bundled=await build({stdin:{contents:`import {readTeachers} from './src/teachers.mjs';export default {async fetch(){const DB={prepare(){return {async first(){return null},bind(){return this},async run(){return {}}}}};return Response.json(await readTeachers(DB));}}`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',write:false});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-10-03',cf:false,script:bundled.outputFiles[0].text,outboundService:request=>{assert.equal(request.url,teacherSource);return new Response(grade,{headers:{'Content-Type':'text/html; charset=UTF-8'}})}}));
 try{const response=await mf.dispatchFetch('https://school.example/');assert.equal(response.status,200);assert.deepEqual((await response.json()).teachers,['Ágata','Bruna & equipe'])}finally{await mf.dispose()}
});
