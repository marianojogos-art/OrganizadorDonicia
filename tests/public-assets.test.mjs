import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../src/worker.mjs';

test('only the explicit school logo is public and static writes are rejected',async()=>{
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
