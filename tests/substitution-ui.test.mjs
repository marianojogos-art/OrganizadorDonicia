import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';

const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('});boot();','});');
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
test('absence form adds and removes date fields, saves one batch, and refuses duplicates',async()=>{
 const {document,context,event}=page();context.calls=[];
 vm.runInContext("api=async(...args)=>{calls.push(args);return {ok:true}};refresh=async()=>{};toast=()=>{}",context);
 vm.runInContext("modal('new-sub')",context);
 const add=document.querySelector('[data-add-absence-date]');event(add,'click');event(add,'click');assert.equal(document.querySelectorAll('[name=extraDate]').length,2);
 event(document.querySelector('[data-remove-absence-date]'),'click');assert.equal(document.querySelectorAll('[name=extraDate]').length,1);
 const form=new FormData();for(const [key,value]of Object.entries({date:'2026-10-05',teacher:'Ágata',class:'Turma fictícia',start:'08:00',end:'08:45',auxiliary:'a'}))form.append(key,value);form.append('extraDate','2026-10-06');context.form=form;
 await vm.runInContext("save('new-sub',null,form)",context);assert.equal(context.calls.length,1);assert.equal(context.calls[0][0],'substitutions');assert.deepEqual(Array.from(context.calls[0][2].dates),['2026-10-05','2026-10-06']);assert.equal(context.calls[0][2].auxiliary,'a');
 vm.runInContext("modal('new-sub')",context);form.set('extraDate','2026-10-05');await vm.runInContext("save('new-sub',null,form)",context);assert.equal(context.calls.length,1);assert.match(document.querySelector('#formerror').textContent,/dias distintos/);
});
test('weekly report exposes realized and scheduled totals, history and selected-week navigation',async()=>{
 const {document,context,event}=page();context.calls=[];
 vm.runInContext(`state.weekly={week:'2026-10-05',limit:32,auxiliaries:[{id:'a',name:'Ana (fictícia)',active:1,total:3,completed:2,scheduled:1,remaining:29,lessons:[{date:'2026-10-05',start:'08:00',end:'08:45',class:'Turma A',teacher:'Ágata',completed:1}]}]};state.section='substituicoes';render();api=async(...args)=>{calls.push(args);return {week:'2026-10-12',limit:32,auxiliaries:[]}}`,context);
 assert.match(document.querySelector('#page').textContent,/Realizadas/);assert.match(document.querySelector('#page').textContent,/Agendadas/);assert.match(document.querySelector('#page').textContent,/3 \/ 32/);assert.match(document.querySelector('details').textContent,/Ágata/);
 event(document.querySelector('[data-week-step="7"]'),'click');await vm.runInContext('Promise.resolve().then(()=>Promise.resolve())',context);assert.equal(context.calls[0][0],'auxiliaries/weekly?date=2026-10-12');assert.equal(document.querySelector('[data-substitution-week]').value,'2026-10-12');
});
