---
name: recover-app
description: Seam が iPhone 実機で「このAppは利用できなくなりました」と表示されて開けなくなったときの復旧 runbook。無料 Apple ID 署名の約7日失効で SideStore 本体ごと開けなくなった状態を、Mac の iloader で SideStore を入れ直し → Seam を再署名して復旧する（データは保持される）。対話形式で、Claude が環境チェックを自動実行し、手作業の各ステップを案内・確認しながら進める。「Seam が開けない」「アプリが使えなくなった」「このAppは利用できなくなりました」「SideStore が開けない」等で起動。
user-invocable: true
---

# Recover app skill

iPhone 実機の Seam が **「このAppは利用できなくなりました」** と表示されて開けなく
なった状態を復旧する対話型 runbook。

このスキルは **Claude が実機・iloader を直接操作することはできない**（USB 接続・GUI
認証・iPhone 側の信頼操作は物理操作）。Claude の役割は次の 2 つ:

1. **自動でできる確認は Bash で代行**する（iloader の有無/version、`source.json` の
   live 配信、最新 Release の有無、ローカル `app.json` の version など）。
2. **手作業の各ステップを 1 つずつ提示し、ユーザーの「できた」を待ってから次へ進む**。
   勝手に全ステップを一気に表示しない。失敗の兆候（MinimuxerError 27 等）が出たら
   Troubleshooting の該当項目だけを提示する。

## 対象とする症状 / 対象外（最初に切り分ける）

| 症状 | 原因 | 対応 |
|---|---|---|
| **iPhone で Seam を開くと「このAppは利用できなくなりました」**。SideStore 自体も開けない or 同じ表示 | **無料 Apple ID 署名が約7日で失効**。SideStore 本体ごと失効しているので SideStore からは Refresh できない | **このスキル**（Mac の iloader で入れ直し） |
| SideStore は開ける。Browse で最新 version を認識しているのに、ボタンが **UPDATE ではなく OPEN** でアップデートできない | SideStore の update 検出バグ / source DB cache mismatch（[[sidestore_open_button_stuck]]） | **別物**。Sources から Seam の Source を Remove → 再追加 → SideStore を完全 kill → 再起動（初回 install は fail し 2 回目で成功することがある）。詳細は下の「別症状: OPEN ボタン stuck」 |

ユーザーの説明が曖昧なときは「**SideStore アプリ自体は開けますか？**」を最初に聞いて
切り分ける。SideStore も開けない → このスキル。SideStore は開けるが Seam が UPDATE
できない → OPEN ボタン stuck の方。

## 背景（なぜこうなるか）

- Seam の実機配布は GitHub Releases の **unsigned IPA を SideStore 経由**で入れている。
  SideStore **本体**を Mac から入れているツールは **iloader**（SideStore 公式インス
  トーラ、AltServer 相当、jitterbugpair 内包、bundle id `me.nabdev.iloader`）。
- 無料 Apple ID の署名は **約7日で失効**する。放置すると Seam だけでなく SideStore
  本体も失効して「このAppは利用できなくなりました」になる。
- **2026-05 に実機でこの手順での復旧・データ無傷を確認済み**。Seam のローカル
  SQLite データは再署名後も保持される（アンインストールしない限り消えない）。

## Procedure

### Step 0: 症状を確認して切り分ける

ユーザーに「SideStore アプリ自体は開けますか？」を確認。

- SideStore も開けない（or 同じ表示） → このまま Step 1 へ。
- SideStore は開けるが Seam が UPDATE できない → 「別症状: OPEN ボタン stuck」へ誘導
  して、このスキルを終了。

### Step 1: 環境を自動チェック（Claude が Bash で実行）

以下をまとめて実行し、結果をユーザーに要約して伝える。失敗があっても即 abort せず、
該当する Troubleshooting を案内する。

```bash
# 1. iloader 本体の有無と version
ls -d /Applications/iloader.app >/dev/null 2>&1 \
  && echo "iloader: $(defaults read /Applications/iloader.app/Contents/Info.plist CFBundleShortVersionString)" \
  || echo "iloader: NOT FOUND"

# 2. iloader が無い場合に備えて DMG の場所も確認
ls -la ~/Downloads/P/P/iloader-darwin-universal.dmg 2>/dev/null || echo "DMG not at recorded path"

# 3. source.json が GitHub Pages で live 配信されているか（配信側は基本問題ない前提の裏取り）
curl -s --max-time 8 https://sugarshin.github.io/seam/source.json \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const a=(j.apps||[])[0]||{};const v=(a.versions||[])[0]||{};console.log('source.json live: '+a.name+' '+(a.version||v.version)+' ('+v.date+')')})" \
  || echo "source.json: fetch/parse failed"

# 4. 最新 Release（参考）
gh release list --limit 1 2>/dev/null || echo "gh: unavailable"

# 5. ローカル app.json の version（参考）
node -p "const a=require('$PWD/packages/app/app.json').expo; 'local app.json: '+a.version+' (build '+a.ios.buildNumber+')'" 2>/dev/null || true
```

