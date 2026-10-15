import {highlightFields} from './pedagogical-workflows.mjs';
import {xeroxFields,XeroxInputError} from './xerox.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const team=user=>['direction','supervision','guidance'].includes(user?.role);
const pattern=/^\/api\/public-content(?:\/([A-Za-z0-9_-]{1,100})(?:\/(image))?)?$/;
export const isPublicContentRoute=path=>pattern.test(path);
const fail=(message,status=400)=>{throw new XeroxInputError(message,status)};
const text=(value,max,required=false)=>{if(typeof value!=='string'||value.length>max||required&&!value.trim()||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))fail('Confira os textos do conteúdo');return value.trim()};
function link(value){const raw=text(value,2000);if(!raw)return '';let url;try{url=new URL(raw)}catch{fail('Link HTTPS inválido')}if(url.protocol!=='https:'||url.username||url.password||/[\s\\]/.test(raw))fail('Use um link HTTPS público sem credenciais');return url.href}
const selection='id,kind,title,description,category,url,image_alt,updated_at';
export async function publicContent(request,DB){
 const path=new URL(request.url).pathname;
 if(!['GET','HEAD'].includes(request.method))return json({error:'Método indisponível'},405);
 if(path==='/public/highlights'){
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const active="published=1 AND featured=1 AND (highlight_from='' OR highlight_from<=?) AND (highlight_until='' OR highlight_until>=?)";
  const [notices,content]=await Promise.all([
   DB.prepare("SELECT id,title,body AS description,date,highlight_until FROM notices WHERE "+active+" AND date<=? AND (expires_on='' OR expires_on>=?) ORDER BY date DESC,id").bind(today,today,today,today).all(),
   DB.prepare('SELECT '+selection+",highlight_until FROM public_content WHERE "+active+" ORDER BY updated_at DESC,id").bind(today,today).all()
  ]);
  return json({items:[...notices.results.map(row=>({...row,kind:'notice',url:'/#avisos'})),...content.results.map(row=>({...row,url:row.kind==='project'?'/#projetos':'/#documentos'}))].slice(0,12)});
 }
 if(path==='/public/content'){
  const rows=(await DB.prepare('SELECT '+selection+",CASE WHEN attachment_data<>'' THEN 1 ELSE 0 END AS has_image FROM public_content WHERE published=1 ORDER BY kind,category,title").all()).results;
  return json({items:rows.map(({has_image,...row})=>({...row,image:has_image?'/public/projects/'+encodeURIComponent(row.id)+'/image':''}))});
 }
 const id=/^\/public\/projects\/([A-Za-z0-9_-]{1,100})\/image$/.exec(path)?.[1];
 const row=id?await DB.prepare("SELECT attachment_mime,attachment_data FROM public_content WHERE id=? AND kind='project' AND published=1 AND attachment_data<>''").bind(id).first():null;
 if(!row)return json({error:'Imagem não encontrada'},404);
 return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(row.attachment_data),c=>c.charCodeAt(0)),{headers:{'Content-Type':row.attachment_mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Referrer-Policy':'no-referrer'}});
}
export async function managePublicContent(request,DB,user,data){
 if(!team(user))return json({error:'Acesso exclusivo da equipe pedagógica'},403);
 const match=pattern.exec(new URL(request.url).pathname),id=match?.[1],method=request.method;
 if(match?.[2]){if(method!=='GET')return json({error:'Método indisponível'},405);const row=await DB.prepare("SELECT attachment_mime,attachment_data FROM public_content WHERE id=? AND attachment_data<>''").bind(id).first();if(!row)return json({error:'Imagem não encontrada'},404);return new Response(Uint8Array.from(atob(row.attachment_data),c=>c.charCodeAt(0)),{headers:{'Content-Type':row.attachment_mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}})}
 if(method==='GET'&&!id)return json((await DB.prepare('SELECT '+selection+',published,version,attachment_name,featured,highlight_from,highlight_until FROM public_content ORDER BY kind,category,title').all()).results.map(row=>({...row,published:!!row.published})));
 if(!['POST','PATCH','DELETE'].includes(method)||method==='POST'&&id||method!=='POST'&&!id)return json({error:'Método indisponível'},405);
 try{
  const old=id?await DB.prepare('SELECT * FROM public_content WHERE id=?').bind(id).first():null;
  if(id&&!old)return json({error:'Registro não encontrado'},404);
  if(id&&(!Number.isInteger(data.version)||data.version<1))fail('Versão necessária');
  if(id&&data.version!==old.version)fail('Este conteúdo mudou. Atualize a tela',409);
  const allowed=['kind','title','description','category','url','published','image_alt','attachment','remove_attachment','authorization_confirmed','version','featured','highlight_from','highlight_until'];
  if(Object.keys(data).some(key=>!allowed.includes(key)))fail('Campo não permitido');
  let statement;const recordId=id||crypto.randomUUID();
  if(method==='DELETE')statement=DB.prepare('DELETE FROM public_content WHERE id=? AND version=?').bind(id,data.version);
  else{
   if(!['project','document'].includes(data.kind)||old&&old.kind!==data.kind)fail('Tipo de conteúdo inválido');
   if(typeof data.published!=='boolean')fail('Publicação inválida');
   if(data.authorization_confirmed!==undefined&&typeof data.authorization_confirmed!=='boolean')fail('Confirmação inválida');
   // Every public save, including replacement text or images, needs fresh confirmation.
   if(data.published&&data.authorization_confirmed!==true)fail('Confirme a autorização para publicação pública');
   const title=text(data.title,160,true),description=text(data.description??'',4000),category=text(data.category??'Geral',80,true),url=link(data.url??''),alt=text(data.image_alt??'',300);
   if(data.kind==='document'&&!url)fail('Informe o link público do documento');
   if(data.kind==='document'&&(data.attachment||data.remove_attachment||alt))fail('Documentos usam somente links públicos');
   if(data.attachment&&!['image/png','image/jpeg'].includes(data.attachment.type))fail('Use somente imagem JPEG ou PNG');
   const [,,,name,mime,base64]=xeroxFields({attachment:data.attachment,remove_attachment:data.remove_attachment},user,old||{});
   if(base64&&!alt)fail('Descreva a imagem para leitores de tela');
   let highlight;try{highlight=highlightFields(data,old||{})}catch(e){fail(e.message)}
   const values=[title,description,category,url,Number(data.published),name,mime,base64,alt,...highlight];
   statement=id?DB.prepare('UPDATE public_content SET title=?,description=?,category=?,url=?,published=?,attachment_name=?,attachment_mime=?,attachment_data=?,image_alt=?,featured=?,highlight_from=?,highlight_until=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=?').bind(...values,id,data.version):DB.prepare('INSERT INTO public_content(title,description,category,url,published,attachment_name,attachment_mime,attachment_data,image_alt,featured,highlight_from,highlight_until,id,kind,creator) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...values,recordId,data.kind,user.email);
  }
  const results=await DB.batch([statement,DB.prepare('INSERT INTO audit(id,actor,action,target) SELECT ?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),user.email,method,'/api/public-content/'+recordId)]);
  if(!results[0].meta?.changes)return json({error:'Este conteúdo mudou. Atualize a tela'},409);
  return json(method==='POST'?{id:recordId}:{ok:true},method==='POST'?201:200);
 }catch(error){if(error instanceof XeroxInputError)return json({error:error.message},error.status);return json({error:'Não foi possível salvar o conteúdo'},503)}
}
