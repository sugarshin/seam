# Seam 設計書 評価レポート - Web 調査結果

調査実施日: 2026-04-26
対象: `/Users/shingosato/dev/src/github.com/sugarshin/seam/plan/initial-plan.md`
前提: DB は Neon DB (PostgreSQL サーバーレス) 確定 / 認証なし・個人用・iOS first・EAS internal

---

## エグゼクティブサマリー（結論先出し）

### 推奨アーキテクチャ（最終提案）

**「Expo (SDK 54+) + expo-sqlite (Drizzle) ローカルファースト + Hono on Cloudflare Workers (BFF) + Neon Postgres + Static API Key 認証」**

主な理由:
1. **DATABASE_URL を IPA に同梱するのは絶対 NG**（後述）。BFF 必須
2. **店内・地下での操作は必ず発生する**ユースケース → ローカルファーストは必須要件
3. PowerSync / ElectricSQL は単独ユーザー & 個人用で運用負荷とコストが過剰
4. 「ローカル SQLite を真実とし、BFF 経由で Neon に非同期 push」のシンプルな自前同期で十分
5. Hono + Cloudflare Workers (Free Tier) で BFF コストはほぼゼロ
6. Neon の HTTP driver は React Native の fetch で問題なく動くが、結局は BFF 越しに使うのが正解

### 「設計書を書き直すべき」と判断した箇所

| 箇所 | 設計書の現状 | 推奨変更 |
|------|----------|---------|
| §3 技術スタック - DB | SQLite ローカルファースト | **Neon (Postgres) + ローカル SQLite キャッシュのハイブリッド** に再定義 |
| §3.4 認証 | 「無し（個人用）」 | **静的 API Key + BFF (Cloudflare Workers) で隔離** に変更 |
| §3.5 データ保存 | 「全てローカル SQLite」 | **「正本は Neon、操作即応はローカル SQLite、双方向 sync は最初は実装しない（push only）」** に変更 |
| §4 アーキテクチャ図 | クライアント直結想定 | **3 層 (App / BFF Worker / Neon)** に変更 |
| §17 写真ストレージ | ローカルファイル | **Cloudflare R2 + presigned URL** を最初から想定（紛失時バックアップ） |
| §35 Acceptance Criteria | 機能観点のみ | **「飛行機モード ON で店内操作完結」「機種変後にデータ復旧」** をクライテリアに追加すべき |

---

## 1. Expo + Neon DB 組み合わせのベストプラクティス（最重要）

### 1.1 Neon Serverless Driver の現状（2025-2026）

Neon が公式提供する `@neondatabase/serverless` には 2 つのトランスポートがある:

| Driver | プロトコル | 用途 | RN 適合性 |
|--------|------------|------|----------|
| **HTTP driver** (`neon()`) | HTTP fetch + Edge / Connection Pooler | one-shot query, ステートレス | ◎ React Native の fetch で動く |
| **WebSocket driver** (`Pool` / `Client`) | WebSocket + node-postgres 互換 | session, interactive transaction | △ ws の polyfill 必要、不安定 |

