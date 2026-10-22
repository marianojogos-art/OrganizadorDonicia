import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {once} from 'node:events';
if(!process.env.CI||!process.env.RUNNER_TEMP||!process.env.PUBLIC_QA_PLAYWRIGHT_DIR)throw Error('Feedback QA runs only in the isolated cloud runner.');
const requireBrowser=createRequire(join(process.env.PUBLIC_QA_PLAYWRIGHT_DIR,'loader.cjs'));
const {chromium}=requireBrowser('playwright');
const directory=await mkdtemp(join(process.env.RUNNER_TEMP,'donicia-feedback-qa-')),database=join(directory,'synthetic.sqlite');
const servers=[],sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function server(port,role){
 const child=spawn(process.execPath,['scripts/dev.mjs'],{env:{...process.env,PORT:String(port),LOCAL_DB:database,LOCAL_ROLE:role},stdio:['ignore','pipe','pipe']});servers.push(child);
 let log='',error;child.stdout.on('data',data=>log=(log+data).slice(-3000));child.stderr.on('data',data=>log=(log+data).slice(-3000));child.on('error',value=>error=value);
 for(let attempt=0;attempt<150;attempt++){if(error)throw error;if(child.exitCode!==null)throw Error('Server exited: '+log);try{const result=await fetch('http://127.0.0.1:'+port+'/public/api',{signal:AbortSignal.timeout(500)});if(result.ok)return}catch{}await sleep(200)}
 throw Error('Server timeout: '+log);
}
let browser;
async function visible(page){
 // Resize/visualViewport events schedule clamping on the next animation frame.
 await page.waitForFunction(()=>{const root=document.querySelector('#donicia-feedback');if(!root)return false;const r=root.getBoundingClientRect(),v=visualViewport;return r.x>=v.offsetLeft+7&&r.y>=v.offsetTop+7&&r.right<=v.offsetLeft+v.width-7&&r.bottom<=v.offsetTop+v.height-7},{},{timeout:5000});
 const bounds=await page.locator('#donicia-feedback').evaluate(root=>{const r=root.getBoundingClientRect(),v=visualViewport;return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,left:v.offsetLeft,top:v.offsetTop,viewWidth:v.width,viewHeight:v.height,z:getComputedStyle(root).zIndex}});
 assert.ok(bounds.x>=bounds.left+7&&bounds.y>=bounds.top+7,JSON.stringify(bounds));assert.ok(bounds.right<=bounds.left+bounds.viewWidth-7&&bounds.bottom<=bounds.top+bounds.viewHeight-7,JSON.stringify(bounds));assert.equal(bounds.z,'2147483640');
 return bounds;
}
async function screenshotLog(page,name){
 const bytes=await page.screenshot({type:'jpeg',quality:70,animations:'disabled'});
 const base64=bytes.toString('base64'),chunkSize=24000,total=Math.ceil(base64.length/chunkSize);
 for(let index=0;index<total;index++)console.log('FEEDBACK_QA_IMAGE '+JSON.stringify({name,mime:'image/jpeg',part:index+1,total,base64:base64.slice(index*chunkSize,(index+1)*chunkSize)}));
}
try{
 await server(18790,'anonymous');await server(18791,'direction');await server(18792,'teacher');
 browser=await chromium.launch({headless:true,...(process.env.QA_CHROMIUM_PATH?{executablePath:process.env.QA_CHROMIUM_PATH}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'pt-BR',timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'});
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort('blockedbyclient'));
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const base='http://127.0.0.1:18790',staff='http://127.0.0.1:18791';
 await page.goto(base+'/',{waitUntil:'networkidle'});await page.locator('#donicia-feedback').waitFor();
 assert.equal((await visible(page)).width,300);assert.equal(await page.locator('.df-toggle').getAttribute('aria-expanded'),'false');
 assert.equal(await page.locator('#df-heading').innerText(),'✎ Site em construção');
 await page.locator('.df-toggle').click();assert.equal(await page.locator('.df-toggle').getAttribute('aria-expanded'),'true');assert.equal((await visible(page)).width,368);
 await screenshotLog(page,'desktop-postit');
 // Pointer drag reaches both extremes without losing the note.
 const grip=page.locator('.df-grip'),box=await grip.boundingBox();
 await page.mouse.move(box.x+40,box.y+20);await page.mouse.down();await page.mouse.move(1,1,{steps:12});await page.mouse.up();let position=await visible(page);assert.ok(position.x<20&&position.y<20);
 const edge=await grip.boundingBox();await page.mouse.move(edge.x+40,edge.y+20);await page.mouse.down();await page.mouse.move(1439,999,{steps:12});await page.mouse.up();position=await visible(page);assert.ok(position.x>900&&position.y>300);
 await grip.focus();await page.keyboard.press('ArrowLeft');const moved=await visible(page);assert.ok(moved.x<position.x);
 await page.setViewportSize({width:320,height:700});await visible(page);
 await page.locator('.df-toggle').click();const compact=await visible(page);assert.equal(await page.locator('.df-toggle').getAttribute('aria-expanded'),'false');
 assert.ok(compact.width<=210&&compact.height<=68,'Mobile post-it must be compact: '+JSON.stringify(compact));
 assert.match(await page.locator('#df-heading').innerText(),/Sua opinião/);await screenshotLog(page,'mobile-postit-collapsed');
 await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('.df-toggle').getAttribute('aria-expanded'),'false');
 await page.locator('.df-toggle').click();await page.locator('[name=message]').fill('Ideia sintética da página inicial.');
 assert.equal(await page.locator('.df-page-path').innerText(),'/');
 await page.evaluate(()=>location.hash='calendario');await page.waitForURL('**/#calendario');assert.equal(await page.locator('.df-page-path').innerText(),'/');
 await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('[name=message]').inputValue(),'Ideia sintética da página inicial.');assert.equal(await page.locator('.df-page-path').innerText(),'/');
 await page.locator('.df-use-page').click();assert.equal(await page.locator('.df-page-path').innerText(),'/#calendario');
 await screenshotLog(page,'mobile-postit');await visible(page);
 // Reduced visible height approximates a phone keyboard; the header and form stay usable.
 await page.setViewportSize({width:320,height:340});await visible(page);
 assert.equal(await page.locator('[name=message]').evaluate(node=>getComputedStyle(node).fontSize),'16px');
 assert.ok(await page.locator('.df-body').evaluate(node=>node.scrollHeight>node.clientHeight),'Phone form must scroll internally');
 await page.locator('.df-send').scrollIntoViewIfNeeded();await visible(page);
 await page.locator('[name=message]').focus();await page.keyboard.press('Escape');
 assert.equal(await page.locator('.df-toggle').getAttribute('aria-expanded'),'false');assert.equal(await page.locator('.df-toggle').evaluate(node=>node===document.activeElement),true);
 await page.locator('.df-toggle').click();assert.equal(await page.locator('[name=message]').inputValue(),'Ideia sintética da página inicial.');
 await page.setViewportSize({width:320,height:700});await visible(page);
 // A failed send preserves the draft and an explicit retry stores it in the shared database.
 await page.route('**/public/feedback',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Falha sintética de envio'})}),{times:1});
 await page.locator('.df-send').click();await page.locator('.df-status').filter({hasText:'rascunho continua salvo'}).waitFor();
 assert.equal(await page.locator('[name=message]').inputValue(),'Ideia sintética da página inicial.');
 await page.locator('.df-send').click();await page.locator('.df-status').filter({hasText:'Contribuição enviada!'}).waitFor();assert.equal(await page.locator('[name=message]').inputValue(),'');
 let response=await context.request.get(staff+'/api/feedback');assert.equal(response.status(),200);let data=await response.json();assert.equal(data.total,1);assert.equal(data.items[0].page_path,'/');assert.equal(data.items[0].page_section,'calendario');
 assert.equal((await context.request.get(base+'/api/feedback')).status(),401);
 assert.equal((await context.request.get('http://127.0.0.1:18792/api/feedback')).status(),403);
 // Touch drag uses real Chromium touch events and stays within the mobile viewport.
 const touchContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,locale:'pt-BR'});
 const mobile=await touchContext.newPage();await mobile.goto(base+'/',{waitUntil:'networkidle'});await mobile.locator('.df-grip').waitFor();
 const touchBox=await mobile.locator('.df-grip').boundingBox(),cdp=await touchContext.newCDPSession(mobile);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchBox.x+30,y:touchBox.y+20}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:10,y:10}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const touchCompact=await visible(mobile);assert.ok(touchCompact.width<=210&&touchCompact.height<=68);
 await mobile.locator('.df-toggle').tap();await visible(mobile);assert.equal(await mobile.locator('.df-toggle').getAttribute('aria-expanded'),'true');
 await mobile.locator('.df-toggle').tap();assert.equal(await mobile.locator('.df-toggle').getAttribute('aria-expanded'),'false');await touchContext.close();
 // Staff sections are distinct, deep links open them, and the collection includes every origin.
 await page.setViewportSize({width:1440,height:1000});await page.goto(staff+'/equipe#calendario',{waitUntil:'networkidle'});await page.locator('#nav [aria-current="page"][data-section="calendario"]').waitFor();
 await page.locator('#donicia-feedback [name=message]').fill('Nova implementação sintética no calendário da equipe.');
 assert.equal(await page.locator('.df-page-path').innerText(),'/equipe#calendario');
 await page.locator('[name=kind]').selectOption('feature');await page.locator('.df-send').click();await page.locator('.df-status').filter({hasText:'Contribuição enviada!'}).waitFor();
 await page.locator('.df-toggle').click();await page.locator('#nav [data-section="contribuicoes"]').click();
 await page.locator('#page').filter({hasText:'Nova implementação sintética'}).waitFor();await page.locator('#page').filter({hasText:'Ideia sintética da página inicial.'}).waitFor();
 assert.equal(await page.locator('#page a[href="/equipe#calendario"]').count(),1);assert.equal(await page.locator('#page a[href="/#calendario"]').count(),1);
 const triage=page.locator('[data-feedback-status]').first();await triage.selectOption('Planejada');const followup=page.locator('[data-feedback-followup]').first();await followup.locator('[name=reply]').fill('Atendimento parcial fictício; falta conferir a publicação.');await followup.locator('button[type=submit]').click();await page.locator('#page .badge').filter({hasText:'Planejada'}).waitFor();
 await page.reload({waitUntil:'networkidle'});await page.locator('#nav [aria-current="page"][data-section="contribuicoes"]').waitFor();await page.locator('#page .badge').filter({hasText:'Planejada'}).waitFor();
 assert.equal(await page.locator('#donicia-feedback').count(),1);
 response=await context.request.get(staff+'/api/feedback');data=await response.json();assert.equal(data.total,2);assert.equal(data.items.filter(x=>x.status==='Planejada').length,1);
 // Failure keeps the draft; explicit retry records a private, persistent followup.
 const responseForm=page.locator('[data-feedback-followup]').first();
 await responseForm.locator('[name=reply]').fill('Conferência fictícia: ainda falta uma etapa.');
 await page.route('**/api/feedback/*',route=>route.request().method()==='PATCH'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Falha fictícia no acompanhamento'})}):route.continue(),{times:1});
 await responseForm.locator('button[type=submit]').click();await page.locator('[role=alert]').filter({hasText:'Falha fictícia'}).waitFor();
 assert.equal(await responseForm.locator('[name=reply]').inputValue(),'Conferência fictícia: ainda falta uma etapa.');
 await responseForm.locator('button[type=submit]').click();await page.locator('section[aria-label="Histórico da contribuição"]').first().filter({hasText:'Conferência fictícia'}).waitFor();
 await page.reload({waitUntil:'networkidle'});await page.locator('[data-feedback-history]').first().waitFor();
 await page.locator('[data-feedback-history]').first().click();await page.locator('section[aria-label="Histórico da contribuição"]').first().filter({hasText:'Conferência fictícia'}).waitFor();
 assert.match(await page.locator('section[aria-label="Histórico da contribuição"]').first().innerText(),/Atendimento parcial fictício/);
 console.log('FEEDBACK_FOLLOWUP_QA '+JSON.stringify({retry:true,reload:true,history:true,partial:true}));
 // Published updates remain accessible at phone and desktop widths, independently of live triage.
 const originalContributions=data.items.map(row=>({id:row.id,message:row.message,contributor:row.contributor,created_at:row.created_at}));
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:1000});
  const ids=await page.locator('#nav [data-section]').evaluateAll(nodes=>nodes.map(node=>node.dataset.section));
  assert.equal(ids[ids.indexOf('biblioteca')+1],'contribuicoes');
  const postit=page.locator('.df-toggle');if(await postit.getAttribute('aria-expanded')==='true')await postit.click();
  const history=page.locator('#published-updates');if(!await history.evaluate(node=>node.open))await history.locator('summary').click();
  const publicationCount=await page.evaluate(()=>publishedUpdates.length);assert.equal(await history.locator('li').count(),publicationCount);assert.ok(await history.locator('li').first().isVisible());
  assert.equal(await history.locator('time').first().getAttribute('datetime'),await page.evaluate(()=>publishedUpdates[0].publishedAt));
  assert.match(await history.innerText(),/recuperação do banco de produção ainda não foi validada/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'contributions overflow '+width);
  console.log('CONTRIBUTIONS_HISTORY_QA '+JSON.stringify({width,afterLibrary:true,publications:publicationCount,overflow:false}));
 }
 const afterHistory=await(await context.request.get(staff+'/api/feedback')).json();
 assert.deepEqual(afterHistory.items.map(row=>({id:row.id,message:row.message,contributor:row.contributor,created_at:row.created_at})),originalContributions);
 await screenshotLog(page,'team-contributions');
 await page.goto('http://127.0.0.1:18792/equipe',{waitUntil:'networkidle'});await page.locator('#nav button').first().waitFor();assert.equal(await page.locator('#nav [data-section="contribuicoes"]').count(),0);assert.equal(await page.locator('#donicia-feedback').count(),1);
 assert.deepEqual(errors,[]);console.log('FEEDBACK_QA_COMPLETE '+JSON.stringify({public:true,staff:true,teacher:true,mouseDrag:true,touchDrag:true,keyboardDrag:true,resize:true,reload:true,draft:true,pageOrigin:true,retry:true,triage:true,anonymousIsolation:true,compactMobile:true,reducedHeight:true,escapeFocus:true,screenshots:4,errors}));
 await context.close();
}finally{
 if(browser)await browser.close();
 for(const child of servers)if(child.exitCode===null){const done=once(child,'exit');child.kill('SIGTERM');await Promise.race([done,sleep(3000)]);if(child.exitCode===null)child.kill('SIGKILL')}
 await rm(directory,{recursive:true,force:true});
}
