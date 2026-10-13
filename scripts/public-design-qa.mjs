import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {once} from 'node:events';
import {sqlite} from './sqlite-adapter.mjs';
import {migrateLocal} from './migrate-local.mjs';

if(!process.env.CI||!process.env.RUNNER_TEMP||!process.env.PUBLIC_QA_PLAYWRIGHT_DIR)throw Error('Visual QA runs only in the isolated CI runner.');
const requireBrowser=createRequire(join(process.env.PUBLIC_QA_PLAYWRIGHT_DIR,'loader.cjs'));
const {chromium}=requireBrowser('playwright');
const directory=await mkdtemp(join(process.env.RUNNER_TEMP,'donicia-public-qa-'));
const database=join(directory,'synthetic.sqlite'),base='http://127.0.0.1:18789';
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
const month=today.slice(0,7),future=new Date(today+'T12:00:00Z');future.setUTCMonth(future.getUTCMonth()+1,15);
const nextDate=future.toISOString().slice(0,10),nextMonth=nextDate.slice(0,7);
const DB=sqlite(database);
try{
 await migrateLocal(DB);
 DB.exec("INSERT INTO users(email,name,role,active) VALUES('qa@prof.pmf.sc.gov.br','Equipe fictícia de QA','direction',1)");
 await DB.prepare("UPDATE school_profile SET introduction=?,address=?,phone=?,email=?,hours=? WHERE id=1").bind('Conteúdo sintético para conferir a apresentação do portal.','Endereço fictício de demonstração','0000 0000','secretaria@example.invalid','Horário fictício para demonstração').run();
 await DB.prepare('INSERT INTO notices(id,title,body,date,published,creator) VALUES(?,?,?,?,1,?)').bind('qa-notice','Aviso de demonstração','Conteúdo sintético criado somente para conferir a página em diferentes telas.',today,'qa@prof.pmf.sc.gov.br').run();
 for(const [id,title,date,visibility] of [['qa-current','Encontro de demonstração',today,'public'],['qa-next','Atividade de demonstração',nextDate,'public'],['qa-private','Registro interno não publicável',today,'internal']]){
  await DB.prepare('INSERT INTO events(id,title,date,type,creator,start,end,location,details,visibility) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,title,date,'Evento escolar','qa@prof.pmf.sc.gov.br','14:00','16:00','Espaço fictício','Detalhe interno não publicável',visibility).run();
 }
}finally{DB.close()}
let browser,server,serverLog='';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function imageLog(page,name,fullPage){
 const bytes=await page.screenshot({type:'jpeg',quality:65,fullPage,animations:'disabled'});
 await writeFile(join(directory,name+'.jpg'),bytes);
 const base64=bytes.toString('base64'),chunkSize=24000,total=Math.ceil(base64.length/chunkSize);
 for(let index=0;index<total;index++)console.log('PUBLIC_QA_IMAGE '+JSON.stringify({name,mime:'image/jpeg',part:index+1,total,base64:base64.slice(index*chunkSize,(index+1)*chunkSize)}));
}
try{
 server=spawn(process.execPath,['scripts/dev.mjs'],{env:{...process.env,PORT:'18789',LOCAL_DB:database,LOCAL_ROLE:'anonymous'},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',data=>{serverLog=(serverLog+data).slice(-4000)});
 server.stderr.on('data',data=>{serverLog=(serverLog+data).slice(-4000)});
 let startupError;server.on('error',error=>{startupError=error});
 const deadline=Date.now()+30000;let ready=false;
 while(Date.now()<deadline){if(startupError)throw startupError;if(server.exitCode!==null)throw Error('Synthetic server exited: '+serverLog);try{const response=await fetch(base+'/public/api',{signal:AbortSignal.timeout(1000)});if(response.ok){ready=true;break}}catch{}await sleep(200)}
 assert.ok(ready,'Synthetic server startup timed out: '+serverLog);
 browser=await chromium.launch({headless:true});
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:width===1440?1100:844},deviceScaleFactor:1,locale:'pt-BR',timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('blockedbyclient'));
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await page.goto(base+'/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#load-status')?.classList.contains('hidden'));
  assert.equal(await page.locator('#load-error').isVisible(),false);
  await page.waitForFunction(()=>Array.from(document.images).length>0&&Array.from(document.images).every(image=>image.complete&&image.naturalWidth>0));
  const dimensions=await page.evaluate(()=>({viewport:window.innerWidth,content:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),logos:[...document.images].filter(image=>image.getAttribute('src')==='/public-assets/logo.jpg').map(image=>({width:image.naturalWidth,height:image.naturalHeight}))}));
  assert.ok(dimensions.content<=width+1,'Horizontal overflow at '+width+': '+JSON.stringify(dimensions));assert.ok(dimensions.logos.length>=1,'School logo must be loaded');
  const identity=page.locator('.hero-visual img');
  assert.equal(await identity.getAttribute('src'),'/public-assets/donicia-2026.png');
  const brand=await identity.evaluate(image=>({naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,width:image.clientWidth,height:image.clientHeight}));
  assert.equal(brand.naturalWidth,1976);assert.equal(brand.naturalHeight,796);assert.ok(Math.abs(brand.width/brand.height-1976/796)<.04,'Identity must preserve its aspect ratio');
  assert.equal(await page.locator('.staff').getAttribute('href'),'/equipe');assert.equal((await context.request.get(base+'/equipe')).status(),401);
  assert.equal(await page.locator('#school-contacts a[href^="tel:"]').getAttribute('href'),'tel:00000000');
  assert.equal(await page.locator('#school-contacts a[href^="mailto:"]').getAttribute('href'),'mailto:secretaria@example.invalid');
  assert.match(await page.locator('#school-map').getAttribute('href'),/^https:\/\/www\.google\.com\/maps\//);
  for(const href of ['https://www.instagram.com/escoladoniciamariadacosta/','https://www.facebook.com/escoladonicia/'])assert.equal(await page.locator('#redes .social-link').evaluateAll((links,target)=>links.filter(link=>link.getAttribute('href')===target).length,href),1);
  const monthInput=page.locator('#calendar-month');await monthInput.fill(month);await monthInput.dispatchEvent('change');
  assert.ok((await page.locator('#events').innerText()).includes('Encontro de demonstração'));
  const firstPeriod=await page.locator('#calendar-period').innerText();
  await monthInput.fill(nextMonth);await monthInput.dispatchEvent('change');
  assert.ok((await page.locator('#events').innerText()).includes('Atividade de demonstração'));assert.ok(!(await page.locator('#events').innerText()).includes('Encontro de demonstração'));assert.notEqual(await page.locator('#calendar-period').innerText(),firstPeriod);
  await monthInput.fill(month);await monthInput.dispatchEvent('change');
  assert.ok(!(await page.locator('body').innerText()).includes('Registro interno não publicável'));assert.ok(!(await page.locator('body').innerText()).includes('Detalhe interno não publicável'));
  const nav=page.locator('.nav a[href="#contatos"]');await nav.focus();assert.equal(await nav.evaluate(element=>document.activeElement===element),true);await page.keyboard.press('Enter');await page.waitForURL('**/#contatos');
  await page.evaluate(()=>{history.replaceState(null,'','/');window.scrollTo(0,0)});
  await page.waitForFunction(()=>window.scrollY===0);
  assert.deepEqual(errors,[],'Browser errors at '+width);console.log('PUBLIC_QA_CHECK '+JSON.stringify({width,...dimensions,calendar:'ok',contacts:'ok',navigation:'ok',privateData:'absent',errors}));
  if(width===390)await imageLog(page,'mobile-390-full',true);
  if(width===1440){await imageLog(page,'desktop-1440-top',false);await imageLog(page,'desktop-1440-full',true)}
  await context.close();
 }
 console.log('PUBLIC_QA_COMPLETE '+JSON.stringify({viewports:[320,390,768,1440],synthetic:true,screenshots:3}));
}finally{
 if(browser)await browser.close();
 if(server&&server.exitCode===null){const exit=once(server,'exit');server.kill('SIGTERM');await Promise.race([exit,sleep(3000)]);if(server.exitCode===null)server.kill('SIGKILL')}
 await rm(directory,{recursive:true,force:true});
}
