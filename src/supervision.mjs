// SGE is an authenticated, server-side adapter. Its page selectors must be
// implemented against real SGE pages; the Organizador never receives credentials.
export class SupervisionError extends Error {
 constructor(message,status=502){super(message);this.status=status}
}
const label=(value,max=250)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const id=value=>label(value,150)&&!/[\u0000-\u001f]/.test(value);
const normalized=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
function sourceUrl(value,origin){
 let url;try{url=new URL(value)}catch{throw new SupervisionError('Link do SGE inválido.')}
 if(url.protocol!=='https:'||url.username||url.password||(origin&&url.origin!==origin))throw new SupervisionError('Link fora da origem do SGE.');
 return url.href;
}
async function read(env,path){
 if(!env.SGE?.fetch)throw new SupervisionError('Conexão com o SGE ainda não configurada. Informe a página de turmas e exemplos das páginas de professores e planejamentos para concluir a integração.',503);
 let response;try{response=await env.SGE.fetch(new Request('https://sge-adapter.internal'+path,{signal:AbortSignal.timeout(15000)}))}catch{throw new SupervisionError('O SGE não respondeu. Tente novamente.',503)}
 if(response.status===401||response.status===403)throw new SupervisionError('A sessão do SGE precisa ser autenticada novamente.',503);
 if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw new SupervisionError('Não foi possível ler esta página do SGE.');
 const raw=await response.text();if(raw.length>2_000_000)throw new SupervisionError('Página do SGE excedeu o limite de leitura.');
 try{return JSON.parse(raw)}catch{throw new SupervisionError('Resposta do SGE inválida.')}
}
export async function readSupervisionClasses(env){
 const data=await read(env,'/classes');
 if(!Array.isArray(data.classes)||data.classes.length>250||data.complete!==true)throw new SupervisionError('Lista de turmas incompleta ou não reconhecida.');
 const source=sourceUrl(data.sourceUrl,'https://www.sgebr.net.br'),origin=new URL(source).origin,ids=new Set();
 const classes=data.classes.map(c=>{
  if(!c||!id(c.id)||!label(c.name,120)||ids.has(c.id))throw new SupervisionError('Turma não reconhecida no SGE.');
  ids.add(c.id);return {id:c.id,name:c.name.trim(),url:sourceUrl(c.url,origin)};
 });
 const firstPageIds=Array.isArray(data.firstPageIds)?data.firstPageIds:classes.map(c=>c.id);
 if(firstPageIds.some(id=>!ids.has(id)))throw new SupervisionError('Turmas da primeira página não reconhecidas.');
 return {classes,firstPageIds,sourceUrl:source,updatedAt:new Date().toISOString()};
}
export function situationReview(value){
 const situation=typeof value==='string'?value.trim():'';
 if(!situation)return {situation:'Não informada',review:'missing'};
 const key=normalized(situation);
 if(['aprovado','aprovada','planejamento finalizado'].includes(key))return {situation,review:'approved'};
 if(['pendente','rascunho','em elaboracao','devolvido','devolvida','nao enviado','nao enviada','nao enviado para analise'].includes(key))return {situation,review:'attention'};
 if(['em analise','enviado para analise'].includes(key))return {situation,review:'analysis'};
 return {situation,review:'check'};
}
export async function collectSupervision(env,input){
 if(!input||!Array.isArray(input.classIds)||!input.classIds.length||input.classIds.length>250||input.classIds.some(x=>!id(x))||new Set(input.classIds).size!==input.classIds.length||!['classes','school'].includes(input.scope)||typeof input.teacher!=='string'||input.teacher.length>150)throw new SupervisionError('Confirme as turmas e informe uma busca válida.',400);
 const query=normalized(input.teacher);
 if(input.scope==='school'&&query.length<2)throw new SupervisionError('Informe pelo menos duas letras do professor para buscar em toda a escola.',400);
 const directory=await readSupervisionClasses(env),origin=new URL(directory.sourceUrl).origin;
 if(input.classIds.some(key=>!directory.classes.some(c=>c.id===key)))throw new SupervisionError('A lista de turmas mudou. Atualize e confirme novamente.',409);
 if(input.scope==='school'&&(input.classIds.length!==directory.classes.length||directory.classes.some(c=>!input.classIds.includes(c.id))))throw new SupervisionError('Confirme todas as turmas da escola antes da busca.',409);
 const classes=directory.classes.filter(c=>input.classIds.includes(c.id)),teachers=new Map(),coverage=[];
 for(const c of classes){
  const result={classId:c.id,className:c.name,ok:true,errors:[]};coverage.push(result);
  let assignments;
  try{
   const data=await read(env,'/classes/'+encodeURIComponent(c.id)+'/teachers');
   if(data.classId!==c.id||data.complete!==true||!Array.isArray(data.teachers)||data.teachers.length>200)throw new SupervisionError('Lista de professores incompleta.');
   assignments=uniqueTeacherAssignments(data.teachers).map(t=>({...t,url:sourceUrl(t.url,origin)}));
  }catch(e){result.ok=false;result.errors.push(e.message);continue}
  for(const t of assignments){
   if(input.targetAssignments&&!input.targetAssignments.some(a=>a.classId===c.id&&a.assignmentId===t.assignmentId))continue;
   const candidate=normalized(t.name);if(query&&!candidate.includes(query)&&!query.startsWith(candidate+' '))continue;
   if(!teachers.has(t.id))teachers.set(t.id,{id:t.id,name:t.name,assignments:[],plans:[]});
   const teacher=teachers.get(t.id),assignment={classId:c.id,className:c.name,assignmentId:t.assignmentId,subject:t.subject,url:t.url,ok:true};teacher.assignments.push(assignment);
   try{
    const data=await read(env,'/classes/'+encodeURIComponent(c.id)+'/teachers/'+encodeURIComponent(t.assignmentId)+'/planning');
    if(data.classId!==c.id||data.teacherId!==t.id||data.assignmentId!==t.assignmentId||data.complete!==true||!Array.isArray(data.plans)||data.plans.length>500)throw new SupervisionError('Planejamentos incompletos ou de outro professor.');
    if(data.sourceUrl)assignment.teacherUrl=sourceUrl(data.sourceUrl,origin);
    const seen=new Set();
    const plans=data.plans.map(p=>{
     if(!p||!id(p.id)||seen.has(p.id)||!label(p.title,300)||![null,1,2,3].includes(p.trimester)||(p.situation!==null&&typeof p.situation!=='string')||(typeof p.situation==='string'&&p.situation.length>200))throw new SupervisionError('Planejamento não reconhecido.');
     seen.add(p.id);
     const trimester=p.start&&p.end?planningTrimester(p.start,p.end):p.trimester;
     return {id:p.id,title:p.title,trimester,...situationReview(p.situation),url:p.url===null?null:sourceUrl(p.url,origin),classId:c.id,className:c.name,assignmentId:t.assignmentId,subject:t.subject};
    });
    if(label(data.name,150))teacher.name=data.name;
    teacher.plans.push(...plans);
   }catch(e){assignment.ok=false;result.ok=false;result.errors.push(t.name+' · '+t.subject+': '+e.message)}
  }
 }
 for(const t of teachers.values()){
  const situations={};for(const p of t.plans)situations[p.situation]=(situations[p.situation]||0)+1;
  t.summary={classes:[...new Set(t.assignments.map(a=>a.className))],total:t.plans.length,situations,attention:t.plans.filter(p=>p.review==='attention'||p.review==='missing').length,inAnalysis:t.plans.filter(p=>p.review==='analysis').length,unclassified:t.plans.filter(p=>p.review==='check').length,missingLinks:t.plans.filter(p=>!p.url).length,failedAssignments:t.assignments.filter(a=>!a.ok).length};
  const rank={missing:0,attention:1,analysis:2,check:3,approved:4};t.plans.sort((a,b)=>rank[a.review]-rank[b.review]||a.className.localeCompare(b.className,'pt-BR'));
 }
 return {scope:input.scope,query:input.teacher,classes,coverage,complete:coverage.every(c=>c.ok),teachers:[...teachers.values()].filter(t=>!query||normalized(t.name).includes(query)).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),updatedAt:new Date().toISOString(),sourceUrl:directory.sourceUrl};
}
export function planningTrimester(start,end){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>end||Number.isNaN(Date.parse(start))||Number.isNaN(Date.parse(end))||new Date(start).toISOString().slice(0,10)!==start||new Date(end).toISOString().slice(0,10)!==end)throw new SupervisionError('Datas do planejamento inválidas.');
 if(start.slice(0,4)!==end.slice(0,4))return null;
 const ranges=[['03-01','05-31'],['06-01','09-30'],['10-01','12-31']],year=start.slice(0,4);
 const index=ranges.findIndex(([from,to])=>start>=year+'-'+from&&end<=year+'-'+to);return index<0?null:index+1;
}
export function snapshotAdapter(snapshot){
 if(!snapshot||!snapshot.directory||!Array.isArray(snapshot.entries)||snapshot.entries.length>10000)throw new SupervisionError('Dados da consulta SGE inválidos.',400);
 const entries=new Map();
 for(const entry of snapshot.entries){
  if(!entry||typeof entry.path!=='string'||!/^\/classes\/[^/]+\/teachers(?:\/[^/]+\/planning)?$/.test(entry.path))throw new SupervisionError('Página inválida na consulta.',400);
  const previous=entries.get(entry.path);
  // Older connectors can visit the same teacher/subject more than once when
  // SGE repeats a slot. Preserve one successful read, without double counting.
  if(previous&&!previous.error&&!entry.error){
   if(['classId','teacherId','assignmentId'].some(key=>previous.data?.[key]!==entry.data?.[key]))throw new SupervisionError('Respostas incompatíveis para a mesma página do SGE.',400);
  }
  if(!previous||previous.error||!entry.error)entries.set(entry.path,entry);
 }
 return {async fetch(request){
  const path=new URL(request.url).pathname;if(path==='/classes')return Response.json(snapshot.directory);
  const entry=entries.get(path);if(!entry||entry.error)return Response.json({error:'Leitura não concluída'},{status:502});
  return Response.json(entry.data);
 }};
}
export function uniqueTeacherAssignments(teachers){
 const assignments=new Map();
 for(const t of teachers){
  if(!t||!id(t.id)||!id(t.assignmentId)||!label(t.name,150)||!label(t.subject,150))throw new SupervisionError('Professor ou disciplina não reconhecidos.');
  const previous=assignments.get(t.assignmentId);
  if(previous&&(previous.id!==t.id||normalized(previous.name)!==normalized(t.name)||normalized(previous.subject)!==normalized(t.subject)))throw new SupervisionError('Vínculos incompatíveis para o mesmo professor e disciplina.');
  if(!previous)assignments.set(t.assignmentId,t);
 }
 return [...assignments.values()];
}
