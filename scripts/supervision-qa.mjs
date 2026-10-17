import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {once} from 'node:events';
if(!process.env.PUBLIC_QA_PLAYWRIGHT_DIR)throw Error('Set PUBLIC_QA_PLAYWRIGHT_DIR to an isolated Playwright installation');
const require=createRequire(join(process.env.PUBLIC_QA_PLAYWRIGHT_DIR,'loader.cjs'));
const {chromium}=require('playwright'),directory=await mkdtemp(join(process.env.RUNNER_TEMP||'/tmp','donicia-supervision-qa-'));
const base='http://127.0.0.1:18796',sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser,server,log='';
try{
 server=spawn(process.execPath,['scripts/dev.mjs'],{env:{...process.env,PORT:'18796',LOCAL_DB:join(directory,'synthetic.sqlite'),LOCAL_ROLE:'direction'},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',data=>log=(log+data).slice(-4000));server.stderr.on('data',data=>log=(log+data).slice(-4000));
 let ready=false;for(let n=0;n<150;n++){if(server.exitCode!==null)throw Error(log);try{if((await fetch(base+'/api/me')).ok){ready=true;break}}catch{}await sleep(200)}assert.ok(ready,log);
 browser=await chromium.launch({headless:true,...(process.env.QA_CHROMIUM_PATH?{executablePath:process.env.QA_CHROMIUM_PATH}:{})});
 for(const width of [320,390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},locale:'pt-BR'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
  await context.addInitScript(()=>{
   const sge='https://www.sgebr.net.br/sge8105/';window.mockQueries=[];window.mockPending=[];
   window.addEventListener('message',event=>{
    const req=event.data;if(req?.channel!=='donicia-sge-request')return;window.mockQueries.push({command:req.command,input:req.input});
    const id=req.input?.classId,teacherId='teacher-'+id,assignmentId='assignment-'+id;
    let data=req.command==='ping'?{version:'1.3.1',progress:true}:req.command==='directory'?{complete:true,sourceUrl:sge+'classes.aspx',classes:[{id:'final-6',name:'6º ano - 61-TURMA 61 - Matutino'},{id:'final-7',name:'7º ano - 71-TURMA 71 - Vespertino'},{id:'initial',name:'1º ano - 11-TURMA 11 - Matutino'},{id:'aee',name:'AEE - 1 - Matutino'},{id:'aee-full',name:'Atendimento Educacional Especializado - 2 - Vespertino'},{id:'support',name:'Apoio - 2-TURMA APOIO - Matutino'}].map(c=>({...c,url:sge+'classes.aspx'}))}:req.command==='teachers'?{classId:id,complete:true,sourceUrl:sge+'teachers.aspx',teachers:[{id:teacherId,assignmentId,name:'Docente fictício '+id,subject:'Professora auxiliar',url:sge+'teachers.aspx'}]}:{classId:id,teacherId,assignmentId,name:'Docente fictício '+id,complete:true,plans:[{id:'plan-'+id,title:'Plano fictício',start:'2026-03-01',end:'2026-03-15',trimester:1,situation:'Em análise',url:sge+'plan.aspx'}]};
    const answer=()=>window.postMessage({channel:'donicia-sge-response',id:req.id,...(window.mockFailure?{error:'Falha sintética de leitura'}:{data})},location.origin);
    if(window.mockHold===req.command)window.mockPending.push(answer);else setTimeout(answer,80);
   });
  });
  const page=await context.newPage(),errors=[],saves=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().endsWith('/api/supervision/save')&&request.method()==='POST')saves.push(request.postDataJSON())});
  await page.goto(base+'/equipe',{waitUntil:'networkidle'});await page.waitForSelector('[data-toggle-teacher-view]');
  const postit=page.locator('#donicia-feedback .df-toggle');await postit.waitFor();if(await postit.getAttribute('aria-expanded')==='true')await postit.click();
  await page.evaluate(()=>setPage('supervisao'));await page.waitForFunction(()=>!supervision.loading);await page.locator('[data-supervision-view="classes"]').first().click();
  const help=page.locator('.supervision-setup');await help.locator('summary').click();assert.ok(await help.locator('[data-sge-store]').isVisible());assert.match(await help.locator('[data-sge-store]').getAttribute('href'),/^https:\/\/chromewebstore\.google\.com\/detail\/.+\/pdkbopdpbenpapkdfkpffnfdaeccmbjf$/);assert.doesNotMatch(await help.innerText(),/ZIP|descompact|modo de desenvolvedor|substituir a pasta/i);assert.equal(await help.locator('[download]').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'store help overflow '+width);
  await page.locator('[data-supervision-load]').click();await page.waitForSelector('#supervision-operation-root [data-supervision-cancel]');await page.waitForFunction(()=>!supervision.loading);
  assert.equal(await page.locator('[data-supervision-trimester]').inputValue(),'1');assert.equal(await page.locator('[data-supervision-class]').count(),3);assert.equal(await page.locator('[data-supervision-class="aee"]').count(),0);
  await page.locator('[data-supervision-category="final"]').click();assert.equal(await page.evaluate(()=>supervision.selected.size),2);
  await page.evaluate(()=>{window.mockHold='teachers'});await page.locator('[data-supervision-confirm]').click();await page.waitForFunction(()=>window.mockPending.length===1);
  const dialog=page.locator('#supervision-operation-root [role=dialog]');assert.ok(await dialog.isVisible());assert.ok(await page.evaluate(()=>!!document.querySelector('main').closest('[inert]')));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'modal overflow '+width);
  await page.evaluate(()=>setPage('tarefas'));assert.equal(await page.evaluate(()=>state.section),'supervisao');
  await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.querySelector('#supervision-operation-root').contains(document.activeElement)),'focus escaped modal');if(width===390)await page.keyboard.press('Escape');else await page.locator('#supervision-operation-root [data-supervision-cancel]').click();assert.equal(await page.locator('#supervision-operation-root').count(),0);
  await page.evaluate(()=>setPage('tarefas'));assert.equal(await page.evaluate(()=>state.section),'tarefas');
  await page.evaluate(()=>{window.mockHold='';for(const answer of window.mockPending.splice(0))answer()});await page.waitForFunction(()=>!supervision.loading);assert.equal(saves.length,0);
  await page.evaluate(()=>setPage('supervisao'));await page.locator('[data-supervision-confirm]').click();await page.waitForFunction(()=>!supervision.loading&&!!supervision.report);assert.equal(saves.length,1);
  assert.deepEqual(saves[0].classIds,['final-6','final-7']);assert.equal(saves[0].trimester,1);
  const queried=await page.evaluate(()=>window.mockQueries.filter(q=>['teachers','planning'].includes(q.command)).map(q=>q.input.classId));assert.ok(queried.every(id=>id.startsWith('final-')));
  await page.evaluate(()=>{window.mockFailure=true});await page.locator('[data-supervision-view="classes"]').first().click();await page.locator('[data-supervision-load]').click();await page.waitForFunction(()=>!supervision.loading);assert.equal(await page.locator('#supervision-operation-root').count(),0);assert.match(await page.locator('#page').innerText(),/Falha sintética/);
  assert.deepEqual(errors,[]);console.log('SUPERVISION_QA '+JSON.stringify({width,trimester:1,aeeQueries:0,category:true,cancel:true,navigationBlocked:true,lateSave:false,success:true,errorRelease:true,errors}));await context.close();
 }

}finally{
 if(browser)await browser.close();if(server&&server.exitCode===null){const exit=once(server,'exit');server.kill('SIGTERM');await Promise.race([exit,sleep(3000)]);if(server.exitCode===null)server.kill('SIGKILL')}await rm(directory,{recursive:true,force:true});
}
