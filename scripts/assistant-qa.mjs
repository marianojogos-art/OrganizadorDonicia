import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {sqlite} from './sqlite-adapter.mjs';
import {migrateLocal} from './migrate-local.mjs';
if(!process.env.ASSISTANT_QA_PLAYWRIGHT_DIR)throw Error('Configure the isolated Playwright directory.');
const {chromium}=createRequire(join(process.env.ASSISTANT_QA_PLAYWRIGHT_DIR,'loader.cjs'))('playwright');
const directory=await mkdtemp(join(tmpdir(),'donicia-assistant-qa-')),database=join(directory,'synthetic.sqlite');
const DB=sqlite(database);await migrateLocal(DB);DB.exec("INSERT INTO users VALUES('direction.demo@prof.pmf.sc.gov.br','Direção fictícia','direction',1),('supervision.demo@prof.pmf.sc.gov.br','Equipe fictícia','direction',1),('guidance.demo@prof.pmf.sc.gov.br','Equipe fictícia','direction',1),('teacher.demo@prof.pmf.sc.gov.br','Professor fictício','teacher',0)");await DB.prepare("UPDATE school_profile SET phone='0000-0000',email='secretaria@example.invalid' WHERE id=1").run();DB.close();
const server=spawn(process.execPath,['scripts/dev.mjs'],{env:{...process.env,PORT:'18793',LOCAL_DB:database,LOCAL_ROLE:'direction',LOCAL_SECRETARIAT_INTAKE_ENABLED:'true'},stdio:'ignore'});
let browser;const base='http://127.0.0.1:18793';
try{
 let ready=false;for(let n=0;n<100;n++){try{if((await fetch(base+'/public/api')).ok){ready=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,100))}assert.ok(ready,'synthetic server started');
 browser=await chromium.launch({headless:true,...(process.env.ASSISTANT_QA_BROWSER?{executablePath:process.env.ASSISTANT_QA_BROWSER}:{})});
 const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const width of [360,768,1280]){
  await page.setViewportSize({width,height:850});await page.goto(base);await page.locator('#donicia-assistant .da-launch').click();
  await page.getByRole('button',{name:'Consultar vagas',exact:true}).click();await page.locator('[data-answer]').getByText(/não reserva vaga/).waitFor();
  const bounds=await page.locator('.da-panel').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1,'panel fits viewport');
  assert.equal(await page.locator('[data-answer]').getByRole('link',{name:/contatos publicados/}).count(),1);
 }
 await page.locator('[data-intake]').getByText(/registro de pedidos pelo site ainda não está habilitado/).waitFor();assert.equal(await page.locator('[data-request]').count(),0);
 await page.goto(base+'/equipe');await page.getByRole('link',{name:'Acessos da Secretaria',exact:true}).click();
 await page.getByText('Nenhuma concessão aplicada.',{exact:false}).waitFor();assert.equal(await page.locator('[name="account"]:checked').count(),0);assert.equal(await page.getByRole('button',{name:'Revisar concessão',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Ativar recebimento público',exact:true}).isVisible(),false);
 for(const email of ['direction.demo@prof.pmf.sc.gov.br','supervision.demo@prof.pmf.sc.gov.br','guidance.demo@prof.pmf.sc.gov.br'])await page.locator('[name="account"][value="'+email+'"]').check();
 await page.getByRole('button',{name:'Revisar concessão',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Conceder acesso às três contas',exact:true}).isDisabled(),true);await page.getByLabel('Confirmo conceder acesso à fila somente às três contas acima, sem alterar seus perfis.').check();await page.getByRole('button',{name:'Conceder acesso às três contas',exact:true}).click();
 await page.getByText('Recebimento público desativado. As três concessões ativas foram verificadas.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Ativar recebimento público',exact:true}).isDisabled(),true);assert.equal(await page.locator('#members li').count(),3);
 await page.getByLabel('Confirmo ativar o recebimento público e armazenar esses dados na fila interna acessível às três contas verificadas.').check();await page.getByRole('button',{name:'Ativar recebimento público',exact:true}).click();await page.getByText('Recebimento público ativo. Os pedidos podem ser registrados na fila interna.',{exact:true}).waitFor();
 await page.reload();await page.getByText('Recebimento público ativo. Os pedidos podem ser registrados na fila interna.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Conceder acesso às três contas',exact:true}).isVisible(),false);await page.goto(base);
 await page.reload();await page.locator('#donicia-assistant .da-launch').click();await page.getByRole('button',{name:'Consultar vagas',exact:true}).click();
 await page.getByLabel('Seu nome (responsável)').fill('Responsável fictício');await page.getByLabel('Seu e-mail ou telefone para retorno').fill('familia@example.invalid');await page.getByRole('button',{name:'Revisar solicitação'}).click();await page.getByRole('button',{name:'Confirmar e registrar pedido'}).click();await page.locator('[data-intake]').getByText(/Pedido registrado:/).waitFor();
 await page.goto(base+'/equipe');await page.locator('#donicia-assistant .da-launch').click();await page.getByRole('button',{name:'Quero pedir xerox',exact:true}).click();await page.getByRole('button',{name:'Conversar passo a passo'}).click();
 for(const value of ['Material sintético','2','2026-11-30']){await page.locator('#da-step').fill(value);await page.locator('[data-answer]').getByRole('button',{name:'Continuar',exact:true}).click()}
 assert.equal(await page.locator('[data-answer]').getByText('Revise antes de confirmar').count(),1);await page.getByRole('button',{name:'Confirmar e registrar',exact:true}).click();await page.locator('[data-answer]').getByText(/Registro confirmado no sistema/).waitFor();
 await page.locator('#donicia-assistant [data-close]').click();await page.getByRole('link',{name:'Fila da Secretaria',exact:true}).click();assert.ok(page.url().endsWith('/equipe/secretaria'));const identity=await page.request.get(base+'/api/me');assert.equal((await identity.json()).role,'direction');await page.locator('#requests').getByText(/familia@example.invalid/).waitFor();
 await page.locator('#requests textarea').fill('Recebido na fila interna (sintético)');await page.getByRole('button',{name:'Assumir na Secretaria'}).click();await page.getByRole('button',{name:'Confirmar atendimento concluído'}).waitFor();
 assert.deepEqual(errors,[]);console.log('Assistant browser QA passed: 3 widths, public intake disabled until explicit activation, family receipt, employee guided xerox, individual queue access with direction preserved and forwarding state. Synthetic data only.');
}finally{await browser?.close();server.kill();await rm(directory,{recursive:true,force:true})}
