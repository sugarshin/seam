---
name: e2e-maestro
description: Seam の Maestro E2E テストの実行・作成・デバッグ手順。新機能や UI を追加/変更したとき (testID の付与、flow の追加、リグレッション確認)、Maestro flow が落ちたときの原因切り分け、`.maestro/` 配下の編集時に使う。「E2E」「Maestro」「flow が落ちる」「testID」「リグレッション確認」等で起動。
user-invocable: true
---

# Maestro E2E skill

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

## 前提条件

- Java 17 (`brew install openjdk@17`)。npm scripts が `JAVA_HOME` をインラインで
  注入するので、シェルでの export は不要。
- Maestro CLI 2.5+ (`brew install mobile-dev-inc/tap/maestro`)。
- Xcode + iOS Simulator が起動済みで、`pnpm --filter @seam/app ios` を一度実行して
  Seam がインストールされていること。
- コード変更を dev build に反映するため Metro が起動していること
  (`pnpm --filter @seam/app start`。`pnpm ios` を使えば自動で起動する)。

`pnpm test:e2e:precheck` が上記すべてを検証して不足時の対処を表示する。
`test:e2e*` スクリプトはすべて暗黙的にこれを実行する。

## スクリプト

```sh
pnpm test:e2e              # reset を除く全 flow (デフォルト)
pnpm test:e2e:smoke        # tag: smoke — 起動 + 全タブ巡回 (~5s)
pnpm test:e2e:core         # tag: core  — P0 ライフサイクル + Buy 決定 (~2 min)
pnpm test:e2e:regression   # tag: regression — P0+P1+P2 (~5 min)
pnpm test:e2e:reset        # CUJ-026: UI 経由でデータ全削除 (opt-in、デフォルト除外)
pnpm test:e2e:hierarchy    # 現在の Simulator UI ツリーを stdout に dump
```

## flow の配置

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

## Selector policy

1. **`id:` (testID) 最優先**。タブ / FAB / フォーム / Picker / Modal アクション /
   業務動詞ボタン / 動的リスト行はすべて testID を必須とし、文言変更で flow が
   黙って通る/落ちる事故を防ぐ。
2. testID は `packages/app/src/utils/testIds.ts` に集約。flow ファイル内の
   `id: "..."` 文字列は **手書きでこの定数と同期**させる (Maestro 側に import
   機構が無い)。
3. `text:` は assert 専用 — Stack header の英字 title (`Closet` / `Wishlist`)
   や日本語固定見出しに使う。tap には基本使わない。
4. assertVisible で部分一致したい場合は明示的に regex 形式 (`'.*${name}.*'`)
   を書く。Maestro v2.5 の `text:` は accessibilityText に対して期待どおり
   substring match しないことがある。

## DB state policy

- flow 間で DB を自動 reset しない (累積を許容)。各 flow は固有のフィクスチャ
  名 (`E_Item_Lifecycle`, `E_Buy_Decision` など) を使うので衝突しない。
- 完全クリーンが欲しいときだけ `pnpm test:e2e:reset` で UI 経由 wipe を行う。
  `tag: reset` で default 実行から除外している。

## E2E から除外している領域

- **JSON / CSV エクスポート** — iOS の Share Sheet を Maestro で操作できない。
- **JSON インポート** — `expo-document-picker` のシステムダイアログが操作不能。
- **OS 通知パーミッション** — Simulator 上の `expo-notifications` 動作が不安定。
- **写真追加** — Photo Library / Camera のシステム UI 経由は省略。

これらは repository / domain の unit test (vitest) でカバーする。

## 新画面・新コンポーネント追加時のワークフロー

新機能 / UI 変更時は **対応する testID と flow を同 PR に含める**。

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
   を更新。

## 変更規模ごとの実行範囲

| 変更の規模 | 走らせる flow |
|---|---|
| typo / コメント / ドキュメント | (なし or `pnpm test:e2e:smoke`) |
| 新機能 / UI 変更 / ItemForm 修正 | `pnpm test:e2e:smoke` → `:core` → `:regression` |
| リファクタ / 依存更新 | `pnpm test:e2e:regression` 必須 |
| Maestro flow 自体の変更 | 個別 flow を `maestro test .maestro/<name>.yaml` |

## ガッチャ早見表

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

## 失敗時のセルフデバッグ手順

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
