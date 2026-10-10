import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseSgeClasses,parseSgeTeachers,parseSgePlans} from '../src/sge-pages.mjs';
import {collectSupervision,snapshotAdapter,planningTrimester,situationReview} from '../src/supervision.mjs';
import {handle} from '../src/worker.mjs';
import {sqlite} from '../scripts/sqlite-adapter.mjs';
const base='https://www.sgebr.net.br/sge8105/',key='106801:2026:9135:1:1:11';
const input=(name,value)=>`<input type="hidden" name="${name}" value="${value}">`;
const doc=(body,page='hplanejamentoaulager.aspx')=>parseHTML(`<form id="MAINFORM" ACTION="${page}?opaque">${body}</form>`).document;
const fields=(obj,suffix='')=>Object.entries(obj).map(([k,v])=>input(k+suffix,v)).join('');
const classFields={UECOD:'106801',CURANO:'2026',GRACOD:'9135',TRNCOD:'1',SECNUM:'1',TURNUM:'11'};

test('SGE parsers preserve pagination, teacher registrations, status titles and dates without CPFs',()=>{
 const classes=parseSgeClasses(doc(`<table id="GRIDTURMA"><tr>${fields({...classFields,_WVAR:'1º ano - Turma 11'},'_0001')}</tr></table>${fields({_ATUAL:1,_FINAL:2,_CONT:31})}`,'hselgerenciamentoplanoaula.aspx'),base);
 assert.equal(classes.classes[0].id,key);assert.equal(classes.complete,false);assert.equal(classes.total,31);assert.equal(classes.pagination.last,2);
 const teachers=parseSgeTeachers(doc(`${fields({TURCOD:'Turma 11',TURNUM:'11',GRACOD:'9135',SECNUM:'1'})}<table id="GRIDDISCIPLINA"><tr>${fields({DISCOD:'202',DISCODNOM:'202-LÍNGUA PORTUGUESA',_SERNOMPROF1:'ANA',_SERMATPROF1:'123',_SERCPFPROF1:'sensitive-cpf',_SERNOMPROF2:'ANA',_SERMATPROF2:'456'},'_0001')}</tr></table>`,'hplanejamentodisciplinasger.aspx'),base);
 assert.equal(teachers.teachers.length,2);assert.notEqual(teachers.teachers[0].id,teachers.teachers[1].id);assert.ok(!JSON.stringify(teachers).includes('sensitive-cpf'));
 const plans=parseSgePlans(doc(`${fields({DISCODNOM:'202-LÍNGUA PORTUGUESA'})}<span id="TITULO">Planejamento de 202-LÍNGUA PORTUGUESA - ANA FICTÍCIA</span><table id="GRIDPLANEJADO"><tr>${fields({...classFields,DISCOD:'202',PLAULASEQ:'7',_PERIODOPLANO:'Período',PLAULADTINICIO:'05/10/2026',PLAULADTFIM:'16/10/2026',PLAULANUMAULAS:'12',PLAULACPFPROF:'sensitive-cpf'},'_0001')}<img id="_SITUACAO_0001" title="Não enviado para análise" src="FundoVerde.png"></tr></table>`),base);
 assert.equal(plans.teacherName,'ANA FICTÍCIA');assert.equal(plans.plans[0].situation,'Não enviado para análise');assert.equal(plans.plans[0].start,'2026-10-05');assert.equal(plans.plans[0].url,null);assert.ok(!JSON.stringify(plans).includes('sensitive-cpf'));
});
test('configured trimester boundaries preserve February and cross-term records for review',()=>{
 assert.equal(planningTrimester('2026-03-01','2026-05-31'),1);assert.equal(planningTrimester('2026-06-01','2026-09-30'),2);assert.equal(planningTrimester('2026-10-01','2026-12-31'),3);
 assert.equal(planningTrimester('2026-02-11','2026-02-27'),null);assert.equal(planningTrimester('2026-05-25','2026-06-05'),null);assert.throws(()=>planningTrimester('2026-02-30','2026-03-05'));
 assert.equal(situationReview('Planejamento finalizado').review,'approved');assert.equal(situationReview('Não enviado para análise').review,'attention');assert.equal(situationReview('Em análise').review,'analysis');assert.equal(situationReview('Outra situação').review,'check');
});
function fixture(){
 const second=key.replace(/11$/,'12'),classes=[{id:key,name:'Turma 11',url:base+'classes.aspx'},{id:second,name:'Turma 12',url:base+'classes.aspx'}];
 const directory={classes,firstPageIds:[key],sourceUrl:base+'classes.aspx',complete:true},entries=[];
 for(const c of classes){const path='/classes/'+encodeURIComponent(c.id)+'/teachers';entries.push({path,data:{classId:c.id,complete:true,teachers:[{id:'mat-1',assignmentId:'202:1',name:'Ágata',subject:'Português',url:base+'teachers.aspx'},{id:'mat-2',assignmentId:'202:2',name:'Outra',subject:'Português',url:base+'teachers.aspx'}]}});entries.push({path:path+'/202%3A1/planning',data:{classId:c.id,teacherId:'mat-1',assignmentId:'202:1',name:'Ágata Fictícia',complete:true,plans:[{id:'1',title:'Período de outubro',start:'2026-10-05',end:'2026-10-16',trimester:null,situation:c.id===key?'Planejamento finalizado':'Não enviado para análise',url:c.id===key?base+'detail.aspx?opaque':null}]}})}
 return {snapshot:{directory,entries},input:{classIds:classes.map(c=>c.id),scope:'school',teacher:'agata'}};
}
test('confirmed school search groups by teacher identity across classes and marks unavailable links',async()=>{
 const f=fixture(),seen=[],adapter=snapshotAdapter(f.snapshot);
 const report=await collectSupervision({SGE:{fetch:r=>{seen.push(new URL(r.url).pathname);return adapter.fetch(r)}}},f.input);
 assert.equal(report.teachers.length,1);assert.equal(report.teachers[0].name,'Ágata Fictícia');assert.equal(report.teachers[0].summary.classes.length,2);assert.equal(report.teachers[0].summary.total,2);assert.equal(report.teachers[0].summary.attention,1);assert.equal(report.teachers[0].summary.missingLinks,1);assert.ok(report.teachers[0].plans.every(p=>p.trimester===3));assert.ok(!seen.some(path=>path.includes('202%3A2/planning')));
 const changed={...f.input,classIds:[key]};await assert.rejects(collectSupervision({SGE:adapter},changed),/Confirme todas/);
});
test('SGE failures remain partial rather than silently reporting no planning',async()=>{
 const f=fixture();f.snapshot.entries[2]={path:f.snapshot.entries[2].path,error:'Falha'};
 const report=await collectSupervision({SGE:snapshotAdapter(f.snapshot)},f.input);assert.equal(report.complete,false);assert.equal(report.coverage.filter(c=>!c.ok).length,1);assert.equal(report.teachers[0].summary.total,1);
 f.snapshot.directory.classes[0].url='https://evil.example/';await assert.rejects(collectSupervision({SGE:snapshotAdapter(f.snapshot)},f.input),/origem/);
});

