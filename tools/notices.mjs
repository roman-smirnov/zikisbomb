import { readFile, writeFile } from 'node:fs/promises';

const packages = [
  ['@babylonjs/core', ['license.md', 'NOTICE.md']],
  ['@babylonjs/loaders', ['license.md']],
  ['@fontsource/barlow-condensed', ['LICENSE']],
  ['@fontsource/nunito', ['LICENSE']],
  ['@fontsource/jetbrains-mono', ['LICENSE']],
];
const texts = ['Defuse the Bomb — third-party runtime notices'];
for (const [name, filenames] of packages) {
  const folder = new URL(`../node_modules/${name}/`, import.meta.url);
  const { version } = JSON.parse(await readFile(new URL('package.json', folder), 'utf8'));
  for (const file of filenames) {
    const notice = await readFile(new URL(file, folder), 'utf8');
    texts.push(`${name} ${version} — ${file}\n\n${notice.trim()}`);
  }
}
const separator = '\n\n----------------------------------------------------------------\n\n';
await writeFile(new URL('../dist/THIRD_PARTY_NOTICES.txt', import.meta.url), texts.join(separator) + '\n');