判断:

- **iloader が NOT FOUND** → Troubleshooting「iloader が無い / 古い」へ。インストール
  し終えてから Step 2 へ。
- iloader があれば version を伝えて Step 2 へ進む（DMG / source.json / Release は
  「配信側は正常」を裏取りする参考情報。これ自体が原因になることは稀）。

### Step 2: iPhone を Mac に USB 接続（ユーザーが実行）

ユーザーに依頼し、完了を待つ:

1. iPhone を **USB ケーブルで Mac に接続**
2. iPhone に「このコンピュータを信頼しますか？」が出たら **信頼** をタップ
   （パスコード入力を求められたら入力）

「接続して信頼した」を確認してから Step 3 へ。

### Step 3: iloader で SideStore を入れ直す（ユーザーが実行、Claude が起動を補助）

Claude は GUI アプリの起動だけ補助できる:

```bash
open -a /Applications/iloader.app
```

ユーザーに案内:

1. iloader が開いたら **Apple ID で認証**する。
   - ⚠ **生パスワードは不可**。[appleid.apple.com](https://appleid.apple.com) で発行した
     **App 用パスワード（app-specific password）** を使う。
2. デバイスが認識されたら、インストール対象の一覧から **「SideStore (Stable)」**
   （stable チャンネル）を選んで実行する。
   - iloader には **SideStore (Stable) / SideStore (Nightly) / SideStore + LiveContainer**
     の 3 つがある（取得先はそれぞれ `SideStore.ipa` / `SideStore-Nightly.ipa` /
     `LiveContainer+SideStore.ipa`）。Seam の実機配布は plain な SideStore
     (`com.SideStore.SideStore`) 前提なので **必ず Stable**。Nightly / LiveContainer は
     選ばない（別系統の SideStore が入り、Seam の Source / 署名と噛み合わなくなる）。
   - 画面上の正確な文言は version で多少ブレることがあるが、**「stable の SideStore」を
     選ぶ**という判断で固定。
3. iloader が **Pairing File + SideStore.ipa を iPhone に書き込む**のを待つ
   （= SideStore 本体の再署名・再インストール）。`Installing: 100%` まで進めば成功。
4. 完了したら iPhone のホーム画面に **SideStore が復活**しているはず。

ここで `MinimuxerError 27 (AFC invalid pairing)` が出たら →
Troubleshooting「MinimuxerError 27」へ。

「SideStore が入った」を確認してから Step 4 へ。

### Step 4: iPhone 側で開発者プロファイルを信頼（ユーザーが実行）

ユーザーに案内:

1. iPhone で **設定 → 一般 → VPN とデバイス管理**
2. 自分の **Apple ID の開発元プロファイル**を選んで **信頼** する

「信頼した」を確認してから Step 5 へ。

### Step 5: SideStore で Seam を再署名（ユーザーが実行）

ユーザーに案内:

1. **先に LocalDevVPN（または StosVPN）を起動して Connect しておく**。
   SideStore は再署名時にこのループバック VPN 経由でデバイスに到達して UDID を読む。
   VPN が切れていると次の Refresh が `OperationError 1006 (could not determine
   UDID)` で失敗する。⚠ **この VPN 接続が一番踏みやすい落とし穴なので必ず先に案内する**。
2. **SideStore を開く**
3. **My Apps** タブ → **Seam を再署名する**。
   - 署名失効時は行のボタンが **Update / Refresh All ではなく `EXPIRED`** と表示される
     ことが多い（2026-07 実機確認）。**その `EXPIRED` をタップ = 再署名**で、Update と
     同じ挙動。文言に惑わされず「Seam の行のボタン（`EXPIRED` / `Update`）をタップ、
     または `Refresh All`」と案内する。
   - これで Seam も再署名され、**ローカルデータは保持されたまま**開けるようになる。

ここで `OperationError 1006 (could not determine UDID / replace your pairing
using iloader)` が出たら → Troubleshooting「OperationError 1006」へ。

### Step 6: 起動確認（ユーザーが実行）

1. iPhone のホームから **Seam を起動**
2. 「このAppは利用できなくなりました」が消え、通常起動すれば復旧完了。
3. データ（アイテム / 候補 / 設定）が残っていることを確認。

完了したら、下の「予防策」を一言添えて終了する。

## Troubleshooting

### OperationError 1006 (could not determine UDID)

Step 5 の Refresh / Update で
`SideStore.OperationError 1006 — SideStore could not determine this device's
UDID. Please replace your pairing using iloader.` が出るケース。

エラー文言は「iloader で pairing を入れ直せ」と言うが、**根本原因の大半は
SideStore 用ループバック VPN（LocalDevVPN / StosVPN）が起動・接続されていない**
こと。VPN が無いと SideStore がデバイスに到達できず UDID を読めない。手間が
少なく効きやすいので、まず VPN から試す。

1. **LocalDevVPN（または StosVPN）を起動して Connect**（無ければ App Store で
   LocalDevVPN を入れる）。「VPN 構成を追加しますか？」→ 許可 + パスコード。
2. iPhone 設定 → 一般 → VPN とデバイス管理 → **VPN** に当該プロファイルが出て
   **接続済み**（画面上部に VPN アイコン）になっていることを確認。
3. **VPN を Connect したまま** SideStore に戻り **Seam を Refresh / Update** を再試行。
   - **2026-06 実機で、これだけ（LocalDevVPN を Connect → Refresh）で 1006 が解消**。
4. それでも 1006 なら、エラー文言どおり **iloader で pairing を入れ直す**
   （USB 接続 + ロック解除のまま、iloader の Manage Pairing File → Place In All
   Apps で SideStore に再配置）→ VPN Connect → Refresh。
5. なお深掘りは `MinimuxerError 27` と同根（AFC / pairing 系）。下記
   deep-dive 参照。

### MinimuxerError 27 (AFC invalid pairing)

iOS 26 系で起きやすい pairing の問題。

1. App Store の **LocalDevVPN を起動して Connect**（または StosVPN）
2. その状態で **Step 3 の iloader 認証をやり直す**

それでも直らない深掘りは
[`plan/20260426_sidestore-distribution/sidestore-error-27-deep-dive.md`](../../../plan/20260426_sidestore-distribution/sidestore-error-27-deep-dive.md)
を参照（root cause 候補と切り分け）。

### iloader が無い / 古い

- 最新版: <https://github.com/SideStore/iloader/releases>
- 手元の DMG（あれば）: `~/Downloads/P/P/iloader-darwin-universal.dmg`
- インストール後 `/Applications/iloader.app` に配置されたら Step 2 へ戻る。
- ログ確認先: `~/Library/Application Support/me.nabdev.iloader/logs/`
- Homebrew でも `/Applications` の名前検索（side/alt/stos 等）でもヒットしない。
  「**iloader**」で直接探すこと。

### 別症状: OPEN ボタン stuck（このスキルの対象外）

SideStore は開けるが、最新 version を認識しているのに **OPEN しか出ず UPDATE できない**
場合は署名失効ではなく SideStore の update 検出バグ。手順:

1. SideStore **Settings** 最下部で SideStore 本体の version 確認。`0.6.0` を踏んで
   いたら `0.6.2+` か `0.5.10` へ更新（0.6.0 は broken release）。
2. **Sources タブ → Seam の Source を Remove → 再追加 → SideStore を完全 kill → 再起動**
   （初回 install は fail し、2 回目で成功することがある）。
3. それでもダメなら、Seam の **Settings → JSON エクスポート**でデータ退避 → Seam を
   Uninstall → Browse から再 install → JSON インポートで復元。

詳細は [[sidestore_open_button_stuck]]。

### 入れ直しても Seam のデータが消えていた

通常は再署名で消えないが、万一消えていたら **Settings → JSON インポート**で
事前にエクスポートしてあった JSON から復元する（`merge` / `replace` 両対応）。
iCloud Backup に `documentDirectory` が含まれるため、端末バックアップからの復元でも
戻る可能性がある。

## 予防策（復旧後にユーザーへ伝える）

- SideStore の **Background Refresh** と **LocalDevVPN / StosVPN を常時 ON** にして、
  7日ごとの自動再署名を効かせる。
- **こまめに SideStore を開く**（フォアグラウンドでの Refresh 機会を作る）。
- 失効前に **Settings → JSON エクスポート**でデータ退避しておくと万一でも安心。

## 参照

- README「## SideStore で実機配布・復旧」（同じ runbook）
- メモリ [[sidestore_install_tool_and_recovery]]（iloader / 復旧手順、2026-05 実機確認）
- メモリ [[sidestore_open_button_stuck]]（OPEN ボタン stuck の別症状）
- `plan/20260426_sidestore-distribution/sidestore-error-27-deep-dive.md`

## Constraints

- Claude は USB 接続・iloader の GUI 認証・iPhone 側の信頼操作・SideStore 操作を
  **代行できない**。自動化できるのは Bash で叩ける確認系のみ。手作業は 1 ステップ
  ずつ案内し、ユーザーの完了報告を待つ。
- Apple ID 認証は **App 用パスワード必須**（生パスワード不可）。これを必ず明示する。
- 「このAppは利用できなくなりました」=署名失効（このスキル）と、OPEN ボタン stuck
  =update 検出バグ（別対応）を**混同しない**。曖昧なら Step 0 で切り分ける。
