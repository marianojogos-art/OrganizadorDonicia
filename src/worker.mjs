import {identity} from './auth.mjs';
import {readTeachers} from './teachers.mjs';
import {consecutiveDates,mondayOf,makeSubstitutionPlan,PlanInputError} from './substitution-plan.mjs';
export const spaces=['Biblioteca','Auditório','Sala de informática','Laboratório de ciências','Sala de jogos','Sala de projetos','Quadra coberta','Quadra descoberta'];
const statuses=['Pendente','Em andamento','Concluída'];
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const validTime=s=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const text=(s,max=250)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
const schoolToday=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const weekOf=date=>{const monday=new Date(date+'T12:00:00Z');monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);return monday.toISOString().slice(0,10)};
async function handleInner(request,env,authenticate=identity){
 const path=new URL(request.url).pathname;
 if(path==='/api/health')return json({ok:true,modules:['reservations','tasks','substitutions','auxiliaries','xerox','minutes','events','fixed-occupancy'],studentData:false});
 if(!env.DB)return json({error:'Persistência não configurada'},503);
 const email=await authenticate(request,env);if(!email)return json({error:'Login institucional necessário'},401);
 const write=async(statement,target=path)=>{const results=await env.DB.batch([statement,env.DB.prepare('INSERT INTO audit(id,actor,action,target) SELECT ?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),email,request.method,target)]);if(path.split('/').length===4&&!results[0].meta?.changes)throw Error('version_conflict');return results[0]};
 const user=await env.DB.prepare('SELECT email,name,role FROM users WHERE email=? AND active=1').bind(email).first();if(!user)return json({error:'Usuário não autorizado pela direção'},403);
 const preparePlan=async(teacher,date,extraDays)=>{
  const dates=consecutiveDates(date,extraDays);
  const directory=await readTeachers(env.DB);
  const rows=(await env.DB.prepare('SELECT s.id,s.version,s.date,s.week,s.start,s.end,s.class,s.teacher,s.auxiliary,s.completed,a.name AS aux FROM substitutions s LEFT JOIN auxiliaries a ON a.id=s.auxiliary WHERE s.week BETWEEN ? AND ? ORDER BY s.date,s.start').bind(mondayOf(date),mondayOf(dates.at(-1))).all()).results;
  const plan=await makeSubstitutionPlan(directory,teacher,date,extraDays,rows);
  const settings=await env.DB.prepare("SELECT value FROM settings WHERE key='auxiliary_weekly_limit'").first();
  return {...plan,limit:settings.value};
 };
 if(!path.startsWith('/api/')){
  const asset=await env.ASSETS.fetch(request);const out=new Response(asset.body,asset);out.headers.set('Cache-Control','no-store');out.headers.set('X-Content-Type-Options','nosniff');out.headers.set('Referrer-Policy','same-origin');out.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");return out;
 }
 if(request.method==='GET'){
  if(path==='/api/me')return json(user);
  if(path==='/api/users')return json((await env.DB.prepare('SELECT email,name FROM users WHERE active=1 ORDER BY name').all()).results);
  if(path==='/api/teachers'){try{const {schedule,...directory}=await readTeachers(env.DB);return json(directory)}catch{return json({error:'Não foi possível ler os professores no WebHorário. Tente atualizar a lista.'},503)}}
  if(path==='/api/substitutions/preview'){
   if(user.role!=='direction')return json({error:'Somente a direção pode organizar substituições'},403);
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
 const raw=await request.text();if(raw.length>(path==='/api/substitutions/from-schedule'?65536:8192))return json({error:'Conteúdo muito grande'},413);let data;try{data=JSON.parse(raw)}catch{return json({error:'JSON inválido'},400)}
 if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'Dados inválidos'},400);
 const resource=path==='/api/substitutions/from-schedule'?null:/^\/api\/(reservations|tasks|substitutions|auxiliaries|xerox|minutes|events|fixed-occupancy)\/([^/]+)$/.exec(path);
 if(resource){if(!Number.isInteger(data.version)||data.version<1)return json({error:'Versão do registro necessária. Atualize a tela'},400);const table=resource[1].replace('fixed-occupancy','fixed_occupancy');const row=await env.DB.prepare('SELECT version FROM '+table+' WHERE id=?').bind(resource[2]).first();if(!row)return json({error:'Registro não encontrado'},404);if(row.version!==data.version)return json({error:'Este registro mudou. Atualize a tela'},409)}
 try{
  if(path==='/api/teachers/refresh'&&request.method==='POST'){
   if(user.role!=='direction')return json({error:'Somente a direção pode atualizar a lista'},403);
   try{const {schedule,...directory}=await readTeachers(env.DB,{force:true});return json(directory)}catch{return json({error:'Não foi possível atualizar a grade do WebHorário. Tente novamente.'},503)}
  }
  if(path==='/api/substitutions/from-schedule'&&request.method==='POST'){
   if(user.role!=='direction')return json({error:'Somente a direção pode organizar substituições'},403);
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
   if(table==='substitutions'){if(!validDate(data.date)||!validTime(data.start)||!validTime(data.end)||data.end<=data.start||!text(data.class,80)||!text(data.teacher,100))return json({error:'Aula inválida'},400);if(row.completed&&data.date>schoolToday())return json({error:'Aula realizada não pode ter data futura'},400);columns=['date','week','start','end','class','teacher'];values=[data.date,weekOf(data.date),data.start,data.end,data.class,data.teacher]}
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
   if(user.role!=='direction')return json({error:'Somente a direção pode organizar substituições'},403);
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
   if(user.role!=='direction')return json({error:'Somente a direção pode distribuir aulas'},403);
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
