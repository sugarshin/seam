# Seam 設計書 評価 - Codebase Investigation Report

## Investigation Date

2026-04-26

## Task Overview

「Seam」（個人用 iOS アプリ / 古着購入判断支援）の初期設計書 `plan/initial-plan.md` を以下の観点で精査する。

- 現状コードベースの状態
- 設計書の内部一貫性（A: データモデル, B: ドメインロジック, C: 画面, D: フェーズ, E: 抜け漏れ）
- **DB を SQLite から Neon DB（PostgreSQL serverless）に切り替える前提での影響分析（最重要）**
- リスク・ブロッカー

---

## 1. 現状コードベース スナップショット

### 1.1 リポジトリ構成

```
/Users/shingosato/dev/src/github.com/sugarshin/seam/
├── .git/
├── .gitignore         # Xcode/CocoaPods 用テンプレ（RN/Expo 用ではない点に注意）
├── LICENSE            # 1068 bytes
├── README.md          # 1行 "# seam" のみ
└── plan/
    ├── initial-plan.md                        # 1549 行・26297 bytes
    └── 20260426_seam-design-evaluation/       # 本レポートの出力先（空）
```

### 1.2 確認結果

- **コードは 1 行も書かれていない**。Expo/React Native プロジェクトの初期化（`package.json`, `app.json`, `tsconfig.json`, `expo` 関連 config）は未実施
- `.gitignore` は **Xcode/Swift プロジェクト用テンプレ**であり、Expo/React Native 用に書き換える必要がある（`node_modules/`, `.expo/`, `dist/`, `web-build/`, `ios/Pods/`, `*.tsbuildinfo`, `.env*` など）
- `README.md` は実質空
- 既存ドキュメントは `plan/initial-plan.md` の 1 ファイルのみ

### 1.3 Git 履歴

```
2d4f226 Add renovate.json    ← ただし renovate.json はワークツリーに見当たらない（別ブランチにあるか、削除済み）
8e0ee18 Initial commit
```

- `git log` に `plan/initial-plan.md` の編集履歴は出ない（Initial commit に含まれていない or untracked の可能性）。実際の状態は `git status` clean なので tracked と推測
- 設計書がどう推敲されてきたかの履歴は git からは追えない
- `renovate.json` のコミットがあるが現状ファイルが見えない点は要確認（`git ls-tree -r HEAD` で実態を見るとよい）

### 1.4 含意

- スケルトンも未生成のため、設計書の Phase 1 から着手することになる
- 設計書を直接編集する余地が大きい（実装からの後方互換制約がない）→ **今が Neon 移行を反映する最適タイミング**

---

## 2. 設計書 内部整合性レビュー

### A. データモデル整合性

#### A-1. `ItemStatus` と他モデルの整合 (6章 vs 15/16/21章)

設計書 6章で `ItemStatus` を以下と定義：

```
owned | wishlist | watching | bidding | negotiating | bought | skipped | lost_auction | sold
```

整合性の問題点：

| # | 問題 | 詳細 | 改善案 |
|---|---|---|---|
| 1 | `bought` と `owned` の差が定義されていない | 「買った直後 = bought」「ある程度経った = owned」？それとも `bought` は中間状態として残らない？ 28.5 で「Bought に変換」ボタンがあるが、この後 `owned` に自動遷移するのか不明 | `bought` を撤廃して `owned` に集約 or 状態遷移図を追加（候補→bought→owned のような） |
| 2 | `DecisionLog.decision` (15章) と `CandidateEvaluation.decision` (13章) の語彙が違う | DecisionLog: `buy / watch / skip / lost_auction`、CandidateEvaluation: `buy / watch / skip` | DecisionLog 専用の `lost_auction` を `skip` + reason で表現するか、CandidateEvaluation にも追加する |
| 3 | `wishlist` と `watching` の意味境界が不明 | 「保存しただけ = wishlist」「定期チェック中 = watching」？運用上の差が定義されていない | どちらかに統一 or 明確な遷移条件を定義 |
| 4 | 売却フロー (21章) の状態 | `isSellCandidate: true` のまま `owned` 状態 → 売れたら `sold` に遷移、と読めるが SaleInfo は `sold` 後に作る前提か？ owned のうちは作れない？が不明確 | `isSellCandidate` フラグ ＋ `status: sold` の組み合わせを明文化 |
| 5 | `FailureLog` (16章) は `owned` のみ対象 | 6章の status が `bought` の段階でも記録できるか？ 16章では「owned item に対して」と書かれている | `bought` を廃止すれば不要だが、残すなら明文化 |

#### A-2. Measurement の汎用 key-value 表現可能性 (7章)

`Measurement` は `{ itemId, key, value, unit }` の汎用構造。

**表現可能か検証：**

| カテゴリ | 7.x の TypeScript 型 | DB 表現 |
|---|---|---|
| Tops (7.2) | shoulderWidth/chestWidth/bodyLength/sleeveLength/neckToSleeve | OK（key=`shoulderWidth`, unit=`cm`） |
| Pants (7.3) | waist/rise/inseam/thighWidth/kneeWidth/hemWidth/totalLength | OK |
| Shoes (7.4) | jpSize/usSize/ukSize/euSize/outsoleLength/outsoleWidth | OK だが**単位が混在**：jpSize/usSize/ukSize/euSize はサイズ表記、outsole* は cm。1 アイテムに対し `unit=jp/us/uk/eu/cm` が同居する |

**問題点：**

