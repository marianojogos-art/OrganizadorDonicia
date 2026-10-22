import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';

const html=await readFile(new URL('../src/public.html',import.meta.url),'utf8');
const inlineScript=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const script=inlineScript.replace(/\nloadContent\(\);\s*loadHighlights\(\);\s*loadPublic\(\);\s*$/,'');
assert.notEqual(script,inlineScript,'the test harness must remove all three automatic public requests');
function page(data,{now}={}){
 const {document,window}=parseHTML(html),calls=[];
 const Clock=now?class extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return new Date(now).getTime()}}:Date;
 const context=vm.createContext({document,Intl,Date:Clock,URL,fetch:async(...args)=>{calls.push(args);return {ok:true,json:async()=>data}}});
 vm.runInContext(script,context);
 return {document,window,calls,context,load:()=>vm.runInContext('loadPublic()',context),loadContent:()=>vm.runInContext('loadContent()',context),loadHighlights:()=>vm.runInContext('loadHighlights()',context)};
}
function respond(p,responses){
 p.context.fetch=async(path,options)=>{
  p.calls.push([path,options]);
  assert.ok(Object.hasOwn(responses,path),'unexpected request: '+path);
  const value=responses[path];
  if(value instanceof Error)throw value;
  return {ok:true,json:async()=>value};
 };
}
async function clickRetry(p,selector){
 const button=p.document.querySelector(selector);assert.ok(button,'the affected section needs its own retry button');
 button.dispatchEvent(new p.window.Event('click'));
 await new Promise(resolve=>setImmediate(resolve));
}
const empty={school:{name:'Escola fictícia',introduction:'Apresentação fictícia'},notices:[],events:[]};
test('public portal loads only the anonymous endpoint and exposes discreet employee entrance',async()=>{
 const p=page(empty);await p.load();
 assert.equal(p.calls.length,1);assert.equal(p.calls[0][0],'/public/api');assert.equal(p.calls[0][1].credentials,'omit');
 assert.equal(p.document.querySelector('a.staff').getAttribute('href'),'/equipe');
 assert.match(p.document.querySelector('#notices').textContent,/Nenhum aviso/);
 assert.match(p.document.querySelector('#events').textContent,/Nenhum evento/);
 assert.equal(p.document.querySelector('#school-title').textContent,'Escola fictícia');
 assert.equal(p.document.querySelector('#load-error').classList.contains('hidden'),true);
 assert.equal(p.document.querySelector('form'),null);
});
test('notices, event titles and school contacts render stored text without HTML execution',async()=>{
 const attack='<img src=x onerror=alert(1)>';
 const data={school:{...empty.school,name:attack,introduction:attack,address:attack,phone:'(00) 1234-5678',email:'contato@example.test',hours:attack},notices:[{title:attack,body:'Aviso\n'+attack,date:'2026-10-13'}],events:[{title:attack,date:'2026-10-14',type:'Evento escolar'}]};
 const p=page(data);p.document.querySelector('#calendar-month').value='2026-10';await p.load();
 for(const selector of ['#school-title','#school-introduction','#school-contacts','#notices','#events']){
  assert.match(p.document.querySelector(selector).textContent,/<img/);
  assert.equal(p.document.querySelector(selector).querySelector('img,script'),null);
 }
 assert.equal(p.document.querySelector('a[href^="mailto:"]').getAttribute('href'),'mailto:contato@example.test');
 assert.equal(p.document.querySelector('a[href^="tel:"]').getAttribute('href'),'tel:0012345678');
});
test('public calendar changes month and sorts events by date without including other months',async()=>{
 const p=page({...empty,events:[{title:'Fim de outubro',date:'2026-10-30',type:'Evento escolar'},{title:'Novembro',date:'2026-11-01',type:'Feriado'},{title:'Começo de outubro',date:'2026-10-01',type:'Reunião'}]});
 const month=p.document.querySelector('#calendar-month');month.value='2026-10';await p.load();
 const titles=()=>[...p.document.querySelectorAll('#events h3')].map(x=>x.textContent);
 assert.deepEqual(titles(),['Começo de outubro','Fim de outubro']);
 month.value='2026-11';month.dispatchEvent(new p.window.Event('change'));
 assert.deepEqual(titles(),['Novembro']);
 month.value='2026-12';month.dispatchEvent(new p.window.Event('change'));
 assert.match(p.document.querySelector('#events').textContent,/Nenhum evento/);
});
test('network failure is visible and retry can recover without exposing raw server errors',async()=>{
 const p=page(empty);p.context.fetch=async()=>{throw Error('internal connection data')};await p.load();
 assert.equal(p.document.querySelector('#load-error').classList.contains('hidden'),false);
 assert.equal(p.document.querySelector('#retry').disabled,false);
 assert.doesNotMatch(p.document.body.textContent,/internal connection data/);
 assert.equal(p.document.querySelector('#school-contacts a[href^="tel:"]').getAttribute('href'),'tel:+554832382299');
 assert.match(p.document.querySelector('#school-contacts').textContent,/Virgílio Várzea/);
 p.context.fetch=async()=>({ok:true,json:async()=>empty});await p.load();
 assert.equal(p.document.querySelector('#load-error').classList.contains('hidden'),true);
 assert.match(p.document.querySelector('#notices').textContent,/Nenhum aviso/);
});

