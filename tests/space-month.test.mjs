import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('});boot();','});');
function page(){
 const {document,window}=parseHTML(html);let active=null;
 window.HTMLElement.prototype.focus=function(){active=this};
 const context=vm.createContext({document,Date,Intl,FormData,setTimeout:()=>{}});
 vm.runInContext(script,context);
 vm.runInContext("currentUser={email:'demo@example.test',name:'Pessoa fictícia',role:'direction'};users=[currentUser];state.section='espacos';agendaDate='2026-10-10';agendaWeek=weekOf(agendaDate);render()",context);
 const click=selector=>{const el=document.querySelector(selector);assert.ok(el,selector);el.dispatchEvent(new window.Event('click',{bubbles:true}))};
 const change=(selector,value)=>{const el=document.querySelector(selector);Object.defineProperty(el,'value',{value,configurable:true});el.dispatchEvent(new window.Event('change',{bubbles:true}))};
 return {document,context,click,change,active:()=>active};
}
test('monthly calendar aligns Monday first and handles leap years and year boundaries',()=>{
 const {context}=page();
 for(const [month,count,offset] of [['2024-02',29,3],['2025-02',28,5],['2026-11',30,6],['2027-02',28,0],['2026-12',31,1]]){
  const days=JSON.parse(vm.runInContext(`JSON.stringify(agendaMonthDays('${month}-01'))`,context));
  assert.equal(days.length,count+offset);assert.equal(days.filter(Boolean).length,count);
  assert.equal(days[offset],month+'-01');assert.equal(days.at(-1),month+'-'+count);
 }
 assert.equal(vm.runInContext("shiftAgendaMonth('2026-12-31',1)",context),'2027-01-01');
 assert.equal(vm.runInContext("shiftAgendaMonth('2027-01-31',-1)",context),'2026-12-01');
 assert.equal(vm.runInContext("shiftAgendaMonth('2024-03-31',-1)",context),'2024-02-01');
});
test('month includes matching reservations and valid recurring occupancy; selected day escapes details',()=>{
 const {context,document,click,change}=page();
 vm.runInContext(`state.bookings=[{space:'Biblioteca',date:'2026-10-05',start:'10:00',end:'11:00',purpose:'<img src=x>',responsible:'<script>nome</script>'},{space:'Auditório',date:'2026-10-05',start:'08:00',end:'09:00',purpose:'Outro espaço'}];state.fixed=[{space:'Biblioteca',weekday:1,start:'09:00',end:'10:00',from_date:'2026-10-05',to_date:'2026-10-12',purpose:'Leitura semanal'}]`,context);
 click('[data-agenda-view="month"]');
 assert.match(document.querySelector('[data-agenda-day="2026-10-05"]').getAttribute('aria-label'),/2 agendamentos/);
 assert.match(document.querySelector('[data-agenda-day="2026-10-12"]').getAttribute('aria-label'),/1 agendamento/);
 assert.match(document.querySelector('[data-agenda-day="2026-10-19"]').getAttribute('aria-label'),/sem agendamentos/);
 click('[data-agenda-day="2026-10-05"]');
 const detail=document.querySelector('#agenda-selected-day');
 assert.match(detail.textContent,/Leitura semanal/);assert.match(detail.textContent,/<img src=x>/);
 assert.equal(detail.querySelector('img,script'),null);assert.ok(detail.textContent.indexOf('09:00')<detail.textContent.indexOf('10:00–11:00'));
 change('[data-agenda-space]','Auditório');
 assert.match(document.querySelector('#agenda-selected-day').textContent,/Outro espaço/);
 assert.doesNotMatch(document.querySelector('#agenda-selected-day').textContent,/Leitura semanal/);
 click('[data-agenda-day="2026-10-06"]');assert.match(document.querySelector('#agenda-selected-day').textContent,/Nenhuma reserva ou horário fixo/);
});
test('month controls preserve selection, restore focus and prefill booking with chosen space and date',()=>{
 const {context,document,click,change,active}=page();
 click('[data-agenda-view="month"]');assert.equal(active().dataset.agendaView,'month');
 change('[data-agenda-month]','2026-12');click('[data-agenda-step="1"]');
 assert.equal(document.querySelector('[data-agenda-month]').getAttribute('value'),'2027-01');assert.equal(active().dataset.agendaStep,'1');
 click('[data-agenda-step="-1"]');click('[data-agenda-day="2026-12-31"]');
 assert.equal(active().dataset.agendaDay,'2026-12-31');
 click('[data-agenda-view="week"]');assert.equal(document.querySelector('[data-agenda-week]').getAttribute('value'),'2026-12-28');
 click('[data-agenda-view="month"]');assert.equal(document.querySelector('[data-agenda-day="2026-12-31"]').getAttribute('aria-pressed'),'true');
 change('[data-agenda-space]','Auditório');click('[data-agenda-book="2026-12-31"]');
 assert.equal(document.querySelector('#entryform input[name=date]').value,'2026-12-31');
 assert.equal(document.querySelector('#entryform select[name=space] option').textContent,'Auditório');
 vm.runInContext('closeModal()',context);click('[data-agenda-current]');
 assert.equal(vm.runInContext('agendaDate===schoolDate()',context),true);
 assert.equal(document.querySelector('[aria-current="date"]').getAttribute('aria-pressed'),'true');
 const previous=vm.runInContext('agendaDate',context);change('[data-agenda-month]','');assert.equal(vm.runInContext('agendaDate',context),previous);
 click('[data-agenda-view="week"]');const week=vm.runInContext('agendaWeek',context);click('[data-agenda-step="1"]');assert.equal(vm.runInContext('agendaWeek',context),vm.runInContext(`shiftAgendaDate('${week}',7)`,context));
});
