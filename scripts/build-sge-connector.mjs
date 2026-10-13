import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),output=new URL('dist/sge-connector/',root);
await mkdir(output,{recursive:true});
const manifest=JSON.parse(await readFile(new URL('sge-connector/manifest.json',root),'utf8'));
const icons=Object.values(manifest.icons||{});
await mkdir(new URL('icons/',output),{recursive:true});
const names=['manifest.json','background.mjs','bridge.js',...icons];
for(const name of names.filter(name=>name!=='background.mjs'))await copyFile(new URL('sge-connector/'+name,root),new URL(name,output));
await build({entryPoints:[fileURLToPath(new URL('sge-connector/background.mjs',root))],bundle:true,format:'esm',platform:'browser',outfile:fileURLToPath(new URL('background.mjs',output)),target:'chrome120'});
await build({entryPoints:[fileURLToPath(new URL('sge-connector/page-runtime.mjs',root))],bundle:true,format:'iife',platform:'browser',outfile:fileURLToPath(new URL('page-runtime.js',output)),target:'chrome120'});
const storeBackground=(await build({entryPoints:[fileURLToPath(new URL('sge-connector/background.mjs',root))],bundle:true,write:false,format:'esm',platform:'browser',target:'chrome120',define:{DONICIA_STORE_BUILD:'true'},minifySyntax:true})).outputFiles[0].text;
// Store-only ZIP, keeping installation independent of a Node or shell utility.
const crc32=buffer=>{let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0};
const storeManifest={...manifest,content_scripts:manifest.content_scripts.map(script=>({...script,matches:script.matches.filter(url=>url.startsWith('https://organizadordonicia.carijo.workers.dev/'))}))};
// O ZIP é somente produção; pasta descompactada conserva suporte à demonstração.
const local=[],central=[];let offset=0;
for(const name of [...names,'page-runtime.js']){
 const filename=Buffer.from(name),body=name==='manifest.json'?Buffer.from(JSON.stringify(storeManifest,null,2)+'\n'):name==='background.mjs'?Buffer.from(storeBackground):await readFile(new URL(name,output)),crc=crc32(body),header=Buffer.alloc(30);
 header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(body.length,18);header.writeUInt32LE(body.length,22);header.writeUInt16LE(filename.length,26);
 const entry=Buffer.concat([header,filename,body]);local.push(entry);
 const directory=Buffer.alloc(46);directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(33,14);directory.writeUInt32LE(crc,16);directory.writeUInt32LE(body.length,20);directory.writeUInt32LE(body.length,24);directory.writeUInt16LE(filename.length,28);directory.writeUInt32LE(offset,42);
 central.push(Buffer.concat([directory,filename]));offset+=entry.length;
}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(local.length,8);end.writeUInt16LE(local.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
await writeFile(new URL('dist/sge-connector.zip',root),Buffer.concat([...local,directory,end]));
