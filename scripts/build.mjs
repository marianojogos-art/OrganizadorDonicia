import {readFile,writeFile,mkdir} from 'node:fs/promises';
await mkdir(new URL('../dist/',import.meta.url),{recursive:true});
for(const [name,scriptName,url] of [['index','app','/equipe/app.js'],['public','public','/public.js']]){
 const html=await readFile(new URL('../src/'+name+'.html',import.meta.url),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];new Function(script);
 await writeFile(new URL('../dist/'+name+'.html',import.meta.url),html.replace(/<script>[\s\S]*?<\/script>/,'<script src="'+url+'" defer></script>'));
 await writeFile(new URL('../dist/'+scriptName+'.js',import.meta.url),script);
}
await import('./build-sge-connector.mjs');
console.log('Build completo: portal público e área da equipe, JS separado para CSP.');
