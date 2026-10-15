import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {once} from 'node:events';
import {sqlite} from './sqlite-adapter.mjs';
import {migrateLocal} from './migrate-local.mjs';
if(!process.env.CI||!process.env.RUNNER_TEMP||!process.env.PUBLIC_QA_PLAYWRIGHT_DIR)throw Error('Teacher day QA runs only in the isolated cloud runner.');
const require=createRequire(join(process.env.PUBLIC_QA_PLAYWRIGHT_DIR,'loader.cjs')),{chromium}=require('playwright');
const directory=await mkdtemp(join(process.env.RUNNER_TEMP,'donicia-teacher-day-')),database=join(directory,'synthetic.sqlite');
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),next=new Date(today+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);const tomorrow=next.toISOString().slice(0,10);
const teacher='teacher.demo@prof.pmf.sc.gov.br',team='direction.demo@prof.pmf.sc.gov.br',base='http://127.0.0.1:18795',staff='http://127.0.0.1:18796',servers=[],sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const DB=sqlite(database);
try{
 await migrateLocal(DB);
 DB.exec("INSERT INTO users(email,name,role,active) VALUES('teacher.demo@prof.pmf.sc.gov.br','Professor fictício','teacher',1),('direction.demo@prof.pmf.sc.gov.br','Equipe fictícia','direction',1)");
 for(const [id,owner,date,start,end,status,purpose]of [['own-approved',teacher,today,'18:00','19:00','Aprovada','Leitura fictícia'],['foreign',team,today,'10:00','11:00','Aprovada','Atividade de outro docente'],['own-pending',teacher,tomorrow,'08:00','09:00','Pendente','Pedido pendente fictício']]){
  await DB.prepare('INSERT INTO reservations(id,space,date,start,end,owner,purpose,responsible,status) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,'Biblioteca',date,start,end,owner,purpose,'Responsável fictício',status).run();
 }
 await DB.prepare("INSERT INTO xerox(id,title,copies,deadline,requester,professor,class,color,status,attachment_name,attachment_mime,attachment_data) VALUES('old-xerox','Material anterior fictício',12,?,?,?,'Turma fictícia','Colorido','Concluído','anterior.pdf','application/pdf','JVBERi0xLjQ=')").bind(today,teacher,'Professor fictício').run();
 await DB.prepare("INSERT INTO staff_requests(id,requester,type,title,classes,description,deadline,status) VALUES('material',?,'material','Solicitação em análise fictícia','Turma fictícia','Papel',?,'Em análise')").bind(teacher,tomorrow).run();
 await DB.prepare("INSERT INTO events(id,title,date,type,creator,formation,area,start,end,location,details,visibility) VALUES('local-formation','Formação local fictícia',?,'Evento escolar',?,1,'Ciências','08:00','10:00','Sala inicial','','internal')").bind(tomorrow,team).run();
}finally{DB.close()}
async function start(port,role){
 const child=spawn(process.execPath,['scripts/dev.mjs'],{env:{...process.env,PORT:String(port),LOCAL_DB:database,LOCAL_ROLE:role},stdio:['ignore','pipe','pipe']});servers.push(child);let log='';child.stdout.on('data',data=>log=(log+data).slice(-3000));child.stderr.on('data',data=>log=(log+data).slice(-3000));
 for(let i=0;i<150;i++){if(child.exitCode!==null)throw Error(log);try{if((await fetch('http://127.0.0.1:'+port+'/api/me')).ok)return}catch{}await sleep(200)}throw Error('Server timeout: '+log);
}
async function imageLog(page,name,fullPage){
 const base64=(await page.screenshot({type:'jpeg',quality:65,fullPage,animations:'disabled'})).toString('base64'),size=24000,total=Math.ceil(base64.length/size);
 for(let i=0;i<total;i++)console.log('TEACHER_DAY_IMAGE '+JSON.stringify({name,part:i+1,total,base64:base64.slice(i*size,(i+1)*size)}));
}
let browser;
try{
 await start(18795,'teacher');await start(18796,'direction');browser=await chromium.launch({headless:true});
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:960},locale:'pt-BR',timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'});
  await context.route('**/*',route=>[base,staff].includes(new URL(route.request().url()).origin)?route.continue():route.abort('blockedbyclient'));
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/equipe',{waitUntil:'networkidle'});await page.waitForFunction(()=>currentUser?.role==='teacher'&&state.section==='meu-dia'&&state.trainings.length>0);
  const postit=page.locator('.df-toggle');if(await postit.getAttribute('aria-expanded')==='true')await postit.click();
  assert.equal(await page.locator('#nav [data-section]').count(),6);assert.match(await page.locator('#page').innerText(),/Reserva próxima: Biblioteca/);assert.match(await page.locator('#page').innerText(),/Solicitação em análise fictícia/);assert.ok(!(await page.locator('#page').innerText()).includes('Atividade de outro docente'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'dashboard overflow '+width);
  await page.evaluate(()=>setPage('solicitacoes'));assert.ok(await page.locator('.teacher-order').count()>=4);
  await page.locator('[data-teacher-kind]').selectOption('xerox');assert.ok(await page.locator('.teacher-order').count()>=1);await page.locator('[data-teacher-kind]').selectOption('');
  await page.locator('[data-duplicate-kind="staff-requests"]').first().click();assert.equal(await page.locator('#donicia-feedback').isVisible(),false);assert.equal(await page.locator('#entryform [name=description]').inputValue(),'Papel');assert.equal(await page.locator('#entryform [name=type]').inputValue(),'material');assert.equal(await page.locator('#entryform [name=deadline]').inputValue(),'');await page.locator('[data-close]').first().click();
  await page.locator('[data-duplicate-kind="reservations"]').first().click();assert.equal(await page.locator('#entryform [name=date]').inputValue(),'');assert.equal(await page.locator('#entryform [name=space]').inputValue(),'Biblioteca');await page.locator('[data-close]').first().click();
  await page.evaluate(()=>setPage('xerox'));await page.locator('[data-duplicate-kind="xerox"]').first().click();
  assert.equal(await page.locator('[name=deadline]').inputValue(),'');assert.equal(await page.locator('[name=file]').inputValue(),'');assert.equal(await page.locator('[name=color]').inputValue(),'Colorido');assert.equal(await page.locator('[name=remove_attachment]').count(),0);
  await page.locator('[name=deadline]').fill(tomorrow);const duplicateResponse=page.waitForResponse(response=>response.url()===base+'/api/xerox'&&response.request().method()==='POST');await page.locator('#entryform button[type=submit]').click();assert.equal((await duplicateResponse).status(),201);await page.locator('.modal').waitFor({state:'detached'});
  const copies=await(await context.request.get(base+'/api/xerox')).json(),copy=copies.find(x=>x.id!=='old-xerox');assert.ok(copy);assert.equal(copy.status,'Aguardando aprovação');assert.equal(copy.attachment_name,'');assert.equal(copies.find(x=>x.id==='old-xerox').status,'Concluído');
  await page.evaluate(()=>setPage('espacos'));await page.locator('[data-agenda-view="day"]').click();
  await page.locator('[data-availability-date]').fill(today);await page.locator('[data-availability-date]').dispatchEvent('change');
  await page.locator('[data-availability-start]').fill('10:00');await page.locator('[data-availability-start]').dispatchEvent('change');await page.locator('[data-availability-end]').fill('11:00');await page.locator('[data-availability-end]').dispatchEvent('change');await page.locator('[data-availability-check]').click();assert.match(await page.locator('.availability-result').innerText(),/Ocupado/);
  await page.locator('[data-availability-date]').fill(tomorrow);await page.locator('[data-availability-date]').dispatchEvent('change');await page.locator('[data-availability-start]').fill('08:00');await page.locator('[data-availability-start]').dispatchEvent('change');await page.locator('[data-availability-end]').fill('09:00');await page.locator('[data-availability-end]').dispatchEvent('change');await page.locator('[data-availability-check]').click();assert.match(await page.locator('.availability-result').innerText(),/Livre/);
  await page.locator('[data-availability-book]').click();assert.equal(await page.locator('#entryform [name=date]').inputValue(),tomorrow);assert.equal(await page.locator('#entryform [name=start]').inputValue(),'08:00');await page.locator('#entryform [name=purpose]').fill('Novo pedido fictício');
  const bookingResponse=page.waitForResponse(response=>response.url()===base+'/api/reservations'&&response.request().method()==='POST');await page.locator('#entryform button[type=submit]').click();const booking=await bookingResponse;assert.equal(booking.status(),201);const bookingId=(await booking.json()).id;await page.locator('.modal').waitFor({state:'detached'});const reservations=await(await context.request.get(base+'/api/reservations')).json();assert.equal(reservations.find(x=>x.id===bookingId).status,'Pendente');
  await page.locator('[data-agenda-view="week"]').click();assert.equal(await page.locator('.agenda-day-detail').count(),7);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'space view overflow '+width);
  await page.evaluate(()=>setPage('meu-dia'));
  const formations=await(await context.request.get(staff+'/api/trainings')).json(),formation=formations.find(x=>x.id==='local-formation');
  const changed=await context.request.patch(staff+'/api/trainings/local-formation',{headers:{Origin:staff},data:{title:'Formação local fictícia',area:'Ciências',date:tomorrow,start:'08:00',end:'10:00',location:'Sala revisada '+width,notes:'Confira a mudança de local',version:formation.version}});assert.equal(changed.status(),200);
  await page.locator('[data-refresh]').first().click();await page.locator('.teacher-reminders').filter({hasText:'Alterada: Formação local fictícia'}).waitFor();
  await page.reload({waitUntil:'networkidle'});await page.locator('.teacher-reminders').filter({hasText:'Alterada: Formação local fictícia'}).waitFor();await page.locator('[data-formation-seen]').click();assert.ok(!(await page.locator('.teacher-reminders').innerText()).includes('Alterada: Formação local fictícia'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'final dashboard overflow '+width);assert.deepEqual(errors,[]);
  await page.evaluate(()=>scrollTo(0,0));
  if(width===390||width===1440){await imageLog(page,'teacher-'+width+'-top',false);await imageLog(page,'teacher-'+width+'-full',true)}
  console.log('TEACHER_DAY_QA '+JSON.stringify({width,ownRecords:true,duplicateWithoutAttachment:true,newApprovalRequired:true,dayWeekAvailability:true,formationChangeAfterReload:true,errors}));
  await context.close();
  const cleanup=sqlite(database);try{cleanup.exec("DELETE FROM xerox WHERE id<>'old-xerox'; DELETE FROM reservations WHERE id NOT IN ('own-approved','own-pending','foreign')")}finally{cleanup.close()}
 }
}finally{
 if(browser)await browser.close();for(const child of servers)if(child.exitCode===null){const exit=once(child,'exit');child.kill('SIGTERM');await Promise.race([exit,sleep(3000)]);if(child.exitCode===null)child.kill('SIGKILL')}await rm(directory,{recursive:true,force:true});
}
