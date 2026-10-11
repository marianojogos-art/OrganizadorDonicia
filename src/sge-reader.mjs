// Shared read-only SGE traversal for the desktop connector and mobile app.
import {allowedSgeUrl as allowed} from './sge-origin.mjs';
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

export function createSgeReader(transport){
async function directory(progress=()=>{}){
 let page=await transport.snapshot();if(page.type!=='classes')throw Error('Abra a página 1 (lista de turmas dos planejamentos) em uma aba do SGE.');
 if(page.pagination.current!==1)page=await transport.move({kind:'first'});
 const firstPageIds=page.classes.map(c=>c.id),sourceUrl=page.sourceUrl,total=page.total,classes=[];
 for(let index=1;index<=page.pagination.last;index++){
  if(page.type!=='classes'||page.pagination.current!==index)throw Error('A paginação de turmas mudou no SGE.');
  await progress({stage:'directory',current:index,total:page.pagination.last,classCount:classes.length+page.classes.length,schoolTotal:total});
  classes.push(...page.classes);if(index<page.pagination.last)page=await transport.move({kind:'next'});
 }
 if(classes.length!==total||new Set(classes.map(c=>c.id)).size!==classes.length)throw Error('A lista completa de turmas não confere com o total do SGE.');
 return {classes,firstPageIds,sourceUrl,complete:true};
}
async function locateClass(source,id){
 let page=await transport.navigate(source);if(page.type!=='classes')throw Error('Não foi possível voltar à lista de turmas.');
 if(page.pagination.current!==1)page=await transport.move({kind:'first'});
 for(let index=1;index<=page.pagination.last;index++){
  if(page.classes.some(c=>c.id===id))return await transport.move({kind:'class',id});
  if(index<page.pagination.last)page=await transport.move({kind:'next'});
 }
 throw Error('A turma não aparece mais na lista do SGE.');
}
function matchesClass(teachers,classId){
 const key=classId.split(':');return teachers.type==='teachers'&&teachers.complete&&teachers.classNumber===key[5]&&teachers.grade===key[2]&&teachers.stage===key[4];
}
async function readClass(input){
 if(typeof input?.classId!=='string'||!/^106801:\d{4}:\d+:\d+:\d+:\d+$/.test(input.classId))throw Error('Turma inválida.');
 const teachers=await locateClass(allowed(input.sourceUrl),input.classId);
 if(!matchesClass(teachers,input.classId))throw Error('Página de disciplinas não corresponde à turma confirmada.');
 return {...teachers,classId:input.classId};
}
async function readPlanning(input,progress=()=>{}){
 if(typeof input?.classId!=='string'||typeof input.assignmentId!=='string')throw Error('Professor ou turma inválidos.');
 const teachers=await transport.navigate(allowed(input.sourceUrl));
 if(!matchesClass(teachers,input.classId))throw Error('Não foi possível voltar aos professores da turma confirmada.');
 const t=teachers.teachers.find(t=>t.assignmentId===input.assignmentId);if(!t)throw Error('O professor mudou. Consulte as turmas novamente.');
 let page=await transport.move({kind:'teacher',id:t.assignmentId});
 if(page.type!=='plans'||!page.complete||page.plans.some(p=>p.classId!==input.classId||p.subjectCode!==t.assignmentId.split(':')[0])||!normalize(page.teacherName).startsWith(normalize(t.name)))throw Error('Página de planejamentos não corresponde ao professor e à turma.');
 const plans=page.plans,name=page.teacherName,sourceUrl=page.sourceUrl;
 if(input.query&&!normalize(name).includes(normalize(input.query)))return {classId:input.classId,teacherId:t.id,assignmentId:t.assignmentId,name,sourceUrl,complete:true,plans:[]};
 // Each assignment is a separate request so a school-wide search does not
 // depend on keeping one extension service-worker invocation alive.
 await progress({stage:'planning-list',name,total:plans.length});
 for(let index=0;index<plans.length;index++){
  const plan=plans[index];
  if(Array.isArray(input.preservePlanIds)&&input.preservePlanIds.includes(plan.id))continue;
  await progress({stage:'opening-plan',name,current:index+1,total:plans.length,title:plan.title,situation:plan.situation});
  try{
   page=await transport.navigate(sourceUrl);if(page.type!=='plans')throw Error('Página de planejamentos indisponível.');
   const detail=await transport.move({kind:'plan',id:plan.id});
   if(detail.type!=='detail'||new URL(detail.sourceUrl).pathname===new URL(sourceUrl).pathname)throw Error('O SGE não retornou um endereço direto para este planejamento.');
   plan.url=detail.sourceUrl;
  }catch(e){plan.url=null;plan.linkError=e.message}
  const {id,title,start,end,trimester,situation,url}=plan;
  await progress({stage:'plan-read',name,current:index+1,total:plans.length,sourceUrl,plan:{id,title,start,end,trimester,situation,url}});
 }
 return {classId:input.classId,teacherId:t.id,assignmentId:t.assignmentId,name,sourceUrl,complete:true,plans};
}

return {directory,teachers:readClass,planning:readPlanning};
}
