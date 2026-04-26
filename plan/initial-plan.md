# Seam 要件定義

## 1. Product Name

**Seam**

## 2. Concept

Seam は、古着・服・靴・小物を記録し、購入前に手持ちアイテムと比較して、サイズ・価格・状態・重複リスクをもとに買うべきか判断するための個人用 iOS アプリ。

一般的なクローゼット管理アプリではなく、中心価値は **「買う前の判断精度を上げること」**。

特に以下を重視する。

* 古着の実寸管理
* 手持ち服とのサイズ比較
* 自分にとっての理想サイズの記録
* 買う / 見送る理由の記録
* オークション上限価格の管理
* 失敗買いの学習
* ブランド・年代・状態メモの蓄積

---

# 3. Target User

主なユーザーは、古着を買う個人ユーザー。

想定行動:

* ヤフオク、メルカリ、古着屋、オンラインストアで服を見る
* 気になる商品を保存する
* 購入前に手持ち服と実寸比較する
* 上限価格を決める
* 買う / 見送る / 入札する判断を記録する
* 買った後に成功・失敗理由を残す
* 自分のサイズ感データベースを育てる

---

# 4. Platform

## Target

* iOS first
* Expo + React Native
* App Store 公開は当面しない
* 自分用アプリとして使う
* EAS internal distribution / development build で実機利用する

## Tech Stack

```txt
Expo
React Native
TypeScript
Expo Router
SQLite
Drizzle ORM
Zod
React Hook Form
Zustand
expo-image-picker
expo-file-system
expo-notifications
date-fns
```

## Architecture Policy

* TypeScript strict mode
* `any` は使わない
* UI とドメインロジックを分離する
* DB access は repository 層に分離する
* サイズ比較、価格計算、スコア計算、重複判定は pure function として実装する
* ローカルファースト
* 認証なし
* 画像は端末ローカル保存
* SQLite には画像 URI を保存
* 将来的な export / import を考慮する

---

# 5. Core Navigation

下部タブ構成。

```txt
Home
Closet
Wishlist
Compare
Stats
Settings
```

---

# 6. Core Entities

## 6.1 Item

手持ち服と購入候補は同じ `items` テーブルで管理する。
`status` によって owned / wishlist / sold などを表現する。

```ts
type ItemStatus =
  | "owned"
  | "wishlist"
  | "watching"
  | "bidding"
  | "negotiating"
  | "bought"
  | "skipped"
  | "lost_auction"
  | "sold";

type GarmentCategory =
  | "hoodie"
  | "sweatshirt"
  | "t_shirt"
  | "shirt"
  | "jacket"
  | "coat"
  | "pants"
  | "shorts"
  | "shoes"
  | "bag"
  | "accessory"
  | "other";

type GarmentItem = {
  id: string;
  status: ItemStatus;

  name: string;
  brand?: string;
  modelName?: string;
  category: GarmentCategory;
  color?: string;
  sizeLabel?: string;

  purchasePrice?: number;
  shippingFee?: number;
  totalPrice?: number;
  purchaseDate?: string;
  purchaseSource?: string;
  productUrl?: string;

  conditionRank?: "S" | "A" | "B" | "C" | "D";
  conditionNotes?: string;

  fitRating?: "too_small" | "just" | "slightly_large" | "large" | "too_large";
  favoriteScore?: 1 | 2 | 3 | 4 | 5;

  isFitAnchor: boolean;
  isSellCandidate: boolean;

  notes?: string;

  createdAt: string;
  updatedAt: string;
};
```

---

# 7. Measurements

## 7.1 Policy

古着は表記サイズが当てにならないため、実寸を最重要情報として扱う。

カテゴリごとに入力項目を変える。

## 7.2 Tops

対象:

* hoodie
* sweatshirt
* t_shirt
* shirt
* jacket
* coat

```ts
type TopMeasurements = {
  shoulderWidth?: number;
  chestWidth?: number;
  bodyLength?: number;
  sleeveLength?: number;
  neckToSleeve?: number;
};
```

