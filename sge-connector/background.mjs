import {createSgeReader} from '../src/sge-reader.mjs';
const organizerOrigins=new Set(['https://organizadordonicia.carijo.workers.dev','http://127.0.0.1:8787']);
import {sgeOrigins,allowedSgeUrl as allowed} from '../src/sge-origin.mjs';
let running=false;
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function completed(tabId){
 let timer,listener;
 const promise=new Promise((resolve,reject)=>{
  listener=(id,change)=>{if(id===tabId&&change.status==='complete'){cleanup();resolve()}};
  timer=setTimeout(()=>{cleanup();reject(Error('A página do SGE demorou a abrir. Verifique sua sessão e tente novamente.'))},25000);
  chrome.tabs.onUpdated.addListener(listener);
 });
 const cleanup=()=>{clearTimeout(timer);chrome.tabs.onUpdated.removeListener(listener)};
 return {promise,cancel(){cleanup();}};
}
async function snapshot(tabId){
 await chrome.scripting.executeScript({target:{tabId},world:'MAIN',files:['page-runtime.js']});
 const result=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:()=>window.__doniciaSge.snapshot()});
 if(!result[0]?.result)throw Error('Não foi possível ler a página do SGE. Verifique se a sessão está autenticada.');
 return result[0].result;
}
async function move(tabId,action){
 const wait=completed(tabId);
 try{await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:action=>window.__doniciaSge.open(action),args:[action]});await wait.promise;return await snapshot(tabId)}catch(e){wait.cancel();throw e}
}
async function navigate(tabId,url){
 const wait=completed(tabId);
 try{await chrome.tabs.update(tabId,{url:allowed(url)});await wait.promise;return await snapshot(tabId)}catch(e){wait.cancel();throw e}
}
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 let origin;try{origin=new URL(sender.url).origin}catch{return false}
 if(!organizerOrigins.has(origin))return false;
 if(message.command==='ping'){sendResponse({ok:true,data:{version:'1.2.1',progress:true,selective:true}});return false}
 if(!['directory','teachers','planning'].includes(message.command))return false;
 if(running){sendResponse({error:'Já há uma consulta ao SGE em andamento. Aguarde.'});return false}
 running=true;
 (async()=>{
  let tabId;
  try{
   const tabs=await chrome.tabs.query({url:sgeOrigins.map(origin=>origin+'/sge8105/*')});
   const source=tabs.find(t=>new URL(t.url).pathname.toLowerCase().endsWith('/hselgerenciamentoplanoaula.aspx'));
   if(!source)throw Error('Entre no SGE e deixe aberta a página 1, com a lista de turmas dos planejamentos.');
   const tab=await chrome.tabs.create({url:'about:blank',active:false});tabId=tab.id;
   await navigate(tabId,source.url);
   const progress=async update=>{if(sender.tab?.id&&typeof message.id==='string')await chrome.tabs.sendMessage(sender.tab.id,{channel:'donicia-sge-progress',id:message.id,progress:update}).catch(()=>{})};
   const reader=createSgeReader({snapshot:()=>snapshot(tabId),navigate:url=>navigate(tabId,url),move:action=>move(tabId,action)});
   const data=message.command==='directory'?await reader.directory(progress):message.command==='teachers'?await reader.teachers(message.input):await reader.planning(message.input,progress);
   // Release the tab and busy flag before the UI starts the next assignment.
   await chrome.tabs.remove(tabId).catch(()=>{});tabId=null;running=false;sendResponse({data});
  }catch(e){if(tabId)await chrome.tabs.remove(tabId).catch(()=>{});tabId=null;running=false;sendResponse({error:e.message})}finally{if(tabId)await chrome.tabs.remove(tabId).catch(()=>{});running=false}
 })();return true;
});
