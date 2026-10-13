import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {once} from 'node:events';
if(!process.env.CI||!process.env.RUNNER_TEMP||!process.env.PUBLIC_QA_PLAYWRIGHT_DIR)throw Error('Cloud QA runner required');
const require=createRequire(join(process.env.PUBLIC_QA_PLAYWRIGHT_DIR,'loader.cjs'));
const {chromium}=require('playwright'),directory=await mkdtemp(join(process.env.RUNNER_TEMP,'donicia-formation-qa-'));
const base='http://127.0.0.1:18790',sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser,server,log='';
try{
 server=spawn(process.execPath,['scripts/dev.mjs'],{env:{...process.env,PORT:'18790',LOCAL_DB:join(directory,'synthetic.sqlite'),LOCAL_ROLE:'teacher'},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',data=>log=(log+data).slice(-4000));server.stderr.on('data',data=>log=(log+data).slice(-4000));
 let startupError;server.on('error',error=>startupError=error);
 let ready=false;const deadline=Date.now()+30000;
 while(Date.now()<deadline){if(startupError)throw startupError;if(server.exitCode!==null)throw Error('Synthetic server exited: '+log);try{if((await fetch(base+'/public/api',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break}}catch{}await sleep(200)}
 assert.ok(ready,'Server startup timed out');browser=await chromium.launch({headless:true});
 for(const width of [320,390,1440]){
  const context=await browser.newContext({viewport:{width,height:width===1440?1100:844},locale:'pt-BR',timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/equipe',{waitUntil:'networkidle'});
  await page.waitForSelector('#nav [data-section="formacao"]',{state:'attached'});
  await page.evaluate(()=>setPage('formacao'));
  await page.locator('[data-training-month]').fill('2026-10');await page.locator('[data-training-month]').dispatchEvent('change');
  await page.waitForSelector('.training-entry');
  assert.equal(await page.locator('.training-entry').count(),100);
  const dimensions=await page.evaluate(()=>({viewport:innerWidth,content:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)}));
  if(dimensions.content>width+1)console.log('FORMATION_OVERFLOW '+JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('select,a.button,.training-entry,.badge,.field,.training-entry p,h3')].map(x=>({tag:x.tagName,class:x.className,right:x.getBoundingClientRect().right,width:x.getBoundingClientRect().width,text:x.textContent.slice(0,60)})).filter(x=>x.right>innerWidth+1).slice(0,20))));
  assert.ok(dimensions.content<=width+1,'Horizontal overflow '+JSON.stringify(dimensions));
  await page.locator('[data-training-area]').selectOption('História');
  assert.equal(await page.locator('.training-entry').count(),6);
  await page.locator('[data-training-month]').fill('2026-11');await page.locator('[data-training-month]').dispatchEvent('change');
  assert.equal(await page.locator('.training-entry').count(),0);
  await page.locator('[data-training-month]').fill('2026-10');await page.locator('[data-training-month]').dispatchEvent('change');
  assert.equal(await page.locator('.training-entry').count(),6);
  const promise=page.waitForEvent('download');await page.locator('a[download]').click();const download=await promise;
  assert.equal(download.suggestedFilename(),'formacao-ensino-fundamental-outubro-2026.csv');
  const path=join(directory,'download-'+width+'.csv');await download.saveAs(path);const csv=await readFile(path,'utf8');
  assert.equal(csv.charCodeAt(0),0xfeff);assert.equal(csv.trim().split(/\r?\n/).length,105);assert.ok(csv.includes('"História"'));
  await page.evaluate(()=>scrollTo(0,0));assert.deepEqual(errors,[]);
  console.log('FORMATION_QA_CHECK '+JSON.stringify({width,...dimensions,download:'104 records with UTF8 BOM',filters:'ok',errors}));
  if(width===390||width===1440){
   const base64=(await page.screenshot({type:'jpeg',quality:65,animations:'disabled'})).toString('base64'),chunk=24000,total=Math.ceil(base64.length/chunk);
   for(let i=0;i<total;i++)console.log('FORMATION_QA_IMAGE '+JSON.stringify({name:'formation-'+width,mime:'image/jpeg',part:i+1,total,base64:base64.slice(i*chunk,(i+1)*chunk)}));
  }
  await context.close();
 }
 console.log('FORMATION_QA_COMPLETE');
}finally{
 if(browser)await browser.close();
 if(server&&server.exitCode===null){const exit=once(server,'exit');server.kill('SIGTERM');await Promise.race([exit,sleep(3000)]);if(server.exitCode===null)server.kill('SIGKILL')}
 await rm(directory,{recursive:true,force:true});
}
