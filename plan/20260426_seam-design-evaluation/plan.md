# Seam 設計評価レポート（改訂版 v2）

**評価日**: 2026-04-26（v2 改訂: 2026-04-26）
**評価対象**: `plan/initial-plan.md` (1549行)
**評価者**: Deep Plan (4 SubAgent 並列調査) + ユーザー方針確定

## ユーザー確定方針（v2 で反映）

| 項目 | 確定内容 |
|------|---------|
| DB | **ローカル `expo-sqlite` + Drizzle のみ**（Neon DB は不採用） |
| クラウド連携 | **無し**（BFF・Cloudflare Workers・R2 すべて不要） |
| バックアップ戦略 | **iOS 自動バックアップ + JSON+画像 Export** の2段構え |
| Monorepo | **維持**。`packages/app`, `packages/domain`, `packages/shared` の3構成 |
| Terraform / infra | **不要**（クラウドリソース無し） |
| 認証 | **無し**（個人用・端末完結） |

---

## Summary

Seam の設計コンセプト（古着の購買判断支援、Fit Anchor、Personal NG Rule、Failure Log）は **競合プロダクト調査からも完全に空白市場**を狙えており、戦略的に強く支持できる。技術的には **ローカル SQLite 単独構成**が個人用・オフライン現場利用・セキュリティ・コスト・運用すべての観点で最適解であり、設計書 initial-plan.md の元々の「ローカルファースト・認証なし」前提と完全に整合する。一方、設計書の章レベルではデータモデル・スコアリング・画面要件に多数の未定義・矛盾箇所があり、改訂が必要。

本レポートは、(1) 設計書を5段階で総合評価し、(2) ローカル SQLite + Monorepo 3パッケージ構成の **推奨アーキテクチャ**を提示し、(3) initial-plan.md を改訂すべき箇所を章別に列挙する。

---

## 総合評価スコア（5段階）

| 観点 | スコア | 主な理由 |
|------|------|---------|
| プロダクト戦略・コア価値 | ★★★★★ | 完全な空白市場。「買う前に止める」という独自軸 |
| データモデル | ★★★☆☆ | 大枠は妥当だが、状態遷移・FK・型集中管理が未定義 |
| ドメインロジック | ★★☆☆☆ | Score 合成式・severity 単位・閾値根拠がほぼ未定義 |
| 技術スタック妥当性 | ★★★★☆ | **元設計の SQLite ローカルファーストが最適**。バックアップ戦略の明文化のみ要 |
| スコープ・フェーズ分割 | ★★★★☆ | Phase 1〜8 構成は現実的。Fit Anchor の配置だけ要見直し |
| UX・主要動線 | ★★★☆☆ | 方針は明確だが Candidate New 等の画面要件が抜け |
| 抜け漏れ・テスト・運用 | ★★☆☆☆ | テスト戦略・エラー処理・i18n・TZ・通貨・a11y 全欠落 |

---

## Research Insights

### Official Documentation（context7-doc-researcher）

- **Drizzle 公式は React Native では `drizzle-orm/expo-sqlite` を明示的に推奨**:
  > "Please use Expo SQLite to run Drizzle ORM with React Native apps."
- `useMigrations()` フックでアプリ起動時にスキーマ適用、`useLiveQuery()` で UI 自動再描画
- **Expo SDK 54 安定版 / 55 Beta**。SDK 54 を推奨（New Architecture デフォルト ON）
- **EAS Internal Distribution** は **Apple Developer Program (年 $99 USD)** が必須 → 設計書未記載
- **expo-file-system** の `documentDirectory` は再インストール時にパスが変わる → DB には**相対パス保存**必須
- **Zod v4 + `z.infer`** で TypeScript 型を一元化できる → 設計書の手書き型を置換推奨
- **Expo Router の `experiments.typedRoutes: true`** を初期から有効化推奨
- ライブラリは Expo SDK 54 / 55 で全て採用可（Zustand v5, Zod v4, RHF, expo-image-picker/file-system/notifications, date-fns）

### Codebase Analysis（codebase-investigator）

