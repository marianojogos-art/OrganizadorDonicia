import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
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
 for(const [id,title,date,visibility,start,end] of [['qa-current','Encontro de demonstração',today,'public','14:00','16:00'],['qa-next','Atividade de demonstração',nextDate,'public','14:00','16:00'],['qa-private','Registro interno não publicável',today,'internal','14:00','16:00'],['qa-early','Z — abertura de demonstração',today,'public','08:00','09:00'],['qa-late','A — encerramento de demonstração',today,'public','17:00','18:00']]){
  await DB.prepare('INSERT INTO events(id,title,date,type,creator,start,end,location,details,visibility) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,title,date,'Evento escolar','qa@prof.pmf.sc.gov.br',start,end,'Espaço fictício','Detalhe interno não publicável',visibility).run();
 }
 await DB.prepare("INSERT INTO public_content(id,kind,title,description,category,url,published,creator) VALUES('qa-project','project','Projeto público de demonstração','Texto sintético','Cultura','',1,'qa@prof.pmf.sc.gov.br'),('qa-document','document','Documento de demonstração','Orientação sintética','Famílias','https://example.invalid/documento',1,'qa@prof.pmf.sc.gov.br'),('qa-draft','project','Projeto privado não publicável','Rascunho','Geral','',0,'qa@prof.pmf.sc.gov.br')").run();
 await DB.prepare("UPDATE public_content SET attachment_name='logo.jpg',attachment_mime='image/jpeg',attachment_data=?,image_alt='Logo da escola em projeto sintético' WHERE id='qa-project'").bind((await readFile(new URL('../src/public-assets/logo.jpg',import.meta.url))).toString('base64')).run();
 await DB.prepare("INSERT INTO notices(id,title,body,date,published,expires_on,creator) VALUES('qa-expired','Aviso vencido não publicável','Texto expirado','2020-01-01',1,'2020-01-02','qa@prof.pmf.sc.gov.br')").run();
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
  const page=await context.newPage(),errors=[];let expectNetworkFailure=false;
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&!(expectNetworkFailure&&/status of 503/.test(message.text())))errors.push(message.text())});
  await page.goto(base+'/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#load-status')?.classList.contains('hidden'));
  assert.equal(await page.locator('#load-error').isVisible(),false);
  await page.waitForFunction(()=>Array.from(document.images).length>0&&Array.from(document.images).filter(image=>image.loading!=='lazy').every(image=>image.complete&&image.naturalWidth>0));
  await page.waitForFunction(()=>document.querySelector('#projects')?.textContent.includes('Projeto público de demonstração'));
  assert.match(await page.locator('#documents').innerText(),/Famílias.*Documento de demonstração/s);
  assert.match(await page.locator('#documents').innerText(),/Atualizado em/);
  assert.equal(await page.locator('.footer-staff').getAttribute('href'),'/equipe');
  assert.ok(!(await page.locator('body').innerText()).includes('Projeto privado não publicável'));
  assert.ok(!(await page.locator('body').innerText()).includes('Aviso vencido não publicável'));
  assert.match(await page.locator('#week-items').innerText(),/Encontro de demonstração/);
  if(width<=620){
   const quick=await page.locator('.quick-links').boundingBox(),hero=await page.locator('.hero').boundingBox();assert.ok(quick.y<hero.y,'Mobile shortcuts must precede hero visually');
   assert.ok(await page.evaluate(()=>Boolean(document.querySelector('.quick-wrap').compareDocumentPosition(document.querySelector('.hero'))&Node.DOCUMENT_POSITION_FOLLOWING)),'Mobile shortcuts must precede hero in DOM focus order');
  }
  if(width<=850){
   assert.ok(await page.evaluate(()=>Boolean(document.querySelector('.staff').compareDocumentPosition(document.querySelector('.nav'))&Node.DOCUMENT_POSITION_FOLLOWING)),'Header focus order must match staff then navigation');
   const staffBox=await page.locator('.staff').boundingBox(),navBox=await page.locator('.nav').boundingBox();assert.ok(navBox.y>=staffBox.y+staffBox.height-1,'Narrow header navigation must follow staff visually');
  }
  const projectImage=page.locator('#projects .community-card').filter({hasText:'Projeto público de demonstração'}).locator('img');await projectImage.scrollIntoViewIfNeeded();await projectImage.evaluate(image=>image.decode());
  assert.equal(await projectImage.getAttribute('alt'),'Logo da escola em projeto sintético');
  await page.evaluate(()=>window.scrollTo(0,0));
  const dimensions=await page.evaluate(()=>({viewport:window.innerWidth,content:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),logos:[...document.images].filter(image=>image.getAttribute('src')==='/public-assets/logo.jpg').map(image=>({width:image.naturalWidth,height:image.naturalHeight}))}));
  assert.ok(dimensions.content<=width+1,'Horizontal overflow at '+width+': '+JSON.stringify(dimensions));assert.ok(dimensions.logos.length>=1,'School logo must be loaded');
  const identity=page.locator('.hero-visual img');
  const brand=await identity.evaluate(image=>{const source=image.closest('picture')?.querySelector('source[type="image/webp"]');return {naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,width:image.clientWidth,height:image.clientHeight,currentSrc:image.currentSrc,srcset:image.srcset||source?.srcset||'',sizes:image.sizes||source?.sizes||''}});
  assert.match(brand.currentSrc,/\.webp(?:\?|$)/,'Browser must load the optimized identity');
  assert.equal(new URL(brand.currentSrc).origin,base);assert.ok(new URL(brand.currentSrc).pathname.startsWith('/public-assets/'));
  assert.deepEqual(brand.srcset.split(',').map(item=>Number(item.trim().match(/\s(\d+)w$/)?.[1])).sort((a,b)=>a-b),[480,960,1440],'Responsive identity must offer three widths');
  assert.ok(brand.sizes,'Responsive identity needs a sizes hint');
  assert.ok(Math.abs(brand.naturalWidth/brand.naturalHeight-1976/796)<.04&&Math.abs(brand.width/brand.height-1976/796)<.04,'Identity must preserve its aspect ratio');
  assert.equal(await page.locator('.staff').getAttribute('href'),'/equipe');assert.equal((await context.request.get(base+'/equipe')).status(),401);
  assert.equal(await page.locator('#school-contacts a[href^="tel:"]').getAttribute('href'),'tel:00000000');
  assert.equal(await page.locator('#school-contacts a[href^="mailto:"]').getAttribute('href'),'mailto:secretaria@example.invalid');
  assert.match(await page.locator('#school-map').getAttribute('href'),/^https:\/\/www\.google\.com\/maps\//);
  const targets=await page.locator('.staff,.footer-staff,#school-contacts a[href^="tel:"],#school-contacts a[href^="mailto:"]').evaluateAll(nodes=>nodes.map(node=>({text:node.textContent.trim(),width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height})));
  for(const target of targets)assert.ok(target.width>=44&&target.height>=44,'Contact/staff target must be at least 44px: '+JSON.stringify(target));
  await page.keyboard.press('Tab');await page.locator('#redes .social-link').first().focus();
  const contrasts=await page.evaluate(()=>{
   const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number);
   const luminance=color=>{const [r,g,b]=rgb(color).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b};
   const ratio=(a,b)=>{const aa=luminance(a),bb=luminance(b);return (Math.max(aa,bb)+.05)/(Math.min(aa,bb)+.05)};
   const background=node=>{for(let current=node;current;current=current.parentElement){const color=getComputedStyle(current).backgroundColor;if(!/rgba\(.*?,\s*0\)$/.test(color)&&color!=='transparent')return color}return 'rgb(255,255,255)'};
   return [...document.querySelectorAll('#avisos .kicker,#documentos .kicker')].map(node=>({name:node.textContent,ratio:ratio(getComputedStyle(node).color,background(node)),minimum:4.5})).concat([...document.querySelectorAll('#redes .social-link')].slice(0,1).map(node=>({name:'Social keyboard focus',ratio:ratio(getComputedStyle(node).outlineColor,background(node)),minimum:3})));
  });
  assert.equal(contrasts.length,3,'Both pale-section labels and social focus must be checked');
  for(const result of contrasts)assert.ok(result.ratio>=result.minimum,'Insufficient contrast: '+JSON.stringify(result));
  for(const href of ['https://www.instagram.com/escoladoniciamariadacosta/','https://www.facebook.com/escoladonicia/'])assert.equal(await page.locator('#redes .social-link').evaluateAll((links,target)=>links.filter(link=>link.getAttribute('href')===target).length,href),1);
  const monthInput=page.locator('#calendar-month');await monthInput.fill(month);await monthInput.dispatchEvent('change');
  assert.ok((await page.locator('#events').innerText()).includes('Encontro de demonstração'));
  const dayOrder=await page.locator('#events').innerText();assert.ok(dayOrder.indexOf('Z — abertura')<dayOrder.indexOf('Encontro de demonstração')&&dayOrder.indexOf('Encontro de demonstração')<dayOrder.indexOf('A — encerramento'),'Same-day events must follow their start times');
  const firstPeriod=await page.locator('#calendar-period').innerText();
  await monthInput.fill(nextMonth);await monthInput.dispatchEvent('change');
  assert.ok((await page.locator('#events').innerText()).includes('Atividade de demonstração'));assert.ok(!(await page.locator('#events').innerText()).includes('Encontro de demonstração'));assert.notEqual(await page.locator('#calendar-period').innerText(),firstPeriod);
  await monthInput.fill(month);await monthInput.dispatchEvent('change');
  assert.ok(!(await page.locator('body').innerText()).includes('Registro interno não publicável'));assert.ok(!(await page.locator('body').innerText()).includes('Detalhe interno não publicável'));

  // Independent endpoints must recover locally without hiding healthy sections.
  expectNetworkFailure=true;
  await page.route('**/public/highlights',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#week-highlights-error').waitFor({state:'visible'});
  await page.locator('#projects .community-card').filter({hasText:'Projeto público de demonstração'}).waitFor();
  assert.match(await page.locator('#documents').innerText(),/Documento de demonstração/);
  assert.equal(await page.locator('#content-error').isVisible(),false);
  assert.equal(await page.locator('#documents-error').isVisible(),false);
  await page.unroute('**/public/highlights');
  await page.locator('#week-highlights-error [data-retry-highlights]').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-retry-highlights]')].every(button=>!button.disabled));
  await page.locator('#week-highlights-error').waitFor({state:'hidden'});
  await page.route('**/public/content',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#documents-error').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#week-items')?.textContent.includes('Encontro de demonstração'));
  assert.equal(await page.locator('#week-highlights-error').isVisible(),false);
  await page.unroute('**/public/content');
  await page.locator('#documents-error [data-retry-content]').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-retry-content]')].every(button=>!button.disabled));
  await page.locator('#documents-error').waitFor({state:'hidden'});
  await page.locator('#projects .community-card').filter({hasText:'Projeto público de demonstração'}).waitFor();
  await page.route('**/public/api',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#calendar-error').waitFor({state:'visible'});
  assert.ok(await page.locator('#calendar-error [data-retry-public]').isVisible(),'Calendar needs its own recovery action');
  // Clear the month while offline: successful retry must not become a false network error.
  await page.locator('#calendar-month').fill('');await page.locator('#calendar-month').dispatchEvent('change');
  await page.unroute('**/public/api');
  await page.locator('#calendar-error [data-retry-public]').click();
  await page.waitForFunction(()=>document.querySelector('#events')?.textContent.includes('Encontro de demonstração'));
  assert.equal(await page.locator('#calendar-error').isVisible(),false);
  assert.equal(await page.locator('#load-error').isVisible(),false);
  assert.match(await page.locator('#calendar-month').inputValue(),/^\d{4}-\d{2}$/);
  expectNetworkFailure=false;
  assert.deepEqual(errors,[],'Unexpected browser errors after recovery at '+width);
  console.log('PUBLIC_RECOVERY_QA '+JSON.stringify({width,independentHighlights:true,documentRetry:true,calendarRetry:true,emptyMonth:true,chronologicalOrder:true,contrast:true,targets:true,responsiveIdentity:true}));

  const nav=page.locator('.nav a[href="#contatos"]');await nav.focus();assert.equal(await nav.evaluate(element=>document.activeElement===element),true);await page.keyboard.press('Enter');await page.waitForURL('**/#contatos');
  await page.evaluate(()=>{history.replaceState(null,'','/');window.scrollTo(0,0)});
  await page.waitForFunction(()=>window.scrollY===0);
  assert.deepEqual(errors,[],'Browser errors at '+width);console.log('PUBLIC_QA_CHECK '+JSON.stringify({width,...dimensions,calendar:'ok',contacts:'ok',navigation:'ok',privateData:'absent',errors}));
  await page.locator('.hero-visual img').evaluate(image=>image.decode());
  if(width===390){await imageLog(page,'mobile-390-top',false);await imageLog(page,'mobile-390-full',true)}
  if(width===1440){await imageLog(page,'desktop-1440-top',false);await imageLog(page,'desktop-1440-full',true)}
  await context.close();
 }

 // One controlled mobile loading sample; these lab observations are not field CWV or INP.
 const mobileContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'pt-BR',timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'});
 await mobileContext.route('**/*',route=>{const request=route.request();return new URL(request.url()).origin===base&&['GET','HEAD'].includes(request.method())?route.continue():route.abort('blockedbyclient')});
 const mobilePage=await mobileContext.newPage();
 await mobilePage.addInitScript(()=>{
  window.__publicPerformance={lcp:0,lcpElement:null,shifts:[]};
  new PerformanceObserver(list=>{for(const entry of list.getEntries()){window.__publicPerformance.lcp=entry.startTime;window.__publicPerformance.lcpElement=entry.element?.tagName||null}}).observe({type:'largest-contentful-paint',buffered:true});
  new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)window.__publicPerformance.shifts.push({at:entry.startTime,value:entry.value})}).observe({type:'layout-shift',buffered:true});
 });
 const cdp=await mobileContext.newCDPSession(mobilePage);
 await cdp.send('Network.enable');
 await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1000000/8,uploadThroughput:750*1000/8,connectionType:'cellular3g'});
 await mobilePage.goto(base+'/',{waitUntil:'networkidle'});
 await mobilePage.waitForFunction(()=>document.querySelector('#load-status')?.classList.contains('hidden')&&document.querySelector('#projects')?.textContent.includes('Projeto público de demonstração'));
 await mobilePage.locator('.hero-visual img').evaluate(image=>image.decode());
 await mobilePage.waitForTimeout(1000);
 const metrics=await mobilePage.evaluate(()=>{
  const hero=document.querySelector('.hero-visual img'),resource=performance.getEntriesByName(hero.currentSrc).at(-1),sample=window.__publicPerformance;
  let cls=0,sum=0,start=0,last=0;
  for(const shift of sample.shifts){if(!sum||shift.at-last>1000||shift.at-start>5000){start=shift.at;sum=shift.value}else sum+=shift.value;last=shift.at;cls=Math.max(cls,sum)}
  return {heroPath:new URL(hero.currentSrc).pathname,heroTransferBytes:resource?.transferSize||0,heroEncodedBytes:resource?.encodedBodySize||0,heroDurationMs:Math.round(resource?.duration||0),lcpMs:Math.round(sample.lcp),lcpElement:sample.lcpElement,cls:Number(cls.toFixed(4)),observedUntilMs:Math.round(performance.now())};
 });
 assert.match(metrics.heroPath,/\.webp$/);assert.ok(metrics.heroEncodedBytes>0,'Hero resource bytes must be measured');assert.ok(metrics.lcpMs>0,'LCP sample must be observed');
 let originalPngBytes=null;try{originalPngBytes=(await readFile(new URL('../src/public-assets/donicia-2026.png',import.meta.url))).byteLength}catch{}
 console.log('PUBLIC_MOBILE_PERFORMANCE '+JSON.stringify({synthetic:true,fieldCoreWebVitals:false,width:390,dpr:2,network:{latencyMs:150,downloadMbps:1.6,uploadKbps:750},...metrics,originalPngBytes,heroByteReduction:originalPngBytes?Number((1-metrics.heroEncodedBytes/originalPngBytes).toFixed(4)):null}));
 await mobileContext.close();

 console.log('PUBLIC_QA_COMPLETE '+JSON.stringify({viewports:[320,390,768,1440],synthetic:true,screenshots:4}));
}finally{
 if(browser)await browser.close();
 if(server&&server.exitCode===null){const exit=once(server,'exit');server.kill('SIGTERM');await Promise.race([exit,sleep(3000)]);if(server.exitCode===null)server.kill('SIGKILL')}
 await rm(directory,{recursive:true,force:true});
}