公式ドキュメント:
- [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)
- [HTTP vs. WebSockets for Postgres queries at the Edge](https://neon.com/blog/http-vs-websockets-for-postgres-queries-at-the-edge)

**Neon の公式ガイダンス（2026 時点）:**
> "Querying over an HTTP fetch request is faster for single, non-interactive transactions, also referred to as one-shot queries"
>
> "WebSocket maintains a persistent connection within a request and supports interactive transactions and is compatible with the node-postgres API (Pool, Client)"

### 1.2 React Native での既知問題

**WebSocket driver の RN での不安定性:**
- React Native は組み込みの WebSocket を持つが、`@neondatabase/serverless` が要求する Node.js `ws` モジュールとはバイナリレベルで挙動差異がある
- [Issue #4957 (drizzle-team)](https://github.com/drizzle-team/drizzle-orm/issues/4957) Bun 環境で同様の handshake 問題が報告されており、RN でも近い症状が出る
- HTTP upgrade (status 101) の解釈が環境依存
- 結論: **RN では HTTP driver を使うか、BFF 経由にする**

**HTTP driver の制約:**
- session 不可、interactive transaction 不可
- `LISTEN/NOTIFY`, `COPY` 不可
- Drizzle ORM の `transaction()` API は HTTP driver では複数文 batch transaction としてのみサポート（インタラクティブ不可）

### 1.3 「直接接続 vs BFF」 の判断（Seam の場合）

| 観点 | App → Neon 直結 (HTTP driver) | App → BFF → Neon |
|------|--------------------------------|-------------------|
| 実装の手数 | ◎ 最小 | ○ Worker 1 個追加 |
| **DATABASE_URL の漏洩リスク** | × **致命的** | ◎ サーバ側のみ |
| Schema 変更時の影響 | App 全リビルド | BFF のみデプロイで完結 |
| 認証なしで成立可否 | × Neon RLS + JWT が必須 | ◎ BFF 内で完結 |
| 将来の Web 版追加 | △ コード重複 | ◎ BFF 共有 |
| Neon 接続数 / コスト | △ クライアント数で増加 | ◎ Worker 集約で削減 |

**結論: Seam では BFF 必須。** 個人用でも DATABASE_URL を IPA に含めるのは取り返しがつかない（後述 §2 参照）。

### 1.4 推奨 BFF パターン: Hono on Cloudflare Workers

[Build a serverless API using Cloudflare Workers, Drizzle ORM, and Neon](https://neon.com/blog/api-cf-drizzle-neon) が Neon 公式推奨パターン:

```
Expo App (React Native)
   ↓ HTTPS + X-API-Key header
Cloudflare Workers (Hono)
   ↓ @neondatabase/serverless (HTTP driver)
   ↓ Drizzle ORM
Neon Postgres
```

メリット:
- Cloudflare Workers 無料枠: 100,000 req/day（個人用なら絶対に超えない）
- Hono は React Native との相性が議論されているが、**RPC client を使わず単純な REST/JSON で叩く分には全く問題ない**（[Hono Issue #4043](https://github.com/honojs/hono/issues/4043)）
- Worker → Neon は同一の TLS パスで <100ms
- DATABASE_URL は Worker の Secret に格納

参考実装:
- [Hono Starter Kit (Hono + CF Workers + Neon + Drizzle)](https://github.com/michaelshimeles/hono-starter-kit)

### 1.5 Neon 接続プーリング

[Connection pooling docs](https://neon.com/docs/connect/connection-pooling)

- Neon は PgBouncer 内蔵、Pooled connection string を使うこと
- Cold start: idle → wake で 300〜500ms (たまに数秒)
- Pooled なら以降の query は <100ms
- Worker から叩く前提なら、**HTTP driver + Pooled URL** が最速

---

## 2. 個人用アプリで「認証なし＋クラウドDB」を成立させる構成

### 2.1 DATABASE_URL を IPA に含めるリスク

**結論: やってはいけない。**

[Quokka: Neon App Security](https://www.quokka.io/blog/neon-app-security-breach), [Neon Security Risks](https://vibeappscanner.com/risks/neon)

事実:
- Neon URL は `postgresql://user:password@host/db` 形式で **完全な credentials を含む**
- iOS IPA は `unzip` 1 発で展開でき、`strings` / `grep` で簡単に抽出可能
- React Native の `process.env.X` はビルド時に bundle に inline 展開される（環境変数ではなく定数置換）
- たとえ EAS internal distribution で配布範囲を絞っても、自分の端末を紛失 / 売却した時に他者が取り出せる
- Neon の無料枠でも漏洩したら勝手に使われ、最悪課金が発生

**Neon 公式推奨:**
> "For mobile applications, the best practice is to never include DATABASE_URL directly in the app. Instead, implement a backend API that handles database connections."
> [Connect to Neon securely](https://neon.com/docs/connect/connect-securely)

### 2.2 「認証なし」を成立させる現実解 (Seam 用)

**選択肢 A: Static API Key + Worker 側で固定キー検証（推奨）**
- iOS Keychain (`expo-secure-store`) に API Key を保存
- 初回起動時に Key を生成 or 自分で発行して入力（自分用なので 1 回だけでよい）
- Worker 側で `request.headers['X-API-Key'] === env.API_KEY` チェック
- 漏洩リスクは IPA 直接抽出より圧倒的に低い（Keychain は Secure Enclave 保護）
- **個人用 1 ユーザーで Auth0 / Clerk を入れるオーバーヘッドより遥かに簡単**

**選択肢 B: Neon RLS + 自前 JWT**
- [Neon RLS docs](https://neon.com/docs/guides/rls-tutorial), [Custom auth providers](https://neon.com/docs/data-api/custom-authentication-providers)
- Worker で JWT を発行し、PostgREST 互換の Neon Data API を叩く
- userId が常に固定でも RLS は機能する
- メリット: BFF を「認証付きプロキシ」に転用できる将来性
- デメリット: 個人用 1 ユーザーには過剰

**選択肢 C: Stack Auth / Clerk の Free tier**
- [Clerk pricing](https://clerk.com/pricing): 10,000 MAU まで無料 → 1 MAU の Seam では実質無料
- [Stack Auth](https://stack-auth.com/): MIT/AGPL でセルフホスト可
- 自分用に passkey ログインを 1 回設定すれば iCloud 同期で機種変も楽
- デメリット: iOS で OAuth flow を入れる UX オーバーヘッド

**Seam への推奨: 選択肢 A（API Key）でスタート、必要が出たら C に移行**

### 2.3 写真ストレージのセキュリティ

- 設計書 §17 はローカルファイル前提だが、**機種変・端末紛失で全消失**
- 最低限 Cloudflare R2 (S3 互換、無料枠 10GB) に保存推奨
- Worker から presigned URL を発行してアップロード
- DB には URL のみ保持

---

## 3. ローカル DB との同期 / オフラインファースト戦略

### 3.1 ユースケースの再定義

設計書を読む限り、**「店内（地下、電波弱）で買うかどうかを判断するために手持ち服と比較する」**が core value。
これはオフライン対応が必須ということ。だが個人用 1 ユーザーなので競合解決はゼロ。

→ **「ローカル SQLite が UI の真実、Neon は耐障害性のためのバックアップ」**という立て付けが最も適切。

### 3.2 主要選択肢の比較

| 方式 | 概要 | Seam 適合性 | 備考 |
|------|------|------------|------|
| **PowerSync + Neon** | 公式統合、SQLite ↔ Postgres 双方向 sync | △ オーバーキル | [Free Plan は 1 週間アイドルで停止](https://www.powersync.com/pricing) |
| **ElectricSQL + Postgres** | Postgres → SQLite, TanStack DB と統合 | △ Expo 公式統合あるが学習コスト | [Expo integration](https://electric-sql.com/docs/integrations/expo) |
| **RxDB** | Reactive DB、レプリケーションプラグイン | △ 多くの機能が有料 ([alternatives](https://rxdb.info/alternatives.html)) | |
| **Triplit** | フルスタック sync engine | × 2025 に Supabase 買収・実質撤退 | |
| **Replicache** | Mutator ベース、強整合 | × $500/mo で個人用に過大 | |
| **自前: expo-sqlite + REST sync** | ローカル DB を真実、BG で Neon に push | **◎ 最適解** | Drizzle 共通スキーマで実装可 |

### 3.3 推奨: 自前シンプル sync の実装パターン

```
[書き込み]
1. UI → Drizzle (expo-sqlite) に即書き込み (UI 即応)
2. 同時に outbox テーブル (id, op, payload, created_at) に記録
3. Background task / 起動時 / フォアグラウンド復帰時に
   outbox を BFF にバッチ POST → 成功したら outbox 削除
4. 失敗時はリトライ（exponential backoff）

[読み取り]
- 基本ローカル SQLite から（オフライン保証）
- 起動時に BFF から差分 pull (last_synced_at)

[機種変 / データ復旧]
- 初回起動で BFF から full pull → ローカル SQLite に展開
```

**個人用 1 ユーザーゆえに競合解決は無視できる**: outbox は単純 FIFO で OK。同時編集が起きないため LWW すら不要。

参考: [Building an Offline-First Production-Ready Expo App with Drizzle](https://medium.com/@detl/building-an-offline-first-production-ready-expo-app-with-drizzle-orm-and-sqlite-f156968547a2)

### 3.4 同一スキーマを SQLite / Postgres で共有する戦略

Drizzle は SQLite と PG で別の schema 定義が必要だが、**型/列構造を共有する型を抜き出して両 dialect で使うパターン**が確立している:

```typescript
// shared/schema-shapes.ts
export const ownedItemShape = {
  id: 'text', // SQLite では text, PG では uuid
  category: 'text',
  fitGrade: 'integer',
  // ...
} as const;
```

ただし実装手数は増える。**Seam の 10 個の AC に登場するエンティティ数は ~6 個と少ない**ので、両方手書きでも保守可能。

---

## 4. Drizzle ORM の最新動向

### 4.1 バージョンと方向性

- 最新安定: drizzle-orm v1.0.0-beta シリーズ進行中（2026 Q1 時点）
- [Drizzle ORM Neon 公式ガイド](https://orm.drizzle.team/docs/connect-neon)
- [Get Started with Drizzle and Expo](https://orm.drizzle.team/docs/get-started/expo-new)

### 4.2 Schema-first vs Code-first

- **Code-first (TS で schema 定義 → SQL 自動生成)** が公式推奨
- `drizzle-kit generate` でマイグレーション SQL 生成
- `drizzle-kit migrate` で適用、`drizzle-kit push` で開発時の即時反映

### 4.3 push vs migrate (Seam 用)

| 環境 | 推奨 |
|------|------|
| ローカル開発 | `drizzle-kit push` で爆速試行 |
| 本番 (Neon) | `drizzle-kit generate` + `drizzle-kit migrate` をスクリプト化 |
| クライアント (expo-sqlite) | `useMigrations` hook でアプリ起動時自動適用 |

**個人用なら CI 不要、`pnpm db:migrate:prod` のような package.json script を手動実行でも十分。**

### 4.4 drizzle-zod の現状（重要変更）

> "Starting from drizzle-orm@1.0.0-beta.15, drizzle-zod has been deprecated in favor of first-class schema generation support within Drizzle ORM itself"

つまり **Drizzle 本体に Zod schema 生成が組み込まれた**。
- 旧: `import { createInsertSchema } from 'drizzle-zod'`
- 新: drizzle-orm 本体の API（v1.0 系）

→ Seam 実装開始時に v1.0 GA 状況を確認し、出ていれば本体機能を使う。出ていなければ drizzle-zod でスタートして後で移行。

### 4.5 Live Queries（Expo SQLite）

Drizzle は `useLiveQuery` Hook を提供し、UI が DB 変更で自動再描画される。
これは Seam の「Buy/Watch/Skip 即反映」「Anchor 切り替えで diff 即計算」要件に強くマッチする。

---

## 5. Expo SDK の最新（2025〜2026）

### 5.1 バージョン状況

- **SDK 55**: Beta（2026-01 時点で 55.0.x が npm に出ている）
- **SDK 54**: 安定版（推奨）。React Native 0.81、New Architecture デフォルト ON
- **SDK 53**: 一世代前。New Architecture デフォルト ON はここから

[Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54)
[Expo SDK 55 Beta](https://expo.dev/changelog/sdk-55-beta)

**Seam 推奨: SDK 54 (stable)** で開始。SDK 55 は Beta 終了後に追従。

### 5.2 New Architecture (Fabric / TurboModules / JSI)

[New Architecture docs](https://docs.expo.dev/guides/new-architecture/)

- SDK 53 以降デフォルト ON
- **SDK 54 が New Architecture を無効化できる最終バージョン**（SDK 55 以降は強制）
- 全 expo-* パッケージが対応済み
- **重要**: react-native-mmkv 3.x など、TurboModules 必須ライブラリが増えているので新規プロジェクトは New Arch 前提で

### 5.3 Expo Router

[Common navigation patterns](https://docs.expo.dev/router/basics/common-navigation-patterns/)

- File-based routing、type-safe routes（自動 TS 型生成）
- `(tabs)` group で URL に "tabs" が出ない
- Stack を Tabs 内にネストするのが Seam の自然な構造

**Seam 用ルーティング案:**
```
app/
  _layout.tsx                # Root Stack
  (tabs)/
    _layout.tsx              # Tabs
    index.tsx                # Wardrobe (手持ち)
    candidates.tsx           # 購入候補
    insights.tsx             # 失敗レビュー
  owned/
    [id].tsx                 # owned item detail
  candidate/
    [id].tsx                 # candidate detail with diff
    new.tsx                  # 新規候補
  decision/
    [id].tsx                 # buy/watch/skip 記録
```

### 5.4 EAS Build / Update / Internal Distribution

[Internal distribution docs](https://docs.expo.dev/build/internal-distribution/)

- `"distribution": "internal"` を eas.json に設定
- Ad hoc provisioning で UDID 制限ビルド配布
- `eas device:create` で自分の iPhone を登録（一度きり）
- `eas build --platform ios --profile preview` で IPA 生成、共有 URL 発行

**Seam 用最小 eas.json:**
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false }
    }
  }
}
```

### 5.5 expo-notifications

[Notifications docs](https://docs.expo.dev/versions/latest/sdk/notifications/)

- iOS は granular permission: `ios.status` を見ること
- ローカル通知だけでも `requestPermissionsAsync()` 必須
- iOS は **一度拒否されると Settings 行きしかない** → 初回起動時にいきなり聞かない
- Seam の用途: 価格上限到達 / Watch 期限到来通知などに利用可

---

## 6. Acceptance Criteria 10 項目に対する技術的実現性

設計書 §35 の 10 項目を「Expo + Neon + 自前 sync」構成で実装する場合の見積もり:

| # | AC | 実装難度 | 推奨実装順 | ハマりどころ |
|---|----|----------|-----------|-------------|
| 1 | 手持ち服を登録 | ★ | 1 | Drizzle schema 設計のみ |
| 2 | 実寸をカテゴリごとに登録 | ★★ | 2 | カテゴリ別 measurement schema を JSONB か Polymorphic table か |
| 3 | 写真を登録 | ★★ | 3 | R2 アップロード, presigned URL |
| 4 | 購入候補を登録 | ★ | 4 | 1 と同パターン |
| 5 | 価格・送料・上限価格 | ★ | 4 | 単純 numeric 列 |
| 6 | Fit Anchor を設定 | ★★ | 5 | owned item 1 件にフラグ or 別テーブル |
| 7 | 候補と Anchor のサイズ差分 | ★★ | 6 | **Pure function でクライアント側計算（後述 §7）** |
| 8 | Buy/Watch/Skip + 理由 | ★ | 7 | enum + text |
| 9 | 購入後 owned に変換 | ★★ | 8 | candidate → owned のトランザクション、写真引き継ぎ |
| 10 | 失敗理由を記録 | ★ | 9 | owned に failure_reason 追加 |

**実装順の根拠:**
1. AC 1-5 はデータモデル & CRUD のみで早期に完成 → DB 設計の妥当性検証
2. AC 6-7 が「コア価値」(diff 計算) なので最重要
3. AC 8-10 は意思決定ループの完成。ここまで来たら使い始める

**全体見積もり（個人開発、業務外で）: 4-6 週間**
- Week 1: BFF + Neon schema + 認証
- Week 2: AC 1-5 (CRUD)
- Week 3: AC 6-7 (Anchor + diff) ← コア
- Week 4: AC 8-10 (decision loop)
- Week 5-6: オフライン sync, 写真, 通知, EAS internal 配布

---

## 7. 「買う前の判断精度を上げる」コア価値の技術的アプローチ

### 7.1 Pure Function スコアリング（最初はこれで十分）

```typescript
type FitDiff = {
  shoulder: number; // mm
  chest: number;
  length: number;
  // ...
}

function scoreCandidate(
  candidate: Candidate,
  anchor: OwnedItem,
  history: Decision[]
): { score: number; reasons: string[] } {
  const diff = computeDiff(candidate.measurements, anchor.measurements);
  const tolerable = isWithinTolerance(diff, candidate.category);
  const overBudget = candidate.totalPrice > candidate.maxPrice;
  const similarFailures = history.filter(/* by category, brand, etc. */);
  // ...
}
```

- **最初から ML は不要**。ドメイン知識を式にエンコードする方が個人用には圧倒的に速い
- diff 計算は完全な pure function で書けて、テスト容易
- 失敗履歴ベースの「あなたが過去 3 回失敗したのは肩幅 +20mm の時」のようなルールベース提案で価値が出る

### 7.2 将来: pgvector による失敗事例類似検索

[Neon pgvector docs](https://neon.com/docs/extensions/pgvector)
[Vector similarity search using Neon Postgres](https://cookbook.openai.com/examples/vector_databases/neon/neon-postgres-vector-search-pgvector)

- Neon は pgvector 標準サポート
- 「過去の失敗 owned item」をベクトル化（カテゴリ + measurement + 価格 + 失敗理由テキスト）し、新しい候補との類似度検索
- HNSW index で <10ms 応答可能
- これは **AC 全部実装してデータが貯まってから** 検討するべき機能

### 7.3 ChatGPT / Claude API 活用余地

- ECサイトの商品ページ URL → 商品情報抽出（カテゴリ、メーカー実寸表、価格、送料）
- 着画像 + 自分の手持ち写真 → コーディネート相性の言語的レビュー
- 失敗理由のテキスト → 自動カテゴライズ（「肩が痛い」→ 「実寸誤差: 肩幅」など）
- ただし API コストと UX 遅延を考えると **MVP では不要**、機能拡張フェーズで

---

## 8. Neon 構成パターンの比較（Seam 向け）

### Pattern A: Direct (App → Neon HTTP driver) ❌ 非推奨

```
Expo App
  ↓ @neondatabase/serverless (HTTP driver) + Drizzle
Neon Postgres (pooled)
```

メリット: 最少コンポーネント
デメリット:
- DATABASE_URL 同梱は致命的（§2.1）
- スキーマ変更で必ず App リビルド
- 写真は別経路必要

### Pattern B: BFF (Hono on CF Workers) ✅ **推奨**

```
Expo App
  ↓ HTTPS + X-API-Key + JSON
Cloudflare Workers (Hono)
  ↓ @neondatabase/serverless (HTTP driver) + Drizzle
Neon Postgres (pooled)

R2 (写真) ← presigned URL
```

メリット: 全部解決。コストゼロ。将来拡張容易
デメリット: コンポーネント 1 個増

### Pattern C: Local-first + BFF sync ✅✅ **Seam の最終推奨**

```
Expo App
  ├─ expo-sqlite + Drizzle (UI の真実)
  └─ outbox / pull
       ↓ HTTPS
Cloudflare Workers (Hono)
  ↓ Drizzle / Neon HTTP
Neon (バックアップ + 機種変復旧)
```

メリット: オフライン完全対応 + クラウドバックアップ + コスト最小
デメリット: 同期ロジックの自前実装（個人用 1 ユーザーだから単純）

### Pattern D: PowerSync 統合

```
Expo App ─ PowerSync RN SDK ─ PowerSync Cloud ─ Neon (CDC)
```

メリット: sync の自前実装不要、双方向、競合解決
デメリット: Free plan は 1 週間アイドルで停止 / 設定の重さ / 個人 1 ユーザーには過剰

---

## 9. Schema 設計に関する補足提案

設計書を見直す上で考慮すべきポイント:

### 9.1 measurements は JSONB を推奨

カテゴリごとに測定項目が違う（トップス: 肩幅/身幅/着丈、パンツ: ウエスト/股下、靴: サイズ/ワイズ）ので:

```typescript
// PG (Neon)
measurements: jsonb('measurements').$type<Measurements>()

// SQLite
measurements: text('measurements', { mode: 'json' }).$type<Measurements>()
```

### 9.2 owned_item と candidate を分けるか統合するか

設計書は分離している。これは正しい:
- candidate は判断に必要なフィールド (max_price, decision_reason) を持つ
- owned は実装結果フィールド (purchased_at, failure_reason) を持つ
- 「candidate → owned 変換」を明示的なドメインイベントにできる

### 9.3 fit_anchor は owned_item の boolean フラグでなく別テーブル

将来「カテゴリごとに別の Anchor」という拡張が来る。最初から:
```
fit_anchor (id, category, owned_item_id, set_at)
```

---

## 10. 設計書の章別レビュー（書き直し提案）

| 章 | 評価 | コメント |
|----|------|---------|
| §1-2 概要・目的 | ◎ | 課題定義が明快 |
| §3 技術スタック | △ | **Neon 前提に書き直し必須**。BFF レイヤー追加 |
| §4 アーキテクチャ図 | × | Local SQLite only で書かれている可能性大、3 層に書き直し |
| §5-10 データモデル | ○ | 概ね正しい、JSONB と分離方針を補強 |
| §11-15 画面遷移 | ○ | Expo Router の file-based 構造に変換 |
| §16-20 機能要件 | ○ | 写真ストレージは R2 に変更 |
| §21-25 非機能要件 | △ | **オフライン要件**を明示、機種変復旧クライテリア追加 |
| §26-30 開発フロー | ○ | EAS internal の手順を追加 |
| §31-34 スコープ | ○ | MVP / Future の切り分けは妥当 |
| §35 Acceptance Criteria | △ | 「飛行機モードで完結」「機種変後復旧」を追加 |

---

## 11. 推奨技術スタック確定提案

```
[クライアント]
- Expo SDK 54 (New Architecture)
- React Native 0.81
- TypeScript 5.6+
- Expo Router (file-based, type-safe)
- expo-sqlite + Drizzle ORM (sqlite dialect)
- Drizzle 本体 zod 機能 or drizzle-zod (移行期)
- expo-image-picker, expo-file-system (写真)
- expo-notifications (ローカル通知)
- expo-secure-store (API Key 保管)
- TanStack Query (server state)
- Zustand or Jotai (UI state, 軽量)

[BFF]
- Cloudflare Workers
- Hono (REST endpoints, RPC は使わない)
- Drizzle ORM (postgres dialect)
- @neondatabase/serverless (HTTP driver)
- 認証: 静的 API Key (X-API-Key header) - 単一ユーザー前提

[DB]
- Neon Postgres (pooled connection)
- 主要 extension: pgvector (将来)
- マイグレーション: drizzle-kit generate + migrate (手動運用)

[ストレージ]
- Cloudflare R2 (写真) - 10GB 無料

[配布]
- EAS Build (internal distribution)
- EAS Update (channel: preview)
```

---

## 12. 残課題と次のアクション

1. **Drizzle で SQLite/PG schema を二重に持つコスト**を見積もる: Spike 推奨
2. **Outbox sync の冪等性**: server 側で `(client_id, op_id)` 重複検出
3. **写真の機種変復旧フロー**: R2 URL を pull → ローカルキャッシュ
4. **EAS internal の運用**: 自分の iPhone UDID 1 個だけ登録、TestFlight は使わない
5. **expo-secure-store の Keychain 同期**: iCloud Keychain で機種変時に API Key も復旧可能か検証

---

## 出典 URL 一覧

### Neon / Postgres
- [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)
- [HTTP vs WebSockets at the Edge](https://neon.com/blog/http-vs-websockets-for-postgres-queries-at-the-edge)
- [Connect to Neon securely](https://neon.com/docs/connect/connect-securely)
- [Connection pooling (PgBouncer)](https://neon.com/docs/connect/connection-pooling)
- [Connection latency and timeouts](https://neon.com/docs/connect/connection-latency)
- [Neon Auth](https://neon.com/docs/auth/overview)
- [Neon RLS tutorial](https://neon.com/docs/guides/rls-tutorial)
- [Neon Data API](https://neon.com/docs/data-api/overview)
- [Custom authentication providers](https://neon.com/docs/data-api/custom-authentication-providers)
- [pgvector extension](https://neon.com/docs/extensions/pgvector)
- [Build serverless API with CF Workers, Drizzle, Neon](https://neon.com/blog/api-cf-drizzle-neon)
- [Neon + PowerSync integration](https://docs.powersync.com/integrations/neon)
- [Neon Postgres Deep Dive 2025](https://dev.to/dataformathub/neon-postgres-deep-dive-why-the-2025-updates-change-serverless-sql-5o0)
- [@neondatabase/serverless GitHub](https://github.com/neondatabase/serverless)
- [Quokka: Neon App Security Breach](https://www.quokka.io/blog/neon-app-security-breach)

### Expo / React Native
- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54)
- [Expo SDK 55 Beta](https://expo.dev/changelog/sdk-55-beta)
- [Expo SDK 53 Changelog](https://expo.dev/changelog/sdk-53)
- [New Architecture docs](https://docs.expo.dev/guides/new-architecture/)
- [Expo Router common patterns](https://docs.expo.dev/router/basics/common-navigation-patterns/)
- [Expo Router nesting navigators](https://docs.expo.dev/router/advanced/nesting-navigators/)
- [EAS Internal distribution](https://docs.expo.dev/build/internal-distribution/)
- [EAS Build introduction](https://docs.expo.dev/build/introduction/)
- [expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [expo-image-picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/)
- [Local-first architecture with Expo](https://docs.expo.dev/guides/local-first/)

### Drizzle
- [Drizzle Neon docs](https://orm.drizzle.team/docs/connect-neon)
- [Drizzle Expo SQLite](https://orm.drizzle.team/docs/connect-expo-sqlite)
- [Get Started Drizzle + Neon](https://orm.drizzle.team/docs/get-started/neon-new)
- [Get Started Drizzle + Expo](https://orm.drizzle.team/docs/get-started/expo-new)
- [Schema migration with Neon and Drizzle](https://neon.com/docs/guides/drizzle-migrations)
- [Drizzle-zod npm](https://www.npmjs.com/package/drizzle-zod)
- [Drizzle 1.0.0-beta.2 release](https://orm.drizzle.team/docs/latest-releases/drizzle-orm-v1beta2)
- [Building Offline-First with Drizzle (DETL)](https://medium.com/@detl/building-an-offline-first-production-ready-expo-app-with-drizzle-orm-and-sqlite-f156968547a2)
- [Drizzle React Native Expo SQLite (LogRocket)](https://blog.logrocket.com/drizzle-react-native-expo-sqlite/)

### Local-first / Sync
- [PowerSync pricing](https://www.powersync.com/pricing)
- [PowerSync React Native SDK](https://www.npmjs.com/package/@powersync/react-native)
- [PowerSync open source](https://www.powersync.com/open-source)
- [ElectricSQL Expo integration](https://electric-sql.com/docs/integrations/expo)
- [TanStack DB with Sync (Neon blog)](https://neon.com/blog/tanstack-db-and-electricsql)
- [Spectrum of Local-First Libraries](https://tolin.ski/posts/local-first-options)
- [RxDB alternatives](https://rxdb.info/alternatives.html)
- [Offline-First Landscape 2025 HN](https://news.ycombinator.com/item?id=45066070)

### BFF / Hono / Cloudflare
- [Hono Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers)
- [Hono RN integration discussion](https://medium.com/developersglobal/react-native-with-hono-js-the-perfect-combo-for-fast-scalable-apps-c55c6b8020cf)
- [Hono Starter Kit (CF + Neon + Drizzle)](https://github.com/michaelshimeles/hono-starter-kit)
- [Hono auth-js with Expo issue](https://github.com/honojs/middleware/issues/771)

### 認証
- [Clerk pricing](https://clerk.com/pricing)
- [Stack Auth](https://stack-auth.com/)
- [User Authentication for Next.js 2025 (Clerk)](https://clerk.com/articles/user-authentication-for-nextjs-top-tools-and-recommendations-for-2025)

---

保存先: /Users/shingosato/dev/src/github.com/sugarshin/seam/plan/20260426_seam-design-evaluation/claude-web-researcher.md
