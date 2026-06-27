---
name: release
description: Cut a new release of the seam iOS app — bump expo.version AND expo.ios.buildNumber in packages/app/app.json, create a version-bump commit and a vX.Y.Z tag, push both to origin/main, then monitor the release.yml workflow until it passes.
user-invocable: true
disable-model-invocation: true
---

# Release skill

`packages/app/app.json` の `expo.version` と `expo.ios.buildNumber` を両方 bump し、
commit / tag / push して `.github/workflows/release.yml` をトリガーし、その
workflow が pass する (= IPA build → GitHub Release 作成 → `docs/source.json` 更新が
完了する) まで監視する、を 1 コマンドで行う。

`buildNumber` を毎回 strictly increase させるのは SideStore / AltStore の update
検出 (`(version, buildVersion)` tuple 比較) を確実に効かせるための必須手順。
過去 v0.4.0 で `buildNumber=1` のまま放置していたために OPEN ボタンが stuck する
事象が発生した。

完了条件は **release.yml workflow が成功 (conclusion: success) すること**。
tag push だけでは完了としない — workflow が fail したら失敗 step の原因を要約し、
Recovery D を提示する。workflow の中身 (IPA build / Release 作成 / `source.json`
更新) の実装は責務外だが、その **成否の監視** は責務に含める。

## 引数

| 形式 | 例 | 挙動 |
|---|---|---|
| bump キーワード | `patch` / `minor` / `major` | 現バージョンを読み取って自動算出 |
| 明示バージョン | `0.4.0` | そのまま採用（semver 検証あり） |
| なし | （引数なしで起動） | 現バージョンを提示 → AskUserQuestion で次バージョンを選択 |

## Prerequisites（事前チェック）

すべて自動で実行する。1 つでも失敗したら abort してユーザーに原因を伝える。

1. **Working directory clean**
   - `git status --porcelain` が空であること
   - 失敗時: 「未コミットの変更があります。先に commit/stash してください」
2. **現ブランチが main**
   - `git rev-parse --abbrev-ref HEAD` が `main`
   - 失敗時: 「リリースは main ブランチでのみ可能です」
3. **Remote と同期**
   - `git fetch origin main` 後、`git rev-list HEAD..origin/main --count` が `0`、かつ `HEAD` が `origin/main` と一致
   - 失敗時: 「remote main から ahead/behind しています。pull してから再実行してください」
4. **バージョン形式**
   - 新バージョンが `^[0-9]+\.[0-9]+\.[0-9]+$` に一致
   - 失敗時: 「Apple ルールにより `MAJOR.MINOR.PATCH` のみ可能です（pre-release suffix 禁止）」
5. **逆行防止**
   - 新バージョンが現バージョンより semver 比較で大きい
   - 失敗時: 「新バージョン X.Y.Z が現バージョン A.B.C 以下です」
6. **Tag 衝突なし**
   - `git tag -l vX.Y.Z` が空、かつ `git ls-remote --tags origin vX.Y.Z` が空
   - 失敗時: 「tag vX.Y.Z は既に存在します。別のバージョンを指定してください」
7. **`ios.buildNumber` が存在し整数として解釈できる**
   - `node -p "require('./packages/app/app.json').expo.ios.buildNumber"` が integer 文字列
   - 失敗時: 「`packages/app/app.json` の `expo.ios.buildNumber` が未設定または不正です。`"buildNumber": "<n>"` を追加してから再実行してください」

## Procedure

### Step 1: 現バージョン / buildNumber 読み取りと引数解析

```bash
node -p "require('./packages/app/app.json').expo.version"
node -p "require('./packages/app/app.json').expo.ios.buildNumber"
```

新 `buildNumber` は **常に現在値 + 1**（integer として加算、文字列として保存）。
引数指定不可。

引数 (= version) の判定:
- `^[0-9]+\.[0-9]+\.[0-9]+$` → 明示バージョン
- `patch` / `minor` / `major` → 現バージョンから算出
- 空 → Step 2 へ

### Step 2: 引数なしの場合は対話

AskUserQuestion で 4 択を提示:

- `patch` (例: `0.3.0` → `0.3.1`)
- `minor` (例: `0.3.0` → `0.4.0`)
- `major` (例: `0.3.0` → `1.0.0`)
- 明示入力（"Other" で `X.Y.Z` を直接入力）

選択後、ユーザーに最終バージョンを再確認しない（Prerequisites 6 項目のチェックで誤入力は捕まえる）。

### Step 3: Prerequisites 6 項目を実行

このタイミングで 1〜6 すべてを順に検証。1 つでも失敗したら abort。

### Step 4: app.json を編集

`Edit` ツールで以下 2 箇所を更新する。他のフィールドには触れない。

1. `"version": "A.B.C"` → `"version": "X.Y.Z"`（新バージョン）
2. `"buildNumber": "<old>"` → `"buildNumber": "<old + 1>"`（現在値 +1）

### Step 5: Commit

```bash
git add packages/app/app.json
git commit -m "Version bump X.Y.Z (build N)"
```

`N` は新 `buildNumber`。`Version bump <version> (build <n>)` 形式で固定
（`chore:` プレフィックスなし）。過去 `Version bump X.Y.Z` 単独だった頃と
読み取れる semantic は同じ。

### Step 6: Main を push

```bash
git push origin main
```

`lefthook.yml` の pre-push hook（format-check / lint / typecheck / test）が走るため
完了まで待つ。失敗時: Recovery B を提示。

### Step 7: Tag を作成して push

main の push 成功を確認してから tag を作成（順序重要）:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