test('snapshot failures preserve connector reasons for class and teacher diagnostics',async()=>{
 const f=fixture();f.snapshot.entries[0]={path:f.snapshot.entries[0].path,error:'A página do SGE demorou a abrir.'};
 const classReport=await collectSupervision({SGE:snapshotAdapter(f.snapshot)},f.input);
 assert.deepEqual(classReport.coverage[0].errors,['A página do SGE demorou a abrir.']);
 const g=fixture();g.snapshot.entries[1]={path:g.snapshot.entries[1].path,error:'Ação de consulta não encontrada no SGE.'};
 const teacherReport=await collectSupervision({SGE:snapshotAdapter(g.snapshot)},g.input);
 assert.equal(teacherReport.teachers[0].assignments[0].error,'Ação de consulta não encontrada no SGE.');
 assert.match(teacherReport.coverage[0].errors[0],/Ágata · Português: Ação de consulta não encontrada/);
 const absent=fixture();absent.snapshot.entries.splice(1,1);const interrupted=await collectSupervision({SGE:snapshotAdapter(absent.snapshot)},absent.input);
 assert.match(interrupted.coverage[0].errors[0],/Esta etapa não foi consultada/);
 const adapter=snapshotAdapter({directory:g.snapshot.directory,entries:[{path:g.snapshot.entries[0].path,error:'Falha\u0000\n'+ 'x'.repeat(2000)}]});
 assert.equal(adapter.readFailure(g.snapshot.entries[0].path).length,1000);assert.doesNotMatch(adapter.readFailure(g.snapshot.entries[0].path),/[\u0000\n]/);
});

