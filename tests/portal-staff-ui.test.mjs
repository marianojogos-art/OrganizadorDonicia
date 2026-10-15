import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';

const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/boot\(\);\s*$/,'');
const teacher={email:'teacher@example.test',name:'Docente fictício',role:'teacher'};
const school={name:'Escola fictícia',introduction:'Apresentação',address:'',phone:'',email:'',hours:'',version:2};
function page(role='teacher',storage=new Map(),reminderStorage=new Map()){
 const {document,window}=parseHTML(html);
 window.HTMLElement.prototype.focus=function(){};
 window.HTMLElement.prototype.scrollIntoView=function(){};
 const Clock=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-13T15:00:00Z']))}};
 const user={...teacher,role};const calls=[];
 const data={'public-content':[],'staff-requests':[],'pedagogical-album':[],'resource-library':[],'resource-catalog':{items:[],categories:[]},me:user,users:[user],reservations:[],xerox:[],events:[],'fixed-occupancy':[],trainings:[],'official-trainings':{calendar:null,sessions:[]},tasks:[],substitutions:[],auxiliaries:[],minutes:[],settings:{auxiliaryWeeklyLimit:32},notices:[],school,notes:[]};
 const context=vm.createContext({localStorage:{getItem:key=>reminderStorage.get(key)??null,setItem:(key,value)=>reminderStorage.set(key,value)},sessionStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},document,Date:Clock,Intl,FormData,URLSearchParams,setTimeout:()=>{},confirm:()=>true});
 const run=code=>vm.runInContext(code,context);
 context.testApi=async(path,method='GET',body)=>{calls.push({path,method,body});if(path.startsWith('feedback?'))return {items:[],pages:[],total:0,offset:0,limit:30};if(path.startsWith('site-metrics?'))return data['site-metrics'];if(path.startsWith('auxiliaries/weekly?'))return {week:'2026-10-12',auxiliaries:[]};if(method!=='GET')return {ok:true};assert.ok(Object.hasOwn(data,path),'Unexpected endpoint '+path);return data[path]};
 run(script);run('api=testApi');
 const click=selector=>{const el=document.querySelector(selector);assert.ok(el,selector);el.dispatchEvent(new window.Event('click',{bubbles:true}))};
 const change=(selector,value)=>{const el=document.querySelector(selector);assert.ok(el,selector);Object.defineProperty(el,'value',{value,configurable:true});el.dispatchEvent(new window.Event('change',{bubbles:true}))};
 const save=async(type,index,values)=>{context.form=new FormData();for(const [key,value]of Object.entries(values))context.form.append(key,value);await run(`save(${JSON.stringify(type)},${index??'null'},form)`)};
 return {document,context,run,calls,data,click,change,save,storage,reminderStorage};
}

test('teacher boot loads only permitted resources and cannot navigate or open pedagogical actions',async()=>{
 const p=page();await p.run('boot()');
 assert.deepEqual(p.calls.map(x=>x.path).sort(),['me','reservations','xerox','events','fixed-occupancy','trainings','official-trainings','staff-requests'].sort());
 assert.deepEqual([...p.document.querySelectorAll('#nav [data-section]')].map(x=>x.dataset.section),['meu-dia','espacos','xerox','calendario','formacao','solicitacoes']);
 assert.equal(p.run('state.section'),'meu-dia');assert.match(p.document.querySelector('#page').textContent,/Seu dia/);
 p.run("setPage('tarefas');setPage('notas');modal('new-task');modal('new-note')");
 assert.equal(p.run('state.section'),'meu-dia');assert.equal(p.document.querySelector('.modal'),null);
 p.run("state.section='supervisao';render()");assert.equal(p.run('state.section'),'meu-dia');
 p.click('[data-section="formacao"]');assert.match(p.document.querySelector('#page').textContent,/calendário de formação será disponibilizado/);
 assert.equal(p.document.querySelector('[data-action="new-training"]'),null);
 await p.run('refresh()');assert.ok(p.calls.every(x=>!['users','tasks','settings','minutes','notices','school','substitutions','auxiliaries','notes'].includes(x.path)));
});

