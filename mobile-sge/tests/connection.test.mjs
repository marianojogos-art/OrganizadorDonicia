import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {createSgeReader} from '../../src/sge-reader.mjs';
import {SGE_HOME,sgeClassesUrl,allowedNavigation,validBridgeEvent,validBridgePage} from '../src/connection.js';
const ids=['106801:2026:9135:1:1:11','106801:2026:9135:1:1:12'];
function fixture(){
 let state='classes',current=1,active=0;const trace=[],updates=[],classes=ids.map((id,i)=>({id,name:'Turma '+(i+11),url:SGE_HOME+'classes.aspx'}));
 const page=()=>state==='classes'?{type:'classes',classes:[classes[current-1]],sourceUrl:SGE_HOME+'classes.aspx',pagination:{current,last:2},total:2}:state==='teachers'?{type:'teachers',classNumber:String(active+11),grade:'9135',stage:'1',complete:true,sourceUrl:SGE_HOME+'teachers.aspx?class='+active,teachers:[{id:'mat-1',assignmentId:'202:1',name:'Ágata',subject:'Português'}]}:{type:'plans',teacherName:'Ágata Fictícia',complete:true,sourceUrl:SGE_HOME+'plans.aspx',plans:[{id:'1',classId:ids[active],subjectCode:'202',title:'Outubro',start:'2026-10-01',end:'2026-10-10',situation:active?'Não enviado para análise':'Planejamento finalizado'}]};
 const transport={async snapshot(){return structuredClone(page())},async open(action){trace.push(action);if(action.kind==='next')current++;if(action.kind==='first')current=1;if(action.kind==='class'){active=ids.indexOf(action.id);state='teachers'}if(action.kind==='teacher')state='plans'},async navigate(url){trace.push({kind:'navigate',url});state=url.includes('teachers.aspx')?'teachers':url.includes('plans.aspx')?'plans':'classes';if(state==='classes')current=1;else active=Number(new URL(url).searchParams.get('class'));return structuredClone(page())}};
 transport.move=async action=>{await transport.open(action);return transport.snapshot()};
 return {trace,updates,transport,connection:createSgeReader(transport)};
}
test('mobile accepts only SGE HTTPS navigation and trusted bridge events',()=>{
 assert.equal(allowedNavigation(SGE_HOME),true);assert.equal(allowedNavigation('https://sgebr.net.br/login'),true);for(const url of ['http://www.sgebr.net.br/','https://www.sgebr.net.br.evil.example/','https://u:p@www.sgebr.net.br/','javascript:alert(1)'])assert.equal(allowedNavigation(url),false);
 assert.equal(validBridgeEvent({url:SGE_HOME}),true);assert.equal(validBridgeEvent({url:'https://evil.example/'}),false);assert.equal(validBridgeEvent({url:'https://www.sgebr.net.br/other/'}),false);
});
test('Android origin-only messages and iOS page URLs both accept a trusted SGE response',()=>{
 for(const url of ['https://www.sgebr.net.br','https://www.sgebr.net.br/sge8105/hselgerenciamentoplanoaula.aspx'])assert.equal(validBridgeEvent({url}),true);
 assert.equal(validBridgePage(SGE_HOME+'hselgerenciamentoplanoaula.aspx'),true);
 for(const url of ['https://www.sgebr.net.br/','https://evil.example/sge8105/','https://www.sgebr.net.br.evil.example/sge8105/','http://www.sgebr.net.br/sge8105/','https://u:p@www.sgebr.net.br/sge8105/'])assert.equal(validBridgePage(url),false);
});
test('directory reads both pages before any professor is opened',async()=>{
 const f=fixture(),directory=await f.connection.directory(u=>f.updates.push(u));assert.equal(directory.classes.length,2);assert.equal(directory.complete,true);assert.deepEqual(f.trace.map(a=>a.kind),['next']);assert.equal(f.updates.at(-1).stage,'directory');assert.equal(f.updates.at(-1).current,2);
});
test('shared reader opens confirmed classes and streams plan status and direct links',async()=>{
 const f=fixture(),directory=await f.connection.directory(u=>f.updates.push(u));
 f.transport.move=async action=>{if(action.kind==='plan')return {type:'detail',sourceUrl:SGE_HOME+'detail.aspx'};await f.transport.open(action);return f.transport.snapshot()};
 const teachers=await f.connection.teachers({classId:ids[0],sourceUrl:directory.sourceUrl});
 const plans=await f.connection.planning({classId:ids[0],assignmentId:'202:1',sourceUrl:teachers.sourceUrl},u=>f.updates.push(u));
 assert.equal(plans.plans[0].situation,'Planejamento finalizado');assert.equal(plans.plans[0].url,SGE_HOME+'detail.aspx');assert.equal(f.updates.filter(u=>u.stage==='plan-read').length,1);
});
test('expired sessions and incomplete or repeated pagination are reported',async()=>{
 const login=createSgeReader({snapshot:async()=>({type:'unrecognized'})});await assert.rejects(login.directory(),/lista de turmas/);
 const f=fixture(),snapshot=f.transport.snapshot;f.transport.snapshot=async()=>{const p=await snapshot();if(p.type==='classes'&&p.pagination.current===2)p.classes[0].id=ids[0];return p};await assert.rejects(f.connection.directory(),/não confere/);
});
test('incomplete teacher pages fail separately from an empty planning result',async()=>{
 const f=fixture(),directory=await f.connection.directory(),snapshot=f.transport.snapshot;f.transport.snapshot=async()=>{const p=await snapshot();if(p.type==='teachers')p.complete=false;return p};
 await assert.rejects(f.connection.teachers({classId:ids[0],sourceUrl:directory.sourceUrl}),/não corresponde/);
 const empty=fixture(),d=await empty.connection.directory(),teachers=await empty.connection.teachers({classId:ids[0],sourceUrl:d.sourceUrl}),old=empty.transport.snapshot;empty.transport.snapshot=async()=>{const p=await old();if(p.type==='plans')p.plans=[];return p};const result=await empty.connection.planning({classId:ids[0],assignmentId:'202:1',sourceUrl:teachers.sourceUrl});assert.equal(result.complete,true);assert.equal(result.plans.length,0);
});
test('WebView bridge emits no login fields and refuses non-read actions',async()=>{
 const runtime=(await readFile(new URL('../src/injected-runtime.js',import.meta.url),'utf8'));const source=JSON.parse(runtime.match(/export default ([\s\S]*);\s*$/)[1]);
 const {document,window}=parseHTML('<form id="MAINFORM"><input name="password" value="secret-password"><input name="CPF" value="private-cpf"></form>'),messages=[];
 window.ReactNativeWebView={postMessage:value=>messages.push(JSON.parse(value))};const context=vm.createContext({window,document,location:{origin:'https://www.sgebr.net.br',pathname:'/sge8105/login.aspx',href:SGE_HOME+'login.aspx'},URL});vm.runInContext(source,context);
 vm.runInContext("window.__doniciaMobile.request({id:'check',kind:'snapshot'});window.__doniciaMobile.request({id:'write',kind:'open',action:{kind:'save',id:'1'}})",context);
 assert.equal(messages.find(m=>m.id==='check').data.type,'detail');assert.equal(validBridgePage(messages.find(m=>m.id==='check').pageUrl),true);assert.ok(messages.find(m=>m.id==='write').error);assert.ok(!JSON.stringify(messages).includes('secret-password'));assert.ok(!JSON.stringify(messages).includes('private-cpf'));
});