**現状コードベース**:
- コードは未着手。`README.md` 1行、`.gitignore` は Xcode テンプレ（Expo 用ではない）
- `plan/initial-plan.md` のみ存在。今が方針修正の最適タイミング

**設計書の内部整合性問題（重大）**:

| カテゴリ | 主要問題 |
|---------|---------|
| ItemStatus | `bought` vs `owned`、`wishlist` vs `watching` の境界が未定義。状態遷移図なし |
| Measurement | `inch ↔ cm` 変換ロジックなし。`MeasurementKey` の集中管理（enum）がない。Shoes は単位混在（jp/us/uk/eu/cm が同一 itemId に並ぶ） |
| BrandChecklistState | 29章のテーブル一覧にあるが17章に型定義なし |
| PK/FK/cascade | items 削除時の measurements/photos のカスケード方針なし。複合 PK・index 戦略も未定義 |
| Buy Judgment Score | **5因子の重み・各因子レンジ・合成式が完全未定義**。実装不能 |
| Severity Rule | `±1cm = same` を全カテゴリ一律で適用しており不適切（waist 80cm の ±1cm と outsole 28cm の ±1cm は意味が違う）。**percent ベース閾値**併用が必要 |
| 画面抜け | Tag 管理 / Reminder 一覧 / Wear Log 一覧 / PriceSnapshot 履歴 / **Candidate New** が全部未定義 |
| 22章 vs 28.7 Stats | 項目数が不一致（22章16項目 vs 28.7 12項目） |
| Phase 4 | Fit Anchor 登録機能が含まれているが Phase 2 (Item Detail) にあるべき。Acceptance Criteria #6 達成が遅れる |
| 構造的欠落 | テスト戦略 / エラーハンドリング / 画像最適化・lifecycle / マイグレーション運用 / i18n / TZ / 通貨 / a11y / dev-prod 分離 / Settings の Data reset 仕様 |

### Web Research（web-research-agent + claude-web-researcher 統合）

**ローカル SQLite 単独構成の優位性（個人用での評価）**:

| 観点 | 評価 |
|------|------|
| オフライン動作 | ◎ 古着現場（店内・地下・弱電波）で完全動作 |
| Compare 画面レイテンシ | ◎ <1ms（メモリマップド I/O） |
| 単一端末ユースケース | ◎ 設計書の「個人用」前提と完全一致 |
| バックアップ | iOS 自動 Backup + JSON Export で実用十分 |
| セキュリティリスク | 低（端末内のみ・credential 不要） |
| Drizzle ORM サポート | ◎ 公式 first-class（`drizzle-orm/expo-sqlite`） |
| 月次運用コスト | 0 円 |
| 設計書「ローカルファースト」前提 | ◎ 完全整合 |
| 実装難度 | 低（BFF / sync / 認証すべて不要） |

**競合プロダクト調査**:
- Whering / Cladwell / Indyx / Stylebook / Save Your Wardrobe 等は**全て outfit planning 中心**
- **「古着 × 実寸 × 購買判断 × Failure Log」を組み合わせたモバイルアプリは存在しない** → Seam の独自性は完全に確立
- 国内ヤフオク/メルカリ文化は Notion + スプレッドシート文化のみ → モバイル特化の余地大
- Cost Per Wear ネイティブ実装は Indyx のみ。日本市場には未到達

**ドメイン知見**:
- 古着業界の実寸は「肩幅・身幅・着丈・袖丈・裄丈」が標準。設計書 §7.2 と整合
- 「身丈 = 肩から裾」と「着丈 = バックネックから裾」は混同されがち → ヘルプ文必要
- 1〜2cm の誤差は業界慣習として許容 → §11 severity の `±1cm: same / ±2-3cm: close` は妥当
- 商品説明テキストからの実寸抽出 OSS は**国内外とも見当たらず** → §18 は完全自前実装、テストパターン充実が鍵
- Russell Athletic / Dickies 874 のヴィンテージ判定情報源あり → §17 Brand Guide の seed に活用可

