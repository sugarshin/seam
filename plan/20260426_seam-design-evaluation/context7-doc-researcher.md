# Seam 設計書 公式ドキュメント調査レポート

調査日: 2026-04-26
対象: `/Users/shingosato/dev/src/github.com/sugarshin/seam/plan/initial-plan.md`
前提変更: SQLite + Drizzle ORM (ローカルファースト) → **Neon DB (PostgreSQL サーバーレス)** へ移行する前提で評価

> 注意: 本来は Context7 MCP を利用する想定でしたが、当該実行環境では Context7 MCP が利用できなかったため、`WebFetch` および `WebSearch` を介して **公式ドキュメント (docs.expo.dev / orm.drizzle.team / neon.com / github.com/neondatabase / zod.dev / zustand.docs.pmnd.rs / react-hook-form.com / date-fns.org)** を直接参照しています。

---

## エグゼクティブサマリー（最初に読むべき結論）

1. **Drizzle + Neon (HTTP/WebSocket) を React Native (Expo) から直接利用するのは公式に推奨されていない。**
   - Drizzle 公式は React Native では Expo SQLite の利用を明示的に推奨 (`Please use Expo SQLite to run Drizzle ORM with React Native apps.`)。
   - Neon 公式も「ブラウザ/モバイルからは TCP 接続できないため、`@neondatabase/neon-js` (Neon Data API) を使え」と明記。
   - Neon serverless driver (HTTP) は React Native 上で `fetch` ベースで動作しうるが、**接続文字列をクライアントに埋め込むこと自体が重大なセキュリティリスク** (= DB 全権限の鍵をアプリにバンドルすることに等しい)。

2. **Seam は完全に個人用の iOS アプリで、認証なし・App Store 公開なしという前提**であるため、Neon を採用する場合は次のいずれかが現実的：
   - (A) **Neon Data API + Row Level Security (RLS)** + JWT 認証 (現在 Beta)
   - (B) **薄いバックエンド (Cloudflare Workers / Vercel Functions など) を間に挟む**
   - (C) **当初設計どおり Expo SQLite + Drizzle のローカルファースト構成を維持**し、Neon は将来のクラウド同期用に温存する

3. **「ローカルファースト + 認証なし + 個人用」という設計目的に対して、Neon DB への移行は技術要件が大幅に増える。** この点は意思決定者に明示的にレビューしてもらうべき。

4. その他の採用ライブラリ (Expo Router / Zustand / Zod / RHF / expo-image-picker / expo-file-system / expo-notifications / date-fns) は SDK 55 / 各最新版で問題なく利用可能。

---

## 調査対象

| カテゴリ | ライブラリ / サービス | 確認したバージョン |
|---|---|---|
| Framework | Expo SDK | 55.0.0 (React Native 0.83 / React 19.2.0) |
| Routing | Expo Router | SDK 55 同梱 |
| ORM | Drizzle ORM | 最新 (Neon `@neondatabase/serverless` 1.0.0+ 対応) |
| DB | Neon (Serverless Postgres) | 2026 現行 |
| Validation | Zod | v4 安定版 |
| Form | React Hook Form + @hookform/resolvers | 最新 |
| State | Zustand | v5 系 |
| Native | expo-image-picker / expo-file-system / expo-notifications | SDK 55 同梱 |
| Date | date-fns | 最新 (per-function import 推奨) |

---

## 1. Expo (SDK 55)

- 公式: <https://docs.expo.dev/versions/latest/>
- Changelog: <https://expo.dev/changelog>

### 確認内容

- **最新 SDK**: **Expo SDK 55** (React Native 0.83 / React 19.2.0 同梱)。SDK は年 3 回リリースされる。
- **新規プロジェクト推奨**:
  ```sh
  npx create-expo-app@latest --template default@sdk-55
  ```
  デフォルトで TypeScript + Expo Router + (tabs) レイアウトの雛形が生成される。