- **キー名の正規化責任が不明**。Type 上は `shoulderWidth` だが DB の `key` カラムは TypeScript Enum か文字列かが定義されていない。`measurementKeys.ts`（34章ファイル構成）が単一情報源になる前提と推察できるが、設計書本文には書かれていない
- **`unit` の `cm | inch | jp | us | uk | eu` のうち、`inch` は Tops/Pants でも使うのか？**（古着・USA物は inch 表記が普通）。Compare の severity rule (11章) は cm 前提なので、入力 inch → 内部 cm 変換のレイヤが必要。設計書には記述なし
- **同一アイテムで同じ key の重複保存可否**。例えば「採寸ミスで再測定したので過去履歴として残したい」場合の方針なし
- **ペア（shoes は左右）/ サイドの扱い**。靴のサイズ表記が複数表記併記される際 (US 9 / UK 8 / EU 42) は OK だが、同一アイテムに 4 行できることになる。query 時の取り回しが煩雑

#### A-3. owned / wishlist 同居設計 (items テーブル) の長所・短所

**長所**：
- 候補→購入のときに ID が変わらない（履歴・写真・実寸が継続）
- Compare (11章) で「過去に skip した類似アイテム」など status をまたぐクエリが容易
- スキーマ重複（owned_items / wishlist_items の二重管理）回避

**短所**：
- **NULL カラムが激増する**。`purchasePrice`, `purchaseDate`, `fitRating`（owned 専用）と CandidateInfo の各種価格（wishlist 専用）が共存し、`status` によって意味が変わる
- **status による分岐ロジックが UI/Repository 層に散在**しがち
- **CandidateInfo が 1:1 別テーブルになっている**（10章）→ owned になった後 CandidateInfo をどうするか：残す？（履歴）/ 削除？/ アーカイブする？ という判断が設計書にない
- `status='sold'` の際に Closet からは除外するが items に残るので、`isDeleted` 系のソフトデリート概念がない（Stats で「過去に売った金額」を集計する想定）→ これは長所でもあるが、複雑化の元

**評価：おおむね妥当な設計**だが、以下を追記すべき：
- status 遷移図（state machine）
- candidate 由来カラム（CandidateInfo）の owned 化後の保持方針
- 「sold だが Closet に表示」「sold だから非表示」の filter ルール

#### A-4. 29章テーブル一覧 vs 6〜27章型定義のマッピング

29章で列挙されているテーブル：

```
items, measurements, photos, fit_anchors, candidate_infos, candidate_evaluations,
decision_logs, failure_logs, measurement_rules, brand_guides, brand_checklist_states,
wear_logs, sale_infos, price_snapshots, tags, item_tags, reminders
```

| 章 | 型/エンティティ | 29章テーブル | 状態 |
|---|---|---|---|
| 6 | GarmentItem | items | OK |
| 7 | Measurement | measurements | OK |
| 8 | ItemPhoto | photos | OK |
| 9 | FitAnchor | fit_anchors | OK |
| 10 | CandidateInfo | candidate_infos | OK |
| 12 | MeasurementRule | measurement_rules | OK |
| 13 | CandidateEvaluation | candidate_evaluations | OK |
| 15 | DecisionLog | decision_logs | OK |
| 16 | FailureLog | failure_logs | OK |
| 17 | BrandGuide | brand_guides | OK |
| 17 | BrandChecklistState | brand_checklist_states | **17章に型定義なし**（テーブルだけ存在）|
| 20 | WearLog | wear_logs | OK |
| 21 | SaleInfo | sale_infos | OK |
| 24 | Reminder | reminders | OK |
| 26 | Tag, ItemTag | tags, item_tags | OK |
| 27 | PriceSnapshot | price_snapshots | OK |

**抜け：**
- **`BrandChecklistState`** … 17章では「Checklist の確認状態を candidate ごとに保存できる」と書かれているが、型定義（itemId, brandGuideId, checklistItemIndex, isChecked など）が無い
- **`MeasurementExtractionResult`** (18章) は型のみで、DB 保存しない pure 結果型として OK と判断
- **`ItemStatus` の状態遷移履歴を残すテーブル**は存在しない。「Decision Log で代替」が想定だが、`status` の変遷自体を時系列で残すテーブルはない

#### A-5. PK / FK / cascade 削除

設計書全体を通じて以下が不明：

- **PK 型**：`id: string` が UUID なのか cuid なのか ULID なのか不明（34章 utils/ids.ts でラップする想定だが選定なし）
- **FK 制約の有無**：例えば `Measurement.itemId → items.id` の FK 制約 + ON DELETE CASCADE か否か
- **削除ポリシー**：item を削除したとき、photos / measurements / wear_logs / decision_logs / failure_logs はカスケード削除されるべきか？それとも残す（履歴目的）？
- **複合 PK**：`item_tags(itemId, tagId)`, `sale_infos(itemId)`(1:1?), `candidate_infos(itemId)`(1:1?) は明記されていない
- **インデックス**：status, category, brand, createdAt 等 Query 頻度の高いカラムへの index 戦略が無い

### B. ドメインロジックの妥当性

#### B-1. 11章 severity rules の妥当性

```
Tops:
±1cm: same
±2〜3cm: close
±4〜5cm: different
±6cm以上: warning
着丈 -4cm以下: warning
袖丈 -4cm以下: warning
```

- **方向（+/-）の意味が暗黙的**：「+ = 候補が大きい、- = 候補が小さい」が定義されていない（30章 `compareMeasurements(candidate, reference, ...)` から推察可能だが、明文化されていない）
- **measurementKey 別の閾値テーブルが手書きで散在**：Pants / Shoes も同様で、設定ファイル化（`severityRules.ts`）すべきだが、書式が決まっていない
- **「±1cm = same」は Pants の wait など大きな寸法でも妥当か？** 一律 ±1cm は Tops 向けの値。ウエスト 80cm に対する ±1cm（誤差率 1.25%）と Outsole 28cm に対する ±1cm（3.5%）は意味が違う。**percent ベースのルールも併用すべき**
- **inch / jp/us/uk/eu の単位での比較は cm 換算が必要** だが Compare ロジックの単位統一は定義されていない
- **左右非対称・揺れ**（実測誤差）の扱いが無い

