import {execFileSync} from 'node:child_process';
import {readFile,readdir,stat} from 'node:fs/promises';
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const secrets=[];
for(const name of ['.env','.env.local'])try{const env=await readFile(name,'utf8');for(const line of env.split('\n')){const match=line.match(/^([A-Z_][A-Z_0-9]*(?:KEY|TOKEN|SECRET))\s*=\s*(.*)$/);const value=match?.[2].trim().replace(/^(['"])(.*)\1$/,'$2');if(value&&value.length>=12)secrets.push(value);}}catch{}
async function addDist(path){try{for(const entry of await readdir(path,{withFileTypes:true})){const next=`${path}/${entry.name}`;if(entry.isDirectory())await addDist(next);else files.push(next);}}catch{}}
await addDist('dist');
const patterns=[/\bsk-[A-Za-z0-9_-]{24,}\b/,/\bgithub_pat_[A-Za-z0-9_]{30,}\b/,/\bgh[pousr]_[A-Za-z0-9]{30,}\b/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
const violations=[];
for(const file of new Set(files)){
 if(/(?:^|\/)\.env(?:\.|$)/.test(file)&&!file.endsWith('.env.example')){violations.push(file);continue;}
 try{if(!(await stat(file)).isFile())continue;const text=await readFile(file,'utf8');if(patterns.some(pattern=>pattern.test(text))||secrets.some(secret=>text.includes(secret)))violations.push(file);}catch{}
}
if(violations.length){console.error('Secret check failed; inspect these files (values withheld):\n'+violations.join('\n'));process.exitCode=1;}else console.log(`PASS: ${new Set(files).size} source/build files scanned; no credential values or private environment files found.`);
