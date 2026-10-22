import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../src/worker.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test('unknown public asset paths stay private and static writes are rejected',async()=>{
 const fetched=[],env={DB:{},ASSETS:{async fetch(request){fetched.push(new URL(request.url).pathname);return new Response(request.method==='HEAD'?null:new Uint8Array([255,216,255]),{headers:{'Content-Type':'image/jpeg'}})}}};
 let authentications=0;const anonymous=async()=>{authentications++;return null};
 for(const method of ['GET','HEAD']){
  const response=await handle(new Request('https://school.example/public-assets/logo.jpg',{method}),env,anonymous);
  assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/jpeg');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
 }
 assert.equal(authentications,0);assert.deepEqual(fetched,['/public-assets/logo.jpg','/public-assets/logo.jpg']);
 const write=await handle(new Request('https://school.example/public-assets/logo.jpg',{method:'POST',body:'ignored'}),env,anonymous);assert.equal(write.status,405);assert.equal(fetched.length,2);
 for(const path of ['/public-assets/private.json','/public-assets/logo.jpg/extra','/public-assets/../index.html','/public-assets/../app.js','/public-assets/../sge-connector.zip']){
  const response=await handle(new Request('https://school.example'+path),env,anonymous);assert.equal(response.status,401,path);
 }
 assert.equal(fetched.length,2,'unknown or normalized private paths never reach assets');
});

const versionedImages=["donicia-2026-480.c67023d134b5.webp","donicia-2026-960.707952f5d28c.webp","donicia-2026-1440.f4d9f138aee3.webp"];

test('only fingerprinted public images receive immutable browser caching',async()=>{
 const fetched=[],env={DB:{},ASSETS:{async fetch(request){
  fetched.push({path:new URL(request.url).pathname,method:request.method});
  return new Response(request.method==='HEAD'?null:'image',{headers:{'Content-Type':'image/webp','ETag':'"image-v1"','Cache-Control':'public, max-age=10'}});
 }}};
 let authentications=0;const anonymous=async()=>{authentications++;return null};
 for(const name of versionedImages)for(const method of ['GET','HEAD']){
  const response=await handle(new Request('https://school.example/public-assets/'+name,{method}),env,anonymous);
  assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'public, max-age=31536000, immutable');
  assert.equal(response.headers.get('ETag'),'"image-v1"');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
 }
 assert.equal(authentications,0);assert.equal(fetched.length,versionedImages.length*2);
 const initial=fetched.length;
 for(const method of ['POST','PUT','DELETE']){
  const response=await handle(new Request('https://school.example/public-assets/'+versionedImages[0],{method}),env,anonymous);
  assert.equal(response.status,405);assert.equal(response.headers.get('Cache-Control'),'no-store');
 }
 for(const name of [versionedImages[0].replace('c67023d134b5','000000000000'),versionedImages[0]+'/extra','private.123456789abc.webp']){
  const response=await handle(new Request('https://school.example/public-assets/'+name),env,anonymous);
  assert.equal(response.status,401);assert.equal(response.headers.get('Cache-Control'),'no-store');
 }
 assert.equal(fetched.length,initial,'unlisted names and writes cannot fetch assets');
});

test('image cache validation works but missing/error assets are never immutable',async()=>{
 const path='/public-assets/'+versionedImages[0];
 for(const status of [304,404,503]){
  let conditional='';
  const env={DB:{},ASSETS:{async fetch(request){conditional=request.headers.get('If-None-Match');return new Response(null,{status,headers:{'ETag':'"image-v1"'}})}}};
  const response=await handle(new Request('https://school.example'+path,{headers:{'If-None-Match':'"image-v1"'}}),env,async()=>null);
  assert.equal(response.status,status);assert.equal(conditional,'"image-v1"');
  assert.equal(response.headers.get('Cache-Control'),status===304?'public, max-age=31536000, immutable':'no-store');
 }
});

test('HTML, mutable assets and authenticated staff pages keep no-store',async()=>{
 const user={email:'qa@example.invalid',name:'Synthetic user',role:'direction'};
 const env={DB:{prepare(){return {bind(){return this},async first(){return user}}}},ASSETS:{async fetch(){return new Response('synthetic',{headers:{'Cache-Control':'public, max-age=3600'}})}}};
 for(const path of ['/','/public.html','/public.js','/public-assets/logo.jpg','/public-assets/donicia-2026.png','/public-assets/feedback.js','/public-assets/feedback.css','/public-assets/site-metrics.js','/equipe','/equipe/app.js']){
  const response=await handle(new Request('https://school.example'+path),env,async()=>user.email);
  assert.equal(response.status,200,path);assert.equal(response.headers.get('Cache-Control'),'no-store',path);
 }
 const api=await handle(new Request('https://school.example/api/me'),env,async()=>user.email);
 assert.equal(api.status,200);assert.equal(api.headers.get('Cache-Control'),'no-store');
});

test('responsive images stay within the budget and filenames match their contents',async()=>{
 for(const name of versionedImages){
  const bytes=await readFile(new URL('../src/public-assets/'+name,import.meta.url));
  assert.ok(bytes.length<200000,'Image exceeds 200 kB: '+name);
  assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');
  assert.equal(createHash('sha256').update(bytes).digest('hex').slice(0,12),name.split('.')[1],'Fingerprint must change when image bytes change');
 }
});
