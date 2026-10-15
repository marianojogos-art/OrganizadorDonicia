import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {once} from 'node:events';
if(!process.env.PUBLIC_QA_PLAYWRIGHT_DIR)throw Error('Set PUBLIC_QA_PLAYWRIGHT_DIR to an isolated Playwright installation');
const require=createRequire(join(process.env.PUBLIC_QA_PLAYWRIGHT_DIR,'loader.cjs'));
const {chromium}=require('playwright'),directory=await mkdtemp(join(process.env.RUNNER_TEMP||'/tmp','donicia-preview-qa-'));
const base='http://127.0.0.1:18794',sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser,server,log='';
try{
 server=spawn(process.execPath,['scripts/dev.mjs'],{env:{...process.env,PORT:'18794',LOCAL_DB:join(directory,'synthetic.sqlite'),LOCAL_ROLE:'direction'},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',data=>log=(log+data).slice(-4000));server.stderr.on('data',data=>log=(log+data).slice(-4000));
 let ready=false;for(let n=0;n<150;n++){if(server.exitCode!==null)throw Error(log);try{if((await fetch(base+'/api/me')).ok){ready=true;break}}catch{}await sleep(200)}assert.ok(ready,log);
 browser=await chromium.launch({headless:true,...(process.env.QA_CHROMIUM_PATH?{executablePath:process.env.QA_CHROMIUM_PATH}:{})});
 for(const width of [320,390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},locale:'pt-BR'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
  const page=await context.newPage(),errors=[],writes=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('/api/')&&request.method()!=='GET')writes.push(request.url())});
  await page.goto(base+'/equipe',{waitUntil:'networkidle'});await page.waitForSelector('[data-toggle-teacher-view]');
  const postit=page.locator('#donicia-feedback .df-toggle');await postit.waitFor();if(await postit.getAttribute('aria-expanded')==='true')await postit.click();
  await page.evaluate(()=>setPage('tarefas'));
  const button=page.locator('[data-toggle-teacher-view]');assert.ok(await button.isVisible());
  await button.click();await page.waitForFunction(()=>teacherPreview&&!viewSwitching);
  assert.equal(await page.locator('#nav [data-section]').count(),6);assert.equal(await page.evaluate(()=>currentUser.role),'direction');
  assert.match(await page.locator('#view-switcher').innerText(),/somente leitura/);
  await page.locator('[data-action="new-booking"]').first().click();assert.equal(await page.locator('#entryform button[type=submit]').isDisabled(),true);await page.locator('[data-close]').first().click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width);
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>teacherPreview&&document.querySelectorAll('#nav [data-section]').length===6);
  await button.click();await page.waitForFunction(()=>!teacherPreview&&!viewSwitching);assert.equal(await page.evaluate(()=>state.section),'tarefas');assert.equal(await page.locator('#nav [data-section]').count(),17);
  await page.evaluate(()=>{document.querySelector('[data-toggle-teacher-view]').click();document.querySelector('[data-toggle-teacher-view]').click()});await page.waitForFunction(()=>teacherPreview&&!viewSwitching);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log('TEACHER_PREVIEW_QA '+JSON.stringify({width,returnSection:'tarefas',reload:true,repeatedClicks:true,role:'direction',writes:0,errors}));await context.close();
 }
}finally{
 if(browser)await browser.close();if(server&&server.exitCode===null){const exit=once(server,'exit');server.kill('SIGTERM');await Promise.race([exit,sleep(3000)]);if(server.exitCode===null)server.kill('SIGKILL')}await rm(directory,{recursive:true,force:true});
}
