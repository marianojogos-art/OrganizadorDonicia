import {readLimitedBody} from './xerox.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function canAccessSecretariat(DB,user){
 return !!user?.email&&!!await DB.prepare('SELECT 1 AS allowed FROM secretariat_access a JOIN users u ON u.email=a.email WHERE a.email=? AND u.active=1').bind(user.email).first();
}
export async function manageSecretariatAccess(request,DB,user){
 if(user?.role!=='direction')return json({error:'Operação restrita à direção autenticada'},403);
 const members=async()=>(await DB.prepare('SELECT u.email,u.name,u.role,u.active FROM secretariat_access a JOIN users u ON u.email=a.email ORDER BY u.email').all()).results;
 const initialized=()=>DB.prepare('SELECT id FROM secretariat_access_initialization WHERE id=1').first();
 if(request.method==='GET')return json({initialized:!!await initialized(),members:await members(),publicIntakeEnabled:false});
 if(request.method!=='POST')return json({error:'Método indisponível'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Origem inválida'},403);
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return json({error:'JSON necessário'},415);
 let data;try{data=JSON.parse(await readLimitedBody(request,4096))}catch(error){return json({error:'Dados inválidos'},error.status||400)}
 if(!data||Array.isArray(data)||Object.keys(data).some(key=>!['emails','confirmed'].includes(key))||data.confirmed!==true||!Array.isArray(data.emails)||data.emails.length!==3||data.emails.some(email=>typeof email!=='string'||email.length>254||!email.endsWith('@prof.pmf.sc.gov.br'))||new Set(data.emails).size!==3)return json({error:'Informe exatamente as três contas confirmadas e a confirmação explícita'},400);
 const emails=[...data.emails].sort();
 const matches=rows=>rows.length===3&&rows.every((row,index)=>row.email===emails[index]);
 if(await initialized())return matches(await members())?json({ok:true,applied:false,publicIntakeEnabled:false}):json({error:'A concessão inicial já foi concluída; não é possível acrescentar ou substituir contas'},409);
 // This is a one-time, three-person snapshot, not a general permission editor.
 // It must match the entire CURRENT active directory, all with the preserved
 // direction role. An extra, inactive, replaced or future account fails closed.
 const current=(await DB.prepare('SELECT email,role FROM users WHERE active=1 ORDER BY email').all()).results;
 if(!matches(current)||current.some(row=>row.role!=='direction'))return json({error:'O cadastro ativo mudou. Revise o conjunto nominal antes de qualquer concessão'},409);
 const result=await DB.batch([
  DB.prepare("INSERT INTO secretariat_access_initialization(id,actor) SELECT 1,? WHERE (SELECT count(*) FROM users WHERE active=1)=3 AND (SELECT count(*) FROM users WHERE active=1 AND role='direction' AND email IN (?,?,?))=3 ON CONFLICT(id) DO NOTHING").bind(user.email,...emails),
  DB.prepare("INSERT INTO secretariat_access(email,granted_by) SELECT email,? FROM users WHERE active=1 AND role='direction' AND email IN (?,?,?) AND changes()>0").bind(user.email,...emails),
  DB.prepare("INSERT INTO audit(id,actor,action,target) SELECT ?,?,'GRANT','/api/secretariat-access' WHERE changes()>0").bind(crypto.randomUUID(),user.email)
 ]);
 if(result[1].meta?.changes===3)return json({ok:true,applied:true,publicIntakeEnabled:false},201);
 return matches(await members())?json({ok:true,applied:false,publicIntakeEnabled:false}):json({error:'O cadastro mudou durante a operação. Nenhuma nova concessão foi aplicada'},409);
}