test('connector failure reasons are escaped in UI and included in occurrence downloads',async()=>{
 const {document,context}=await filterUi();const f=fixture();f.snapshot.entries[1]={path:f.snapshot.entries[1].path,error:'Ação indisponível <img src=x onerror=bad>'};
 context.report=await collectSupervision({SGE:snapshotAdapter(f.snapshot)},f.input);vm.runInContext('supervision.report=report;render()',context);
 assert.equal(document.querySelectorAll('#page img').length,0);assert.match(document.querySelector('[data-supervision-occurrences]').textContent,/Motivo: Ação indisponível/);
 assert.match(vm.runInContext('supervisionOccurrenceText(report,report.teachers[0])',context),/Motivo: Ação indisponível/);
});
test('repeated teacher slots from legacy connectors do not reject two classes or double-count plans',async()=>{
 const f=fixture();
 for(const entry of [...f.snapshot.entries]){
  if(entry.path.endsWith('/teachers'))entry.data.teachers.push({...entry.data.teachers[0],position:7});
  else f.snapshot.entries.push(structuredClone(entry));
 }
 const report=await collectSupervision({SGE:snapshotAdapter(f.snapshot)},f.input);
 assert.equal(report.complete,true);assert.equal(report.teachers.length,1);assert.equal(report.teachers[0].assignments.length,2);assert.equal(report.teachers[0].summary.total,2);
 const successful=f.snapshot.entries.find(e=>e.path.endsWith('/planning'));
 f.snapshot.entries.push({path:successful.path,error:'Falha na leitura repetida'});
 assert.equal((await collectSupervision({SGE:snapshotAdapter(f.snapshot)},f.input)).complete,true);
 f.snapshot.entries.push({path:successful.path,data:{...successful.data,teacherId:'mat-other'}});
 assert.throws(()=>snapshotAdapter(f.snapshot),/incompatíveis/);
 assert.throws(()=>snapshotAdapter({directory:f.snapshot.directory,entries:[{path:'/unexpected'}]}),/Página inválida/);
});
test('parser keeps one navigation target when SGE repeats a teacher in one subject',()=>{
 const teachers=parseSgeTeachers(doc(`<table id="GRIDDISCIPLINA"><tr>${fields({DISCOD:'8268',DISCODNOM:'8268-DISCIPLINA FICTÍCIA',_SERNOMPROF1:'ANA',_SERMATPROF1:'123',_SERNOMPROF7:'ANA',_SERMATPROF7:'123',_SERNOMPROF2:'ANA',_SERMATPROF2:'456'},'_0001')}</tr></table>`,'hplanejamentodisciplinasger.aspx'),base);
 assert.equal(teachers.teachers.length,2);assert.equal(teachers.teachers[0].position,1);assert.equal(teachers.teachers[0].assignmentId,'8268:123');assert.equal(teachers.teachers[1].assignmentId,'8268:456');
});
test('supervision API requires direction and same-origin confirmation and never writes imported data',async()=>{
 const DB=sqlite();DB.exec(await readFile(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));DB.exec("INSERT INTO users VALUES('d@prof.pmf.sc.gov.br','Direção','direction',1),('t@prof.pmf.sc.gov.br','Docente','teacher',1)");
 const f=fixture(),request=origin=>new Request('https://school.example/api/supervision/preview',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({...f.input,snapshot:f.snapshot})});
 assert.equal((await handle(request('https://school.example'),{DB},async()=> 't@prof.pmf.sc.gov.br')).status,403);assert.equal((await handle(request('https://evil.example'),{DB},async()=> 'd@prof.pmf.sc.gov.br')).status,403);
 const response=await handle(request('https://school.example'),{DB},async()=> 'd@prof.pmf.sc.gov.br');assert.equal(response.status,200);assert.equal((await response.json()).teachers.length,1);assert.equal((await DB.prepare('SELECT COUNT(*) AS count FROM audit').first()).count,0);
});
test('supervision UI confirms selection, separates trimesters and escapes names and links',async()=>{
 const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('});boot();','});');
 const {document,window}=parseHTML(html),context=vm.createContext({document,URL,Date,Intl,setTimeout:()=>{},FormData});vm.runInContext(script,context);
 context.catalog=fixture().snapshot.directory;context.report=await collectSupervision({SGE:snapshotAdapter(fixture().snapshot)},fixture().input);
 vm.runInContext("currentUser={role:'direction'};supervision.directory=catalog;supervisionBridge=async()=>{};collectSupervisionSnapshot=async input=>{globalThis.sent=input;return {}};api=async()=>report;state.section='supervisao';render()",context);
 assert.equal(document.querySelectorAll('[data-supervision-class]').length,2);assert.equal(document.querySelector('[data-supervision-confirm]').disabled,true);
 document.querySelectorAll('[data-supervision-class]')[1].dispatchEvent(new window.Event('click',{bubbles:true}));assert.equal(vm.runInContext('supervision.selected.has(catalog.classes[1].id)',context),true);
 document.querySelectorAll('[data-supervision-class]')[1].dispatchEvent(new window.Event('click',{bubbles:true}));assert.equal(document.querySelector('[data-supervision-confirm]').disabled,true);
 document.querySelector('[data-supervision-class]').dispatchEvent(new window.Event('click',{bubbles:true}));assert.equal(document.querySelector('[data-supervision-confirm]').disabled,false);assert.equal(context.sent,undefined);
 await vm.runInContext('confirmSupervision()',context);assert.deepEqual([...context.sent.classIds],[key]);assert.match(document.querySelector('#page').textContent,/Relatório síntese/);assert.match(document.querySelector('#page').textContent,/3º trimestre/);assert.match(document.querySelector('#page').textContent,/Link direto indisponível/);
 context.report.teachers[0].name='<img src=x onerror=bad>';vm.runInContext('supervision.report=report;render()',context);assert.equal(document.querySelectorAll('#page img').length,0);
 vm.runInContext("currentUser.role='teacher';render()",context);assert.equal(document.querySelector('[data-section=supervisao]'),null);
});
test('UI shows streamed planning while its request is pending and keeps the preview after interruption',async()=>{
 const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('});boot();','});');
 const {document,window}=parseHTML(html),context=vm.createContext({document,URL,Date,Intl,setTimeout:()=>{},FormData});vm.runInContext(script,context);
 const f=fixture();context.catalog=f.snapshot.directory;context.teacherPage=f.snapshot.entries[0].data;context.planning=f.snapshot.entries[1].data;
 let release;context.gate=new Promise(resolve=>release=resolve);
 vm.runInContext("currentUser={role:'direction'};supervision.directory=catalog;supervision.selected=new Set(catalog.classes.map(c=>c.id));supervision.teacher='agata';state.section='supervisao';supervisionBridge=async(command,input,onProgress)=>{if(command==='teachers')return teacherPage;if(command==='planning'){onProgress({stage:'opening-plan',name:planning.name,current:1,total:2,title:planning.plans[0].title,situation:planning.plans[0].situation});onProgress({stage:'plan-read',name:planning.name,current:1,total:2,plan:planning.plans[0]});await gate;return planning}};api=async()=>{throw new Error('Falha temporária no relatório')};render()",context);
 const pending=vm.runInContext('confirmSupervision()',context);await new Promise(resolve=>setImmediate(resolve));
 assert.match(document.querySelector('[data-supervision-preview]').textContent,/Prévia dos planejamentos/);assert.match(document.querySelector('[data-supervision-preview]').textContent,/Ágata Fictícia/);assert.match(document.querySelector('[data-supervision-status]').textContent,/Planejamento 1 de 2 consultado/);assert.match(document.querySelector('[data-supervision-status]').textContent,/Situação: Planejamento finalizado/);assert.equal(vm.runInContext('supervision.preview.size',context),1);assert.equal(document.querySelector('[data-supervision-report]'),null);
 document.querySelector('[data-supervision-cancel]').dispatchEvent(new window.Event('click',{bubbles:true}));release();await pending;
 assert.equal(vm.runInContext('supervision.preview.size',context),1);assert.match(document.querySelector('[data-supervision-preview]').textContent,/Dados já consultados/);assert.match(document.querySelector('#page').textContent,/Falha temporária/);
});
function filterUi(){
 return readFile(new URL('../src/index.html',import.meta.url),'utf8').then(html=>{
  const {document,window}=parseHTML(html),context=vm.createContext({document,URL,Date,Intl,setTimeout:()=>{},FormData});vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('});boot();','});'),context);
  vm.runInContext("currentUser={role:'direction'};state.section='supervisao'",context);
  const choose=(selector,value)=>{const select=document.querySelector(selector);for(const option of select.querySelectorAll('option')){if(option.value===value)option.setAttribute('selected','');else option.removeAttribute('selected')}select.dispatchEvent(new window.Event('change',{bubbles:true}))};
  return {document,context,window,choose};
 });
}
test('status filters work globally and per teacher, preserve source totals and can be cleared',async()=>{
 const {document,context,window,choose}=await filterUi();context.report=await collectSupervision({SGE:snapshotAdapter(fixture().snapshot)},fixture().input);
 const original=JSON.stringify(context.report);vm.runInContext('supervision.report=report;render()',context);
 choose('[data-supervision-situation][data-teacher-id="mat-1"]','Não enviado para análise');
 assert.equal(document.querySelectorAll('[data-supervision-report] .day-plan .row').length,1);assert.match(document.querySelector('[data-supervision-report]').textContent,/Exibindo 1 de 2/);assert.match(document.querySelector('[data-supervision-report]').textContent,/incluindo os ocultos/);assert.equal(JSON.stringify(context.report),original);
 choose('[data-supervision-situation][data-teacher-id=""]','Planejamento finalizado');assert.equal(document.querySelectorAll('[data-supervision-report] .day-plan .row').length,0);
 choose('[data-supervision-situation][data-teacher-id="mat-1"]','');assert.equal(document.querySelectorAll('[data-supervision-report] .day-plan .row').length,1);assert.match(document.querySelector('[data-supervision-report] .day-plan .row').textContent,/Planejamento finalizado/);
 document.querySelector('[data-supervision-clear-status]').dispatchEvent(new window.Event('click',{bubbles:true}));assert.equal(document.querySelectorAll('[data-supervision-report] .day-plan .row').length,2);
 context.report.teachers[0].plans=[];vm.runInContext("supervision.situation='Planejamento finalizado';render()",context);assert.ok(document.querySelector('[data-supervision-clear-status]'));assert.match(document.querySelector('[data-supervision-report]').textContent,/Nenhum planejamento corresponde/);
});
test('preview retains the selected situation as new plans arrive, including missing and unknown situations',async()=>{
 const {document,context,choose}=await filterUi();vm.runInContext("supervision.loading=true;recordSupervisionPreview({id:'c',name:'Turma'},{id:'t',assignmentId:'a',subject:'Disciplina'},'Professor',[{id:'1',title:'Pendente',situation:'Não enviado para análise',url:null},{id:'2',title:'Finalizado',situation:'Planejamento finalizado',url:null}]);render()",context);
 choose('[data-supervision-situation][data-teacher-id=""]','Não enviado para análise');assert.equal(document.querySelectorAll('[data-supervision-preview] tbody tr').length,1);
 vm.runInContext("recordSupervisionPreview({id:'c',name:'Turma'},{id:'t',assignmentId:'a',subject:'Disciplina'},'Professor',[{id:'3',title:'Mais um',situation:'Não enviado para análise',url:null},{id:'4',title:'Sem situação',situation:null,url:null},{id:'5',title:'Outra',situation:'<img src=x>',url:null}]);supervisionProgress('Mais dados consultados')",context);
 assert.equal(document.querySelectorAll('[data-supervision-preview] tbody tr').length,2);assert.equal(document.querySelector('[data-supervision-situation][data-teacher-id=""]').value,'Não enviado para análise');assert.equal(document.querySelectorAll('#page img').length,0);
 choose('[data-supervision-situation][data-teacher-id=""]','Não informada');assert.match(document.querySelector('[data-supervision-preview] tbody').textContent,/Sem situação/);assert.equal(document.querySelectorAll('[data-supervision-preview] tbody tr').length,1);
});

