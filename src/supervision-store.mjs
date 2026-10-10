import {SupervisionError} from './supervision.mjs';
export function summarizeTeachers(teachers){
 for(const t of teachers){
  const situations={};for(const p of t.plans)situations[p.situation]=(situations[p.situation]||0)+1;
  t.summary={classes:[...new Set(t.assignments.map(a=>a.className))],total:t.plans.length,situations,attention:t.plans.filter(p=>['attention','missing'].includes(p.review)).length,inAnalysis:t.plans.filter(p=>p.review==='analysis').length,unclassified:t.plans.filter(p=>p.review==='check').length,missingLinks:t.plans.filter(p=>!p.url).length,failedAssignments:t.assignments.filter(a=>!a.ok).length};
 }
 return teachers.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
}
export async function loadSupervision(DB){
 // A batch provides a consistent revision and class snapshot.
 const [meta,rows]=await DB.batch([DB.prepare('SELECT * FROM supervision_state WHERE id=1'),DB.prepare('SELECT data FROM supervision_classes ORDER BY class_id')]);
 const state=meta.results?.[0];
 if(!state)throw new SupervisionError('Não foi possível ler as consultas salvas.',503);
 const classes=[],coverage=[],teachers=new Map();
 for(const row of rows.results||[]){const r=JSON.parse(row.data);classes.push(...r.classes);coverage.push(...r.coverage);for(const t of r.teachers){if(!teachers.has(t.id))teachers.set(t.id,{...t,plans:[],assignments:[]});const out=teachers.get(t.id);out.plans.push(...t.plans);out.assignments.push(...t.assignments)}}
 return {...JSON.parse(state.metadata),version:state.version,scope:'classes',query:'',classes,coverage,complete:coverage.every(c=>c.ok),teachers:summarizeTeachers([...teachers.values()])};
}
export function updateTargets(saved,input){
 const query=input.teacher.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 return saved.teachers.flatMap(t=>{const name=t.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(query&&!name.includes(query))return [];return t.assignments.filter(a=>input.classIds.includes(a.classId)&&t.plans.some(p=>p.classId===a.classId&&p.assignmentId===a.assignmentId&&p.situation===input.updateSituation&&!p.notFound)).map(a=>({classId:a.classId,assignmentId:a.assignmentId}))});
}
export function mergeSupervision(saved,fresh,{actor,actorName,situation=''}){
 const time=fresh.updatedAt,teachers=new Map(saved.teachers.map(t=>[t.id,structuredClone(t)]));
 for(const incoming of fresh.teachers){
  if(!teachers.has(incoming.id))teachers.set(incoming.id,{...incoming,plans:[],assignments:[]});
  const t=teachers.get(incoming.id);t.name=incoming.name;
  for(const a of incoming.assignments){
   const matches=p=>p.classId===a.classId&&p.assignmentId===a.assignmentId;
   const oldAssignment=t.assignments.find(x=>x.classId===a.classId&&x.assignmentId===a.assignmentId);
   const stamp={checkedAt:time,checkedBy:actor,checkedByName:actorName};
   if(a.ok){
    const old=t.plans.filter(matches),current=incoming.plans.filter(matches),ids=new Set(current.map(p=>p.id));
    const merged=current.map(p=>{const previous=old.find(x=>x.id===p.id);return situation&&previous&&previous.situation!==situation?previous:{...p,...stamp,isNew:!previous}});
    for(const p of old)if(!ids.has(p.id)&&(situation?p.situation===situation:true))merged.push({...p,...stamp,notFound:true,isNew:false});else if(!ids.has(p.id))merged.push(p);
    t.plans=[...t.plans.filter(p=>!matches(p)),...merged];
    const next={...a,...stamp,lastAttemptAt:time};t.assignments=t.assignments.filter(x=>x!==oldAssignment);t.assignments.push(next);
   }else{
    t.assignments=t.assignments.filter(x=>x!==oldAssignment);t.assignments.push({...oldAssignment,...a,lastAttemptAt:time});
   }
  }
 }
 const classMap=new Map(saved.classes.map(c=>[c.id,c]));for(const c of fresh.classes)classMap.set(c.id,c);
 const coverage=new Map(saved.coverage.map(c=>[c.classId,c]));for(const c of fresh.coverage)coverage.set(c.classId,{...c,lastAttemptAt:time,updatedBy:actor,updatedByName:actorName});
 for(const c of coverage.values())if([...teachers.values()].some(t=>t.assignments.some(a=>a.classId===c.classId&&!a.ok))){c.ok=false;if(!c.errors.length)c.errors=['Há vínculos cuja última tentativa de leitura falhou.'];}
 return {...fresh,query:'',scope:'classes',classes:[...classMap.values()],coverage:[...coverage.values()],teachers:summarizeTeachers([...teachers.values()]),complete:[...coverage.values()].every(c=>c.ok),updatedBy:actor,updatedByName:actorName,selective:!!situation,updateSituation:situation};
}
export async function saveSupervision(DB,saved,fresh,options){
 const report=mergeSupervision(saved,fresh,options),token=crypto.randomUUID(),metadata=JSON.stringify({updatedAt:report.updatedAt,updatedBy:report.updatedBy,updatedByName:report.updatedByName,selective:report.selective,updateSituation:report.updateSituation,sourceUrl:report.sourceUrl});
 const statements=[DB.prepare('UPDATE supervision_state SET version=version+1,token=?,metadata=? WHERE id=1 AND version=?').bind(token,metadata,saved.version)];
 for(const c of report.classes){
  const data=JSON.stringify({...report,classes:[c],coverage:report.coverage.filter(x=>x.classId===c.id),teachers:report.teachers.filter(t=>t.assignments.some(a=>a.classId===c.id)).map(t=>({...t,plans:t.plans.filter(p=>p.classId===c.id),assignments:t.assignments.filter(a=>a.classId===c.id)}))});
  if(new TextEncoder().encode(data).length>1_800_000)throw new SupervisionError('Consulta desta turma excedeu o limite de salvamento.',413);
  statements.push(DB.prepare('INSERT INTO supervision_classes(class_id,data) SELECT ?,? WHERE EXISTS(SELECT 1 FROM supervision_state WHERE id=1 AND token=?) ON CONFLICT(class_id) DO UPDATE SET data=excluded.data').bind(c.id,data,token));
 }
 statements.push(DB.prepare("INSERT INTO audit(id,actor,action,target) SELECT ?,?,'POST','/api/supervision/save' WHERE EXISTS(SELECT 1 FROM supervision_state WHERE id=1 AND token=?)").bind(crypto.randomUUID(),options.actor,token));
 const result=await DB.batch(statements);if(!result[0].meta?.changes)throw new SupervisionError('Outra pessoa atualizou a Supervisão. Recarregue os dados salvos antes de consultar novamente.',409);
 return {...report,version:saved.version+1};
}
