import {assistant} from './assistant.mjs';
import {executeAssistantAction} from './assistant-actions.mjs';
import {secretariatRequests} from './secretariat-requests.mjs';
import {intakeEnabled,manageSecretariatIntake} from './secretariat-intake.mjs';
import {canAccessSecretariat,manageSecretariatAccess} from './secretariat-access.mjs';
import {projectReview,returnedStatus,validReason,highlightFields} from './pedagogical-workflows.mjs';
import {isPublicContentRoute,publicContent,managePublicContent} from './public-content.mjs';
import {ingestMetrics,readMetrics} from './site-metrics.mjs';
import {isStaffServicesRoute,handleStaffServices} from './staff-services.mjs';
import {resourceCatalog,resourceCategories} from './resource-catalog.mjs';
import {officialTrainingCalendar,officialTrainingSessions} from './official-trainings.mjs';
import {personalNotes} from './personal-notes.mjs';
import {submitFeedback,readFeedback,readFeedbackHistory,updateFeedback} from './site-feedback.mjs';
import {xeroxFields,downloadAttachment,readLimitedBody,XeroxInputError} from './xerox.mjs';
import {identity} from './auth.mjs';
import {readTeachers} from './teachers.mjs';
import {readSupervisionClasses,collectSupervision,snapshotAdapter,SupervisionError} from './supervision.mjs';
import {loadSupervision,saveSupervision,updateTargets} from './supervision-store.mjs';
import {consecutiveDates,mondayOf,makeSubstitutionPlan,PlanInputError} from './substitution-plan.mjs';
export const spaces=['Biblioteca','Auditório','Sala de informática','Laboratório de ciências','Sala de jogos','Sala de projetos','Quadra coberta','Quadra descoberta'];
const statuses=['Pendente','Em andamento','Concluída'];
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const validTime=s=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const text=(s,max=250)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
export const isPedagogical=user=>['direction','supervision','guidance'].includes(user?.role);
const optionalText=(s,max)=>s===undefined||s===null||(typeof s==='string'&&s.length<=max);
const eventTypes=['Reunião','Dia letivo','Feriado','Recesso','Conselho de classe','Evento escolar','Formação'];
const validEvent=data=>text(data.title)&&validDate(data.date)&&eventTypes.includes(data.type)&&['internal','public'].includes(data.visibility)&&(data.formation===undefined||[true,false,0,1].includes(data.formation))&&optionalText(data.area,150);
const validTraining=data=>text(data.title)&&text(data.area,150)&&validDate(data.date)&&optionalText(data.location,250)&&optionalText(data.notes,4000)&&optionalText(data.start,5)&&optionalText(data.end,5)&&((!data.start&&!data.end)||validTime(data.start)&&validTime(data.end)&&data.end>data.start);
const schoolFields=['name','introduction','address','phone','email','hours'];
const whatsappFields=['whatsapp_secretaria','whatsapp_orientacao'];
const validWhatsapp=value=>typeof value==='string'&&(value===''||/^\+?[1-9]\d{10,14}$/.test(value));
async function taskVerifier(DB,value){if(typeof value!=='string'||value.length>254)throw new XeroxInputError('Verificador inválido');if(value&&!await DB.prepare("SELECT email FROM users WHERE email=? AND active=1 AND role IN ('direction','supervision','guidance')").bind(value).first())throw new XeroxInputError('Escolha um verificador ativo da equipe pedagógica');return value}
const versionedPublicImages=Object.freeze(["/public-assets/donicia-2026-480.c67023d134b5.webp","/public-assets/donicia-2026-960.707952f5d28c.webp","/public-assets/donicia-2026-1440.f4d9f138aee3.webp"]);
async function serveAsset(request,env,pathname){
 if(!['GET','HEAD'].includes(request.method))return json({error:'Método indisponível'},405);
 const url=new URL(request.url);url.pathname=pathname;
 const asset=await env.ASSETS.fetch(new Request(url,request));const out=new Response(asset.body,asset);out.headers.set('Cache-Control',versionedPublicImages.includes(pathname)&&[200,304].includes(asset.status)?'public, max-age=31536000, immutable':'no-store');out.headers.set('X-Content-Type-Options','nosniff');out.headers.set('Referrer-Policy','same-origin');out.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; img-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");return out;
}
const eventDetails=(d,old={})=>{const start=d.start??old.start??'',end=d.end??old.end??'',location=d.location??old.location??'',details=d.details??old.details??'';if((start!==''||end!=='')&&(!validTime(start)||!validTime(end)||end<=start))throw new XeroxInputError('Confira início e término do evento');if(typeof location!=='string'||location.length>250||typeof details!=='string'||details.length>4000)throw new XeroxInputError('Local ou informações do evento inválidos');return [d.type==='Formação'||d.formation===true||d.formation===1?1:0,start,end,location.trim(),details.trim()]};
const contextValid=d=>['class','subject'].every(k=>d[k]===undefined||(typeof d[k]==='string'&&d[k].length<=100));
const fixedRange=d=>{if(!validDate(d.from_date)||!validDate(d.to_date)||d.to_date<d.from_date)return false;const first=new Date(d.from_date+'T12:00:00Z');first.setUTCDate(first.getUTCDate()+(d.weekday-first.getUTCDay()+7)%7);return first.toISOString().slice(0,10)<=d.to_date};
const schoolToday=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const weekOf=date=>{const monday=new Date(date+'T12:00:00Z');monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);return monday.toISOString().slice(0,10)};
async function handleInner(request,env,authenticate=identity,assistantCreateId){
 const path=new URL(request.url).pathname;
 if(path==='/'||path==='/public.html'||path==='/public.js'||path==='/public-assets/logo.jpg'||path==='/public-assets/donicia-2026.png'||path==='/public-assets/feedback.js'||path==='/public-assets/site-metrics.js'||path==='/public-assets/assistant.js'||path==='/public-assets/assistant.css'||path==='/public-assets/feedback.css'||versionedPublicImages.includes(path))return serveAsset(request,env,path==='/'?'/public.html':path);
 if(path==='/api/health')return json({ok:true,modules:['reservations','tasks','substitutions','auxiliaries','xerox','minutes','events','fixed-occupancy','trainings','notices','notes'],studentData:false});
 if(!env.DB)return json({error:'Persistência não configurada'},503);
 // This capability cannot address an internal endpoint, even for a logged-in visitor.
 const readAssistantPublic=async target=>{
  if(!['/public/api','/public/content'].includes(target))throw Error('source_not_public');
  const response=await handleInner(new Request(new URL(target,request.url)),env,async()=>null);
  if(!response.ok)throw Error('source_unavailable');return response.json();
 };
 if(path==='/public/assistant')return assistant(request,{readPublic:readAssistantPublic});
 if(path==='/public/secretariat-requests')return secretariatRequests(request,env);
 if(path==='/public/content'||path==='/public/highlights'||/^\/public\/projects\/[A-Za-z0-9_-]{1,100}\/image$/.test(path))return publicContent(request,env.DB);
 if(path==='/public/metrics')return ingestMetrics(request,env.DB);
 if(path==='/public/feedback')return submitFeedback(request,env.DB);
 if(path==='/public/api'||path==='/api/public'){
  if(request.method!=='GET')return json({error:'Método indisponível'},405);
  const [school,notices,events]=await Promise.all([env.DB.prepare('SELECT name,introduction,address,phone,email,hours,whatsapp_secretaria,whatsapp_orientacao FROM school_profile WHERE id=1').first(),env.DB.prepare('SELECT id,title,body,date FROM notices WHERE published=1 AND (expires_on=\'\' OR expires_on>=?) ORDER BY date DESC,id').bind(schoolToday()).all(),env.DB.prepare("SELECT id,title,date,CASE WHEN formation=1 THEN 'Formação' ELSE type END AS type,start,end,location FROM events WHERE visibility='public' ORDER BY date,title").all()]);
  return json({school,notices:notices.results,events:events.results});
 }
 const email=await authenticate(request,env);if(!email)return json({error:'Login institucional necessário'},401);
 const write=async(statement,target=path)=>{const results=await env.DB.batch([statement,env.DB.prepare('INSERT INTO audit(id,actor,action,target) SELECT ?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),email,request.method,target)]);if(path.split('/').length===4&&!results[0].meta?.changes)throw Error('version_conflict');return results[0]};
 const user=await env.DB.prepare('SELECT email,name,role FROM users WHERE email=? AND active=1').bind(email).first();if(!user)return json({error:'Usuário não autorizado pela direção'},403);
 if(!['direction','supervision','guidance','teacher','secretary'].includes(user.role))return json({error:'Perfil sem permissão'},403);
 if(path==='/api/secretariat-access/me')return request.method==='GET'?json({allowed:await canAccessSecretariat(env.DB,user),publicIntakeEnabled:await intakeEnabled(env.DB)}):json({error:'Método indisponível'},405);
 if(path==='/api/secretariat-intake')return manageSecretariatIntake(request,env.DB,user);
 if(path==='/api/secretariat-access')return manageSecretariatAccess(request,env.DB,user);
 if(['/equipe/secretaria/acessos','/equipe/secretariat-admin.js'].includes(path)){
  if(user.role!=='direction')return json({error:'Administração restrita à direção autenticada'},403);
  return serveAsset(request,env,path==='/equipe/secretaria/acessos'?'/secretariat-admin.html':'/secretariat-admin.js');
 }
 if(['/equipe/secretaria','/equipe/secretariat.js'].includes(path)){
  if(!await canAccessSecretariat(env.DB,user))return json({error:'Acesso à fila não concedido a esta conta'},403);
  return serveAsset(request,env,path==='/equipe/secretaria'?'/secretariat.html':'/secretariat.js');
 }
 if(user.role==='secretary'){
  if(path==='/api/me'&&request.method==='GET')return json(user);
  if(path==='/api/secretariat-requests'||/^\/api\/secretariat-requests\/[a-f0-9-]+$/.test(path))return secretariatRequests(request,env,user);
  if(['/equipe','/equipe/','/index.html'].includes(path)&&await canAccessSecretariat(env.DB,user))return serveAsset(request,env,'/secretariat.html');
  return json({error:'Este recurso não está disponível no perfil Secretaria'},403);
 }
 const pedagogical=isPedagogical(user);
 if(!pedagogical&&user.role!=='teacher')return json({error:'Perfil sem permissão'},403);
 if(path==='/api/assistant/execute')return executeAssistantAction(request,env.DB,user,(target,data,DB,id)=>handleInner(new Request(new URL(target,request.url),{method:'POST',headers:{Origin:new URL(request.url).origin,'Content-Type':'application/json'},body:JSON.stringify(data)}),{...env,DB},async()=>email,id));
 if(path==='/api/secretariat-requests'||/^\/api\/secretariat-requests\/[a-f0-9-]+$/.test(path))return secretariatRequests(request,env,user);
 if(path==='/api/assistant')return assistant(request,{readPublic:readAssistantPublic,user,readStaff:async target=>{
  const allowed=['/api/xerox','/api/reservations','/api/events','/api/trainings','/api/tasks','/api/minutes','/api/notes','/api/staff-requests'];
  if(!allowed.includes(target))throw Error('source_not_allowed');
  // Reuse existing endpoint authorization and owner filters with the verified identity.
  const response=await handleInner(new Request(new URL(target,request.url)),env,async()=>email);
  if(response.status===403)return null;
  if(!response.ok)throw Error('source_unavailable');return response.json();
 }});
 if(!pedagogical&&path.startsWith('/api/')){
  const read=request.method==='GET'&&(['/api/me','/api/reservations','/api/fixed-occupancy','/api/xerox','/api/events','/api/trainings','/api/official-trainings'].includes(path)||/^\/api\/xerox\/[^/]+\/attachment$/.test(path)||/^\/api\/staff-requests(?:\/[^/]+)?$/.test(path));
  const create=request.method==='POST'&&['/api/reservations','/api/xerox','/api/staff-requests'].includes(path);
  const change=['PATCH','DELETE'].includes(request.method)&&/^\/api\/(reservations|xerox|staff-requests)\/[^/]+$/.test(path);
  if(!read&&!create&&!change)return json({error:'Acesso exclusivo da equipe pedagógica'},403);
 }
 const preparePlan=async(teacher,date,extraDays)=>{
  const dates=consecutiveDates(date,extraDays);
  const directory=await readTeachers(env.DB);
  const rows=(await env.DB.prepare('SELECT s.id,s.version,s.date,s.week,s.start,s.end,s.class,s.teacher,s.auxiliary,s.completed,a.name AS aux FROM substitutions s LEFT JOIN auxiliaries a ON a.id=s.auxiliary WHERE s.week BETWEEN ? AND ? ORDER BY s.date,s.start').bind(mondayOf(date),mondayOf(dates.at(-1))).all()).results;
  const plan=await makeSubstitutionPlan(directory,teacher,date,extraDays,rows);
  const settings=await env.DB.prepare("SELECT value FROM settings WHERE key='auxiliary_weekly_limit'").first();
  return {...plan,limit:settings.value};
 };
 if(!path.startsWith('/api/')){
  if(path==='/sge-connector.zip'&&!pedagogical)return json({error:'Acesso exclusivo da equipe pedagógica'},403);
  const assets={'/equipe':'/index.html','/equipe/':'/index.html','/equipe/app.js':'/app.js','/index.html':'/index.html','/app.js':'/app.js','/sge-connector.zip':'/sge-connector.zip','/equipe/calendarios/formacao-outubro-2026.csv':'/formation-outubro-2026.csv'};
  return assets[path]?serveAsset(request,env,assets[path]):json({error:'Página não encontrada'},404);
 }
 if(request.method==='GET'){
  if(isPublicContentRoute(path))return managePublicContent(request,env.DB,user);
  if(path==='/api/site-metrics')return readMetrics(request,env.DB,user);
  if(isStaffServicesRoute(path))return handleStaffServices(request,env.DB,user);
  if(path==='/api/resource-catalog')return json({items:resourceCatalog,categories:resourceCategories});
  if(path==='/api/feedback')return readFeedback(request,env.DB);
  if(/^\/api\/feedback\/[^/]+\/history$/.test(path))return readFeedbackHistory(request,env.DB,user);
  if(path==='/api/official-trainings')return json({calendar:officialTrainingCalendar,sessions:officialTrainingSessions});
  if(path==='/api/notes'||/^\/api\/notes\/[^/]+$/.test(path))return personalNotes(request,env.DB,user);
  if(path==='/api/supervision/saved'){return json(await loadSupervision(env.DB))}
  if(path==='/api/supervision/classes'){try{return json(await readSupervisionClasses(env))}catch(e){return json({error:e instanceof SupervisionError?e.message:'Não foi possível consultar o SGE.'},e.status||503)}}
  if(path==='/api/me')return json(user);
  if(path==='/api/users')return json((await env.DB.prepare('SELECT email,name,role FROM users WHERE active=1 ORDER BY name').all()).results);
  if(path==='/api/teachers'){try{const {schedule,...directory}=await readTeachers(env.DB);return json(directory)}catch{return json({error:'Não foi possível ler os professores no WebHorário. Tente atualizar a lista.'},503)}}
  if(path==='/api/substitutions/preview'){
   if(!pedagogical)return json({error:'Somente a direção pode organizar substituições'},403);
   const query=new URL(request.url).searchParams;
   try{return json(await preparePlan(query.get('teacher'),query.get('date'),Number(query.get('extraDays')||0)))}catch(e){return json({error:e instanceof PlanInputError?e.message:'Não foi possível consultar a grade do WebHorário. Tente atualizar.'},e instanceof PlanInputError?e.status:503)}
  }
  if(path==='/api/auxiliaries/weekly'){
   const date=new URL(request.url).searchParams.get('date')||schoolToday();if(!validDate(date))return json({error:'Semana inválida'},400);
   const week=weekOf(date);
   const settings=await env.DB.prepare("SELECT value FROM settings WHERE key='auxiliary_weekly_limit'").first();
   const lessons=(await env.DB.prepare('SELECT id,date,start,end,class,teacher,auxiliary,completed FROM substitutions WHERE week=? AND auxiliary IS NOT NULL ORDER BY date,start').bind(week).all()).results;
   const auxiliaries=(await env.DB.prepare('SELECT id,name,active FROM auxiliaries WHERE active=1 OR id IN (SELECT auxiliary FROM substitutions WHERE week=?) ORDER BY name').bind(week).all()).results;
   return json({week,limit:settings.value,auxiliaries:auxiliaries.map(aux=>{const assigned=lessons.filter(s=>s.auxiliary===aux.id);const completed=assigned.filter(s=>s.completed===1).length;return {...aux,total:assigned.length,completed,scheduled:assigned.length-completed,remaining:Math.max(0,settings.value-assigned.length),lessons:assigned}})});
  }
  if(path==='/api/reservations'){
   const rows=(await env.DB.prepare("SELECT r.*,u.name AS owner_name FROM reservations r JOIN users u ON u.email=r.owner WHERE ?=1 OR r.owner=? OR r.status='Aprovada' ORDER BY date,start").bind(Number(pedagogical),email).all()).results;
   return json(rows.map(row=>pedagogical||row.owner===email?projectReview(row):{...row,owner:'',review_reason:''}));
  }
  if(path==='/api/settings')return json(await env.DB.prepare("SELECT value AS auxiliaryWeeklyLimit FROM settings WHERE key='auxiliary_weekly_limit'").first());
  if(path==='/api/fixed-occupancy')return json((await env.DB.prepare('SELECT '+(pedagogical?'*':'id,space,weekday,start,end,from_date,to_date,purpose,version,class,subject,responsible')+' FROM fixed_occupancy ORDER BY space,weekday,start').all()).results);
  if(path==='/api/audit'){if(!pedagogical)return json({error:'Sem permissão'},403);return json((await env.DB.prepare('SELECT * FROM audit ORDER BY created_at DESC LIMIT 100').all()).results)}
  if(path==='/api/auxiliaries')return json((await env.DB.prepare('SELECT * FROM auxiliaries WHERE active=1 ORDER BY name').all()).results);
  if(path==='/api/substitutions')return json((await env.DB.prepare('SELECT s.*,a.name AS aux FROM substitutions s LEFT JOIN auxiliaries a ON a.id=s.auxiliary ORDER BY date,start').all()).results);
  const attachmentPath=/^\/api\/xerox\/([^/]+)\/attachment$/.exec(path);
  if(attachmentPath){const row=await env.DB.prepare('SELECT attachment_name,attachment_mime,attachment_data FROM xerox WHERE id=? AND (?=1 OR requester=?)').bind(attachmentPath[1],Number(pedagogical),email).first();if(!row||!row.attachment_data)return json({error:'Anexo não encontrado'},404);return downloadAttachment(row)}
  if(path==='/api/xerox')return json((await env.DB.prepare('SELECT x.id,x.version,x.title,x.copies,x.deadline,x.requester,x.status,x.professor,x.class,x.color,x.attachment_name,x.attachment_mime,x.review_reason,u.name AS requester_name FROM xerox x JOIN users u ON u.email=x.requester WHERE ?=1 OR x.requester=? ORDER BY deadline').bind(Number(pedagogical),email).all()).results);
  if(path==='/api/minutes')return json((await env.DB.prepare('SELECT * FROM minutes ORDER BY date DESC').all()).results);
  if(path==='/api/events')return json((await env.DB.prepare("SELECT id,version,title,date,CASE WHEN formation=1 THEN 'Formação' ELSE type END AS type,"+(pedagogical?'creator,':'')+"formation,area,start,end,location,details,visibility FROM events ORDER BY date,start").all()).results);
  if(path==='/api/trainings')return json((await env.DB.prepare("SELECT id,title,area,date,start,end,location,details AS notes,version FROM events WHERE formation=1 ORDER BY date,start,area,title").all()).results);
  if(path==='/api/notices')return json((await env.DB.prepare('SELECT * FROM notices ORDER BY date DESC,id').all()).results.map(row=>({...row,published:!!row.published})));
  if(path==='/api/school')return json(await env.DB.prepare('SELECT name,introduction,address,phone,email,hours,whatsapp_secretaria,whatsapp_orientacao,version FROM school_profile WHERE id=1').first());
  if(path==='/api/tasks')return json((await env.DB.prepare('SELECT t.*,u.name AS owner_name,v.name AS verifier_name FROM tasks t JOIN users u ON u.email=t.owner LEFT JOIN users v ON v.email=t.verifier WHERE t.restricted=0 OR ?=1 OR t.owner=? OR t.creator=? ORDER BY due,created_at').bind(Number(pedagogical),email,email).all()).results);
  return json({error:'Rota indisponível'},404);
 }
 if(!['POST','PATCH','DELETE'].includes(request.method))return json({error:'Método indisponível'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Origem inválida'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON necessário'},415);
 let raw;try{raw=await readLimitedBody(request,['/api/supervision/preview','/api/supervision/save'].includes(path)?16_000_000:path==='/api/substitutions/from-schedule'?65536:/^\/api\/(?:xerox|pedagogical-album)(?:\/[^/]+)?$/.test(path)?380000:isPublicContentRoute(path)?380000:/^\/api\/notes(?:\/[^/]+)?$/.test(path)?20000:/^\/api\/(?:trainings|notices|events|school|staff-requests|resource-library)(?:\/[^/]+)?$/.test(path)?24000:8192)}catch(e){return json({error:e.message},e.status||400)}let data;try{data=JSON.parse(raw)}catch{return json({error:'JSON inválido'},400)}
 if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'Dados inválidos'},400);
 const resource=path==='/api/substitutions/from-schedule'?null:/^\/api\/(reservations|tasks|substitutions|auxiliaries|xerox|minutes|events|fixed-occupancy|trainings|notices)\/([^/]+)$/.exec(path);
 if(resource){if(!Number.isInteger(data.version)||data.version<1)return json({error:'Versão do registro necessária. Atualize a tela'},400);const table=resource[1]==='trainings'?'events':resource[1].replace('fixed-occupancy','fixed_occupancy');const row=await env.DB.prepare('SELECT version FROM '+table+' WHERE id=?'+(resource[1]==='trainings'?' AND formation=1':'')).bind(resource[2]).first();if(!row)return json({error:'Registro não encontrado'},404);if(row.version!==data.version)return json({error:'Este registro mudou. Atualize a tela'},409)}
 try{
  if(isPublicContentRoute(path))return await managePublicContent(request,env.DB,user,data);
  if(isStaffServicesRoute(path))return await handleStaffServices(request,env.DB,user,data,assistantCreateId);
  const verifyTask=/^\/api\/tasks\/([^/]+)\/verify$/.exec(path);
  if(verifyTask){
   if(request.method!=='POST')return json({error:'Método indisponível'},405);
   const row=await env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(verifyTask[1]).first();if(!row)return json({error:'Tarefa não encontrada'},404);
   if(!row.verifier||row.verifier!==email)return json({error:'Somente o verificador designado pode conferir esta tarefa'},403);
   if(!Number.isInteger(data.version)||data.version!==row.version)return json({error:'Tarefa mudou. Atualize antes de conferir'},409);
   if(row.status!=='Concluída'||row.verified_by)return json({error:'Conclua a tarefa antes de verificar, ou ela já foi verificada'},409);
   const result=await write(env.DB.prepare("UPDATE tasks SET verified_by=?,verified_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND version=? AND verifier=? AND status='Concluída' AND verified_by=''").bind(email,row.id,data.version,email));return result.meta?.changes?json({ok:true}):json({error:'Tarefa mudou. Atualize a tela'},409);
  }
  if(/^\/api\/feedback\/[^/]+$/.test(path))return await updateFeedback(request,env.DB,user,data);
  if(path==='/api/notes'||/^\/api\/notes\/[^/]+$/.test(path))return await personalNotes(request,env.DB,user,data);
  if(path==='/api/school'&&request.method==='PATCH'){
   if(!Number.isInteger(data.version)||data.version<1)return json({error:'Versão do cadastro necessária'},400);
   if(!text(data.name,150)||schoolFields.slice(1).some(key=>typeof data[key]!=='string'||data[key].length>(key==='introduction'?4000:500))||data.email&& !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))return json({error:'Informações da escola inválidas'},400);
   const previous=await env.DB.prepare('SELECT whatsapp_secretaria,whatsapp_orientacao FROM school_profile WHERE id=1').first();
   const contacts=whatsappFields.map(key=>data[key]??previous[key]);if(!contacts.every(validWhatsapp))return json({error:'WhatsApp deve ter DDI e somente dígitos, ou ficar vazio'},400);
   const result=await write(env.DB.prepare('UPDATE school_profile SET '+[...schoolFields,...whatsappFields].map(key=>key+'=?').join(',')+',version=version+1 WHERE id=1 AND version=?').bind(...schoolFields.map(key=>data[key].trim()),...contacts.map(value=>value.replace(/^\+/,'')),data.version));
   if(!result.meta?.changes)return json({error:'O cadastro mudou. Atualize a tela'},409);return json({ok:true});
  }
  if((path==='/api/trainings'||resource?.[1]==='trainings')&&['POST','PATCH'].includes(request.method)){
   if(path==='/api/trainings'&&request.method!=='POST'||resource&&request.method!=='PATCH')return json({error:'Método indisponível'},405);
   if(!validTraining(data))return json({error:'Confira título, área, data e horários da formação'},400);
   const values=[data.title.trim(),data.area.trim(),data.date,data.start||'',data.end||'',(data.location||'').trim(),(data.notes||'').trim()];
   if(resource){await write(env.DB.prepare('UPDATE events SET title=?,area=?,date=?,start=?,end=?,location=?,details=?,version=version+1 WHERE id=? AND version=? AND formation=1').bind(...values,resource[2],data.version));return json({ok:true})}
   const id=crypto.randomUUID();await write(env.DB.prepare("INSERT INTO events(id,title,area,date,start,end,location,details,creator,type,formation,visibility) VALUES(?,?,?,?,?,?,?,?,?,'Evento escolar',1,'internal')").bind(id,...values,email),path+'/'+id);return json({id},201);
  }
  if((path==='/api/notices'||resource?.[1]==='notices')&&['POST','PATCH'].includes(request.method)){
   if(path==='/api/notices'&&request.method!=='POST'||resource&&request.method!=='PATCH')return json({error:'Método indisponível'},405);
   if(!text(data.title)||!text(data.body,4000)||!validDate(data.date)||typeof data.published!=='boolean')return json({error:'Aviso inválido'},400);
   const expires=data.expires_on??(resource?(await env.DB.prepare('SELECT expires_on FROM notices WHERE id=?').bind(resource[2]).first()).expires_on:'');
   if(expires!==''&&(!validDate(expires)||expires<data.date))return json({error:'A validade deve ser igual ou posterior à data do aviso'},400);
   let highlight;try{highlight=highlightFields(data,resource?await env.DB.prepare('SELECT featured,highlight_from,highlight_until FROM notices WHERE id=?').bind(resource[2]).first():{},true)}catch(e){return json({error:e.message},400)}
   const values=[data.title.trim(),data.body.trim(),data.date,Number(data.published),expires,...highlight];
   if(resource){await write(env.DB.prepare('UPDATE notices SET title=?,body=?,date=?,published=?,expires_on=?,featured=?,highlight_from=?,highlight_until=?,version=version+1 WHERE id=? AND version=?').bind(...values,resource[2],data.version));return json({ok:true})}
   const id=crypto.randomUUID();await write(env.DB.prepare('INSERT INTO notices(id,title,body,date,published,expires_on,featured,highlight_from,highlight_until,creator) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,...values,email),path+'/'+id);return json({id},201);
  }
  if(resource?.[1]==='reservations'&&request.method==='PATCH'&&data.edit!==true){
   if(!pedagogical)return json({error:'Somente a equipe pedagógica pode decidir reservas'},403);
   if(!['Aprovada','Recusada',returnedStatus].includes(data.status))return json({error:'Decisão de reserva inválida'},400);
   const row=await env.DB.prepare('SELECT status,needs_adjustment FROM reservations WHERE id=?').bind(resource[2]).first();
   if(row.status!=='Pendente'||row.needs_adjustment)return json({error:'Somente pedidos pendentes e reenviados podem ser avaliados'},409);
   if(data.status===returnedStatus){if(!validReason(data.review_reason))return json({error:'Informe a justificativa da devolução (até 2000 caracteres)'},400);await write(env.DB.prepare("UPDATE reservations SET needs_adjustment=1,review_reason=?,version=version+1 WHERE id=? AND version=? AND status='Pendente' AND needs_adjustment=0").bind(data.review_reason.trim(),resource[2],data.version));return json({ok:true})}
   await write(env.DB.prepare("UPDATE reservations SET status=?,version=version+1 WHERE id=? AND version=? AND status='Pendente' AND needs_adjustment=0").bind(data.status,resource[2],data.version));return json({ok:true});
  }
  if(path==='/api/supervision/save'&&request.method==='POST'){
   try{
    const saved=await loadSupervision(env.DB);
    if(data.version!==saved.version)return json({error:'A consulta salva mudou. Recarregue os dados antes de atualizar.'},409);
    if(data.updateSituation!==undefined&&(typeof data.updateSituation!=='string'||data.updateSituation.length>200))return json({error:'Situação inválida'},400);
    let targets;
    if(data.updateSituation){
     if(!Array.isArray(data.classIds)||typeof data.teacher!=='string')return json({error:'Seleção inválida'},400);
     targets=updateTargets(saved,data);if(!targets.length)return json({error:'Nenhum planejamento salvo nessa Situação nas turmas e professor selecionados.'},400);
    }
    const fresh=await collectSupervision(data.snapshot?{SGE:snapshotAdapter(data.snapshot)}:env,{...data,targetAssignments:targets});
    for(const target of targets||[]){
     const coverage=fresh.coverage.find(c=>c.classId===target.classId);
     if(coverage?.ok&&!fresh.teachers.some(t=>t.assignments.some(a=>a.classId===target.classId&&a.assignmentId===target.assignmentId))){
      coverage.ok=false;coverage.errors.push('Vínculo selecionado não encontrado no SGE; dados anteriores preservados.');
      const old=saved.teachers.find(t=>t.assignments.some(a=>a.classId===target.classId&&a.assignmentId===target.assignmentId));
      const assignment=old.assignments.find(a=>a.classId===target.classId&&a.assignmentId===target.assignmentId);
      let teacher=fresh.teachers.find(t=>t.id===old.id);if(!teacher){teacher={id:old.id,name:old.name,plans:[],assignments:[]};fresh.teachers.push(teacher)}
      teacher.assignments.push({...assignment,ok:false});
     }
    }
    return json(await saveSupervision(env.DB,saved,fresh,{actor:email,actorName:user.name,situation:data.updateSituation||''}));
   }catch(e){return json({error:e instanceof SupervisionError?e.message:'Não foi possível salvar a consulta. Os dados anteriores foram preservados.'},e.status||503)}
  }
  if(path==='/api/supervision/preview'&&request.method==='POST'){
   try{return json(await collectSupervision(data.snapshot?{SGE:snapshotAdapter(data.snapshot)}:env,data))}catch(e){return json({error:e instanceof SupervisionError?e.message:'Não foi possível consultar os planejamentos no SGE.'},e.status||503)}
  }
  if(path==='/api/teachers/refresh'&&request.method==='POST'){
   if(!pedagogical)return json({error:'Somente a direção pode atualizar a lista'},403);
   try{const {schedule,...directory}=await readTeachers(env.DB,{force:true});return json(directory)}catch{return json({error:'Não foi possível atualizar a grade do WebHorário. Tente novamente.'},503)}
  }
  if(path==='/api/substitutions/from-schedule'&&request.method==='POST'){
   if(!pedagogical)return json({error:'Somente a direção pode organizar substituições'},403);
   let plan;try{plan=await preparePlan(data.teacher,data.date,data.extraDays)}catch(e){return json({error:e instanceof PlanInputError?e.message:'Não foi possível consultar a grade do WebHorário. Tente atualizar.'},e instanceof PlanInputError?e.status:503)}
   if(typeof data.fingerprint!=='string'||data.fingerprint!==plan.fingerprint)return json({error:'A grade ou os registros mudaram. Consulte as aulas novamente antes de salvar.'},409);
   if(plan.conflictCount)return json({error:'Há turmas com horários já registrados. Corrija os conflitos antes de salvar.'},409);
   const lessons=plan.lessons.filter(lesson=>!lesson.existing);
   if(!lessons.length)return json({error:'Não há novas aulas a registrar nesse intervalo.'},409);
   const active=(await env.DB.prepare('SELECT id FROM auxiliaries WHERE active=1').all()).results;
   const activeIds=new Set(active.map(aux=>aux.id));
   const validAux=value=>value===null||(typeof value==='string'&&activeIds.has(value));
   const auxiliary=data.auxiliary===undefined||data.auxiliary===''?null:data.auxiliary;
   const overrides=data.overrides===undefined?[]:data.overrides;
   if(!validAux(auxiliary)||!Array.isArray(overrides)||overrides.length>350)return json({error:'Distribuição de auxiliares inválida'},400);
   const keys=new Set(lessons.map(lesson=>lesson.key)),assignments=new Map();
   for(const override of overrides){if(!override||typeof override!=='object'||typeof override.key!=='string'||!keys.has(override.key)||assignments.has(override.key)||!validAux(override.auxiliary))return json({error:'Alteração de aula inválida. Consulte a grade novamente.'},400);assignments.set(override.key,override.auxiliary)}
   const absenceId=crypto.randomUUID(),ids=lessons.map(()=>crypto.randomUUID());
   const statements=[env.DB.prepare('INSERT INTO substitution_absences(id,teacher,start_date,total_days,source_version,creator) VALUES(?,?,?,?,?,?)').bind(absenceId,plan.teacher,plan.startDate,plan.totalDays,plan.sourceVersion,email)];
   // Nine rows × eleven bindings stays below D1's per-statement binding limit.
   for(let offset=0;offset<lessons.length;offset+=9){const chunk=lessons.slice(offset,offset+9);const values=chunk.flatMap((lesson,index)=>[ids[offset+index],lesson.date,lesson.week,lesson.start,lesson.end,lesson.class,plan.teacher,email,assignments.has(lesson.key)?assignments.get(lesson.key):auxiliary,absenceId,lesson.subject]);statements.push(env.DB.prepare('INSERT INTO substitutions(id,date,week,start,end,class,teacher,creator,auxiliary,absence_id,subject) VALUES '+chunk.map(()=>'(?,?,?,?,?,?,?,?,?,?,?)').join(',')).bind(...values))}
   statements.push(env.DB.prepare('INSERT INTO audit(id,actor,action,target) VALUES(?,?,?,?)').bind(crypto.randomUUID(),email,request.method,path+'/'+absenceId));
   await env.DB.batch(statements);
   return json({absenceId,ids,count:ids.length,totalDays:plan.totalDays,existingCount:plan.lessonCount-ids.length},201);
  }
  if(path==='/api/fixed-occupancy'&&request.method==='POST'){
   if(!pedagogical)return json({error:'Somente a direção pode definir horários fixos'},403);if(data.responsible!==undefined&&!text(data.responsible))return json({error:'Responsável inválido'},400);if(!spaces.includes(data.space)||!Number.isInteger(data.weekday)||data.weekday<0||data.weekday>6||!validTime(data.start)||!validTime(data.end)||data.end<=data.start||!validDate(data.from_date)||!validDate(data.to_date)||data.to_date<data.from_date||!fixedRange(data)||!contextValid(data)||!text(data.purpose))return json({error:'Ocupação fixa inválida'},400);const id=crypto.randomUUID();await write(env.DB.prepare('INSERT INTO fixed_occupancy(id,space,weekday,start,end,from_date,to_date,purpose,creator,class,subject,responsible) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,data.space,data.weekday,data.start,data.end,data.from_date,data.to_date,data.purpose.trim(),email,(data.class||'').trim(),(data.subject||'').trim(),typeof data.responsible==='string'?data.responsible.trim():user.name),path+'/'+id);return json({id},201);
  }
  if(resource&&((request.method==='PATCH'&&data.edit===true)||request.method==='DELETE')){
   const table=resource[1]==='trainings'?'events':resource[1].replace('fixed-occupancy','fixed_occupancy'),id=resource[2];const row=await env.DB.prepare('SELECT * FROM '+table+' WHERE id=?').bind(id).first();
   const owner=table==='xerox'?row.requester:row.owner;
   if(!pedagogical&&(!['reservations','tasks','xerox'].includes(table)||owner!==email))return json({error:'Sem permissão'},403);
   if(table==='xerox'&&!pedagogical&&!['Aguardando aprovação','Devolvido para ajustes'].includes(row.status))return json({error:'Pedido já aprovado ou encerrado'},409);
   if(table==='xerox'&&request.method==='PATCH'&&!['Aguardando aprovação','Devolvido para ajustes'].includes(row.status))return json({error:'Pedido já aprovado ou encerrado'},409);
   if(table==='reservations'&&!pedagogical&&request.method==='PATCH'&&row.status==='Aprovada')return json({error:'Reserva aprovada não pode ser editada. Cancele e envie outro pedido'},409);
   if(request.method==='DELETE'){
    if(table==='auxiliaries')await write(env.DB.prepare('UPDATE auxiliaries SET active=0,version=version+1 WHERE id=? AND version=?').bind(id,data.version));
    else await write(env.DB.prepare('DELETE FROM '+table+' WHERE id=? AND version=?').bind(id,data.version));return json({ok:true});
   }
   let columns=[],values=[];
   if(table==='reservations'){if(!spaces.includes(data.space)||!validDate(data.date)||!validTime(data.start)||!validTime(data.end)||data.end<=data.start||!text(data.purpose)||!text(data.responsible)||!contextValid(data))return json({error:'Confira espaço, data, horários, responsável e atividade'},400);columns=['space','date','start','end','purpose','responsible','class','subject','status','needs_adjustment'];values=[...columns.slice(0,-2).map(k=>(data[k]??row[k]??'').trim()),pedagogical?row.status:'Pendente',0];}
   if(table==='tasks'){if(!text(data.title)||!validDate(data.due)||typeof data.owner!=='string'||typeof data.restricted!=='boolean')return json({error:'Tarefa inválida'},400);if(!pedagogical&&(data.owner!==email||data.restricted!==!!row.restricted))return json({error:'Somente a direção pode delegar ou restringir'},403);if(!await env.DB.prepare('SELECT email FROM users WHERE email=? AND active=1').bind(data.owner).first())return json({error:'Responsável inválido'},400);columns=['title','due','owner','restricted','verifier','verified_by','verified_at'];values=[data.title,data.due,data.owner,Number(data.restricted),await taskVerifier(env.DB,data.verifier??row.verifier),'','']}
   if(table==='substitutions'){if(!validDate(data.date)||!validTime(data.start)||!validTime(data.end)||data.end<=data.start||!text(data.class,80)||!text(data.teacher,100))return json({error:'Aula inválida'},400);if(row.completed&&data.date>schoolToday())return json({error:'Aula realizada não pode ter data futura'},400);columns=['date','week','start','end','class','teacher'];values=[data.date,weekOf(data.date),data.start,data.end,data.class,data.teacher]}
   if(table==='auxiliaries'){if(!text(data.name,100))return json({error:'Nome inválido'},400);columns=['name'];values=[data.name]}
   if(table==='xerox'){if(!text(data.title)||!validDate(data.deadline)||!Number.isInteger(data.copies)||data.copies<1||data.copies>10000)return json({error:'Pedido inválido'},400);columns=['title','copies','deadline','professor','class','color','attachment_name','attachment_mime','attachment_data'];values=[data.title.trim(),data.copies,data.deadline,...xeroxFields(data,user,row)]}
   if(table==='minutes'){if(!text(data.title)||!validDate(data.date)||!text(data.participants,2000)||!text(data.decisions,4000))return json({error:'Ata inválida'},400);columns=['title','date','participants','decisions'];values=columns.map(k=>data[k])}
   if(table==='events'){if(!validEvent(data))return json({error:'Evento inválido; escolha calendário público ou interno'},400);columns=['title','date','type','formation','start','end','location','details','area','visibility'];values=[data.title.trim(),data.date,data.type==='Formação'?'Evento escolar':data.type,...eventDetails(data,row),(data.area??(row.area||(data.type==='Formação'||data.formation?'Geral':''))).trim(),data.visibility]}
   if(table==='fixed_occupancy'){if(!spaces.includes(data.space)||!Number.isInteger(data.weekday)||data.weekday<0||data.weekday>6||!validTime(data.start)||!validTime(data.end)||data.end<=data.start||!validDate(data.from_date)||!validDate(data.to_date)||data.to_date<data.from_date||!fixedRange(data)||!contextValid(data)||!text(data.purpose))return json({error:'Ocupação fixa inválida'},400);if(data.responsible!==undefined&&!text(data.responsible))return json({error:'Responsável inválido'},400);columns=['space','weekday','start','end','from_date','to_date','purpose','class','subject','responsible'];values=columns.map(k=>data[k]??row[k]??'')}
   await write(env.DB.prepare('UPDATE '+table+' SET '+columns.map(k=>k+'=?').join(',')+',version=version+1 WHERE id=? AND version=?').bind(...values,id,data.version));return json({ok:true});
  }
  if(path==='/api/auxiliaries'&&request.method==='POST'){
   if(!pedagogical)return json({error:'Somente a direção pode cadastrar auxiliares'},403);if(!text(data.name,100))return json({error:'Nome inválido'},400);const id=crypto.randomUUID();await write(env.DB.prepare('INSERT INTO auxiliaries(id,name) VALUES(?,?)').bind(id,data.name.trim()),path+'/'+id);return json({id},201);
  }
  if(path==='/api/substitutions'&&request.method==='POST'){
   if(!pedagogical)return json({error:'Somente a direção pode organizar substituições'},403);
   const dates=data.dates===undefined?[data.date]:data.dates;
   if(!Array.isArray(dates)||!dates.length||dates.length>31||!dates.every(validDate)||new Set(dates).size!==dates.length||!validTime(data.start)||!validTime(data.end)||data.end<=data.start||!text(data.class,80)||!text(data.teacher,100))return json({error:'Selecione dias distintos (até 31), professor, turma e horário válidos'},400);
   const auxiliary=data.auxiliary===undefined||data.auxiliary===''?null:data.auxiliary;
   if(auxiliary!==null&&(typeof auxiliary!=='string'||!await env.DB.prepare('SELECT id FROM auxiliaries WHERE id=? AND active=1').bind(auxiliary).first()))return json({error:'Auxiliar inválida'},400);
   const ids=dates.map(()=>crypto.randomUUID());
   const statements=dates.map((date,i)=>env.DB.prepare('INSERT INTO substitutions(id,date,week,start,end,class,teacher,creator,auxiliary) VALUES(?,?,?,?,?,?,?,?,?)').bind(ids[i],date,weekOf(date),data.start,data.end,data.class.trim(),data.teacher.trim(),email,auxiliary));
   // One transaction: any date, overlap or weekly-limit failure rolls back the entire absence.
   await env.DB.batch([...statements,env.DB.prepare('INSERT INTO audit(id,actor,action,target) VALUES(?,?,?,?)').bind(crypto.randomUUID(),email,request.method,dates.length===1?path+'/'+ids[0]:path+'/batch')]);
   return json({id:ids[0],ids,count:ids.length},201);
  }
  if(resource&&resource[1]==='substitutions'&&request.method==='PATCH'){
   if(!pedagogical)return json({error:'Somente a direção pode distribuir aulas'},403);
   const id=resource[2],row=await env.DB.prepare('SELECT auxiliary,completed,date FROM substitutions WHERE id=?').bind(id).first();
   if(Object.hasOwn(data,'completed')){
    if(typeof data.completed!=='boolean'||Object.hasOwn(data,'auxiliary'))return json({error:'Situação da aula inválida'},400);
    if(data.completed&&(!row.auxiliary||row.date>schoolToday()))return json({error:'Somente aulas com auxiliar, de hoje ou de dias anteriores, podem ser realizadas'},400);
    await write(env.DB.prepare('UPDATE substitutions SET completed=?,version=version+1 WHERE id=? AND version=?').bind(Number(data.completed),id,data.version));return json({ok:true});
   }
   if(row.completed)return json({error:'Desmarque a aula realizada antes de trocar ou retirar a auxiliar'},409);
   if(data.auxiliary!==null&&(typeof data.auxiliary!=='string'||!await env.DB.prepare('SELECT id FROM auxiliaries WHERE id=? AND active=1').bind(data.auxiliary).first()))return json({error:'Auxiliar inválida'},400);
   await write(env.DB.prepare('UPDATE substitutions SET auxiliary=?,version=version+1 WHERE id=? AND version=?').bind(data.auxiliary,id,data.version));return json({ok:true});
  }
  if(path==='/api/xerox'&&request.method==='POST'){
   if(!text(data.title)||!validDate(data.deadline)||!Number.isInteger(data.copies)||data.copies<1||data.copies>10000)return json({error:'Pedido inválido'},400);const id=assistantCreateId||crypto.randomUUID();await write(env.DB.prepare('INSERT INTO xerox(id,title,copies,deadline,requester,professor,class,color,attachment_name,attachment_mime,attachment_data) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,data.title.trim(),data.copies,data.deadline,email,...xeroxFields(data,user)),path+'/'+id);return json({id},201);
  }
  if(resource&&resource[1]==='xerox'&&request.method==='PATCH'){
   const id=path.split('/')[3];const row=await env.DB.prepare('SELECT * FROM xerox WHERE id=?').bind(id).first();if(!row)return json({error:'Pedido não encontrado'},404);
   if(data.resubmit===true){if(row.requester!==email&&!pedagogical)return json({error:'Sem permissão'},403);if(row.status!=='Devolvido para ajustes')return json({error:'Pedido não está em ajustes'},409);if(!text(data.title)||!validDate(data.deadline)||!Number.isInteger(data.copies)||data.copies<1||data.copies>10000)return json({error:'Pedido inválido'},400);const result=await write(env.DB.prepare("UPDATE xerox SET title=?,copies=?,deadline=?,professor=?,class=?,color=?,attachment_name=?,attachment_mime=?,attachment_data=?,status='Aguardando aprovação',version=version+1 WHERE id=? AND status='Devolvido para ajustes' AND version=?").bind(data.title.trim(),data.copies,data.deadline,...xeroxFields(data,user,row),id,data.version));if(!result.meta?.changes)return json({error:'Pedido mudou. Atualize a tela e tente de novo'},409);return json({ok:true})}
   if(!pedagogical)return json({error:'Somente a direção pode aprovar ou atualizar a produção'},403);
   const transitions={'Aguardando aprovação':['Aprovado','Devolvido para ajustes','Recusado'],'Devolvido para ajustes':['Aguardando aprovação'],'Aprovado':['Em produção'],'Em produção':['Concluído'],'Recusado':[],'Concluído':[]};if(!transitions[row.status].includes(data.status))return json({error:'Transição de aprovação inválida'},400);if(data.status==='Devolvido para ajustes'&&!validReason(data.review_reason))return json({error:'Informe a justificativa da devolução (até 2000 caracteres)'},400);const result=await write(env.DB.prepare('UPDATE xerox SET status=?,review_reason=?,version=version+1 WHERE id=? AND status=? AND version=?').bind(data.status,data.status==='Devolvido para ajustes'?data.review_reason.trim():row.review_reason,id,row.status,data.version));if(!result.meta?.changes)return json({error:'Pedido mudou. Atualize a tela e tente de novo'},409);return json({ok:true});
  }
  if(path==='/api/minutes'&&request.method==='POST'){
   if(!pedagogical)return json({error:'Somente a direção pode registrar atas'},403);if(!text(data.title)||!validDate(data.date)||!text(data.participants,2000)||!text(data.decisions,4000))return json({error:'Ata inválida'},400);const id=crypto.randomUUID();await write(env.DB.prepare('INSERT INTO minutes(id,title,date,participants,decisions,creator) VALUES(?,?,?,?,?,?)').bind(id,data.title.trim(),data.date,data.participants.trim(),data.decisions.trim(),email),path+'/'+id);return json({id},201);
  }
  if(path==='/api/events'&&request.method==='POST'){
   if(!pedagogical)return json({error:'Somente a equipe pedagógica pode editar o calendário'},403);if(!validEvent(data))return json({error:'Evento inválido; escolha calendário público ou interno'},400);const id=crypto.randomUUID();await write(env.DB.prepare('INSERT INTO events(id,title,date,type,creator,formation,start,end,location,details,area,visibility) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,data.title.trim(),data.date,data.type==='Formação'?'Evento escolar':data.type,email,...eventDetails(data),(data.area||(data.type==='Formação'||data.formation?'Geral':'')).trim(),data.visibility),path+'/'+id);return json({id},201);
  }
  if(path==='/api/reservations'&&request.method==='POST'){
   if(!spaces.includes(data.space)||!validDate(data.date)||!validTime(data.start)||!validTime(data.end)||data.end<=data.start||!text(data.purpose)||!text(data.responsible)||!contextValid(data))return json({error:'Confira espaço, data, horários, responsável e atividade'},400);
   const id=assistantCreateId||crypto.randomUUID(),status=pedagogical?'Aprovada':'Pendente';await write(env.DB.prepare('INSERT INTO reservations(id,space,date,start,end,owner,purpose,responsible,class,subject,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,data.space,data.date,data.start,data.end,email,data.purpose.trim(),data.responsible.trim(),(data.class||'').trim(),(data.subject||'').trim(),status),path+'/'+id);return json({id,status},201);
  }
  if(path==='/api/tasks'&&request.method==='POST'){
   if(!text(data.title)||!validDate(data.due)||typeof data.restricted!=='boolean'||typeof data.owner!=='string')return json({error:'Tarefa inválida'},400);
   if(!pedagogical&&(data.restricted||data.owner!==email))return json({error:'Somente a direção pode restringir ou delegar tarefas'},403);
   if(!await env.DB.prepare('SELECT email FROM users WHERE email=? AND active=1').bind(data.owner).first())return json({error:'Responsável não autorizado'},400);
   const id=crypto.randomUUID();await write(env.DB.prepare('INSERT INTO tasks(id,title,owner,due,restricted,creator,verifier) VALUES(?,?,?,?,?,?,?)').bind(id,data.title.trim(),data.owner,data.due,Number(data.restricted),email,await taskVerifier(env.DB,data.verifier??'')),path+'/'+id);return json({id},201);
  }
  if(resource&&resource[1]==='tasks'&&request.method==='PATCH'){
   if(!statuses.includes(data.status))return json({error:'Situação inválida'},400);const id=path.split('/')[3];const row=await env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(id).first();if(!row)return json({error:'Tarefa não encontrada'},404);if(row.owner!==email&&!pedagogical)return json({error:'Sem permissão'},403);await write(env.DB.prepare("UPDATE tasks SET status=?,verified_by='',verified_at='',version=version+1 WHERE id=? AND version=?").bind(data.status,id,data.version));return json({ok:true});
  }
  return json({error:'Rota indisponível'},404);
 }catch(e){if(e instanceof XeroxInputError)return json({error:e.message},e.status);if(String(e.message).includes('auxiliary_inactive'))return json({error:'Auxiliar está desativada'},409);if(String(e.message).includes('version_conflict'))return json({error:'Este registro mudou. Atualize a tela'},409);if(String(e.message).includes('class_conflict'))return json({error:'Esta turma já tem uma aula registrada nesse horário'},409);if(String(e.message).includes('auxiliary_limit'))return json({error:'Limite semanal da auxiliar atingido'},409);if(String(e.message).includes('auxiliary_conflict'))return json({error:'Auxiliar já distribuída nesse horário'},409);if(String(e.message).includes('reservation_conflict'))return json({error:'Este espaço já está reservado nesse horário'},409);return json({error:'Não foi possível salvar o registro'},503)}
}
export async function handle(request,env,authenticate=identity){try{return await handleInner(request,env,authenticate)}catch{return json({error:'Serviço temporariamente indisponível'},503)}}
export default {fetch(request,env){return handle(request,env)}};
