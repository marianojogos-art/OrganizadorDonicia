// Read-only production verification. No credentials, stored requests or personal data.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='https://organizadordonicia.carijo.workers.dev';
const digest=value=>createHash('sha256').update(value).digest('hex');
const expected=digest(await readFile(new URL('../src/public-assets/assistant.js',import.meta.url)));
const get=path=>fetch(base+path,{redirect:'manual',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000)});
let ready=false;
for(let attempt=0;attempt<60;attempt++){
 try{const response=await get('/public-assets/assistant.js');if(response.ok&&digest(Buffer.from(await response.arrayBuffer()))===expected){ready=true;break}}catch{}
 await new Promise(resolve=>setTimeout(resolve,5000));
}
assert.ok(ready,'The assistant asset from this commit must be served before verification.');console.log('Production assistant asset SHA-256 matches checkout:',expected);
const home=await get('/');assert.equal(home.status,200);assert.match(await home.text(),/src="\/public-assets\/assistant.js"/);
const css=await get('/public-assets/assistant.css');assert.equal(css.status,200);assert.match(await css.text(),/#donicia-assistant/);
for(const path of ['/api/assistant','/api/assistant/execute','/api/secretariat-requests','/equipe']){const response=await get(path);assert.equal(response.status,302,path);assert.equal(new URL(response.headers.get('location')).hostname,'tiny-dew-2c0d.cloudflareaccess.com');console.log('Access protected:',path)}
const config=await get('/public/secretariat-requests');assert.equal(config.status,200);const settings=await config.json();assert.deepEqual(Object.keys(settings),['enabled']);assert.equal(typeof settings.enabled,'boolean');console.log('Family intake enabled:',settings.enabled);
for(const question of ['Pedir documentos','Consultar vagas','Solicitar transferência','Horário de atendimento']){
 const response=await fetch(base+'/public/assistant',{method:'POST',redirect:'manual',credentials:'omit',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({question}),signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);const result=await response.json();assert.equal(result.scope,'public');assert.equal(result.mode,'consulta-fontes');assert.ok(Array.isArray(result.sources));assert.ok(result.sources.length>0);assert.equal(result.action,undefined);assert.ok(result.sources.every(source=>source.url.startsWith('/#')));console.log('Public consultation verified:',question);
}
console.log('Production assistant HTTP checks passed. Employee login, real requests and secretariat delivery were not exercised.');