- **TypeScript strict**: `tsconfig.json` で `"strict": true` を有効化するのが標準。Zod v4 も TypeScript 5.5+ + strict を要求するので整合する。
- **EAS Internal Distribution (iOS)**: 公式 <https://docs.expo.dev/build/internal-distribution/>
  - **Apple Developer Program (有料・年 $99 USD) が必須**
  - **Ad Hoc 配布で 1 年あたり 100 デバイスまで**
  - 新デバイス追加時は再ビルドまたは再署名が必要
  - 個人用に自分の iPhone 1〜2 台で使う限り十分

### Seam への評価

- 「自分用 iOS アプリ・App Store 非公開・実機運用」のユースケースに合致。
- ただし **Apple Developer Program 加入は必須** で、これはコスト要因として明記しておくべき (設計書では言及なし)。
- SDK 55 を採用する場合、Drizzle (Expo SQLite ドライバ) も SDK 55 対応を満たしている。

---

## 2. Expo Router

- 公式 (Tabs): <https://docs.expo.dev/router/advanced/tabs/>
- 公式 (Typed Routes): <https://docs.expo.dev/router/reference/typed-routes/>

### 確認内容

- ファイルベース。`app/(tabs)/_layout.tsx` で Tabs 設定、`app/(tabs)/index.tsx` 等が各タブ画面。
- **Typed Routes** (TypeScript 型付きナビゲーション) は `app.json` の `experiments.typedRoutes: true` で有効化。動的ルート (`[id].tsx`) では `Href` がオブジェクト形式必須:
  ```tsx
  <Link href={{ pathname: "/item/[id]", params: { id: itemId } }} />
  ```
- ルートパラメータ取得:
  ```tsx
  const { id } = useLocalSearchParams<'/item/[id]'>();
  ```
- 相対パス (`./about`) は不可。絶対パス必須。

### Seam への評価

- 設計書 §34 のディレクトリ構成 (`app/(tabs)/...`, `app/item/[id].tsx`, `app/candidate/[id].tsx`) は Expo Router の最新ベストプラクティスに完全に沿っている。
- **推奨追加事項**: `experiments.typedRoutes: true` を初期から有効化し、`Href` を型安全に扱うこと。この点を設計書に追記すると Claude Code の生成コード品質が安定する。

---

## 3. Drizzle ORM (PostgreSQL / Neon 対応) — **重要**

- Neon 連携: <https://orm.drizzle.team/docs/connect-neon>
- React Native (SQLite): <https://orm.drizzle.team/docs/connect-react-native-sqlite>
- Expo セットアップ: <https://orm.drizzle.team/docs/get-started/expo-new>

### 確認内容

#### A. Neon ドライバ 2 種類

| ドライバ | パッケージ | 通信 | 用途 |
|---|---|---|---|
| `drizzle-orm/neon-http` | `@neondatabase/serverless` | HTTPS (fetch) | one-shot クエリ・非対話的トランザクション。Edge / Serverless 向け |
| `drizzle-orm/neon-serverless` | `@neondatabase/serverless` | WebSocket | 対話的トランザクション・`node-postgres` 互換が必要な場合 |

```ts
// neon-http
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);
```

- HTTP は **〜3 ラウンドトリップ** で完了 (TCP は 〜8)。単発クエリは HTTP が高速。
- WebSocket は Node.js v21 以前では `ws` 等の WebSocket コンストラクタを `neonConfig.webSocketConstructor` に注入する必要あり。
- `@neondatabase/serverless` は **v1.0.0** 以降で安定。`drizzle-orm` は <1.0 / >=1.0 両対応。

#### B. React Native での利用可否 — **ここが核心**

Drizzle 公式ドキュメントは React Native セクションで明確に言及:

> **"Please use Expo SQLite to run Drizzle ORM with React Native apps."**
> `react-native-sqlite-storage does not support new Hermes JavaScript runtime`

- すなわち Drizzle は **React Native (Hermes) 上では Expo SQLite ドライバ (`drizzle-orm/expo-sqlite`) のみを公式推奨**。
- `drizzle-orm/neon-http` を React Native から使うこと自体は技術的に可能 (fetch ベースなので Hermes でも動く) が、**公式に動作保証された組み合わせではない**。
- WebSocket ドライバは React Native 環境では追加の polyfill (`ws` は Node 専用) が必要となり、現実的でない。

