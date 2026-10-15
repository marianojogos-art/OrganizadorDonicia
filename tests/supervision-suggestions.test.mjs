import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {collectSupervision,snapshotAdapter} from '../src/supervision.mjs';
const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('});boot();','});');
const base='https://www.sgebr.net.br/sge8105/';
const directory={complete:true,sourceUrl:base+'classes.aspx',classes:[{id:'regular',name:'6º ano - 61-TURMA 61 - Matutino',url:base+'classes.aspx'}],firstPageIds:['regular']};
const teacher={id:'mat-123',assignmentId:'202:123',name:'Docente Fictícia',subject:'Professora auxiliar',url:base+'teacher.aspx'};
const plan={id:'p1',title:'Plano fictício',start:'2026-10-01',end:'2026-10-10',trimester:3,situation:'Em análise',url:base+'detail.aspx'};
const teachers={classId:'regular',complete:true,sourceUrl:base+'teacher.aspx',teachers:[teacher]};
const planning={classId:'regular',teacherId:teacher.id,assignmentId:teacher.assignmentId,name:teacher.name,complete:true,plans:[plan]};
const emptyReport={classes:[],teachers:[],coverage:[],complete:true,updatedAt:'2026-10-14T12:00:00Z',version:1};
function ui(){
 const {document,window}=parseHTML(html),context=vm.createContext({document,window,URL,Date,Intl,FormData,AbortController,setTimeout:()=>{}});
 vm.runInContext(script,context);Object.assign(context,{catalog:structuredClone(directory),teacherPage:structuredClone(teachers),planning:structuredClone(planning),report:structuredClone(emptyReport)});
 vm.runInContext("currentUser={role:'direction'};state.section='supervisao';supervision.directory=catalog;supervision.selected=new Set(['regular']);globalThis.calls=[];api=async(...args)=>{calls.push(args);return report};render()",context);
 return {context,document,window,run:code=>vm.runInContext(code,context)};
}
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function gate(context){let resolve,reject;context.gate=new Promise((yes,no)=>{resolve=yes;reject=no});return {resolve,reject}}
function click(ui,selector){ui.document.querySelector(selector).dispatchEvent(new ui.window.Event('click',{bubbles:true}))}

test('cancel before connector ping settles never starts traversal or a database save',async()=>{
 const u=ui(),g=gate(u.context);u.run("supervisionBridge=async command=>{calls.push(command);await gate;return {version:'1.3.1'}}");
 const pending=u.run('confirmSupervision()');click(u,'[data-supervision-cancel]');g.resolve();await pending;
 assert.deepEqual(Array.from(u.context.calls),['ping']);assert.equal(u.run('supervision.loading'),false);assert.match(u.document.querySelector('#page').textContent,/Consulta cancelada/);
});

test('cancel directory discards late progress and result without replacing existing catalog',async()=>{
 const u=ui(),g=gate(u.context);u.run("supervisionBridge=async(command,input,progress)=>{if(command==='ping')return {};globalThis.late=progress;await gate;return {...catalog,classes:[]}};");
 const pending=u.run('loadSupervisionClasses()');await turn();click(u,'[data-supervision-cancel]');
 const before=u.run('JSON.stringify(supervision.counts)');u.run("late({stage:'directory',classCount:999,current:9,total:9,schoolTotal:999})");g.resolve();await pending;
 assert.equal(u.run('JSON.stringify(supervision.counts)'),before);assert.equal(u.run('supervision.directory.classes.length'),1);assert.equal(u.context.calls.length,0);
});

test('cancel while reading teachers stops subsequent planning and excludes late errors from preview',async()=>{
 const u=ui(),g=gate(u.context);u.run("supervisionBridge=async command=>{calls.push(command);if(command==='ping')return {};await gate;return teacherPage}");
 const pending=u.run('confirmSupervision()');await turn();click(u,'[data-supervision-cancel]');g.reject(new Error('Late SGE failure'));
 await pending;assert.deepEqual(Array.from(u.context.calls),['ping','teachers']);assert.equal(u.run('supervision.counts.failures'),0);assert.doesNotMatch(u.document.querySelector('#page').textContent,/Late SGE failure/);
});

