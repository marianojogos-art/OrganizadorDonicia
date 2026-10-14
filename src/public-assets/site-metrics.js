// Public portal counters only. Never import the feedback identity or private page state.
const mounted=new WeakSet();
const clickSections=new Set(['escola','avisos','calendario','contatos','redes','entrada_equipe']);
const whatsappSections=new Set(['whatsapp_secretaria','whatsapp_orientacao']);
export function mountSiteMetrics(doc=document,win=window){
 if(mounted.has(doc))return;mounted.add(doc);
 let store;try{store=win.sessionStorage}catch{return}
 const nav=win.navigator||{},key='donicia-metrics-tab-day-v1',optKey='donicia-metrics-off-v1';
 const disabled=()=>nav.doNotTrack==='1'||win.doNotTrack==='1'||nav.globalPrivacyControl===true||nav.webdriver===true;
 let stopped=false,sequence=Promise.resolve();const sent=new Map();
 function session(){
  if(stopped||disabled()||doc.visibilityState==='prerender')return null;
  try{if(store.getItem(optKey)==='1')return null;const day=new (win.Date||Date)().toISOString().slice(0,10);let value;try{value=JSON.parse(store.getItem(key)||'null')}catch{}
   if(!value||value.day!==day||typeof value.id!=='string'||!/^[0-9a-f-]{36}$/i.test(value.id)){value={day,id:win.crypto.randomUUID()};store.setItem(key,JSON.stringify(value))}return value.id;
  }catch{return null} // Storage blocked: skip metrics instead of inventing a stable identity.
 }
 function send(event,section){
  const sessionId=session();if(!sessionId)return;
  const stamp=(win.Date||Date).now(),dedup=event+':'+section;if(sent.has(dedup)&&stamp-sent.get(dedup)<2100)return;sent.set(dedup,stamp);
  const payload={eventId:win.crypto.randomUUID(),sessionId,event,section};
  // Serialize submissions: a click must not race the initial page view in D1.
  sequence=sequence.then(()=>{if(stopped||disabled())return;return win.fetch('/public/metrics',{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})}).catch(()=>{});
 }
 const onClick=e=>{
  if(e.isTrusted===false||e.button!==undefined&&e.button!==0)return;
  const control=e.target?.closest?.('[data-site-metric]');if(!control)return;
  const section=control.getAttribute('data-site-metric');
  if(whatsappSections.has(section))send('whatsapp_click',section);
  else if(clickSections.has(section))send('section_click',section);
 };
 const stop=()=>{stopped=true;try{store.setItem(optKey,'1');store.removeItem(key)}catch{}const control=doc.querySelector('[data-metrics-optout]');if(control){control.textContent='Métricas desativadas nesta aba';control.disabled=true}};
 doc.addEventListener('click',onClick);
 doc.querySelector('[data-metrics-optout]')?.addEventListener('click',stop);
 if(disabled()){const control=doc.querySelector('[data-metrics-optout]');if(control){control.textContent='Preferência de privacidade do navegador respeitada';control.disabled=true}}
 send('page_view','home');
 return {stop,settled:()=>sequence};
}
if(typeof document!=='undefined'&&typeof window!=='undefined')mountSiteMetrics();
