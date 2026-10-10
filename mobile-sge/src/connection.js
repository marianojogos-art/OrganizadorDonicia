export const SGE_HOME='https://www.sgebr.net.br/sge8105/';
export const SGE_CLASSES=SGE_HOME+'hselgerenciamentoplanoaula.aspx';
export function allowedNavigation(value){
 if(value==='about:blank')return true;
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&['www.sgebr.net.br','sgebr.net.br'].includes(u.hostname)}catch{return false}
}
export function validBridgeEvent(event){
 // Android WEB_MESSAGE_LISTENER supplies sourceOrigin, rather than a page URL.
 try{const u=new URL(event.url);return u.origin==='https://www.sgebr.net.br'&&!u.username&&!u.password&&(u.pathname==='/'||u.pathname.startsWith('/sge8105/'))}catch{return false}
}
export function validBridgePage(value){try{const u=new URL(value);return u.origin==='https://www.sgebr.net.br'&&!u.username&&!u.password&&u.pathname.startsWith('/sge8105/')}catch{return false}}
