import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';

const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('});boot();','});');
const teacher={email:'teacher@example.test',name:'Docente fictício',role:'teacher'};
const school={name:'Escola fictícia',introduction:'Apresentação',address:'',phone:'',email:'',hours:'',version:2};
function page(role='teacher'){
 const {document,window}=parseHTML(html);
 window.HTMLElement.prototype.focus=function(){};
 window.HTMLElement.prototype.scrollIntoView=function(){};
 const Clock=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-13T15:00:00Z']))}};
 const user={...teacher,role};const calls=[];
 const data={me:user,users:[user],reservations:[],xerox:[],events:[],'fixed-occupancy':[],trainings:[],tasks:[],substitutions:[],auxiliaries:[],minutes:[],settings:{auxiliaryWeeklyLimit:32},notices:[],school};
 const context=vm.createContext({document,Date:Clock,Intl,FormData,setTimeout:()=>{},confirm:()=>true});
 const run=code=>vm.runInContext(code,context);
 context.testApi=async(path,method='GET',body)=>{calls.push({path,method,body});if(path.startsWith('auxiliaries/weekly?'))return {week:'2026-10-12',auxiliaries:[]};if(method!=='GET')return {ok:true};assert.ok(Object.hasOwn(data,path),'Unexpected endpoint '+path);return data[path]};
 run(script);run('api=testApi');
 const click=selector=>{const el=document.querySelector(selector);assert.ok(el,selector);el.dispatchEvent(new window.Event('click',{bubbles:true}))};
 const change=(selector,value)=>{const el=document.querySelector(selector);assert.ok(el,selector);Object.defineProperty(el,'value',{value,configurable:true});el.dispatchEvent(new window.Event('change',{bubbles:true}))};
 const save=async(type,index,values)=>{context.form=new FormData();for(const [key,value]of Object.entries(values))context.form.append(key,value);await run(`save(${JSON.stringify(type)},${index??'null'},form)`)};
 return {document,context,run,calls,data,click,change,save};
}

test('teacher boot loads only permitted resources and cannot navigate or open pedagogical actions',async()=>{
 const p=page();await p.run('boot()');
 assert.deepEqual(p.calls.map(x=>x.path).sort(),['me','reservations','xerox','events','fixed-occupancy','trainings'].sort());
 assert.deepEqual([...p.document.querySelectorAll('#nav [data-section]')].map(x=>x.dataset.section),['espacos','xerox','calendario','formacao']);
 assert.match(p.document.querySelector('#page').textContent,/Meus pedidos de reserva/);
 p.run("setPage('tarefas');modal('new-task')");
 assert.equal(p.run('state.section'),'espacos');assert.equal(p.document.querySelector('.modal'),null);
 p.run("state.section='supervisao';render()");assert.equal(p.run('state.section'),'espacos');
 p.click('[data-section="formacao"]');assert.match(p.document.querySelector('#page').textContent,/calendário de formação será disponibilizado/);
 assert.equal(p.document.querySelector('[data-action="new-training"]'),null);
 await p.run('refresh()');assert.ok(p.calls.every(x=>!['users','tasks','settings','minutes','notices','school','substitutions','auxiliaries'].includes(x.path)));
});

test('direction, supervision and guidance have the complete workspace and publishing tools',async()=>{
 for(const role of ['direction','supervision','guidance']){
  const p=page(role);await p.run('boot()');
  assert.equal(p.run('state.section'),'inicio');
  assert.equal(p.document.querySelectorAll('#nav [data-section]').length,10);
  assert.ok(p.document.querySelector('#nav [data-section="supervisao"]'));
  p.click('[data-section="comunicacao"]');assert.match(p.document.querySelector('#page').textContent,/Escola fictícia/);
  assert.ok(p.document.querySelector('[data-action="new-notice"]'));
  p.click('[data-action="school"]');assert.equal(p.document.querySelector('.modal').getAttribute('aria-label'),'Apresentação e contatos');
  p.run('closeModal()');p.click('[data-section="formacao"]');assert.ok(p.document.querySelector('[data-action="new-training"]'));
 }
});

test('teacher requests remain outside occupancy until approved and only own pending or refused requests are editable',async()=>{
 const p=page();
 p.data.reservations=[
  {id:'own-pending',owner:teacher.email,owner_name:teacher.name,space:'Biblioteca',date:'2026-10-13',start:'09:00',end:'10:00',purpose:'Pedido próprio',status:'Pendente',version:3},
  {id:'approved',owner:'',owner_name:'Outro docente',space:'Biblioteca',date:'2026-10-13',start:'10:00',end:'11:00',purpose:'Reserva confirmada',status:'Aprovada',version:1},
  {id:'own-refused',owner:teacher.email,space:'Biblioteca',date:'2026-10-14',start:'09:00',end:'10:00',purpose:'Pedido recusado',status:'Recusada',version:5}
 ];
 await p.run('boot()');
 assert.equal(p.run("spaceDayEntries('Biblioteca','2026-10-13').length"),1);
 assert.equal(p.run("spaceDayEntries('Biblioteca','2026-10-13')[0].id"),'approved');
 assert.ok(p.document.querySelector('[data-edit="reservations:0"]'));
 assert.equal(p.document.querySelector('[data-edit="reservations:1"]'),null);
 assert.ok(p.document.querySelector('[data-edit="reservations:2"]'));
 assert.equal(p.document.querySelector('[data-cancel-booking="approved"]'),null);
 p.click('[data-edit="reservations:2"]');assert.match(p.document.querySelector('#entryform').textContent,/Enviar para aprovação/);
 await p.save('edit-reservations',2,{space:'Biblioteca',date:'2026-10-14',start:'11:00',end:'12:00',responsible:teacher.name,purpose:'Novo horário'});
 const update=p.calls.find(x=>x.method==='PATCH');assert.equal(update.path,'reservations/own-refused');assert.equal(update.body.version,5);assert.equal(update.body.start,'11:00');
 assert.match(p.document.querySelector('#toastroot').textContent,/reenviado para aprovação/);
});

