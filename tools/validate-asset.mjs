import { mkdir, readFile, writeFile } from 'node:fs/promises';
import validator from 'gltf-validator';

const data = await readFile('public/assets/ziki.glb');
const report = await validator.validateBytes(new Uint8Array(data), { uri: 'ziki.glb', maxIssues: 1000 });
await mkdir('test-results', { recursive: true });
await writeFile('test-results/asset-validation.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Ziki GLB: ${report.issues.numErrors} errors, ${report.issues.numWarnings} warnings.`);
if (report.issues.numErrors) process.exitCode = 1;
