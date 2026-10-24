import {projectReview,returnedStatus,validReason} from './pedagogical-workflows.mjs';
import {xeroxFields,downloadAttachment,XeroxInputError} from './xerox.mjs';

const resources={
 'staff-requests':{table:'staff_requests',columns:['type','title','classes','description','deadline']},
 'pedagogical-album':{table:'pedagogical_album',columns:['title','description','date','attachment_name','attachment_mime','attachment_data']},
 'resource-library':{table:'resource_library',columns:['title','category','url','description']}
};
const pattern=/^\/api\/(staff-requests|pedagogical-album|resource-library)(?:\/([A-Za-z0-9_-]{1,100})(?:\/(attachment))?)?$/;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const failure=(message,status=400)=>{throw new XeroxInputError(message,status)};
const pedagogical=user=>['direction','supervision','guidance'].includes(user?.role);
const statuses=['Pendente','Em análise','Aprovada','Recusada','Concluída'];
const transitions={'Pendente':['Em análise','Aprovada','Recusada'],'Em análise':['Pendente','Aprovada','Recusada'],'Aprovada':['Concluída','Recusada'],'Recusada':['Pendente'],'Concluída':[]};
const text=(value,label,max,required=true)=>{
 if(typeof value!=='string'||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)||required&&!value.trim())failure('Confira '+label);
 return value.trim();
};
const date=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)failure('Data inválida');return value;
};
function safeLink(value){
 const raw=text(value,'o endereço HTTPS',2000);
 let url;try{url=new URL(raw)}catch{failure('Endereço HTTPS inválido')}
 if(url.protocol!=='https:'||url.username||url.password||!url.hostname||/[\s\\]/.test(raw))failure('Endereço HTTPS inválido');
 return url.href;
}
function fields(kind,data,user,previous={}){
 const value=(key,fallback='')=>data[key]===undefined?(previous[key]??fallback):data[key];
 const title=text(value('title'),'o título',160),description=text(value('description'),'a descrição',4000,false);
 if(kind==='staff-requests'){
  const type=value('type');if(!['message','material'].includes(type))failure('Tipo de solicitação inválido');
  return [type,title,text(value('classes'),'as turmas (sem nomes de alunos)',300),description,date(value('deadline'))];
 }
 if(kind==='resource-library'){
  const category=value('category');if(!['bncc','matriz','documentos'].includes(category))failure('Categoria inválida');
  return [title,category,safeLink(value('url')),description];
 }
 if(data.authorization_confirmed!==undefined&&typeof data.authorization_confirmed!=='boolean')failure('Confirmação de autorização inválida');
 if(data.attachment!==undefined&&data.authorization_confirmed!==true)failure('Confirme que possui autorização para guardar a foto no álbum privado');
 if(data.remove_attachment!==undefined)failure('A foto é obrigatória; exclua o registro para removê-la');
 if(data.attachment!==undefined&&!['image/jpeg','image/png'].includes(data.attachment?.type))failure('Anexe somente JPEG ou PNG');
 const [, , ,name,mime,base64]=xeroxFields({attachment:data.attachment},user,previous);
 if(!base64)failure('Foto obrigatória');
 return [title,description,date(value('date')),name,mime,base64];
}
export function isStaffServicesRoute(path){const match=pattern.exec(path);return !!match&&(!match[3]||match[1]==='pedagogical-album')}