lightweight tag（`-a` 不要、過去パターン踏襲）。失敗時: Recovery C を提示。

### Step 8: release.yml workflow を監視（pass まで）

tag push で `release.yml` が起動する。**この workflow が成功するまでを責務に含める**。

1. **run id を解決**。tag push 直後は run が GitHub に登録されるまで数秒〜十数秒の
   ラグがあるので、見つかるまでリトライする（見つからなければ ~20s 間隔で最大 5 回）。
   version-bump commit の SHA で照合するのが最も確実:

   ```bash
   SHA=$(git rev-parse HEAD)   # Step 5 の commit
   gh run list --workflow=release.yml --event=push --limit=10 \
     --json databaseId,headSha,headBranch,status,url \
     --jq ".[] | select(.headSha==\"$SHA\")"
   ```

   対象 run は `headBranch` が `vX.Y.Z`（tag 名）。`databaseId` が run id。

2. **完了まで監視**。`build-ipa` は macos runner で 15〜25 分かかり Bash tool の
   foreground 上限（10 分）を超えるため、`run_in_background: true` で watch を回す
   （完了時に harness が再呼び出しする）:

   ```bash
   gh run watch <run-id> --exit-status
   ```

   exit 0 = workflow 成功 / 非 0 = 失敗。`gh run watch` が長時間で切れる環境では
   代わりに `gh run view <run-id> --json status,conclusion` をポーリングしてもよい。

3. **結果を判定**:
   - **成功 (conclusion: success)** → Output セクションの形式で run URL と
     GitHub Release URL を表示して完了。`release` job が `docs/source.json` 更新
     commit を origin/main に push しているため、ローカル main は 1 commit behind に
     なる。`git pull --ff-only origin main` を案内する。
   - **失敗** → `gh run view <run-id> --log-failed` で失敗 step を特定して要約し、
     Recovery D を提示する。**silent に成功扱いにしない**。

`gh` が未インストール / 未認証で監視できない場合は、abort せず Actions URL
（`https://github.com/<owner>/<repo>/actions/workflows/release.yml`）を提示して
手動監視を依頼する（release 自体は push 済みで巻き戻し不要）。

## Output

workflow が pass したら以下を一行ずつ表示:

```
Released seam vX.Y.Z build N (was vA.B.C build M)
- commit:   <short-hash> "Version bump X.Y.Z (build N)"
- tag:      vX.Y.Z (lightweight)
- pushed:   origin/main, origin/refs/tags/vX.Y.Z
- workflow: release.yml ✅ success — <run-url>
- release:  <github-release-url>
```

workflow が fail した場合は `✅ success` の行を `❌ failed` に変え、失敗 step・原因・
対処方針（Recovery D）を続けて表示する。

## Recovery procedures

スキル実行中に失敗が出たら、その時点での state に該当する手順だけを
ユーザーに提示する。SKILL.md 全体の参照は不要。

### A: app.json 編集後・commit 前に abort

```bash
git checkout packages/app/app.json
```

### B: commit 後・main push 前に abort（pre-push hook 失敗を含む）

```bash
git reset --hard HEAD~1
```

pre-push hook の失敗は「失敗した check（lint/typecheck/test）を直してから再実行」が正攻法。
hook を skip しない（system prompt の Git Safety Protocol に従う）。

### C: main push 後・tag push 前に問題発覚

remote main に commit が乗ってしまっているので revert:

```bash
git revert HEAD --no-edit
git push origin main
```

local tag は未作成なので tag 削除は不要。

### D: Step 8 監視中に release.yml workflow が fail

`gh run view <run-id> --log-failed` で失敗 step を特定し、原因を分類して提示する:

- **`Verify version match` step で fail** → tag の version と `app.json` の
  `expo.version` 不一致。手元の app.json を直し忘れ／別 commit に tag を打った等。
- **`build-ipa` 系（Expo prebuild / Pod install / Archive / Package IPA）で fail**
  → ネイティブビルドの問題。ログの該当 step を提示して原因を切り分ける。
- **`release` 系（Create GitHub Release / Update source.json）で fail**
  → IPA は出来ているが公開段で失敗。`gh` 権限や `update-source.mjs` を確認。

不要になった tag を巻き戻す場合（再リリースが必要なとき）:

```bash
git push --delete origin vX.Y.Z
git tag -d vX.Y.Z
```

このあと原因を修正して、可能なら**新しいバージョン番号で**切り直す
（同番号再利用は SideStore のキャッシュ挙動を踏まえると非推奨）。

GitHub Release が作成済みの場合は GitHub UI または `gh release delete vX.Y.Z`
で削除する必要がある。

## Constraints

- バージョンは `MAJOR.MINOR.PATCH` のみ（Apple `CFBundleShortVersionString` ルール、`-beta` 等 pre-release suffix 禁止）
- tag pattern は `vX.Y.Z`（`v` プレフィックス必須、`.github/workflows/release.yml` の trigger と一致）
- `app.json` の `expo.version` と tag のバージョン部分（`v` を剥がす）は完全一致必須（mismatch で CI fail-fast）
- `expo.ios.buildNumber` はリリース毎に **strictly increase**（前回値 +1）。同一値で再リリース禁止
  — SideStore / AltStore は `(version, buildVersion)` tuple で update 検出するため、
  同値だと iOS 上書きインストール時の version 比較や stale な `InstalledApp` レコードに
  対する update 判定で OPEN button stuck になる
- リリースは `main` ブランチでのみ実行
- pre-push hook は skip しない（`--no-verify` 禁止）
- 同じバージョン番号での再リリース禁止（SideStore キャッシュ問題）
