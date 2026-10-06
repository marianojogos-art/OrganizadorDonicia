export class PlanInputError extends Error{constructor(message,status=400){super(message);this.status=status}}
export function consecutiveDates(startDate,extraDays){
 if(typeof startDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||Number.isNaN(Date.parse(startDate))||new Date(startDate).toISOString().slice(0,10)!==startDate||!Number.isInteger(extraDays)||extraDays<0||extraDays>30)throw new PlanInputError('Selecione o primeiro dia e de 0 a 30 dias adicionais');
 const dates=Array.from({length:extraDays+1},(_,index)=>{const date=new Date(startDate+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+index);return date.toISOString().slice(0,10)});
 if(dates.some(date=>date.length!==10))throw new PlanInputError('Intervalo de datas inválido');
 return dates;
}
export const mondayOf=date=>{const monday=new Date(date+'T12:00:00Z');monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);return monday.toISOString().slice(0,10)};
const normalize=name=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();

export async function makeSubstitutionPlan(directory,teacher,startDate,extraDays,existingRows=[]){
 const dates=consecutiveDates(startDate,extraDays);
 if(typeof teacher!=='string'||teacher.length>100)throw new PlanInputError('Selecione um professor da lista');
 const matches=directory.teachers.filter(name=>normalize(name)===normalize(teacher));
 if(matches.length!==1)throw new PlanInputError('Selecione um professor da lista do WebHorário');
 const canonical=matches[0],grade=directory.schedule?.[canonical];
 if(!Array.isArray(grade))throw new PlanInputError('A grade de aulas não está disponível. Atualize o WebHorário e tente novamente.',503);
 const days=dates.map(date=>{
  const weekday=new Date(date+'T12:00:00Z').getUTCDay();
  return {date,lessons:grade.filter(lesson=>lesson.weekday===weekday).map((lesson,index)=>{
   const overlaps=existingRows.filter(row=>row.date===date&&row.class===lesson.class&&row.start<lesson.end&&row.end>lesson.start);
   const existing=overlaps.find(row=>row.start===lesson.start&&row.end===lesson.end)||null;
   return {...lesson,key:date+':'+index,date,week:mondayOf(date),teacher:canonical,existing,conflict:overlaps.length>0&&!existing};
  })};
 });
 const lessons=days.flatMap(day=>day.lessons);
 if(lessons.length>350)throw new PlanInputError('Este intervalo tem muitas aulas. Selecione menos dias por vez.');
 const fingerprintData={teacher:canonical,startDate,extraDays,sourceVersion:directory.sourceVersion,lessons:lessons.map(({key,date,class:className,start,end,subject,slot,existing,conflict})=>({key,date,class:className,start,end,subject,slot,existing:existing?{id:existing.id,version:existing.version}:null,conflict}))};
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(fingerprintData)));
 const fingerprint=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
 const weeklyLoads={};
 for(const row of existingRows){if(!row.auxiliary)continue;const week=row.week||mondayOf(row.date);weeklyLoads[week]??={};weeklyLoads[week][row.auxiliary]=(weeklyLoads[week][row.auxiliary]||0)+1}
 return {teacher:canonical,startDate,endDate:dates.at(-1),extraDays,totalDays:dates.length,days,lessons,fingerprint,weeklyLoads,lessonCount:lessons.length,newLessonCount:lessons.filter(lesson=>!lesson.existing&&!lesson.conflict).length,conflictCount:lessons.filter(lesson=>lesson.conflict).length,sourceVersion:directory.sourceVersion,updatedAt:directory.updatedAt,sourceUrl:directory.sourceUrl,stale:directory.stale};
}