test('teacher list isolates results by identity and occurrences remain complete under filters',async()=>{
 const {document,context,choose}=await filterUi();const report=await collectSupervision({SGE:snapshotAdapter(fixture().snapshot)},fixture().input);
 const other=structuredClone(report.teachers[0]);other.id='other';other.name='Outro professor';other.plans=[{...other.plans[0],title:'Registro exclusivo',review:'analysis',situation:'Enviado para análise',url:base+'detail.aspx?other'}];report.teachers.push(other);context.report=report;
 vm.runInContext('supervision.report=report;render()',context);
 assert.equal(document.querySelectorAll('[data-supervision-result-teacher] option').length,2);
 assert.equal(document.querySelectorAll('.supervision-metrics').length,1);
 assert.doesNotMatch(document.querySelector('[data-supervision-report]').textContent,/Registro exclusivo/);
 choose('[data-supervision-situation][data-teacher-id=""]','Planejamento finalizado');
 assert.match(document.querySelector('[data-supervision-occurrences]').textContent,/Pendente de envio ou ajustes/);
 assert.match(document.querySelector('[data-supervision-occurrences]').textContent,/Sem link direto/);
 choose('[data-supervision-result-teacher]','other');
 assert.match(document.querySelector('[data-supervision-occurrences]').textContent,/Outro professor/);
 assert.match(document.querySelector('[data-supervision-occurrences]').textContent,/Aguardando análise/);
 choose('[data-supervision-situation][data-teacher-id=""]','');
 assert.match(document.querySelector('[data-supervision-report]').textContent,/Registro exclusivo/);
 assert.doesNotMatch(document.querySelector('[data-supervision-occurrences]').textContent,/Pendente de envio ou ajustes/);
 const approval=[...document.querySelectorAll('.supervision-plan-actions a')].find(a=>a.textContent.includes('Aprovar no SGE'));
 assert.equal(approval.href,other.plans[0].url);assert.equal(approval.target,'_blank');assert.match(approval.rel,/noopener/);
 assert.equal(other.plans[0].situation,'Enviado para análise');
});