#### B-2. 13章 Buy Judgment Score のスコア合成

5 因子：sizeScore, priceScore, conditionScore, uniquenessScore, duplicateRiskScore

**問題点（重大）：**

- **重み（weight）が未定義**：`totalScore` の計算式が無い。単純平均 (5 で割る) なのか、加重平均なのか、合計上限 100 なのか
- 各 score の個別レンジ（0-100? 0-1? 0-20?）も未定義
- 13章 Decision Rule で「80点以上: Buy / 60〜79: Watch / 59以下: Skip」とあるので 0-100 想定と推察できるが、明文化必要
- **Personal NG Rule との掛け算**：「NG に該当する場合は Watch / Skip に落とす」とあるが、severity=`warning` と `ng` の差で挙動が違うのか？ 落とし方は乗算ペナルティ？ 上書き？ 不明
- **conditionScore の計算ロジックが無い**：`conditionRank: S/A/B/C/D` から自動マッピング？ それとも user 入力？
- **uniquenessScore vs duplicateRiskScore の独立性**：論理的にこの 2 つは強く相関する（duplicate が高ければ uniqueness は低い）。同時に評価する根拠と算出式が必要
- **失敗ログの参照**：13章 Requirements にはないが、16章 Requirements で「Compare / Score ロジックで過去の失敗を参照できる」とある → 失敗ログ参照の score への寄与方法が未定義（6 因子目になるべきか？）

#### B-3. 18章 テキスト抽出のカバー範囲と精度

カバー対象（設計書記載例）：

```
肩幅 58 / 肩幅：58cm / 身幅 60cm / 着丈：約66cm / 袖丈 61
ウエスト 91cm / 股下 76cm / ワタリ 34cm / 裾幅 23cm
```

**カバー困難な実例（古着出品テキスト頻出）：**

- 全角/半角数字の混在（「身幅５８」）
- 改行で分かれる（`身幅\n58`）
- 範囲表記（`身幅 58〜60`）
- 異表記揺れ（`着丈/総丈/丈`、`バスト/胸囲/身幅`、`股下/inseam/INSEAM`）
- inch 表記（`waist 32inch`, `W32`）→ cm 換算が要る
- 表組みコピペ（`肩幅\t身幅\t着丈\nS\t44\t52\t68\nM\t46\t54\t70`）→ サイズ別の表からどれを抜くか
- 採寸方法のメモ書きが混じる（`平置き 身幅 60`）
- USA size 表記での換算問題

**「未対応の表記があっても落ちない」要件**は OK だが、**confidence 算出のアルゴリズム**（18章では `confidence: number` という型のみ）が未定義。何個ヒットしたら confidence いくつ、というルールが要る

#### B-4. 30章 pure function の入出力型の書きやすさ

| 関数 | 想定 input/output | 型レベルでの問題 |
|---|---|---|
| `calculateTotalPrice(price, shippingFee)` | (number, number) → number | OK |
| `compareMeasurements(candidateMeasurements, referenceMeasurements, category)` | (Measurement[], Measurement[], GarmentCategory) → Diff[] | category ごとに比較対象 key 集合が変わる → category と key 集合が型で連動するなら discriminated union が要る |
| `getMeasurementDiffSeverity(diff, measurementKey, category)` | (number, string, GarmentCategory) → MeasurementDiffSeverity | measurementKey が `string` だと型安全でない。`MeasurementKey` enum/literal union が必要 |
| `evaluatePersonalMeasurementRules(itemMeasurements, rules)` | (Measurement[], MeasurementRule[]) → RuleViolation[] | RuleViolation 型が未定義 |
| `calculateSizeScore(candidate, anchors)` | (Item, FitAnchor[]) → number | 「candidate に measurement が無い場合」「anchor が 0 件の場合」の挙動が型に出ない |
| `calculatePriceScore(candidateInfo)` | CandidateInfo → number | maxBidPrice 未設定時の挙動が未定義 |
| `calculateDuplicateRisk(candidate, ownedItems)` | (Item, Item[]) → number | duplicate 判定基準（同カテゴリ + 同色 + 同ブランド）の閾値が定義されていない |
| `calculateUniquenessScore(candidate, ownedItems)` | (Item, Item[]) → number | duplicateRisk の鏡像？ 関係性の型が出ない |
| `calculateCandidateScore(input)` | input 型未定義 | 13章のスコア合成式不明のため input 型も曖昧 |
| `suggestSimilarItems(candidate, ownedItems)` | (Item, Item[]) → Item[] | 類似度メトリクス未定義 |
| `extractMeasurementsFromText(text)` | string → MeasurementExtractionResult | OK |
| `calculateCostPerWear(totalPrice, wearCount)` | (number, number) → number | wearCount=0 のときの返却（Infinity? null?）が未定義 |

**改善案：**
- 30章に `MeasurementKey` enum、`MeasurementDiff`、`RuleViolation`、`CandidateScoreInput` 等の関数間で共有される中間型を追加
- 各関数の **エッジケース返却**（空配列、欠損値、ゼロ除算）の方針を明記

### C. 画面・遷移整合性

#### C-1. 28章 各画面要件と 5章タブ構成 / 6〜27章機能要件のマッピング漏れ

| 5章タブ | 28章 画面 | カバー機能 | 漏れ |
|---|---|---|---|
| Home | 28.1 | 終了オークション、近日終了、最近追加、最近購入、注意候補、月次サマリ | OK |
| Closet | 28.2 + 28.4 (item detail) | owned 一覧、Item Detail | OK |
| Wishlist | 28.3 + 28.5 (candidate detail) | wishlist/watching/bidding/negotiating 一覧、Candidate Detail | OK |
| Compare | 28.6 | Compare 画面 | OK |
| Stats | 28.7 | 各種統計 | OK |
| Settings | 28.8 | NG Rules / Brand Guides / Export / Import / Notification / Reset | **抜け：Tag 管理（26章）**, **Fit Anchor 一覧管理画面（9章）**, **Personal NG Rule 編集 UI 詳細**, **Reminder 一覧**, **Wear Log 一覧** |