**画像保存ベストプラクティス**:
- `FileSystem.documentDirectory` 配下に**コピー保存**（Photo Library 参照は写真削除でリンク切れ）
- DB には**相対パス**保存（OS update で絶対パスが変わる）
- サムネイルは `expo-image-manipulator` + `cacheDirectory`
- アプリ削除で消失 → JSON Export 習慣化、30日警告バッジ提案

---

## Recommended Approach

### A. アーキテクチャ確定（ローカル SQLite 単独）

```
┌─────────────────────────────────────────────────────────┐
│ packages/app  (Expo / React Native iOS App)            │
│   ├─ expo-sqlite + Drizzle (single source of truth)    │
│   ├─ documentDirectory に画像コピー (相対パス保存)      │
│   ├─ expo-notifications (auctionEndsAt リマインド)      │
│   └─ Settings → JSON+画像 Export (Files App 経由)       │
└──────────────────────┬──────────────────────────────────┘
                       │ ※外部通信なし
                       ▼
            iOS Backup (自動) → iCloud
            Files App (手動 Export) → iCloud Drive
```

**バックアップ戦略（2段構え）**:

| 層 | 仕組み | 役割 |
|----|------|------|
| 1. iOS 自動 Backup | `documentDirectory` は iOS の iCloud Backup 対象（既定 ON） | 端末紛失・故障・買い替え時の自動復元。SQLite ファイル & 画像がそのまま戻る |
| 2. JSON+画像 Export | Settings からユーザーが任意のタイミングで実行、`Files` App に書き出し | アプリ削除や iCloud Backup 無効ユーザーへの保険、データの可搬性確保 |

- iOS Backup を効かせるため `setNoBackupAttributeAsync(false)` を明示
- Export は **Phase 1 から最小実装**（Phase 9 まで遅らせない）して「保険」として常時稼働
- 30 日以上 Export していなければ Settings に警告バッジを表示

**この構成のメリット**:
- 古着現場（店内・地下・弱電波）で全機能が即応
- credential を持たない = 漏洩リスクゼロ
- 月次運用コスト 0 円
- BFF / Sync / 認証ロジックが全て不要 → 実装範囲が劇的に縮小
- 設計書 §4 の「ローカルファースト・認証なし」と完全整合

### B. Monorepo 構成（3 パッケージ）

```
seam/                                  ← repository root
├── package.json                       ← workspaces 宣言
├── pnpm-workspace.yaml
├── turbo.json                         ← Turborepo (ビルド/テスト並列化)
├── tsconfig.base.json                 ← 共通 strict 設定
├── .gitignore                         ← Expo + Node 用に書き直し
├── .env.example
├── README.md                          ← セットアップ手順
│
├── packages/
│   ├── app/                           ← Expo iOS アプリ
│   │   ├── app.json
│   │   ├── eas.json                   ← internal distribution profile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── app/                       ← Expo Router (file-based)
│   │   │   ├── _layout.tsx
│   │   │   ├── (tabs)/
│   │   │   │   ├── _layout.tsx
│   │   │   │   ├── index.tsx          ← Home
│   │   │   │   ├── closet.tsx
│   │   │   │   ├── wishlist.tsx
│   │   │   │   ├── compare.tsx
│   │   │   │   ├── stats.tsx
│   │   │   │   └── settings.tsx
│   │   │   ├── item/
│   │   │   │   ├── [id].tsx
│   │   │   │   └── new.tsx
│   │   │   └── candidate/
│   │   │       ├── [id].tsx
│   │   │       └── new.tsx
│   │   └── src/
│   │       ├── db/                    ← expo-sqlite + Drizzle client / schema
│   │       │   ├── client.ts
│   │       │   ├── schema.ts
│   │       │   └── migrations/        ← drizzle-kit generate 出力
│   │       ├── repositories/          ← itemRepository 等 (DB アクセス層)
│   │       ├── stores/                ← Zustand (UI セッション状態のみ)
│   │       ├── components/
│   │       ├── hooks/                 ← useLiveQuery 等
│   │       ├── photos/                ← FileSystem ラップ + 相対パス管理
│   │       ├── backup/                ← Export / Import
│   │       └── notifications/         ← expo-notifications ラップ
│   │
│   ├── domain/                        ← フレームワーク非依存の pure 関数
│   │   ├── package.json               ← expo / react に依存しない
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── compare/               ← compareMeasurements, getDiffSeverity
│   │       ├── scoring/               ← calculateCandidateScore (5因子)
│   │       ├── extraction/            ← extractMeasurementsFromText (正規表現)
│   │       ├── pricing/               ← calculateTotalPrice, price score
│   │       ├── wear/                  ← calculateCostPerWear
│   │       ├── units/                 ← cm/inch/jp/us/uk/eu 変換
│   │       ├── rules/                 ← evaluatePersonalMeasurementRules
│   │       └── __tests__/             ← Vitest による完全テスト
│   │
│   └── shared/                        ← Zod スキーマ + 型 + 定数 (app/domain 共有)
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── schemas/               ← z.object(...) で定義
│           │   ├── item.ts
│           │   ├── measurement.ts
│           │   ├── candidate.ts
│           │   ├── score.ts
│           │   └── ...
│           ├── types/                 ← export type X = z.infer<typeof XSchema>
│           ├── constants/
│           │   ├── measurementKeys.ts ← MeasurementKey enum (集中管理)
│           │   ├── itemStatus.ts      ← state machine 定義
│           │   ├── severityRules.ts   ← カテゴリ別 cm/percent 閾値
│           │   └── scoreWeights.ts    ← 5因子の重み・レンジ
│           └── locales/
│               └── ja.ts              ← UI 文言
│
└── plan/                              ← 設計書・調査結果
    ├── initial-plan.md
    └── 20260426_seam-design-evaluation/
```

