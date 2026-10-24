import {readLimitedBody} from './xerox.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const actions={reservation:{path:'/api/reservations',keys:['space','date','start','end','responsible','purpose']},xerox:{path:'/api/xerox',keys:['title','copies','deadline']},message:{path:'/api/staff-requests',keys:['type','title','classes','description','deadline']}};
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');
export async function executeAssistantAction(request,DB,user,execute){
 if(request.method!=='POST')return json({error:'Método indisponível'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Origem inválida'},403);
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return json({error:'JSON necessário'},415);
 let data;try{data=JSON.parse(await readLimitedBody(request,8192))}catch(error){return json({error:'Dados inválidos'},error.status||400)}
 if(!data||Array.isArray(data)||Object.keys(data).some(key=>!['id','action','data','confirmed'].includes(key))||data.confirmed!==true||!/^\b[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b$/i.test(data.id||'')||!Object.hasOwn(actions,data.action)||!data.data||Array.isArray(data.data)||typeof data.data!=='object')return json({error:'Revise e confirme uma ação disponível antes de enviar'},400);
 const action=actions[data.action];
 if(Object.keys(data.data).some(key=>!action.keys.includes(key))||data.action==='message'&&!['message','material'].includes(data.data.type))return json({error:'Campo não permitido nesta ação'},400);
 const canonical=JSON.stringify(action.keys.map(key=>[key,data.data[key]??null]));
 const requestHash=await hash(data.action+'\0'+canonical),recordId='assistant-'+await hash(user.email+'\0'+data.id);
 const receipt=()=>DB.prepare('SELECT request_hash,record_id FROM assistant_operations WHERE owner=? AND operation_id=?').bind(user.email,data.id).first();
 const previous=await receipt();
 const replay=row=>row.request_hash===requestHash?json({id:row.record_id,confirmed:true,replayed:true}):json({error:'Este envio já foi utilizado com outros dados. Atualize antes de iniciar outra ação.'},409);
 if(previous)return replay(previous);
 // The receipt commits in the SAME transaction as the original service write and audit.
 // A failed or concurrent retry rolls back all writes; the original endpoint still
 // validates ownership, fields, conflicts and roles. Nothing is sent externally.
 const actionDB={...DB,batch:async statements=>{
  const result=await DB.batch([...statements,DB.prepare('INSERT INTO assistant_operations(owner,operation_id,request_hash,record_id,action) VALUES(?,?,?,?,?)').bind(user.email,data.id,requestHash,recordId,data.action)]);
  return result.slice(0,statements.length);
 }};
 const response=await execute(action.path,data.data,actionDB,recordId);
 if(response.ok)return json({id:recordId,confirmed:true},201);
 const completed=await receipt();if(completed)return replay(completed);
 return response;
}
