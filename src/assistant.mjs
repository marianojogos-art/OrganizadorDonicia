import {readLimitedBody} from './xerox.mjs';

// No model, outbound fetch, index, conversation storage or client-selected source.
// Readers are separate capabilities supplied by the Worker after authorization.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie, Cf-Access-Jwt-Assertion'}});
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const stop=new Set('a as o os e de da do das dos em na no nas nos para por com um uma que qual quais como quando onde meu minha meus minhas eu quero preciso saber sobre escola donicia tem esta estao sao solicitar pedido pedidos'.split(' '));
const tokens=value=>[...new Set(normalize(value).split(/[^a-z0-9]+/).filter(word=>word.length>2&&!stop.has(word)))];
const excerpt=value=>String(value??'').slice(0,2000);
const source=(title,text,url,keywords='',date='')=>({title:excerpt(title),excerpt:excerpt(text),url,keywords,date});
const fields=(row,keys)=>keys.filter(key=>row[key]!==undefined&&row[key]!==null&&row[key]!=='').map(key=>`${key}: ${row[key]}`).join('\n');
const internalSources=[
 {pattern:/\b(xerox|copia|copias|impressao)\b/,path:'/api/xerox',section:'xerox',label:'Pedido de xerox',keys:['title','status','copies','deadline','review_reason']},
 {pattern:/\b(reserva|reservas|espaco|espacos)\b/,path:'/api/reservations',section:'espacos',label:'Reserva de espaço',keys:['space','date','start','end','purpose','status','review_reason']},
 {pattern:/\b(calendario|agenda|evento|eventos)\b/,path:'/api/events',section:'calendario',label:'Calendário interno',keys:['title','date','start','end','location','details']},
 {pattern:/\b(formacao|formacoes)\b/,path:'/api/trainings',section:'formacao',label:'Formação',keys:['title','area','date','start','end','location','notes']},
 {pattern:/\b(tarefa|tarefas)\b/,path:'/api/tasks',section:'tarefas',label:'Tarefa',keys:['title','status','due','description']},
 {pattern:/\b(ata|atas)\b/,path:'/api/minutes',section:'atas',label:'Ata',keys:['title','date','decisions']},
 {pattern:/\b(nota|notas)\b/,path:'/api/notes',section:'notas',label:'Nota pessoal',keys:['title','content','updated_at']},
 {pattern:/\b(solicitacao|solicitacoes|material|materiais|mensagem)\b/,path:'/api/staff-requests',section:'solicitacoes',label:'Solicitação',keys:['title','type','status','description','review_reason']}
];

