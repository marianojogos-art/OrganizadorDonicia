import {allowedSgeUrl} from './sge-origin.mjs';
export const sgeBase='https://www.sgebr.net.br/sge8105/';
const value=(node,name)=>node.querySelector('input[name="'+name+'"]')?.getAttribute('value')?.trim()||'';
const rowValue=(row,name)=>[...row.querySelectorAll('input[name]')].find(x=>new RegExp('^'+name+'_\\d{4}$').test(x.name))?.getAttribute('value')?.trim()||'';
const clean=node=>node?.textContent.replace(/\s+/g,' ').trim()||'';
const contextKeys=['UECOD','CURANO','GRACOD','TRNCOD','SECNUM','TURNUM'];
const classKey=row=>contextKeys.map(key=>rowValue(row,key)).join(':');
function pageUrl(document,url){
 const form=document.querySelector('#MAINFORM');if(!form)throw Error('Página do SGE não reconhecida. Faça login e abra os planejamentos de turmas.');
 const action=form.getAttribute('action')||form.getAttribute('ACTION');
 const parsed=new URL(action||url,url||sgeBase);
 try{allowedSgeUrl(parsed.href);if(url&&parsed.origin!==new URL(url).origin)throw Error()}catch{throw Error('Origem do SGE não reconhecida.')}
 return parsed.href;
}
function navigation(document){
 const current=Number(value(document,'_ATUAL')||1),last=Number(value(document,'_FINAL')||1);
 if(!Number.isInteger(current)||!Number.isInteger(last)||current<1||last<current||last>50)throw Error('Paginação do SGE não reconhecida.');
 return {current,last};
}
export function parseSgeClasses(document,url){
 const sourceUrl=pageUrl(document,url),grid=document.querySelector('#GRIDTURMA');if(!grid)throw Error('Abra a lista de turmas de planejamento no SGE.');
 const classes=[...grid.querySelectorAll('tr')].filter(r=>r.querySelector('input[name^="TURNUM_"]')).map(row=>{
  const slot=row.querySelector('input[name^="TURNUM_"]').name.match(/_(\d{4})$/)[1],name=rowValue(row,'_WVAR')||rowValue(row,'TURCOD');
  if(!name||contextKeys.some(k=>!rowValue(row,k)))throw Error('Turma incompleta no SGE.');
  return {id:classKey(row),name,row:slot,url:sourceUrl};
 });
 if(classes.some(c=>!c.id.startsWith('106801:')))throw Error('Lista de turmas de outra escola.');
 const pagination=navigation(document),total=Number(value(document,'_CONT')||classes.length);
 return {type:'classes',classes,sourceUrl,pagination,total,complete:pagination.last===1};
}
export function parseSgeTeachers(document,url){
 const sourceUrl=pageUrl(document,url),grid=document.querySelector('#GRIDDISCIPLINA');if(!grid)throw Error('Disciplinas da turma não encontradas.');
 const className=value(document,'TURCOD'),teachers=[],assignments=new Map();
 for(const row of grid.querySelectorAll('tr')){
  const field=row.querySelector('input[name^="DISCOD_"]');if(!field)continue;
  const slot=field.name.match(/_(\d{4})$/)[1],subject=rowValue(row,'DISCODNOM');
  for(let position=1;position<=10;position++){
   const name=rowValue(row,'_SERNOMPROF'+position),registration=rowValue(row,'_SERMATPROF'+position);if(!name)continue;
   if(!registration||registration==='0'||!subject)throw Error('Professor sem identificação de matrícula no SGE.');
   const teacher={id:'mat-'+registration,assignmentId:rowValue(row,'DISCOD')+':'+registration,name,subject,row:slot,position,url:sourceUrl};
   const previous=assignments.get(teacher.assignmentId);
   if(previous&&(previous.name!==name||previous.subject!==subject))throw Error('Vínculos incompatíveis de professor e disciplina no SGE.');
   if(!previous){assignments.set(teacher.assignmentId,teacher);teachers.push(teacher)}
  }
 }
 const pagination=navigation(document);
 return {type:'teachers',className,classNumber:value(document,'TURNUM'),grade:value(document,'GRACOD'),stage:value(document,'SECNUM'),teachers,sourceUrl,pagination,complete:pagination.last===1};
}
function brDate(text){const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);if(!m)return null;const iso=m[3]+'-'+m[2]+'-'+m[1];return !Number.isNaN(Date.parse(iso))&&new Date(iso).toISOString().slice(0,10)===iso?iso:null}
export function parseSgePlans(document,url){
 const sourceUrl=pageUrl(document,url),grid=document.querySelector('#GRIDPLANEJADO');if(!grid)throw Error('Planejamentos do professor não encontrados.');
 const subject=value(document,'DISCODNOM'),title=clean(document.querySelector('#TITULO'));
 const prefix='Planejamento de '+subject+' - ',teacherName=title.startsWith(prefix)?title.slice(prefix.length):'';
 if(!teacherName)throw Error('Nome do professor não reconhecido na página de planejamentos.');
 const plans=[...grid.querySelectorAll('tr')].filter(r=>r.querySelector('input[name^="PLAULASEQ_"]')).map(row=>{
  const slot=row.querySelector('input[name^="PLAULASEQ_"]').name.match(/_(\d{4})$/)[1];
  const start=brDate(rowValue(row,'PLAULADTINICIO')),end=brDate(rowValue(row,'PLAULADTFIM'));
  if(!start||!end||start>end)throw Error('Período do planejamento não reconhecido.');
  return {id:rowValue(row,'PLAULASEQ'),title:rowValue(row,'_PERIODOPLANO'),start,end,lessons:Number(rowValue(row,'PLAULANUMAULAS')),includedAt:rowValue(row,'PLAULADATHORINC'),situation:row.querySelector('img[id^="_SITUACAO_"]')?.getAttribute('title')?.trim()||null,situationCode:rowValue(row,'PLAULASITUACAO'),trimester:null,row:slot,classId:classKey(row),subjectCode:rowValue(row,'DISCOD'),url:null};
 });
 const pagination=navigation(document);
 return {type:'plans',teacherName,subject,plans,sourceUrl,pagination,complete:pagination.last===1};
}
export function parseSgePage(document,url){
 if(document.querySelector('#GRIDTURMA'))return parseSgeClasses(document,url);
 if(document.querySelector('#GRIDDISCIPLINA'))return parseSgeTeachers(document,url);
 if(document.querySelector('#GRIDPLANEJADO'))return parseSgePlans(document,url);
 return {type:'detail',sourceUrl:pageUrl(document,url)};
}