test('pedagogical approval uses status and version and displays server conflicts without confirming occupancy',async()=>{
 const p=page('supervision');
 p.data.reservations=[{id:'pending',owner:teacher.email,owner_name:teacher.name,space:'Biblioteca',date:'2026-10-13',start:'09:00',end:'10:00',purpose:'Encontro',status:'Pendente',version:7}];
 await p.run('boot()');p.click('[data-section="espacos"]');
 assert.ok(p.document.querySelector('[data-review-reservation="0"][data-status="Aprovada"]'));
 await p.run("reviewReservation(0,'Aprovada')");
 let update=p.calls.find(x=>x.method==='PATCH');assert.equal(update.path,'reservations/pending');assert.deepEqual(JSON.parse(JSON.stringify(update.body)),{status:'Aprovada',version:7});
 await p.run("reviewReservation(0,'Recusada')");update=p.calls.filter(x=>x.method==='PATCH').at(-1);assert.equal(update.body.status,'Recusada');
 p.run("api=async()=>{throw new Error('Conflito com horário fixo.')}");await p.run("reviewReservation(0,'Aprovada')");
 assert.match(p.document.querySelector('[role="alert"]').textContent,/Conflito com horário fixo/);
 assert.equal(p.run("spaceDayEntries('Biblioteca','2026-10-13').length"),0);assert.equal(p.run('busy'),false);
});

test('calendar distinguishes public and internal events and editing retains the original record after date sorting',async()=>{
 const p=page('guidance');
 p.data.events=[{id:'internal',title:'Conselho interno',date:'2026-11-01',type:'Reunião',visibility:'internal',version:4},{id:'public',title:'Encontro das famílias',date:'2026-10-13',type:'Evento escolar',visibility:'public',version:2}];
 await p.run('boot()');p.click('[data-section="calendario"]');
 p.change('[data-calendar-visibility]','public');assert.match(p.document.querySelector('#page').textContent,/Encontro das famílias/);assert.doesNotMatch(p.document.querySelector('#page').textContent,/Conselho interno/);
 p.click('[data-edit="events:1"]');assert.equal(p.document.querySelector('[name="visibility"]').value,'public');
 await p.save('edit-events',1,{title:'Encontro atualizado',date:'2026-10-13',type:'Evento escolar',visibility:'internal'});
 const update=p.calls.find(x=>x.method==='PATCH');assert.equal(update.path,'events/public');assert.equal(update.body.version,2);assert.equal(update.body.visibility,'internal');
});

test('formation filters by area and month, escapes notes, and validates paired optional times before saving',async()=>{
 const p=page('direction');
 p.data.trainings=[{id:'human',title:'Formação de humanas',area:'Humanas',date:'2026-11-09',start:'',end:'',location:'Escola',notes:'<img src=x onerror=alert(1)>',version:3},{id:'science',title:'Ciências em outubro',area:'Ciências',date:'2026-10-15',start:'08:00',end:'10:00',notes:'',version:1}];
 await p.run('boot()');p.click('[data-section="formacao"]');p.change('[data-training-area]','Humanas');
 assert.match(p.document.querySelector('#page').textContent,/Formação de humanas/);assert.doesNotMatch(p.document.querySelector('#page').textContent,/Ciências em outubro/);
 assert.equal(p.document.querySelector('#page img'),null);assert.match(p.document.querySelector('#page').textContent,/<img src=x/);
 p.change('[data-training-month]','2026-10');assert.match(p.document.querySelector('#page').textContent,/Nenhuma formação/);
 p.change('[data-training-month]','2026-11');p.click('[data-edit="trainings:0"]');
 await p.save('edit-trainings',0,{title:'Formação de humanas',area:'Humanas',date:'2026-11-09',start:'08:00',end:'',location:'Escola',notes:''});
 assert.match(p.document.querySelector('#formerror').textContent,/início e o término/);assert.equal(p.calls.filter(x=>x.method==='PATCH').length,0);
 await p.save('edit-trainings',0,{title:'Formação de humanas',area:'Humanas',date:'2026-11-09',start:'08:00',end:'10:00',location:'Escola',notes:''});
 const update=p.calls.find(x=>x.method==='PATCH');assert.equal(update.path,'trainings/human');assert.equal(update.body.version,3);assert.equal(update.body.end,'10:00');
});

test('publishing sends a boolean and school changes include the current version',async()=>{
 const p=page('direction');await p.run('boot()');p.click('[data-section="comunicacao"]');p.click('[data-action="new-notice"]');
 assert.equal(p.document.querySelector('[name="published"]').value,'false');
 await p.save('new-notice',null,{title:'Aviso fictício',date:'2026-10-13',body:'Texto público',published:'true'});
 assert.equal(p.calls.find(x=>x.path==='notices'&&x.method==='POST').body.published,true);
 p.click('[data-action="school"]');await p.save('school',null,{name:school.name,introduction:'Apresentação atualizada',address:'',phone:'',email:'',hours:''});
 const update=p.calls.find(x=>x.path==='school'&&x.method==='PATCH');assert.equal(update.body.version,2);assert.equal(update.body.introduction,'Apresentação atualizada');
});
