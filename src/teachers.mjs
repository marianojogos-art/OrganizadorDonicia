import {parseHTML} from 'linkedom/worker';

export const teacherSource='https://www.webhorario.com.br/gradeporprofs.php?id=7829';
const cacheLifetime=24*60*60*1000;

function directoryFromDocument(document){
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

export function parseTeachers(html){return directoryFromDocument(parseHTML(html).document)}

export function parseSchoolGrade(html){
 const {document}=parseHTML(html),directory=directoryFromDocument(document),schedule=Object.fromEntries(directory.names.map(name=>[name,[]]));
 const weekdays={SEG:1,TER:2,QUA:3,QUI:4,SEX:5,SAB:6,DOM:0};
 for(const table of document.querySelectorAll('table.tableProf')){
  const rows=[...table.querySelectorAll('tr')];
  const title=rows[0]?.textContent.replace(/\s+/g,' ').trim()||'';
  const header=/^(.+?)\s+-\s+(\d+)\s+aulas?\b/i.exec(title);
  const teachers=header[1].split(/\s+e\s+/);
  const labels=[...(rows[1]?.children||[])].slice(1).map(cell=>cell.textContent.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase());
  if(!labels.length||labels.some(label=>!Object.hasOwn(weekdays,label))||new Set(labels).size!==labels.length)throw new Error('Dias da grade não reconhecidos');
  let count=0;
  for(const row of rows.slice(2)){
   const cells=[...row.children],slot=cells[0]?.textContent.trim()||'';
   if(cells.length!==labels.length+1)throw new Error('Colunas da grade mudaram');
   for(let index=1;index<cells.length;index++){
    const cell=cells[index],className=cell.querySelector('.disc')?.textContent.replace(/\s+/g,' ').trim();
    if(!className)continue;
    const times=[...cell.textContent.matchAll(/([0-2]\d:[0-5]\d)\s*[-–]\s*([0-2]\d:[0-5]\d)/g)];
    const subject=cell.querySelector('.prof')?.textContent.replace(/\s+/g,' ').trim()||'';
    if(times.length!==1||times[0][1]>=times[0][2]||times[0][2]>'23:59'||className.length>80||subject.length>250||!slot||slot.length>30)throw new Error('Aula da grade não reconhecida');
    const lesson={weekday:weekdays[labels[index-1]],slot,class:className,subject,start:times[0][1],end:times[0][2]};count++;
    for(const teacher of teachers)schedule[teacher].push(lesson);
   }
  }
  if(count!==Number(header[2]))throw new Error('Quantidade de aulas da grade não confere');
 }
 for(const teacher of directory.names){
  const unique=new Map(schedule[teacher].map(lesson=>[JSON.stringify(lesson),lesson]));
  schedule[teacher]=[...unique.values()].sort((a,b)=>a.weekday-b.weekday||a.start.localeCompare(b.start)||a.end.localeCompare(b.end)||a.class.localeCompare(b.class));
 }
 return {...directory,schedule};
}

export async function readTeachers(DB,{force=false,fetcher=fetch,now=Date.now()}={}){
 const saved=await DB.prepare('SELECT names,schedule,source_version,fetched_at FROM teacher_directory WHERE id=1').first();
 const cached=saved?{teachers:JSON.parse(saved.names),schedule:JSON.parse(saved.schedule),sourceVersion:saved.source_version,updatedAt:saved.fetched_at,sourceUrl:teacherSource}:null;
 if(cached&&!force&&Object.keys(cached.schedule).length&&now-Date.parse(cached.updatedAt)<cacheLifetime)return {...cached,stale:false};
 try {
  const response=await fetcher(teacherSource,{redirect:'manual',signal:AbortSignal.timeout(8000)});
  if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw new Error('WebHorário indisponível');
  // Bound both downloaded content and parser work; this source is fixed, never user supplied.
  const reader=response.body.getReader();const chunks=[];let length=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>2_000_000)throw new Error('Grade muito grande');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  const {names,schedule,sourceVersion}=parseSchoolGrade(new TextDecoder().decode(bytes));
  const updatedAt=new Date(now).toISOString();
  await DB.prepare('INSERT INTO teacher_directory(id,names,schedule,source_version,fetched_at) VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET names=excluded.names,schedule=excluded.schedule,source_version=excluded.source_version,fetched_at=excluded.fetched_at').bind(JSON.stringify(names),JSON.stringify(schedule),sourceVersion,updatedAt).run();
  return {teachers:names,schedule,sourceVersion,updatedAt,sourceUrl:teacherSource,stale:false};
 }catch{
  if(cached)return {...cached,stale:true};
  throw new Error('Não foi possível ler os professores no WebHorário. Tente atualizar a lista.');
 }
}
