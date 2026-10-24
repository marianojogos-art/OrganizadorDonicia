import {readLimitedBody} from './xerox.mjs';
import {canAccessSecretariat} from './secretariat-access.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export async function secretariatRequests(request,env,user){
 const path=new URL(request.url).pathname,publicRoute=path==='/public/secretariat-requests';
 // Public collection is explicitly out of scope, regardless of roles or env flags.
 if(publicRoute&&request.method==='GET')return json({enabled:false});
 if(publicRoute&&request.method==='POST')return json({error:'Recebimento público de solicitações desativado'},503);
 if(!publicRoute&&!await canAccessSecretariat(env.DB,user))return json({error:'Acesso à fila não concedido a esta conta'},403);
 if(publicRoute&&request.method!=='POST'||!publicRoute&&!['GET','PATCH'].includes(request.method))return json({error:'Método indisponível'},405);
 if(request.method==='GET'){
  const offset=Number(new URL(request.url).searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0)return json({error:'Página inválida'},400);
  const rows=await env.DB.prepare('SELECT id,kind,name,contact,status,evidence,version,created_at,updated_at FROM secretariat_requests ORDER BY created_at DESC,id LIMIT 30 OFFSET ?').bind(offset).all();
  return json({items:rows.results,offset,limit:30});
 }
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Origem inválida'},403);
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return json({error:'JSON necessário'},415);
 let data;try{data=JSON.parse(await readLimitedBody(request,4096))}catch(error){return json({error:'Dados inválidos'},error.status||400)}
 if(!data||Array.isArray(data)||typeof data!=='object')return json({error:'Dados inválidos'},400);
 const id=path.split('/').at(-1);
 if(!uuid(id)||Object.keys(data).some(key=>!['version','status','evidence'].includes(key))||!Number.isInteger(data.version)||!['Encaminhado','Atendido'].includes(data.status)||typeof data.evidence!=='string'||!data.evidence.trim()||data.evidence.length>500)return json({error:'Informe situação, versão e evidência do encaminhamento ou atendimento, sem dados de alunos.'},400);
 const previous=data.status==='Encaminhado'?'Registrado':'Encaminhado';
 const result=await env.DB.batch([
  env.DB.prepare('UPDATE secretariat_requests SET status=?,evidence=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=? AND status=?').bind(data.status,data.evidence.trim(),id,data.version,previous),
  env.DB.prepare('INSERT INTO audit(id,actor,action,target) SELECT ?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),user.email,'PATCH',path)
 ]);
 return result[0].meta?.changes?json({ok:true,status:data.status}):json({error:'Pedido mudou ou etapa anterior não foi concluída. Atualize a fila.'},409);
}
