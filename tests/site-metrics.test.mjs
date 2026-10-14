import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sqlite} from '../scripts/sqlite-adapter.mjs';
import {ingestMetrics,readMetrics,METRIC_SECTIONS,METRIC_LIMITS} from '../src/site-metrics.mjs';
const migration=await readFile(new URL('../migrations/0014_site_metrics.sql',import.meta.url),'utf8');
const clock=Date.parse('2026-10-14T12:00:00Z'),day='2026-10-14';
const draft=(extra={})=>({eventId:crypto.randomUUID(),sessionId:crypto.randomUUID(),event:'page_view',section:'home',...extra});
function setup(){const DB=sqlite();DB.exec(migration);return DB}
async function ingest(DB,data=draft(),options={}){const response=await ingestMetrics(new Request('https://school.example'+(options.path||'/public/metrics'),{method:options.method||'POST',headers:{Origin:'https://school.example','Content-Type':'application/json',...options.headers},body:['GET','HEAD'].includes(options.method)?undefined:options.raw??JSON.stringify(data)}),DB);return {status:response.status,body:await response.json(),headers:response.headers}}
async function report(DB,query='?from=2026-10-14&to=2026-10-14',role='direction'){const response=await readMetrics(new Request('https://school.example/api/site-metrics'+query),DB,role?{role}:null);return {status:response.status,body:await response.json(),headers:response.headers}}
async function at(time,callback){const original=Date.now;Date.now=()=>time;try{return await callback()}finally{Date.now=original}}
function statements(sql){const output=[];let current='';for(const line of sql.split(/\r?\n/)){if(!line.trim()||line.trim().startsWith('--'))continue;current+=line+'\n';if(line.trimEnd().endsWith(';')){output.push(current);current=''}}assert.equal(current.trim(),'');return output}

