import {build} from '../../node_modules/esbuild/lib/main.js';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const result=await build({entryPoints:[fileURLToPath(new URL('../src/browser-runtime.js',import.meta.url))],bundle:true,write:false,format:'iife',platform:'browser',target:['safari15','chrome100'],minify:true});
await writeFile(new URL('../src/injected-runtime.js',import.meta.url),'// Gerado por scripts/build-runtime.mjs; seletores compartilhados com o conector.\nexport default '+JSON.stringify(result.outputFiles[0].text+'\ntrue;')+';\n');
const organizer=await build({entryPoints:[fileURLToPath(new URL('../src/organizer-runtime.js',import.meta.url))],bundle:true,write:false,format:'iife',platform:'browser',target:['safari15','chrome100'],minify:true});
await writeFile(new URL('../src/injected-organizer.js',import.meta.url),'// Ponte nativa para o próprio site do Organizador.\nexport default '+JSON.stringify(organizer.outputFiles[0].text+'\ntrue;')+';\n');
console.log('Ponte do site e runtime SGE gerados.');
