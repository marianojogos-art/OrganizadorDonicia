const positionKey='donicia-feedback-position-v1',draftKey='donicia-feedback-draft-v1',visitorKey='donicia-feedback-visitor-v1';
const read=key=>{try{return JSON.parse(localStorage.getItem(key))}catch{return null}};
const write=(key,value)=>{try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value))}catch{}};
const freshId=()=>crypto.randomUUID();
export function clampPosition(position,size,viewport){
 const inset=8,left=Number(viewport.left)||0,top=Number(viewport.top)||0;
 const minX=left+inset,minY=top+inset,maxX=Math.max(minX,left+viewport.width-size.width-inset),maxY=Math.max(minY,top+viewport.height-size.height-inset);
 return {x:Math.min(maxX,Math.max(minX,Number.isFinite(position.x)?position.x:minX)),y:Math.min(maxY,Math.max(minY,Number.isFinite(position.y)?position.y:minY))};
}
export function pageContext(doc,loc){
 const staff=doc.querySelector('#nav [aria-current="page"]'),hash=loc.hash.replace(/^#/,'');
 let section=staff?.dataset.section||(/^[a-zA-Z0-9_-]{1,80}$/.test(hash)?hash:'');
 const target=section?doc.getElementById(section):null;
 let title=staff?doc.querySelector('#title')?.textContent:target?.querySelector('h2,h1,h3')?.textContent;
 if(!title)title=doc.querySelector('h1')?.textContent||doc.title||'Página inicial';
 const dialog=doc.querySelector('.modal[aria-label]');if(dialog)title+=' · '+dialog.getAttribute('aria-label');
 return {path:loc.pathname,section,title:title.replace(/\s+/g,' ').trim().slice(0,180)};
}
export function mountFeedback(doc=document,win=window){
 if(doc.getElementById('donicia-feedback'))return;
 let draft=read(draftKey);if(!draft||typeof draft.message!=='string'||draft.message.length>3000)draft={message:'',kind:'improvement',contributor:'',id:freshId(),page:null};
 let visitor=read(visitorKey);if(typeof visitor!=='string'||!/^[0-9a-f-]{36}$/i.test(visitor)){visitor=freshId();write(visitorKey,visitor)}
 const stored=read(positionKey)||{},root=doc.createElement('aside');root.id='donicia-feedback';root.setAttribute('aria-labelledby','df-heading');
 root.innerHTML='<header class="df-header"><div class="df-grip" role="button" tabindex="0" aria-label="Mover post-it. Arraste ou use as teclas de seta."><strong id="df-heading">✎ Site em construção</strong><span>Arraste pelo topo · deixe sua ideia</span></div><button class="df-toggle" type="button" aria-controls="df-body" aria-expanded="true" aria-label="Recolher post-it">−</button></header><div class="df-body" id="df-body"><p class="df-intro">Suas impressões ajudam a construir o Organizador. Conte o que melhorar ou o que você gostaria de encontrar aqui.</p><div class="df-page"><strong>Anotando sobre:</strong><span class="df-page-title"></span><br><span class="df-page-path"></span><button class="df-use-page" type="button" hidden>Usar a página atual</button></div><form><label>Tipo de contribuição<select name="kind"><option value="impression">Minha impressão</option><option value="improvement">Proposta de melhoria</option><option value="feature">Nova implementação</option></select></label><label>Sua anotação<textarea name="message" maxlength="3000" placeholder="O que funcionou? O que pode melhorar? Qual é sua ideia?" required></textarea></label><div class="df-count">0 / 3000</div><label class="df-name">Seu nome ou apelido (opcional)<input name="contributor" maxlength="80" autocomplete="nickname"></label><label class="df-trap" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><button class="df-send" type="submit">Enviar contribuição</button><p class="df-status" role="status" aria-live="polite"></p></form></div>';
 doc.body.append(root);
 const grip=root.querySelector('.df-grip'),toggle=root.querySelector('.df-toggle'),body=root.querySelector('.df-body'),form=root.querySelector('form'),message=form.elements.message,kind=form.elements.kind,contributor=form.elements.contributor,status=root.querySelector('.df-status'),usePage=root.querySelector('.df-use-page');
 message.value=draft.message;kind.value=['impression','improvement','feature'].includes(draft.kind)?draft.kind:'improvement';contributor.value=typeof draft.contributor==='string'?draft.contributor.slice(0,80):'';
 let position={x:stored.x,y:stored.y},collapsed=stored.collapsed===true,drag=null,busy=false,layoutFrame=null;
 const viewport=()=>({left:win.visualViewport?.offsetLeft||0,top:win.visualViewport?.offsetTop||0,width:win.visualViewport?.width||win.innerWidth,height:win.visualViewport?.height||win.innerHeight});
 function rememberPosition(){write(positionKey,{...position,collapsed})}
 function layout(){
  const view=viewport();root.style.width=Math.min(collapsed?300:368,Math.max(1,view.width-16))+'px';root.style.maxHeight=Math.max(44,view.height-16)+'px';
  const box=root.getBoundingClientRect();if(!Number.isFinite(position.x)||!Number.isFinite(position.y))position={x:view.left+view.width-box.width-20,y:view.top+Math.min(100,Math.max(8,(view.height-box.height)/2))};
  position=clampPosition(position,{width:box.width,height:box.height},view);root.style.left=position.x+'px';root.style.top=position.y+'px';
 }
 function scheduleLayout(){if(layoutFrame!==null)return;layoutFrame=win.requestAnimationFrame(()=>{layoutFrame=null;layout();rememberPosition()})}
 function collapse(){
  root.classList.toggle('df-collapsed',collapsed);body.hidden=collapsed;toggle.textContent=collapsed?'+':'−';toggle.setAttribute('aria-expanded',String(!collapsed));toggle.setAttribute('aria-label',collapsed?'Abrir post-it':'Recolher post-it');layout();rememberPosition();
 }
 function contextChanged(){
  const current=pageContext(doc,win.location),page=draft.page||current;
  root.querySelector('.df-page-title').textContent=page.title;
  root.querySelector('.df-page-path').textContent=page.path+(page.section?'#'+page.section:'');
  usePage.hidden=!draft.message.trim()||current.path===page.path&&current.section===page.section&&current.title===page.title;
 }
 function saveDraft(){
  draft.message=message.value;draft.kind=kind.value;draft.contributor=contributor.value;
  if(draft.message.trim()&&!draft.page)draft.page=pageContext(doc,win.location);
  if(!draft.message.trim()){draft.page=null;draft.id=freshId()}
  write(draftKey,draft);root.querySelector('.df-count').textContent=message.value.length+' / 3000';contextChanged();
 }
 grip.addEventListener('pointerdown',event=>{
  if(event.button!==0||drag)return;
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,origin:{...position}};grip.setPointerCapture(event.pointerId);root.classList.add('df-dragging');event.preventDefault();
 });
 grip.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;position={x:drag.origin.x+event.clientX-drag.x,y:drag.origin.y+event.clientY-drag.y};layout()});
 const finishDrag=()=>{if(!drag)return;drag=null;root.classList.remove('df-dragging');rememberPosition()};
 grip.addEventListener('pointerup',finishDrag);grip.addEventListener('pointercancel',finishDrag);grip.addEventListener('lostpointercapture',finishDrag);
 grip.addEventListener('keydown',event=>{const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!moves[event.key])return;event.preventDefault();const step=event.shiftKey?30:10;position={x:position.x+moves[event.key][0]*step,y:position.y+moves[event.key][1]*step};layout();rememberPosition()});
 toggle.addEventListener('click',()=>{collapsed=!collapsed;collapse()});
 for(const control of [message,kind,contributor])control.addEventListener('input',()=>{if(busy)return;saveDraft();status.textContent='Rascunho salvo neste navegador.'});
 usePage.addEventListener('click',()=>{if(busy)return;draft.page=pageContext(doc,win.location);draft.id=freshId();saveDraft()});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!message.value.trim())return;saveDraft();busy=true;
  const payload={id:draft.id,visitorId:visitor,kind:draft.kind,message:draft.message,contributor:draft.contributor,page:{...draft.page},website:form.elements.website.value};
  for(const control of form.elements)control.disabled=true;usePage.disabled=true;status.textContent='Enviando sua contribuição…';
  const controller=new AbortController(),timer=win.setTimeout(()=>controller.abort(),15000);
  try{
   const response=await fetch('/public/feedback',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível enviar agora.');
   draft={message:'',kind:kind.value,contributor:contributor.value,id:freshId(),page:null};message.value='';write(draftKey,draft);root.querySelector('.df-count').textContent='0 / 3000';contextChanged();status.textContent='Contribuição enviada! A equipe recebeu sua ideia com a página de origem.';
  }catch(error){status.textContent=(error.name==='AbortError'?'O envio demorou mais que o esperado. Tente novamente.':error.message||'Não foi possível enviar agora.')+' Seu rascunho continua salvo.'}
  finally{win.clearTimeout(timer);busy=false;for(const control of form.elements)control.disabled=false;usePage.disabled=false;layout()}
 });
 win.addEventListener('resize',scheduleLayout);win.addEventListener('hashchange',contextChanged);win.visualViewport?.addEventListener('resize',scheduleLayout);win.visualViewport?.addEventListener('scroll',scheduleLayout);
 doc.addEventListener('donicia:page-change',contextChanged);
 const heading=doc.querySelector('#title');if(heading)new MutationObserver(contextChanged).observe(heading,{childList:true,subtree:true,characterData:true});
 new ResizeObserver(scheduleLayout).observe(root);
 contextChanged();saveDraft();collapse();
 return {root,layout,contextChanged};
}
if(typeof document!=='undefined')mountFeedback();
