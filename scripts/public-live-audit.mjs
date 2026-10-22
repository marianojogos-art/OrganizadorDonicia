import {createRequire} from 'node:module';
import {join} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
if(!process.env.CI||!process.env.RUNNER_TEMP||!process.env.PUBLIC_QA_PLAYWRIGHT_DIR)throw Error('Run only in isolated cloud CI');
const require=createRequire(join(process.env.PUBLIC_QA_PLAYWRIGHT_DIR,'loader.cjs'));
const {chromium}=require('playwright');
const base='https://organizadordonicia.carijo.workers.dev';
const dir=join(process.env.RUNNER_TEMP,'donicia-public-audit');
await mkdir(dir,{recursive:true});
const log=(type,value)=>console.log('PUBLIC_AUDIT_'+type+' '+JSON.stringify(value));
async function capture(page,name,selector){
 const target=selector?page.locator(selector):page;
 const bytes=await target.screenshot({type:'jpeg',quality:68,animations:'disabled'});
 await writeFile(join(dir,name+'.jpg'),bytes);
 const b=bytes.toString('base64'),total=Math.ceil(b.length/24000);
 for(let i=0;i<total;i++)log('IMAGE',{name,part:i+1,total,base64:b.slice(i*24000,(i+1)*24000)});
}
const browser=await chromium.launch({headless:true});
try{
 for(const width of [390,1440,320,768]){
  const context=await browser.newContext({viewport:{width,height:900},locale:'pt-BR',timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'});
  await context.route('**/*',route=>{
   const r=route.request(),u=new URL(r.url());
   if(u.origin!==base||!['GET','HEAD'].includes(r.method()))return route.abort();
   return route.continue();
  });
  const page=await context.newPage(),errors=[],responses=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(new URL(r.url()).origin===base)responses.push({path:new URL(r.url()).pathname,status:r.status(),cache:r.headers()['cache-control']})});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#load-status')?.classList.contains('hidden'));
  await page.waitForFunction(()=>!document.querySelector('#projects')?.textContent.includes('Carregando'));
  await page.evaluate(async()=>{for(const image of document.images){image.loading='eager';try{await image.decode()}catch{}}});
  if(width===390||width===1440){
   await capture(page,width+'-inicio');
   for(const [name,selector] of [['semana','#semana'],['projetos','#projetos'],['documentos','#documentos'],['calendario','#calendario'],['contatos','#contatos']])await capture(page,width+'-'+name,selector);
  }
  const state=await page.evaluate(()=>{
   const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}};
   return{title:document.title,lang:document.documentElement.lang,viewport:innerWidth,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth,
    headings:[...document.querySelectorAll('h1,h2,h3,h4')].map(e=>({level:e.tagName,text:e.textContent})),
    sections:Object.fromEntries(['week-items','notices','projects','documents','events'].map(id=>[id,document.getElementById(id).innerText])),
    smallTargets:[...document.querySelectorAll('a,button,input,summary')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<24||r.height<24)}).map(e=>({text:e.textContent.trim().slice(0,60),...box(e)})),
    brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src')),
    landmarks:[...document.querySelectorAll('main,nav,header,footer')].map(e=>({tag:e.tagName,label:e.getAttribute('aria-label')})),
    timings:performance.getEntriesByType('navigation').map(n=>({ttfb:n.responseStart,domContentLoaded:n.domContentLoadedEventEnd,load:n.loadEventEnd})),
    resources:performance.getEntriesByType('resource').map(r=>({path:new URL(r.name).pathname,bytes:r.transferSize,duration:Math.round(r.duration)}))};
  });
  await page.evaluate(()=>scrollTo(0,0));
  await page.keyboard.press('Tab');
  log('STATE',{width,...state,firstFocus:await page.locator(':focus').getAttribute('class'),errors,responses});
  if(width===1440){
   for(const path of ['/public/api','/public/content','/public/highlights']){
    const r=await context.request.get(base+path);
    const data=await r.json();log('INVENTORY',{path,status:r.status(),data});
   }
   await page.locator('.nav a[href="#contatos"]').focus();await page.keyboard.press('Enter');await page.waitForURL('**/#contatos');
   log('KEYBOARD',{contactAnchor:new URL(page.url()).hash});
   await page.locator('.faq summary').first().focus();await page.keyboard.press('Enter');
   log('FAQ',{opened:await page.locator('.faq details').first().getAttribute('open')!==null});
   await page.locator('#calendar-month').fill('2026-11');
   log('CALENDAR',{period:await page.locator('#calendar-period').innerText(),text:await page.locator('#events').innerText()});
   await page.route('**/public/highlights',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
   await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('#load-status')?.classList.contains('hidden')&&!document.querySelector('#projects')?.textContent.includes('Carregando'));
   log('HIGHLIGHTS_FAILURE',{contentError:await page.locator('#content-error').isVisible(),projects:await page.locator('#projects').innerText(),week:await page.locator('#week-items').innerText()});
   await capture(page,'failure-highlights-projects','#projetos');
   await page.unroute('**/public/highlights');
   await page.route('**/public/api',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
   await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('#load-status')?.classList.contains('hidden')&&!document.querySelector('#projects')?.textContent.includes('Carregando'));
   log('API_FAILURE',{error:await page.locator('#load-error').isVisible(),calendar:await page.locator('#events').innerText(),week:await page.locator('#week-items').innerText()});
   await capture(page,'failure-calendar','#calendario');
   await page.unroute('**/public/api');
   await page.locator('#retry').click();await page.waitForFunction(()=>!document.querySelector('#retry')?.disabled&&document.querySelector('#load-status')?.classList.contains('hidden'));
   log('RECOVERY',{calendar:await page.locator('#events').innerText()});
   await page.locator('.df-toggle').click();log('FEEDBACK',{expanded:await page.locator('.df-toggle').getAttribute('aria-expanded'),formVisible:await page.locator('#df-body form').isVisible()});
   await page.locator('.df-toggle').click();
  }
  await context.close();
 }
 log('COMPLETE',{date:new Date().toISOString(),viewports:[390,1440,320,768],productionWrites:false});
}finally{await browser.close()}