**設計上のポイント**:

- **`packages/domain`** は React/Expo に依存しない純粋 TypeScript パッケージ。**Vitest で完全テスト可能**にし、設計書 §30 の pure function 群をここに集約
- **`packages/shared`** で Zod スキーマと TypeScript 型を一元化。`z.infer` で型生成し、`app` と `domain` が同一スキーマで動く
- **`packages/app`** は Expo / RN アプリ本体。`shared` と `domain` を import
- **Monorepo ツール: pnpm workspaces + Turborepo** を推奨（Bun は Expo との互換性に注意点あり）
- 依存方向は厳格に **`app → domain → shared`** / **`app → shared`**。`domain` から `app` への逆参照は禁止（lint で強制）

### C. 設計書 initial-plan.md の改訂提案（章別）

| 章 | 現状 | 推奨改訂 |
|----|------|---------|
| §2 Concept | 個人用 iOS、ローカル中心 | **「店内オフライン操作」** と **「機種変・端末紛失時のデータ復旧」** をコンセプトに明記 |
| §4 Tech Stack | SQLite, Drizzle | **expo-sqlite + Drizzle (sqlite)** を維持。Apple Developer Program 必須を明記。Monorepo (pnpm + Turborepo) を追加 |
| §4 Architecture Policy | ローカルファースト + 認証なし | **「ローカル SQLite が UI の真実」「バックアップは iOS Backup + Export の2段」** を明文化。「認証なし」は維持 |
| §6 ItemStatus | 9値 | `bought` 撤廃して `owned` 集約 OR 状態遷移図を追加。`wishlist`/`watching` の境界条件を明文化 |
| §7 Measurement | key-value | `MeasurementKey` enum を `packages/shared/constants/measurementKeys.ts` で集中管理。**inch ↔ cm 変換**を `packages/domain/units` に明記 |
| §8 Photos | URI 保存 | **相対パス保存 + 表示時 `Paths.document` 結合**。サムネイル戦略明記（`expo-image-manipulator`）。**`setNoBackupAttributeAsync(false)` 明示** |
| §11 Severity Rules | cm 一律 | **percent ベース** と **絶対値**の両方を併用。`packages/domain/compare` の責務化、`packages/shared/constants/severityRules.ts` で値定義 |
| §13 Buy Judgment Score | 5因子の合成式未定義 | **重み・各因子のレンジ (0-100)・合成式・NG Rule との掛け算ルール** を `packages/shared/constants/scoreWeights.ts` に明記。**conditionScore の自動マッピング (S=100/A=85/B=70/...)** を定義 |
| §17 BrandChecklistState | 型なし | `{itemId, brandGuideId, checklistItemKey, isChecked, checkedAt}` のような型定義を追加。**guide 編集時の state ズレ問題**への対応方針も |
| §22 Stats vs §28.7 | 項目数不一致 | 統一。22章を正とする |
| §24 Reminder | 単純記録 | **auctionEndsAt 変更時の Reminder 再計算ロジック**を追記 |
| §25 Backup/Export | JSON/CSV | **「iOS Backup (自動) + JSON+画像 Export (能動)」の2段構え**を Phase 1 から実装。30日警告バッジを追加 |
| §28 Screens | 抜けあり | **Tag 管理 / Reminder 一覧 / Wear Log 一覧 / PriceSnapshot 履歴 / Candidate New** の各画面要件を追加 |
| §29 DB Tables | テーブル名のみ | **PK/FK/cascade/index 方針**を追加。**PK 型 (cuid2 推奨)** を確定 |
| §30 Pure Functions | 入出力型曖昧 | `MeasurementKey` enum、`MeasurementDiff`、`RuleViolation`、`CandidateScoreInput` 等の中間型を追加。エッジケース返却ルールを明文化 |
| §31 Phases | 8 phase | **Phase 0 (Monorepo + Expo セットアップ)** を追加。**Fit Anchor 登録は Phase 2 へ**。**Export を Phase 1 に前倒し**。Phase 7 から Stats を分離 |
| §34 File Structure | 単一プロジェクト | **Monorepo 3パッケージ構成 (上記 B)** に置換 |
| §35 Acceptance Criteria | 機能 10項目 | **「機内モードで全機能動作」「Export を Files App に保存できる」「機種変後に iOS Backup から復元できる」** を追加 |

