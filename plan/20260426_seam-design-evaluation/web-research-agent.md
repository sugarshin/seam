# Seam Design Evaluation - Web Research Report

## 概要

個人用 iOS アプリ「Seam」（古着購入の購買判断支援アプリ）の設計評価のための Web 調査結果。
DB を当初の SQLite ローカルファースト構成から Neon DB（PostgreSQL サーバーレス）に変更したことのトレードオフを中心に、Expo + React Native の DB アクセスパターン、競合プロダクト、ドメイン特化知見、画像保存戦略を整理。

**結論サマリ**:
- **Neon を RN クライアントから直接叩く構成は強く非推奨**（DATABASE_URL 漏洩、TCP 制約、オフライン完全停止、コネクション数の枯渇）
- **個人用かつ古着現場（弱電波）想定なら、ローカルファースト + 任意のクラウド sync が最適**
- 現実的な選択肢は次の 3 パターン:
  1. **expo-sqlite + Drizzle のローカルファースト維持**（最もシンプル、Phase 8 まで現状の設計で完走できる）
  2. **expo-sqlite (primary) + Neon (backup/sync)** のハイブリッド（PowerSync / Triplit 経由）
  3. **Neon Data API + JWT** をバックエンド代わりに使う（オフライン対応は別途必須）

## 調査日時

2026-04-26

---

## 主要な発見

### A. ローカルファースト vs Neon 直接接続

- **RN/Expo から Neon を直接叩くのはアーキテクチャ上の大きな矛盾**
  - ブラウザ/RN は TCP を直接張れないため `pg` ドライバは使えない。Neon の `neon-http` / `neon-serverless` ドライバ前提になる
  - Neon 公式ドキュメントは「browser/edge は Data API + JWT 経由」を推奨。RN は browser に近い扱い
  - DATABASE_URL を IPA に埋めると逆コンパイルで漏洩する（OWASP M1: Improper Credential Usage）
- **オフライン動作**: Neon 直接接続の場合、店内 wifi 不安定 / 地下 / 弱電波で UI が完全に停止する。古着屋・オークション現場のユースケース上、致命的
- **コネクション数**: 直接接続は `max_connections` (100〜4000) に縛られる。1 ユーザーでも複数画面を開けば接続が増える
- **コスト**: Neon Free tier は 100 CU-hours/月 + 0.5 GB ストレージ/branch + 5 GB egress。個人用には十分だが、画像は別ストレージ必須

### B. 推奨構成（Web 知見からの提言）

| 観点 | 推奨 | 理由 |
|------|------|------|
| プライマリ DB | **expo-sqlite + Drizzle** | RN ネイティブ、オフライン即応、`useLiveQuery` で React に統合済 |
| クラウド連携 | **当面なし、必要なら PowerSync / Triplit** | 個人用 1 端末なら sync 不要、複数端末/バックアップが必要になってから検討 |
| バックアップ | **JSON Export を iCloud Drive / Files に手動保存** | 設計書の §25 と整合 |
| 画像保存 | **`FileSystem.documentDirectory` 配下にコピー** | iOS の Photo Library 参照は写真削除でリンク切れ。コピーが安全 |
| 認証 | **不要（個人用 EAS internal distribution）** | DB がクラウドにある場合のみ JWT などが必要 |

### C. 競合プロダクトの分析

- 既存のクローゼット管理アプリ（Whering, Cladwell, Indyx, Stylebook 等）は **「持っている服のコーディネート」「環境負荷可視化」「outfit planning」が中心**
- **「古着の実寸ベース購買判断」「Fit Anchor」「Personal NG Rule」「Failure Log」を組み合わせたアプリは存在しない** → Seam の独自性は明確
- Indyx のみ Cost Per Wear をネイティブ機能として実装。Whering は環境負荷スコア。
- 日本市場（メルカリ・ヤフオク文化）に最適化した「実寸抽出 + 上限価格管理」アプリは見つからず、Notion テンプレ + スプレッドシート文化が支配的

---

## 詳細調査結果

## 1. ローカルファースト設計 vs Neon DB のトレードオフ

### 1.1 オフライン動作要件

**結論**: Neon 直接接続では古着屋・オークション現場のユースケースを満たせない。

設計書の Target User は以下を想定している:
- 古着屋店内での実寸比較
- ヤフオクで終了直前の入札判断
- 地下店舗・電波不安定エリアでの利用

Neon は HTTP/WebSocket ともにネットワーク必須で、オフライン状態では完全に停止する。Expo 公式の Local-first ガイドが "デバイスを唯一の信頼できる情報源 (single source of truth) として扱う" ことを推奨しており、オフライン動作のためには SQLite ローカル DB が必須となる。

> "All reads and writes happen against the local SQLite database instantly, while the replication happens in the background." (RxDB)

