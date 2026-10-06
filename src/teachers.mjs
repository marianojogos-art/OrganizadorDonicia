import {parseHTML} from 'linkedom/worker';

export const teacherSource='https://www.webhorario.com.br/gradeporprofs.php?id=7829';
const cacheLifetime=24*60*60*1000;

export function parseTeachers(html){
 const {document}=parseHTML(html);
 if(!/Don[íi]cia/i.test(document.querySelector('h1')?.textContent||''))throw new Error('Grade da escola não encontrada');
 const tables=[...document.querySelectorAll('table.tableProf')];
 const names=tables.map(table=>{
  const title=table.querySelector('th')?.textContent.replace(/\s+/g,' ').trim()||'';
  const match=/^(.+?)\s+-\s+\d+\s+aulas?\b/i.exec(title);
  if(!match||match[1].length>100||/[<>\u0000-\u001f]/.test(match[1]))throw new Error('Lista de professores mudou de formato');
  return match[1];
 });
 if(!names.length||names.length>500)throw new Error('Lista de professores indisponível');
 const sourceVersion=[...document.querySelectorAll('p')].map(p=>p.textContent.trim()).find(t=>t.startsWith('Versão:'))?.slice(7).trim().slice(0,100)||'';
 // The published grade groups some pairs as "Graziela e Elaine"; list each name.
 return {names:[...new Set(names.flatMap(name=>name.split(/\s+e\s+/)))].sort((a,b)=>a.localeCompare(b,'pt-BR')),sourceVersion};
}

export async function readTeachers(DB,{force=false,fetcher=fetch,now=Date.now()}={}){
 const saved=await DB.prepare('SELECT names,source_version,fetched_at FROM teacher_directory WHERE id=1').first();
 const cached=saved?{teachers:JSON.parse(saved.names),sourceVersion:saved.source_version,updatedAt:saved.fetched_at,sourceUrl:teacherSource}:null;
 if(cached&&!force&&now-Date.parse(cached.updatedAt)<cacheLifetime)return {...cached,stale:false};
 try {
  const response=await fetcher(teacherSource,{redirect:'manual',signal:AbortSignal.timeout(8000)});
  if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw new Error('WebHorário indisponível');
  // Bound both downloaded content and parser work; this source is fixed, never user supplied.
  const reader=response.body.getReader();const chunks=[];let length=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>2_000_000)throw new Error('Grade muito grande');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  const {names,sourceVersion}=parseTeachers(new TextDecoder().decode(bytes));
  const updatedAt=new Date(now).toISOString();
  await DB.prepare('INSERT INTO teacher_directory(id,names,source_version,fetched_at) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET names=excluded.names,source_version=excluded.source_version,fetched_at=excluded.fetched_at').bind(JSON.stringify(names),sourceVersion,updatedAt).run();
  return {teachers:names,sourceVersion,updatedAt,sourceUrl:teacherSource,stale:false};
 }catch{
  if(cached)return {...cached,stale:true};
  throw new Error('Não foi possível ler os professores no WebHorário. Tente atualizar a lista.');
 }
}
