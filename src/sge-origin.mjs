export const sgeOrigins=['https://www.sgebr.net.br','https://www.sgebr.com.br'];
export function allowedSgeUrl(value){
 const url=new URL(value);
 if(!sgeOrigins.includes(url.origin)||!url.pathname.startsWith('/sge8105/')||url.username||url.password)throw Error('Link fora do SGE.');
 return url.href;
}