#### C. マイグレーション運用 (drizzle-kit)

- `npx drizzle-kit generate` でスキーマから SQL 生成
- `npx drizzle-kit migrate` で適用
- **Expo SQLite の場合**: `metro.config.js` で `.sql` 拡張子サポート、`babel.config.js` で SQL のインライン import を設定し、`useMigrations()` フックでアプリ起動時に適用。
- **Neon の場合**: 通常は CI/開発マシンから `drizzle-kit migrate` を直接 Neon に流す。クライアント (RN) からマイグレーションを走らせるのは非推奨。

### Seam への評価 (Drizzle × Neon × Expo の互換性結論)

**結論: 「Drizzle + Neon + React Native (Expo)」を直接組み合わせる構成は公式推奨外であり、本番採用を推奨しない。**

| シナリオ | 評価 |
|---|---|
| Expo SQLite + Drizzle (当初設計) | **公式推奨。Hermes 対応、マイグレーションフック完備。Seam の「ローカルファースト・認証なし」要件と完全合致** |
| Neon HTTP + Drizzle を RN から直接 | 動作はするが公式非推奨。後述のセキュリティ問題が深刻 |
| Neon WebSocket + Drizzle を RN から直接 | WebSocket ポリフィル要・公式非推奨 |
| Neon Data API + RLS + RN (PostgREST) | クラウド同期したい場合の現実解。Drizzle は使えない |
| 薄い BFF (CF Workers 等) + Drizzle/Neon サーバ側 + RN は HTTPS 経由 | クラウド同期したい場合の本格構成。バックエンド管理コストが追加 |

---

## 4. Neon DB — **重要**

- Pricing: <https://neon.com/pricing>
- 接続選択: <https://neon.com/docs/connect/choose-connection>
- Connection Pooling: <https://neon.com/docs/connect/connection-pooling>
- Serverless Driver: <https://neon.com/docs/serverless/serverless-driver>
- Data API: <https://neon.com/docs/data-api/get-started>

### 確認内容

#### A. Free Tier (2026 現行)

- Compute: **100 CU-hours / project / month** (autoscale 上限 2 CU = 8 GB RAM)
- Storage: **0.5 GB / project**
- Branch: **10 / project**
- Project: **100 / アカウント**
- Manual Snapshot: 1 / project
- Public Network Transfer: 5 GB
- Auth (MAU): 60,000
- 月クォータを超えると compute が suspend される

> Seam の用途 (個人 1 ユーザー、画像は端末ローカル、テキスト DB のみ) なら 0.5 GB / 100 CU-h で十分余裕がある。

#### B. 接続方法の選び分け（公式ガイドより）

| 環境 | 推奨方式 |
|---|---|
| Long-lived server (Rails/Django/Node) | TCP + connection pool |
| Serverless / Edge functions | Neon Serverless Driver (HTTP / WebSocket) |
| **ブラウザ・モバイル** | **Neon Data API (`@neondatabase/neon-js`) — 現在 Beta** |

公式は明確に:
> **"Browsers cannot establish direct TCP connections to Postgres. Instead, use the Neon Data API via `@neondatabase/neon-js`, which provides a secure HTTP interface with Row-Level Security support."**

- Connection pooler (PgBouncer): 最大 10,000 同時接続。
- 1 CU compute では `default_pool_size = 377`。
- Transaction mode のため `SET / RESET / LISTEN / NOTIFY / WITH HOLD CURSOR` は不可。

#### C. クライアント直接接続のセキュリティリスク（核心）

- **接続文字列 (= ユーザー名/パスワード) を React Native アプリにバンドルすると、リバースエンジニアリングで誰でも DB 全権限を取得可能**。これは公式・非公式問わずアンチパターン。
- Neon が提供する Data API + RLS は、JWT を介してユーザーごとの行レベル権限を強制することでこの問題を解決する設計。ただし **2026 年 4 月時点で Data API は Beta**。
- 「個人専用アプリで自分しか使わない」「自分の iPhone 上だけで動く」とはいえ、IPA を逆解析されればクレデンシャルは漏れる。Seam は古着の購買データという機微情報を含むので、漏洩想定の脅威モデルを書面化すべき。