export async function assistant(request,{readPublic,readStaff,user}){
 if(request.method!=='POST')return json({error:'Método indisponível'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Origem inválida'},403);
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return json({error:'JSON necessário'},415);
 let data;
 try{data=JSON.parse(await readLimitedBody(request,4096))}catch(error){return json({error:'Pergunta inválida ou muito longa'},error.status||400)}
 if(!data||Array.isArray(data)||Object.keys(data).some(key=>key!=='question')||typeof data.question!=='string'||!data.question.trim()||data.question.length>500)return json({error:'Envie somente uma pergunta de até 500 caracteres'},400);
 const question=normalize(data.question),terms=tokens(data.question);
 try{
  const portal=await readPublic('/public/api');
  const school=portal.school||{};
  const contact={label:'Secretaria da escola',url:'/#contatos',phone:school.phone||'',email:school.email||''};
  const base={mode:'consulta-fontes',scope:readStaff?'staff':'public',contact,checkedAt:new Date().toISOString()};
  if(readStaff&&/\b(criar|novo|nova|pedir|reservar|solicitar|registrar|anotar|agendar|enviar)\b/.test(question)){
   const actions=[
    [/\b(xerox|copia|copias|impressao)\b/,'new-xerox','Pedido de xerox',false],
    [/\b(reserva|reservas|reservar|espaco|espacos)\b/,'new-booking','Reserva de espaço',false],
    [/\b(material|materiais|mensagem|solicitacao)\b/,'new-request','Mensagem ou material',false],
    [/\b(tarefa|tarefas)\b/,'new-task','Tarefa',true],
    [/\b(ata|atas)\b/,'new-minute','Ata',true],
    [/\b(nota|notas|anotar)\b/,'new-note','Nota pessoal',true],
    [/\b(formacao|formacoes)\b/,'new-training','Formação',true],
    [/\b(evento|eventos|agenda|calendario)\b/,'new-event','Evento',true]
   ];
   const action=actions.find(([pattern])=>pattern.test(question));
   if(action){
    if(action[3]&&!['direction','supervision','guidance'].includes(user?.role))return json({...base,answer:'Esta ação não está disponível no seu perfil. Procure a equipe pedagógica.',sources:[]});
    const workflow=({'new-booking':'reservation','new-xerox':'xerox','new-request':'message'})[action[1]];
    return json({...base,answer:`Posso ajudar com ${action[2].toLowerCase()}. Vamos preencher os dados e revisar antes de salvar. Nada foi registrado ainda.`,sources:[],action:{form:action[1],label:action[2],workflow,impact:workflow==='reservation'&&user.role!=='teacher'?'A reserva da equipe pedagógica será criada como aprovada e ocupará o horário.':'O pedido será registrado para análise da equipe; o registro não significa aprovação ou atendimento.'}});
   }
  }
  const family=/\b(documento|documentos|declaracao|declaracoes|historico|vaga|vagas|matricula|matriculas|transferencia|transferencias)\b/.test(question);
  if(family){
   const topic=/\b(transferencia|transferencias)\b/.test(question)?'transferência':/\b(vaga|vagas|matricula|matriculas)\b/.test(question)?'vagas e matrícula':'documentos escolares';
   return json({...base,answer:`Para ${topic}, entre em contato com a secretaria pelos canais publicados em Contatos. Não tenho confirmação dos requisitos, prazos ou disponibilidade para o seu caso. Esta conversa oferece orientação: não registra pedido, não reserva vaga e não efetiva transferência. Não envie documentos ou dados pessoais por aqui.`,sources:[source('Orientações às famílias','A secretaria orienta sobre matrículas, transferências e documentos. Confirme os procedimentos e horários antes de ir à escola.','/#contatos')].map(({keywords,...item})=>item)});
  }
  let candidates=[];
  const internal=readStaff?internalSources.find(item=>item.pattern.test(question)):null;
  if(internal){
   const rows=await readStaff(internal.path);
   if(rows===null)return json({...base,answer:'Não tenho uma fonte disponível para esta consulta no seu acesso. Procure a equipe pedagógica na área de funcionários.',sources:[]});
   candidates=rows.map(row=>source(internal.label+' · '+(row.title||row.space||'Registro'),fields(row,internal.keys),'/equipe#'+internal.section,internal.label,row.date||row.updated_at||''));
  }else{
   candidates=[
    source('Sobre a escola',school.introduction,'/#escola','ensino anos etapas apresentacao'),
    source('Localização',school.address,'/#contatos','endereco localizacao onde fica'),
    source('Contato da secretaria',[school.phone,school.email,school.whatsapp_secretaria?'WhatsApp da secretaria: '+school.whatsapp_secretaria:''].filter(Boolean).join('\n'),'/#contatos','telefone email contato secretaria falar whatsapp'),
    source('Atendimento',school.hours||'Não há horário de atendimento confirmado nesta fonte. Confirme com a secretaria.','/#contatos','horario horarios atendimento secretaria'),
    ...(portal.notices||[]).map(row=>source(row.title,row.body,'/#avisos','aviso avisos comunicado comunicados',row.date)),
    ...(portal.events||[]).map(row=>source(row.title,fields(row,['date','start','end','location','type']),'/#calendario','calendario agenda evento eventos',row.date))
   ];
   // Only explicitly published descriptions; never attachments, crawled links or images.
   const content=await readPublic('/public/content');
   candidates.push(...content.items.map(row=>source(row.title,row.description,row.kind==='project'?'/#projetos':'/#documentos',row.kind==='project'?'projeto projetos':'documento documentos',row.updated_at)));
  }
  const ranked=candidates.filter(item=>item.excerpt).map(item=>({...item,score:terms.reduce((sum,term)=>sum+(tokens(item.title+' '+item.excerpt+' '+item.keywords).includes(term)?1:0),internal?1:0)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score);
  const sources=ranked.slice(0,5).map(({keywords,score,...item})=>item);
  return json({...base,answer:sources.length?'Encontrei estas referências nas fontes disponíveis. São trechos dos registros, não uma confirmação de que respondem a todos os detalhes da sua pergunta. Confira as datas e abra a fonte; se faltar informação, fale com a secretaria ou com a equipe responsável.':'Não encontrei uma resposta confirmada nas fontes disponíveis para esta pergunta. Fale com a secretaria pelos contatos publicados. Para assuntos internos, procure a equipe pedagógica. Você também pode tentar um assunto mais específico.',sources});
 }catch{return json({error:'Não foi possível consultar as fontes agora. Tente novamente ou consulte os contatos da secretaria em /#contatos.'},503)}
}