test('direction, supervision and guidance have the complete workspace and publishing tools',async()=>{
 for(const role of ['direction','supervision','guidance']){
  const p=page(role);await p.run('boot()');
  assert.equal(p.run('state.section'),'inicio');
  assert.equal(p.document.querySelectorAll('#nav [data-section]').length,17);
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
 await p.run('boot()');p.click('[data-section="espacos"]');
 assert.equal(p.run("spaceDayEntries('Biblioteca','2026-10-13').length"),1);
 assert.equal(p.run("spaceDayEntries('Biblioteca','2026-10-13')[0].id"),'approved');
 assert.ok(p.document.querySelector('[data-edit="reservations:0"]'));
 assert.equal(p.document.querySelector('[data-edit="reservations:1"]'),null);
 assert.ok(p.document.querySelector('[data-edit="reservations:2"]'));
 assert.equal(p.document.querySelector('[data-cancel-booking="approved"]'),null);
 p.click('[data-edit="reservations:2"]');assert.match(p.document.querySelector('#entryform').textContent,/Enviar para aprovação/);
 await p.save('edit-reservations',2,{space:'Biblioteca',date:'2026-10-14',start:'11:00',end:'12:00',responsible:teacher.name,purpose:'Novo horário',class:'Turma A',subject:'Ciências'});
 const update=p.calls.find(x=>x.method==='PATCH');assert.equal(update.path,'reservations/own-refused');assert.equal(update.body.version,5);assert.equal(update.body.start,'11:00');assert.equal(update.body.class,'Turma A');assert.equal(update.body.subject,'Ciências');
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


test('formation events remain one shared record with the training view and preserve details in calendar edits',async()=>{
 const p=page('guidance');
 const event={id:'shared',title:'Encontro integrado',date:'2026-10-13',type:'Evento escolar',formation:1,area:'Linguagens',start:'08:00',end:'10:00',location:'Sala de formação',details:'<img src=x>Orientações',visibility:'internal',version:6};
 p.data.events=[event,{id:'other',title:'Reunião comum',date:'2026-10-14',type:'Reunião',visibility:'internal',version:1}];
 p.data.trainings=[{...event,notes:event.details}];
 await p.run('boot()');p.click('[data-section="calendario"]');
 const filter=p.document.querySelector('[data-calendar-formation]');filter.checked=true;filter.dispatchEvent(new p.document.defaultView.Event('change',{bubbles:true}));
 assert.match(p.document.querySelector('#page').textContent,/Encontro integrado/);assert.doesNotMatch(p.document.querySelector('#page').textContent,/Reunião comum/);
 assert.match(p.document.querySelector('#page').textContent,/Sala de formação/);assert.equal(p.document.querySelector('#page img'),null);
 p.click('[data-edit="events:0"]');const typeSelect=p.document.querySelector('[name=type]');const selectedType=typeSelect.querySelector('option[selected]')||typeSelect.querySelector('option');assert.equal(selectedType.getAttribute('value'),'Formação');
 await p.save('edit-events',0,{title:event.title,date:event.date,type:'Formação',area:event.area,start:event.start,end:event.end,location:event.location,details:event.details,visibility:'internal'});
 const writes=p.calls.filter(x=>x.method!=='GET');assert.equal(writes.length,1);assert.equal(writes[0].path,'events/shared');assert.equal(writes[0].body.formation,true);assert.equal(writes[0].body.type,'Evento escolar');assert.equal(writes[0].body.version,6);
 p.click('[data-section="formacao"]');assert.equal(p.document.querySelectorAll('.training-entry').length,1);assert.ok(p.document.querySelector('[data-edit="trainings:0"]'));assert.equal(p.document.querySelector('#page img'),null);
});

test('xerox keeps professor, class, color and attachment operations in the teacher flow',async()=>{
 const p=page();await p.run('boot()');p.click('[data-section="xerox"]');p.click('[data-action="new-xerox"]');
 assert.ok(p.document.querySelector('[name=professor]'));assert.ok(p.document.querySelector('[name=color]'));assert.ok(p.document.querySelector('[name=file]'));assert.equal(p.document.querySelector('[name=class]').hasAttribute('required'),false);
 p.context.form=new FormData();for(const [key,value]of Object.entries({title:'Atividade',professor:teacher.name,class:'Turma A',color:'Colorido',copies:'12',deadline:'2026-10-15'}))p.context.form.append(key,value);
 p.context.form.append('file',new Blob(['%PDF-1.4'],{type:'text/csv; charset=utf-8'}),'atividade.pdf');
 p.context.FileReader=class{readAsDataURL(){this.result='data:application/pdf;base64,JVBERi0xLjQ=';this.onload()}};
 await p.run("save('new-xerox',null,form)");
 const created=p.calls.find(x=>x.path==='xerox'&&x.method==='POST');assert.equal(created.body.professor,teacher.name);assert.equal(created.body.class,'Turma A');assert.equal(created.body.color,'Colorido');assert.equal(created.body.copies,12);assert.equal(created.body.attachment.name,'atividade.pdf');assert.equal(created.body.file,undefined);
 p.data.xerox=[{id:'xerox',requester:teacher.email,requester_name:teacher.name,title:'Atividade',professor:teacher.name,class:'Turma A',color:'Colorido',copies:12,deadline:'2026-10-15',attachment_name:'atividade.pdf',status:'Devolvido para ajustes',version:4}];await p.run('refresh()');
 assert.equal(p.document.querySelector('a[href="/api/xerox/xerox/attachment"]').textContent,'Baixar atividade.pdf');
 p.click('[data-revise-xerox="0"]');assert.ok(p.document.querySelector('[name=remove_attachment]'));
 await p.save('revise-xerox',0,{title:'Atividade',professor:teacher.name,class:'Turma A',color:'Preto e branco',copies:'12',deadline:'2026-10-15',remove_attachment:'on'});
 const updated=p.calls.find(x=>x.path==='xerox/xerox'&&x.method==='PATCH');assert.equal(updated.body.remove_attachment,true);assert.equal(updated.body.resubmit,true);assert.equal(updated.body.version,4);
});

test('official SME formations are shared in Formation and Calendar, with a protected CSV and no school edit controls',async()=>{
 const p=page('direction');
 p.data['official-trainings']={calendar:{title:'Calendário SME outubro/2026',capturedAt:'2026-10-13',sourcePages:25,source:'https://docs.google.com/presentation/d/e/test/pub',portal:'https://sites.google.com/sme.pmf.sc.gov.br/portaleducacional/',unscheduled:[{area:'Matemática',group:'Grupo 1'}]},sessions:[{id:'sme-test',title:'História · Grupo 1',area:'História',date:'2026-10-14',start:'09:00',end:'12:00',location:'CEC',notes:'Encontro oficial',official:true,sourcePage:15,version:1}]};
 p.data.trainings=[{id:'school-test',title:'Encontro da escola',area:'História',date:'2026-10-16',start:'08:00',end:'10:00',location:'Escola',notes:'',version:1}];
 p.data.events=[{...p.data.trainings[0],formation:true,type:'Formação',visibility:'internal'}];
 await p.run('boot()');p.click('[data-section="formacao"]');
 assert.equal(p.document.querySelectorAll('.training-entry').length,2);
 assert.equal(p.document.querySelector('a[download]').getAttribute('href'),'/equipe/calendarios/formacao-outubro-2026.csv');
 assert.match(p.document.querySelector('#page').textContent,/Data e horário ainda não informados.*Matemática/);
 assert.ok(p.document.querySelector('[data-edit="trainings:0"]'));assert.equal(p.document.querySelector('[data-edit="trainings:1"]'),null);
 p.run("modal('edit-trainings',1)");assert.equal(p.document.querySelector('.modal'),null);
 p.click('[data-section="calendario"]');
 assert.match(p.document.querySelector('#page').textContent,/História · Grupo 1/);
 assert.equal(p.document.querySelector('[data-edit="events:1"]'),null);
 await p.run('refresh()');
 assert.equal(p.run('state.trainings.filter(x=>x.official).length'),1,'refresh does not duplicate the SME calendar');
});


test('teacher can request a message or materials without any external delivery or pedagogical access',async()=>{
 const p=page();p.data['staff-requests']=[{id:'own',requester:teacher.email,type:'message',title:'Mensagem fictícia',classes:'Turma fictícia',description:'Texto fictício',deadline:'2026-10-14',status:'Pendente',version:2}];await p.run('boot()');p.click('[data-section="solicitacoes"]');assert.match(p.document.querySelector('#page').textContent,/não envia mensagens externas/);assert.equal(p.document.querySelector('[data-request-status]'),null);assert.ok(p.document.querySelector('[data-edit="staff-requests:0"]'));
 p.click('[data-action="new-request"]');await p.save('new-request',null,{type:'material',title:'Material fictício',classes:'Turma fictícia',description:'Quantidade fictícia',deadline:'2026-10-15'});const write=p.calls.find(x=>x.method==='POST');assert.equal(write.path,'staff-requests');assert.equal(write.body.type,'material');assert.equal(p.document.querySelector('#nav [data-section="album"]'),null);
});
test('team agenda reuses internal events and links library stays within the pedagogical workspace',async()=>{
 const p=page('guidance');p.data.events=[{id:'a',title:'Interno fictício',date:'2026-10-13',type:'Reunião',visibility:'internal',version:1},{id:'b',title:'Público fictício',date:'2026-10-13',type:'Evento escolar',visibility:'public',version:1}];p.data['resource-catalog'].items=[{id:'bncc',title:'Referência fictícia',category:'bncc',url:'https://example.test/doc',description:'Fonte fictícia'}];await p.run('boot()');p.click('[data-section="agenda-equipe"]');assert.match(p.document.querySelector('#page').textContent,/Interno fictício/);assert.doesNotMatch(p.document.querySelector('#page').textContent,/Público fictício/);p.click('[data-action="new-team-event"]');assert.equal(p.document.querySelector('input[name="visibility"]').value,'internal');await p.save('new-team-event',null,{title:'Reunião fictícia',date:'2026-10-14',type:'Reunião',start:'',end:'',location:'',details:''});assert.equal(p.calls.find(x=>x.method==='POST').body.visibility,'internal');p.click('[data-section="biblioteca"]');assert.ok(p.document.querySelector('a[href="https://example.test/doc"]'));
});


test('site metrics panel is pedagogical-only, shows aggregates and sends selected UTC dates',async()=>{
 const p=page('direction');p.data['site-metrics']={from:'2026-10-07',to:'2026-10-13',totals:{views:10,estimatedVisits:3,sectionClicks:7,whatsappClicks:2},byDay:[{day:'2026-10-13',views:10,estimatedVisits:3,sectionClicks:7,whatsappClicks:2}],bySection:[{section:'whatsapp_secretaria',views:0,sectionClicks:0,whatsappClicks:2}]};await p.run('boot()');p.click('[data-section="metricas"]');await new Promise(resolve=>setImmediate(resolve));assert.match(p.document.querySelector('#page').textContent,/não pessoas únicas/);assert.match(p.document.querySelector('#page').textContent,/WhatsApp da secretaria/);assert.match(p.document.querySelector('#page').textContent,/10/);assert.equal(p.document.querySelectorAll('#page table').length,2);p.change('[data-metrics-from]','2026-10-10');p.click('[data-metrics-load]');await new Promise(resolve=>setImmediate(resolve));assert.ok(p.calls.at(-1).path.includes('from=2026-10-10'));const restricted=page();await restricted.run('boot()');restricted.run("setPage('metricas')");assert.equal(restricted.document.querySelector('#nav [data-section="metricas"]'),null);assert.ok(restricted.calls.every(call=>!call.path.startsWith('site-metrics')));
});


test('opening the metrics hash directly also fetches its initial aggregates',async()=>{const p=page('direction');p.data['site-metrics']={from:'2026-10-07',to:'2026-10-13',totals:{views:0,estimatedVisits:0,sectionClicks:0,whatsappClicks:0},byDay:[],bySection:[]};p.context.window={};p.context.location={hash:'#metricas'};await p.run('boot()');await new Promise(resolve=>setImmediate(resolve));assert.equal(p.run('state.section'),'metricas');assert.ok(p.calls.some(call=>call.path.startsWith('site-metrics?')));assert.match(p.document.querySelector('#page').textContent,/Visitas estimadas/)});


test('management can preview the six teacher sections and return without changing identity',async()=>{
 for(const role of ['direction','supervision','guidance']){
  const p=page(role);await p.run('boot()');p.run("setPage('tarefas')");
  assert.match(p.document.querySelector('[data-toggle-teacher-view]').textContent,/Visão de professor/);
  await p.run('toggleTeacherPreview()');
  assert.equal(p.run('currentUser.role'),role);assert.equal(p.run('hasPedagogicalAccess()'),true);
  assert.equal(p.document.querySelectorAll('#nav [data-section]').length,6,p.document.querySelector('#page').textContent);
  assert.match(p.document.querySelector('#view-switcher').textContent,/somente leitura/);
  assert.equal(p.run("allowedAction('new-task')"),false);
  p.run("modal('new-booking')");assert.equal(p.document.querySelector('#entryform button[type=submit]').disabled,true);
  const before=p.calls.length;await p.save('new-booking',null,{});assert.equal(p.calls.length,before);
  await p.run('toggleTeacherPreview()');assert.equal(p.run('state.section'),'tarefas');
  assert.equal(p.document.querySelectorAll('#nav [data-section]').length,17);
  assert.equal(p.run('currentUser.role'),role);
 }
 const teacherPage=page();await teacherPage.run('boot()');assert.equal(teacherPage.document.querySelector('[data-toggle-teacher-view]'),null);
});

test('preview projects management-wide lists onto own requests and approved occupancy',async()=>{
 const p=page('direction');p.data.reservations=[{id:'own',owner:teacher.email,status:'Pendente'},{id:'hidden',owner:'other@example.test',status:'Pendente'},{id:'public-occupancy',owner:'other@example.test',status:'Aprovada'}];
 p.data.xerox=[{id:'mine',requester:teacher.email},{id:'other',requester:'other@example.test'}];p.data['staff-requests']=[{id:'mine',requester:teacher.email},{id:'other',requester:'other@example.test'}];
 await p.run('boot()');await p.run('toggleTeacherPreview()');
 assert.equal(p.run('state.bookings.length'),2);assert.equal(p.run('state.bookings[1].ownerEmail'),'');
 assert.equal(p.run('state.xerox.length'),1);assert.equal(p.run('state.requests.length'),1);
 assert.equal(p.document.querySelector('[data-cancel-booking]'),null);
 assert.equal(p.run("canEditRecord('reservations',state.bookings[0])"),false);
 await p.run("cancelBooking('own')");assert.ok(p.calls.every(c=>c.method==='GET'));
});

test('preview survives reload in the same tab and cannot be restored for a teacher',async()=>{
 const p=page('direction');await p.run('boot()');p.run("setPage('calendario')");await p.run('toggleTeacherPreview()');
 const reload=page('direction',p.storage);await reload.run('boot()');assert.equal(reload.run('teacherPreview'),true);assert.equal(reload.run('currentUser.role'),'direction');
 await reload.run('toggleTeacherPreview()');assert.equal(reload.run('state.section'),'calendario');assert.equal(reload.storage.size,0);
 const forbidden=page('teacher',new Map([['staff-teacher-preview','{"section":"tarefas"}']]));await forbidden.run('boot()');assert.equal(forbidden.run('teacherPreview'),false);assert.equal(forbidden.storage.size,0);
});

test('repeated clicks cannot race a view transition and busy operations block switching',async()=>{
 const p=page('direction');await p.run('boot()');
 p.run('setBusy(true)');await p.run('toggleTeacherPreview()');assert.equal(p.run('teacherPreview'),false);assert.equal(p.document.querySelector('[data-toggle-teacher-view]').disabled,true);p.run('setBusy(false)');
 let release;const gate=new Promise(resolve=>{release=resolve});const original=p.context.testApi;
 p.context.gatedApi=async(...args)=>{if(args[0]==='reservations')await gate;return original(...args)};p.run('api=gatedApi');
 const first=p.run('toggleTeacherPreview()');await p.run('toggleTeacherPreview()');assert.equal(p.run('teacherPreview'),true);assert.equal(p.run('viewSwitching'),true);
 release();await first;assert.equal(p.run('viewSwitching'),false);assert.equal(p.calls.filter(c=>c.path==='reservations').length,2);
 await p.run('toggleTeacherPreview()');assert.equal(p.run('teacherPreview'),false);
});


test('contributions follows Library and published history survives an unavailable feedback service',async()=>{
 const p=page('direction');await p.run('boot()');
 const ids=[...p.document.querySelectorAll('#nav [data-section]')].map(el=>el.dataset.section);
 assert.equal(ids[ids.indexOf('biblioteca')+1],'contribuicoes');assert.equal(ids.filter(id=>id==='contribuicoes').length,1);
 p.run("setPage('contribuicoes')");await p.run('loadFeedback()');
 assert.equal(p.document.querySelectorAll('#published-updates li').length,3);
 assert.match(p.document.querySelector('#published-updates').textContent,/horário de Brasília/);
 assert.equal(p.document.querySelector('#published-updates time').getAttribute('datetime'),'2026-10-15T02:17:51Z');
 assert.match(p.document.querySelector('#published-updates time').textContent,/14\/10\/2026/);
 assert.match(p.document.querySelector('#published-updates').textContent,/produção ainda não foi validada/);
 p.context.failedFeedback=async()=>{throw Error('Acesso indisponível')};p.run('api=failedFeedback');await p.run('loadFeedback()');
 assert.match(p.document.querySelector('[role=alert]').textContent,/Acesso indisponível/);
 assert.equal(p.document.querySelectorAll('#published-updates li').length,3);
 assert.ok(p.calls.every(call=>call.method==='GET'));
});

test('pedagogical publishing tools keep projects separate from private album and send expiry and publication confirmation',async()=>{
 const p=page('direction');await p.run('boot()');p.click('[data-section="comunicacao"]');
 assert.ok(p.document.querySelector('[data-action="new-public-project"]'));assert.ok(p.document.querySelector('[data-action="new-public-document"]'));
 p.click('[data-action="new-public-project"]');assert.ok(p.document.querySelector('input[name="authorization_confirmed"]'));assert.ok(p.document.querySelector('input[name="image_alt"]'));
 await p.save('new-public-project',null,{kind:'project',title:'Projeto fictício',description:'Texto público',category:'Cultura',url:'',image_alt:'',published:'true',authorization_confirmed:'on'});
 const sent=p.calls.find(x=>x.path==='public-content'&&x.method==='POST');assert.equal(sent.body.published,true);assert.equal(sent.body.authorization_confirmed,true);assert.equal(sent.body.remove_attachment,false);
 p.click('[data-section="comunicacao"]');p.click('[data-action="new-notice"]');assert.ok(p.document.querySelector('input[name="expires_on"]'));
 await p.save('new-notice',null,{title:'Aviso fictício',body:'Texto',date:'2026-10-13',expires_on:'2026-10-20',published:'true'});
 assert.equal(p.calls.find(x=>x.path==='notices'&&x.method==='POST').body.expires_on,'2026-10-20');
});


test('Meu dia and the unified tracker show only the teacher own records with true service states',async()=>{
 const p=page();p.data.reservations=[
 {id:'mine',owner:teacher.email,space:'Biblioteca',date:'2026-10-14',start:'09:00',end:'10:00',purpose:'Leitura',status:'Aprovada',version:1},
 {id:'other',owner:'other@example.test',space:'Auditório',date:'2026-10-14',start:'09:00',end:'10:00',purpose:'Atividade de outra pessoa',status:'Aprovada',version:1}];
 p.data.xerox=[{id:'returned',requester:teacher.email,title:'Material para ajustar',copies:12,deadline:'2026-10-14',status:'Devolvido para ajustes',version:3},{id:'foreign',requester:'other@example.test',title:'Material de outro docente',copies:10,deadline:'2026-10-14',status:'Concluído'}];
 p.data['staff-requests']=[{id:'request',requester:teacher.email,type:'material',title:'Pedido em análise',classes:'Turma A',description:'Papel',deadline:'2026-10-14',status:'Em análise',version:1}];
 p.data.trainings=[{id:'future',title:'Formação futura',area:'Ciências',date:'2026-10-14',start:'08:00',end:'10:00'},{id:'past',title:'Formação passada',area:'História',date:'2026-10-12'}];
 await p.run('boot()');const pageText=p.document.querySelector('#page').textContent;
 assert.match(pageText,/Reserva próxima: Biblioteca/);assert.match(pageText,/Formação futura/);assert.match(pageText,/Ação necessária/);
 assert.doesNotMatch(pageText,/Atividade de outra pessoa|Material de outro docente|Formação passada/);
 p.click('[data-section="solicitacoes"]');assert.match(p.document.querySelector('#title').textContent,/Meus pedidos/);
 assert.equal(p.document.querySelectorAll('.teacher-order').length,3);
 p.change('[data-teacher-status]','Em análise');assert.equal(p.document.querySelectorAll('.teacher-order').length,1);assert.match(p.document.querySelector('.teacher-order').textContent,/Pedido em análise/);
 p.change('[data-teacher-status]','');p.change('[data-teacher-kind]','xerox');assert.equal(p.document.querySelectorAll('.teacher-order').length,1);
});
test('duplicating a closed request creates a new form without date, identity, approval or attachment and requires explicit save',async()=>{
 const p=page();p.data.xerox=[{id:'old',requester:teacher.email,title:'Atividade anterior',copies:15,class:'Turma A',color:'Colorido',professor:'Professor antigo',deadline:'2026-10-01',status:'Concluído',attachment_name:'arquivo.pdf',version:8}];
 await p.run('boot()');p.click('[data-section="xerox"]');const before=p.calls.filter(x=>x.method!=='GET').length;
 p.click('[data-duplicate-kind="xerox"]');
 assert.equal(p.document.querySelector('[name=deadline]').value,'');assert.equal(p.document.querySelector('[name=title]').value,'Atividade anterior');assert.equal(p.document.querySelector('[name=copies]').value,'15');
 assert.equal(p.document.querySelector('[name=professor]').value,teacher.name);assert.equal(p.document.querySelector('[name=color]').value,'Colorido');assert.equal(p.document.querySelector('[name=remove_attachment]'),null);
 assert.equal(p.calls.filter(x=>x.method!=='GET').length,before);
 await p.save('new-xerox',null,{title:'Atividade anterior',copies:'15',class:'Turma A',color:'Colorido',professor:teacher.name,deadline:'2026-10-16'});
 const sent=p.calls.find(x=>x.method==='POST');assert.equal(sent.path,'xerox');assert.equal(sent.body.id,undefined);assert.equal(sent.body.version,undefined);assert.equal(sent.body.status,undefined);assert.equal(sent.body.attachment,undefined);
 p.data.reservations=[{id:'old-booking',owner:teacher.email,space:'Auditório',purpose:'Reunião',date:'2026-10-01',start:'09:00',end:'10:00',class:'Turma A',status:'Aprovada',version:4}];
 p.data['staff-requests']=[{id:'old-material',requester:teacher.email,type:'material',title:'Mais papel',classes:'Turma A',description:'Pacote',deadline:'2026-10-01',status:'Concluída',version:2}];
 await p.run('refresh()');p.run("duplicateRequest('reservations',0)");assert.equal(p.document.querySelector('[name=date]').value,'');assert.equal(p.document.querySelector('[name=space]').value,'Auditório');assert.equal(p.document.querySelector('[name=responsible]').value,teacher.name);
 p.run('closeModal()');p.run("duplicateRequest('staff-requests',0)");assert.equal(p.document.querySelector('[name=type]').value,'material');assert.equal(p.document.querySelector('[name=deadline]').value,'');assert.equal(p.document.querySelector('[name=description]').value,'Pacote');
 p.run("closeModal();state.xerox[0].requesterEmail='other@example.test';duplicateRequest('xerox',0)");assert.equal(p.document.querySelector('.modal'),null);
});
test('day and week availability include approved and fixed occupancy, ignore pending orders and retain approval on a free-slot request',async()=>{
 const p=page();p.data.reservations=[{id:'busy',owner:'other@example.test',space:'Biblioteca',date:'2026-10-13',start:'09:00',end:'10:00',status:'Aprovada'},{id:'pending',owner:teacher.email,space:'Biblioteca',date:'2026-10-13',start:'11:00',end:'12:00',status:'Pendente'}];
 p.data['fixed-occupancy']=[{id:'fixed',space:'Biblioteca',weekday:2,start:'10:00',end:'11:00',from_date:'2026-10-01',to_date:'2026-10-31',purpose:'Uso fixo'}];
 await p.run('boot()');p.click('[data-section="espacos"]');p.click('[data-agenda-view="day"]');assert.match(p.document.querySelector('#space-agenda').getAttribute('aria-label'),/diária/);
 p.change('[data-availability-start]','09:30');p.change('[data-availability-end]','10:30');p.click('[data-availability-check]');assert.match(p.document.querySelector('.availability-result').textContent,/Ocupado/);assert.match(p.document.querySelector('.availability-result').textContent,/Horário fixo/);assert.equal(p.document.querySelector('[data-availability-book]'),null);
 p.change('[data-availability-start]','11:00');p.change('[data-availability-end]','12:00');p.click('[data-availability-check]');assert.match(p.document.querySelector('.availability-result').textContent,/Livre/);
 const before=p.calls.filter(x=>x.method!=='GET').length;p.click('[data-availability-book]');assert.equal(p.document.querySelector('[name=start]').value,'11:00');assert.equal(p.document.querySelector('[name=date]').value,'2026-10-13');assert.match(p.document.querySelector('#entryform').textContent,/aprovação/);assert.equal(p.calls.filter(x=>x.method!=='GET').length,before);
 p.run('closeModal()');p.click('[data-agenda-view="week"]');assert.equal(p.document.querySelectorAll('.agenda-day-detail').length,7);
 p.change('[data-availability-date]','2026-02-30');assert.match(p.document.querySelector('#space-agenda').textContent,/data válida/);
});
test('formation reminders survive reload per account, compare official and local changes, and do not mark natural aging as a change',async()=>{
 const p=page();const local={id:'local',title:'Encontro da escola',area:'Ciências',date:'2026-10-14',start:'08:00',end:'10:00',location:'Sala A',notes:''};
 p.data.trainings=[local,{id:'past',title:'Já passou',date:'2026-10-12',area:'História'}];p.data['official-trainings'].sessions=[{...local,id:'sme',official:true,title:'Encontro SME'}];
 await p.run('boot()');assert.equal(p.run('formationChanges.length'),0);
 p.data.trainings=[{...local,start:'09:00'}];p.data['official-trainings'].sessions=[{...local,id:'sme',official:true,title:'Encontro SME',location:'Sala B'}];await p.run('refresh()');
 assert.equal(p.run('formationChanges.length'),2);assert.match(p.document.querySelector('.teacher-reminders').textContent,/Alterada: Encontro SME/);
 const reload=page('teacher',new Map(),p.reminderStorage);reload.data.trainings=p.data.trainings;reload.data['official-trainings']=p.data['official-trainings'];await reload.run('boot()');assert.equal(reload.run('formationChanges.length'),2);
 reload.click('[data-formation-seen]');assert.equal(reload.run('formationChanges.length'),0);
 reload.data.trainings=[];reload.data['official-trainings'].sessions=[];await reload.run('refresh()');assert.equal(reload.run('formationChanges.length'),2);assert.match(reload.document.querySelector('.teacher-reminders').textContent,/Retirada da agenda/);
 reload.context.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-16T15:00:00Z']))}};await reload.run('refresh()');assert.equal(reload.run('formationChanges.length'),0,'past formations roll off without spurious alerts');
 reload.run("currentUser.email='other@example.test';updateFormationReminders()");assert.equal(reload.run('formationChanges.length'),0);
});
test('teacher preview does not write reminder preferences and storage failure keeps the current session usable',async()=>{
 const p=page('direction');await p.run('boot()');await p.run('toggleTeacherPreview()');assert.equal(p.reminderStorage.size,0);assert.equal(p.run('state.section'),'meu-dia');p.run("acknowledgeFormationChanges();duplicateRequest('xerox',0)");assert.equal(p.reminderStorage.size,0);assert.equal(p.document.querySelector('.modal'),null);
 const q=page();q.context.localStorage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};await q.run('boot()');assert.equal(q.run('state.section'),'meu-dia');assert.match(q.document.querySelector('.teacher-reminders').textContent,/apenas nesta sessão/);assert.equal(q.document.querySelector('[data-retry-boot]'),null);
});
