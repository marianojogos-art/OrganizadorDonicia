import {sgeOrigins} from '../../src/sge-origin.mjs';
import '../../sge-connector/page-runtime.mjs';
const allowed=()=>sgeOrigins.includes(location.origin)&&location.pathname.startsWith('/sge8105/');
const send=data=>window.ReactNativeWebView?.postMessage(JSON.stringify({channel:'donicia-mobile-sge',pageUrl:location.origin+location.pathname,...data}));
window.__doniciaMobile={request(message){
 if(!allowed())return;
 try{
  if(message.kind==='snapshot'){
   const grid=document.querySelector('#GRIDTURMA,#GRIDDISCIPLINA,#GRIDPLANEJADO,#MAINFORM');
   // Login fields, HTML, cookies and passwords never cross the bridge.
   const data=grid?window.__doniciaSge.snapshot():{type:'unrecognized'};
   send({id:message.id,data});
  }else if(message.kind==='open')send({id:message.id,data:window.__doniciaSge.open(message.action)});
  else throw Error('Comando não reconhecido.');
 }catch(error){send({id:message.id,error:error?.message?String(error.message).replace(/[\x00-\x1f]/g,' ').slice(0,1000):'Página ou ação de consulta não reconhecida. Abra os planejamentos no SGE e tente novamente.'})}
}};
send({ready:true});