test('cancel freezes received preview, rejects late plans/progress and never posts a partial save',async()=>{
 const u=ui(),g=gate(u.context);u.run("supervisionBridge=async(command,input,progress)=>{if(command==='teachers')return teacherPage;if(command==='planning'){globalThis.late=progress;progress({stage:'plan-read',name:planning.name,current:1,total:2,plan:planning.plans[0]});await gate;return planning}};");
 const pending=u.run('confirmSupervision()');await turn();assert.equal(u.run('supervision.preview.size'),1);
 click(u,'[data-supervision-view="teachers"]');assert.ok(u.document.querySelector('[data-supervision-status]'));click(u,'[data-supervision-cancel]');
 u.run("late({stage:'plan-read',name:planning.name,current:2,total:2,plan:{...planning.plans[0],id:'late',title:'Late result'}})");
 const frozen=u.run('JSON.stringify([...supervision.preview])');g.resolve();await pending;
 assert.equal(u.run('JSON.stringify([...supervision.preview])'),frozen);assert.equal(u.run('supervision.counts.assignments'),0);assert.equal(u.context.calls.length,0);
 assert.match(u.document.querySelector('#page').textContent,/Consulta cancelada/);assert.doesNotMatch(u.document.querySelector('#page').textContent,/Late result/);
 // An old bridge callback cannot contaminate a later operation either.
 u.run("supervisionBridge=async(command)=>command==='teachers'?teacherPage:command==='planning'?planning:{}");await u.run('confirmSupervision()');
 const size=u.run('supervision.preview.size');u.run("late({stage:'plan-read',plan:{...planning.plans[0],id:'older'}})");assert.equal(u.run('supervision.preview.size'),size);assert.equal(u.context.calls.length,1);
});

test('cancel lock prevents another query until the already submitted connector request settles',async()=>{
 const u=ui(),g=gate(u.context);u.run("supervisionBridge=async command=>{calls.push(command);if(command==='ping')return {};await gate;return teacherPage}");
 const pending=u.run('confirmSupervision()');await turn();click(u,'[data-supervision-cancel]');await u.run('confirmSupervision()');await u.run('loadSupervisionClasses()');
 assert.deepEqual(Array.from(u.context.calls),['ping','teachers']);assert.equal(u.run('supervision.loading'),true);g.resolve();await pending;assert.equal(u.run('supervision.loading'),false);
});

test('once a save was submitted the UI cannot promise to undo it and preserves the returned revision',async()=>{
 const u=ui(),g=gate(u.context);u.run("supervisionBridge=async command=>command==='teachers'?teacherPage:command==='planning'?planning:{};api=async(...args)=>{calls.push(args);await gate;return report}");
 const pending=u.run('confirmSupervision()');await turn();assert.equal(u.context.calls.length,1);assert.equal(u.document.querySelector('[data-supervision-cancel]'),null);
 assert.match(u.document.querySelector('[data-supervision-status]').textContent,/envio já começou e não pode ser cancelado/);
 u.run('cancelSupervision()');assert.equal(u.run('supervision.cancelled'),false);g.resolve();await pending;assert.equal(u.run('supervision.saved.version'),1);
});

test('class groups exclude support and AEE classes without excluding auxiliary teacher assignments',async()=>{
 const u=ui();u.context.catalog.classes.push({id:'initial',name:'1º ano - 11-TURMA 11 - Matutino'},{id:'aee',name:'AEE - 1 - Matutino'},{id:'support',name:'Apoio - 2-TURMA APOIO - Vespertino'},{id:'unknown',name:'Etapa não identificada'});
 u.run('render()');assert.equal(u.document.querySelectorAll('[data-supervision-class]').length,3);assert.equal(u.document.querySelector('[data-supervision-class="support"]'),null);
 const labels=Array.from(u.document.querySelectorAll('#supervision-classes h3')).map(x=>x.textContent);assert.deepEqual(labels,['Anos finais','Anos iniciais','Outras turmas — conferir classificação']);
 assert.equal(u.run("supervisionClassGroup('Atendimento Educacional Especializado - 1 - Matutino')"),'aee');assert.equal(u.run("supervisionClassGroup('9° ano - 91 - Vespertino')"),'final');
 const source=structuredClone(directory);source.classes.push({id:'aee',name:'Turma AEE - 1 - Matutino',url:base+'classes.aspx'},{id:'support',name:'Apoio - 2 - Matutino',url:base+'classes.aspx'});
 const entries=[{path:'/classes/regular/teachers',data:teachers},{path:'/classes/regular/teachers/202%3A123/planning',data:planning}];
 const report=await collectSupervision({SGE:snapshotAdapter({directory:source,entries})},{classIds:['regular'],scope:'school',teacher:'docente'});
 assert.equal(report.classes.length,1);assert.equal(report.teachers[0].assignments[0].subject,'Professora auxiliar');assert.equal(report.teachers[0].plans.length,1);
 await assert.rejects(collectSupervision({SGE:snapshotAdapter({directory:source,entries})},{classIds:['support'],scope:'classes',teacher:''}),/turmas de apoio/);
});

