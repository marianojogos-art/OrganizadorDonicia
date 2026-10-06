const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
function accessToken(request){
 const assertion=request.headers.get('Cf-Access-Jwt-Assertion');
 if(assertion!==null)return assertion;
 const cookies=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith('CF_Authorization='));
 return cookies.length===1?cookies[0].slice('CF_Authorization='.length):null;
}
export async function identity(request,env){
 const deny=reason=>{if(env.ACCESS_DIAGNOSTICS==='1')console.warn('DONICIA_ACCESS_DENIED',reason);return null;};
 if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_ISSUER||'')||!env.ACCESS_AUD)return deny('configuration');
 let stage='token_parse';
 try {
  const token=accessToken(request); if(!token)return deny('missing_token');if(token.length>16000)return deny('token_size');
  const parts=token.split('.'); if(parts.length!==3)return deny('token_format');
  const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));const claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));
  const now=Math.floor(Date.now()/1000);
  if(header.alg!=='RS256'||typeof header.kid!=='string')return deny('algorithm');
  if(claims.iss!==env.ACCESS_ISSUER)return deny('issuer');
  if(!Array.isArray(claims.aud)||!claims.aud.includes(env.ACCESS_AUD))return deny('audience');
  if(!Number.isFinite(claims.exp)||claims.exp<=now)return deny('expired');
  if(!Number.isFinite(claims.iat)||claims.iat>now+60)return deny('issued_at');
  if(claims.nbf!==undefined&&(!Number.isFinite(claims.nbf)||claims.nbf>now))return deny('not_before');
  if(typeof claims.email!=='string'||!claims.email.endsWith('@prof.pmf.sc.gov.br'))return deny('email_domain');
  stage='certificates_fetch';
  // Workers supports manual redirects; reject non-success responses without following them.
  const response=await fetch(env.ACCESS_ISSUER+'/cdn-cgi/access/certs',{redirect:'manual'}); if(!response.ok)return deny('certificates_status');
  stage='certificates_parse';
  const {keys}=await response.json();const jwk=keys.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)return deny('unknown_key');
  stage='signature';
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))return deny('signature');
  return claims.email.toLowerCase();
 }catch{return deny(stage);}
}