表示名:

```txt
肩幅
身幅
着丈
袖丈
裄丈
```

## 7.3 Pants

対象:

* pants
* shorts

```ts
type PantsMeasurements = {
  waist?: number;
  rise?: number;
  inseam?: number;
  thighWidth?: number;
  kneeWidth?: number;
  hemWidth?: number;
  totalLength?: number;
};
```

表示名:

```txt
ウエスト
股上
股下
ワタリ
膝幅
裾幅
総丈
```

## 7.4 Shoes

対象:

* shoes

```ts
type ShoesMeasurements = {
  jpSize?: number;
  usSize?: number;
  ukSize?: number;
  euSize?: number;
  outsoleLength?: number;
  outsoleWidth?: number;
};
```

## 7.5 DB Storage

DB では汎用 key-value 形式で保存する。

```ts
type Measurement = {
  id: string;
  itemId: string;
  key: string;
  value: number;
  unit: "cm" | "inch" | "jp" | "us" | "uk" | "eu";
};
```

---

# 8. Photos

## Requirements

* アイテムごとに複数画像を登録できる
* カメラ撮影
* ライブラリから選択
* 画像は端末ローカルにコピーして保存
* DB には URI を保存
* 1枚目を cover image として扱う

```ts
type ItemPhoto = {
  id: string;
  itemId: string;
  uri: string;
  sortOrder: number;
  createdAt: string;
};
```

---

# 9. Fit Anchors

## Concept

自分にとっての基準サイズを登録する機能。

例:

* 理想のパーカー
* ジャストなシャツ
* 太めパンツの基準
* 細めスラックスの基準
* ちょうどいい靴

## Requirements

* owned item を Fit Anchor に設定できる
* カテゴリごとに複数設定できる
* 比較画面では Fit Anchor を優先表示する
* Anchor 名とメモを持てる

```ts
type FitAnchor = {
  id: string;
  itemId: string;
  name: string;
  category: GarmentCategory;
  notes?: string;
  createdAt: string;
};
```

---

# 10. Wishlist / Candidate

## Concept

買う前の商品を保存する場所。

## Requirements

購入候補として以下を登録できる。

* 商品名
* ブランド
* カテゴリ
* URL
* 販売元
* 現在価格
* 送料
* 合計金額
* オークション終了日時
* 上限入札価格
* 商品説明
* 出品者名
* 状態メモ
* 実寸
* 写真
* 判断ステータス

## Source Type

```ts
type SourceType =
  | "yahoo_auction"
  | "mercari"
  | "rakuma"
  | "ebay"
  | "online_store"
  | "physical_store"
  | "other";
```

## Candidate Info

```ts
type CandidateInfo = {
  itemId: string;

  sourceType: SourceType;

  currentPrice?: number;
  shippingFee?: number;
  totalPrice?: number;

  auctionEndsAt?: string;

  easyBuyPrice?: number;
  acceptablePrice?: number;
  maxBidPrice?: number;

  sellerName?: string;
  listingDescription?: string;
};
```

---

# 11. Compare

## Concept

Seam の最重要画面。
候補商品と手持ち服を比較して、買ってよいか判断する。

## Requirements

候補商品を1つ選び、以下の比較対象を表示する。

* 同カテゴリの Fit Anchors
* 同ブランドの owned items
* 同カテゴリの owned items
* 最近買った似たアイテム
* サイズが近いアイテム

## Compare Output

表示例:

```txt
Candidate:
Russell Athletic Hoodie XL

Measurements:
身幅 60cm
着丈 66cm
袖丈 61cm

Compared with:
理想の Russell Hoodie

Diff:
身幅 +4cm
着丈 +2cm
袖丈 +1cm

判定:
少しゆったり。サイズ的には良さそう。
```

## Difference Severity

```ts
type MeasurementDiffSeverity =
  | "same"
  | "close"
  | "different"
  | "warning";
```

## Default Top Rules

