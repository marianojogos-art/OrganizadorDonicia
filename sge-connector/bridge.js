const doniciaOrigin=location.origin;
window.addEventListener('message',async event=>{
 if(event.source!==window||event.origin!==doniciaOrigin||event.data?.channel!=='donicia-sge-request'||typeof event.data.id!=='string')return;
 const {id,command,input}=event.data;if(!['ping','directory','teachers','planning'].includes(command))return;
 try{const result=await chrome.runtime.sendMessage({id,command,input});window.postMessage({channel:'donicia-sge-response',id,...result},doniciaOrigin)}catch{window.postMessage({channel:'donicia-sge-response',id,error:'Não foi possível conectar à extensão SGE. Recarregue o Organizador.'},doniciaOrigin)}
});
chrome.runtime.onMessage.addListener(message=>{
 if(message?.channel==='donicia-sge-progress'&&typeof message.id==='string')window.postMessage(message,doniciaOrigin);
});
