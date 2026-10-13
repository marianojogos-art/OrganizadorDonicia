import {writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {parseHTML} from 'linkedom';
const directory=join(process.env.RUNNER_TEMP,'formation-source');await mkdir(directory,{recursive:true});
for(const source of [{"kind":"fundamental","url":"https://docs.google.com/presentation/d/e/2PACX-1vSfesD6aPQbTgK-tBDcBEu5bFId-0RWJQ4YZ37WbgjBdd53Nrq6p2u-tNpdFAO1ZA/pub"},{"kind":"especial","url":"https://docs.google.com/presentation/d/e/2PACX-1vStiyKUQ014_p2fdJGn0IhVzATJzoVBKGki1hgE3AKrMQRqsiTuoPSscmpg92NYcw/pub"}]){
 const response=await fetch(source.url,{redirect:'manual',signal:AbortSignal.timeout(30000)});
 if(!response.ok){console.log('CALENDAR_SOURCE '+JSON.stringify({...source,status:response.status,location:response.headers.get('location')}));continue;}
 const html=await response.text();if(html.length>50000000)throw Error('Calendar source too large');
 await writeFile(join(directory,source.kind+'.html'),html);
 const {document}=parseHTML(html);
 const title=document.querySelector('title')?.textContent||'';
 const ids=[...new Set([...html.matchAll(/(?:presentationId|docId|docid)["']?\s*[:=]\s*["']([A-Za-z0-9_-]{20,})/g)].map(x=>x[1]))];
 const scripts=[...document.querySelectorAll('script')].map(x=>x.textContent).filter(x=>/DOCS_modelChunk|presentationId|docId|slide|viewerData/i.test(x)).map(x=>x.slice(0,25000));
 for(const item of document.querySelectorAll('script,style'))item.remove();
 const text=document.body?.textContent.replace(/\s+/g,' ').trim()||'';
 const links=[...document.querySelectorAll('a[href]')].map(x=>({text:x.textContent.trim(),href:x.getAttribute('href')})).filter(x=>source.kind!=='portal'||/CALEND|Outubro|Educa.*Especial/i.test(x.text));
 console.log('CALENDAR_SOURCE '+JSON.stringify({...source,status:response.status,title,text:text.slice(0,75000),links,ids,htmlLength:html.length,scripts:scripts.slice(0,1).map(x=>x.slice(0,2500)),hints:[...html.matchAll(/docId|documentId|presentationId|download|htmlpresent|output=|export|print/g)].slice(0,18).map(x=>html.slice(Math.max(0,x.index-80),x.index+180))}));
}
