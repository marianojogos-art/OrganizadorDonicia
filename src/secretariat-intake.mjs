import {readLimitedBody} from './xerox.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
// Reuse this predicate in the INSERT too, so revocation and collection cannot race.
export const intakeReadySQL="EXISTS(SELECT 1 FROM secretariat_access_initialization WHERE id=1) AND (SELECT count(*) FROM secretariat_access)=3 AND (SELECT count(*) FROM secretariat_access a JOIN users u ON u.email=a.email WHERE u.active=1)=3";
export const intakeEnabledSQL=`EXISTS(SELECT 1 FROM secretariat_intake WHERE id=1 AND enabled=1) AND ${intakeReadySQL}`;
export async function intakeEnabled(DB){return !!await DB.prepare(`SELECT 1 AS enabled WHERE ${intakeEnabledSQL}`).first()}
export async function manageSecretariatIntake(request,DB,user){
 if(user?.role!=='direction'||!await DB.prepare('SELECT 1 FROM secretariat_access WHERE email=?').bind(user.email).first())return json({error:'Ativação restrita à direção com acesso individual à fila'},403);
 if(request.method==='GET')return json({enabled:await intakeEnabled(DB)});
 if(request.method!=='POST')return json({error:'Método indisponível'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Origem inválida'},403);
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return json({error:'JSON necessário'},415);
 let data;try{data=JSON.parse(await readLimitedBody(request,1024))}catch(error){return json({error:'Dados inválidos'},error.status||400)}
 if(!data||Array.isArray(data)||Object.keys(data).some(key=>!['enabled','confirmed'].includes(key))||typeof data.enabled!=='boolean'||data.confirmed!==true)return json({error:'Confirme explicitamente a alteração do recebimento público'},400);
 const enabled=Number(data.enabled);
 const results=await DB.batch([
  DB.prepare(`UPDATE secretariat_intake SET enabled=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=1 AND enabled<>? AND (?=0 OR (${intakeReadySQL}))`).bind(enabled,user.email,enabled,enabled),
  DB.prepare("INSERT INTO audit(id,actor,action,target) SELECT ?,?,?, '/api/secretariat-intake' WHERE changes()>0").bind(crypto.randomUUID(),user.email,enabled?'ENABLE':'DISABLE')
 ]);
 const current=await intakeEnabled(DB);
 if(current!==data.enabled)return json({error:'As três concessões ativas precisam estar verificadas antes de ativar o recebimento'},409);
 return json({ok:true,applied:results[0].meta?.changes===1,enabled:current});
}