**他のマッピング漏れ：**

- **27章 PriceSnapshot 一覧画面/UI が未定義** … 28.5 で「価格 snapshot 追加」操作はあるが、過去の snapshot の閲覧 UI が無い（要件には「過去価格を一覧表示する」とある）
- **17章 BrandGuide の Candidate 登録時表示** … 28.5 candidate detail に "Brand checklist" は載っているが、guide 本文（notes）の表示位置が未定義
- **22章 Stats の cost per wear が高い服** は 28.7 にも載るが、20章 wear log の追加 UI は item detail にしか無い → 履歴一覧表示の要件は無い
- **23章 Search/Filter/Sort** は Closet/Wishlist の両方で必要だが、28.2/28.3 では「検索/フィルタ/ソート」の表記止まりで、UI 要件（モーダル？ ボトムシート？ サイドバー？）が無い
- **18章 抽出後のレビュー UI** … 「ユーザーが確認・修正して保存」とあるが、どの画面に表示するか不明（28.5 candidate detail に「抽出された実寸」表記はあるが）

#### C-2. 主要動線「候補登録 → Compare → 判断記録」の最短性

想定動線（推測）：

```
Home or Wishlist
  ↓ (新規 candidate 追加)
Candidate New (28章未定義 - Wishlist > 新規 から遷移)
  ↓ (保存)
Candidate Detail (28.5)
  ↓ (Compare へ)
Compare (28.6)
  ↓ (Decision 登録)
Candidate Detail (戻る) or Home
```

**問題点：**
- **Candidate New 画面の要件が無い**（28章には Detail のみ）。34章のファイル構成では `app/candidate/new.tsx` が存在
- **Compare 画面に「どの candidate を選ぶか」のステップがある** (28.6 "candidate を選択") → 28.5 から遷移する場合は省略すべきだが、Compare タブから入った場合は選択 UI が要る → この場合分けの記述なし
- **Decision 登録の入力フォーム要件が未定義**（自由記述？ template？ 写真添付？）
- 32章 UI Principles で「候補登録から比較まで最短導線にする」「Buy / Watch / Skip をすぐ残せる」とあり方針は明示されているが、28章の画面要件まで落とし込まれていない

### D. フェーズ分割

#### D-1. 31章 Phase 依存順の正当性

| Phase | 内容 | 依存問題 |
|---|---|---|
| Phase 1 Foundation | Expo, Router, TS, SQLite/Drizzle, schema, migrations, theme, tabs, types, repos, seed | OK |
| Phase 2 Item CRUD | item CRUD, Closet, Item Detail, measurement input, photo, tags, search/filter/sort | tags は 26章で別テーブル、tag 管理 UI も必要だが Phase 1 の repos に含めるか曖昧 |
| Phase 3 Wishlist/Candidate | candidate registration/detail, sourceType, price, max bid, auction end, snapshot, URL, listing description | OK |
| Phase 4 Compare | **Fit Anchors**, compare screen, diff logic, severity, similar suggestion, Personal NG Rules | **問題**: Fit Anchors は 9章で「owned item を Anchor にする」機能 → これは Phase 2 の Item Detail で「Fit Anchor にする」操作がある (28.4) はず。**Phase 2 と Phase 4 の境界が曖昧** |
| Phase 5 Judgment | score 計算, Buy/Watch/Skip, decision logs, duplicate risk, uniqueness, condition, price | Phase 4 の Compare 結果に sizeScore が必要 → Phase 4 で sizeScore 算出を始めて、Phase 5 で remain factors を追加するのか? 区切りが曖昧 |
| Phase 6 After Purchase | candidate→owned 変換, failure log, wear log, cost per wear, sell candidate, sold | OK だが「candidate→owned 変換」は 6章 status の `bought` の話題と整合させる必要あり |
| Phase 7 Intelligence | text extraction, brand notes/checklists, checklist state, **stats** | **stats は別 Phase に切るべき**：text extraction とは独立。Stats は前 Phase の入力データに依存するので最終に置くのは正しいが、intelligence と並列にする意味は薄い |
| Phase 8 Utility | local notification, JSON/CSV export/import, data reset, settings polish | OK |

**主要な指摘：**
1. **Phase 4 に Fit Anchors の登録機能を含めるのは過大**。Phase 2 の Item Detail に登録 UI を入れる（実体は items テーブルの `isFitAnchor` フラグ + `fit_anchors` テーブル登録）。Phase 4 は「Compare 画面で Anchor を活用する」だけにすべき
2. **Phase 5 の condition score / price score は Phase 3 の candidate にあるべき**（candidate detail でも可視化したい）。Phase 5 一括にすると Phase 3 完了時点でユーザー価値が落ちる
3. **Phase 7 と Stats の結合は弱い**。Stats は Phase 6 完了で多くの集計が可能 → Stats を別 Phase または Phase 7 直前に分離

#### D-2. 35章 Acceptance Criteria 10項目達成 Phase

| # | AC | 必要 Phase | 達成可能か |
|---|---|---|---|
| 1 | 手持ち服を登録できる | Phase 2 | OK |
| 2 | 実寸をカテゴリごとに登録できる | Phase 2 | OK |
| 3 | 写真を登録できる | Phase 2 | OK |
| 4 | 購入候補を登録できる | Phase 3 | OK |
| 5 | 購入候補に価格・送料・上限価格を設定できる | Phase 3 | OK |
| 6 | Fit Anchor を設定できる | Phase 2 (要再配置) or Phase 4 | Phase 4 のままでは 5 個足りない |
| 7 | 候補商品と Fit Anchor のサイズ差分を見られる | Phase 4 | OK |
| 8 | Buy / Watch / Skip を理由付きで残せる | Phase 5 (decision log) | OK |
| 9 | 購入後に owned item に変換できる | Phase 6 | OK |
| 10 | 失敗理由を記録できる | Phase 6 | OK |

