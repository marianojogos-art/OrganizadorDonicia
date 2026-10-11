import {sgeOrigins} from '../../src/sge-origin.mjs';
export const SGE_HOME='https://www.sgebr.net.br/sge8105/';
export const SGE_CLASSES=SGE_HOME+'hselgerenciamentoplanoaula.aspx';
export function allowedNavigation(value){
 if(value==='about:blank')return true;
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&sgeOrigins.some(origin=>new URL(origin).hostname===u.hostname||new URL(origin).hostname.slice(4)===u.hostname)}catch{return false}
}
export function validBridgeEvent(event){
 // Android WEB_MESSAGE_LISTENER supplies sourceOrigin, rather than a page URL.
 try{const u=new URL(event.url);return sgeOrigins.includes(u.origin)&&!u.username&&!u.password&&(u.pathname==='/'||u.pathname.startsWith('/sge8105/'))}catch{return false}
}
export function validBridgePage(value){try{const u=new URL(value);return sgeOrigins.includes(u.origin)&&!u.username&&!u.password&&u.pathname.startsWith('/sge8105/')}catch{return false}}

export function sgeClassesUrl(pageUrl){
 try{const url=new URL(pageUrl);if(!allowedNavigation(pageUrl)||pageUrl==='about:blank')return SGE_CLASSES;return new URL('/sge8105/hselgerenciamentoplanoaula.aspx',url).href}catch{return SGE_CLASSES}
}
