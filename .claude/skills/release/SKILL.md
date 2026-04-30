---
name: release
description: Cut a new release of the seam iOS app via PR-based flow — Phase 1 bumps expo.version + expo.ios.buildNumber in packages/app/app.json on a release/vX.Y.Z branch and opens a PR, Phase 2 (after merge) creates and pushes the vX.Y.Z tag from main. Use for any phrasing that means releasing, version bumping, or tagging a new version (English or Japanese: release / version bump / リリース / バージョンアップ / タグを切る).
user-invocable: true
disable-model-invocation: true
---

# Release skill

Seam iOS app のリリースフローを 2 段階で実行する。

- **Phase 1 (PR creation)** — 引数 `patch` / `minor` / `major` / `X.Y.Z` / なし で起動。`packages/app/app.json` の `expo.version` と `expo.ios.buildNumber` を bump した commit を `release/vX.Y.Z` ブランチに作り、PR を作成する。
- **Phase 2 (Tag push)** — 引数 `tag` で起動。PR が main にマージされたあと、main を pull してから `vX.Y.Z` lightweight tag を作成・push し、`.github/workflows/release.yml` をトリガーする。

main への直接 push は repository ruleset (required status checks) で塞がれているため、PR 経由が必須。

`buildNumber` を毎回 strictly increase させるのは SideStore / AltStore の update
検出 (`(version, buildVersion)` tuple 比較) を確実に効かせるための必須手順。
過去 v0.4.0 で `buildNumber=1` のまま放置していたために OPEN ボタンが stuck する
事象が発生した。

CI の動作（IPA build、GitHub Release 作成、`docs/source.json` 更新）は責務外。
tag push が成功したら完了とする。

## When to use

ユーザーが以下のような表現でリリースを要求したとき:

- "release", "cut a release", "ship a version", "bump the version", "tag a new version"
- 「リリース」「リリースして」「バージョンアップ」「version bump」「タグを切る」

### 引数

| 形式 | 例 | フェーズ | 挙動 |
|---|---|---|---|
| bump キーワード | `patch` / `minor` / `major` | Phase 1 | 現バージョンを読み取って自動算出 → PR 作成 |
| 明示バージョン | `0.4.0` | Phase 1 | semver 検証 → PR 作成 |
| `tag` | `tag` | Phase 2 | merge 済み main を pull → tag 作成 → push |
| なし | （引数なしで起動） | Phase 1 | AskUserQuestion で次バージョンを選択 → PR 作成 |

引数判別は厳密に:
- `tag` 完全一致 → Phase 2
- `patch` / `minor` / `major` 完全一致 → Phase 1 (bump)
- `^[0-9]+\.[0-9]+\.[0-9]+$` 一致 → Phase 1 (明示バージョン)
- 空 → Phase 1 (対話)
- それ以外 → エラー（「`patch` / `minor` / `major` / `X.Y.Z` / `tag` のいずれかを指定してください」）

---

## Phase 1: PR creation

### Prerequisites（事前チェック）

すべて自動で実行する。1 つでも失敗したら abort してユーザーに原因を伝える。

1. **Working directory clean**
   - `git status --porcelain` が空であること
   - 失敗時: 「未コミットの変更があります。先に commit/stash してください」
2. **現ブランチが main**
   - `git rev-parse --abbrev-ref HEAD` が `main`
   - 失敗時: 「リリースは main ブランチから開始してください（現在: <branch>）」
3. **Remote と同期**
   - `git fetch origin main` 後、`git rev-list HEAD..origin/main --count` が `0`、かつ `HEAD` が `origin/main` と一致
   - 失敗時: 「remote main から ahead/behind しています。`git pull --ff-only origin main` してから再実行してください」
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
8. **`release/vX.Y.Z` ブランチ衝突なし**
   - ローカル: `git rev-parse --verify --quiet refs/heads/release/vX.Y.Z` が失敗（= ブランチなし）
   - remote: `git ls-remote --heads origin release/vX.Y.Z` が空
   - 失敗時: 「ブランチ `release/vX.Y.Z` が既に存在します。古い PR を close してブランチを削除してから再実行してください」