#### D. Branch / Database 設計

- 1 project あたり Free で 10 branch まで。
- 推奨: `main` (本番) / `dev` (開発) / 必要に応じ feature branch。Drizzle は env で接続文字列を切り替え可能。

### Seam への評価

- **Free tier 容量・性能は Seam の用途に十分。**
- **ただし「認証なしクライアント直接接続」は公式が明確に禁止しており、設計上は避けるべき。** 認証なし要件を維持するならローカルファーストの当初設計に戻すか、Neon は完全にバックエンドの背後に隠す必要がある。

---

## 5. Zod / React Hook Form

- Zod: <https://zod.dev/>
- @hookform/resolvers: <https://github.com/react-hook-form/resolvers>

### 確認内容

- **Zod v4 が安定リリース済**。`import * as z from "zod"` を推奨。
- 要件: **TypeScript v5.5+ かつ strict mode**。Seam の「strict 必須」方針と一致。
- React Hook Form 連携:
  ```ts
  import { z } from 'zod';
  import { zodResolver } from '@hookform/resolvers/zod';
  const schema = z.object({ name: z.string().min(1), age: z.number().min(10) });
  const { register, handleSubmit } = useForm({ resolver: zodResolver(schema) });
  ```
- `z.infer<typeof schema>` で型推論。フォーム入力値とドメイン型を 1 source of truth にできる。

### Seam への評価

- §25 Backup/Import で「import 時に Zod で validation」と書かれているのと整合。
- 設計書の `GarmentItem` / `Measurement` 等の TypeScript 型は **手書き** されているが、**Zod スキーマから `z.infer` で導出する**ことで型と実行時バリデーションを一致させられる。これは設計書に追記して良い改善点。

---

## 6. Zustand

- 公式 (Persist): <https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data>

### 確認内容

- **Zustand v5 系が現行**。React 19 対応。
- React Native での persist は `AsyncStorage` を使う。`createJSONStorage` でラップするのが推奨パターン:
  ```ts
  import AsyncStorage from '@react-native-async-storage/async-storage';
  import { create } from 'zustand';
  import { persist, createJSONStorage } from 'zustand/middleware';

  const useStore = create(
    persist(
      (set) => ({ /* state */ }),
      { name: 'seam-store', storage: createJSONStorage(() => AsyncStorage) }
    )
  );
  ```
- v4.5.5 以降、デフォルト state は自動 persist されない (breaking change)。明示的に変更されたものだけが永続化される。
- React Native では MMKV (`react-native-mmkv`) ストレージで高速化する選択肢もある。

### Seam への評価

- 設計書では「Zustand を採用」とのみ記載、永続化の扱いは未定義。
- Seam ではほぼ全データが Drizzle/SQLite (or Neon) 側にあるので、Zustand は **UI セッション状態 (フィルタ、検索条件、Compare 画面の選択中候補等) のみ** にとどめるのが妥当。永続化は不要 or 軽微なものだけ AsyncStorage。
- ストア分割粒度: §28 のスクリーンに合わせて `useFilterStore`, `useCompareStore` など機能別に小さく分けるのが Zustand 流。1 個の巨大ストアは避ける。

---

## 7. expo-image-picker / expo-file-system / expo-notifications

- image-picker: <https://docs.expo.dev/versions/latest/sdk/imagepicker/>
- file-system: <https://docs.expo.dev/versions/latest/sdk/filesystem/>
- notifications: <https://docs.expo.dev/versions/latest/sdk/notifications/>

### 確認内容

#### expo-image-picker (SDK 55)

- API: `launchImageLibraryAsync()` / `launchCameraAsync()`
- Permission: `useCameraPermissions()`, `useMediaLibraryPermissions()` フック、または `requestCameraPermissionsAsync()` / `requestMediaLibraryPermissionsAsync()`。
- iOS では Live Photo 対応、複数選択対応。
- iOS で高解像度画像の crop 値が `UIImagePickerController` 由来で不正確になる既知問題あり。

#### expo-file-system (SDK 55)

