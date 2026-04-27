import fs from 'node:fs';
import path from 'node:path';

const SOURCE_PATH = path.resolve('docs/source.json');
const REPO = process.env.REPO;
const TAG = process.env.TAG;
const VERSION = process.env.VERSION;
const IPA_SIZE = Number(process.env.IPA_SIZE);
const CHANGES = process.env.CHANGES || '';

if (!REPO || !TAG || !VERSION || !Number.isFinite(IPA_SIZE)) {
  throw new Error(
    `missing env: REPO=${REPO} TAG=${TAG} VERSION=${VERSION} IPA_SIZE=${IPA_SIZE}`,
  );
}

const downloadURL = `https://github.com/${REPO}/releases/download/${TAG}/Seam-${TAG}.ipa`;
const versionDate = new Date().toISOString().slice(0, 10);
const [owner, name] = REPO.split('/');
const sourceURL = `https://${owner}.github.io/${name}/source.json`;

const source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
const app = source.apps?.[0];
if (!app) throw new Error('apps[0] not found in source.json');

const newVersion = {
  version: VERSION,
  date: versionDate,
  localizedDescription: CHANGES.trim() || `Release ${TAG}`,
  downloadURL,
  size: IPA_SIZE,
  minOSVersion: '15.1',
};

app.versions = [
  newVersion,
  ...(app.versions || []).filter((v) => v.version !== VERSION),
];

app.version = newVersion.version;
app.versionDate = newVersion.date;
app.versionDescription = newVersion.localizedDescription;
app.downloadURL = newVersion.downloadURL;
app.size = newVersion.size;

source.sourceURL = sourceURL;

fs.writeFileSync(SOURCE_PATH, JSON.stringify(source, null, 2) + '\n');
console.log(`[update-source] ${VERSION} -> ${downloadURL} (${IPA_SIZE} bytes)`);