**結論：35章 AC 10項目 = Phase 6 完了で達成**。
ただし Fit Anchor の登録 UI が Phase 2 にあるべきという D-1 指摘を反映しないと、Phase 4 完了まで AC #6 が満たせない。

### E. 抜け・漏れ・矛盾

#### E-1. 設計書全体に欠けている重要要素

| カテゴリ | 内容 | 影響 |
|---|---|---|
| **テスト戦略** | 33章プロンプトの末尾に「After implementing foundation, add tests for domain logic.」とあるのみ。テストフレームワーク（Jest? Vitest? @testing-library/react-native?）、coverage 目標、E2E (Detox/Maestro)、snapshot 方針、CI 上の実行戦略がない | 品質保証不可 |
| **エラーハンドリング** | DB エラー、画像保存失敗、通知設定失敗、import バリデーション失敗時の UX ポリシーがない | UX 品質低下 |
| **画像最適化** | 8章では `expo-image-picker` で撮影/選択し localにコピーするだけ。**リサイズ、圧縮、サムネイル生成、OOM 対策**の言及なし。古着写真は枚数が増えるので必須 | 端末パフォーマンス問題 |
| **画像 URI と物理ファイルの life cycle** | item を削除したら画像ファイルも削除？ orphan 画像のクリーンアップ？ photos テーブル DELETE 時の物理削除フック？ | ストレージ肥大化 |
| **マイグレーション戦略** | Phase 1 に「migrations」とあるが、開発中スキーマ変更時の方針（drop & seed? incremental?）、本番リリース後のマイグレーション運用（Drizzle migrate on app start?）が不明 | DB 破損リスク |
| **データ移行** | 既存ユーザーの手書きメモなどから初期データ投入する手段なし（CSV import は 25章にあるが import の field マッピング、partial item の扱いは未定義）| 初期投入コスト |
| **i18n / 文言管理** | UI 文言は日本語想定（章中の表示名は日本語）だが、定数化／リソース化方針なし | ハードコード散乱 |
| **アクセシビリティ** | 32章で UI Principles はあるが a11y label, dynamic type, dark mode 対応は無し | iOS App Store 公開時に問題 |
| **タイムゾーン** | `auctionEndsAt`, `wornAt` は ISO string と暗黙了解だが、TZ-aware か naive か明記なし。海外オークション（eBay）想定なら必須 | 通知時刻ズレ |
| **数値型/通貨** | `purchasePrice` は `number` だが整数 (JPY) なのか小数 (USD ¢) なのか未定義。eBay 対応するなら通貨カラム必要 | 海外サイト連携不可 |
| **ログ／analytics** | 個人用とはいえ開発中の bug repro のためのログ戦略無し | デバッグ困難 |
| **オフライン** | 「ローカルファースト」「認証なし」とあるが、SQLite 前提なのでオフライン考慮は自然成立 → **Neon 移行で重大な変更が必要（後述）** |
| **dev/prod 環境分離** | 1 端末 1 DB 想定で env 分離なし。EAS internal 配布時に dev/prod が同居して事故るリスク | データ事故 |
| **Settings の Data reset 実装** | DB drop？ 全テーブル truncate？ 画像ファイル削除？ 暗黙 | 部分残骸リスク |

#### E-2. 設計書内の矛盾・不整合

| # | 場所 | 内容 |
|---|---|---|
| 1 | 4章 vs 6章 | 4章「画像は端末ローカル保存」「SQLite には URI を保存」 vs 8章「画像は端末ローカルにコピーして保存」… ほぼ同意だが、撮影/選択した時点で URI が photo library 内ならコピーが必要、すでに app local なら不要、という区別がない |
| 2 | 6章 isSellCandidate / 21章 SaleInfo | `isSellCandidate: boolean` は items に格納し、`SaleInfo` は別テーブル。フラグと別テーブルの整合性管理（フラグ true で SaleInfo 無し OK か？ false で SaleInfo 有り OK か？）が無い |
| 3 | 13章 vs 12章 severity | 13章「Personal NG Rule に該当する場合は Watch / Skip に落とす」、12章 severity は `warning / ng` の 2 値 → どちらに該当したら Watch、どちらが Skip か対応関係不明 |
| 4 | 11章 Compare の表示文言 | サンプル「少しゆったり。サイズ的には良さそう。」のような自然文の生成ロジックが定義されていない（severity ラベル → 文言生成のテンプレート？ 各 measurementKey 個別？） |
| 5 | 22章 Stats vs 28.7 Stats | 22章 16 項目 vs 28.7 12 項目 で項目数が違う。28.7 で「直近30日で買った/見送った」「平均購入価格」「同カテゴリ・同色の重複」が抜けている |
| 6 | 17章 BrandGuide.checklistItems vs brand_checklist_states | guide 側は `checklistItems: string[]`（順序ベース） vs state テーブルは index なのか文字列マッチか曖昧。**guide を編集したら state がズレる問題**への言及なし |
| 7 | 25章 Export / Import | export/import 対象に `brand_checklist_states` がない（17章で実装する想定なのに） |
| 8 | 9章 FitAnchor.category | `category: GarmentCategory` を持つが `itemId` で参照すれば items.category から取れる → 冗長 or 「Anchor の意図カテゴリは item と違うこともある」のか不明 |
| 9 | 24章 Reminder と CandidateInfo.auctionEndsAt | リマインドは Reminder テーブルに分離されるが、auctionEndsAt の変更（出品延長など）に応じて Reminder の remindAt を再計算する仕組みが無い |