### D. 新規追加すべきセクション

設計書に以下を新規追加：

1. **テスト戦略**
   - `packages/domain`: Vitest, coverage 80%目標
   - `packages/app`: @testing-library/react-native (UI 単体), bun test (utility)
   - E2E: Maestro（軽量）。CI は GitHub Actions
2. **エラーハンドリングポリシー**: DB error / FileSystem error / Notification permission denied / Validation error の UX ポリシー
3. **画像 lifecycle**: item delete → photos cascade → 物理ファイル削除フック / orphan cleanup ジョブ
4. **マイグレーション運用**: `drizzle-kit generate` をローカル実行 → migrations/ を git commit → アプリ起動時に `useMigrations` で自動適用
5. **シークレット管理**: `.env*` を gitignore（実質的には機密ほぼ無し、開発用設定のみ）
6. **TZ / 通貨**: ISO timestamp + `Asia/Tokyo` 表示、JPY 専用（v1 では USD は表示のみで保存しない）
7. **i18n**: 日本語のみ。文言は `packages/shared/locales/ja.ts` に集約
8. **a11y**: Dynamic Type 対応、Dark Mode 対応、accessibility label 必須

### E. 改訂版 Phase 計画

| Phase | 主タスク | AC 達成 |
|-------|---------|---------|
| **0. Foundation** | Monorepo 初期化（pnpm + turbo）/ `.gitignore` 全面書き直し / Expo SDK 54 init / TypeScript strict / Vitest setup / EAS account & **Apple Developer 登録** / Drizzle (expo-sqlite) skeleton | - |
| **1. App Skeleton + Backup** | Expo Router (tabs) / Drizzle schema 定義 / `useMigrations` / Zod スキーマ集中管理 (shared) / Theme / **JSON+画像 Export 最小実装** / iOS Backup 動作確認 | - |
| **2. Item CRUD** | item CRUD / Closet / Item Detail / category-specific measurement input / photo (documentDirectory + 相対パス + サムネイル) / **Fit Anchor 登録** (←Phase 4 から前倒し) / tag / search/filter/sort | AC 1, 2, 3, 6 |
| **3. Wishlist / Candidate** | candidate registration / detail / sourceType / 価格・送料・上限価格 / auctionEndsAt / priceSnapshot / **priceScore + conditionScore も同時実装** | AC 4, 5 |
| **4. Compare** | compare screen / diff logic (cm + percent) / severity / **Personal NG Rule** / similar suggestion / sizeScore | AC 7 |
| **5. Judgment & Decision** | Buy Judgment Score 合成式 / **Buy/Watch/Skip + 理由** / decision logs / duplicate risk / uniqueness | AC 8 |
| **6. After Purchase** | candidate→owned 変換 / **failure log** / wear log / cost per wear / sell candidate / sold | AC 9, 10 |
| **7. Stats** | カテゴリ・ブランド・色別 / 月別購入 / CPW / 着ていない服 / 重複 / Buy/Watch/Skip 比率 / 失敗理由 ranking | - |
| **8. Intelligence** | text extraction / brand notes / brand checklist | - |
| **9. Utility & Polish** | local notifications (auctionEndsAt 連動) / CSV Export-Import / 30日 Export 警告バッジ / data reset / Settings polish / a11y / dark mode | - |