```txt
±1cm: same
±2〜3cm: close
±4〜5cm: different
±6cm以上: warning
着丈 -4cm以下: warning
袖丈 -4cm以下: warning
```

## Default Pants Rules

```txt
ウエスト ±2cm: close
ウエスト +5cm以上: warning / ベルト前提
股下 +5cm以上: 裾上げ前提
股下 -3cm以下: warning
裾幅 +3cm以上: シルエット変化あり
```

## Default Shoes Rules

```txt
JP ±0.5cm: close
JP +1.0cm以上: 大きめ
JP -0.5cm以下: 小さめ注意
```

---

# 12. Personal NG Measurement Rules

## Concept

自分にとって合わない寸法を保存する。

例:

```txt
パーカー:
着丈 63cm 以下は短い
身幅 64cm 以上は大きすぎる

パンツ:
股下 76cm はちょうどいい
股下 80cm 以上は裾上げ前提
裾幅 24cm 以上は太め
```

## Data Model

```ts
type MeasurementRule = {
  id: string;
  category: GarmentCategory;
  measurementKey: string;
  operator: "lt" | "lte" | "gt" | "gte";
  value: number;
  severity: "warning" | "ng";
  message: string;
  createdAt: string;
  updatedAt: string;
};
```

## Requirements

* Settings からルールを作成・編集・削除できる
* Compare 画面で候補商品にルールを適用する
* NG に該当したら score を下げる
* warning / ng を視覚的に表示する

---

# 13. Buy Judgment Score

## Concept

買う / 見送る判断を感覚だけにせず、一定の基準で記録する。

## Score Factors

* sizeScore
* priceScore
* conditionScore
* uniquenessScore
* duplicateRiskScore

```ts
type CandidateEvaluation = {
  id: string;
  itemId: string;

  sizeScore: number;
  priceScore: number;
  conditionScore: number;
  uniquenessScore: number;
  duplicateRiskScore: number;

  totalScore: number;

  decision: "buy" | "watch" | "skip";
  reason?: string;

  createdAt: string;
};
```

## Decision Rule

```txt
80点以上: Buy
60〜79点: Watch
59点以下: Skip

ただし、Personal NG Rule に該当する場合は Watch または Skip に落とす。
```

## Requirements

* Candidate detail でスコア表示
* Compare 結果から sizeScore を算出
* 価格情報から priceScore を算出
* 同カテゴリ・同色・同ブランドの所有数から duplicateRiskScore を算出
* ユーザーが最終判断を上書きできる

---

# 14. Max Bid / Price Memo

## Concept

オークションやフリマで熱くなって払いすぎないための機能。

## Fields

```txt
現在価格
送料
合計金額
迷わず買い価格
許容価格
上限価格
```

## Requirements

* `currentPrice + shippingFee = totalPrice`
* totalPrice が maxBidPrice を超えたら警告
* maxBidPrice を設定できる
* easyBuyPrice / acceptablePrice / maxBidPrice を設定できる
* Home に終了間近の候補を表示する

## UI Example

```txt
現在価格: 2,800円
送料: 750円
合計: 3,550円

迷わず買い: 3,000円
まだ許容: 4,000円
上限: 4,500円
```

---

# 15. Decision Log

## Concept

なぜ買った / 見送ったかを記録する。

```ts
type DecisionLog = {
  id: string;
  itemId: string;
  decision: "buy" | "watch" | "skip" | "lost_auction";
  reason: string;
  priceAtDecision?: number;
  createdAt: string;
};
```

## Examples

```txt
Buy:
サイズが理想のRussellパーカーに近い。送料込み4,000円以内なら買い。

Skip:
着丈が短い。似たネイビーのパーカーをすでに2枚持っている。
```

## Requirements

* Candidate detail から記録できる
* 履歴として複数残せる
* 購入後にも参照できる
* Stats で Buy / Skip の傾向を見られる

---

# 16. Failure Log

## Concept

買った後の失敗を次の購入判断に活かす。