---

## 3. Neon DB 移行影響分析（最重要）

**前提**: SQLite を Neon DB（PostgreSQL serverless / `@neondatabase/serverless`）に切り替える。
**前提条件の重要事項**: React Native (Expo) アプリから直接 Neon にアクセスする場合、後述のリスクが大きい。

### 3.1 章ごとの書き換え必要箇所一覧

| 章 | 現状 | Neon 移行後の方針 / 書き換え |
|---|---|---|
| **2 (Concept)** | 個人用 iOS アプリ、ローカル中心 | コンセプト自体は変更不要。ただし「店内 wifi 環境でのオフライン利用」という暗黙前提が成立しなくなる旨を明記 |
| **4 (Architecture Policy)** | 「ローカルファースト」「SQLite」「認証なし」「画像は端末ローカル」 | **大幅書き換え必須**：<br>- 「ローカルファースト」→ 「クラウドファースト（Neon）+ 端末画像ローカル」<br>- 「SQLite」→ 「PostgreSQL (Neon serverless)」<br>- 「認証なし」→ **方針要再検討**。Neon の credential を端末に置く以上、漏れた場合に書き込み放題。最低でも Neon 接続用の Personal Access Token を分離 or proxy server を 1 段かます|
| **4 (Tech Stack)** | `SQLite`, `Drizzle ORM` | `@neondatabase/serverless`（HTTP 経由）or `@neondatabase/serverless` の WebSocket。Drizzle ORM の driver を `drizzle-orm/neon-http` または `drizzle-orm/neon-serverless` に変更。**RN 環境で fetch ベースの neon-http が無難**（WebSocket は Hermes/Metro 周りで詰まる可能性）。<br>追加検討：オフラインキャッシュ層（後述） |
| **5 (Core Navigation)** | タブ構成 | 変更なし |
| **6 (Item)**, **7 (Measurement)** 他 各エンティティ | TypeScript 型 | 型自体は変更なし。**スキーマ DDL が SQLite 文法 → PostgreSQL 文法**：<br>- `TEXT` 主キー → `text` または `uuid`<br>- `INTEGER` (boolean 用) → `boolean`<br>- ISO datetime string → `timestamptz`（型に変えるか、文字列のまま運用するか方針要決定）<br>- enum 値 → PostgreSQL `enum` または CHECK 制約 or 文字列<br>- `JSON` 系（必要に応じて） → `jsonb` |
| **8 (Photos)** | URI を SQLite に保存、画像ファイルは端末ローカル | **方針再検討必須**：<br>- 端末ローカルのままで良いなら、URI は端末固有（再インストール / 機種変で消失）<br>- 真にクラウドファーストにするなら Cloudflare R2 / S3 / Supabase Storage / Neon に画像 URL を保存する設計が必要<br>- 折衷案：画像はローカル + サムネイル/縮小版だけクラウドにアップして同期可能化 |
| **9 (Fit Anchors)** | items を参照 | 変更なし（型レベル） |
| **10 (Wishlist/Candidate)** | candidate_infos | 変更なし（型レベル）|
| **11 (Compare)** | 計算は pure function | **計算は変更不要**だが、参照するデータが Neon 由来 → fetch 失敗時の挙動定義が要る |
| **12 (Personal NG Rules)** | DB 保存 | 変更なし（型レベル）|
| **13 (Buy Judgment Score)** | 計算 + DB 保存 | スコア合成式は元から未定義のため、Neon 影響独立 |
| **15-17 各種ログ** | DB 保存 | 変更なし（型レベル）|
| **18 (Text Extraction)** | pure function | 変更なし |
| **22 (Stats)** | 集計 | **重要**: 集計クエリを SQLite 想定（join, group by）から PostgreSQL クエリに置換。WindowFunction / FILTER 句などが使えるようになるので Drizzle で書き直す価値あり |
| **24 (Notifications)** | expo-notifications で local notification | **そのまま使える**。リマインダー時刻の保存先は Neon になる |
| **25 (Backup/Export/Import)** | JSON/CSV export, Zod import validation | **概念再定義必須**：<br>- 「バックアップ」は Neon 側で取る（`pg_dump` 等）→ アプリの責務外にするか、明示的にユーザー操作で export する機能は残すか<br>- import の意味 = 「他のデータソースからの初期投入」と再定義<br>- 「機種変対策」としての export は不要になる（クラウドにあるため） |
| **29 (DB Tables)** | テーブル名一覧 | テーブル名はそのまま使えるが、PostgreSQL 命名規則（snake_case）に合わせる。**スキーマ定義（src/db/schema.ts）は drizzle-orm/pg-core になる** |
| **31 (Phases)** | Phase 1 に SQLite/Drizzle | **Phase 1 を「Neon project setup, drizzle-kit setup, env 管理」に書き換え**。<br>Phase 8 の export/import を「Neon 直接バックアップに置換 or 削除」 |
| **34 (File Structure)** | `src/db/client.ts`, `src/db/schema.ts`, `src/db/migrations/` | client.ts を Neon HTTP/Pool client に。migrations はマシン側で `drizzle-kit migrate` 運用（端末では走らせない）|

### 3.2 アーキテクチャ上の追加検討

#### A. 接続経路パターン

| 案 | 概要 | Pros | Cons |
|---|---|---|---|
| **A. アプリから Neon に直接接続** | RN から `@neondatabase/serverless` で直接 | サーバ不要、最短 | **credential が iOS バンドルに埋まる = 漏洩 = DB 全壊リスク**（個人用でも） |
| **B. Edge function/Cloudflare Worker を間に挟む** | Worker 経由で SQL や API を叩く | credential を Worker 側に隔離、認証/レート制御を後付け可能 | Worker 実装の追加工数、ネットワーク 1 hop 増 |
| **C. Hono/Express + Neon を Vercel/Cloudflare で立てる + tRPC** | 普通の API サーバ | 型安全、将来拡張性 | サーバ運用工数 |
| **D. Supabase / Hasura に乗り換え** | RLS で credential 露出を防げる | 認証・RLS が強い | 設計書の前提から大きく離れる |

