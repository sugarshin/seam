# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Seam is a personal iOS app (Expo + React Native) for deciding whether to buy
vintage clothing by comparing candidate items against owned items by
measurement, price, condition, and duplication risk. Local-first; no auth; no
App Store distribution. Full requirements live in `plan/initial-plan.md`.

## Monorepo layout

pnpm workspaces. Three packages, all `private`:

- `packages/app/` — Expo SDK 55 iOS app. Expo Router (`app/` dir), expo-sqlite,
  Drizzle ORM, Zustand, react-hook-form, expo-notifications.
- `packages/domain/` — pure-TS domain logic (`type: "module"`). No RN / Expo
  imports. Subpath exports: `compare`, `scoring`, `extraction`, `pricing`,
  `wear`, `units`, `rules`. Tested with Vitest.
- `packages/shared/` — Zod schemas, TS types, and constants (Japanese
  display labels like `CATEGORY_LABEL` live as `*_LABEL` exports under
  `constants/`). Imported by both `app` and `domain`.

Workspace path aliases (resolved by `tsconfig` paths and Metro):

- `@seam/shared`, `@seam/shared/*`
- `@seam/domain`, `@seam/domain/*`
- `@/*` → `packages/app/src/*` (app only)

`@seam/domain` and `@seam/shared` resolve directly to source (`./src/index.ts`)
— they are not built before consumption. Don't add a `dist`-based build step
unless you also update the package `exports`.

## Commands

Run from the repo root unless noted. Cross-package scripts use `pnpm -r`.

```sh
pnpm install              # install all workspaces
pnpm typecheck            # pnpm -r typecheck (each package: tsc --noEmit)
pnpm test                 # pnpm -r test (vitest run in each package)
pnpm lint                 # pnpm -r lint (only @seam/app has eslint)
pnpm build                # pnpm -r build (no-op today; no package implements build)
pnpm format               # biome format --write . (config: biome.json)
pnpm format:check         # biome format . — used by CI
```

Biome is configured for formatting only (`linter.enabled: false`); ESLint is
still the linter for `@seam/app`. Biome's `files.includes` excludes
`packages/app/src/db/migrations/**`, native `ios/`/`android/` dirs, and build
output.

Single-package and single-test:

```sh
pnpm --filter @seam/domain test
pnpm --filter @seam/domain test:watch
pnpm --filter @seam/domain test:coverage
pnpm --filter @seam/app typecheck
pnpm --filter @seam/domain vitest run src/scoring/calculateSizeScore.test.ts
pnpm --filter @seam/domain vitest run -t "calculateSizeScore"
```

App-only (must `cd packages/app` for Expo CLI):

```sh
cd packages/app
pnpm ios                  # build & run on iOS simulator (requires Xcode)
pnpm start                # Metro + QR for Expo Go (limited features)
pnpm prebuild             # regenerate native ios/ project
pnpm drizzle:generate     # emit src/db/migrations/*.sql + migrations.js
pnpm drizzle:check        # validate migration history
```

E2E (Maestro): see the **E2E (Maestro)** section below. ローカル
(`pnpm test:e2e` 等) と GitHub Actions (`.github/workflows/e2e-ios.yml`,
macos-26 runner) の両方で実行可能。

CI (`.github/workflows/test.yml`) runs, in order, `pnpm format:check`,
`pnpm -r lint`, `pnpm -r typecheck`, `pnpm -r test`, then a Metro bundle build
(`expo export --platform ios`) on every push / PR to `main`. Maestro はコスト
管理のため `e2e-ios.yml` 側に分離し、`workflow_dispatch` または PR への `e2e`
ラベル付与でのみ実行する (PUBLIC repo なので macos runner も無料)。

`.github/workflows/release.yml` is a separate workflow that triggers on `v*`
tags (or `workflow_dispatch`). On macOS it runs `expo prebuild`, strips the
push entitlement, and produces an **unsigned** IPA via `xcodebuild archive`
(`CODE_SIGNING_ALLOWED=NO`); the IPA is attached to a GitHub Release, and
`.github/scripts/update-source.mjs` rewrites `docs/source.json` (the
AltStore-style source manifest served from GitHub Pages). The tag version
must match `packages/app/app.json`'s `expo.version`, otherwise the workflow
fails fast.

## Database & migrations