**Acceptance Criteria 10項目は Phase 6 で全達成**。Fit Anchor を Phase 2 に前倒したことで、Phase 4 完了を待たずに AC #6 が満たせる。

---

## Risks & Mitigations

| ID | リスク | 影響 | 緩和策 |
|----|------|------|--------|
| R1 | iCloud Backup を OFF にしているユーザーで端末紛失 | 全データ喪失 | **JSON+画像 Export を Phase 1 から実装**、30日警告バッジで促進 |
| R2 | アプリ削除（iCloud Backup 復元なし）で消失 | 全データ喪失 | 同上。Settings 画面で「最終 Export 日」を常時表示 |
| R3 | Score 合成式未定義のまま実装着手 | テスト不能、振る舞い不明 | **Phase 5 開始前に重み・レンジ・合成式を `packages/shared/constants/scoreWeights.ts` に明文化** |
| R4 | severity rules を全カテゴリ一律で実装 | 不適切な warning | **percent + 絶対値の両方を `packages/domain/compare` で実装、テストで保証** |
| R5 | wishlist/watching/bought/owned の境界曖昧 | UI バグ温床 | **state machine 定義を `packages/shared/constants/itemStatus.ts` に追加**、xstate 導入は不要だが定義は文書化 |
| R6 | 画像が増えて端末ストレージを圧迫 | 動作鈍化、容量不足 | **サムネイル化必須（`expo-image-manipulator`）**、原本も resize（最大長辺 2048px）してから保存 |
| R7 | テキスト抽出の精度低下に気づけない | UX 劣化 | **Phase 8 で実商品 30〜50 件のテストデータを `packages/domain/__tests__` に投入**、confidence < 0.5 は手動入力フォール |
| R8 | drizzle migration のスキーマ変更で既存データ破損 | 全データ喪失 | **migration 適用前に自動 Export を走らせて Files App に保存**（破損時の復旧手段確保） |
| R9 | Apple Developer Program 加入忘れ | 配布不可 | **Phase 0 に登録タスクを明記**（年 $99 USD） |
| R10 | OS update で `documentDirectory` の絶対パスが変化 | 画像参照切れ | DB には**相対パス保存**、表示時に `Paths.document` 結合（context7 調査の通り） |
| R11 | photo の orphan ファイル蓄積 | ストレージ肥大化 | item delete 時に物理ファイル削除フック、起動時に orphan cleanup |
| R12 | iCloud Drive Export を一度もしないままアプリ削除 | データ消失 | iOS Backup でカバー。さらに**初回起動時に「Export 機能の説明」を表示** |

---

## Open Questions

ユーザーに確認・意思決定してほしい順に並べる。

### 優先度 高（着手前に必ず確定）