test('approval links require a current plan in analysis and fall back to the teacher page',async()=>{
 const {document,context}=await filterUi();context.report=await collectSupervision({SGE:snapshotAdapter(fixture().snapshot)},fixture().input);
 const t=context.report.teachers[0],p=t.plans[0];p.review='analysis';p.situation='Em análise';p.url=null;t.assignments[1].teacherUrl=base+'teacher-plans.aspx';
 vm.runInContext('supervision.report=report;render()',context);
 const approval=()=>[...document.querySelectorAll('.supervision-plan-actions a')].filter(a=>a.textContent.includes('Aprovar no SGE'));
 assert.equal(approval().length,1);assert.equal(approval()[0].href,base+'teacher-plans.aspx');
 p.notFound=true;vm.runInContext('render()',context);assert.equal(approval().length,0);
 assert.match(document.querySelector('[data-supervision-occurrences]').textContent,/Não encontrado na última leitura/);
 assert.equal(t.plans[1].situation,'Planejamento finalizado');
});

test('occurrence exports include failures, empty assignments and a clean conclusion when appropriate',async()=>{
 const {document,context}=await filterUi();context.report=await collectSupervision({SGE:snapshotAdapter(fixture().snapshot)},fixture().input);
 const t=context.report.teachers[0];t.plans=[t.plans.find(p=>p.review==='approved')];t.assignments=[t.assignments[0]];
 vm.runInContext('supervision.report=report;render()',context);assert.match(document.querySelector('[data-supervision-occurrences]').textContent,/Nenhuma ocorrência identificada/);
 t.plans=[];vm.runInContext('render()',context);assert.match(document.querySelector('[data-supervision-occurrences]').textContent,/Nenhum planejamento atual/);
 t.assignments[0].ok=false;context.report.complete=false;context.report.coverage[0].ok=false;context.report.coverage[0].errors=['Falha fictícia'];
 const text=vm.runInContext('supervisionOccurrenceText(report,report.teachers[0])',context);
 assert.match(text,/PARCIAL/);assert.match(text,/Falha fictícia/);assert.match(text,/Falha na consulta do vínculo/);assert.match(text,/Encaminhamento:/);
 context.report.teachers=[];vm.runInContext('render()',context);assert.match(document.querySelector('[data-supervision-occurrences]').textContent,/Falha fictícia/);
});