test('shortcuts use only real returned situations, escape values and filter without mutating saved reports',()=>{
 const u=ui();u.context.report.teachers=[{id:teacher.id,name:teacher.name,assignments:[],plans:[{...plan,situation:'Solicitado ajuste <teste>',review:'check'},{...plan,id:'p2',situation:'Pendente de análise',review:'check'}],summary:{classes:[],total:2,situations:{},missingLinks:0}}];
 u.run('supervision.report=report;render()');const original=JSON.stringify(u.context.report);
 assert.deepEqual(Array.from(u.document.querySelectorAll('[data-supervision-quick-situation]')).map(x=>x.dataset.supervisionQuickSituation),['Pendente de análise','Solicitado ajuste <teste>']);assert.equal(u.document.querySelector('teste'),null);
 click(u,'[data-supervision-quick-situation]');assert.equal(u.run('supervision.situation'),'Pendente de análise');assert.equal(JSON.stringify(u.context.report),original);
 assert.ok(u.document.querySelector('[data-supervision-report]').textContent.includes('Conferir esta Situação no SGE'));
 u.run('supervision.report.teachers[0].plans=[];supervision.situation="";render()');assert.equal(u.document.querySelector('[data-supervision-quick-situation]'),null);
});


test('default trimester, group selection and compact labels preserve all identifiers',()=>{
 const u=ui();u.context.catalog.classes.push({id:'other-final',name:'7º ano - 71-TURMA 71 - Vespertino'},{id:'initial',name:'1º ano - 11-TURMA 11 - Matutino'},{id:'duplicate',name:directory.classes[0].name});u.run('render()');
 assert.equal(u.run('supervision.trimester'),1);assert.equal(u.document.querySelector('[data-supervision-trimester] option[selected]').getAttribute('value'),'1');
 click(u,'[data-supervision-category="final"]');assert.equal(u.run('supervision.selected.size'),3);assert.equal(u.run("supervision.selected.has('initial')"),false);
 click(u,'[data-supervision-category="final"]');assert.equal(u.run('supervision.selected.size'),0);
 click(u,'[data-supervision-category="initial"]');assert.equal(u.run("supervision.selected.has('initial')"),true);
 assert.match(u.document.querySelector('[data-supervision-class="regular"]').textContent,/regular/);assert.match(u.document.querySelector('[data-supervision-class="duplicate"]').textContent,/duplicate/);
 u.run('resetSupervision()');assert.equal(u.run('supervision.trimester'),1);
});

test('modal blocks navigation and repeated actions then releases site immediately on cancellation',async()=>{
 const u=ui(),g=gate(u.context);u.run("supervisionBridge=async command=>{calls.push(command);await gate;return {}};");
 const pending=u.run('confirmSupervision()');assert.ok(u.document.querySelector('[role=dialog][aria-modal=true]'));assert.ok(u.document.querySelector('main').closest('[inert]'));
 click(u,'[data-section="tarefas"]');u.run("setPage('notas')");assert.equal(u.run('state.section'),'supervisao');await u.run('confirmSupervision()');assert.equal(u.context.calls.length,1);
 click(u,'#supervision-operation-root [data-supervision-cancel]');assert.equal(u.document.querySelector('#supervision-operation-root'),null);assert.equal(u.document.querySelector('main').closest('[inert]'),null);
 u.run("setPage('tarefas')");assert.equal(u.run('state.section'),'tarefas');g.resolve();await pending;assert.equal(u.context.calls.length,1);
});

test('saved-data read is locally abortable and late results cannot replace an existing report',async()=>{
 const u=ui(),g=gate(u.context);u.run("supervision.saved={version:42};api=async(path,method,data,options)=>{globalThis.signal=options.signal;await gate;return report}");
 const pending=u.run('loadSavedSupervision()');assert.ok(u.document.querySelector('[data-supervision-cancel]'));click(u,'[data-supervision-cancel]');assert.equal(u.context.signal.aborted,true);
 g.resolve();await pending;assert.equal(u.run('supervision.saved.version'),42);assert.equal(u.document.querySelector('#supervision-operation-root'),null);assert.equal(u.run('supervision.loading'),false);
});
