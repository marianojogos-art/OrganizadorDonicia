import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {MobileBridge,ORGANIZER,ACCESS,organizerNavigation,organizerSender} from '../src/mobile-bridge.js';
import {handle} from '../../src/worker.mjs';
import {sqlite} from '../../scripts/sqlite-adapter.mjs';
const source='https://www.sgebr.net.br/sge8105/',classId='106801:2026:9135:1:1:11';
function transport(){
 const directory={type:'classes',pagination:{current:1,last:1},total:1,classes:[{id:classId,name:'Turma fictícia',url:source+'classes.aspx'}],sourceUrl:source+'classes.aspx'};
 const teachers={type:'teachers',classNumber:'11',grade:'9135',stage:'1',complete:true,sourceUrl:source+'teachers.aspx',teachers:[{id:'mat-1',assignmentId:'202:1',name:'Ana',subject:'Português',url:source+'teachers.aspx'}]};
 const plans={type:'plans',teacherName:'Ana Fictícia',complete:true,sourceUrl:source+'plans.aspx',plans:[{id:'1',title:'Outubro',start:'2026-10-01',end:'2026-10-10',trimester:null,situation:'Não enviado para análise',url:null,classId,subjectCode:'202'}]};
 let page=directory;const clone=()=>structuredClone(page),trace=[];
 return {trace,snapshot:async()=>clone(),navigate:async url=>{trace.push(url);page=url.includes('teachers')?teachers:url.includes('plans')?plans:directory;return clone()},move:async action=>{trace.push(action);page=action.kind==='class'?teachers:action.kind==='teacher'?plans:{type:'detail',sourceUrl:source+'detail.aspx'};return clone()}};
}
const message=(id,command,input)=>({channel:'donicia-native-organizer',id,command,input});
test('mobile uses only the website and its Access login; untrusted pages cannot call native SGE',async()=>{
 assert.equal(organizerNavigation(ORGANIZER),true);assert.equal(organizerNavigation(ACCESS+'/cdn-cgi/access/login'),true);for(const url of ['https://evil.example','http://organizadordonicia.carijo.workers.dev','https://u:p@organizadordonicia.carijo.workers.dev'])assert.equal(organizerNavigation(url),false);
 assert.equal(organizerSender(ACCESS),false);const replies=[],bridge=new MobileBridge(transport(),{reply:r=>replies.push(r)});
 await bridge.handle(message('1','ping'),'https://evil.example');assert.equal(replies.length,0);await bridge.handle(message('1','ping'),ORGANIZER);assert.equal(replies[0].data.native,true);assert.equal(replies[0].data.progress,true);
});
test('native bridge exposes the same connector commands, stream and direct links',async()=>{
 const replies=[],bridge=new MobileBridge(transport(),{reply:r=>replies.push(r)});
 await bridge.handle(message('d','directory'),ORGANIZER);const directory=replies.find(r=>r.id==='d'&&r.data).data;assert.equal(directory.classes.length,1);
 await bridge.handle(message('t','teachers',{classId,sourceUrl:directory.sourceUrl}),ORGANIZER);const teachers=replies.find(r=>r.id==='t'&&r.data).data;
 await bridge.handle(message('p','planning',{classId,assignmentId:'202:1',sourceUrl:teachers.sourceUrl}),ORGANIZER);const plans=replies.find(r=>r.id==='p'&&r.data).data;assert.equal(plans.plans[0].url,source+'detail.aspx');assert.equal(replies.find(r=>r.progress?.stage==='plan-read').progress.plan.situation,'Não enviado para análise');assert.equal(bridge.running,false);
});
test('website confirmation persists mobile SGE data through the existing API and same database',async()=>{
 const DB=sqlite();for(const file of ['0001_initial.sql','0005_supervision.sql'])DB.exec(await readFile(new URL('../../migrations/'+file,import.meta.url),'utf8'));DB.exec("INSERT INTO users VALUES('d@prof.pmf.sc.gov.br','Direção fictícia','direction',1)");
 const html=await readFile(new URL('../../src/index.html',import.meta.url),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('});boot();','});');const {document}=parseHTML(html),context=vm.createContext({document,URL,Date,Intl,setTimeout:()=>{},FormData});vm.runInContext(script,context);
 let callback,resolve;const bridge=new MobileBridge(transport(),{reply:r=>{if(r.channel==='donicia-sge-progress')callback?.(r.progress);else resolve(r)}});
 context.native=async(command,input,onProgress)=>{callback=onProgress;const response=await new Promise(done=>{resolve=done;bridge.handle(message('request',command,input),ORGANIZER)});if(response.error)throw Error(response.error);return response.data};
 context.callApi=async(path,method='GET',data)=>{const response=await handle(new Request(ORGANIZER+'/api/'+path,{method,headers:{Origin:ORGANIZER,'Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(data)}),{DB},async()=> 'd@prof.pmf.sc.gov.br');const result=await response.json();if(!response.ok)throw Error(result.error);return result};
 vm.runInContext("currentUser={role:'direction'};supervisionBridge=native;api=callApi;state.section='supervisao'",context);
 await vm.runInContext('loadSavedSupervision();',context);await vm.runInContext('loadSupervisionClasses()',context);context.classId=classId;vm.runInContext('supervision.selected=new Set([classId]);',context);await vm.runInContext('confirmSupervision()',context);
 assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM supervision_classes').first()).n,1);assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM audit').first()).n,1);assert.match(document.querySelector('#page').textContent,/Ana Fictícia/);assert.match(document.querySelector('#page').textContent,/Não enviado para análise/);assert.equal(vm.runInContext('supervision.saved.version',context),1);
});
test('unauthenticated SGE asks for login without collecting credentials and rejects overlapping reads',async()=>{
 const replies=[],opened=[];const bridge=new MobileBridge({snapshot:async()=>{throw Error('Faça login')}},{reply:r=>replies.push(r),openSge:()=>opened.push(true)});await bridge.handle(message('d','directory'),ORGANIZER);assert.match(replies[0].error,/login/);assert.equal(opened.length,1);
 bridge.running=true;await bridge.handle(message('t','teachers',{}),ORGANIZER);assert.match(replies.at(-1).error,/andamento/);
});
test('organizer runtime installs once, forwards only allowed requests and adapts connector instructions',async()=>{
 const runtime=await readFile(new URL('../src/organizer-runtime.js',import.meta.url),'utf8'),{document}=parseHTML('<html><body><details class="supervision-setup">Extension</details></body></html>'),window={},sent=[],listeners=[];
 window.ReactNativeWebView={postMessage:raw=>sent.push(JSON.parse(raw))};window.addEventListener=(event,handler)=>{if(event==='message')listeners.push(handler)};window.postMessage=()=>{};
 const context=vm.createContext({window,document,location:{origin:ORGANIZER},URL,MutationObserver:class {observe(){}}});vm.runInContext('(()=>{'+runtime+'})()',context);vm.runInContext('(()=>{'+runtime+'})()',context);assert.equal(listeners.length,1);assert.ok(document.querySelector('[data-native-sge-open]'));assert.equal(document.querySelector('[download]'),null);
 listeners[0]({source:window,origin:ORGANIZER,data:{channel:'donicia-sge-request',id:'1',command:'planning',input:{classId}}});assert.equal(sent[0].command,'planning');listeners[0]({source:window,origin:'https://evil.example',data:{channel:'donicia-sge-request',id:'2',command:'planning'}});assert.equal(sent.length,1);
});