test('partial previews always show an occurrence report and preserve selection as teachers arrive',async()=>{
 const {document,context,choose}=await filterUi();
 vm.runInContext("supervision.loading=true;recordSupervisionPreview({id:'c',name:'Turma'},{id:'t',assignmentId:'a',subject:'Disciplina'},'Professor B',[{id:'1',title:'Pendente',situation:'Não enviado para análise',trimester:null,url:null}]);render()",context);
 assert.match(document.querySelector('[data-supervision-preview] [data-supervision-occurrences]').textContent,/Pendente de envio ou ajustes/);
 vm.runInContext("recordSupervisionPreview({id:'c',name:'Turma'},{id:'t2',assignmentId:'a2',subject:'Disciplina'},'Professor A',[{id:'2',title:'Enviado',situation:'Em análise',trimester:3,url:null}]);supervisionProgress('Mais dados')",context);
 assert.equal(vm.runInContext('supervision.resultTeacher',context),'t');
 choose('[data-supervision-result-teacher]','t2');assert.match(document.querySelector('[data-supervision-occurrences]').textContent,/Professor A/);
 assert.match(document.querySelector('[data-supervision-occurrences]').textContent,/Aguardando análise/);
});

test('a failed query with no returned plans still produces a downloadable occurrence report',async()=>{
 const {document,context}=await filterUi();vm.runInContext("supervision.error='SGE indisponível';render()",context);
 assert.match(document.querySelector('[data-supervision-occurrences]').textContent,/SGE indisponível/);
 assert.equal(document.querySelector('[data-supervision-export]').dataset.supervisionExport,'preview');
 const text=vm.runInContext('supervisionOccurrenceText(supervisionPreviewReport(),null)',context);
 assert.match(text,/SGE indisponível/);assert.match(text,/PARCIAL/);
});