- **新 API クラスベース** (`File`, `Directory`, `Paths`, `FileHandle`) が導入されている。
- 旧 API は `expo-file-system/legacy` から import する後方互換ルートあり。
- `Paths.document` でアプリ専用 documents directory が取得可能。Seam の「画像をローカルコピーして URI を DB 保存」要件はこれで実現可能:
  ```ts
  import { File, Paths } from 'expo-file-system';
  const dest = new File(Paths.document, `photos/${id}.jpg`);
  // copy from picker.uri to dest
  ```
- iOS では `app.json` の config plugin で `enableFileSharing`, `supportsOpeningDocumentsInPlace` を設定可能。

#### expo-notifications

- Local notification: `scheduleNotificationAsync()` で日時/トリガ指定可能。
- iOS の **Push Notifications は Development Build 上のみで動作** (Expo Go では機能制限あり)。
- 通知ハンドラ: `setNotificationHandler()`。
- **Background Notifications**: iOS では `enableBackgroundRemoteNotifications` を config plugin で有効化、`UIBackgroundModes` を設定。
- 物理デバイス必須 (Simulator では Push 不可)。Local Notification は Simulator でも動作。
- iOS 13+ では permission prompt がある。

### Seam への評価

- §8 (Photos)、§24 (Notifications) の要件は SDK 55 でそのまま満たせる。
- §24 で「終了 10 分/30 分/1 時間/3 時間/1 日前」の通知は `scheduleNotificationAsync()` の date trigger で実装可能。
- **注意点**: ユーザーが端末を再インストールすると `expo-file-system` の `documentDirectory` パスが変わる可能性があるため、DB 保存は **絶対パスではなく相対パス + 再構築** が推奨される実装パターン。設計書の §8 で URI を保存とあるが、相対パス保存への切替を検討すべき。
- Background fetch は使用していない (オークション通知は scheduleNotification で十分) ので、iOS の background 制約は問題にならない。

---

## 8. date-fns

- 公式: <https://date-fns.org/docs/Getting-Started>

### 確認内容

- per-function import が tree-shaking 上の標準:
  ```ts
  import { format, addDays, isBefore } from 'date-fns';
  ```
- Timezone は別パッケージ `date-fns-tz`。Seam の「auctionEndsAt」ハンドリングで JST 表示が必要なら `formatInTimeZone` 等を併用。
- 軽量で React Native との相性は良好。

### Seam への評価

- 採用に問題なし。`auctionEndsAt` を ISO 文字列で保存し、表示時は `format` + `formatDistanceToNow` を使う構成が Seam の用途に最適。

---

## 9. Seam 設計に対する技術的妥当性の総合評価

### 妥当な点

- TypeScript strict / no-any / domain logic 分離 / repository 層 / pure function 化の方針は React Native + Expo 現代ベストプラクティスと完全に整合。
- §30 のドメイン関数群 (compareMeasurements, calculateCandidateScore 等) を pure function 化する方針は単体テスト容易性・将来 OCR/抽出ロジック追加時の拡張性で優位。
- §31 のフェーズ分けは現実的。Phase 1〜2 で Acceptance Criteria 10 個に到達する設計は妥当。
- §34 のファイル構成は Expo Router の慣習に沿っている。

### 改善 / 検討すべき点

1. **【最重要】Neon DB 採用方針の再検討が必要**
   - 「ローカルファースト・認証なし・個人用」と「Neon DB 採用」は本質的に矛盾する。
   - 推奨 A: **Phase 1 は Expo SQLite + Drizzle (公式推奨経路) で実装**し、Acceptance Criteria 10 項目を最短で達成。Neon は Phase 8 以降の「クラウド同期 / 多デバイス対応」のオプションとして温存。
   - 推奨 B: どうしても Neon を使うなら **Cloudflare Workers / Vercel 上に薄い API を立て、JWT (端末固有) で認証**。Drizzle はサーバー側で動かす。Seam の RN 側は HTTPS で叩くだけ。
   - 推奨 C: **Neon Data API (Beta) + RLS** を試す。ただし Beta なので production 採用は慎重に。

