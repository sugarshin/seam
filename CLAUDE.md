# CLAUDE.md

Claude Code が毎セッション読み込む常時ルール。ここには「コードを読めば分かること」
は書かない。たまにしか要らない手順は `.claude/skills/` に置く。

## プロジェクト

Seam は古着の購入判断を支援する個人用 iOS アプリ (Expo + React Native)。候補品を
手持ち品と採寸 / 価格 / コンディション / 重複リスクで比較する。ローカル完結・認証
なし・App Store 配布なし。要件の全体像は `plan/initial-plan.md`。

## 構成

pnpm workspaces、3 パッケージすべて `private`。

| パッケージ | 中身 |
|---|---|
| `packages/app` | Expo SDK 55 の iOS アプリ。Expo Router / expo-sqlite / Drizzle ORM / react-hook-form |
| `packages/domain` | 純 TS のドメインロジック (`type: "module"`)。subpath exports: `compare` `scoring` `extraction` `pricing` `wear` `units` `rules` |
| `packages/shared` | Zod スキーマ・型・定数 (`schemas` / `types` / `constants`)。`app` と `domain` の両方から参照される |

パスエイリアス (tsconfig paths と Metro の両方で解決): `@seam/shared`,
`@seam/shared/*`, `@seam/domain`, `@seam/domain/*`, `@/*` → `packages/app/src/*`
(app のみ)。

**`@seam/domain` / `@seam/shared` はソース (`./src/index.ts`) を直接解決する。**
ビルド済み成果物を挟んでいないので、`dist` ベースの build step を足すなら package
の `exports` も同時に直すこと。

## コマンド

リポジトリルートで実行する。横断スクリプトは `pnpm -r`。

```sh
pnpm typecheck            # 各パッケージ tsc --noEmit
pnpm test                 # 各パッケージ vitest run
pnpm lint                 # eslint (@seam/app のみ)
pnpm format               # biome format --write .
pnpm format:check         # CI と同じ整形チェック
```

単一パッケージ / 単一テスト:

```sh
pnpm --filter @seam/domain test
pnpm --filter @seam/domain test:watch
pnpm --filter @seam/domain vitest run src/scoring/calculateSizeScore.test.ts
pnpm --filter @seam/domain vitest run -t "calculateSizeScore"
pnpm --filter @seam/app typecheck
```

Expo CLI 系は `packages/app` に `cd` してから:

```sh
pnpm ios                  # iOS Simulator でビルド & 起動 (要 Xcode)
pnpm start                # Metro 起動
pnpm prebuild             # native ios/ を再生成 (scripts/prebuild.mjs)
pnpm drizzle:generate     # src/db/migrations/*.sql + migrations.js を生成
pnpm drizzle:check        # マイグレーション履歴の検証
```

Biome は**整形専用** (`linter.enabled: false`)。lint は引き続き ESLint
(`@seam/app` のみ)。`pnpm build` は全パッケージ未実装の no-op。

E2E (Maestro) は `.claude/skills/e2e-maestro/` を参照。**新機能 / UI 変更を入れる
ときは、対応する testID と flow を同じ PR に含めること。** Linux CI では
simulator が動かないため、ローカル or macos runner の Maestro が唯一の自動回帰
検出経路になっている。

## CI と git hooks

- lefthook (`lefthook.yml`、`pnpm install` の `prepare` で導入)。
  **pre-commit** = staged ファイルの Biome 整形のみ。
  **pre-push** = `format:check` + `lint` + `typecheck` + `test` のフルゲート。
  push が遅いのは仕様。
- `.github/workflows/test.yml` — main への push / PR で
  `expo install --check` (Expo SDK peer 整合) → format:check → lint → typecheck
  → test → Metro バンドル (`expo export --platform ios`)。
- `.github/workflows/e2e-ios.yml` — `workflow_dispatch` または PR への `e2e`
  ラベル付与でのみ起動 (macos runner のコスト管理)。
