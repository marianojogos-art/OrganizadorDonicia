import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {parseHTML} from 'linkedom';
const url='https://docs.google.com/presentation/d/e/2PACX-1vSfesD6aPQbTgK-tBDcBEu5bFId-0RWJQ4YZ37WbgjBdd53Nrq6p2u-tNpdFAO1ZA/htmlpresent';
const directory=join(process.env.RUNNER_TEMP,'formation-source');await mkdir(directory,{recursive:true});
const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Official calendar unavailable: '+response.status);
const html=await response.text(),{document}=parseHTML(html);
console.log('CALENDAR_TABLES '+JSON.stringify({tables:[...document.querySelectorAll('table')].map((table,index)=>({index,rows:[...table.querySelectorAll('tr')].map(row=>[...row.querySelectorAll('td,th')].map(x=>x.textContent))})),structure:[...document.body.children].map(x=>({tag:x.tagName,class:x.className,text:x.textContent.slice(0,120)})).slice(0,15)}));
const require=createRequire(join(process.env.PUBLIC_QA_PLAYWRIGHT_DIR,'loader.cjs'));
const {chromium}=require('playwright');const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:960}});
 const result=await page.goto(url,{waitUntil:'networkidle',timeout:60000});if(!result.ok())throw Error('Calendar render unavailable: '+result.status());
 await page.evaluate(()=>document.fonts.ready);
 console.log('CALENDAR_DOM '+JSON.stringify(await page.evaluate(()=>({title:document.title,body:document.body.innerText.slice(0,1000),classes:[...document.querySelectorAll('[class]')].slice(0,20).map(x=>({tag:x.tagName,class:x.className})),images:[...document.images].map(x=>({complete:x.complete,width:x.naturalWidth,height:x.naturalHeight})).slice(0,5)}))));
 await page.emulateMedia({media:'screen'});
 const rectangle=await page.locator('.slide-content').first().boundingBox();if(!rectangle||rectangle.width<100||rectangle.height<100)throw Error('Missing original slide geometry');
 console.log('CALENDAR_GEOMETRY '+JSON.stringify(rectangle));
 await page.addStyleTag({content:'@page{size:'+rectangle.width+'px '+rectangle.height+'px;margin:0} html,body{margin:0!important;padding:0!important} .slide{margin:0!important;padding:0!important;break-after:page!important} .offscreen-header{display:none!important}'});
 await page.pdf({path:join(directory,'formacao-ensino-fundamental-outubro-2026.pdf'),printBackground:true,preferCSSPageSize:true,width:'10in',height:'7.5in',margin:{top:0,bottom:0,left:0,right:0}});
}finally{await browser.close()}
const bytes=await readFile(join(directory,'formacao-ensino-fundamental-outubro-2026.pdf'));
if(bytes.length<20000)throw Error('Calendar export is blank');
if(bytes.length>8000000)throw Error('Calendar PDF too large');
const base64=bytes.toString('base64'),chunk=24000,total=Math.ceil(base64.length/chunk);
console.log('CALENDAR_PDF_INFO '+JSON.stringify({bytes:bytes.length,source:url}));
for(let i=0;i<total;i++)console.log('CALENDAR_PDF '+JSON.stringify({part:i+1,total,base64:base64.slice(i*chunk,(i+1)*chunk)}));
