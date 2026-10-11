import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const files=['mobile-sge/src/injected-runtime.js','mobile-sge/src/injected-organizer.js'];
const before=files.map(file=>readFileSync(file));
execFileSync(process.execPath,['mobile-sge/scripts/build-runtime.mjs'],{stdio:'inherit'});
for(const [index,file] of files.entries())if(!before[index].equals(readFileSync(file)))throw Error(`${file} estava desatualizado. Revise e registre o runtime regenerado.`);
console.log('Runtimes versionados correspondem às fontes.');
