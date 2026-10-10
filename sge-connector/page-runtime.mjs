import {parseSgePage} from '../src/sge-pages.mjs';
window.__doniciaSge={
 snapshot(){return parseSgePage(document,location.href)},
 open(action){
  const snapshot=parseSgePage(document,location.href);let element;
  if(action.kind==='next'||action.kind==='first'){
   const name=action.kind==='next'?'BTN_PROXIMO':'BTN_PRIMEIRO';
   element=document.querySelector('input[name="'+name+'1"]')||document.querySelector('input[name="'+name+'"]');
  }else if(action.kind==='class'&&snapshot.type==='classes'){
   const c=snapshot.classes.find(c=>c.id===action.id);if(c)element=document.querySelector('#span__WVAR_'+c.row+' a');
  }else if(action.kind==='teacher'&&snapshot.type==='teachers'){
   const t=snapshot.teachers.find(t=>t.assignmentId===action.id);if(t)element=document.querySelector('#span__SERNOMPROF'+t.position+'_'+t.row+' a');
  }else if(action.kind==='plan'&&snapshot.type==='plans'){
   const p=snapshot.plans.find(p=>p.id===action.id);if(p)element=document.querySelector('#span__PERIODOPLANO_'+p.row+' a');
  }
  if(!element||element.disabled)throw Error('Ação de consulta não encontrada no SGE.');
  // Only the observed read events are allowed. Never click the situation icon,
  // ALTERAR, PLANOANALISAR, approval controls, or any content-writing button.
  const code=element.getAttribute('href')||element.getAttribute('onclick')||'';
  const expected=action.kind==='next'?'BTN_PROXIMO':action.kind==='first'?'BTN_PRIMEIRO':action.kind==='class'?'CONSULTA':action.kind==='teacher'?'PLANOPROF':'CONSULTARPLANEJAMENTO';
  if(!code.includes(expected)||/ALTERAR|PLANOANALISAR|EXCLUIR|SALVAR|GRAVAR/.test(code))throw Error('Esta ação não é uma consulta permitida.');
  element.click();return true;
 }
};
