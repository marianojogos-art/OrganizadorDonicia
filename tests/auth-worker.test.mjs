import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';

test('Workers runtime validates signed Access tokens and rejects certificate redirects', async () => {
 const issuer='https://school-runtime.cloudflareaccess.com';
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'runtime-test'};
 const now=Math.floor(Date.now()/1000);
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const raw=encode({alg:'RS256',kid:jwk.kid})+'.'+encode({iss:issuer,aud:['runtime-aud'],iat:now,exp:now+3600,email:'teacher@prof.pmf.sc.gov.br'});
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(raw));
 const token=raw+'.'+Buffer.from(signature).toString('base64url');
 let certificateStatus=200;const fetched=[];
 const source=await readFile(new URL('../src/auth.mjs',import.meta.url),'utf8');
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-10-03',cf:false,
  outboundService:request=>{
   fetched.push(request.url);
   assert.ok([issuer+'/cdn-cgi/access/certs',issuer+'/redirected-certs'].includes(request.url));
   if(certificateStatus===302&&request.url.endsWith('/certs'))return new Response('',{status:302,headers:{location:issuer+'/redirected-certs'}});
   return Response.json({keys:[jwk]});
  },
  bindings:{ACCESS_ISSUER:issuer,ACCESS_AUD:'runtime-aud'},
  script:source+`\nexport default {async fetch(request,env){const email=await identity(request,env);return new Response(email||'denied',{status:email?200:403});}};`
 }));
 try {
  for(const headers of [{'Cf-Access-Jwt-Assertion':token},{Cookie:`CF_Authorization=${token}`}]){
   const response=await mf.dispatchFetch('https://school.example/',{headers});
   assert.equal(response.status,200);
   assert.equal(await response.text(),'teacher@prof.pmf.sc.gov.br');
  }
  assert.equal((await mf.dispatchFetch('https://school.example/',{headers:{'Cf-Access-Jwt-Assertion':token.slice(0,-5)+'AAAAA'}})).status,403);
  certificateStatus=302;
  // A followed redirect would reach this valid key and incorrectly authenticate.
  assert.equal((await mf.dispatchFetch('https://school.example/',{headers:{'Cf-Access-Jwt-Assertion':token}})).status,403);
  assert.equal(fetched.length,4);
  assert.ok(fetched.every(url=>url===issuer+'/cdn-cgi/access/certs'));
 } finally {await mf.dispose();}
});