test('public calendar shows Portuguese times and escaped location only when supplied',async()=>{
 const p=page({...empty,events:[
  {title:'Encontro das famílias',date:'2026-10-14',type:'Evento escolar',start:'08:30',end:'10:00',location:'Auditório <img src=x onerror=alert(1)>',details:'Detalhes não publicados'},
  {title:'Dia letivo',date:'2026-10-15',type:'Dia letivo',start:'',end:'',location:''}
 ]});
 p.document.querySelector('#calendar-month').value='2026-10';await p.load();
 const [meeting,day]=p.document.querySelectorAll('#events .event');
 assert.match(meeting.textContent,/Horário: 08h30 às 10h00/);
 assert.match(meeting.textContent,/Local: Auditório <img/);
 assert.equal(meeting.querySelector('img,script'),null);
 assert.doesNotMatch(meeting.textContent,/Detalhes não publicados/);
 assert.doesNotMatch(day.textContent,/Horário:|Local:/);
});

test('verified school details fill empty fields and neutral introduction without replacing administrator content',async()=>{
 const defaults={name:'',introduction:'Informações e serviços para estudantes, famílias e comunidade escolar.',address:'',phone:'',email:'',hours:''};
 const p=page({...empty,school:defaults});await p.load();
 assert.equal(p.document.querySelector('#school-title').textContent,'EBM Donícia Maria da Costa');
 assert.match(p.document.querySelector('#school-introduction').textContent,/1º ao 9º ano/);
 assert.match(p.document.querySelector('#school-contacts').textContent,/Rodovia Virgílio Várzea, 1264/);
 assert.match(p.document.querySelector('#school-contacts').textContent,/CEP 88032-001/);
 assert.equal(p.document.querySelector('#school-contacts a[href^="mailto:"]').getAttribute('href'),'mailto:ebm.donicia@sme.pmf.sc.gov.br');
 assert.equal(new URL(p.document.querySelector('#school-map').getAttribute('href')).searchParams.get('query'),'Rodovia Virgílio Várzea, 1264 · Saco Grande\nFlorianópolis/SC · CEP 88032-001');
 const custom={name:'Nome cadastrado',introduction:'Nossa apresentação escrita pela escola.',address:'Endereço cadastrado, 42',phone:'(48) 3000-1234',email:'contato@example.test',hours:'Horário informado pela secretaria'};
 p.context.fetch=async()=>({ok:true,json:async()=>({...empty,school:custom})});await p.load();
 assert.equal(p.document.querySelector('#school-title').textContent,custom.name);
 assert.equal(p.document.querySelector('.hero-school').textContent,custom.name);
 assert.equal(p.document.querySelector('#school-introduction').textContent,custom.introduction);
 assert.equal(p.document.querySelector('#school-contacts a[href^="tel:"]').getAttribute('href'),'tel:4830001234');
 assert.match(p.document.querySelector('#school-contacts').textContent,/Horário informado pela secretaria/);
 assert.equal(new URL(p.document.querySelector('#school-map').getAttribute('href')).searchParams.get('query'),custom.address);
 p.context.fetch=async()=>({ok:true,json:async()=>({...empty,school:{...custom,phone:'   ',introduction:''}})});await p.load();
 assert.equal(p.document.querySelector('#school-contacts a[href^="tel:"]').getAttribute('href'),'tel:+554832382299');
 assert.match(p.document.querySelector('#school-introduction').textContent,/1º ao 9º ano/);
 assert.equal(p.document.querySelector('#school-title').textContent,custom.name);
});