test('supervision subsections separate class setup from teacher work and retain selection when switching',async()=>{
 const {document,context,window}=await filterUi();context.report=await collectSupervision({SGE:snapshotAdapter(fixture().snapshot)},fixture().input);
 vm.runInContext('supervision.report=report;render()',context);
 assert.equal(document.querySelector('[data-supervision-panel="classes"]').hasAttribute('hidden'),false);
 assert.equal(document.querySelector('[data-supervision-panel="teachers"]').hasAttribute('hidden'),true);
 assert.ok(document.querySelector('[data-supervision-panel="classes"] [data-supervision-load]'));
 assert.equal(document.querySelector('[data-supervision-panel="teachers"] [data-supervision-load]'),null);
 document.querySelector('.supervision-subnav [data-supervision-view="teachers"]').dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(document.querySelector('[data-supervision-panel="classes"]').hasAttribute('hidden'),true);
 assert.equal(document.querySelector('[data-supervision-panel="teachers"]').hasAttribute('hidden'),false);
 assert.ok(document.querySelector('[data-supervision-panel="teachers"] [data-supervision-occurrences]'));
 const selected=vm.runInContext('supervision.resultTeacher',context);
 document.querySelector('.supervision-subnav [data-supervision-view="classes"]').dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(vm.runInContext('supervision.resultTeacher',context),selected);
});

