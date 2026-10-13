import {readLimitedBody} from './xerox.mjs';
const reply=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const kinds=['impression','improvement','feature'],statuses=['Nova','Em análise','Planejada','Implementada'];
const pagePaths=['/','/public.html','/equipe','/equipe/','/index.html'];
const fields='id,kind,message,contributor,page_path,page_section,page_title,status,version,created_at,updated_at';
export async function submitFeedback(request,DB){
 if(request.method!=='POST')return reply({error:'Use o post-it para enviar uma contribuição'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return reply({error:'Origem inválida'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'JSON necessário'},415);
 let data;try{data=JSON.parse(await readLimitedBody(request,16000))}catch(e){return reply({error:e.status?e.message:'JSON inválido'},e.status||400)}
 if(!data||typeof data!=='object'||Array.isArray(data))return reply({error:'Contribuição inválida'},400);
 if(typeof data.website==='string'&&data.website.trim())return reply({ok:true},201);
 if(!uuid(data.id)||!uuid(data.visitorId)||!kinds.includes(data.kind)||typeof data.message!=='string'||!data.message.trim()||data.message.length>3000||typeof data.contributor!=='string'||data.contributor.length>80||!data.page||typeof data.page!=='object'||!pagePaths.includes(data.page.path)||typeof data.page.section!=='string'||!/^[a-zA-Z0-9_-]{0,80}$/.test(data.page.section)||typeof data.page.title!=='string'||!data.page.title.trim()||data.page.title.length>180)return reply({error:'Confira o texto e a página da contribuição'},400);
 const values=[data.visitorId,data.kind,data.message.trim(),data.contributor.trim(),data.page.path,data.page.section,data.page.title.trim()];
 // One INSERT enforces the quota atomically; retrying the same id never duplicates a note.
 const result=await DB.prepare("INSERT INTO site_feedback(id,visitor_id,kind,message,contributor,page_path,page_section,page_title) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM site_feedback WHERE visitor_id=? AND created_at>=datetime('now','-1 hour'))<12 AND (SELECT count(*) FROM site_feedback WHERE visitor_id=? AND created_at>=datetime('now','-1 day'))<50 ON CONFLICT(id) DO NOTHING").bind(data.id,...values,data.visitorId,data.visitorId).run();
 if(result.meta?.changes)return reply({ok:true,id:data.id},201);
 const existing=await DB.prepare('SELECT visitor_id,kind,message,contributor,page_path,page_section,page_title FROM site_feedback WHERE id=?').bind(data.id).first();
 if(existing){const original=[existing.visitor_id,existing.kind,existing.message,existing.contributor,existing.page_path,existing.page_section,existing.page_title];return original.every((value,index)=>value===values[index])?reply({ok:true,id:data.id}):reply({error:'Esta contribuição já foi enviada. Inicie outra anotação.'},409)}
 return reply({error:'Você já enviou várias contribuições. Seu rascunho continua salvo; tente novamente mais tarde.'},429,{'Retry-After':'3600'});
}
export async function readFeedback(request,DB){
 const query=new URL(request.url).searchParams,where=[],args=[];
 for(const [key,column,allowed] of [['kind','kind',kinds],['status','status',statuses]]){
  const value=query.get(key);if(value){if(!allowed.includes(value))return reply({error:'Filtro inválido'},400);where.push(column+'=?');args.push(value)}
 }
 const page=query.get('page');if(page){if(!pagePaths.includes(page))return reply({error:'Página inválida'},400);where.push('page_path=?');args.push(page)}
 const section=query.get('section');if(section!==null){if(!/^[a-zA-Z0-9_-]{0,80}$/.test(section))return reply({error:'Seção inválida'},400);where.push('page_section=?');args.push(section)}
 const offset=Number(query.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0||offset>100000)return reply({error:'Posição inválida'},400);
 const filter=where.length?' WHERE '+where.join(' AND '):'';
 const [rows,total,pages]=await Promise.all([
  DB.prepare('SELECT '+fields+' FROM site_feedback'+filter+' ORDER BY created_at DESC,id DESC LIMIT 30 OFFSET ?').bind(...args,offset).all(),
  DB.prepare('SELECT count(*) AS total FROM site_feedback'+filter).bind(...args).first(),
  DB.prepare('SELECT page_path,page_section,max(page_title) AS page_title,count(*) AS total FROM site_feedback GROUP BY page_path,page_section ORDER BY page_title,page_path LIMIT 200').all()
 ]);
 return reply({items:rows.results,total:total.total,offset,limit:30,pages:pages.results});
}
export async function updateFeedback(request,DB,user,data){
 const id=/^\/api\/feedback\/([^/]+)$/.exec(new URL(request.url).pathname)?.[1];
 if(request.method!=='PATCH'||!id)return reply({error:'Método indisponível'},405);
 if(!Number.isInteger(data.version)||data.version<1||!statuses.includes(data.status))return reply({error:'Confira a situação e a versão da contribuição'},400);
 const row=await DB.prepare('SELECT version FROM site_feedback WHERE id=?').bind(id).first();if(!row)return reply({error:'Contribuição não encontrada'},404);
 if(row.version!==data.version)return reply({error:'A contribuição mudou. Atualize a lista.'},409);
 const result=await DB.batch([
  DB.prepare('UPDATE site_feedback SET status=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=?').bind(data.status,id,data.version),
  DB.prepare('INSERT INTO audit(id,actor,action,target) SELECT ?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),user.email,'PATCH','/api/feedback/'+id)
 ]);
 return result[0].meta?.changes?reply({ok:true}):reply({error:'A contribuição mudou. Atualize a lista.'},409);
}