- Drizzle schema: `packages/app/src/db/schema.ts` (single source of truth for
  every table). DB client: `packages/app/src/db/client.ts` (`db`, `sqlite`,
  `schema` re-export). Drizzle config: `packages/app/drizzle.config.ts`
  (`dialect: 'sqlite'`, `driver: 'expo'`).
- Migrations live in `packages/app/src/db/migrations/`. **Always run
  `pnpm drizzle:generate` after editing `schema.ts`** — it produces both the
  `.sql` files and the `migrations.js` index that the app imports.
- Migrations are applied at app start via `useDbMigrations()`
  (`packages/app/src/db/migrate.ts`) called in `app/_layout.tsx`. The
  `.sql` files are inlined into the JS bundle by the
  `babel-plugin-inline-import` plugin configured in `babel.config.js` — this
  is why migrations work in production builds without filesystem access. Do
  not remove that plugin.
- Local SQLite files (`*.db`, `*.sqlite`) are gitignored.

## Domain layer rules

- `packages/domain/` must stay free of React Native, Expo, and SQLite
  imports. It is pure TS and is consumed by both the app and unit tests.
- Per `plan/initial-plan.md` and `tsconfig.base.json`: TypeScript strict mode
  is enforced (`noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`,
  `noImplicitReturns`). Do not introduce `any`.
- All scoring / comparison / extraction / pricing logic must be pure
  functions. UI/repository code consumes domain functions; it does not
  re-implement them. New scoring or comparison logic belongs under
  `packages/domain/src/<area>/` with a co-located `*.test.ts`.

## Repository layer

`packages/app/src/repositories/` — one repository per table, all re-exported
from `repositories/index.ts`. Cross-table workflows (creating an item with
measurements + photos + tags + candidate info; converting candidate → owned;
sold/unsold transitions) live in `repositories/itemFlow.ts` and are the
preferred entry points from screens / forms — don't compose multiple
repositories ad hoc in UI code.

## Routing & UI

- Expo Router with file-based routes under `packages/app/app/`:
  - `(tabs)/` — bottom tab screens (Home, Closet, Wishlist, Compare, Stats,
    Settings).
  - `item/[id].tsx`, `item/new.tsx` — owned-item CRUD screens.
  - `candidate/[id].tsx`, `candidate/new.tsx` — candidate CRUD screens.
  - `settings/` — sub-screens (measurement-rules, brand-guides, data-reset).
- Typed routes are enabled (`app.json` → `experiments.typedRoutes`).
- Reusable UI lives in `packages/app/src/components/` and is re-exported from
  `components/index.ts`. Theme tokens (`font`, `space`, `useThemeColors`,
  etc.) come from `packages/app/src/theme/`. Prefer these over hard-coded
  styles.
- Forms use react-hook-form + Zod resolvers; the canonical example is
  `src/forms/ItemForm.tsx`.

## Notifications, photos, backup

- `src/notifications/` wraps `expo-notifications`. Foreground handler is
  configured once at module load from `app/_layout.tsx`
  (`configureNotificationHandler()`). Reminders are persisted in the
  `reminders` table so the configured state can be restored.
- `src/photos/savePhoto.ts` copies picked images into the app's
  document directory and stores only the relative path in SQLite (the
  `photos.relative_path` column). Don't store absolute URIs — they break
  across app reinstalls and iOS container renames.
- `src/backup/` — JSON export/import (Zod-validated, supports `merge` and
  `replace` modes), CSV export of `items`, and full data reset. The
  data-reset path also wipes on-disk photo blobs and the last-export tracker.

## E2E (Maestro)

ローカル開発と GitHub Actions (`macos-26` runner) の両方で動く。**両方で回せる
ようにすることが第一級要件** — Linux CI で simulator が動かない以上、ローカル
or macos runner 上の Maestro が唯一の自動回帰検出経路。

- ローカル: 開発中の高速フィードバック (`pnpm test:e2e[:smoke|:core|:regression]`)
- CI: `.github/workflows/e2e-ios.yml` が `workflow_dispatch` または PR への
  `e2e` ラベル付与でのみ起動。`macos-26` + Xcode 26.2 で `expo prebuild` →
  `xcodebuild build` (Debug / iphonesimulator) → simulator boot → Metro 起動
  → `maestro test --exclude-tags=reset .maestro/` を実行。失敗時は screen
  recording (mp4)、JUnit report、Metro log、`~/.maestro` debug dir、xcodebuild
  log を artifact として upload する。
