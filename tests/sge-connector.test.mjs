import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const script=(await build({entryPoints:[fileURLToPath(new URL('../sge-connector/background.mjs',import.meta.url))],bundle:true,write:false,platform:'browser',format:'iife'})).outputFiles[0].text;
const base='https://www.sgebr.net.br/sge8105/',sourceUrl=base+'hselgerenciamentoplanoaula.aspx?catalog',key='106801:2026:9135:1:1:11';
function browser(){
 const pages={first:{type:'classes',classes:[{id:key,name:'Turma 11',url:sourceUrl}],sourceUrl,pagination:{current:1,last:2},total:2},second:{type:'classes',classes:[{id:key.replace(/11$/,'12'),name:'Turma 12',url:sourceUrl}],sourceUrl,pagination:{current:2,last:2},total:2},teachers:{type:'teachers',classNumber:'11',grade:'9135',stage:'1',complete:true,sourceUrl:base+'hplanejamentodisciplinasger.aspx?teacher',teachers:[{id:'mat-1',assignmentId:'202:1',name:'Ágata',subject:'Português'}]},plans:{type:'plans',teacherName:'Ágata Fictícia',complete:true,sourceUrl:base+'hplanejamentoaulager.aspx?plans',plans:[{id:'7',classId:key,subjectCode:'202',title:'Outubro',situation:'Planejamento finalizado',trimester:null,url:null}]},detail:{type:'detail',sourceUrl:base+'hplanejamentoaulaconsulta.aspx?direct'}};
 let state='first',onMessage;const listeners=new Set(),actions=[],removed=[],messages=[];
 const finish=()=>queueMicrotask(()=>{for(const listener of [...listeners])listener(10,{status:'complete'})});
 const chrome={tabs:{onUpdated:{addListener:l=>listeners.add(l),removeListener:l=>listeners.delete(l)},async query(){return [{id:1,url:sourceUrl}]},async create(){return {id:10}},async sendMessage(id,message){messages.push(message)},async remove(id){removed.push(id)},async update(id,{url}){state=url.includes('hselgerenciamentoplanoaula')?'first':url.includes('hplanejamentodisciplinasger')?'teachers':url.includes('hplanejamentoaulager')?'plans':'detail';finish()}},runtime:{onMessage:{addListener:l=>onMessage=l}},scripting:{async executeScript(opts){if(opts.files)return [];context.window.__doniciaSge={snapshot:()=>structuredClone(pages[state]),open(action){actions.push(action);if(action.kind==='next')state='second';else if(action.kind==='first')state='first';else if(action.kind==='class')state='teachers';else if(action.kind==='teacher')state='plans';else if(action.kind==='plan')state='detail';else throw Error('Unknown action');finish();return true}};const result=vm.runInContext('('+opts.func.toString()+')',context)(...(opts.args||[]));return [{result}]}}};
 const context=vm.createContext({chrome,window:{},URL,Promise,setTimeout,clearTimeout});vm.runInContext(script,context);
 const send=(command,input,url='https://organizadordonicia.carijo.workers.dev/')=>new Promise(resolve=>{if(!onMessage({id:'request-'+command,command,input},{url,tab:{id:50}},resolve))resolve({ignored:true})});
 return {send,actions,removed,messages,pages};
}
test('browser connector enumerates all class pages before any teacher or planning navigation',async()=>{
 const b=browser(),r=await b.send('directory');assert.equal(r.data.classes.length,2);assert.equal(r.data.firstPageIds.length,1);assert.deepEqual(b.actions.map(a=>a.kind),['next']);assert.deepEqual(b.removed,[10]);
 assert.equal((await b.send('directory',null,'https://evil.example/')).ignored,true);
});
test('browser connector opens selected class, teacher and read-only plan to capture actual detail URL',async()=>{
 const b=browser(),teachers=await b.send('teachers',{classId:key,sourceUrl});assert.equal(teachers.data.teachers.length,1);
 const plans=await b.send('planning',{classId:key,assignmentId:'202:1',sourceUrl:teachers.data.sourceUrl,query:'agata'});assert.equal(plans.data.plans[0].url,base+'hplanejamentoaulaconsulta.aspx?direct');assert.equal(plans.data.name,'Ágata Fictícia');assert.deepEqual(b.actions.map(a=>a.kind),['class','teacher','plan']);assert.ok(b.removed.every(id=>id!==1));
});
test('connector rejects a response from a different class and validates full names before opening detail',async()=>{
 const b=browser(),wrong=await b.send('planning',{classId:key.replace(/11$/,'12'),assignmentId:'202:1',sourceUrl:base+'hplanejamentodisciplinasger.aspx?teacher'});assert.match(wrong.error,/turma confirmada/);
 const response=await b.send('planning',{classId:key,assignmentId:'202:1',sourceUrl:base+'hplanejamentodisciplinasger.aspx?teacher',query:'Ágata Outro sobrenome'});assert.equal(response.data.plans.length,0);assert.equal(b.actions.filter(a=>a.kind==='plan').length,0);
});
test('connector sends page progress and each consulted planning before its final response',async()=>{
 const b=browser();await b.send('directory');
 assert.deepEqual(b.messages.map(m=>m.progress.current),[1,2]);
 assert.ok(b.messages.every(m=>m.id==='request-directory'));
 b.messages.length=0;
 await b.send('planning',{classId:key,assignmentId:'202:1',sourceUrl:base+'hplanejamentodisciplinasger.aspx?teacher',query:'agata'});
 assert.deepEqual(b.messages.map(m=>m.progress.stage),['planning-list','opening-plan','plan-read']);
 const update=b.messages.at(-1);assert.equal(update.id,'request-planning');assert.equal(update.progress.current,1);assert.equal(update.progress.total,1);assert.equal(update.progress.plan.situation,'Planejamento finalizado');assert.equal(update.progress.plan.url,base+'hplanejamentoaulaconsulta.aspx?direct');
});

test('selective connector opens changed and new plans while skipping preserved records',async()=>{
 const b=browser();b.pages.plans.plans.push({...b.pages.plans.plans[0],id:'8',title:'Novo planejamento'});
 const result=await b.send('planning',{classId:key,assignmentId:'202:1',sourceUrl:base+'hplanejamentodisciplinasger.aspx?teacher',preservePlanIds:['7']});
 assert.equal(result.data.plans.length,2);assert.deepEqual(b.actions.filter(a=>a.kind==='plan').map(a=>a.id),['8']);assert.deepEqual(b.messages.filter(m=>m.progress.stage==='plan-read').map(m=>m.progress.plan.id),['8']);
});
