import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const distDir = resolve('dist');
const tizenProjectDir = resolve('Debug/projects/immizen');

await rm(tizenProjectDir, { recursive: true, force: true });
await mkdir(tizenProjectDir, { recursive: true });
await cp(distDir, tizenProjectDir, { recursive: true });

console.log(`Synced ${distDir} to ${tizenProjectDir}`);
