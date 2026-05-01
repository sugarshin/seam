# Seam

Personal clothing purchase decision app.

## Monorepo (pnpm workspaces)

```
packages/
  app/      # Expo iOS app (expo-sqlite + Drizzle)
  domain/   # Pure TypeScript domain logic (Vitest)
  shared/   # Zod schemas, types, constants
```

## Setup

```sh
pnpm install
```

### iPhone で動かす

3 つのパスのどれでも OK。簡単な順:

#### Path A: iOS Simulator (Mac だけで完結、最も速い)

```sh
cd packages/app
pnpm ios          # シミュレータが自動起動して app をビルド
```

初回は `pod install` 済みなのでそのまま動きます。すべての機能 (SQLite / 画像 / 通知) が動作。

#### Path B: 手元の iPhone を Mac に接続して Xcode から実機ビルド (Apple Developer Program $99/年 不要)

1. iPhone を USB で Mac に接続、信頼を許可
2. Xcode で workspace を開く:
   ```sh
   open packages/app/ios/Seam.xcworkspace
   ```
3. Xcode の左ペインで `Seam` ターゲットを選び、`Signing & Capabilities` タブを開く
4. **Team** を自分の Apple ID (個人) に設定 (なければ Xcode → Settings → Accounts で追加)
5. `Bundle Identifier` を一意なものに変更 (例: `com.sugarshin.seam.dev`)
6. 上部のデバイス選択で接続中の iPhone を選択 → ▶️ Run
7. iPhone 側で「設定 → 一般 → VPN とデバイス管理」から開発者プロファイルを信頼
8. 7 日後に再ビルドが必要 (個人 Apple ID の制限)

すべての機能 (SQLite / 画像 / 通知) が動作。

#### Path C: Expo Go アプリで QR 読み取り (App Store 経由、ビルド不要)

```sh
cd packages/app
pnpm start        # QR コードが表示される
```

iPhone で App Store から `Expo Go` をインストール、カメラで QR をスキャン。Mac と同じ Wi-Fi に接続している必要あり。

⚠ 注意: `expo-notifications` の一部機能は Expo Go では動作しない (ローカル通知の simulate のみ可能)。SQLite / 画像 / 基本 UI は動作。

#### Path D: EAS Internal Distribution (将来複数端末で使うとき)

Apple Developer Program ($99/年) 加入 + `eas build --profile preview` で ad-hoc IPA を作成。最大 100 デバイスに配布可能。

### Tests

```sh
pnpm test                     # run all package tests
pnpm --filter @seam/domain test:coverage
```

### Type check

```sh
pnpm typecheck
```

### DB schema migration

```sh
cd packages/app
pnpm drizzle:generate         # produces src/db/migrations/*.sql
```

Migrations are applied automatically on app start via `useMigrations` from `drizzle-orm/expo-sqlite/migrator`.

## Backup

- iOS auto Backup: `documentDirectory` is included in iCloud Backup by default
- JSON Export / Import: Settings → JSON エクスポート / インポート — share to Files
  App, iCloud Drive, etc. Import supports `merge` (skip PK conflicts) and
  `replace` (truncate first) modes.
- CSV Export: Settings → CSV エクスポート (アイテム) — produces a single CSV of
  the `items` table, suitable for spreadsheet import.
- Data reset: Settings → データ管理 → データを全削除 — wipes every table, the
  on-disk photo blobs, and the last-export tracker. Recommended to take a JSON
  export beforehand.

## Notifications

Settings end on a candidate's auction can be configured from the candidate
detail screen → 終了通知. Lead times of 10m / 30m / 1h / 3h / 1d are scheduled
via `expo-notifications` and persisted in the local `reminders` table so the
app can re-show the configured state. Permissions are requested on first use.

## E2E (Maestro)

Flow files live under `.maestro/`. They are not run in CI (no iOS simulator on
GitHub-hosted runners) — execute them locally against the dev build:

```sh
# 1) install Maestro
curl -Ls "https://get.maestro.mobile.dev" | bash

# 2) build & run the iOS app on a simulator (requires Xcode)
cd packages/app
pnpm prebuild
pnpm ios

# 3) run flows against the running app
maestro test .maestro/00_smoke.yaml
maestro test .maestro/10_create_item.yaml
maestro test .maestro/20_record_decision.yaml

# or run them all
maestro test .maestro/
```

Note: a full development build (not Expo Go) is required for SQLite +
notifications to work, which in turn requires an Apple Developer Program
membership ($99/yr) for device installation via EAS internal distribution.

## CI

`.github/workflows/test.yml` runs `pnpm -r typecheck` and `pnpm -r test` on
every push and PR to `main`. Maestro flows are skipped — see above.

## Architecture decisions

See `plan/20260426_seam-design-evaluation/plan.md` for the full evaluation report and architectural rationale.