test('ingestion accepts only exact anonymous contract and same-origin bounded JSON on the public path',async()=>at(clock,async()=>{
 const DB=setup();assert.equal((await ingest(DB)).status,202);
 const probe=await ingestMetrics(new Request('https://school.example/public/metrics',{method:'HEAD'}),DB);assert.equal(probe.status,204);assert.equal(await probe.text(),'');assert.equal((await DB.prepare('SELECT count(*) AS n FROM site_metrics_events').first()).n,1);
 for(const options of [{headers:{Origin:'https://evil.example'}},{headers:{Origin:''}}])assert.equal((await ingest(DB,draft(),options)).status,403);
 assert.equal((await ingest(DB,draft(),{headers:{'Content-Type':'text/plain'}})).status,415);
 for(const method of ['GET','PATCH'])assert.equal((await ingest(DB,draft(),{method})).status,405);
 assert.equal((await ingest(DB,draft(),{path:'/api/metrics'})).status,404);
 assert.equal((await ingest(DB,draft(),{raw:'{'})).status,400);
 assert.equal((await ingest(DB,draft(),{raw:' '.repeat(2049)})).status,413);
 for(const patch of [{ip:'192.0.2.1'},{url:'https://example.test'},{eventId:'guess'},{sessionId:'guess'},{event:'login'},{section:'staff-requests'},{section:'escola'},{event:'section_click',section:'home'},{event:'whatsapp_click',section:'contatos'}])assert.equal((await ingest(DB,draft(patch))).status,400,JSON.stringify(patch));
 for(const data of [null,[],42,{eventId:crypto.randomUUID()}])assert.equal((await ingest(DB,data)).status,400);
 DB.close();
}));
test('daily hashes are the only stored identifiers, bots are ignored and metadata never reaches storage or reports',async()=>at(clock,async()=>{
 const DB=setup(),input=draft();
 assert.equal((await ingest(DB,input,{headers:{'User-Agent':'Mozilla/5.0','Cookie':'auth=private','Referer':'https://private.example/profile','CF-Connecting-IP':'192.0.2.1'}})).status,202);
 const row=await DB.prepare('SELECT * FROM site_metrics_events').first();assert.match(row.event_hash,/^[a-f0-9]{64}$/);assert.match(row.session_hash,/^[a-f0-9]{64}$/);
 const stored=JSON.stringify(row);for(const secret of [input.eventId,input.sessionId,'private.example','192.0.2.1','Mozilla','auth='])assert.equal(stored.includes(secret),false);
 for(const ua of ['Googlebot','GPTBot/1.0','Bingbot','HeadlessChrome','curl/8.0'])assert.equal((await ingest(DB,draft(),{headers:{'User-Agent':ua}})).status,202);
 assert.equal((await report(DB)).body.totals.views,1);
 const serialized=JSON.stringify((await report(DB)).body);assert.equal(serialized.includes(row.event_hash),false);assert.equal(serialized.includes(row.session_hash),false);DB.close();
}));
test('retries and concurrent events are idempotent; session estimates count tabs/day and rate gates are atomic',async()=>at(clock,async()=>{
 const DB=setup(),input=draft();const results=await Promise.all(Array.from({length:6},()=>ingest(DB,input)));assert.ok(results.every(r=>r.status===202));
 const section=draft({sessionId:input.sessionId,event:'section_click',section:'escola'});
 const competing=await Promise.all(Array.from({length:5},()=>ingest(DB,{...section,eventId:crypto.randomUUID()})));assert.deepEqual(competing.map(r=>r.status).sort(),[202,429,429,429,429]);
 const clicked=await ingest(DB,draft({sessionId:input.sessionId,event:'whatsapp_click',section:'whatsapp_secretaria'}));assert.equal(clicked.status,202);
 assert.equal((await ingest(DB,draft())).status,202);
 let totals=(await report(DB)).body.totals;assert.deepEqual(totals,{views:2,estimatedVisits:2,sectionClicks:1,whatsappClicks:1});
 await at(clock+1999,async()=>assert.equal((await ingest(DB,{...input,eventId:crypto.randomUUID()})).status,429));
 await at(clock+2000,async()=>assert.equal((await ingest(DB,{...input,eventId:crypto.randomUUID()})).status,202));
 const after=(await report(DB)).body;assert.equal(after.totals.views,3);assert.equal(after.totals.estimatedVisits,2);assert.equal(after.bySection.find(s=>s.section==='escola').sectionClicks,1);DB.close();
}));
test('session views, total session events and global daily budget are bounded without IP addresses',async()=>at(clock,async()=>{
 const DB=setup(),input=draft();assert.equal((await ingest(DB,input)).status,202);
 await DB.prepare('UPDATE site_metrics_sessions SET views=20').run();await at(clock+2000,async()=>assert.equal((await ingest(DB,{...input,eventId:crypto.randomUUID()})).status,429));
 assert.equal((await ingest(DB,draft({sessionId:input.sessionId,event:'section_click',section:'avisos'}))).status,202);
 await DB.prepare('UPDATE site_metrics_sessions SET events=100').run();assert.equal((await ingest(DB,draft({sessionId:input.sessionId,event:'section_click',section:'redes'}))).status,429);
 await DB.prepare('UPDATE site_metrics_daily SET accepted_events=19999').run();
 const results=await Promise.all([ingest(DB,draft()),ingest(DB,draft())]);assert.deepEqual(results.map(r=>r.status).sort(),[202,429]);
 assert.equal((await DB.prepare('SELECT accepted_events FROM site_metrics_daily').first()).accepted_events,20000);
 assert.equal((await ingest(DB,input)).status,202);assert.equal(results.find(r=>r.status===429).headers.get('Retry-After'),'2');DB.close();
}));
test('UTC rotation changes hashes and counts daily session estimates; opportunistic cleanup retains 48h/90days',async()=>at(clock,async()=>{
 const DB=setup(),input=draft();assert.equal((await ingest(DB,input)).status,202);const old=await DB.prepare('SELECT session_hash,event_hash FROM site_metrics_events').first();
 await at(clock+86400000,async()=>assert.equal((await ingest(DB,input)).status,202));const records=(await DB.prepare('SELECT * FROM site_metrics_events ORDER BY day').all()).results;assert.equal(records.length,2);assert.notEqual(records[1].session_hash,old.session_hash);assert.notEqual(records[1].event_hash,old.event_hash);
 await at(clock+86400000,async()=>{const result=await report(DB,'?from=2026-10-14&to=2026-10-15');assert.equal(result.body.totals.estimatedVisits,2)});
 await DB.prepare("INSERT INTO site_metrics_daily(day,views) VALUES('2026-01-01',99)").run();await DB.prepare("INSERT INTO site_metrics_sections(day,section,event,count) VALUES('2026-01-01','home','page_view',99)").run();
 await at(clock+48*3600000+1,async()=>assert.equal((await ingest(DB,draft())).status,202));
 assert.equal(await DB.prepare('SELECT event_hash FROM site_metrics_events WHERE event_hash=?').bind(old.event_hash).first(),null);
 assert.equal(await DB.prepare("SELECT day FROM site_metrics_daily WHERE day='2026-01-01'").first(),null);
 assert.equal(await DB.prepare("SELECT day FROM site_metrics_sections WHERE day='2026-01-01'").first(),null);
 assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM site_metrics_sessions').first()).n,2);DB.close();
}));
test('reports are pedagogical-only, numeric and zero-filled with strict inclusive 90-day UTC bounds',async()=>at(clock,async()=>{
 const DB=setup();for(const role of [null,'teacher','external'])assert.equal((await report(DB,'',role)).status,403);
 for(const role of ['direction','supervision','guidance']){const result=await report(DB,'?from=2026-10-12&to=2026-10-14',role);assert.equal(result.status,200);assert.deepEqual(result.body.totals,{views:0,estimatedVisits:0,sectionClicks:0,whatsappClicks:0});assert.equal(result.body.byDay.length,3);assert.equal(result.body.bySection.length,METRIC_SECTIONS.length);assert.equal(result.body.timezone,'UTC');assert.match(result.headers.get('Cache-Control'),/no-store/)}
 for(const query of ['?from=2026-02-30','?from=2026-10-15','?from=2026-10-14&to=2026-10-13','?from=2026-01-01&to=2026-10-14','?from=2026-10-14&to=2026-10-15','?email=person','?from=2026-10-14&from=2026-10-14'])assert.equal((await report(DB,query)).status,400,query);
 assert.equal((await report(DB,'?from=2026-07-17&to=2026-10-14')).body.byDay.length,90);assert.equal(METRIC_LIMITS.globalEventsPerDay,20000);DB.close();
}));
test('failed aggregate writes roll back event/session rows, allowing a clean retry',async()=>at(clock,async()=>{
 const DB=setup(),input=draft();DB.exec("CREATE TRIGGER synthetic_failure BEFORE INSERT ON site_metrics_sections BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");
 assert.equal((await ingest(DB,input)).status,503);for(const table of ['site_metrics_events','site_metrics_sessions','site_metrics_daily'])assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM '+table).first()).n,0);
 DB.exec('DROP TRIGGER synthetic_failure');assert.equal((await ingest(DB,input)).status,202);assert.equal((await report(DB)).body.totals.views,1);DB.close();
}));
test('D1 executes migration triggers with concurrent deduplication, limits and atomic aggregates',async()=>{
 const {Miniflare,convertV4MiniflareOptions}=await import('miniflare');const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-10-03',cf:false,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{DB:'synthetic-site-metrics'}}));
 try{const DB=await mf.getD1Database('DB');await DB.batch(statements(migration).map(statement=>DB.prepare(statement)));const input=draft();
 const replies=await Promise.all(Array.from({length:5},()=>ingest(DB,input)));assert.ok(replies.every(r=>r.status===202));
 const events=await DB.prepare('SELECT COUNT(*) AS n FROM site_metrics_events').first();assert.equal(events.n,1);
 const results=await Promise.all(Array.from({length:4},()=>ingest(DB,draft({sessionId:input.sessionId,event:'section_click',section:'escola'}))));assert.deepEqual(results.map(r=>r.status).sort(),[202,429,429,429]);
 const today=new Date().toISOString().slice(0,10),result=await report(DB,'?from='+today+'&to='+today);assert.deepEqual(result.body.totals,{views:1,estimatedVisits:1,sectionClicks:1,whatsappClicks:0});
 await DB.prepare('UPDATE site_metrics_daily SET accepted_events=20000').run();assert.equal((await ingest(DB,draft())).status,429);assert.equal((await ingest(DB,input)).status,202);
 }finally{await mf.dispose()}
});