### Procedure

#### Step 1: 現バージョン / buildNumber 読み取りと引数解析

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

#### Step 2: 引数なしの場合は対話

AskUserQuestion で 4 択を提示:

- `patch` (例: `0.3.0` → `0.3.1`)
- `minor` (例: `0.3.0` → `0.4.0`)
- `major` (例: `0.3.0` → `1.0.0`)
- 明示入力（"Other" で `X.Y.Z` を直接入力）

選択後、ユーザーに最終バージョンを再確認しない（Prerequisites のチェックで誤入力は捕まえる）。

#### Step 3: Prerequisites 1〜8 を実行

1 つでも失敗したら abort。

#### Step 4: リリースブランチ作成

```bash
git checkout -b release/vX.Y.Z
```

#### Step 5: app.json を編集

`Edit` ツールで以下 2 箇所を更新する。他のフィールドには触れない。

1. `"version": "A.B.C"` → `"version": "X.Y.Z"`（新バージョン）
2. `"buildNumber": "<old>"` → `"buildNumber": "<old + 1>"`（現在値 +1）

#### Step 6: Commit

```bash
git add packages/app/app.json
git commit -m "Version bump X.Y.Z (build N)"
```

`N` は新 `buildNumber`。`Version bump <version> (build <n>)` 形式で固定
（`chore:` プレフィックスなし）。

#### Step 7: ブランチを push

```bash
git push -u origin release/vX.Y.Z
```

`lefthook.yml` の pre-push hook（format-check / lint / typecheck / test）が走るため
完了まで待つ。失敗時: Recovery B を提示。

#### Step 8: PR 作成

```bash
gh pr create \
  --title "Version bump X.Y.Z (build N)" \
  --base main \
  --head release/vX.Y.Z \
  --body "..."
```

PR body には以下を含める:

- Summary: version / buildNumber を A.B.C / M → X.Y.Z / N に bump した旨
- Background: SideStore / AltStore update 検出のため `buildNumber` strictly increase が必要
- Post-merge step: 「merge 後 `/release tag` を実行して `vX.Y.Z` tag を push してください」

### Phase 1 Output

```
PR created for seam vX.Y.Z build N (was vA.B.C build M)
- branch: release/vX.Y.Z (commit: <short-hash> "Version bump X.Y.Z (build N)")
- PR:     <url>

Next: PR を merge した後、`/release tag` で Phase 2 を実行してください。
```

---

## Phase 2: Tag push

`/release tag` で起動。直前の Phase 1 PR が merge 済みであることが前提。

### Prerequisites

すべて自動で実行する。1 つでも失敗したら abort。

1. **Working directory clean**
   - `git status --porcelain` が空であること
2. **現ブランチが main**
   - 失敗時: 「Phase 2 は main ブランチで実行してください（現在: <branch>）。`git checkout main` してから再実行してください」
3. **main を最新に同期**
   - `git fetch origin main` 後、`git pull --ff-only origin main` を実行
   - fast-forward 不可なら abort: 「local main と remote main が divergeしています。手動で解決してください」
4. **`app.json` の `expo.version` から target version を取得**
   - `node -p "require('./packages/app/app.json').expo.version"` で X.Y.Z を取得
5. **直近の PR merge が version bump commit である**
   - main の HEAD or 直近 commit に `Version bump X.Y.Z (build N)` が含まれることを確認
   - `git log -1 --pretty=%s` または `git log -20 --pretty=%s` のいずれかにマッチ
   - 失敗時: 「`Version bump X.Y.Z` の commit が main の直近に見つかりません。Phase 1 の PR が merge されているか確認してください」
6. **Tag 未作成**
   - `git tag -l vX.Y.Z` が空、かつ `git ls-remote --tags origin vX.Y.Z` が空
   - 失敗時: 「tag vX.Y.Z は既に存在します（`/release tag` を二重実行している可能性）」

### Procedure

#### Step 1: main を最新化

```bash
git checkout main
git fetch origin main
git pull --ff-only origin main
```

#### Step 2: target version を読み取って Prerequisites を検証

#### Step 3: Tag 作成・push

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