test('only configured institutional WhatsApp channels appear, without assuming the fixed phone is WhatsApp',async()=>{
 const p=page({...empty,school:{...empty.school,whatsapp_secretaria:'5511000000000',whatsapp_orientacao:''}});await p.load();assert.equal(p.document.querySelectorAll('a[href^="https://wa.me/"]').length,1);assert.match(p.document.querySelector('#school-contacts').textContent,/WhatsApp da secretaria/);const absent=page({...empty,school:{...empty.school,whatsapp_secretaria:'',whatsapp_orientacao:''}});await absent.load();assert.equal(absent.document.querySelector('a[href^="https://wa.me/"]'),null);
});


test('secretary WhatsApp button uses the exact authorized digits, accessible navigation and no call or automatic message',async()=>{
 const p=page({...empty,school:{...empty.school,whatsapp_secretaria:'554888734629',whatsapp_orientacao:''}});await p.load();const buttons=p.document.querySelectorAll('a[href^="https://wa.me/"]');assert.equal(buttons.length,1);const button=buttons[0];assert.equal(button.getAttribute('href'),'https://wa.me/554888734629');assert.equal(button.getAttribute('target'),'_blank');assert.match(button.getAttribute('rel'),/noopener/);assert.match(button.getAttribute('rel'),/noreferrer/);assert.match(button.getAttribute('aria-label'),/WhatsApp da secretaria.*nova aba/);assert.match(button.textContent,/WhatsApp da secretaria/);assert.ok(button.classList.contains('whatsapp-button'));assert.equal(p.document.querySelector('a[href="tel:+554888734629"]'),null);assert.equal(p.document.querySelector('a[href="https://wa.me/5548988734629"]'),null);assert.equal(button.getAttribute('href').includes('?text='),false);assert.equal(p.calls.length,1,'only the anonymous school endpoint was read');
});

test('this week uses the school timezone, upcoming events through Sunday, and current notices',async()=>{
 const p=page({...empty,events:[
 {title:'Ontem',date:'2026-10-13',type:'Evento escolar'},
 {title:'Hoje',date:'2026-10-14',type:'Evento escolar',start:'09:00',end:'10:00'},
 {title:'Domingo',date:'2026-10-18',type:'Evento escolar'},
 {title:'Outra semana',date:'2026-10-19',type:'Evento escolar'}],
 notices:[{title:'Vigente',date:'2026-10-12',body:'Mensagem atual'},{title:'Futuro',date:'2026-10-15',body:'Ainda não'}]});
 p.context.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-15T01:00:00Z']))}};
 const fetchPublic=p.context.fetch;
 p.context.fetch=async(path,...args)=>path==='/public/highlights'?{ok:true,json:async()=>({items:[{kind:'notice',title:'Vigente',description:'Mensagem atual'}]})}:fetchPublic(path,...args);
 await p.loadHighlights();
 await p.load();const text=p.document.querySelector('#week-items').textContent;
 assert.match(text,/Hoje/);assert.match(text,/Domingo/);assert.match(text,/Vigente/);assert.doesNotMatch(text,/Ontem|Outra semana|Futuro/);
 assert.match(p.document.querySelector('#week-range').textContent,/12 de outubro.*18 de outubro/);
});
test('public projects and grouped documents escape text, restrict links and show update dates',async()=>{
 const p=page(empty);p.context.fetch=async()=>({ok:true,json:async()=>({items:[
 {id:'approved',kind:'project',title:'Projeto <script>',description:'Texto <img>',category:'Cultura',image:'/public/projects/approved/image',image_alt:'Descrição <img>',url:'javascript:alert(1)',updated_at:'2026-10-15 12:00:00'},
 {id:'doc',kind:'document',title:'Orientações',description:'Texto',category:'Famílias',url:'https://example.test/documento',updated_at:'2026-10-14 12:00:00'}
 ]})});
 await p.loadContent();assert.equal(p.calls.length,0);
 const projects=p.document.querySelector('#projects');assert.match(projects.textContent,/Projeto <script>/);assert.equal(projects.querySelector('script'),null);
 assert.equal(projects.querySelector('img').getAttribute('alt'),'Descrição <img>');assert.equal(projects.querySelector('a'),null);
 const docs=p.document.querySelector('#documents');assert.match(docs.textContent,/Famílias/);assert.match(docs.textContent,/14 de outubro de 2026/);
 assert.equal(docs.querySelector('a').getAttribute('rel'),'noopener noreferrer');assert.equal(docs.querySelector('a').getAttribute('href'),'https://example.test/documento');
 assert.equal(p.document.querySelector('.footer-staff').getAttribute('href'),'/equipe');
});
test('public content failures have an independent retry and never fabricate projects',async()=>{
 const p=page(empty);p.context.fetch=async()=>{throw Error('private database data')};await p.loadContent();
 assert.equal(p.document.querySelector('#content-error').classList.contains('hidden'),false);assert.doesNotMatch(p.document.body.textContent,/private database data/);
 p.context.fetch=async()=>({ok:true,json:async()=>({items:[]})});await p.loadContent();
 assert.equal(p.document.querySelector('#content-error').classList.contains('hidden'),true);assert.match(p.document.querySelector('#projects').textContent,/quando forem publicados/);
 assert.match(p.document.querySelector('#documents').textContent,/ainda não publicou/);
});


