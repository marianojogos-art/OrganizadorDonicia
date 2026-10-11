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
 vm.runInContext("currentUser={email:'demo@example.test',role:'direction'};users=[currentUser];render()",context);
 const click=element=>element.dispatchEvent(new window.Event('click',{bubbles:true}));
 return {document,window,context,click,active:()=>active};
}
test('mobile menu opens, closes on navigation and Escape, and restores useful focus',()=>{
 const {document,window,context,click,active}=page(),toggle=document.querySelector('.nav-toggle');
 click(toggle);assert.equal(toggle.getAttribute('aria-expanded'),'true');
 click(document.querySelector('[data-section="tarefas"]'));
 assert.equal(toggle.getAttribute('aria-expanded'),'false');assert.equal(document.querySelector('#title').textContent,'Tarefas');
 assert.equal(document.querySelector('[aria-current="page"]').dataset.section,'tarefas');assert.equal(active().id,'main-content');
 click(toggle);const escape=new window.Event('keydown',{bubbles:true});Object.defineProperty(escape,'key',{value:'Escape'});toggle.dispatchEvent(escape);
 assert.equal(toggle.getAttribute('aria-expanded'),'false');assert.equal(active(),toggle);
 vm.runInContext("currentUser.role='teacher';nav()",context);assert.equal(document.querySelector('[data-section="supervisao"]'),null);
});
test('responsive tables retain headers, cell contents and functional controls after relabeling',()=>{
 const {document,window,context}=page();
 document.querySelector('#page').innerHTML='<table class="table"><thead><tr><th>Professor</th><th>Auxiliar</th></tr></thead><tbody><tr><td>Nome longo &amp; equipe</td><td><button id="assignment">Distribuir aula</button></td></tr></tbody></table>';
 const button=document.querySelector('#assignment');let clicks=0;button.addEventListener('click',()=>clicks++);
 vm.runInContext("responsiveTables(document.querySelector('#page'));responsiveTables(document.querySelector('#page'))",context);
 assert.equal(document.querySelector('table').getAttribute('role'),'table');assert.equal(document.querySelector('th').getAttribute('scope'),'col');
 assert.deepEqual([...document.querySelectorAll('td')].map(x=>x.dataset.label),['Professor','Auxiliar']);
 assert.equal(document.querySelector('td').textContent,'Nome longo & equipe');assert.equal(document.querySelector('#assignment'),button);
 button.dispatchEvent(new window.Event('click'));assert.equal(clicks,1);
});