```ts
type FailureLog = {
  id: string;
  itemId: string;
  result: "success" | "mixed" | "failure";
  reason:
    | "too_small"
    | "too_large"
    | "too_short"
    | "too_long"
    | "bad_condition"
    | "different_color"
    | "bad_fabric"
    | "duplicate"
    | "not_worn"
    | "other";

  notes?: string;
  createdAt: string;
};
```

## Failure Reasons

```txt
着丈が短い
身幅が大きすぎた
肩幅が狭い
袖丈が短い
ウエストが大きい
股下が短い
生地が薄い
写真より色が違う
状態が悪かった
似た服を持っていた
着なかった
その他
```

## Requirements

* owned item に対して記録できる
* Compare / Score ロジックで過去の失敗を参照できる
* Stats で失敗理由ランキングを表示する

---

# 17. Brand Notes / Checklists

## Concept

ブランドごとの見るべきポイントを保存する。

```ts
type BrandGuide = {
  id: string;
  brand: string;
  category?: GarmentCategory;
  title: string;
  notes: string;
  checklistItems: string[];
  createdAt: string;
  updatedAt: string;
};
```

## Examples

### Dickies 874

```txt
- 表記 W/L と実寸差を見る
- 股上、ワタリ、裾幅が重要
- 裾がオリジナルか確認
- 古着と現行でシルエット差に注意
```

### Russell Athletic

```txt
- USA / Mexico / Honduras 製を記録
- タグ年代をメモ
- リブ伸びを確認
- 着丈短め個体に注意
```

## Requirements

* Settings または Brand Guide 画面から管理
* Candidate 登録時に同ブランドの guide を表示
* Checklist の確認状態を candidate ごとに保存できる

---

# 18. Text Measurement Extraction

## Concept

商品説明テキストから実寸を自動抽出する。

## v1 Scope

画像 OCR ではなく、まずは貼り付けたテキストから正規表現で抽出する。

対応例:

```txt
肩幅 58
肩幅：58cm
身幅 60cm
着丈：約66cm
袖丈 61
ウエスト 91cm
股下 76cm
ワタリ 34cm
裾幅 23cm
```

## Data Model

```ts
type MeasurementExtractionResult = {
  measurements: Measurement[];
  confidence: number;
  rawText: string;
};
```

## Requirements

* Candidate description から抽出
* 抽出結果はユーザーが確認・修正して保存
* 未対応の表記があっても落ちない
* domain function として実装する

---

# 19. OCR Interface

## Concept

将来的にスクショ画像から実寸を抽出できるようにする。

## v1 Requirement

* OCR 自体は後回しでよい
* interface だけ用意する

```ts
type MeasurementExtractor = {
  extractFromText(text: string): MeasurementExtractionResult;
  extractFromImage(uri: string): Promise<MeasurementExtractionResult>;
};
```

---

# 20. Wear Log / Cost Per Wear

## Concept

買った後に実際に着ているかを記録する。

```ts
type WearLog = {
  id: string;
  itemId: string;
  wornAt: string;
  notes?: string;
};
```

## Requirements

* owned item に着用ログを追加できる
* 着用回数を表示
* 最終着用日を表示
* cost per wear を計算する

```txt
costPerWear = totalPrice / wearCount
```

---

# 21. Sell Candidate / Sold

## Requirements

* owned item を売却候補にできる
* `isSellCandidate` を設定できる
* sold status に変更できる
* 売却価格を記録できる
* sold item は Closet から除外 / 表示切替できる

追加フィールド:

```ts
type SaleInfo = {
  itemId: string;
  soldPrice?: number;
  soldAt?: string;
  soldSource?: string;
  notes?: string;
};
```

---

# 22. Stats

## Concept

買いすぎ、重複、着ていない服、価格傾向を可視化する。

## Requirements

表示するもの:

* 所有数
* カテゴリ別所有数
* ブランド別所有数
* 色別所有数
* 月別購入数
* 月別購入金額
* 平均購入価格
* 直近30日で買った数
* 直近30日で見送った数
* 着ていない服
* 売却候補
* cost per wear が高い服
* 同カテゴリ・同色の重複
* Buy / Watch / Skip の割合
* 失敗理由ランキング