- PUBLIC repo のため macos runner も**完全無料**。pnpm store / CocoaPods /
  DerivedData / `~/.maestro` をキャッシュして warm run は 13〜15 分目安。

### Prerequisites

- Java 17 (`brew install openjdk@17`). The npm scripts inject `JAVA_HOME`
  inline, so a one-off shell export isn't needed.
- Maestro CLI 2.5+ (`brew install mobile-dev-inc/tap/maestro`).
- Xcode + iOS Simulator booted, and `pnpm --filter @seam/app ios` once to
  install Seam onto the booted device.
- Metro running so the dev build picks up code changes (`pnpm --filter @seam/app start`
  if not already up — `pnpm ios` starts it for you).

The `pnpm test:e2e:precheck` script verifies all of the above and prints
remediation hints; every `test:e2e*` script runs it implicitly.

### Scripts

```sh
pnpm test:e2e              # all flows except `reset` (default loop)
pnpm test:e2e:smoke        # tag: smoke — boots app + visits every tab (~5s)
pnpm test:e2e:core         # tag: core  — P0 lifecycles + Buy decision (~2 min)
pnpm test:e2e:regression   # tag: regression — P0+P1+P2 (~5 min)
pnpm test:e2e:reset        # CUJ-026: UI 経由でデータ全削除 (opt-in、デフォルトから除外)
pnpm test:e2e:hierarchy    # 現在の Simulator UI ツリーを stdout に dump
```

### Flow layout

`.maestro/` の命名規則:

- `00_smoke.yaml` — 起動 + 全タブ可視
- `05_reset.yaml` — UI 経由 DB wipe (`tag: reset`)
- `10_*` — Item ライフサイクル (CRUD, wear log)
- `15_*` — Item 売却フロー
- `20_*` — Candidate ライフサイクル (CRUD)
- `25_*` / `26_*` — 決定 (Buy / Watch / Skip / Lost)
- `30_*` — 横断的 read-only 画面 (Compare / Stats)
- `40_*` — Settings サブ画面 (個人ルール / ブランドガイド)
- `50_*` — Closet フィルタ (P2、視覚確認補足、regression 外)

`.maestro/_helpers/` 配下のサブフローは `_` 接頭辞で自動探索の対象外。
`runFlow: '<helper>.yaml'` で呼び、`env:` でパラメータを渡す。

### Selector policy

1. **`id:` (testID) 最優先**。タブ / FAB / フォーム / Picker / Modal アクション /
   業務動詞ボタン / 動的リスト行はすべて testID を必須とし、文言変更で flow が
   黙って通る/落ちる事故を防ぐ。
2. testID は `packages/app/src/utils/testIds.ts` に集約。flow ファイル内の
   `id: "..."` 文字列は **手書きでこの定数と同期**させる (Maestro 側に import
   機構が無い)。
3. `text:` は assert 専用 — Stack header の英字 title (`Closet` / `Wishlist`)
   や日本語固定見出しに使う。tap には基本使わない。
4. assertVisible で 部分一致したい場合は明示的に regex 形式 (`'.*${name}.*'`)
   を書く。Maestro v2.5 の `text:` は accessibilityText に対して期待どおり
   substring match しないことがある。

### DB state policy

- flow 間で DB を自動 reset しない (累積を許容)。各 flow は固有のフィクスチャ
  名 (`E_Item_Lifecycle`, `E_Buy_Decision` など) を使うので衝突しない。
- 完全クリーンが欲しいときだけ `pnpm test:e2e:reset` で UI 経由 wipe を行う。
  `tag: reset` で default 実行から除外している。

### Known constraints (E2E から除外している領域)

- **JSON / CSV エクスポート** — iOS の Share Sheet を Maestro で操作できない。
- **JSON インポート** — `expo-document-picker` のシステムダイアログが操作不能。
- **OS 通知パーミッション** — Simulator 上の `expo-notifications` 動作が不安定。
- **写真追加** — Photo Library / Camera のシステム UI 経由は省略。

これらは repository / domain の unit test (vitest) でカバーする。

### Self-debug recipe

flow が落ちたら以下を順に試す:

```sh
# 1. 最新の失敗成果物
ls -t ~/.maestro/tests | head -1

# 2. screenshot-❌-*.png を Read tool で確認 (実際の画面状態)

# 3. UI tree を dump して selector の真の id/text/accessibilityText を確認
pnpm test:e2e:hierarchy > /tmp/h.txt
grep -nE '"(text|accessibilityText)"' /tmp/h.txt | grep -v '""'

# 4. 修正方針:
#    - testID が見つからない → アプリ側で testID 付与漏れ → testIds.ts 拡張
#    - text 検索が失敗 → accessibilityText の完全形を確認 → '.*X.*' regex
#    - submit が見えない → scrollUntilVisible (visibilityPercentage: 50)
#    - 入力後 modal が誤 open → tapOn point: '50%, 18%' で blur (※ Modal 内では
#      backdrop tap になるので注意)
```

## E2E 開発ワークフロー (Claude 運用)

新機能 / UI 変更時は **対応する testID と flow を同 PR に含める**。これは
Linux CI で simulator が動かない以上、Claude のローカル E2E 実行が唯一の自動
回帰検出経路だから。

### 新画面・新コンポーネント追加時

1. 機能を実装。
2. 関連 testID を `packages/app/src/utils/testIds.ts` に追加 (命名:
   `scope:action:dynamicId`、kebab-case)。
3. UI 要素に testID prop を渡す:
   - Button / TextField / Picker / Chip / ItemCard / SegmentedControl /
     PhotoPicker / EmptyState / StatCard はすべて `testID?: string` を受け取る
   - Modal の root には固定 testID (`modal:wear-log` 等) を直書き
   - Picker の trigger 側に `picker:foo` を渡すと、option 行は自動で
     `option:foo:value` に派生
4. 既存 flow に組み込めるなら organic に追加。新 CUJ なら新 flow を
   `<NN>_*.yaml` で作る (NN は既存範囲 10/20/30/40/50 の空き番)。
5. 必要に応じて `.maestro/_helpers/*.yaml` に共通化。
6. plan の CUJ 表 (`/Users/shingosato/.claude/plans/cuj-e2e-test-parallel-wreath.md`)
   と本 CLAUDE.md の表を更新。

### 動作確認の段階

| 変更の規模 | 走らせる flow |
|---|---|
| typo / コメント / ドキュメント | (なし or `pnpm test:e2e:smoke`) |
| 新機能 / UI 変更 / ItemForm 修正 | `pnpm test:e2e:smoke` → `:core` → `:regression` |
| リファクタ / 依存更新 | `pnpm test:e2e:regression` 必須 |
| Maestro flow 自体の変更 | 個別 flow を `maestro test .maestro/<name>.yaml` |

### ガッチャ早見表

- **destructive な Alert button のラベルは `削除する` に統一**。背景に `削除`
  テキスト (Pressable) があると Maestro が後ろを tap してしまう。
- **ItemCard 等のリスト行に `accessibilityLabel` を付けない**。子の `<Text>`
  が accessibility tree から消えて assertVisible が effective に動かなくなる。
- **ItemForm の submit ボタンは ScrollView 末尾**。`tapOn id:'btn:submit'` の
  前に必ず `scrollUntilVisible visibilityPercentage:50` を入れる。
- **Stack push 後は tab bar が見えない**。`goto_settings` 等を再呼び出しする
  前に `_helpers/launch.yaml` で cold restart する。
- **Decision/Sale/WearLog Modal 内では `point: '50%, 18%'` を絶対に tap しない**。
  Modal 背景 (backdrop) を tap してしまい cancel になる。

## Conventions

- Never use `any`. Prefer Zod-inferred types from `@seam/shared/schemas` for
  anything crossing the persistence or import/export boundary.
- Keep UI and domain logic separate: screens call repositories and domain
  functions, never raw `db` queries from inside a component.
- Japanese is the user-facing language; display labels live as `*_LABEL`
  constants in `packages/shared/src/constants/` (e.g. `CATEGORY_LABEL`,
  `ITEM_STATUS_LABEL`). Code identifiers stay in English.
- When adding a new table: update `schema.ts`, run `pnpm drizzle:generate`,
  add a Zod schema in `packages/shared/src/schemas/`, add a repository in
  `packages/app/src/repositories/`, and extend the JSON export/import in
  `src/backup/` if the data should round-trip.
