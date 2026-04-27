import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const hasPlatform = args.some((a) => a === '--platform' || a === '-p');
const platformDefaults = hasPlatform ? [] : ['--platform', 'ios'];

const expo = spawnSync('npx', ['expo', 'prebuild', ...platformDefaults, ...args], {
  stdio: 'inherit',
  cwd: resolve(here, '..'),
});
if (expo.status !== 0) process.exit(expo.status ?? 1);

const strip = spawnSync('node', [resolve(here, 'stripPushEntitlement.mjs')], {
  stdio: 'inherit',
});
process.exit(strip.status ?? 0);
