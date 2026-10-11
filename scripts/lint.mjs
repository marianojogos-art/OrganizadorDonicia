import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(f=>/\.(mjs|cjs|js)$/.test(f));
for(const file of files){
 if(file==='mobile-sge/App.js')transformSync(readFileSync(file,'utf8'),{loader:'jsx'});
 else execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
}
console.log(`Sintaxe validada em ${files.length} arquivos (incluindo JSX).`);