---

# 23. Search / Filter / Sort

## Search

対象:

* 名前
* ブランド
* モデル名
* メモ
* タグ
* 販売元
* 色

## Filter

```txt
status
category
brand
color
sizeLabel
fitRating
isFitAnchor
isSellCandidate
conditionRank
sourceType
```

## Sort

```txt
createdAt desc
purchaseDate desc
purchasePrice desc
favoriteScore desc
lastWornAt asc
category
brand
```

---

# 24. Notifications

## Concept

オークション終了前に通知する。

## Requirements

* auctionEndsAt を設定できる
* 通知 ON/OFF
* 終了前通知時間を設定できる

  * 10分前
  * 30分前
  * 1時間前
  * 3時間前
  * 1日前
* local notification を使う
* 通知済み状態を保存する

```ts
type Reminder = {
  id: string;
  itemId: string;
  remindAt: string;
  notificationId?: string;
  isEnabled: boolean;
  createdAt: string;
};
```

---

# 25. Backup / Export / Import

## Concept

個人データを失わないための機能。

## Requirements

* JSON export
* JSON import
* CSV export
* v1 では画像 export は対象外でもよい
* 将来的に zip export を検討
* import 時に Zod で validation
* import 前に確認画面を出す

Export 対象:

```txt
items
measurements
photos metadata
fit anchors
candidate infos
candidate evaluations
decision logs
failure logs
brand guides
wear logs
measurement rules
price snapshots
tags
item tags
reminders
```

---

# 26. Tags

## Requirements

* item に複数タグを付けられる
* タグで検索・フィルタできる

```ts
type Tag = {
  id: string;
  name: string;
  createdAt: string;
};

type ItemTag = {
  itemId: string;
  tagId: string;
};
```

---

# 27. Price Snapshots

## Concept

候補商品の価格変化を手動記録できる。

```ts
type PriceSnapshot = {
  id: string;
  itemId: string;
  price: number;
  shippingFee?: number;
  totalPrice?: number;
  recordedAt: string;
};
```

## Requirements

* candidate detail から現在価格を記録できる
* 過去価格を一覧表示する
* 最終価格を decision log に残せる

---

# 28. Screens

## 28.1 Home

表示内容:

* 今日終了するオークション
* 近日終了する購入候補
* 最近追加したアイテム
* 最近買ったアイテム
* 注意が必要な候補

  * サイズが NG ラインに近い
  * 手持ちと重複している
  * 合計金額が上限価格を超えている
* 今月の購入数
* 今月の購入金額

---

## 28.2 Closet

機能:

* owned item 一覧
* 写真グリッド
* 検索
* フィルタ
* ソート
* item detail への遷移
* 新規 item 追加

---

## 28.3 Wishlist

機能:

* wishlist / watching / bidding / negotiating の一覧
* 終了日時順
* 価格順
* decision status 表示
* candidate detail への遷移
* 新規 candidate 追加

---

## 28.4 Item Detail

表示:

* 写真
* 名前
* ブランド
* カテゴリ
* 色
* 表記サイズ
* 実寸
* 購入価格
* 状態
* 着用感
* メモ
* タグ
* Fit Anchor 状態
* Wear logs
* Failure logs
* Decision logs

操作:

* 編集
* 削除
* Fit Anchor にする
* 売却候補にする
* sold にする
* 着用ログ追加
* 失敗ログ追加

---

## 28.5 Candidate Detail

表示:

* 写真
* 商品情報
* URL
* 現在価格
* 送料
* 合計
* 終了日時
* 上限価格
* 実寸
* 商品説明
* 抽出された実寸
* Brand checklist
* Score
* Decision logs

操作:

* 編集
* Compare へ
* Buy / Watch / Skip 記録
* 価格 snapshot 追加
* 通知設定
* Bought に変換
* Lost Auction にする

---

## 28.6 Compare

