#!/usr/bin/env node
/**
 * Maestro precheck: verify that the iOS Simulator is booted, the Seam app is
 * installed, the Maestro CLI exists, and Java 17 is reachable. Print friendly
 * remediation hints on failure.
 *
 * Run via `pnpm test:e2e:precheck` (or implicitly by `test:e2e*` scripts).
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const BUNDLE_ID = 'com.sugarshin.seam';
const JAVA_HOME_DEFAULT = '/opt/homebrew/opt/openjdk@17';

const fail = (msg) => {
  console.error(`\n❌  ${msg}\n`);
  process.exit(1);
};

const ok = (msg) => console.log(`✅  ${msg}`);

const tryExec = (cmd) => {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  } catch (err) {
    return null;
  }
};

// 1. maestro CLI
const maestroPath = tryExec('which maestro')?.trim();
if (!maestroPath) {
  fail(
    [
      'maestro CLI が見つかりません。',
      '  brew install mobile-dev-inc/tap/maestro',
      'またはガイド: https://docs.maestro.dev/get-started/quickstart',
    ].join('\n'),
  );
}
ok(`maestro CLI: ${maestroPath}`);

// 2. Java 17
const javaHome = process.env.JAVA_HOME ?? JAVA_HOME_DEFAULT;
if (!existsSync(`${javaHome}/bin/java`)) {
  fail(
    [
      `Java 17 が ${javaHome} に見つかりません。`,
      '  brew install openjdk@17',
      `または JAVA_HOME を 17 にセットしてください (現在: ${process.env.JAVA_HOME ?? 'unset'})`,
    ].join('\n'),
  );
}
ok(`Java 17: ${javaHome}`);

// 3. iOS Simulator booted
const bootedOut = tryExec('xcrun simctl list devices booted') ?? '';
if (!/\(Booted\)/.test(bootedOut)) {
  fail(
    [
      '起動中の iOS Simulator が見つかりません。',
      '  open -a Simulator',
      'または Xcode から iPhone デバイスを起動してください。',
    ].join('\n'),
  );
}
ok('iOS Simulator: booted');

// 4. Seam app installed
const containerOut = tryExec(`xcrun simctl get_app_container booted ${BUNDLE_ID} 2>/dev/null`);
if (!containerOut) {
  fail(
    [
      `Simulator に Seam (${BUNDLE_ID}) がインストールされていません。`,
      '  cd packages/app && pnpm ios',
      'で dev build を install してください。',
    ].join('\n'),
  );
}
ok(`Seam app installed: ${containerOut.trim()}`);

console.log('\n✨  precheck OK — Maestro を実行できます。\n');