const fixedNow='2026-10-14T15:00:00Z';
const sampleContent={items:[
 {id:'horta',kind:'project',title:'Horta da escola',description:'Plantio realizado pelas turmas.',category:'Meio ambiente',updated_at:'2026-10-13 12:00:00'},
 {id:'familias',kind:'document',title:'Orientações às famílias',description:'Informações da secretaria.',category:'Famílias',url:'https://example.test/familias',updated_at:'2026-10-13 12:00:00'}
]};
const sampleHighlights={items:[{id:'highlight',kind:'notice',title:'Encontro da comunidade',description:'Conversa com as famílias.'}]};
function isHidden(p,selector){
 const element=p.document.querySelector(selector);assert.ok(element,'missing contextual status: '+selector);
 return element.classList.contains('hidden');
}

test('public datasets load independently and highlight errors preserve healthy projects and documents',async()=>{
 const p=page(empty,{now:fixedNow});
 respond(p,{'/public/api':empty,'/public/content':sampleContent,'/public/highlights':new Error('private highlight backend details')});
 await Promise.all([p.load(),p.loadContent(),p.loadHighlights()]);
 assert.deepEqual(p.calls.map(([path])=>path).sort(),['/public/api','/public/content','/public/highlights']);
 for(const [,options] of p.calls)assert.equal(options.credentials,'omit');
 assert.match(p.document.querySelector('#projects').textContent,/Horta da escola/);
 assert.match(p.document.querySelector('#documents').textContent,/Orientações às famílias/);
 assert.equal(isHidden(p,'#content-error'),true);assert.equal(isHidden(p,'#documents-error'),true);
 assert.equal(isHidden(p,'#week-agenda-error'),true);assert.equal(isHidden(p,'#week-highlights-error'),false);
 assert.doesNotMatch(p.document.body.textContent,/private highlight backend details/);
 respond(p,{'/public/highlights':sampleHighlights});
 await clickRetry(p,'#week-highlights-error [data-retry-highlights]');
 assert.equal(isHidden(p,'#week-highlights-error'),true);
 assert.match(p.document.querySelector('#week-items').textContent,/Encontro da comunidade/);
 assert.match(p.document.querySelector('#projects').textContent,/Horta da escola/);
});

test('a failed public agenda still displays independent highlights, in either response order',async()=>{
 for(const highlightsFirst of [true,false]){
  const p=page(empty,{now:fixedNow});
  respond(p,{'/public/api':new Error('private agenda backend details'),'/public/highlights':sampleHighlights});
  if(highlightsFirst){await p.loadHighlights();await p.load()}else{await p.load();await p.loadHighlights()}
  assert.match(p.document.querySelector('#week-items').textContent,/Encontro da comunidade/);
  assert.equal(isHidden(p,'#week-agenda-error'),false);assert.equal(isHidden(p,'#week-highlights-error'),true);
  assert.equal(isHidden(p,'#calendar-error'),false);
  assert.doesNotMatch(p.document.body.textContent,/private agenda backend details/);
 }
});

