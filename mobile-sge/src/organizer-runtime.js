const origin='https://organizadordonicia.carijo.workers.dev';
if(location.origin===origin&&!window.__doniciaNativeInstalled){
 window.__doniciaNativeInstalled=true;
 const send=message=>window.ReactNativeWebView?.postMessage(JSON.stringify({channel:'donicia-native-organizer',...message}));
 window.__doniciaNativeReply=message=>window.postMessage(message,origin);
 window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==origin||event.data?.channel!=='donicia-sge-request'||typeof event.data.id!=='string'||!['ping','directory','teachers','planning'].includes(event.data.command))return;
  send({id:event.data.id,command:event.data.command,input:event.data.input});
 });
 // Keep the website's own forms, grouping, filters and persistence unchanged.
 // Adapt only the connector installation instructions to the native transport.
 function setup(){
  const element=document.querySelector('.supervision-setup');if(!element||element.dataset.nativeSge)return;
  element.dataset.nativeSge='true';element.innerHTML='<summary>Conectar ao SGE no aplicativo</summary><p>Entre no SGE pelo botão abaixo, abra os planejamentos de turmas e volte ao Organizador. Depois, consulte e confirme as turmas nesta mesma página.</p><button class="button outline" type="button" data-native-sge-open>Entrar no SGE</button><p class="small">A conexão já está integrada ao aplicativo. Mantenha-o aberto durante a consulta.</p>';
 }
 document.addEventListener('click',event=>{
  if(event.target.closest('[data-native-sge-open]')){event.preventDefault();send({command:'open-sge'});return}
  const link=event.target.closest('a[href]');if(!link)return;
  try{const u=new URL(link.href,origin);if(u.protocol==='https:'&&['www.sgebr.net.br','sgebr.net.br'].includes(u.hostname)){event.preventDefault();send({command:'open-sge',url:u.href})}}catch{}
 });
 function watch(){
  if(!document.documentElement){document.addEventListener('DOMContentLoaded',watch,{once:true});return}
  const observer=new MutationObserver(setup);observer.observe(document.documentElement,{childList:true,subtree:true});setup();
 }
 watch();
}