**推奨**: 個人用＆iOS 1 端末利用なら **B (Cloudflare Worker + Neon)** が credential リスクと工数のバランス良し。「認証なし」を維持するなら Worker 側で短期トークン or origin restriction を入れて被害を限定する。

#### B. オフライン考慮（最重要）

設計書 32章の UI Principle:
> 買い物中に片手で使える
> 候補登録から比較まで最短導線にする

**店舗内 / 古着屋 / 路面店で電波が弱い** ことを考えると、Neon に **直接依存** するアーキテクチャは UX を壊す。

**対策案：**

1. **ローカル SQLite キャッシュ + Neon を真実情報源 (SoR)**：
   - WatermelonDB / expo-sqlite + Drizzle で端末側に複製を持つ
   - 起動時 / 操作時に diff sync
   - 設計書の「ローカルファースト」精神を保てる
   - Drizzle ORM を SQLite と Neon で使い分けるか、ローカルだけ Drizzle、Neon は raw SQL/Hono にするか要設計
2. **書き込みのキューイング**：候補登録 / 採寸入力はオフライン中に積んで、オンライン復帰時に flush
3. **conflict resolution 方針**：1 端末利用なら conflict はほぼ起きないが、「複数端末で編集」可能性を捨てるなら設計はシンプル
4. **photo は元から端末ローカル → これは offline 親和性高い**

#### C. マイグレーション運用

- `drizzle-kit generate` / `drizzle-kit migrate` の実行主体：
  - 開発者ローカル PC（推奨）
  - CI（GitHub Actions）→ ただし個人プロジェクトでは CI 未整備の可能性
  - アプリ起動時 → **絶対 NG**（credential exposure + 制御不能）
- **DB の dev / prod 分離**：Neon の branching 機能を活用すれば dev/prod を 2 branch で分離できる

#### D. シークレット管理

- `.env` で `NEON_DATABASE_URL` 管理
- Expo の場合 `EXPO_PUBLIC_*` を **絶対に使わない**（バンドルに含まれる）
- EAS Secrets を使うが、ビルド成果物 .ipa からは抽出可能 → やはり Worker 経由が安全
- `.gitignore` に `.env*` を追加（現状の Xcode 用 .gitignore には未追加）

### 3.3 章別 書き換え必要箇所サマリ

```
章 4   : Tech Stack / Architecture Policy をフル書き換え
章 8   : 画像保存戦略を再定義（端末 only / クラウド / hybrid）
章 25  : Backup/Export/Import を再設計
章 29  : DDL を PostgreSQL に変換
章 31  : Phase 1 / Phase 8 を更新
章 34  : src/db/* の構成を更新（neon client, migrations 運用変更）
章 4   : 「認証なし」を再考、もしくは Worker proxy 採用方針を追記

【新規追加が必要なセクション】
- Network / Offline 戦略
- Secret / Credential 管理
- Migration Operation
- Cache / Sync Strategy（Neon + SQLite hybrid 採用時）
- Backup（Neon の branching と pg_dump、point-in-time recovery）
```

---

## 4. リスク・ブロッカー

### 4.1 セキュリティリスク（最大）

| # | リスク | 影響 | 緩和策 |
|---|---|---|---|
| **R1** | **Neon credential が iOS バンドルから抽出可能** | DB 全削除 / 全データ漏洩 / 課金攻撃 | 直接接続を避け、Worker 経由にする。credential はサーバ側に置く |
| R2 | EAS Secrets でも .ipa ファイル展開で取得可能 | 同上 | 短期トークン発行 + IP/デバイス制限 |
| R3 | 認証なしの API endpoint は全公開状態 | 第三者から read/write 可能 | Origin restriction, 簡易 API key, IP allowlist |

### 4.2 オフライン / UX リスク

| # | リスク | 影響 | 緩和策 |
|---|---|---|---|
| **R4** | **店内オフラインでアプリ機能停止** | 買い物中に Compare できず実用性ゼロ | ローカル SQLite キャッシュ + 後追い同期、または Neon 移行を再検討 |
| R5 | 起動時の Neon コールドスタート遅延 | 起動が遅く感じる | local cache + background refresh パターン |
| R6 | 通信不調時のリトライ・タイムアウト未設計 | UX 劣化 | fetch に retry/timeout policy を入れる、UI に loading/error 状態 |

### 4.3 Neon プラン制限

| # | リスク | 影響 | 緩和策 |
|---|---|---|---|
| R7 | Free tier の **CU-hour / storage / connection 数** 上限 | 個人用なら通常上限内に収まるが、画像 URL を含めて巨大化すると課金 / 制限 | 画像本体は Neon に入れず、ストレージサービスに分離 |
| R8 | Neon は 5 min idle で suspend → コールドスタートに 数百 ms | 1 操作ごとに体感ラグ | アプリ起動時に warm-up クエリ |
| R9 | regional latency（Neon US/EU/Asia） | JP からの latency | Neon Asia (Tokyo) リージョン選択可能か確認 |

### 4.4 移行 / 設計プロセス上のリスク

| # | リスク | 影響 | 緩和策 |
|---|---|---|---|
| R10 | 設計書を SQLite 前提のまま実装すると後で大幅手戻り | 工数倍増 | **本レポート内容を踏まえて initial-plan.md を改訂してから着手** |
| R11 | スコア重み・severity 閾値が未定義のまま実装すると、テスト書けない / 振る舞い不明 | バグ温床 | Phase 5 開始前に重み definition を決める |
| R12 | 画像 URI の機種変・再インストールでの消失 | 過去資産が消える | iCloud Drive / 端末バックアップ運用ルール明記、または画像クラウド化 |