test('calendar failure has a visible local retry that restores the agenda',async()=>{
 const p=page(empty,{now:fixedNow});
 respond(p,{'/public/api':new Error('private connection diagnostics')});
 await p.load();
 assert.equal(isHidden(p,'#calendar-error'),false);
 assert.match(p.document.querySelector('#events').textContent,/temporariamente indisponível/);
 assert.doesNotMatch(p.document.querySelector('#events').textContent,/Nenhum evento/);
 assert.equal(p.document.querySelector('#calendar-error [data-retry-public]').disabled,false);
 const recovered={...empty,events:[{title:'Reunião recuperada',date:'2026-10-14',start:'09:00',type:'Reunião'}]};
 respond(p,{'/public/api':recovered});
 await clickRetry(p,'#calendar-error [data-retry-public]');
 assert.equal(isHidden(p,'#calendar-error'),true);
 assert.equal(isHidden(p,'#load-error'),true);assert.equal(isHidden(p,'#week-agenda-error'),true);
 assert.match(p.document.querySelector('#events').textContent,/Reunião recuperada/);
 assert.match(p.document.querySelector('#week-items').textContent,/Reunião recuperada/);
 assert.doesNotMatch(p.document.body.textContent,/private connection diagnostics/);
 assert.equal(p.calls.length,2);
});

test('documents offer their own retry after a content failure, without erasing highlights',async()=>{
 const p=page(empty,{now:fixedNow});
 respond(p,{'/public/content':new Error('private content diagnostics'),'/public/highlights':sampleHighlights});
 await p.loadHighlights();await p.loadContent();
 assert.equal(isHidden(p,'#documents-error'),false);
 assert.match(p.document.querySelector('#documents').textContent,/temporariamente indisponível/);
 assert.match(p.document.querySelector('#week-items').textContent,/Encontro da comunidade/);
 assert.doesNotMatch(p.document.body.textContent,/private content diagnostics/);
 respond(p,{'/public/content':sampleContent});
 await clickRetry(p,'#documents-error [data-retry-content]');
 assert.equal(isHidden(p,'#documents-error'),true);assert.equal(isHidden(p,'#content-error'),true);
 assert.match(p.document.querySelector('#projects').textContent,/Horta da escola/);
 assert.match(p.document.querySelector('#documents').textContent,/Orientações às famílias/);
 assert.match(p.document.querySelector('#week-items').textContent,/Encontro da comunidade/);
});

test('cleared or invalid months restore the current school month without a network error',async()=>{
 const p=page({...empty,events:[{title:'Evento de outubro',date:'2026-10-14',type:'Evento escolar'}]},{now:'2026-11-01T01:00:00Z'});
 await p.load();
 const month=p.document.querySelector('#calendar-month');
 for(const value of ['','2026-00','2026-13','2026-1','not-a-month','0000-10']){
  month.value=value;
  assert.doesNotThrow(()=>month.dispatchEvent(new p.window.Event('change')));
  assert.equal(month.value,'2026-10','month follows São Paulo even when UTC has reached November');
  assert.match(p.document.querySelector('#calendar-period').textContent,/outubro de 2026/);
  assert.match(p.document.querySelector('#events').textContent,/Evento de outubro/);
  assert.equal(isHidden(p,'#calendar-error'),true);assert.equal(isHidden(p,'#load-error'),true);
 }
 assert.equal(p.calls.length,1,'changing a calendar month should not refetch the public API');
 const initial=page(empty,{now:fixedNow});initial.document.querySelector('#calendar-month').value='';await initial.load();
 assert.equal(initial.document.querySelector('#calendar-month').value,'2026-10');
 assert.equal(isHidden(initial,'#calendar-error'),true);
});

test('same-day public events sort by start time then Portuguese title in calendar and week',async()=>{
 const p=page({...empty,events:[
  {title:'Zebra da manhã',date:'2026-10-14',start:'08:30',type:'Evento escolar'},
  {title:'Último da tarde',date:'2026-10-14',start:'14:00',type:'Evento escolar'},
  {title:'Árvore da manhã',date:'2026-10-14',start:'08:30',type:'Evento escolar'},
  {title:'Atividade do dia inteiro',date:'2026-10-14',start:'',type:'Dia letivo'},
  {title:'Amanhã cedo',date:'2026-10-15',start:'07:00',type:'Evento escolar'}
 ]},{now:fixedNow});
 await p.load();
 assert.deepEqual([...p.document.querySelectorAll('#events h3')].map(node=>node.textContent),['Atividade do dia inteiro','Árvore da manhã','Zebra da manhã','Último da tarde','Amanhã cedo']);
 assert.deepEqual([...p.document.querySelectorAll('#week-items .event-card h3')].map(node=>node.textContent),['Atividade do dia inteiro','Árvore da manhã','Zebra da manhã']);
});