test('restart clears supervision screen state without API mutations or losing the shared save revision',async()=>{
 const {document,context,window}=await filterUi();context.report=await collectSupervision({SGE:snapshotAdapter(fixture().snapshot)},fixture().input);context.report.version=7;
 vm.runInContext("supervision.report=report;supervision.saved=report;supervision.view='teachers';supervision.directory={classes:[]};supervision.selected.add('class');supervision.teacher='Ana';supervision.situation='Pendente';supervision.teacherSituations.set('t','Pendente');supervision.error='Falha';supervision.updateSituation='Pendente';supervision.activity=['Etapa'];supervision.preview.set('x',{id:'x',teacherId:'t',teacherName:'Ana',plans:[]});api=()=>{throw new Error('API não deveria ser chamada')};render()",context);
 document.querySelector('[data-supervision-reset]').dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(vm.runInContext('supervision.view',context),'classes');assert.equal(vm.runInContext('supervision.report',context),null);assert.equal(vm.runInContext('supervision.directory',context),null);
 assert.equal(vm.runInContext('supervision.selected.size+supervision.preview.size+supervision.teacherSituations.size+supervision.activity.length',context),0);
 assert.equal(vm.runInContext('supervision.teacher+supervision.situation+supervision.error+supervision.updateSituation+supervision.resultTeacher',context),'');
 assert.equal(vm.runInContext('supervision.saved.version',context),7);assert.equal(context.report.version,7);
 assert.equal(document.querySelector('[data-supervision-report]'),null);assert.equal(document.querySelector('[data-supervision-update-situation]'),null);
 vm.runInContext("supervision.loading=true;supervision.selected.add('keep');render();resetSupervision()",context);
 assert.equal(document.querySelector('[data-supervision-reset]').disabled,true);assert.equal(vm.runInContext("supervision.selected.has('keep')",context),true);
});

test('restart ignores saved results arriving late, while explicit reload opens the professor workspace',async()=>{
 const {document,context}=await filterUi();context.report=await collectSupervision({SGE:snapshotAdapter(fixture().snapshot)},fixture().input);
 let release;context.gate=new Promise(resolve=>{release=resolve});vm.runInContext('api=()=>gate;render()',context);
 const pending=vm.runInContext('loadSavedSupervision()',context);vm.runInContext('resetSupervision()',context);release(context.report);await pending;
 assert.equal(vm.runInContext('supervision.report',context),null);assert.equal(vm.runInContext('supervision.view',context),'classes');
 await vm.runInContext('loadSavedSupervision()',context);
 assert.equal(vm.runInContext('supervision.view',context),'teachers');assert.equal(document.querySelector('[data-supervision-panel="teachers"]').hasAttribute('hidden'),false);
});

test('SGE class parser accepts both official hosts and rejects unrelated or cross-origin forms',()=>{
 const body=`<table id="GRIDTURMA"><tr>${fields({...classFields,_WVAR:'Turma fictícia'},'_0001')}</tr></table>`;
 for(const origin of ['https://www.sgebr.com.br','https://www.sgebr.net.br']){
  const result=parseSgeClasses(doc(body,'hselgerenciamentoplanoaula.aspx'),origin+'/sge8105/');
  assert.equal(new URL(result.sourceUrl).origin,origin);
 }
 assert.throws(()=>parseSgeClasses(doc(body),'https://evil.example/sge8105/'),/Origem/);
 assert.throws(()=>parseSgeClasses(doc(body,'https://www.sgebr.net.br/sge8105/hselgerenciamentoplanoaula.aspx'),'https://www.sgebr.com.br/sge8105/'),/Origem/);
});
