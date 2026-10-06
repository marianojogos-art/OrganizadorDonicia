import test from 'node:test';import assert from 'node:assert/strict';import {identity} from '../src/auth.mjs';
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test'};
const env={ACCESS_ISSUER:'https://school-test.cloudflareaccess.com',ACCESS_AUD:'school-aud'};
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
async function token(overrides={},header={alg:'RS256',kid:'test'}){const now=Math.floor(Date.now()/1000);const payload={iss:env.ACCESS_ISSUER,aud:[env.ACCESS_AUD],iat:now,exp:now+3600,email:'teacher@prof.pmf.sc.gov.br',...overrides};const raw=enc(header)+'.'+enc(payload);const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(raw));return raw+'.'+Buffer.from(sig).toString('base64url')}
const request=t=>new Request('https://school.example/',{headers:{'Cf-Access-Jwt-Assertion':t}});
test('JWT validates RSA signature, exact issuer/audience, expiry, time and institutional email',async()=>{const old=globalThis.fetch;globalThis.fetch=async()=>Response.json({keys:[jwk]});try{assert.equal(await identity(request(await token()),env),'teacher@prof.pmf.sc.gov.br');for(const changes of [{iss:'https://attacker.cloudflareaccess.com'},{aud:['other']},{exp:1},{iat:99999999999},{nbf:99999999999},{email:'teacher@example.com'},{email:'teacher@prof.sc.gov.br'}])assert.equal(await identity(request(await token(changes)),env),null);assert.equal(await identity(request(await token({}, {alg:'none',kid:'test'})),env),null);const t=await token();assert.equal(await identity(request(t.slice(0,-5)+'AAAAA'),env),null);assert.equal(await identity(request('malformed'),env),null);assert.equal(await identity(request(await token()),{}),null)}finally{globalThis.fetch=old}});
test('JWKS outage fails closed',async()=>{const old=globalThis.fetch;globalThis.fetch=async()=>{throw Error('offline')};try{assert.equal(await identity(request(await token()),env),null)}finally{globalThis.fetch=old}});

const cookieRequest=t=>new Request('https://school.example/',{headers:{Cookie:`theme=light; CF_Authorization=${t}; locale=pt-BR`}});
test('Access application cookie authenticates when assertion header is absent',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>Response.json({keys:[jwk]});
 try{assert.equal(await identity(cookieRequest(await token()),env),'teacher@prof.pmf.sc.gov.br');}
 finally{globalThis.fetch=old;}
});
test('Access cookie still rejects invalid signature, claims and missing configuration',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>Response.json({keys:[jwk]});
 try{
  for(const changes of [{iss:'https://attacker.cloudflareaccess.com'},{aud:['other']},{exp:1},{email:'teacher@example.com'}])assert.equal(await identity(cookieRequest(await token(changes)),env),null);
  const signed=await token();assert.equal(await identity(cookieRequest(signed.slice(0,-5)+'AAAAA'),env),null);
  assert.equal(await identity(cookieRequest(signed),{}),null);
  assert.equal(await identity(cookieRequest('malformed'),env),null);
 }finally{globalThis.fetch=old;}
});
test('Assertion header takes precedence and invalid header cannot fall back to cookie',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>Response.json({keys:[jwk]});
 try{
  const signed=await token();
  assert.equal(await identity(new Request('https://school.example/',{headers:{Cookie:`CF_Authorization=${signed}`,'Cf-Access-Jwt-Assertion':'malformed'}}),env),null);
  assert.equal(await identity(new Request('https://school.example/',{headers:{Cookie:'CF_Authorization=malformed','Cf-Access-Jwt-Assertion':signed}}),env),'teacher@prof.pmf.sc.gov.br');
 }finally{globalThis.fetch=old;}
});
test('Duplicate or similarly named Access cookies cannot provide identity',async()=>{
 const signed=await token();
 for(const Cookie of [`CF_Authorization=${signed}; CF_Authorization=${signed}`,`OtherCF_Authorization=${signed}`,`CF_Authorization_extra=${signed}`,'theme=light'])assert.equal(await identity(new Request('https://school.example/',{headers:{Cookie}}),env),null);
});