test('failed refreshes retain the last successful calendar, notices, highlights, projects and documents with warnings',async()=>{
 const p=page(empty,{now:fixedNow});
 const schoolData={...empty,school:{...empty.school,name:'Escola cadastrada'},notices:[{title:'Aviso preservado',body:'Texto público.',date:'2026-10-13'}],events:[{title:'Evento preservado',date:'2026-10-14',start:'08:30',type:'Evento escolar'}]};
 respond(p,{'/public/api':schoolData,'/public/content':sampleContent,'/public/highlights':sampleHighlights});
 await Promise.all([p.load(),p.loadContent(),p.loadHighlights()]);
 const selectors=['#school-title','#notices','#events','#week-items','#projects','#documents'];
 const previous=selectors.map(selector=>p.document.querySelector(selector).innerHTML);
 respond(p,{'/public/api':new Error('private agenda error'),'/public/content':new Error('private content error'),'/public/highlights':new Error('private highlight error')});
 await Promise.all([p.load(),p.loadContent(),p.loadHighlights()]);
 assert.deepEqual(selectors.map(selector=>p.document.querySelector(selector).innerHTML),previous);
 for(const selector of ['#load-error','#calendar-error','#week-agenda-error','#week-highlights-error','#content-error','#documents-error']){
  assert.equal(isHidden(p,selector),false);
  assert.match(p.document.querySelector(selector).textContent,/última consulta/);
 }
 assert.doesNotMatch(p.document.body.textContent,/private (agenda|content|highlight) error/);
});

test('empty week distinguishes no upcoming events or selected highlights from the full notice board',async()=>{
 const p=page({...empty,notices:[{title:'Aviso sem destaque',body:'Este aviso continua disponível no mural.',date:'2026-10-13'}]},{now:fixedNow});
 respond(p,{'/public/api':{...empty,notices:[{title:'Aviso sem destaque',body:'Este aviso continua disponível no mural.',date:'2026-10-13'}]},'/public/highlights':{items:[]}});
 await p.load();await p.loadHighlights();
 assert.match(p.document.querySelector('#notices').textContent,/Aviso sem destaque/);
 assert.match(p.document.querySelector('#week-items').textContent,/Nenhum próximo evento público ou destaque publicado para o restante desta semana\. Consulte também todos os avisos e o calendário completo\./);
 assert.doesNotMatch(p.document.querySelector('#week-items').textContent,/Sem próximos eventos públicos ou avisos vigentes/);
 assert.equal(isHidden(p,'#week-agenda-error'),true);assert.equal(isHidden(p,'#week-highlights-error'),true);
});

test('week links identify project, document or notice and include the escaped title for screen readers',async()=>{
 for(const [kind,label,href] of [['project','projeto','#projetos'],['document','documento','#documentos'],['notice','aviso','#avisos']]){
  const title='Atividade <img src=x onerror=alert(1)>';
  const p=page(empty,{now:fixedNow});
  respond(p,{'/public/api':empty,'/public/highlights':{items:[{kind,title,description:'Descrição <script>alert(1)</script>'}]}});
  await p.load();await p.loadHighlights();
  const link=p.document.querySelector('#week-items a.text-link');
  assert.equal(link.getAttribute('href'),href);
  assert.ok(link.textContent.startsWith('Ver '+label));
  assert.equal(link.querySelector('.sr-only').textContent,': '+title);
  assert.equal(link.querySelector('[aria-hidden="true"]').textContent,'→');
  assert.equal(p.document.querySelector('#week-items img,#week-items script'),null);
  assert.doesNotMatch(link.textContent,/Ver conteúdo/);
 }
});

test('invalid dataset responses keep prior good content and show only the affected error',async()=>{
 const p=page(empty,{now:fixedNow});
 respond(p,{'/public/api':empty,'/public/content':sampleContent,'/public/highlights':sampleHighlights});
 await Promise.all([p.load(),p.loadContent(),p.loadHighlights()]);
 respond(p,{'/public/highlights':{items:null}});
 await p.loadHighlights();
 assert.equal(isHidden(p,'#week-highlights-error'),false);
 assert.equal(isHidden(p,'#week-agenda-error'),true);assert.equal(isHidden(p,'#documents-error'),true);
 assert.match(p.document.querySelector('#week-items').textContent,/Encontro da comunidade/);
 respond(p,{'/public/content':{items:null}});
 await p.loadContent();
 assert.equal(isHidden(p,'#documents-error'),false);
 assert.match(p.document.querySelector('#projects').textContent,/Horta da escola/);
 assert.match(p.document.querySelector('#documents').textContent,/Orientações às famílias/);
});
