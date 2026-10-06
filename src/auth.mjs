const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export async function identity(request,env){
 if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_ISSUER||'')||!env.ACCESS_AUD)return null;
 try {
  const token=request.headers.get('Cf-Access-Jwt-Assertion'); if(!token||token.length>16000)return null;
  const parts=token.split('.'); if(parts.length!==3)return null;
  const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));const claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));
  const now=Math.floor(Date.now()/1000);
  if(header.alg!=='RS256'||typeof header.kid!=='string'||claims.iss!==env.ACCESS_ISSUER||!Array.isArray(claims.aud)||!claims.aud.includes(env.ACCESS_AUD)||!Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now+60||(claims.nbf!==undefined&&(!Number.isFinite(claims.nbf)||claims.nbf>now)))return null;
  if(typeof claims.email!=='string'||!claims.email.endsWith('@prof.pmf.sc.gov.br'))return null;
  const response=await fetch(env.ACCESS_ISSUER+'/cdn-cgi/access/certs',{redirect:'error'}); if(!response.ok)return null;
  const {keys}=await response.json();const jwk=keys.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)return null;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))return null;
  return claims.email.toLowerCase();
 }catch{return null;}
}
