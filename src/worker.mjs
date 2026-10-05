import {identity} from './auth.mjs';
export const spaces=['Biblioteca','Auditório','Sala de informática','Laboratório de ciências','Sala de jogos','Sala de projetos','Quadra coberta','Quadra descoberta'];
const statuses=['Pendente','Em andamento','Concluída'];
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const validTime=s=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const text=(s,max=250)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
async function handleInner(request,env,authenticate=identity){
 const path=new URL(request.url).pathname;
 if(path==='/api/health')return json({ok:true,modules:['reservations','tasks','substitutions','auxiliaries','xerox','minutes','events','fixed-occupancy'],studentData:false});
 if(!env.DB)return json({error:'Persistência não configurada'},503);
 const email=await authenticate(request,env);if(!email)return json({error:'Login institucional necessário'},401);
 const write=async(statement,target=path)=>{const results=await env.DB.batch([statement,env.DB.prepare('INSERT INTO audit(id,actor,action,target) SELECT ?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),email,request.method,target)]);if(path.split('/').length===4&&!results[0].meta?.changes)throw Error('version_conflict');return results[0]};
 const user=await env.DB.prepare('SELECT email,name,role FROM users WHERE email=? AND active=1').bind(email).first();if(!user)return json({error:'Usuário não autorizado pela direção'},403);
 if(!path.startsWith('/api/')){
  const asset=await env.ASSETS.fetch(request);const out=new Response(asset.body,asset);out.headers.set('Cache-Control','no-store');out.headers.set('X-Content-Type-Options','nosniff');out.headers.set('Referrer-Policy','same-origin');out.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");return out;
 }
 if(request.method==='GET'){
  if(path==='/api/me')return json(user);
  if(path==='/api/users')return json((await env.DB.prepare('SELECT email,name FROM users WHERE active=1 ORDER BY name').all()).results);
  if(path==='/api/reservations')return json((await env.DB.prepare('SELECT r.*,u.name AS owner_name FROM reservations r JOIN users u ON u.email=r.owner ORDER BY date,start').all()).results);
  if(path==='/api/settings')return json(await env.DB.prepare("SELECT value AS auxiliaryWeeklyLimit FROM settings WHERE key='auxiliary_weekly_limit'").first());
  if(path==='/api/fixed-occupancy')return json((await env.DB.prepare('SELECT * FROM fixed_occupancy ORDER BY space,weekday,start').all()).results);
  if(path==='/api/audit'){if(user.role!=='direction')return json({error:'Sem permissão'},403);return json((await env.DB.prepare('SELECT * FROM audit ORDER BY created_at DESC LIMIT 100').all()).results)}
  if(path==='/api/auxiliaries')return json((await env.DB.prepare('SELECT * FROM auxiliaries WHERE active=1 ORDER BY name').all()).results);
  if(path==='/api/substitutions')return json((await env.DB.prepare('SELECT s.*,a.name AS aux FROM substitutions s LEFT JOIN auxiliaries a ON a.id=s.auxiliary ORDER BY date,start').all()).results);
  if(path==='/api/xerox')return json((await env.DB.prepare('SELECT x.*,u.name AS requester_name FROM xerox x JOIN users u ON u.email=x.requester WHERE ?=\'direction\' OR x.requester=? ORDER BY deadline').bind(user.role,email).all()).results);
  if(path==='/api/minutes')return json((await env.DB.prepare('SELECT * FROM minutes ORDER BY date DESC').all()).results);
  if(path==='/api/events')return json((await env.DB.prepare('SELECT * FROM events ORDER BY date').all()).results);
  if(path==='/api/tasks')return json((await env.DB.prepare('SELECT t.*,u.name AS owner_name FROM tasks t JOIN users u ON u.email=t.owner WHERE t.restricted=0 OR ?=\'direction\' OR t.owner=? OR t.creator=? ORDER BY due,created_at').bind(user.role,email,email).all()).results);
  return json({error:'Rota indisponível'},404);
 }
 if(!['POST','PATCH','DELETE'].includes(request.method))return json({error:'Método indisponível'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Origem inválida'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON necessário'},415);
 const raw=await request.text();if(raw.length>8192)return json({error:'Conteúdo muito grande'},413);let data;try{data=JSON.parse(raw)}catch{return json({error:'JSON inválido'},400)}
 if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'Dados inválidos'},400);
 const resource=/^\/api\/(reservations|tasks|substitutions|auxiliaries|xerox|minutes|events|fixed-occupancy)\/([^/]+)$/.exec(path);
 if(resource){if(!Number.isInteger(data.version)||data.version<1)return json({error:'Versão do registro necessária. Atualize a tela'},400);const table=resource[1].replace('fixed-occupancy','fixed_occupancy');const row=await env.DB.prepare('SELECT version FROM '+table+' WHERE id=?').bind(resource[2]).first();if(!row)return json({error:'Registro não encontrado'},404);if(row.version!==data.version)return json({error:'Este registro mudou. Atualize a tela'},409)}
 try{
  if(path==='/api/fixed-occupancy'&&request.method==='POST'){
   if(user.role!=='direction')return json({error:'Somente a direção pode definir horários fixos'},403);if(!spaces.includes(data.space)||!Number.isInteger(data.weekday)||data.weekday<0||data.weekday>6||!validTime(data.start)||!validTime(data.end)||data.end<=data.start||!validDate(data.from_date)||!validDate(data.to_date)||data.to_date<data.from_date||!text(data.purpose))return json({error:'Ocupação fixa inválida'},400);const id=crypto.randomUUID();await write(env.DB.prepare('INSERT INTO fixed_occupancy(id,space,weekday,start,end,from_date,to_date,purpose,creator) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,data.space,data.weekday,data.start,data.end,data.from_date,data.to_date,data.purpose.trim(),email),path+'/'+id);return json({id},201);
  }
  if(resource&&((request.method==='PATCH'&&data.edit===true)||request.method==='DELETE')){
   const table=resource[1].replace('fixed-occupancy','fixed_occupancy'),id=resource[2];const row=await env.DB.prepare('SELECT * FROM '+table+' WHERE id=?').bind(id).first();
   const owner=table==='xerox'?row.requester:row.owner;
   if(user.role!=='direction'&&(!['reservations','tasks','xerox'].includes(table)||owner!==email))return json({error:'Sem permissão'},403);
   if(table==='xerox'&&user.role!=='direction'&&!['Aguardando aprovação','Devolvido para ajustes'].includes(row.status))return json({error:'Pedido já aprovado ou encerrado'},409);
   if(table==='xerox'&&request.method==='PATCH'&&!['Aguardando aprovação','Devolvido para ajustes'].includes(row.status))return json({error:'Pedido já aprovado ou encerrado'},409);
   if(request.method==='DELETE'){
    if(table==='auxiliaries')await write(env.DB.prepare('UPDATE auxiliaries SET active=0,version=version+1 WHERE id=? AND version=?').bind(id,data.version));
    else await write(env.DB.prepare('DELETE FROM '+table+' WHERE id=? AND version=?').bind(id,data.version));return json({ok:true});
   }
   let columns=[],values=[];
   if(table==='reservations'){if(!spaces.includes(data.space)||!validDate(data.date)||!validTime(data.start)||!validTime(data.end)||data.end<=data.start||!text(data.purpose))return json({error:'Reserva inválida'},400);columns=['space','date','start','end','purpose'];values=columns.map(k=>data[k]);}
   if(table==='tasks'){if(!text(data.title)||!validDate(data.due)||typeof data.owner!=='string'||typeof data.restricted!=='boolean')return json({error:'Tarefa inválida'},400);if(user.role!=='direction'&&(data.owner!==email||data.restricted!==!!row.restricted))return json({error:'Somente a direção pode delegar ou restringir'},403);if(!await env.DB.prepare('SELECT email FROM users WHERE email=? AND active=1').bind(data.owner).first())return json({error:'Responsável inválido'},400);columns=['title','due','owner','restricted'];values=[data.title,data.due,data.owner,Number(data.restricted)]}
   if(table==='substitutions'){if(!validDate(data.date)||!validTime(data.start)||!validTime(data.end)||data.end<=data.start||!text(data.class,80)||!text(data.teacher,100))return json({error:'Aula inválida'},400);const monday=new Date(data.date+'T12:00:00Z');monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);columns=['date','week','start','end','class','teacher'];values=[data.date,monday.toISOString().slice(0,10),data.start,data.end,data.class,data.teacher]}
   if(table==='auxiliaries'){if(!text(data.name,100))return json({error:'Nome inválido'},400);columns=['name'];values=[data.name]}
   if(table==='xerox'){if(!text(data.title)||!validDate(data.deadline)||!Number.isInteger(data.copies)||data.copies<1||data.copies>10000)return json({error:'Pedido inválido'},400);columns=['title','copies','deadline'];values=[data.title,data.copies,data.deadline]}
   if(table==='minutes'){if(!text(data.title)||!validDate(data.date)||!text(data.participants,2000)||!text(data.decisions,4000))return json({error:'Ata inválida'},400);columns=['title','date','participants','decisions'];values=columns.map(k=>data[k])}
   if(table==='events'){if(!text(data.title)||!validDate(data.date)||!['Reunião','Dia letivo','Feriado','Recesso','Conselho de classe','Evento escolar'].includes(data.type))return json({error:'Evento inválido'},400);columns=['title','date','type'];values=columns.map(k=>data[k])}
   if(table==='fixed_occupancy'){if(!spaces.includes(data.space)||!Number.isInteger(data.weekday)||data.weekday<0||data.weekday>6||!validTime(data.start)||!validTime(data.end)||data.end<=data.start||!validDate(data.from_date)||!validDate(data.to_date)||data.to_date<data.from_date||!text(data.purpose))return json({error:'Ocupação fixa inválida'},400);columns=['space','weekday','start','end','from_date','to_date','purpose'];values=columns.map(k=>data[k])}
   await write(env.DB.prepare('UPDATE '+table+' SET '+columns.map(k=>k+'=?').join(',')+',version=version+1 WHERE id=? AND version=?').bind(...values,id,data.version));return json({ok:true});
  }
  if(path==='/api/auxiliaries'&&request.method==='POST'){
   if(user.role!=='direction')return json({error:'Somente a direção pode cadastrar auxiliares'},403);if(!text(data.name,100))return json({error:'Nome inválido'},400);const id=crypto.randomUUID();await write(env.DB.prepare('INSERT INTO auxiliaries(id,name) VALUES(?,?)').bind(id,data.name.trim()),path+'/'+id);return json({id},201);
  }
  if(path==='/api/substitutions'&&request.method==='POST'){
   if(user.role!=='direction')return json({error:'Somente a direção pode organizar substituições'},403);if(!validDate(data.date)||!validTime(data.start)||!validTime(data.end)||data.end<=data.start||!text(data.class,80)||!text(data.teacher,100))return json({error:'Ausência inválida'},400);
   const monday=new Date(data.date+'T12:00:00Z');monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);const week=monday.toISOString().slice(0,10);const id=crypto.randomUUID();await write(env.DB.prepare('INSERT INTO substitutions(id,date,week,start,end,class,teacher,creator) VALUES(?,?,?,?,?,?,?,?)').bind(id,data.date,week,data.start,data.end,data.class.trim(),data.teacher.trim(),email),path+'/'+id);return json({id},201);
  }
  if(resource&&resource[1]==='substitutions'&&request.method==='PATCH'){
   if(user.role!=='direction')return json({error:'Somente a direção pode distribuir aulas'},403);if(data.auxiliary!==null&&(typeof data.auxiliary!=='string'||!await env.DB.prepare('SELECT id FROM auxiliaries WHERE id=? AND active=1').bind(data.auxiliary).first()))return json({error:'Auxiliar inválida'},400);const id=path.split('/')[3];if(!await env.DB.prepare('SELECT id FROM substitutions WHERE id=?').bind(id).first())return json({error:'Aula não encontrada'},404);await write(env.DB.prepare('UPDATE substitutions SET auxiliary=?,version=version+1 WHERE id=? AND version=?').bind(data.auxiliary,id,data.version));return json({ok:true});
  }
  if(path==='/api/xerox'&&request.method==='POST'){
   if(!text(data.title)||!validDate(data.deadline)||!Number.isInteger(data.copies)||data.copies<1||data.copies>10000)return json({error:'Pedido inválido'},400);const id=crypto.randomUUID();await write(env.DB.prepare('INSERT INTO xerox(id,title,copies,deadline,requester) VALUES(?,?,?,?,?)').bind(id,data.title.trim(),data.copies,data.deadline,email),path+'/'+id);return json({id},201);
  }
  if(resource&&resource[1]==='xerox'&&request.method==='PATCH'){
   const id=path.split('/')[3];const row=await env.DB.prepare('SELECT * FROM xerox WHERE id=?').bind(id).first();if(!row)return json({error:'Pedido não encontrado'},404);
   if(data.resubmit===true){if(row.requester!==email&&user.role!=='direction')return json({error:'Sem permissão'},403);if(row.status!=='Devolvido para ajustes')return json({error:'Pedido não está em ajustes'},409);if(!text(data.title)||!validDate(data.deadline)||!Number.isInteger(data.copies)||data.copies<1||data.copies>10000)return json({error:'Pedido inválido'},400);const result=await write(env.DB.prepare("UPDATE xerox SET title=?,copies=?,deadline=?,status='Aguardando aprovação',version=version+1 WHERE id=? AND status='Devolvido para ajustes' AND version=?").bind(data.title.trim(),data.copies,data.deadline,id,data.version));if(!result.meta?.changes)return json({error:'Pedido mudou. Atualize a tela e tente de novo'},409);return json({ok:true})}
   if(user.role!=='direction')return json({error:'Somente a direção pode aprovar ou atualizar a produção'},403);
   const transitions={'Aguardando aprovação':['Aprovado','Devolvido para ajustes','Recusado'],'Devolvido para ajustes':['Aguardando aprovação'],'Aprovado':['Em produção'],'Em produção':['Concluído'],'Recusado':[],'Concluído':[]};if(!transitions[row.status].includes(data.status))return json({error:'Transição de aprovação inválida'},400);const result=await write(env.DB.prepare('UPDATE xerox SET status=?,version=version+1 WHERE id=? AND status=? AND version=?').bind(data.status,id,row.status,data.version));if(!result.meta?.changes)return json({error:'Pedido mudou. Atualize a tela e tente de novo'},409);return json({ok:true});
  }
  if(path==='/api/minutes'&&request.method==='POST'){
   if(user.role!=='direction')return json({error:'Somente a direção pode registrar atas'},403);if(!text(data.title)||!validDate(data.date)||!text(data.participants,2000)||!text(data.decisions,4000))return json({error:'Ata inválida'},400);const id=crypto.randomUUID();await write(env.DB.prepare('INSERT INTO minutes(id,title,date,participants,decisions,creator) VALUES(?,?,?,?,?,?)').bind(id,data.title.trim(),data.date,data.participants.trim(),data.decisions.trim(),email),path+'/'+id);return json({id},201);
  }
  if(path==='/api/events'&&request.method==='POST'){
   if(user.role!=='direction')return json({error:'Somente a direção pode editar o calendário'},403);if(!text(data.title)||!validDate(data.date)||!['Reunião','Dia letivo','Feriado','Recesso','Conselho de classe','Evento escolar'].includes(data.type))return json({error:'Evento inválido'},400);const id=crypto.randomUUID();await write(env.DB.prepare('INSERT INTO events(id,title,date,type,creator) VALUES(?,?,?,?,?)').bind(id,data.title.trim(),data.date,data.type,email),path+'/'+id);return json({id},201);
  }
  if(path==='/api/reservations'&&request.method==='POST'){
   if(!spaces.includes(data.space)||!validDate(data.date)||!validTime(data.start)||!validTime(data.end)||data.end<=data.start||!text(data.purpose))return json({error:'Reserva inválida'},400);
   const id=crypto.randomUUID();await write(env.DB.prepare('INSERT INTO reservations(id,space,date,start,end,owner,purpose) VALUES(?,?,?,?,?,?,?)').bind(id,data.space,data.date,data.start,data.end,email,data.purpose.trim()),path+'/'+id);return json({id},201);
  }
  if(path==='/api/tasks'&&request.method==='POST'){
   if(!text(data.title)||!validDate(data.due)||typeof data.restricted!=='boolean'||typeof data.owner!=='string')return json({error:'Tarefa inválida'},400);
   if(user.role!=='direction'&&(data.restricted||data.owner!==email))return json({error:'Somente a direção pode restringir ou delegar tarefas'},403);
   if(!await env.DB.prepare('SELECT email FROM users WHERE email=? AND active=1').bind(data.owner).first())return json({error:'Responsável não autorizado'},400);
   const id=crypto.randomUUID();await write(env.DB.prepare('INSERT INTO tasks(id,title,owner,due,restricted,creator) VALUES(?,?,?,?,?,?)').bind(id,data.title.trim(),data.owner,data.due,Number(data.restricted),email),path+'/'+id);return json({id},201);
  }
  if(resource&&resource[1]==='tasks'&&request.method==='PATCH'){
   if(!statuses.includes(data.status))return json({error:'Situação inválida'},400);const id=path.split('/')[3];const row=await env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(id).first();if(!row)return json({error:'Tarefa não encontrada'},404);if(row.owner!==email&&user.role!=='direction')return json({error:'Sem permissão'},403);await write(env.DB.prepare('UPDATE tasks SET status=?,version=version+1 WHERE id=? AND version=?').bind(data.status,id,data.version));return json({ok:true});
  }
  return json({error:'Rota indisponível'},404);
 }catch(e){if(String(e.message).includes('auxiliary_inactive'))return json({error:'Auxiliar está desativada'},409);if(String(e.message).includes('version_conflict'))return json({error:'Este registro mudou. Atualize a tela'},409);if(String(e.message).includes('class_conflict'))return json({error:'Esta turma já tem uma aula registrada nesse horário'},409);if(String(e.message).includes('auxiliary_limit'))return json({error:'Limite semanal da auxiliar atingido'},409);if(String(e.message).includes('auxiliary_conflict'))return json({error:'Auxiliar já distribuída nesse horário'},409);if(String(e.message).includes('reservation_conflict'))return json({error:'Este espaço já está reservado nesse horário'},409);return json({error:'Não foi possível salvar o registro'},503)}
}
export async function handle(request,env,authenticate=identity){try{return await handleInner(request,env,authenticate)}catch{return json({error:'Serviço temporariamente indisponível'},503)}}
export default {fetch(request,env){return handle(request,env)}};