lightweight tag（`-a` 不要、過去パターン踏襲）。失敗時: Recovery E を提示。

#### Step 4: ローカル release ブランチの後片付け（任意）

```bash
git branch -d release/vX.Y.Z 2>/dev/null || true
git fetch --prune origin
```

remote ブランチは GitHub の auto-delete 設定で merge 時に消えていることが多い。
残っていれば `git push origin --delete release/vX.Y.Z` で削除。

### Phase 2 Output

```
Released seam vX.Y.Z build N
- tag:    vX.Y.Z (lightweight) on <merge-commit-short-hash>
- pushed: origin/refs/tags/vX.Y.Z
```

CI URL や release URL は表示しない（責務外）。

---

## Recovery procedures

スキル実行中に失敗が出たら、その時点での state に該当する手順だけを
ユーザーに提示する。

### A: Phase 1 — app.json 編集後・commit 前に abort

```bash
git checkout packages/app/app.json
git checkout main
git branch -D release/vX.Y.Z
```

### B: Phase 1 — commit 後・branch push 前に abort（pre-push hook 失敗を含む）

```bash
git checkout main
git branch -D release/vX.Y.Z
```

pre-push hook の失敗は「失敗した check（lint/typecheck/test/format-check）を直してから
再実行」が正攻法。hook を skip しない（system prompt の Git Safety Protocol に従う）。

### C: Phase 1 — branch push 後 / PR 作成後に abort

PR 作成済みなら close、リリースブランチを remote / local 両方から削除:

```bash
gh pr close <pr-number> --delete-branch  # remote ブランチも一緒に消える
# 上が使えない場合は個別に:
# gh pr close <pr-number>
# git push origin --delete release/vX.Y.Z
git checkout main
git branch -D release/vX.Y.Z
```

### D: Phase 2 — PR merge 後・tag push 前に問題発覚

merge 済みの main の commit を revert する。main 直 push は塞がれているので、
revert PR を作る:

```bash
git checkout main
git pull --ff-only origin main
git checkout -b revert/release-vX.Y.Z
git revert HEAD --no-edit  # merge commit の場合は -m 1 を付ける
git push -u origin revert/release-vX.Y.Z
gh pr create --title "Revert version bump X.Y.Z" --base main --head revert/release-vX.Y.Z --body "..."
```

このパスは複雑なので、できるだけ Phase 1 で問題を見つけることが重要。

### E: Phase 2 — tag push 後・CI が version mismatch で fail（誤った場合のみ）

remote tag を消して再実行:

```bash
git push --delete origin vX.Y.Z
git tag -d vX.Y.Z
```

このあと原因を修正して、可能なら**新しいバージョン番号で**切り直す
（同番号再利用は SideStore のキャッシュ挙動を踏まえると非推奨）。

GitHub Release が作成済みの場合は GitHub UI から削除する必要がある。

---

## Constraints

- バージョンは `MAJOR.MINOR.PATCH` のみ（Apple `CFBundleShortVersionString` ルール、`-beta` 等 pre-release suffix 禁止）
- tag pattern は `vX.Y.Z`（`v` プレフィックス必須、`.github/workflows/release.yml` の trigger と一致）
- `app.json` の `expo.version` と tag のバージョン部分（`v` を剥がす）は完全一致必須（mismatch で CI fail-fast）
- `expo.ios.buildNumber` はリリース毎に **strictly increase**（前回値 +1）。同一値で再リリース禁止
  — SideStore / AltStore は `(version, buildVersion)` tuple で update 検出するため、
  同値だと iOS 上書きインストール時の version 比較や stale な `InstalledApp` レコードに
  対する update 判定で OPEN button stuck になる
- main への直接 push 禁止（repository ruleset により塞がれている。PR 経由必須）
- リリースブランチ名は `release/vX.Y.Z` で固定（`/release tag` の検知ロジックがこの規約に依存）
- Phase 2 は Phase 1 の PR が merge 済みであることが前提
- pre-push hook は skip しない（`--no-verify` 禁止）
- 同じバージョン番号での再リリース禁止（SideStore キャッシュ問題）