1. **Monorepo ツール**: pnpm + Turborepo を推奨（vs Bun + Bun workspaces）
2. **Apple Developer Program** 加入の意思確認（年 $99 USD）
3. **設計書 initial-plan.md の改訂方針**: 直接書き換えるか、別ファイル `revised-plan.md` として並走させるか

### 優先度 中（Phase 0 着手と並行で確定）

4. **Score 合成式（5因子の重み・レンジ・式）の決定**
   - 例: `total = sizeScore*0.35 + priceScore*0.25 + conditionScore*0.15 + uniquenessScore*0.10 + (100-duplicateRiskScore)*0.15`
   - 各因子は 0-100。NG Rule 該当時は total に -20、warning は -10 の減点、等
5. **ItemStatus 状態遷移図の作成**
   - `bought` を撤廃して `owned` に集約する案を推奨
6. **severity rules の percent/絶対値併用の閾値決定**
7. **PK 型 (cuid2 / uuid v7 / nanoid) の選定**: cuid2 推奨（短く・URL-safe・ソート可能）
8. **Fit Anchor**: `boolean フラグ` か `別テーブル` か → 別テーブル単独を推奨

### 優先度 低（Phase 進行中に決めればよい）

9. Stats のグラフライブラリ選定（`victory-native` 推奨、Skia ベース）
10. drizzle-orm v1.0 GA への追従タイミング（drizzle-zod が本体に統合される）
11. ブランドガイドの初期 seed コンテンツ作成（Russell, Dickies 874 のヴィンテージ判定情報あり）
12. テキスト抽出のテストデータ収集（実メルカリ/ヤフオク 30〜50 件）

---

## Next Steps

1. **本レポートの方針合意**（特にバックアップ戦略・Phase 計画）
2. **Open Questions 優先度高 (1-3)** の確定
3. **`initial-plan.md` の改訂を実施するか別ファイルで並走するか**を決める
4. 改訂後、**Phase 0 着手準備**（Monorepo 初期化・gitignore 修正・Apple Developer 登録）

---

## アーキテクチャ変更による影響まとめ（v1 → v2）

ユーザー方針確定により、初版（Neon DB + BFF + R2 + Terraform）から以下が削除されました。

| v1 で必要だったもの | v2 では | 削減効果 |
|------|------|------|
| `packages/bff` (Cloudflare Workers + Hono) | **削除** | 1 パッケージ消滅、Worker 運用ゼロ |
| `packages/infra` (Terraform) | **削除** | IaC コード不要、Provider 設定不要 |
| Cloudflare R2 (写真の冗長保存) | **削除** | サービス契約不要 |
| Static API Key + `expo-secure-store` 認証 | **削除** | 認証コード不要 |
| Outbox sync ロジック | **削除** | 数百行の同期コード不要 |
| Neon Postgres (バックアップ・SoR) | **削除** → iOS Backup + Export で代替 | 月次コスト 0 円 |
| DATABASE_URL の漏洩リスク管理 | **不要** | セキュリティ問題消滅 |
| Worker → Neon のレイテンシ考慮 | **不要** | <1ms ローカル動作 |
| dev/prod 環境分離 (Neon Branch) | 簡略化 | Phase 開発で困ったら考える |

**残る構成**: `packages/app` + `packages/domain` + `packages/shared` のシンプルな 3 パッケージ Monorepo。設計書 §4 の元方針（ローカルファースト・認証なし）と完全整合。

---

## 参考資料

詳細な調査結果は以下の各ファイルに格納：

- `./context7-doc-researcher.md` — Expo / Drizzle / Neon / Zod / Zustand 等の公式ドキュメント精査
- `./codebase-investigator.md` — 設計書の章別整合性レビュー
- `./web-research-agent.md` — ローカルファースト構成の優位性、競合調査、ドメイン知見、画像保存戦略
- `./claude-web-researcher.md` — Expo + Drizzle ベストプラクティス、技術スタック確定提案

> 注: 各 SubAgent レポートは Neon DB 採用前提で書かれているため、本 plan.md（v2）とは推奨アーキテクチャが異なります。**v2 が最新の確定方針**です。

---

**評価完了（v2）**