2. **TypeScript 型と Zod スキーマの一元化**
   - 設計書で TS 型が手書きされているが、`z.infer` で導出する方針に変更することを推奨。Backup/Import 時の Zod validation 要件 (§25) と整合する。

3. **Expo Router typed routes 有効化を Phase 1 設計に明記**
   - `app.json` の `experiments.typedRoutes: true` を初期から有効化。

4. **画像保存パスの設計**
   - `expo-file-system` の `documentDirectory` 絶対パスは再インストールで変わる可能性があるため、**相対パス + ランタイムで `Paths.document` と結合** する形を採用すべき。

5. **EAS Internal Distribution には Apple Developer Program が必須**
   - 年 $99 USD のコスト。設計書 §4 で明記しておくと意思決定がぶれない。

6. **Zustand の役割を限定的に定義**
   - DB は Drizzle、検証は Zod、状態は React Hook Form (フォーム) と Zustand (UI セッション) と明確に役割分担を §31 / §34 に追記すると Claude Code の生成が安定する。

---

## 10. Drizzle + Neon + RN/Expo 互換性に関する明確な結論

| 評価軸 | 結論 |
|---|---|
| 技術的に動作するか | HTTP ドライバなら Hermes 上で `fetch` ベースで動作する可能性は高い |
| 公式推奨か | **No** (Drizzle 公式は RN では Expo SQLite を推奨、Neon 公式はモバイルからは Data API を推奨) |
| 本番採用すべきか | **No** (セキュリティ・公式サポート・運用保守の 3 点で問題) |
| Seam の要件 (個人用・認証なし・ローカルファースト) との整合 | **Mismatch** |
| 推奨される代替 | (1) Expo SQLite + Drizzle 維持 / (2) BFF を挟んで Neon はサーバー側 / (3) Neon Data API + RLS (Beta) |

**最終推奨**: Phase 1〜7 は **Expo SQLite + Drizzle (元の設計通り)** で進め、Phase 8 以降に「クラウドバックアップ / 同期」の文脈で Neon を導入する場合は **BFF 経由** または **Data API + RLS** とする二段構えが、Seam の目的に最も合致する。

---

## 11. 参考 URL 一覧

### Expo / React Native
- Expo SDK 55 (latest): <https://docs.expo.dev/versions/latest/>
- Expo Changelog: <https://expo.dev/changelog>
- EAS Internal Distribution: <https://docs.expo.dev/build/internal-distribution/>
- Expo Router Tabs: <https://docs.expo.dev/router/advanced/tabs/>
- Expo Router Typed Routes: <https://docs.expo.dev/router/reference/typed-routes/>
- expo-image-picker: <https://docs.expo.dev/versions/latest/sdk/imagepicker/>
- expo-file-system: <https://docs.expo.dev/versions/latest/sdk/filesystem/>
- expo-notifications: <https://docs.expo.dev/versions/latest/sdk/notifications/>

### Drizzle
- Connect Neon: <https://orm.drizzle.team/docs/connect-neon>
- React Native SQLite: <https://orm.drizzle.team/docs/connect-react-native-sqlite>
- Expo Get Started: <https://orm.drizzle.team/docs/get-started/expo-new>

### Neon
- Pricing (Free tier): <https://neon.com/pricing>
- Choose Connection: <https://neon.com/docs/connect/choose-connection>
- Connection Pooling: <https://neon.com/docs/connect/connection-pooling>
- Serverless Driver: <https://neon.com/docs/serverless/serverless-driver>
- Data API: <https://neon.com/docs/data-api/get-started>
- Drizzle Guide: <https://neon.com/docs/guides/drizzle>
- GitHub `@neondatabase/serverless`: <https://github.com/neondatabase/serverless>

### その他
- Zod: <https://zod.dev/>
- React Hook Form Resolvers: <https://github.com/react-hook-form/resolvers>
- Zustand Persist: <https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data>
- date-fns: <https://date-fns.org/docs/Getting-Started>

---

保存先: /Users/shingosato/dev/src/github.com/sugarshin/seam/plan/20260426_seam-design-evaluation/context7-doc-researcher.md
