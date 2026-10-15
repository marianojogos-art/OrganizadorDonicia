import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {sqlite} from './sqlite-adapter.mjs';
import {migrateLocal} from './migrate-local.mjs';
if(!process.env.CI||!process.env.RUNNER_TEMP||!process.env.PUBLIC_QA_PLAYWRIGHT_DIR)throw Error('Cloud runner required');
const require=createRequire(join(process.env.PUBLIC_QA_PLAYWRIGHT_DIR,'loader.cjs')),{chromium}=require('playwright');
const directory=await mkdtemp(join(process.env.RUNNER_TEMP,'donicia-pedagogical-')),database=join(directory,'synthetic.sqlite');
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const teacher='teacher.demo@prof.pmf.sc.gov.br',team='direction.demo@prof.pmf.sc.gov.br',staff='http://127.0.0.1:18806',own='http://127.0.0.1:18805',publicBase='http://127.0.0.1:18807',servers=[];
const DB=sqlite(database);try{
 await migrateLocal(DB);await DB.prepare('INSERT INTO users VALUES(?,?,?,1),(?,?,?,1)').bind(teacher,'Professor fictício','teacher',team,'Equipe fictícia','direction').run();
 await DB.prepare("INSERT INTO reservations(id,space,date,start,end,owner,purpose,responsible,status) VALUES('confirmed','Biblioteca',?,'08:00','09:00',?,'Leitura confirmada fictícia','Professor fictício','Aprovada')").bind(today,teacher).run();
 await DB.prepare("INSERT INTO events(id,title,date,type,creator,formation,area,start,end,location,visibility) VALUES('formation','Formação fictícia',?,'Evento escolar',?,1,'Linguagens','08:30','09:30','Biblioteca','internal'),('manual','Formação externa fictícia',?,'Evento escolar',?,1,'Ciências','','','SME','internal')").bind(today,team,today,team).run();
}finally{DB.close()}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function start(port,role){
 const child=spawn(process.execPath,['scripts/dev.mjs'],{env:{...process.env,PORT:String(port),LOCAL_DB:database,LOCAL_ROLE:role},stdio:['ignore','pipe','pipe']});servers.push(child);let log='';child.stdout.on('data',d=>log=(log+d).slice(-2000));child.stderr.on('data',d=>log=(log+d).slice(-2000));
 for(let i=0;i<150;i++){if(child.exitCode!==null)throw Error(log);try{if((await fetch('http://127.0.0.1:'+port+'/')).ok)return}catch{}await sleep(200)}throw Error(log);
}
async function imageLog(page,name){
 const b=(await page.screenshot({type:'jpeg',quality:65,fullPage:false,animations:'disabled'})).toString('base64'),total=Math.ceil(b.length/24000);
 for(let i=0;i<total;i++)console.log('PEDAGOGICAL_IMAGE '+JSON.stringify({name,part:i+1,total,base64:b.slice(i*24000,(i+1)*24000)}));
}
async function boot(page,base){await page.goto(base+'/equipe',{waitUntil:'networkidle'});await page.waitForFunction(()=>currentUser&&state.events.length>0);const toggle=page.locator('.df-toggle');if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click()}
async function submit(page){await page.locator('#entryform button[type=submit]').click();await page.waitForSelector('.modal',{state:'detached'})}
let browser;
try{
 await start(18805,'teacher');await start(18806,'direction');await start(18807,'anonymous');browser=await chromium.launch({headless:true});
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:960},locale:'pt-BR',timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'});
  await context.route('**/*',r=>[staff,own,publicBase].includes(new URL(r.request().url()).origin)?r.continue():r.abort('blockedbyclient'));
  const page=await context.newPage(),teacherPage=await context.newPage(),errors=[];for(const p of [page,teacherPage])p.on('pageerror',e=>errors.push(e.message));
  await boot(teacherPage,own);await boot(page,staff);
  const ids=await teacherPage.evaluate(async({today,width})=>{
   const reservation=await api('reservations','POST',{space:'Auditório',date:today,start:'13:00',end:'14:00',responsible:'Professor fictício',purpose:'Pedido fictício '+width,class:'61',subject:'Leitura'});
   const material=await api('staff-requests','POST',{type:'material',title:'Papel fictício '+width,classes:'61',description:'Folhas',deadline:today});
   const xerox=await api('xerox','POST',{title:'Cópias fictícias '+width,copies:10,deadline:today});
   return {reservations:reservation.id,'staff-requests':material.id,xerox:xerox.id};
  },{today,width});
  await page.evaluate(async()=>{await refresh();setPage('solicitacoes')});
  assert.equal(await page.locator('[data-return-kind]').count(),3);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'central overflow '+width);
  if(width===1440)await imageLog(page,'central-desktop');
  for(const kind of ['reservations','staff-requests','xerox']){
   await page.locator('[data-return-kind="'+kind+'"]').click();await page.locator('#entryform button[type=submit]').click();assert.ok(await page.locator('[name=review_reason]').evaluate(x=>!x.checkValidity()));
   await page.locator('[name=review_reason]').fill('Corrija as informações do pedido fictício.');await submit(page);
   await teacherPage.evaluate(async()=>{await refresh();setPage('solicitacoes')});
   assert.match(await teacherPage.locator('#page').innerText(),/Corrija as informações/);
   const index=await teacherPage.evaluate(({kind,id})=>state[entities[kind]].findIndex(x=>x.id===id),{kind,id:ids[kind]});
   if(kind==='xerox'){await teacherPage.locator('[data-revise-xerox="'+index+'"]').first().click();await teacherPage.locator('#entryform [name=copies]').fill('12')}
   else{await teacherPage.locator('[data-edit="'+kind+':'+index+'"]').click();await teacherPage.locator('#entryform [name="'+(kind==='reservations'?'purpose':'description')+'"]').fill('Informações corrigidas fictícias')}
   await submit(teacherPage);
   await page.evaluate(async()=>{await refresh();setPage('solicitacoes')});
   const rowIndex=await page.evaluate(({kind,id})=>state[entities[kind]].findIndex(x=>x.id===id),{kind,id:ids[kind]});
   await page.locator('[data-approval-kind-action="'+kind+'"][data-approval-index="'+rowIndex+'"][data-approval-status="'+(kind==='xerox'?'Aprovado':'Aprovada')+'"]').click();
   await page.waitForFunction(({kind,id})=>state[entities[kind]].find(x=>x.id===id)?.status===(kind==='xerox'?'Aprovado':'Aprovada'),{kind,id:ids[kind]});
  }
  await page.evaluate(()=>setPage('agenda-equipe'));assert.match(await page.locator('#page').innerText(),/Conflito no espaço/);assert.match(await page.locator('#page').innerText(),/Conferir manualmente/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'week overflow '+width);
  if(width===390)await imageLog(page,'weekly-mobile');
  await page.evaluate(()=>setPage('comunicacao'));await page.locator('[data-action=new-notice]').click();
  await page.locator('#entryform [name=title]').fill('Aviso público fictício '+width);await page.locator('#entryform [name=body]').fill('Comunicado sintético para conferir a prévia.');await page.locator('#entryform [name=published]').selectOption('true');await page.locator('#entryform [name=highlight_from]').fill(today);await page.locator('#entryform [name=highlight_until]').fill(today);
  await page.locator('#entryform button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#formerror').textContent.includes('prévia'));
  await page.locator('[data-publication-preview]').click();await page.waitForSelector('#publication-preview article');
  if(width===390)await imageLog(page,'publication-preview-mobile');
  await page.locator('#entryform [name=body]').fill('Comunicado sintético revisado.');
  await page.locator('#entryform button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#formerror').textContent.includes('prévia'));
  await page.locator('[data-publication-preview]').click();await submit(page);
  const publicPage=await context.newPage();publicPage.on('pageerror',e=>errors.push(e.message));await publicPage.goto(publicBase+'/',{waitUntil:'networkidle'});
  assert.match(await publicPage.locator('#week-items').innerText(),/Aviso público fictício/);
  const highlights=await publicPage.evaluate(async()=>{const r=await fetch('/public/highlights');return r.json()});
  assert.ok(highlights.items.some(x=>x.title==='Aviso público fictício '+width));
  assert.deepEqual(errors,[]);console.log('PEDAGOGICAL_QA_OK '+width+' central, reason, teacher correction, approvals, weekly conflict, preview and public highlights');
  await context.close();
 }
}finally{await browser?.close();for(const child of servers)child.kill('SIGTERM');await sleep(300);await rm(directory,{recursive:true,force:true})}
