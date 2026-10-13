const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const valid=d=>typeof d.title==='string'&&d.title.trim().length>0&&d.title.length<=120&&typeof d.content==='string'&&d.content.trim().length>0&&d.content.length<=4000&&['amarelo','azul','rosa','verde'].includes(d.color??'amarelo');
// Owner is always the authenticated active login. Direction has no override.
export async function personalNotes(request,DB,user,data){
 const path=new URL(request.url).pathname,id=/^\/api\/notes\/([^/]+)$/.exec(path)?.[1],method=request.method;
 if(method==='GET'){
  if(!id)return response((await DB.prepare('SELECT id,title,content,color,version,created_at,updated_at FROM personal_notes WHERE owner=? ORDER BY updated_at DESC,id').bind(user.email).all()).results);
  const note=await DB.prepare('SELECT id,title,content,color,version,created_at,updated_at FROM personal_notes WHERE id=? AND owner=?').bind(id,user.email).first();return note?response(note):response({error:'Nota não encontrada'},404);
 }
 if(!id&&method==='POST'){
  if(!valid(data))return response({error:'Informe título (até 120), texto (até 4000) e uma cor válida'},400);
  const noteId=crypto.randomUUID();await DB.batch([DB.prepare('INSERT INTO personal_notes(id,owner,title,content,color) VALUES(?,?,?,?,?)').bind(noteId,user.email,data.title.trim(),data.content.trim(),data.color??'amarelo'),DB.prepare('INSERT INTO audit(id,actor,action,target) VALUES(?,?,?,?)').bind(crypto.randomUUID(),user.email,method,path+'/'+noteId)]);return response({id:noteId},201);
 }
 if(!id||!['PATCH','DELETE'].includes(method))return response({error:'Método indisponível'},405);
 // Filtering before the version check also hides foreign record existence.
 const row=await DB.prepare('SELECT version FROM personal_notes WHERE id=? AND owner=?').bind(id,user.email).first();if(!row)return response({error:'Nota não encontrada'},404);
 if(!Number.isInteger(data.version)||data.version<1)return response({error:'Versão da nota necessária'},400);
 if(row.version!==data.version)return response({error:'Nota mudou. Atualize antes de salvar'},409);
 if(method==='PATCH'&&!valid(data))return response({error:'Título, texto ou cor inválidos'},400);
 const statement=method==='DELETE'?DB.prepare('DELETE FROM personal_notes WHERE id=? AND owner=? AND version=?').bind(id,user.email,data.version):DB.prepare('UPDATE personal_notes SET title=?,content=?,color=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner=? AND version=?').bind(data.title.trim(),data.content.trim(),data.color??'amarelo',id,user.email,data.version);
 const result=await DB.batch([statement,DB.prepare('INSERT INTO audit(id,actor,action,target) SELECT ?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),user.email,method,path)]);
 return result[0].meta?.changes?response({ok:true}):response({error:'Nota mudou. Atualize antes de salvar'},409);
}
