import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {parseSchoolGrade} from '../src/teachers.mjs';
import {makeSubstitutionPlan} from '../src/substitution-plan.mjs';

const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('});boot();','});');
const grade=parseSchoolGrade(await readFile(new URL('./fixtures/webhorario-grade.html',import.meta.url),'utf8'));
const directory={teachers:grade.names,schedule:grade.schedule,sourceVersion:grade.sourceVersion,updatedAt:'2026-10-05T16:00:00Z',stale:false};
function page(){
 const {document,window}=parseHTML(html);let active=null;
 Object.defineProperty(document,'activeElement',{get:()=>active});
 window.HTMLElement.prototype.focus=function(){active=this;this.dispatchEvent(new window.Event('focus'))};
 window.HTMLElement.prototype.scrollIntoView=function(){};
 const Clock=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-05T16:00:00Z']))}};
 const context=vm.createContext({document,Date:Clock,Intl,FormData,setTimeout:()=>{},confirm:()=>true});
 vm.runInContext(script,context);
 vm.runInContext(`currentUser={email:'direction.demo@prof.pmf.sc.gov.br',role:'direction'};users=[currentUser];state.teachers=['Ágata','Agnes','Josiane','Karol','<img src=x>'];state.aux=[{id:'a',name:'Ana (fictícia)',active:1,version:1},{id:'b',name:'Beatriz (fictícia)',active:1,version:1},{id:'c',name:'Carla (fictícia)',active:1,version:1}];state.subs=[]`,context);
 function event(element,type,key){const event=new window.Event(type,{bubbles:true,cancelable:true});if(key)Object.defineProperty(event,'key',{value:key});element.dispatchEvent(event);return event}
 return {document,context,event};
}
test('teacher combobox filters accents, selects by keyboard and shows the current day',()=>{
 const {document,context,event}=page();vm.runInContext("modal('new-sub')",context);
 const input=document.querySelector('#teacher-input');assert.equal(document.querySelector('input[name=date]').value,'2026-10-05');
 assert.equal(document.querySelectorAll('#teacher-options [role=option]').length,5);assert.equal(document.querySelector('#teacher-options img'),null);
 input.value='ag';event(input,'input');assert.equal(document.querySelectorAll('#teacher-options [role=option]').length,2);
 event(input,'keydown','ArrowDown');assert.equal(input.getAttribute('aria-activedescendant'),'teacher-option-0');
 event(input,'keydown','Enter');assert.equal(input.value,'Ágata');assert.equal(input.getAttribute('aria-expanded'),'false');
 input.value='ka';event(input,'input');event(input,'keydown','ArrowUp');event(input,'keydown','Enter');assert.equal(input.value,'Karol');
 input.value='jo';event(input,'input');event(input,'keydown','Escape');assert.equal(input.getAttribute('aria-expanded'),'false');assert.ok(document.querySelector('.modal'));
});
function selectValue(select,value){for(const option of select.querySelectorAll('option')){if(option.getAttribute('value')===value)option.setAttribute('selected','');else option.removeAttribute('selected')}}
test('additional-day count shows total, previews grade lessons and supports bulk and individual auxiliaries',async()=>{
 const {document,context,event}=page();context.calls=[];
 context.planApi=async(path,method,data)=>{context.calls.push([path,method,data]);if(path.startsWith('substitutions/preview?')){const params=new URLSearchParams(path.split('?')[1]);context.pending=makeSubstitutionPlan(directory,params.get('teacher'),params.get('date'),Number(params.get('extraDays'))).then(plan=>({...plan,limit:32}));return context.pending}return {ok:true}};
 vm.runInContext("api=planApi;refresh=async()=>{};toast=()=>{};modal('new-sub')",context);
 assert.equal(document.querySelector('[name=extraDate]'),null);assert.equal(document.querySelector('[name=class]'),null);assert.match(document.querySelector('#absence-total').textContent,/Total: 1 dia/);
 const teacher=document.querySelector('#teacher-input');teacher.value='Ágata';event(teacher,'change');await context.pending;await new Promise(setImmediate);
 assert.equal(document.querySelectorAll('[data-plan-aux]').length,2);assert.ok([...document.querySelectorAll('[data-plan-aux]')].every(select=>select.value==='a'));
 const count=document.querySelector('#extra-days');selectValue(count,'2');event(count,'change');await context.pending;await new Promise(setImmediate);
 assert.match(document.querySelector('#absence-total').textContent,/Total: 3 dias/);assert.equal(document.querySelectorAll('[data-plan-aux]').length,4);assert.match(document.querySelector('#absence-plan').textContent,/14:30–15:15/);
 let row=document.querySelectorAll('[data-plan-aux]')[1];selectValue(row,'b');event(row,'change');assert.match(document.querySelector('#auxiliary-load').textContent,/Beatriz/);
 const master=document.querySelector('[data-auxiliary-picker]');selectValue(master,'c');event(master,'change');assert.ok([...document.querySelectorAll('[data-plan-aux]')].every(select=>select.value==='c'));
 row=document.querySelectorAll('[data-plan-aux]')[1];selectValue(row,'b');event(row,'change');
 const form=new FormData();for(const [key,value]of Object.entries({date:'2026-10-05',extraDays:'2',teacher:'Ágata',auxiliary:'c'}))form.append(key,value);context.form=form;
 await vm.runInContext("save('new-sub',null,form)",context);const saved=context.calls.find(call=>call[0]==='substitutions/from-schedule');assert.ok(saved);assert.equal(saved[2].extraDays,2);assert.equal(saved[2].auxiliary,'c');assert.deepEqual(JSON.parse(JSON.stringify(saved[2].overrides)),[{key:'2026-10-05:1',auxiliary:'b'}]);assert.equal(saved[2].class,undefined);assert.equal(saved[2].start,undefined);
});
test('weekly table changes the auxiliary of one lesson directly, with its version',async()=>{
 const {document,context,event}=page();context.calls=[];
 vm.runInContext("state.section='substituicoes';state.subs=[{id:'lesson-1',version:4,date:iso,week:weekOf(iso),start:'07:30',end:'08:15',slot:'07:30–08:15',class:'71',teacher:'Ágata',auxiliary:'a',aux:'Ana (fictícia)',completed:0,status:'Agendada'}];api=async(...args)=>{calls.push(args);return {ok:true}};refresh=async()=>{};toast=()=>{};render()",context);
 const picker=document.querySelector('[data-assign-lesson]');assert.ok(picker);selectValue(picker,'b');event(picker,'change');await Promise.resolve();await Promise.resolve();
 assert.equal(context.calls[0][0],'substitutions/lesson-1');assert.equal(context.calls[0][2].auxiliary,'b');assert.equal(context.calls[0][2].version,4);
});
test('weekly report exposes realized and scheduled totals, history and selected-week navigation',async()=>{
 const {document,context,event}=page();context.calls=[];
 vm.runInContext(`state.weekly={week:'2026-10-05',limit:32,auxiliaries:[{id:'a',name:'Ana (fictícia)',active:1,total:3,completed:2,scheduled:1,remaining:29,lessons:[{date:'2026-10-05',start:'08:00',end:'08:45',class:'Turma A',teacher:'Ágata',completed:1}]}]};state.section='substituicoes';render();api=async(...args)=>{calls.push(args);return {week:'2026-10-12',limit:32,auxiliaries:[]}}`,context);
 assert.match(document.querySelector('#page').textContent,/Realizadas/);assert.match(document.querySelector('#page').textContent,/Agendadas/);assert.match(document.querySelector('#page').textContent,/3 \/ 32/);assert.match(document.querySelector('details').textContent,/Ágata/);
 event(document.querySelector('[data-week-step="7"]'),'click');await vm.runInContext('Promise.resolve().then(()=>Promise.resolve())',context);assert.equal(context.calls[0][0],'auxiliaries/weekly?date=2026-10-12');assert.equal(document.querySelector('[data-substitution-week]').value,'2026-10-12');
});