test('mobile accepts both official SGE hosts and keeps the active domain for the classes button',()=>{
 for(const origin of ['https://www.sgebr.net.br','https://www.sgebr.com.br']){
  assert.equal(allowedNavigation(origin+'/sge8105/'),true);
  assert.equal(validBridgeEvent({url:origin}),true);
  assert.equal(validBridgePage(origin+'/sge8105/hplanejamentoaulager.aspx'),true);
  assert.equal(sgeClassesUrl(origin+'/sge8105/hplanejamentoaulager.aspx'),origin+'/sge8105/hselgerenciamentoplanoaula.aspx');
  for(const invalid of [origin.replace('https:','http:')+'/sge8105/',origin+'.evil.example/sge8105/',origin.replace('https://','https://u:p@')+'/sge8105/'])assert.equal(allowedNavigation(invalid),false);
 }
 assert.equal(sgeClassesUrl('about:blank'),SGE_HOME+'hselgerenciamentoplanoaula.aspx');
 assert.equal(validBridgePage('https://www.sgebr.com.br/'),false);
});
test('the shipped WebView bundle reads empty pages with hidden grids and preserves parser errors on both domains',async()=>{
 const generated=await readFile(new URL('../src/injected-runtime.js',import.meta.url),'utf8'),runtime=JSON.parse(generated.match(/export default ([\s\S]*);\s*$/)[1]);
 for(const origin of ['https://www.sgebr.net.br','https://www.sgebr.com.br']){
  const href=origin+'/sge8105/hplanejamentoaulager.aspx',messages=[];
  const {document,window}=parseHTML('<form id="MAINFORM"><input name="DISCODNOM"><input name="_ATUAL"><input name="_FINAL"><span id="TITULO">Planejamento de 301-MATEMATICA - ANA FICTÍCIA</span><span id="empty">Professor(a) não criou Planejamentos de Aula até o momento</span><table id="GRIDPLANEJADO" style="display:none"><tr><th>Período</th></tr></table></form>');
  for(const [name,value] of Object.entries({DISCODNOM:'301-MATEMATICA',_ATUAL:'0',_FINAL:'0'}))Object.defineProperty(document.querySelector('[name="'+name+'"]'),'value',{value,configurable:true});
  window.ReactNativeWebView={postMessage:raw=>messages.push(JSON.parse(raw))};
  const context=vm.createContext({window,document,location:{origin,pathname:'/sge8105/hplanejamentoaulager.aspx',href},URL});vm.runInContext(runtime,context);
  vm.runInContext("window.__doniciaMobile.request({id:'empty',kind:'snapshot'})",context);
  const result=messages.find(x=>x.id==='empty');assert.equal(result.data.type,'plans');assert.equal(result.data.complete,true);assert.deepEqual(result.data.pagination,{current:1,last:1});assert.deepEqual(result.data.plans,[]);assert.equal(result.data.subject,'301-MATEMATICA');
  document.querySelector('#empty').textContent='Sessão encerrada';Object.defineProperty(document.querySelector('[name="_FINAL"]'),'value',{value:'-1',configurable:true});
  vm.runInContext("window.__doniciaMobile.request({id:'failure',kind:'snapshot'})",context);
  assert.match(messages.find(x=>x.id==='failure').error,/Paginação do SGE/);
 }
});