機能:

* candidate を選択
* compare target を表示
* Fit Anchors 優先表示
* 実寸差分表示
* severity 表示
* Personal NG Rule の警告
* duplicate warning
* score 表示
* decision 登録

---

## 28.7 Stats

表示:

* 所有数
* カテゴリ別
* ブランド別
* 色別
* 月別購入金額
* 平均購入価格
* cost per wear
* 着ていない服
* 売却候補
* 重複候補
* Buy / Watch / Skip 比率
* 失敗理由ランキング

---

## 28.8 Settings

機能:

* Personal NG Measurement Rules 管理
* Brand Guides 管理
* Export
* Import
* Notification settings
* Data reset
* App info

---

# 29. Database Tables

```txt
items
measurements
photos
fit_anchors
candidate_infos
candidate_evaluations
decision_logs
failure_logs
measurement_rules
brand_guides
brand_checklist_states
wear_logs
sale_infos
price_snapshots
tags
item_tags
reminders
```

---

# 30. Important Domain Functions

Claude Code には、まず以下を pure function として実装させる。

```ts
calculateTotalPrice(price, shippingFee)

compareMeasurements(candidateMeasurements, referenceMeasurements, category)

getMeasurementDiffSeverity(diff, measurementKey, category)

evaluatePersonalMeasurementRules(itemMeasurements, rules)

calculateSizeScore(candidate, anchors)

calculatePriceScore(candidateInfo)

calculateDuplicateRisk(candidate, ownedItems)

calculateUniquenessScore(candidate, ownedItems)

calculateCandidateScore(input)

suggestSimilarItems(candidate, ownedItems)

extractMeasurementsFromText(text)

calculateCostPerWear(totalPrice, wearCount)
```

---

# 31. Suggested Implementation Phases

全部入れる前提でも、実装は段階化する。

## Phase 1: Foundation

* Expo project setup
* Expo Router
* TypeScript strict
* SQLite / Drizzle setup
* DB schema
* migrations
* theme
* tab navigation
* domain types
* repository structure
* seed data

## Phase 2: Item CRUD

* item create/edit/delete
* Closet list
* Item detail
* category-specific measurement input
* photo picker
* tags
* search/filter/sort

## Phase 3: Wishlist / Candidate

* candidate registration
* candidate detail
* source type
* price fields
* max bid fields
* auction end date
* price snapshot
* URL field
* listing description

## Phase 4: Compare

* Fit Anchors
* compare screen
* measurement diff logic
* diff severity
* similar item suggestion
* Personal NG Measurement Rules

## Phase 5: Judgment

* score calculation
* Buy / Watch / Skip
* decision logs
* duplicate risk
* uniqueness score
* condition score
* price score

## Phase 6: After Purchase

* wishlist / candidate → owned conversion
* failure logs
* wear logs
* cost per wear
* sell candidate
* sold status

## Phase 7: Intelligence

* text measurement extraction
* brand notes
* brand checklists
* checklist state per candidate
* stats

## Phase 8: Utility

* local notifications
* JSON export
* JSON import
* CSV export
* data reset
* settings polish

---

# 32. UI / Visual Direction

## Style

* ミニマル
* モノトーン
* 古着・アーカイブ感
* 写真中心
* 情報密度は高め
* 数値比較が見やすい
* 装飾より実用性優先

## UI Principles

* 買い物中に片手で使える
* 写真なしでも登録できる
* URLなしでも登録できる
* 候補登録から比較まで最短導線にする
* 入力途中で迷わない
* 数値差分を強調する
* Buy / Watch / Skip をすぐ残せる

---

# 33. Claude Code に渡す初回プロンプト

