import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
await mkdir(new URL('../dist/',import.meta.url),{recursive:true});
for(const [name,scriptName,url] of [['index','app','/equipe/app.js'],['public','public','/public.js'],['secretariat','secretariat','/equipe/secretariat.js'],['secretariat-admin','secretariat-admin','/equipe/secretariat-admin.js']]){
 const html=await readFile(new URL('../src/'+name+'.html',import.meta.url),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];new Function(script);
 await writeFile(new URL('../dist/'+name+'.html',import.meta.url),html.replace(/<script>[\s\S]*?<\/script>/,'<script src="'+url+'" defer></script>'));
 await writeFile(new URL('../dist/'+scriptName+'.js',import.meta.url),script);
}
await mkdir(new URL('../dist/public-assets/',import.meta.url),{recursive:true});
for(const name of ['logo.jpg','donicia-2026.png','donicia-2026-480.c67023d134b5.webp','donicia-2026-960.707952f5d28c.webp','donicia-2026-1440.f4d9f138aee3.webp','feedback.css','feedback.js','site-metrics.js','assistant.js','assistant.css'])await copyFile(new URL('../src/public-assets/'+name,import.meta.url),new URL('../dist/public-assets/'+name,import.meta.url));
await copyFile(new URL('../src/staff-assets/formacao-outubro-2026.csv',import.meta.url),new URL('../dist/formation-outubro-2026.csv',import.meta.url));
await import('./build-sge-connector.mjs');
console.log('Build completo: portal público e área da equipe, JS separado para CSP.');
