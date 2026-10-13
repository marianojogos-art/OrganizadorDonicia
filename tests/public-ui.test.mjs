import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';

const html=await readFile(new URL('../src/public.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\nloadPublic\(\);\s*$/,'');
function page(data){
 const {document,window}=parseHTML(html),calls=[];
 const context=vm.createContext({document,Intl,Date,fetch:async(...args)=>{calls.push(args);return {ok:true,json:async()=>data}}});
 vm.runInContext(script,context);
 return {document,window,calls,context,load:()=>vm.runInContext('loadPublic()',context)};
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