```txt
You are building an iOS-first Expo React Native app named "Seam".

Seam is a personal vintage clothing purchase decision app. The core purpose is not outfit planning. The core purpose is helping the user record owned garments and compare candidate items before buying, especially by measurements, price, condition, and duplication risk.

Use:
- Expo
- React Native
- TypeScript strict mode
- Expo Router
- SQLite
- Drizzle ORM
- Zod
- React Hook Form
- Zustand
- expo-image-picker
- expo-file-system
- expo-notifications
- date-fns

Do not use `any`.
Keep domain logic separate from UI.
Implement pure functions for measurement comparison, score calculation, price calculation, duplicate detection, and text-based measurement extraction.
Use local-first storage. No authentication is required.
Images should be stored locally and referenced by URI in SQLite.

The app must support:
1. Create/edit/delete garment items
2. Store owned items and wishlist/candidate items in a unified item model
3. Category-specific measurement input
4. Photo registration from camera/library
5. Fit Anchors for ideal size reference items
6. Candidate item registration with URL, price, shipping fee, auction end date, and max bid price
7. Compare a candidate item with Fit Anchors and similar owned items
8. Display measurement differences with severity labels
9. Personal NG measurement rules
10. Buy / Watch / Skip decision logs
11. Candidate score calculation using size, price, condition, uniqueness, and duplicate risk
12. Failure logs after purchase
13. Brand notes and checklists
14. Wear logs and cost per wear
15. Sell candidate and sold status
16. Stats for category, brand, color, purchase amount, unworn items, duplicates, decisions, and failure reasons
17. Text-based measurement extraction from listing descriptions
18. Price snapshots
19. Tags
20. JSON/CSV export and import
21. Local notifications for auction end reminders

Core tabs:
- Home
- Closet
- Wishlist
- Compare
- Stats
- Settings

Start by creating:
- project structure
- database schema
- domain types
- repositories
- migrations
- measurement comparison functions
- price calculation functions
- score calculation functions
- text measurement extraction function
- item CRUD screens
- closet list screen
- item detail screen
- wishlist list screen
- candidate detail screen
- compare screen skeleton

After implementing foundation, add tests for domain logic.
```

---

# 34. 最初に Claude Code に作らせるべきファイル構成案

```txt
app/
  (tabs)/
    index.tsx
    closet.tsx
    wishlist.tsx
    compare.tsx
    stats.tsx
    settings.tsx
  item/
    [id].tsx
    new.tsx
  candidate/
    [id].tsx
    new.tsx

src/
  db/
    client.ts
    schema.ts
    migrations/
  domain/
    items/
      types.ts
      measurementKeys.ts
      measurementRules.ts
    compare/
      compareMeasurements.ts
      diffSeverity.ts
      suggestSimilarItems.ts
    scoring/
      calculateCandidateScore.ts
      calculateSizeScore.ts
      calculatePriceScore.ts
      calculateDuplicateRisk.ts
      calculateUniquenessScore.ts
    extraction/
      extractMeasurementsFromText.ts
    pricing/
      calculateTotalPrice.ts
    wear/
      calculateCostPerWear.ts
  repositories/
    itemRepository.ts
    measurementRepository.ts
    candidateRepository.ts
    fitAnchorRepository.ts
    decisionLogRepository.ts
    failureLogRepository.ts
  components/
    ItemCard.tsx
    MeasurementInputGroup.tsx
    PhotoPicker.tsx
    PriceSummary.tsx
    ScoreBadge.tsx
    DiffRow.tsx
    EmptyState.tsx
  stores/
    itemStore.ts
  utils/
    date.ts
    money.ts
    ids.ts
```

---

# 35. 最重要 Acceptance Criteria

最初の実用ラインは以下。

```txt
1. 手持ち服を登録できる
2. 実寸をカテゴリごとに登録できる
3. 写真を登録できる
4. 購入候補を登録できる
5. 購入候補に価格・送料・上限価格を設定できる
6. Fit Anchor を設定できる
7. 候補商品と Fit Anchor のサイズ差分を見られる
8. Buy / Watch / Skip を理由付きで残せる
9. 購入後に owned item に変換できる
10. 失敗理由を記録できる
```

この 10 個が動けば、Seam はすでに実用になります。
その後、Stats / OCR / Export / Notifications を足して完成度を上げるのがよいです。

