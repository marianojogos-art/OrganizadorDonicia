// Small, private attachments stay in the existing D1, never in public assets.
export const MAX_ATTACHMENT_BYTES=256*1024;
export class XeroxInputError extends Error{constructor(message,status=400){super(message);this.status=status}}
const types={'application/pdf':{extension:/\.pdf$/i,magic:[37,80,68,70,45]},'image/png':{extension:/\.png$/i,magic:[137,80,78,71,13,10,26,10]},'image/jpeg':{extension:/\.jpe?g$/i,magic:[255,216,255]}};
export function xeroxFields(data,user,previous={}){
 const professor=data.professor??previous.professor??user.name;
 const classroom=data.class??previous.class??'';
 const color=data.color??previous.color??'Preto e branco';
 if(typeof professor!=='string'||!professor.trim()||professor.length>100||typeof classroom!=='string'||classroom.length>100||!['Preto e branco','Colorido'].includes(color))throw new XeroxInputError('Confira professor, turma e impressão');
 const attachment=data.attachment;
 if(data.remove_attachment!==undefined&&typeof data.remove_attachment!=='boolean')throw new XeroxInputError('Remoção de anexo inválida');
 if(attachment!==undefined&&data.remove_attachment)throw new XeroxInputError('Escolha substituir ou remover o anexo');
 let name=previous.attachment_name||'',mime=previous.attachment_mime||'',base64=previous.attachment_data||'';
 if(data.remove_attachment){name='';mime='';base64=''}
 if(attachment!==undefined){
  if(!attachment||typeof attachment!=='object'||Array.isArray(attachment))throw new XeroxInputError('Anexo inválido');
  const type=types[attachment.type];
  if(!type||typeof attachment.name!=='string'||!attachment.name.trim()||attachment.name.length>160||/[\x00-\x1f\x7f/\\]/.test(attachment.name)||!type.extension.test(attachment.name))throw new XeroxInputError('Anexe somente PDF, PNG ou JPEG com nome válido');
  if(typeof attachment.base64!=='string'||attachment.base64.length>Math.ceil(MAX_ATTACHMENT_BYTES/3)*4)throw new XeroxInputError('Anexo maior que 256 KiB',413);
  if(attachment.base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(attachment.base64))throw new XeroxInputError('Codificação do anexo inválida');
  const bytes=atob(attachment.base64);
  if(btoa(bytes)!==attachment.base64)throw new XeroxInputError('Codificação do anexo inválida');
  if(!bytes.length||bytes.length>MAX_ATTACHMENT_BYTES)throw new XeroxInputError('Anexo vazio ou maior que 256 KiB',413);
  if(!type.magic.every((v,i)=>bytes.charCodeAt(i)===v))throw new XeroxInputError('O conteúdo não corresponde ao tipo do arquivo');
  name=attachment.name.trim();mime=attachment.type;base64=attachment.base64;
 }
 return [professor.trim(),classroom.trim(),color,name,mime,base64];
}
export function downloadAttachment(row){
 const bytes=Uint8Array.from(atob(row.attachment_data),c=>c.charCodeAt(0));
 return new Response(bytes,{headers:{'Content-Type':row.attachment_mime,'Content-Disposition':"attachment; filename=material; filename*=UTF-8''"+encodeURIComponent(row.attachment_name),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Referrer-Policy':'no-referrer'}});
}
export async function readLimitedBody(request,limit){
 const reader=request.body?.getReader();if(!reader)return '';let count=0;const parts=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;count+=value.byteLength;if(count>limit){await reader.cancel();throw new XeroxInputError('Conteúdo muito grande',413)}parts.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(count);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}return new TextDecoder().decode(bytes);
}
