// Shared presentation only. The server independently decides which sources are allowed.
const staff=['/equipe','/equipe/','/index.html'].includes(location.pathname);
const root=document.createElement('aside');root.id='donicia-assistant';root.setAttribute('aria-label','Atendimento Donícia');
root.innerHTML=`<section class="da-panel" id="da-panel" aria-labelledby="da-title" hidden><header><h2 id="da-title">${staff?'Assistente da equipe':'Como podemos ajudar?'}</h2><button type="button" data-close aria-label="Fechar atendimento">×</button></header><div class="da-body"><p>${staff?'Consulte as fontes disponíveis no seu acesso.':'Olá! Sou o assistente de atendimento da Donícia. Encontre orientações e contatos da escola.'}</p><p class="da-help">Consulta às fontes do site. Não envie nomes de alunos, documentos, informações de saúde ou outros dados sensíveis. As perguntas não são salvas pelo assistente nem enviadas a serviços de IA.</p><div class="da-shortcuts"></div><form data-question><label for="da-question">Sua dúvida</label><textarea id="da-question" maxlength="500" rows="2" required placeholder="Sobre qual assunto você precisa de ajuda?"></textarea><button type="submit">Consultar fontes</button></form><p class="da-help" role="status" data-status></p><div data-answer></div><div data-intake></div><button type="button" data-clear>Limpar conversa</button></div></section><button type="button" class="da-launch" aria-expanded="false" aria-controls="da-panel">${staff?'Assistente da equipe':'Fale com o assistente'}</button>`;
document.body.append(root);
const find=selector=>root.querySelector(selector),panel=find('.da-panel'),launch=find('.da-launch'),input=find('#da-question'),answer=find('[data-answer]'),status=find('[data-status]');
let controller=null,viewCycle=0;
function close(){viewCycle++;controller?.abort();panel.hidden=true;launch.setAttribute('aria-expanded','false');answer.replaceChildren();input.value='';status.textContent='';find('[data-intake]').replaceChildren();launch.focus()}
launch.addEventListener('click',()=>{if(!panel.hidden){close();return}panel.hidden=false;launch.setAttribute('aria-expanded','true');input.focus()});
find('[data-close]').addEventListener('click',close);
root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();close()}});
find('[data-clear]').addEventListener('click',()=>{viewCycle++;controller?.abort();answer.replaceChildren();input.value='';status.textContent='';find('[data-intake]').replaceChildren();input.focus()});
function node(tag,text){const element=document.createElement(tag);element.textContent=text;return element}
// Preserve the source day and any time suffix without applying the browser timezone.
const displayDate=value=>String(value).replace(/^(\d{4})-(\d{2})-(\d{2})(?=$|[ T])/,'$3/$2/$1');
function link(text,url){const a=node('a',text);if(/^\/(?!\/)/.test(url))a.href=url;if(staff&&/^\/equipe#[a-z-]+$/.test(url))a.dataset.section=url.split('#')[1];return a}
async function ask(question){
 const cycle=++viewCycle;controller?.abort();const active=new AbortController();controller=active;
 answer.replaceChildren();status.textContent='Consultando as fontes…';const submit=find('[data-question] button');submit.disabled=true;
 try{
  const response=await fetch(staff?'/api/assistant':'/public/assistant',{method:'POST',credentials:staff?'same-origin':'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({question}),signal:active.signal,redirect:'error',cache:'no-store'});
  if([401,403].includes(response.status))throw Error('Entre novamente na área de funcionários para consultar as fontes do seu acesso.');
  const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível consultar as fontes.');
  if(active.signal.aborted||cycle!==viewCycle)return;
  const message=node('p',data.answer);message.className='da-result';answer.append(message);
  if(staff&&data.action){
   if(['reservation','xerox','message'].includes(data.action.workflow)){const guided=node('button','Conversar passo a passo');guided.type='button';guided.addEventListener('click',()=>startWorkflow(data.action));answer.append(guided)}
   const action=node('button','Preencher e revisar · '+data.action.label);action.type='button';action.addEventListener('click',()=>{close();document.dispatchEvent(new CustomEvent('donicia-assistant-action',{detail:{form:data.action.form}}))});answer.append(action);
  }
  for(const item of data.sources||[]){const article=node('article','');article.append(link(item.title,item.url),node('blockquote',item.excerpt));if(item.date)article.append(node('small','Data na fonte: '+displayDate(item.date)));answer.append(article)}
  answer.append(link('Falar com a secretaria · contatos publicados','/#contatos'));
  status.textContent='Consulta concluída. Confira as referências abaixo.';
 }catch(error){if(active.signal.aborted||cycle!==viewCycle)return;status.textContent=error.message||'Falha de conexão. Tente novamente.';answer.append(link('Contatos da secretaria','/#contatos'))}
 finally{if(controller===active)submit.disabled=false}
}
find('[data-question]').addEventListener('submit',event=>{event.preventDefault();if(input.value.trim())ask(input.value.trim())});
const shortcuts=staff?['Pedidos de xerox','Reservas de espaços','Calendário','Formação','Notas pessoais']:['Pedir documentos','Consultar vagas','Solicitar transferência','Horário de atendimento','Calendário'];
for(const text of shortcuts){const button=node('button',text);button.type='button';button.addEventListener('click',()=>{input.value=text;ask(text);if(!staff&&/documentos|vagas|transferência/.test(text))showIntake(text)});find('.da-shortcuts').append(button)}
if(staff){
 for(const text of ['Quero reservar um espaço','Quero pedir xerox','Quero enviar uma mensagem']){const button=node('button',text);button.type='button';button.addEventListener('click',()=>{input.value=text;ask(text)});find('.da-shortcuts').append(button)}

}

function startWorkflow(action){
 const spaces=['Biblioteca','Auditório','Sala de informática','Laboratório de ciências','Sala de jogos','Sala de projetos','Quadra coberta','Quadra descoberta'];
 const workflows={
  reservation:[['space','Qual espaço você quer reservar?',spaces],['date','Para qual data?','date'],['start','Qual o horário de início?','time'],['end','Qual o horário de término?','time'],['responsible','Quem será o responsável?','text'],['purpose','Qual atividade será realizada?','text']],
  xerox:[['title','Qual é o título do material?','text'],['copies','Quantas cópias?','number'],['deadline','Para qual data você precisa?','date']],
  message:[['type','Você quer enviar uma mensagem ou pedir material?',[['message','Mensagem'],['material','Material']]],['title','Qual o assunto?','text'],['classes','A quais turmas se refere? Sem nomes de alunos.','text'],['description','O que você precisa? Não inclua dados sensíveis.','text'],['deadline','Qual a data desejada para retorno?','date']]
 };
 const steps=workflows[action.workflow],values={};let id=crypto.randomUUID(),index=0;
 answer.replaceChildren();status.textContent='Preenchimento guiado · nada foi enviado.';
 const container=node('div','');answer.append(container);
 const render=()=>{
  container.replaceChildren();
  if(index===steps.length){
   container.append(node('strong','Revise antes de confirmar'));
   for(const [key,label,options] of steps){const value=Array.isArray(options)?options.find(option=>Array.isArray(option)&&option[0]===values[key])?.[1]||values[key]:values[key];container.append(node('p',label+' '+value))}
   container.append(node('p',action.impact));
   const confirm=node('button','Confirmar e registrar'),back=node('button','Corrigir dados');confirm.type=back.type='button';container.append(back,confirm);
   back.addEventListener('click',()=>{id=crypto.randomUUID();index=0;render()});
   confirm.addEventListener('click',async()=>{
    confirm.disabled=true;back.disabled=true;status.textContent='Registrando…';
    try{const response=await fetch('/api/assistant/execute',{method:'POST',credentials:'same-origin',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action:action.workflow,data:values,confirmed:true})});const result=await response.json();if(response.status===400)back.disabled=false;if(!response.ok)throw Error(result.error||'Não foi possível registrar');if(!result.confirmed)throw Error('Não foi possível confirmar o resultado');container.replaceChildren(node('p','Registro confirmado no sistema. Identificador: '+result.id),link('Abrir registros','/equipe#'+({reservation:'espacos',xerox:'xerox',message:'solicitacoes'})[action.workflow]));status.textContent='Registro confirmado.';document.dispatchEvent(new CustomEvent('donicia-assistant-saved'))}
    catch(error){status.textContent=(error.message||'Resultado incerto.')+' Você pode repetir este mesmo envio sem criar outro registro. Se precisar corrigir, primeiro confira os registros no menu.';confirm.disabled=false}
   });return;
  }
  const [key,label,type]=steps[index],form=document.createElement('form'),prompt=node('label',label),input=document.createElement(Array.isArray(type)?'select':'input');input.id='da-step';prompt.htmlFor=input.id;input.required=true;
  if(Array.isArray(type)){for(const choice of type){const option=node('option',Array.isArray(choice)?choice[1]:choice);option.value=Array.isArray(choice)?choice[0]:choice;input.append(option)}}else{input.type=type;input.maxLength=key==='description'?2000:250;if(type==='number'){input.min='1';input.max='10000'}}
  if(values[key]!==undefined)input.value=values[key];const next=node('button','Continuar');next.type='submit';form.append(prompt,input,next);container.append(node('small',`Etapa ${index+1} de ${steps.length}`),form);
  form.addEventListener('submit',event=>{event.preventDefault();values[key]=type==='number'?Number(input.value):input.value.trim();index++;render()});input.focus();
 };render();
}

async function showIntake(topic){
 const cycle=viewCycle;const container=find('[data-intake]');container.replaceChildren();
 try{
  const response=await fetch('/public/secretariat-requests',{credentials:'omit',cache:'no-store',redirect:'error'});if(!response.ok)return;const config=await response.json();if(cycle!==viewCycle)return;
  if(!config.enabled){container.append(node('p','O registro de pedidos pelo site ainda não está habilitado. Use os contatos da secretaria.'));return}
  const kind=topic.includes('documentos')?'documents':topic.includes('vagas')?'vacancy':'transfer';
  container.innerHTML='<form data-request><h3>Registrar solicitação de contato</h3><p class="da-help">Somente o nome e um contato do responsável. Não informe dados do estudante. O pedido ficará na fila privada da Secretaria dentro do Organizador. Registrar não garante vaga, documento ou transferência.</p><label for="da-name">Seu nome (responsável)</label><input id="da-name" maxlength="80" autocomplete="name" required><label for="da-contact">Seu e-mail ou telefone para retorno</label><input id="da-contact" maxlength="150" autocomplete="email" required><button type="submit">Revisar solicitação</button></form><div data-review></div>';
  let requestData=null;
  container.querySelector('form').addEventListener('submit',event=>{event.preventDefault();for(const field of container.querySelectorAll('input,button[type=submit]'))field.disabled=true;requestData={id:crypto.randomUUID(),kind,name:find('#da-name').value.trim(),contact:find('#da-contact').value.trim(),consent:true};const review=find('[data-review]');review.replaceChildren(node('p',`${topic}\nResponsável: ${requestData.name}\nRetorno: ${requestData.contact}\nAo enviar, autorizo o uso desses dados pela equipe escolar para tratar esta solicitação.`));const send=node('button','Confirmar e registrar pedido');send.type='button';review.append(send);send.addEventListener('click',async()=>{send.disabled=true;try{const res=await fetch('/public/secretariat-requests',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(requestData),redirect:'error'});const result=await res.json();if(!res.ok)throw Error(result.error);container.replaceChildren(node('p',`Pedido registrado: ${result.id}. Situação: Registrado na fila da Secretaria, aguardando atendimento. Guarde este identificador. Não há confirmação de atendimento ou concessão de vaga.`))}catch(error){review.append(node('p',error.message||'Não foi possível registrar. Tente novamente com o mesmo pedido.'));send.disabled=false}})});
 }catch{container.append(node('p','Não foi possível verificar o registro de pedidos. Consulte a secretaria.'))}
}
