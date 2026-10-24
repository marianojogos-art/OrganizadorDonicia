import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
const script=await readFile(new URL('../src/public-assets/assistant.js',import.meta.url),'utf8');
function page(path='/',respond=async()=>({answer:'Não encontrei informação confirmada.',sources:[]})){
 const {document,window}=parseHTML('<html><body></body></html>'),calls=[];
 const fetch=async(url,options)=>{calls.push({url,options});if(url==='/api/me')return {ok:true,json:async()=>({role:'teacher'})};return {ok:true,json:async()=>respond(url,options)}};
 const context=vm.createContext({document,location:{pathname:path},fetch,AbortController,CustomEvent:window.CustomEvent,crypto});vm.runInContext(script,context);
 const click=selector=>document.querySelector(selector).dispatchEvent(new window.Event('click'));
 const submit=async question=>{document.querySelector('#da-question').value=question;document.querySelector('[data-question]').dispatchEvent(new window.Event('submit'));await new Promise(resolve=>setImmediate(resolve))};
 return {document,calls,click,submit};
}
test('public assistant starts collapsed, with family priorities and no automatic question request',()=>{
 const p=page();assert.equal(p.calls.length,0);assert.equal(p.document.querySelector('.da-panel').hidden,true);
 const labels=[...p.document.querySelectorAll('.da-shortcuts button')].map(x=>x.textContent);assert.deepEqual(labels.slice(0,3),['Pedir documentos','Consultar vagas','Solicitar transferência']);
 p.click('.da-launch');assert.equal(p.document.querySelector('.da-panel').hidden,false);assert.equal(p.document.querySelector('.da-launch').getAttribute('aria-expanded'),'true');
});
test('public question sends no identity/context/history and renders sources as safe text',async()=>{
 const payload='<img src=x onerror=alert(1)>',p=page('/',async()=>({answer:payload,sources:[{title:payload,excerpt:payload,url:'javascript:alert(1)'}]}));p.click('.da-launch');await p.submit('Qual o telefone?');
 assert.equal(p.calls[0].url,'/public/assistant');assert.equal(p.calls[0].options.credentials,'omit');assert.deepEqual(JSON.parse(p.calls[0].options.body),{question:'Qual o telefone?'});
 assert.equal(p.document.querySelector('[data-answer] img'),null);assert.match(p.document.querySelector('[data-answer]').textContent,/<img/);assert.equal(p.document.querySelector('[data-answer] article a').getAttribute('href'),null);
 p.click('[data-close]');assert.equal(p.document.querySelector('[data-answer]').textContent,'');assert.equal(p.document.querySelector('#da-question').value,'');
});
test('staff uses authenticated route and opens only a reviewed action proposal',async()=>{
 const p=page('/equipe',async()=>({answer:'Nada foi registrado ainda.',sources:[],action:{form:'new-xerox',label:'Pedido de xerox'}}));p.click('.da-launch');await p.submit('Quero pedir xerox');
 const request=p.calls.find(x=>x.url==='/api/assistant');assert.equal(request.options.credentials,'same-origin');assert.equal(p.calls.some(x=>x.url==='/public/assistant'),false);
 assert.match(p.document.querySelector('[data-answer] button').textContent,/Preencher e revisar/);assert.equal(p.calls.some(x=>x.url==='/api/xerox'),false);
});
test('source outage is an error, not a successful answer or fabricated information',async()=>{
 const p=page('/',async()=>{throw Error('Fontes indisponíveis')});p.click('.da-launch');await p.submit('Que horas?');assert.match(p.document.querySelector('[data-status]').textContent,/Fontes indisponíveis/);assert.equal(p.document.querySelector('[data-answer] a').getAttribute('href'),'/#contatos');assert.equal(p.document.querySelector('[data-question] button').disabled,false);
});
test('source date display uses pt-BR and preserves date-only and timestamp calendar days',async()=>{
 const p=page('/',async()=>({answer:'Referências',sources:[{title:'Evento',excerpt:'Data: 01/03/2026',date:'2026-03-01',url:'/#calendario'},{title:'Documento',excerpt:'Texto',date:'2028-02-29 00:15:00',url:'/#documentos'}]}));
 p.click('.da-launch');await p.submit('calendário');
 assert.deepEqual([...p.document.querySelectorAll('[data-answer] small')].map(x=>x.textContent),['Data na fonte: 01/03/2026','Data na fonte: 29/02/2028 00:15:00']);
});
test('closing discards delayed sensitive answers',async()=>{
 let release;const p=page('/equipe',()=>new Promise(resolve=>{release=resolve}));p.click('.da-launch');await p.submit('notas pessoais');p.click('[data-close]');release({answer:'PRIVADO',sources:[]});await new Promise(resolve=>setImmediate(resolve));assert.doesNotMatch(p.document.querySelector('[data-answer]').textContent,/PRIVADO/);
});
