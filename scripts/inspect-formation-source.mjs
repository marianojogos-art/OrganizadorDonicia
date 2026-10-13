import {writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {parseHTML} from 'linkedom';
const directory=join(process.env.RUNNER_TEMP,'formation-source');await mkdir(directory,{recursive:true});
for(const source of [{"kind":"fundamental","url":"https://docs.google.com/presentation/d/e/2PACX-1vSfesD6aPQbTgK-tBDcBEu5bFId-0RWJQ4YZ37WbgjBdd53Nrq6p2u-tNpdFAO1ZA/htmlpresent"},{"kind":"especial","url":"https://docs.google.com/presentation/d/e/2PACX-1vStiyKUQ014_p2fdJGn0IhVzATJzoVBKGki1hgE3AKrMQRqsiTuoPSscmpg92NYcw/htmlpresent"}]){
 const response=await fetch(source.url,{redirect:'manual',signal:AbortSignal.timeout(30000)});
 if(!response.ok){console.log('CALENDAR_SOURCE '+JSON.stringify({...source,status:response.status,location:response.headers.get('location')}));continue;}
 const html=await response.text();if(html.length>50000000)throw Error('Calendar source too large');
 const {document}=parseHTML(html);const title=document.querySelector('title')?.textContent||'';
 const slides=[...document.querySelectorAll('svg')].map((x,i)=>({index:i,viewBox:x.getAttribute('viewBox'),texts:[...x.querySelectorAll('text')].map(x=>x.textContent),html:x.outerHTML.length}));
 for(const item of document.querySelectorAll('script,style'))item.remove();
 const text=document.body?.textContent.replace(/\s+/g,' ').trim()||'';
 console.log('CALENDAR_SOURCE '+JSON.stringify({...source,status:response.status,title,htmlLength:html.length,text:text.slice(0,150000),slides,links:[...document.querySelectorAll('a[href]')].map(x=>({text:x.textContent,href:x.getAttribute('href')})).slice(0,30)}));
}
