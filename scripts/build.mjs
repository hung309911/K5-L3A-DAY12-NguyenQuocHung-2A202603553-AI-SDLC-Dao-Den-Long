import { mkdirSync, cpSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = resolve(root, 'dist');
mkdirSync(resolve(out, 'src'), { recursive: true });
mkdirSync(resolve(out, 'vendor'), { recursive: true });
cpSync(resolve(root, 'web'), out, { recursive: true });
for (const name of ['game.mjs', 'validation.mjs', 'client.mjs']) copyFileSync(resolve(root, 'src', name), resolve(out, 'src', name));
copyFileSync(resolve(root, 'game.contract.json'), resolve(out, 'game.contract.json'));
for (const name of ['three.module.js', 'three.core.js']) copyFileSync(resolve(root, 'node_modules/three/build', name), resolve(out, 'vendor', name));
copyFileSync(resolve(root, 'node_modules/three/LICENSE'), resolve(out, 'vendor/THREE-LICENSE.txt'));
const config = JSON.parse(readFileSync(resolve(root, 'game.contract.json'), 'utf8'));
writeFileSync(resolve(out, 'build-info.json'), JSON.stringify({ version: 'phase-1', contract_version: config.contract_version }, null, 2) + '\n');
console.log('Built self-contained static game in dist/ (no runtime CDN).');
