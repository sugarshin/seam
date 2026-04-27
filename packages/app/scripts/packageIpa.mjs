import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const APP_NAME = 'Seam';

function findLatestArchive() {
  const archivesRoot = join(homedir(), 'Library/Developer/Xcode/Archives');
  if (!existsSync(archivesRoot)) {
    throw new Error(`Xcode archives directory not found: ${archivesRoot}`);
  }
  const candidates = [];
  for (const dateDir of readdirSync(archivesRoot)) {
    const datePath = join(archivesRoot, dateDir);
    if (!statSync(datePath).isDirectory()) continue;
    for (const archive of readdirSync(datePath)) {
      if (!archive.endsWith('.xcarchive')) continue;
      if (!archive.startsWith(APP_NAME)) continue;
      const archivePath = join(datePath, archive);
      candidates.push({
        path: archivePath,
        mtime: statSync(archivePath).mtimeMs,
      });
    }
  }
  if (candidates.length === 0) {
    throw new Error(
      `No ${APP_NAME} .xcarchive found. Run Product > Archive in Xcode first.`,
    );
  }
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0].path;
}

const archive = process.argv[2] ?? findLatestArchive();
console.log(`[packageIpa] using archive: ${archive}`);

const appPath = join(archive, 'Products/Applications', `${APP_NAME}.app`);
if (!existsSync(appPath)) {
  throw new Error(`${APP_NAME}.app not found at ${appPath}`);
}

const work = mkdtempSync(join(tmpdir(), 'seam-ipa-'));
const payloadDir = join(work, 'Payload');
mkdirSync(payloadDir);

const copy = spawnSync(
  'ditto',
  ['--noextattr', '--noqtn', appPath, join(payloadDir, `${APP_NAME}.app`)],
  { stdio: 'inherit' },
);
if (copy.status !== 0) {
  throw new Error(`ditto copy exited with status ${copy.status}`);
}

const ipaPath = join(homedir(), 'Downloads', `${APP_NAME}.ipa`);
if (existsSync(ipaPath)) {
  rmSync(ipaPath);
  console.log(`[packageIpa] removed existing ${ipaPath}`);
}

const zip = spawnSync(
  'ditto',
  ['-c', '-k', '--keepParent', '--norsrc', 'Payload', ipaPath],
  {
    cwd: work,
    stdio: 'inherit',
    env: { ...process.env, COPYFILE_DISABLE: '1' },
  },
);
if (zip.status !== 0) {
  throw new Error(`ditto exited with status ${zip.status}`);
}

rmSync(work, { recursive: true, force: true });
console.log(`[packageIpa] ipa ready: ${ipaPath}`);