- `.github/workflows/ios-build-check.yml` — `packages/app/package.json` /
  `app.json` / `pnpm-lock.yaml` 等の変更時のみ native ビルドを検証。
- リリース (`v*` タグ → 未署名 IPA → GitHub Release → `docs/source.json` 更新)
  は `.claude/skills/release/` の手順で行う。**タグのバージョンは
  `packages/app/app.json` の `expo.version` と一致必須**、不一致なら workflow が
  即失敗する。

## DB とマイグレーション

- スキーマの単一情報源は `packages/app/src/db/schema.ts`。DB クライアントは
  `src/db/client.ts` (`db`, `sqlite`, `schema`)。
- **`schema.ts` を編集したら必ず `pnpm drizzle:generate` を実行する。**
  `.sql` とアプリが import する `migrations.js` インデックスの両方を生成する。
- マイグレーションは起動時に `useDbMigrations()` (`src/db/migrate.ts`、
  `app/_layout.tsx` から呼ぶ) で適用。`.sql` は `babel.config.js` の
  `babel-plugin-inline-import` で JS バンドルにインライン化される
  (本番ビルドでファイルシステムなしに動く理由)。**このプラグインを外さないこと。**
- ローカルの SQLite ファイル (`*.db`, `*.sqlite`) は gitignore 済み。

## レイヤー境界

- **`packages/domain` に React Native / Expo / SQLite を import しない。** 純 TS
  のまま保ち、アプリと unit test の両方から使う。
- スコアリング / 比較 / 抽出 / 価格算出はすべて純関数。UI やリポジトリ層はドメイン
  関数を**呼ぶ**だけで再実装しない。新しいロジックは
  `packages/domain/src/<area>/` に `*.test.ts` を併置して追加する。
- リポジトリはテーブル 1 つにつき 1 ファイル (`packages/app/src/repositories/`、
  `index.ts` から re-export)。**複数テーブルをまたぐ操作 (measurements + photos +
  tags 付きの item 作成、candidate → owned 昇格、売却 / 売却取消) は
  `repositories/itemFlow.ts` を入口にする。** 画面側で複数リポジトリを都度合成しない。
- 画面はリポジトリとドメイン関数を呼ぶ。**コンポーネント内から生の `db` クエリを
  書かない。**

## UI

- Expo Router のファイルベースルーティング (`packages/app/app/`)、typed routes
  有効 (`app.json` → `experiments.typedRoutes`)。
- 共通 UI は `packages/app/src/components/` に置き `components/index.ts` から
  re-export。スタイルは `src/theme/` のトークン (`font`, `space`,
  `useThemeColors` 等) を使い、値を直書きしない。
- フォームは react-hook-form + Zod resolver。手本は `src/forms/ItemForm.tsx`。
- 写真は `src/photos/savePhoto.ts` でアプリの document directory にコピーし、
  **SQLite には相対パス (`photos.relative_path`) だけを保存する。** 絶対 URI は
  再インストールや iOS のコンテナ名変更で壊れる。

## 規約

- **`any` を使わない。** 永続化・import/export 境界をまたぐ型は
  `@seam/shared/schemas` の Zod 推論型を使う。TypeScript は strict
  (`noUncheckedIndexedAccess`, `noImplicitReturns` 含む、`tsconfig.base.json`)。
- ユーザー向け表示は日本語。表示ラベルは `packages/shared/src/constants/` の
  `*_LABEL` 定数 (`CATEGORY_LABEL`, `ITEM_STATUS_LABEL` 等)。コード上の識別子は
  英語のまま。
- テーブルを追加するときは: `schema.ts` 更新 → `pnpm drizzle:generate` →
  `packages/shared/src/schemas/` に Zod スキーマ → `src/repositories/` に
  リポジトリ → データを往復させるなら `src/backup/` の JSON export/import も拡張。
