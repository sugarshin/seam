import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const entitlementsPath = resolve(here, '..', 'ios', 'Seam', 'Seam.entitlements');

if (!existsSync(entitlementsPath)) {
  console.log(`[stripPushEntitlement] no entitlements at ${entitlementsPath}, skipping`);
  process.exit(0);
}

const before = await readFile(entitlementsPath, 'utf8');
const after = before.replace(
  /\s*<key>aps-environment<\/key>\s*<string>[^<]*<\/string>/g,
  '',
);

if (before === after) {
  console.log('[stripPushEntitlement] aps-environment not present, nothing to do');
  process.exit(0);
}

await writeFile(entitlementsPath, after);
console.log('[stripPushEntitlement] removed aps-environment from Seam.entitlements');
