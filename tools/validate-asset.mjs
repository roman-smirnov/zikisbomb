import {mkdir,readFile,writeFile} from 'node:fs/promises';
import validator from 'gltf-validator';

const data = await readFile('public/assets/models/c4-2k.glb');
const report = await validator.validateBytes(new Uint8Array(data), {uri:'c4-2k.glb',maxIssues:1000});
await mkdir('test-results', {recursive:true});
await writeFile('test-results/asset-validation.json', JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({errors:report.issues.numErrors,warnings:report.issues.numWarnings,infos:report.issues.numInfos,messages:report.issues.messages.filter(m=>m.severity<2)},null,2));
if (report.issues.numErrors) process.exitCode = 1;