### 4.5 Stop / Reconsider 推奨ポイント

- **「個人用 iOS アプリ + 認証なし + Neon 直接接続」の組み合わせは推奨しない**。設計上の不整合が大きい
- 候補：
  1. **SQLite 維持**（最もシンプル、設計書原案通り）→ 個人 1 端末利用なら最適
  2. **Neon + Worker proxy + ローカル SQLite キャッシュ**（中規模・将来 multi-device したいとき）
  3. **Supabase 移行**（auth + RLS が手に入る、自己ホスト不要）

---

## 5. 設計書の抜け・漏れ・矛盾点リスト（総括）

### 5.1 構造的な抜け

- [ ] **テスト戦略**（フレームワーク、coverage、E2E、CI）
- [ ] **エラーハンドリング**ポリシー（DB error, network error, validation error）
- [ ] **画像最適化**（resize, compress, thumbnail, OOM）
- [ ] **画像ファイル life cycle**（item delete 時の物理削除、orphan cleanup）
- [ ] **マイグレーション運用**（dev/prod 分離、初回 seed、本番運用時の incremental migration）
- [ ] **i18n / 文言定数化**
- [ ] **アクセシビリティ**（a11y label, dynamic type, dark mode）
- [ ] **タイムゾーン**方針
- [ ] **通貨**（JPY 専用 or 多通貨）
- [ ] **logging / debug**戦略
- [ ] **dev/prod 環境分離**
- [ ] **Settings の Data reset**仕様
- [ ] **Tag 管理画面**
- [ ] **Reminder 一覧画面**
- [ ] **Wear Log 一覧画面**
- [ ] **PriceSnapshot 履歴 UI**
- [ ] **Candidate New 画面要件**
- [ ] **Buy Judgment Score の合成式・各因子レンジ・重み**
- [ ] **conditionScore の算出ロジック**
- [ ] **失敗ログを score に反映する手段**
- [ ] **MeasurementKey 型の集中管理**
- [ ] **inch ↔ cm 単位変換ロジック**
- [ ] **measurement の percent ベース閾値**
- [ ] **BrandChecklistState の型定義**（テーブルは存在するが型未定義）
- [ ] **State machine 図**（ItemStatus 遷移）
- [ ] **CandidateInfo の owned 化後の保持方針**
- [ ] **状態履歴テーブル**（status の変遷を時系列で残す）
- [ ] **PK/FK/cascade/index の方針**

### 5.2 矛盾・不整合

| # | 場所 | 内容（再掲・要修正） |
|---|---|---|
| 1 | 6章 status | `bought` と `owned` の差が未定義 |
| 2 | 13章 vs 15章 | `decision` 値の語彙不一致（lost_auction の有無） |
| 3 | 6章 wishlist vs watching | 状態境界が不明 |
| 4 | 4章 vs 8章 | 画像コピーのトリガ条件の差 |
| 5 | 6章 isSellCandidate vs 21章 SaleInfo | フラグと別テーブルの整合性ルール無し |
| 6 | 13章 vs 12章 | NG Rule severity → score 落とし方の対応関係不明 |
| 7 | 11章 表示文言 | 自然文生成ロジック未定義 |
| 8 | 22章 vs 28.7 | Stats 表示項目数の不一致 |
| 9 | 17章 BrandGuide vs brand_checklist_states | guide 編集時の state ズレ問題 |
| 10 | 25章 export 対象 | brand_checklist_states 抜け |
| 11 | 9章 FitAnchor.category | items.category と冗長 or 別意義か不明 |
| 12 | 24章 Reminder vs CandidateInfo.auctionEndsAt | auction 延長時の Reminder 再計算なし |

### 5.3 Neon 移行で書き換え必須の章

| 章 | 必要な変更 |
|---|---|
| 4 | Tech Stack: SQLite → Neon、Architecture Policy: ローカルファースト → クラウドファースト+ローカルキャッシュ、認証なし → 要再検討 |
| 8 | 画像保存戦略を再定義（端末 only / クラウド / hybrid） |
| 11, 22 | 計算/集計クエリを PostgreSQL に向けて再記述 |
| 25 | Backup/Export/Import の概念再定義（Neon 自体のバックアップ機能と切り分け） |
| 29 | DDL を PostgreSQL 文法に（テーブル名・型・制約） |
| 31 | Phase 1 を「Neon setup + drizzle-kit + env 管理」、Phase 8 を「Notifications + 多言語/UI 仕上げ」に整理 |
| 34 | `src/db/*` の構成（neon-http client、migrations 運用） |
| 新規 | Network / Offline 戦略、Secret 管理、Migration 運用、Cache/Sync 戦略 |

---

## 6. 推奨次アクション

1. **意思決定**: 本当に Neon にするか、SQLite 維持か、Supabase か、を明示的に確定
2. **意思決定**: Neon にするなら接続経路（直接 / Worker proxy / API server）を確定
3. **意思決定**: オフライン要件のレベル（必須 / nice to have / 不要）を確定
4. **設計書改訂**: 上記 5.3 の章書き換え + 5.1 の不足追加 + 5.2 の矛盾解消
5. **設計書改訂**: 13章 Buy Judgment Score の合成式・各因子レンジ・重みを定義
6. **設計書改訂**: ItemStatus の state machine 図を追加
7. **設計書改訂**: PK/FK/cascade/index 方針を 29章に追記
8. **コード未着手のうちに**: `.gitignore` を Expo 用に書き換え、`README.md` を最低限整備
9. 改訂版設計書をベースに Phase 1 着手

---

## 保存先

`/Users/shingosato/dev/src/github.com/sugarshin/seam/plan/20260426_seam-design-evaluation/codebase-investigator.md`
