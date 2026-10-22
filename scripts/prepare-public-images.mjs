import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
if(!process.env.CI||!process.env.RUNNER_TEMP||!process.env.PUBLIC_IMAGE_TOOLS)throw Error('Only run in isolated cloud CI');
const require=createRequire(join(process.env.PUBLIC_IMAGE_TOOLS,'loader.cjs'));
const sharp=require('sharp');
const source=await readFile(new URL('../src/public-assets/donicia-2026.png',import.meta.url));
const before=await sharp(source).metadata();
assert.equal(before.width,1976);assert.equal(before.height,796);
const output=join(process.env.RUNNER_TEMP,'donicia-public-images');await mkdir(output,{recursive:true});
for(const width of [480,960,1440]){
 const {data,info}=await sharp(source).resize({width,withoutEnlargement:true,kernel:'lanczos3'}).webp({quality:88,alphaQuality:100,effort:6,smartSubsample:true}).toBuffer({resolveWithObject:true});
 const hash=createHash('sha256').update(data).digest('hex').slice(0,12);
 const name='donicia-2026-'+width+'.'+hash+'.webp';
 await writeFile(join(output,name),data);
 const after=await sharp(data).metadata();
 assert.equal(after.width,width);
 assert.ok(Math.abs(after.width/after.height-before.width/before.height)<.02);
 assert.ok(data.length<source.length*.15,'Optimized image exceeds size budget');
 const metadata={name,bytes:data.length,width:after.width,height:after.height,alpha:after.hasAlpha,sourceBytes:source.length,sourceAlpha:before.hasAlpha,quality:88,hash};
 console.log('PUBLIC_IMAGE_META '+JSON.stringify(metadata));
 const b=data.toString('base64'),total=Math.ceil(b.length/24000);
 for(let i=0;i<total;i++)console.log('PUBLIC_IMAGE_BYTES '+JSON.stringify({name,part:i+1,total,base64:b.slice(i*24000,(i+1)*24000)}));
}
