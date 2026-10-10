import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];new Function(script);
await mkdir(new URL('../dist/',import.meta.url),{recursive:true});
await writeFile(new URL('../dist/index.html',import.meta.url),html.replace(/<script>[\s\S]*?<\/script>/,'<script src="/app.js" defer></script>'));
await writeFile(new URL('../dist/app.js',import.meta.url),script);
await import('./build-sge-connector.mjs');
console.log('Build completo: visual preservado, JS separado para CSP.');