// The worker authenticates the active user, checks same-origin CSRF and bounds JSON
// before calling this handler. This service also checks roles, ownership and versions.
export async function handleStaffServices(request,DB,user,data,assistantCreateId){
 const path=new URL(request.url).pathname,match=pattern.exec(path);
 if(!match||!isStaffServicesRoute(path))return null;
 const [,kind,id,attachment]=match,config=resources[kind],team=pedagogical(user),method=request.method;
 if(!user?.email||!team&&user.role!=='teacher')return json({error:'Sem permissão'},403);
 if(kind!=='staff-requests'&&!team)return json({error:'Sem permissão'},403);
 if(!['GET','POST','PATCH','DELETE'].includes(method)||attachment&&method!=='GET'||!id&&['PATCH','DELETE'].includes(method)||id&&method==='POST')return json({error:'Método não permitido'},405);
 const visible=kind==='staff-requests'&&!team?' AND requester=?':'';
 const args=kind==='staff-requests'&&!team?[user.email]:[];
 const table=config.table;
 try{
  // Lists return at most 500 records; attachments are never included in album lists.
  if(method==='GET'&&!id){
   const selection=kind==='pedagogical-album'?'id,creator,title,description,date,attachment_name,attachment_mime,version,created_at':'*';
   return json((await DB.prepare('SELECT '+selection+' FROM '+table+' WHERE 1=1'+visible+' ORDER BY '+(kind==='staff-requests'?'deadline':kind==='pedagogical-album'?'date DESC':'category,title')+' LIMIT 500').bind(...args).all()).results.map(row=>kind==='staff-requests'?projectReview(row):row));
  }
  let previous;
  if(id){previous=await DB.prepare('SELECT * FROM '+table+' WHERE id=?'+visible).bind(id,...args).first();if(!previous)return json({error:'Registro não encontrado'},404)}
  if(method==='GET'){
   if(attachment)return downloadAttachment(previous);
   if(kind==='pedagogical-album'){const {attachment_data,...metadata}=previous;return json(metadata)}
   return json(kind==='staff-requests'?projectReview(previous):previous);
  }
  if(!data||typeof data!=='object'||Array.isArray(data))failure('Dados inválidos');
  // Reject attempts to change identity or smuggle fields into a different resource.
  const allowed=new Set(['version',...config.columns.filter(key=>!key.startsWith('attachment_')),...(kind==='pedagogical-album'?['attachment','remove_attachment','authorization_confirmed']:[]),...(kind==='staff-requests'?['status','review_reason','resubmit']:[])]);
  if(Object.keys(data).some(key=>!allowed.has(key)))failure('Campo não permitido');
  if(id&&(!Number.isInteger(data.version)||data.version<1))failure('Versão do registro necessária');
  if(id&&data.version!==previous.version)failure('Este registro mudou. Atualize a tela',409);
  if(kind==='staff-requests'&&!team){
   if(data.review_reason!==undefined)failure('Somente a equipe pode justificar devoluções',403);
   if(data.status!==undefined&&data.status!=='Pendente')failure('Sem permissão para alterar a situação',403);
   if(id&&previous.needs_adjustment&&data.resubmit!==true&&method!=='DELETE')failure('Corrija e reenvie o pedido',409);
   if(id&&previous.status!=='Pendente')failure('Solicitação já está em atendimento',409);
  }
  const returning=kind==='staff-requests'&&data.status===returnedStatus;
  if(kind==='staff-requests'&&data.resubmit!==undefined&&(data.resubmit!==true||!id||!previous.needs_adjustment))failure('Pedido não está em ajustes',409);
  if(returning&&(!team||!id||previous.needs_adjustment||!['Pendente','Em análise'].includes(previous.status)))failure('Somente pedidos em análise podem ser devolvidos',409);
  if(returning&&!validReason(data.review_reason))failure('Informe a justificativa da devolução (até 2000 caracteres)');
  if(kind==='staff-requests'&&data.review_reason!==undefined&&!returning)failure('A justificativa acompanha uma devolução');
  if(kind==='staff-requests'&&id&&previous.needs_adjustment&&data.resubmit!==true&&data.status!==undefined&&method!=='DELETE')failure('Aguarde a correção e o reenvio',409);
  if(kind==='staff-requests'&&data.status!==undefined&&!returning&&!statuses.includes(data.status))failure('Situação inválida');
  if(kind==='staff-requests'&&id&&!returning&&data.status!==undefined&&data.status!==previous.status&&!transitions[previous.status].includes(data.status))failure('Transição inválida. Analise/aprove antes de concluir a solicitação',409);
  if(method==='POST'&&data.status!==undefined&&data.status!=='Pendente')failure('Novas solicitações começam pendentes');
  const recordId=id||assistantCreateId||crypto.randomUUID();let statement;
  if(method==='DELETE')statement=DB.prepare('DELETE FROM '+table+' WHERE id=? AND version=?'+visible).bind(id,data.version,...args);
  else{
   const values=fields(kind,data,user,previous);
   const columns=[...config.columns];
   if(kind==='staff-requests'){columns.push('status','needs_adjustment','review_reason');values.push(returning||data.resubmit?'Pendente':data.status??previous?.status??'Pendente',returning?1:data.resubmit?0:previous?.needs_adjustment??0,returning?data.review_reason.trim():previous?.review_reason??'')}
   statement=id?DB.prepare('UPDATE '+table+' SET '+columns.map(key=>key+'=?').join(',')+',version=version+1 WHERE id=? AND version=?'+visible).bind(...values,id,data.version,...args):DB.prepare('INSERT INTO '+table+'(id,'+(kind==='staff-requests'?'requester':'creator')+','+columns.join(',')+') VALUES('+Array(columns.length+2).fill('?').join(',')+')').bind(recordId,user.email,...values);
  }
  const results=await DB.batch([statement,DB.prepare('INSERT INTO audit(id,actor,action,target) SELECT ?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),user.email,method,'/api/'+kind+'/'+recordId)]);
  if(!results[0].meta?.changes)return json({error:'Este registro mudou. Atualize a tela'},409);
  return json(method==='POST'?{id:recordId}:{ok:true},method==='POST'?201:200);
 }catch(error){
  if(error instanceof XeroxInputError)return json({error:error.message},error.status);
  return json({error:'Não foi possível acessar o serviço'},503);
 }
}