[Local-first architecture with Expo](https://docs.expo.dev/guides/local-first/)

### 1.2 レイテンシ実測値

**結論**: Compare 画面の "100ms 以内に手持ち服を全件読みたい" 要件は、Neon 単独では達成困難。

Neon 公式ベンチマーク:
- **HTTP driver**: 同一リージョン内で 10〜30ms / クエリ
- **WebSocket driver**: 初回接続 30〜100ms、確立後は 4ms
- **Cold start**: idle 状態からの再起動で **数百ms** 追加（autosuspend あり）

ただしこれらは **同一 AWS リージョン内のサーバから測定した値**。モバイル端末から日本で計測すると以下が加算される:
- 日本 → us-east-1 RTT: 130〜170ms
- TLS / handshake: +50ms
- Cold start: +数百ms

→ **モバイル実機での体感レイテンシは 200〜500ms / クエリ程度になる見込み**

[Benchmarking latency in Neon's serverless Postgres](https://neon.com/docs/guides/benchmarking-latency)
[Connection latency and timeouts - Neon Docs](https://neon.com/docs/connect/connection-latency)
[HTTP vs. WebSockets: Which protocol for your Postgres queries at the Edge](https://neon.com/blog/http-vs-websockets-for-postgres-queries-at-the-edge)

対して expo-sqlite はメモリマップド I/O で **単純 SELECT は 1ms 未満**。Compare 画面の体験は SQLite が圧倒的に優位。

### 1.3 データ同期戦略の選択肢

| ツール | RN 対応 | Postgres 対応 | Neon 対応 | 個人用適性 | 学習コスト |
|--------|---------|----------------|-----------|-------------|-------------|
| **PowerSync** | ◎ (公式 SDK) | ◎ | ◎ (公式 announce 済) | △ (sync service の運用必要) | 中 |
| **ElectricSQL** | ○ | ◎ | △ (CHECK/UNIQUE 制約 NG) | △ (legacy v1 → 新世代へ移行中) | 高 |
| **Triplit** | ○ | △ (独自) | × | ○ | 中 |
| **RxDB** | ○ (SQLite adapter) | ○ (replication plugin) | ○ | ○ | 中 |
| **WatermelonDB** | ◎ | ○ (要自前バックエンド) | △ | △ | 中 |
| **TinyBase** | ○ (expo-sqlite 経由) | × | × | ○ | 低 |
| **手書き sync queue** | - | - | - | ◎ | 低 |

**個人用かつ初期は単一端末** という前提なら、まず sync 層は入れない方がシンプル。複数端末（iPad と iPhone）展開や iCloud バックアップが必須要件になった段階で PowerSync または独自 JSON sync を検討するのが現実的。

[ElectricSQL vs PowerSync](https://www.powersync.com/blog/electricsql-vs-powersync)
[The Spectrum of Local First Libraries](https://tolin.ski/posts/local-first-options)
[PowerSync React Native & Expo SDK](https://docs.powersync.com/client-sdks/reference/react-native-and-expo)
[RxDB SQLite RxStorage for Hybrid Apps](https://rxdb.info/rx-storage-sqlite.html)

### 1.4 個人用アプリで Neon を直接叩く構成のリスク

**Critical risks**:
1. **DATABASE_URL の漏洩**: IPA を逆コンパイルすれば抽出可能。EAS Internal Distribution でも防げない。OWASP Mobile Top 10 の M1 (Improper Credential Usage)
2. **接続数枯渇**: max_connections は 100〜4000。pooler を経由しないとアプリ内でも複数接続を作るとすぐ枯渇する
3. **TCP 不可問題**: RN は TCP socket が使えない → `pg` ドライバ不可 → `neon-http` 一択 → 逐次クエリは遅い
4. **fetch ストリーミング非対応**: RN の fetch は ReadableStream をサポートしていない既知の問題があり、`neon-http` の一部機能で詰まる可能性

> "Anything embedded in the app code can be extracted from the .apk or .ipa file. You should never hardcode secrets or rely on .env in the app, and instead route API calls through a secure backend proxy."
[Understanding OWASP M1 (2024)](https://dev.to/jocanola/understanding-owasp-m1-2024-improper-credential-usage-in-react-nativeexpo-and-how-to-mitigate-it-2657)

**緩和策（Neon を使う場合）**:
- **Neon Data API + JWT**: PostgREST 風の HTTP API を Neon が提供。Row-Level Security で保護。ただし JWT 発行サーバが別途必要 → **個人用前提を崩す**
- **Cloudflare Worker / Vercel Function を proxy** に立てる → バックエンド不要の前提が崩れる
- **EAS Build secret と Expo Updates で URL を外出し** → 部分的な緩和。完全な保護にはならない

### 1.5 Neon Free Tier の制限

- **100 CU-hours/月** (2025/10 から倍増。0.25 CU で連続 400h)
- **0.5 GB / branch**, 合計 **5 GB / アカウント**, **100 projects**
- **5 GB egress**
- **autosuspend**: idle で停止。次回アクセス時 cold start 数百 ms

→ 個人用テキスト DB なら十分。**画像は対象外** (オブジェクトストレージが別途必要: Cloudflare R2 / S3 / Supabase Storage 等)

[Neon plans](https://neon.com/docs/introduction/plans)
[Pricing — Neon](https://neon.com/pricing)

### 1.6 トレードオフまとめ表

| 観点 | expo-sqlite (local-first) | Neon 直接接続 | expo-sqlite + Neon (sync) |
|------|--------------------------|----------------|---------------------------|
| オフライン動作 | ◎ | × | ◎ |
| Compare 画面レイテンシ | ◎ <1ms | × 200-500ms | ◎ <1ms |
| 単一端末ユースケース | ◎ | △ | ◎ (sync 不要なら ○) |
| 複数端末同期 | × (Export/Import 手動) | ◎ | ◎ |
| クラウドバックアップ | △ (JSON Export) | ◎ | ◎ |
| 画像 | ◎ (FileSystem.documentDirectory) | × (別途要 R2 等) | △ |
| 個人用の運用コスト | 0 円 | 0 円 (Free tier 内) | 0〜数百円 |
| 初期実装の難易度 | 低 | 中 | 高 |
| セキュリティリスク | 低 (端末内のみ) | 高 (DATABASE_URL) | 中 |
| Drizzle ORM サポート | ◎ (公式 expo driver) | ◎ (neon-http) | ◎ |
| 設計書の前提との整合 | ◎ | × (画像ローカル前提と矛盾) | △ |

**提言**: Phase 1〜8 を **expo-sqlite + Drizzle で完走**。クラウド要件が後から発生した時に、**JSON Export を別端末/iCloud に置く** か **PowerSync 導入で Neon と同期** のいずれかを後付けで足すのが、設計書の前提を最も損なわない。

---

## 2. Expo + React Native の DB アクセスパターン

### 2.1 expo-sqlite + Drizzle (推奨パターン)

- **Drizzle 公式が Expo SQLite を first-class でサポート**: `drizzle-orm/expo-sqlite`
- `useLiveQuery` フックで自動再描画（要 `enableChangeListener: true`）
- マイグレーションは `drizzle-kit generate` → `migrate()` で実行時に適用
- `drizzle.config.ts` の `dialect: 'sqlite'`, `driver: 'expo'` で生成

[Drizzle ORM - Expo SQLite](https://orm.drizzle.team/docs/connect-expo-sqlite)
[Drizzle and React Native (Expo): Local SQLite setup - LogRocket](https://blog.logrocket.com/drizzle-react-native-expo-sqlite/)
[Building local-first apps with Expo SQLite and Drizzle | Israa Taha](https://israataha.com/blog/build-local-first-app-with-expo-sqlite-and-drizzle/)
[expo-sqlite-drizzle 実装例](https://github.com/israataha/expo-sqlite-drizzle)

### 2.2 Neon を RN から直接使う既知問題

- **fetch streaming 未対応** (facebook/react-native#27741): `neon-http` の一部機能で問題化する可能性
- **WebSocket driver は ws polyfill 必要**: `@neondatabase/serverless` の WebSocket モードは Node.js の `ws` を仮定するため RN では追加設定が要る
- **Drizzle GitHub Issue #2523**: Neon 接続のインストール時の依存解決失敗が報告（--force / --legacy-peer-deps が必要）
- 公式は **「RN なら Drizzle + Expo SQLite を使え」** が現在の推奨

[fetch streams not implemented in RN core](https://github.com/facebook/react-native/issues/27741)
[BUG: neon database installation issue](https://github.com/drizzle-team/drizzle-orm/issues/2523)
[Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)

### 2.3 推奨される認証方式（Neon を使う場合の参考）

個人用前提では認証なしで OK。クラウド DB 利用時に最低限必要なのは:
- **API Key を端末ローカルに `expo-secure-store` (Keychain/Keystore) で保管**
- ただし API Key 自体を端末に置くと M1 リスク → **本来は OAuth / JWT を発行する別サーバが必要**
- 個人用なら EAS Build secrets で App Build 時に static token を埋める折衷案も可能（漏洩リスクは残る）

[expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/)
[Secure Mobile App Credentials in React Native](https://www.folio3.com/mobile/blog/secure-mobile-app-credentials-in-react-native/)

---

## 3. 競合プロダクト調査

### 3.1 主要クローゼット管理アプリの比較

| プロダクト | 主要機能 | 料金 | プラットフォーム | 実寸管理 | 購買判断支援 | CPW | 失敗ログ |
|-----------|---------|-----|------------------|---------|-------------|-----|---------|
| **Whering** | デジタル closet, AI styling, env impact, dress me shuffle | 無料 (paywall なし) | iOS / Android | × | × | × | × |
| **Cladwell** | capsule wardrobe, daily outfit suggestion, wear tracking | 有料サブスク | iOS / Android | × | × | △ | × |
| **Indyx** | catalog, outfit, **CPW tracking**, packing list, resell | 無料 + Insider $20/月 | iOS / Android | × | △ (resell 視点) | ◎ | × |
| **Stylebook** | 詳細タグ管理, AI 背景除去 (10), 1 万円超のヘビーユーザー向け | 買い切り $4.99 | iOS only | × | × | △ | × |
| **Save Your Wardrobe** | AI スキャン, アフターケアサービス連携 | 無料 + サービス課金 | iOS / Android | × | × | × | × |
| **Smart Closet** | 基本管理, web clip, アップデート停滞 | 無料 / 有料 | iOS / Android | × | × | × | × |
| **OpenWardrobe / Acloset** | AI styling, outfit gen | フリーミアム | iOS / Android | × | × | △ | × |
| **Notion テンプレ群** | DB ベース closet, outfit log | 無料〜有料テンプレ | クロスプラットフォーム | △ (手書き) | △ | △ | △ |

[Whering 公式](https://whering.co.uk/)
[Indyx - The Best Wardrobe Apps 2026](https://www.myindyx.com/blog/the-best-wardrobe-apps)
[Whering vs. Indyx](https://www.myindyx.com/versus/whering-vs-indyx)
[Indyx Cost Per Wear](https://www.myindyx.com/blog/what-is-cost-per-wear)
[Indyx App Review (Conscious by Chloe)](https://consciousbychloe.com/2025/11/19/indyx-app-review/)
[Smart Closet App Store](https://apps.apple.com/us/app/smart-closet-your-stylist/id1198057728)
[Save Your Wardrobe](https://play.google.com/store/apps/details?id=com.saveyourwardrobe.syw&hl=en_US)
[The Best Wardrobe Apps 2026: Compared & Ranked](https://www.altadaily.com/blog/closet-apps-2026)

### 3.2 メルカリ・ヤフオク文化での自前管理

- 国内ユーザーは **Notion / スプレッドシート で自前管理** が多数派
- Notion テンプレが多数販売されている (Notion Marketplace, Etsy)
- **古着実寸を比較 + 上限価格管理 + Failure Log** を組み合わせたモバイルアプリは見つからず → **Seam の Niche は完全に空白**

[All in One Wardrobe Manager Notion](https://www.notion.com/templates/all-in-one-wardrobe-manager-and-organizer)
[Ultimate Wardrobe & Closet Management Notion](https://www.notion.com/templates/ultimate-wardrobe-closet-management)
[Notion Wardrobe Templates 集](https://gridfiti.com/notion-wardrobe-templates/)

### 3.3 Seam 独自要素のオリジナリティ

| Seam 独自要素 | 既存アプリでの存在 | 差別化度 |
|---------------|-------------------|---------|
| 古着の **実寸 (肩幅/身幅/着丈/袖丈/裄丈)** 管理 | 確認できず | ◎ 完全オリジナル |
| **Fit Anchor** (理想サイズの基準アイテム) | 確認できず | ◎ |
| **Personal NG Measurement Rule** | 確認できず | ◎ |
| Buy / Watch / **Skip 判断ログ** | Indyx に類似 (resell 視点) | ○ |
| **Failure Log** (買って失敗した理由) | 確認できず | ◎ |
| Max Bid / 上限価格管理 (オークション特化) | 確認できず | ◎ |
| **Brand Notes / Checklist** (Russell, Dickies 等) | 確認できず | ◎ |
| Cost Per Wear | Indyx (ネイティブ), 一部に手動 | ○ |
| Text からの実寸抽出 | 確認できず | ◎ |

→ **「古着 × 購買判断 × 実寸比較」は完全に空白市場**。設計の方向性は強く支持される。

### 3.4 ユーザーレビューから学ぶ既存アプリの弱点

- **Stylebook**: 「タグ付けが面倒」「写真クロップに時間がかかる」 → Seam は片手入力 / 写真なしでも登録可、を UI 原則に置いており方向性◎
- **Indyx**: 「機能追加が遅い」「重要機能が paywall 裏」 → Seam は個人用なので不要
- **Save Your Wardrobe**: 「最近機能が削減された」「US サイズ対応が壊れている」 → Seam の単位扱い (cm/inch/JP/US/UK/EU) の設計は妥当
- **Smart Closet**: 「アップデートが止まっている」 → 個人用なら問題なし

---

## 4. ドメイン特化の知見

### 4.1 古着実寸の業界標準

国内古着販売 (カンフル等) で広く使われる定義:

| 寸法 | 定義 |
|------|------|
| 肩幅 | 肩先から肩先までの直線距離 |
| 身幅 | 両袖の付け根下の直線距離 (胸囲 = 身幅 × 2) |
| 着丈 | バックネックポイントから裾までの直線距離 (衿は含まない) |
| 袖丈 | 肩先から袖口までの直線距離 |
| 裄丈 | バックネックポイントから肩を通って袖口までの距離 (= 半身分の腕長 + 半肩幅) |

**注意点**:
- ブランド・年代でサイズ感がバラつく → 表記サイズより実寸を信頼するという Seam の方針は業界一般的
- 「身丈 = 肩から裾」と「着丈 = バックネックから裾」を混同するショップもあり、表記揺れに注意
- 1〜2cm の誤差は業界慣習として許容される → Compare の severity threshold (±1cm: same, ±2-3cm: close) は妥当

[サイズについて (カンフル)](https://shopping.geocities.jp/kanful/v/01/info/measure.html)
[詳しい採寸方法とサイズガイド (高島屋)](https://www.t-fashion.jp/size-guide)
[着丈と身丈の違い](https://www.edvan-print.com/column/difference-between-length-and-height)
[裄丈とは - 着物 (参考)](https://kimono-rentalier.jp/column/kimono/yukitaketoha/)

### 4.2 商品説明テキストからの実寸抽出

- メルカリ・ヤフオクの実寸記法には強い慣習があるが **公式の OSS パッケージは見つからず**
- 国内の OCR / スクレイピングサービス (Octoparse 等) は「商品全体の取得」が目的で、実寸抽出は対象外
- → **Seam の `extractMeasurementsFromText()` は自前実装が妥当**

**実装提言: 抽出パターン例 (正規表現)**:

```typescript
// 単純パターン（縦軸スペース区切り）
/(肩幅|身幅|着丈|袖丈|裄丈|ウエスト|股上|股下|ワタリ|膝幅|裾幅|総丈)\s*[：:]?\s*(?:約)?\s*(\d{1,3}(?:\.\d)?)\s*(cm|センチ)?/gi

// 全角数字対応
/(肩幅|身幅|着丈)\s*[：:]?\s*(?:約)?\s*([\d０-９]{1,3}(?:\.\d)?)/gi
```

**よくある記法バリエーション**:
- `肩幅 58` / `肩幅：58cm` / `肩幅: 約58cm` / `肩幅 約58.5`
- `肩幅　58cm` (全角スペース)
- `身幅 60／着丈 66／袖丈 61` (スラッシュ区切り)
- 表形式（HTML table）
- リスト ("・肩幅 58cm")

**confidence の付け方**:
- 単位 (cm) があるほど高い
- カテゴリ既知の項目数 / 期待項目数 の比
- 数値の妥当範囲チェック (例: パーカーの身幅が 200cm はあり得ない)

→ **v1 では「9 割の素直なテンプレ」だけ拾い、抽出失敗時はユーザーが手で埋める** 方針が現実的。設計書の §18 と整合。

### 4.3 Cost Per Wear の計算式

基本式:
```
CPW = 総コスト / 着用回数
```

拡張式（業界一般）:
```
CPW = (購入価格 + ケア費用 - 売却見込価格) / 着用回数
```

判断基準: **CPW < $5 (約 750 円)** で「妥当な投資」とされることが多い。

**Seam の設計提言**:
- v1 は basic 式で十分（設計書 §20 と整合）
- 古着には「**売却前提**」の使い方が多いため、`SaleInfo.soldPrice` が確定したら **net CPW = (totalPrice - soldPrice) / wearCount** を別表示する拡張余地あり
- Indyx は CPW を outfit calendar から自動算出。Seam は手動 wear log だが、calendar UI を将来追加すると入力負荷が下がる

[Cost Per Wear - Indyx](https://www.myindyx.com/blog/what-is-cost-per-wear)
[Cost Per Wear: Maximizing Value from Your Wardrobe](https://thewelldressedlife.com/understanding-cost-per-wear/)
[CPW Formula Variations (Pretty Planeteer)](https://theprettyplaneteer.com/cost-per-wear-the-true-cost-of-your-clothes/)

### 4.4 ブランドガイドの参考サイト

**Russell Athletic**:
- 製造国: USA / Mexico / Honduras (古さ順)
- 1950s: シンプルなタグ + "Made in U.S.A." + "Sanforized"/"Shrink-Proof"
- 1960s: フォント・レイアウトに小変更、新ロゴ + 組成表記
- 1970s: "Made in the U.S.A." + 75/25 or 50/50 cotton/poly、タグ長め、**'Eagle R' ロゴ正式採用**
- 1980s: "Russell Athletic" 大文字、ケアラベル付き

[Vintage Russell Athletic Tag Guide (Defunkd)](https://www.defunkd.com/blog/2010/12/02/russell-athletic/)
[How to tell if Russell Athletic is vintage (VCG)](https://vintageclothingguides.com/tags-labels/how-to-tell-if-russell-athletic-is-vintage/)
[Russell Athletic Tag Timeline by Year (Neon Vintage)](https://neonvtg.com/blogs/shirt-tag-label-history/russell-athletic-clothing-tag-timeline-by-year)
[Tips & Tricks to Buy True Russell Athletic Vintage Crewnecks (Black Market Toronto)](https://blackmarkettoronto.com/blogs/news/how-to-know-if-your-russell-athletic-sweatshirt-is-vintage)

**Dickies 874**:
- Original Fit, 高め rise, ストレートレッグ + わずかなテーパー
- "やや小さめに作られている" 報告多数 → 大きめが好みなら +2 サイズ推奨
- 873 は mid-rise / slim-straight, より現行モダンシルエット
- 旧個体と現行で股下・裾幅のシルエット差あり、ヴィンテージは裾オリジナル要確認 (リブカット痕等)

[Dickies 874 size chart 公式](https://www.dickies.com/en-us/pages/874-size-chart)
[How Do Dickies 874's Fit (Urban Industry)](https://www.urbanindustry.co.uk/blogs/news/how-do-dickies-874s-fit)
[Dickies Fit Guide - Slam City](https://www.slamcity.com/en-us/pages/dickies-fit-guide)
[Dickies 874 Sizing (Work Wear Command)](https://workwearcommand.com/dickies-874-sizing/)

**ナレッジサイトとして参考にできるドメイン**:
- defunkd.com (vintage tag guides)
- vintageclothingguides.com
- neonvtg.com (tag timelines)
- workwearcommand.com (workwear specific)
- urbanindustry.co.uk (fit guides)

---

## 5. 画像保存戦略

### 5.1 保存場所のベストプラクティス

| 場所 | 用途 | 永続性 | 推奨度 |
|------|------|--------|--------|
| `FileSystem.documentDirectory` | アプリ自身が作る/保持する画像 | OS 削除なし | ◎ アイテム画像 |
| `FileSystem.cacheDirectory` | サムネイル等の再生成可能データ | OS が自動削除し得る | ◎ サムネイル |
| Photo Library 参照 (PHAsset URI) | iOS 写真 App と共有 | ユーザーが写真削除でリンク切れ | × Seam では非推奨 |

> "The document directory is a place to store files that are safe from being deleted by the system, making it ideal for persistent image storage."

[FileSystem - Expo Documentation](https://docs.expo.dev/versions/latest/sdk/filesystem/)
[ImagePicker - Expo Documentation](https://docs.expo.dev/versions/latest/sdk/imagepicker/)
[How to Save Files to a Device Folder using Expo and React-Native (Farhan)](https://www.farhansayshi.com/post/how-to-save-files-to-a-device-folder-using-expo-and-react-native/)

### 5.2 推奨アーキテクチャ

```
documentDirectory/
  items/
    {itemId}/
      original_{photoId}.jpg
      thumb_{photoId}.jpg     ← 256px 程度の縮小版
```

- DB には `documentDirectory + 相対パス` ではなく **相対パスのみ保存**（OS update で documentDirectory のフルパスが変わるため）
- 表示時に `FileSystem.documentDirectory + storedPath` で組み立てる
- サムネイルは `expo-image-manipulator.manipulate({ resize: { width: 256 } })` で生成し cache 配下に
- `expo-image` の `cachePolicy="disk"` で OS レベルキャッシュも併用

[ImageManipulator - Expo Documentation](https://docs.expo.dev/versions/latest/sdk/imagemanipulator/)
[Image - Expo Documentation](https://docs.expo.dev/versions/latest/sdk/image/)

### 5.3 アプリ削除時のデータ消失対策

**問題**: iOS で **アプリ削除すると documentDirectory も全消去**。Seam の設計では数ヶ月〜数年分の購入履歴・写真が消える致命的リスク。

**対策**:
1. **JSON Export を習慣化** (設計書 §25)
   - Settings → Export で JSON + 画像 zip を `Files` App に書き出し
   - iCloud Drive / On My iPhone 経由でクラウド退避
2. **EAS Update で警告ダッシュボード**
   - 30 日以上 Export していなければ Settings に赤バッジ
3. **画像の Photo Library への並行保存 (オプション)**
   - `MediaLibrary.saveToLibraryAsync(uri)` で写真 App にも保存
   - ユーザーが写真 App 経由で iCloud Photos に上がる → 結果的にバックアップ
4. **iOS 14+ の Backup Exclusion を外す**
   - documentDirectory はデフォルトで iCloud バックアップ対象。`expo-file-system` で明示的に backup 対象にしておく

### 5.4 Photo Library との連携

- **コピー保存** (推奨): `ImagePicker` で取得した tmp URI を `FileSystem.copyAsync()` で documentDirectory にコピー
  - 利点: ユーザーが写真 App で削除しても残る
  - 欠点: ストレージ二重消費
- **参照保存**: PHAsset の identifier を保存
  - 利点: ストレージ節約
  - 欠点: 写真削除で死ぬ。Seam の長期保存ユースケースに不適

→ **Seam は完全コピー保存を推奨**（設計書の "画像は端末ローカルにコピーして保存" の方針と一致 ◎）

[Use an image picker - Expo Documentation](https://docs.expo.dev/tutorial/image-picker/)
[MediaLibrary - Expo Documentation](https://docs.expo.dev/versions/latest/sdk/media-library/)

---

## 6. Seam の設計に対する Web 知見からの提言

### 6.1 DB 設計の最終提言

**Phase 1〜8 を expo-sqlite + Drizzle ORM で完走することを強く推奨**。

理由:
1. 古着現場（弱電波・地下店舗）でのオフライン利用要件
2. Compare 画面の <100ms 要件（Neon HTTP では達成困難）
3. 個人用 EAS Internal Distribution で DATABASE_URL を端末に置くセキュリティ実害
4. 設計書の "画像は端末ローカル" 方針との整合性
5. Drizzle 公式が Expo SQLite を first-class サポート、`useLiveQuery` 完備

**Neon DB の使いどころ（後付け）**:
- iCloud Drive Export が物足りなくなった時の **クラウドバックアップ先**
- 複数端末 (iPad + iPhone) で使いたくなった時の **sync hub**
- いずれも **PowerSync 経由で expo-sqlite を primary に** 維持する形が安全

### 6.2 設計書への具体的な変更提案

| 設計書の項目 | 現状 | 提言 |
|--------------|------|------|
| §4 Tech Stack | "SQLite" → "Neon DB" 変更が起きた | **expo-sqlite に戻す**、Neon は Phase 9 以降の拡張で検討 |
| §4 Architecture Policy | "ローカルファースト" 維持 | **維持。Neon を一次 DB にすると矛盾する** |
| §8 Photos | "端末ローカルにコピー" | **documentDirectory + 相対パス保存** に明記 |
| §18 Text Extraction | confidence 算出が抽象的 | **単位有無 / 期待項目数比 / 値域チェック** の 3 軸を実装規約に |
| §20 CPW | basic 式のみ | **net CPW (売却後)** を将来オプションに |
| §25 Export/Import | JSON / CSV | **画像 zip Export を Phase 8 で対応** (アプリ削除リスク対応として) |
| Settings | data reset | **30 日以上 Export していない時の警告バッジ** を追加 |

### 6.3 競合分析からの戦略的提言

- **「古着 × 実寸 × 購買判断」は完全に空白市場**。Seam のコンセプトは強く支持される
- 公開の予定がなくても、**App Store 公開時のキャッチコピーは「クローゼット管理ではなく、買う前に止める」** が効く。Whering 等との明確な差別化軸
- 競合の弱点 (タグ付け面倒・paywall・更新停滞) を反面教師に、**最低限の登録で価値が出る UX** を維持する

### 6.4 実装上の追加提言

1. **Brand Guide のシード**: Russell Athletic, Dickies 874 はリサーチ結果からテンプレを生成可能 → 初回起動時に seed
2. **Measurement Extraction**: 設計書 §18 のサンプル入力を増やす。テストパターンとして以下を追加すべき:
   - 全角スペース / 全角数字
   - 表形式 (HTML table)
   - 改行なしスラッシュ区切り
3. **Compare の severity しきい値**: 業界の "1〜2cm 誤差は許容" と整合 (設計書 §11 と OK)
4. **Personal NG Rule の初期テンプレ**: 設計書 §12 の例を seed として配布。初回起動でユーザーに「自分用に編集してね」を促す
5. **画像保存パス**: DB には **相対パスを保存** (絶対パスは OS update で変わる)

---

## 参考ソース

| # | カテゴリ | ソース名 | URL | 取得 | 信頼性 |
|---|---------|---------|-----|------|--------|
| 1 | Local-first | Expo Local-first guide | https://docs.expo.dev/guides/local-first/ | WebSearch | 高 |
| 2 | Local-first | What synced in-app SQLite brings to Expo apps | https://expo.dev/blog/what-synced-in-app-sqlite-brings-to-expo-apps | WebSearch | 高 |
| 3 | Neon | Neon Pricing | https://neon.com/pricing | WebSearch | 高 |
| 4 | Neon | Neon plans | https://neon.com/docs/introduction/plans | WebSearch | 高 |
| 5 | Neon | Neon Latency Benchmark | https://neon-latency-benchmarks.vercel.app/ | WebSearch | 高 |
| 6 | Neon | Benchmarking latency in Neon | https://neon.com/docs/guides/benchmarking-latency | WebSearch | 高 |
| 7 | Neon | HTTP vs WebSockets at the Edge | https://neon.com/blog/http-vs-websockets-for-postgres-queries-at-the-edge | WebSearch | 高 |
| 8 | Neon | Connection latency and timeouts | https://neon.com/docs/connect/connection-latency | WebSearch | 高 |
| 9 | Neon | Neon serverless driver | https://neon.com/docs/serverless/serverless-driver | WebSearch | 高 |
| 10 | Neon | Choosing connection method | https://neon.com/docs/connect/choose-connection | WebSearch | 高 |
| 11 | Neon | How to Make the Most of Neon's Free Plan | https://neon.com/blog/how-to-make-the-most-of-neons-free-plan | WebSearch | 高 |
| 12 | Sync | PowerSync RN/Expo SDK | https://docs.powersync.com/client-sdks/reference/react-native-and-expo | WebSearch | 高 |
| 13 | Sync | ElectricSQL vs PowerSync | https://www.powersync.com/blog/electricsql-vs-powersync | WebSearch | 中 |
| 14 | Sync | The Spectrum of Local First Libraries | https://tolin.ski/posts/local-first-options | WebSearch | 中 |
| 15 | Sync | localfirst_react_server (Neon + PowerSync example) | https://github.com/guillempuche/localfirst_react_server | WebSearch | 中 |
| 16 | Sync | RxDB SQLite RxStorage | https://rxdb.info/rx-storage-sqlite.html | WebSearch | 中 |
| 17 | Sync | RxDB Mobile App Use | https://rxdb.info/articles/mobile-database.html | WebSearch | 中 |
| 18 | Drizzle | Drizzle Expo SQLite | https://orm.drizzle.team/docs/connect-expo-sqlite | WebSearch | 高 |
| 19 | Drizzle | Drizzle React Native SQLite | https://orm.drizzle.team/docs/connect-react-native-sqlite | WebSearch | 高 |
| 20 | Drizzle | Drizzle Neon | https://orm.drizzle.team/docs/connect-neon | WebSearch | 高 |
| 21 | Drizzle | LogRocket: Drizzle and React Native | https://blog.logrocket.com/drizzle-react-native-expo-sqlite/ | WebSearch | 中 |
| 22 | Drizzle | Israa Taha local-first guide | https://israataha.com/blog/build-local-first-app-with-expo-sqlite-and-drizzle/ | WebSearch | 中 |
| 23 | Drizzle | Israa Taha example repo | https://github.com/israataha/expo-sqlite-drizzle | WebSearch | 中 |
| 24 | Drizzle | DETL offline-first production | https://medium.com/@detl/building-an-offline-first-production-ready-expo-app-with-drizzle-orm-and-sqlite-f156968547a2 | WebSearch | 中 |
| 25 | RN Security | OWASP M1 in RN/Expo | https://dev.to/jocanola/understanding-owasp-m1-2024-improper-credential-usage-in-react-nativeexpo-and-how-to-mitigate-it-2657 | WebSearch | 中 |
| 26 | RN Security | RN Security guide | https://reactnative.dev/docs/security | WebSearch | 高 |
| 27 | RN Security | Folio3 Secure Mobile Credentials | https://www.folio3.com/mobile/blog/secure-mobile-app-credentials-in-react-native/ | WebSearch | 中 |
| 28 | RN Security | LogRocket RN Security | https://blog.logrocket.com/understanding-security-react-native-applications/ | WebSearch | 中 |
| 29 | RN Issues | fetch streams not in RN core | https://github.com/facebook/react-native/issues/27741 | WebSearch | 高 |
| 30 | RN Issues | Drizzle Neon install bug | https://github.com/drizzle-team/drizzle-orm/issues/2523 | WebSearch | 高 |
| 31 | Image | Expo FileSystem | https://docs.expo.dev/versions/latest/sdk/filesystem/ | WebSearch | 高 |
| 32 | Image | Expo ImagePicker | https://docs.expo.dev/versions/latest/sdk/imagepicker/ | WebSearch | 高 |
| 33 | Image | Expo ImageManipulator | https://docs.expo.dev/versions/latest/sdk/imagemanipulator/ | WebSearch | 高 |
| 34 | Image | Expo Image | https://docs.expo.dev/versions/latest/sdk/image/ | WebSearch | 高 |
| 35 | Image | Expo MediaLibrary | https://docs.expo.dev/versions/latest/sdk/media-library/ | WebSearch | 高 |
| 36 | Image | Farhan: Save files to device folder | https://www.farhansayshi.com/post/how-to-save-files-to-a-device-folder-using-expo-and-react-native/ | WebSearch | 中 |
| 37 | Image | wcandillon: 5 things to know about images RN | https://medium.com/@wcandillon/5-things-to-know-about-images-react-native-69be41d2a9ee | WebSearch | 中 |
| 38 | Competitor | Whering best wardrobe apps | https://whering.co.uk/best-wardrobe-apps-2025 | WebSearch | 中 |
| 39 | Competitor | Indyx wardrobe apps comparison | https://www.myindyx.com/blog/the-best-wardrobe-apps | WebSearch | 中 |
| 40 | Competitor | Whering vs Indyx | https://www.myindyx.com/versus/whering-vs-indyx | WebSearch | 中 |
| 41 | Competitor | Indyx CPW | https://www.myindyx.com/blog/what-is-cost-per-wear | WebSearch | 中 |
| 42 | Competitor | Indyx App Review | https://consciousbychloe.com/2025/11/19/indyx-app-review/ | WebSearch | 中 |
| 43 | Competitor | Smart Closet App Store | https://apps.apple.com/us/app/smart-closet-your-stylist/id1198057728 | WebSearch | 高 |
| 44 | Competitor | Save Your Wardrobe Play Store | https://play.google.com/store/apps/details?id=com.saveyourwardrobe.syw&hl=en_US | WebSearch | 高 |
| 45 | Competitor | Closet apps 2026 (Alta) | https://www.altadaily.com/blog/closet-apps-2026 | WebSearch | 中 |
| 46 | Competitor | Top 8 Closet apps reviewed | https://www.fits-app.com/posts/top-8-closet-outfit-planning-apps-reviewed | WebSearch | 中 |
| 47 | Notion | All in One Wardrobe Notion | https://www.notion.com/templates/all-in-one-wardrobe-manager-and-organizer | WebSearch | 高 |
| 48 | Notion | Ultimate Wardrobe Notion | https://www.notion.com/templates/ultimate-wardrobe-closet-management | WebSearch | 高 |
| 49 | Notion | Gridfiti Wardrobe Templates | https://gridfiti.com/notion-wardrobe-templates/ | WebSearch | 中 |
| 50 | Domain | カンフル サイズについて | https://shopping.geocities.jp/kanful/v/01/info/measure.html | WebSearch | 中 |
| 51 | Domain | 高島屋 サイズガイド | https://www.t-fashion.jp/size-guide | WebSearch | 中 |
| 52 | Domain | 着丈と身丈の違い | https://www.edvan-print.com/column/difference-between-length-and-height | WebSearch | 中 |
| 53 | Domain | 裄丈 解説 | https://kimono-rentalier.jp/column/kimono/yukitaketoha/ | WebSearch | 中 |
| 54 | Domain | Defunkd Russell Athletic | https://www.defunkd.com/blog/2010/12/02/russell-athletic/ | WebSearch | 中 |
| 55 | Domain | VCG Russell Athletic | https://vintageclothingguides.com/tags-labels/how-to-tell-if-russell-athletic-is-vintage/ | WebSearch | 中 |
| 56 | Domain | Neon Vintage Russell Tag Timeline | https://neonvtg.com/blogs/shirt-tag-label-history/russell-athletic-clothing-tag-timeline-by-year | WebSearch | 中 |
| 57 | Domain | Black Market Toronto Russell | https://blackmarkettoronto.com/blogs/news/how-to-know-if-your-russell-athletic-sweatshirt-is-vintage | WebSearch | 中 |
| 58 | Domain | Dickies 874 Size Chart 公式 | https://www.dickies.com/en-us/pages/874-size-chart | WebSearch | 高 |
| 59 | Domain | Urban Industry Dickies 874 Fit | https://www.urbanindustry.co.uk/blogs/news/how-do-dickies-874s-fit | WebSearch | 中 |
| 60 | Domain | Slam City Dickies Fit Guide | https://www.slamcity.com/en-us/pages/dickies-fit-guide | WebSearch | 中 |
| 61 | Domain | Work Wear Command Dickies 874 | https://workwearcommand.com/dickies-874-sizing/ | WebSearch | 中 |
| 62 | CPW | The Well Dressed Life CPW | https://thewelldressedlife.com/understanding-cost-per-wear/ | WebSearch | 中 |
| 63 | CPW | Pretty Planeteer CPW | https://theprettyplaneteer.com/cost-per-wear-the-true-cost-of-your-clothes/ | WebSearch | 中 |

---

## 補足・注意事項

### 留意点
- **Neon DB を維持する強い動機が要件として確定している場合** は、本レポートの提言は再評価が必要。例えば「複数端末同期がリリース時必須」「家族と closet を共有する」等が決まっているなら expo-sqlite は単独では不可
- **設計書のフレーズ「ローカルファースト」「画像は端末ローカル保存」「認証なし」「個人用」** はすべて expo-sqlite を前提にしないと整合しない。Neon 採用は要件追加の意思を含む
- 本レポートは 2026-04 時点の情報。Neon の Data API、PowerSync の RN サポートは急速に進化中
- 古着実寸抽出のための既存 OSS は確認できなかった。**Seam の `extractMeasurementsFromText()` は完全自前実装になる**

### 次のアクション提案
1. **DB 選択の確定**: Neon 採用の動機 (要件) を再確認 → 動機が薄ければ expo-sqlite に戻す
2. **DB を Neon で進める場合**: PowerSync を組み合わせるアーキテクチャを Phase 1 で確定 (後付けは難しい)
3. **画像保存の規約決定**: documentDirectory + 相対パスのルールを Phase 1 で決める
4. **ブランドガイドの初期 seed**: Russell / Dickies 874 はリサーチ結果からテンプレ生成して Phase 7 で投入
5. **Measurement extraction のテストデータ**: メルカリ/ヤフオクの実商品説明 30〜50 件を集め、抽出精度の評価セットを作る

---

保存先: `/Users/shingosato/dev/src/github.com/sugarshin/seam/plan/20260426_seam-design-evaluation/web-research-agent.md`
