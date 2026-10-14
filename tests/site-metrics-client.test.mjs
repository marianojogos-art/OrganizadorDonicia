import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';import {mountSiteMetrics} from '../src/public-assets/site-metrics.js';
function fixture(options={}){
 const {document,window}=parseHTML('<html><body><a data-site-metric="contatos" href="#contatos">Contato</a><a data-site-metric="whatsapp_secretaria" href="https://wa.me/554888734629">WhatsApp</a><button data-metrics-optout>Desativar</button></body></html>');let now=Date.parse('2026-10-14T12:00:00Z');const storage=new Map(),calls=[];const Clock=class extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}};
 const win={navigator:options.navigator||{},Date:Clock,crypto,sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},fetch:async(...args)=>{calls.push(args);return {ok:true}}};
 if(options.blocked)Object.defineProperty(win,'sessionStorage',{get(){throw Error('blocked')}});
 const click=section=>document.querySelector('[data-site-metric="'+section+'"]').dispatchEvent(new window.Event('click',{bubbles:true}));
 return {document,win,storage,calls,click,advance:ms=>now+=ms};
}
test('public metrics mount once, count real section activation once and never send number, URL or page content',async()=>{
 const f=fixture(),handle=mountSiteMetrics(f.document,f.win);mountSiteMetrics(f.document,f.win);await handle.settled();assert.equal(f.calls.length,1);assert.equal(JSON.parse(f.calls[0][1].body).event,'page_view');
 f.click('contatos');f.click('contatos');await handle.settled();assert.equal(f.calls.length,2);f.advance(2200);f.click('contatos');f.click('whatsapp_secretaria');await handle.settled();assert.equal(f.calls.length,4);
 for(const [url,init] of f.calls){assert.equal(url,'/public/metrics');assert.equal(init.credentials,'omit');assert.equal(init.referrerPolicy,'no-referrer');const payload=JSON.parse(init.body);assert.deepEqual(Object.keys(payload),['eventId','sessionId','event','section']);assert.equal(init.body.includes('554888734629'),false);assert.equal(init.body.includes('#contatos'),false)}
 const before=JSON.parse(f.calls[0][1].body).sessionId;f.advance(86400000);f.click('contatos');await handle.settled();assert.notEqual(JSON.parse(f.calls.at(-1)[1].body).sessionId,before);
});
test('browser privacy signals, webdriver and blocked session storage suppress collection',async()=>{
 for(const navigator of [{doNotTrack:'1'},{globalPrivacyControl:true},{webdriver:true}]){const f=fixture({navigator}),h=mountSiteMetrics(f.document,f.win);f.click('contatos');await h.settled();assert.equal(f.calls.length,0);assert.equal(f.storage.size,0)}
 const blocked=fixture({blocked:true});assert.doesNotThrow(()=>mountSiteMetrics(blocked.document,blocked.win));assert.equal(blocked.calls.length,0);
});
test('opt-out stops queued submissions and clears tab identity without touching contributions',async()=>{
 const f=fixture();f.storage.set('donicia-feedback-visitor-v1','unrelated');const h=mountSiteMetrics(f.document,f.win);h.stop();await h.settled();f.click('whatsapp_secretaria');await h.settled();assert.equal(f.calls.length,0);assert.equal(f.storage.has('donicia-metrics-tab-day-v1'),false);assert.equal(f.storage.get('donicia-feedback-visitor-v1'),'unrelated');assert.equal(f.document.querySelector('[data-metrics-optout]').disabled,true);
});
