# Execution Plan: Seam リリース自動化

最終更新: 2026-04-27
リサーチ成果物:
- [claude-web-researcher.md](./claude-web-researcher.md) — 実践調査・YAML/JSON サンプル
- [context7-doc-researcher.md](./context7-doc-researcher.md) — 公式ドキュメント観点での制約

---

## Summary

**「CI で unsigned IPA をビルド → GitHub Releases に upload → GitHub Pages で SideStore Source JSON 配信 → iPhone で `UPDATE` を tap」** という構成で、Apple Developer Program 不要・$0/月・CI に Apple ID シークレットを一切持たない自動化を実現する。

最大のキー所見: **SideStore はデバイスで必ず再署名するので CI 側の署名は意味を持たない**。`xcodebuild archive CODE_SIGNING_ALLOWED=NO` で署名抜きの IPA を作って渡すのが最もシンプル。これが Free Apple ID と CI の組み合わせの "唯一の合理解"。

完全自動更新は **iOS の制約上不可能**（タップ1回が必須）。それでも `git tag v1.0.1` → 15分後に iPhone で SideStore を開いて pull-to-refresh → `UPDATE` をタップ、という体験まで縮められる。

---

## Research Insights

### A. CI 側の署名要件

**結論: CI で署名する必要なし。SideStore がデバイスで全部塗り直す。**

公式 FAQ ([SideStore FAQ](https://docs.sidestore.io/docs/faq)):
> SideStore resigns apps with your personal development certificate, and then uses a specially designed VPN in order to trick iOS into installing them.

つまり Free Apple ID の以下の制約は **すべて iPhone 側 SideStore が消費** する話で、CI には関係ない:
- 7日 cert 期限
- 10 App-ID/週枠
- Apple ID 2FA 認証

CI に Apple ID secret を持ち込む必要が **原理的に無い** → 漏洩リスクゼロ・運用負荷最小。

ただし注意: 公式 doc 観点では「iOS 11+ SDK は完全 unsigned IPA を拒否する」という論点もある（[context7-doc-researcher.md](./context7-doc-researcher.md) 参照）。実態としては:
- `CODE_SIGNING_ALLOWED=NO` で archive 自体は通る
- 出力された `.app` は IPA として「半分署名」状態（_CodeSignature ディレクトリは無い）
- SideStore はこれを問題なく resign できる（Sideloadly 等と同じ方式）
- 不安なら `signingStyle: manual` + 自己署名 dummy cert で archive する代替策あり

### B. SideStore Source JSON の確定仕様

公式 TypeScript 型定義: [SideStore/sidestore-source-types](https://github.com/SideStore/sidestore-source-types)
公式 docs: [App Sources](https://docs.sidestore.io/docs/advanced/app-sources)

**重要なポイント**:

1. **`version` 文字列は IPA の `CFBundleShortVersionString` と完全一致必須**（[SideStore Connect](https://connect.sidestore.io/docs/developer/apps-json)）
2. **CFBundleShortVersionString は `MAJOR.MINOR.PATCH` の3整数のみ許容**（Apple ルール）→ `1.0.0-beta.1` のような pre-release は NG
3. **`versions` 配列は逆時系列順（新しい順）**。SideStore は **配列の先頭** を最新と判定（SemVer 比較ではない）
4. **トップレベル `downloadURL` も必須**（[Issue #735](https://github.com/SideStore/SideStore/issues/735)）。AltStore Source 互換のため `versions[0].downloadURL` だけでは SideStore が認識しないケースあり
5. **Source JSON は anonymous で HTTPS GET 可能**でなければならない → private repo の raw URL は不可、public な GitHub Pages 推奨

### C. CI 環境の現状（2026-04 時点）

- **macos-26 GA**（[changelog](https://github.blog/changelog/2026-02-26-macos-26-is-now-generally-available-for-github-hosted-runners/)）。Apple Silicon ネイティブ、Xcode 26 系がプリインストール
- **public repo は無料無制限**。private repo は macOS の課金 multiplier が **10x** で月クォータ消費が早い
- **Xcode 26.x には RN/Hermes との既知不整合**（fmt consteval、Firebase Swift toolchain）→ Podfile post_install で patch、もしくは Xcode 26.0 を `setup-xcode` で固定

### D. iPhone 側の自動化ループ

**完全自動 install は iOS の制約で不可**。AltStore Pro / SideStore 有料機能でも変わらない。

実用フロー:
1. `git tag v1.0.1 && git push --tags`
2. （CI 12〜25分）GitHub Actions が IPA build → release upload → source.json 更新
3. iPhone で SideStore.app を開く（or Background Refresh が走る）
4. Sources タブで pull-to-refresh
5. Seam 行に **UPDATE** ボタン → tap
6. 30〜60秒で更新完了

iOS Shortcuts で「毎朝 SideStore を起動」のオートメーションを組めば、4 のリフレッシュも省略可能。

### E. 想定運用コスト

| 項目 | 値 |
|---|---|
| 初期実装時間 | 4〜8時間 |
| 1リリースの人手作業 | 5分以下（version bump → tag push → iPhone でタップ） |
| 1ビルドの CI 時間 | 12〜25分（cache hit で 8〜15分） |
| 月額固定費 | **$0**（public repo + GitHub Pages + Releases すべて無料） |
| Apple Developer Program | 不要 |

---

## Recommended Approach

### 全体構成

```
sugarshin/seam/                          # public repo 維持
├── packages/{app,domain,shared}/
├── docs/                                # GitHub Pages root
│   ├── source.json                      # ★ SideStore Source manifest
│   ├── icon.png                         # アイコン（任意）
│   └── index.html                       # ランディングページ（任意）
├── .github/
│   ├── workflows/
│   │   ├── test.yml                     # 既存
│   │   └── release.yml                  # ★ 新規
│   └── scripts/
│       └── update-source.mjs            # ★ 新規
└── ...
```

GitHub Pages 設定: Settings > Pages > Source: `Deploy from a branch` > `main` / `/docs`
公開 URL: `https://sugarshin.github.io/seam/source.json`

### リポジトリ可視性の判断

**public 維持を推奨**。理由:
- macOS runner が無料無制限になる（private は 10x multiplier で月クォータが速攻枯渇）
- IPA や Source JSON の anonymous HTTPS 配信が必要（private だと token 必須で SideStore がアクセス不可）
- Seam は UI のみ公開で実害なし（ユーザデータはアプリ内 SQLite で IPA に含まれない）

将来 private にする必要が出た場合の代替:
- IPA ホスティング: Cloudflare R2 public bucket（custom domain 必須なら $25/月 Pro plan）
- CI: self-hosted runner（電気代＋Mac 常駐）

### バージョン採番ルール

- `app.json` の `expo.version` を bump（例: `1.0.0` → `1.0.1`）
- Git tag は `v` プレフィックス付き（`v1.0.1`）
- CI が tag の `v` を剥がして `version` 部分を `app.json` と整合チェック
- pre-release（`1.0.0-beta.1` 等）は使用不可（Apple ルール）

### 実装ステップ

#### Step 1: GitHub Pages 用 docs/ ディレクトリ作成

1. `docs/source.json` を作成（テンプレートは下記）
2. `docs/icon.png` を配置（`packages/app/assets/icon.png` を流用 or 専用に作成）
3. GitHub UI: Settings > Pages > Source: `Deploy from a branch` > Branch: `main` / `docs/`
4. `https://sugarshin.github.io/seam/source.json` で 200 が返ることを確認

#### Step 2: GitHub Actions workflow を追加

`.github/workflows/release.yml` を新規作成（YAML サンプル下記）。

主要構成:
- Trigger: `push.tags` matching `v*.*.*`、`workflow_dispatch` で手動実行も可
- Job 1（macos-26）: prebuild → archive → IPA package → artifact upload
- Job 2（ubuntu-latest）: artifact download → GitHub Release 作成 → source.json 更新 → main に push

`.github/scripts/update-source.mjs` を新規作成（Node スクリプトサンプル下記）。

#### Step 3: 既存ローカルスクリプトとの整合

現状 `packages/app/scripts/` にある:
- `prebuild.mjs` — ローカル prebuild ラッパー（aps-environment strip 自動）
- `stripPushEntitlement.mjs` — entitlement strip
- `packageIpa.mjs` — Archive → IPA

CI でも entitlement strip は必要なので、CI workflow で `expo prebuild` 後に `node scripts/stripPushEntitlement.mjs` を呼ぶ。`packageIpa.mjs` は Xcode Archive を前提とした GUI 用なので CI では使わず、xcodebuild で archive → 自前で zip 化する。

#### Step 4: 初期 v1.0.0 を Source に登録

現在 SideStore に手動投入で v1.0.0 が動いているので、それを Source 経由のフローに切り替える:

1. `docs/source.json` の v1.0.0 エントリを **手動で正しい downloadURL** にする（`https://github.com/sugarshin/seam/releases/download/v1.0.0/Seam-v1.0.0.ipa`）
2. 初回だけ手動で v1.0.0 タグを切って Release を作成し、現在の `~/Downloads/Seam.ipa` を upload
3. iPhone の SideStore で `https://sugarshin.github.io/seam/source.json` を Source 追加
4. Source 経由で v1.0.0 を再インストール（既存と同 Bundle ID なのでデータ保持で上書き）

これ以降、`v1.0.1` 以降は自動で流れる。

#### Step 5: 検証リリース

1. `app.json` の version を `1.0.1` に bump
2. commit & push
3. `git tag v1.0.1 && git push --tags`
4. Actions タブで build を観察
5. iPhone で SideStore → Sources → pull-to-refresh → UPDATE 表示確認 → tap

---

## 主要成果物（テンプレート）

### `.github/workflows/release.yml`

```yaml
name: release

on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'
  workflow_dispatch:
    inputs:
      tag:
        description: 'Release tag (e.g. v1.0.1)'
        required: true

permissions:
  contents: write

concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false

jobs:
  build-ipa:
    name: Build unsigned IPA
    runs-on: macos-26
    timeout-minutes: 60
    outputs:
      version: ${{ steps.meta.outputs.version }}
      ipa_size: ${{ steps.meta.outputs.ipa_size }}
      ipa_sha256: ${{ steps.meta.outputs.ipa_sha256 }}
      tag: ${{ steps.tag.outputs.tag }}

    steps:
      - uses: actions/checkout@v5

      - name: Resolve tag
        id: tag
        run: |
          TAG="${{ github.event.inputs.tag || github.ref_name }}"
          echo "tag=${TAG}" >> "$GITHUB_OUTPUT"
          echo "version=${TAG#v}" >> "$GITHUB_OUTPUT"

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.3'
          bundler-cache: true
          working-directory: packages/app

      - name: Cache pnpm store
        uses: actions/cache@v4
        with:
          path: ~/.pnpm-store
          key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}

      - name: Install JS deps
        run: pnpm install --frozen-lockfile

      - name: Verify version match
        run: |
          APP_VERSION=$(node -p "require('./packages/app/app.json').expo.version")
          TAG_VERSION="${{ steps.tag.outputs.version }}"
          if [ "$APP_VERSION" != "$TAG_VERSION" ]; then
            echo "::error::app.json version ($APP_VERSION) != tag ($TAG_VERSION)"
            exit 1
          fi

      - name: Expo prebuild
        working-directory: packages/app
        run: pnpm exec expo prebuild --platform ios --clean --no-install

      - name: Strip push entitlement
        working-directory: packages/app
        run: node scripts/stripPushEntitlement.mjs

      - name: Cache Pods
        uses: actions/cache@v4
        with:
          path: |
            packages/app/ios/Pods
            ~/Library/Caches/CocoaPods
            ~/.cocoapods
          key: ${{ runner.os }}-pods-${{ hashFiles('packages/app/ios/Podfile.lock') }}
          restore-keys: ${{ runner.os }}-pods-

      - name: Pod install
        working-directory: packages/app/ios
        run: |
          RCT_NEW_ARCH_ENABLED=1 USE_HERMES=1 pod install --repo-update

      - name: Cache Xcode DerivedData
        uses: actions/cache@v4
        with:
          path: ~/Library/Developer/Xcode/DerivedData
          key: ${{ runner.os }}-xcode-${{ hashFiles('packages/app/ios/Podfile.lock', 'packages/app/ios/**/*.pbxproj') }}
          restore-keys: ${{ runner.os }}-xcode-

      - name: Archive (unsigned)
        working-directory: packages/app/ios
        run: |
          set -euo pipefail
          mkdir -p build
          xcodebuild \
            -workspace Seam.xcworkspace \
            -scheme Seam \
            -configuration Release \
            -sdk iphoneos \
            -destination 'generic/platform=iOS' \
            -archivePath build/Seam.xcarchive \
            CODE_SIGNING_ALLOWED=NO \
            CODE_SIGNING_REQUIRED=NO \
            CODE_SIGN_IDENTITY="" \
            ENABLE_BITCODE=NO \
            archive

      - name: Package IPA
        id: package
        working-directory: packages/app/ios
        run: |
          set -euo pipefail
          rm -rf build/Payload
          mkdir -p build/Payload
          ditto --noextattr --noqtn build/Seam.xcarchive/Products/Applications/Seam.app build/Payload/Seam.app
          (cd build && ditto -c -k --keepParent --norsrc Payload "Seam-${{ steps.tag.outputs.tag }}.ipa")
          echo "ipa_path=$(pwd)/build/Seam-${{ steps.tag.outputs.tag }}.ipa" >> "$GITHUB_OUTPUT"

      - name: Compute metadata
        id: meta
        run: |
          IPA="${{ steps.package.outputs.ipa_path }}"
          echo "version=${{ steps.tag.outputs.version }}" >> "$GITHUB_OUTPUT"
          echo "ipa_size=$(stat -f%z "$IPA")" >> "$GITHUB_OUTPUT"
          echo "ipa_sha256=$(shasum -a 256 "$IPA" | awk '{print $1}')" >> "$GITHUB_OUTPUT"

      - uses: actions/upload-artifact@v4
        with:
          name: ipa
          path: ${{ steps.package.outputs.ipa_path }}
          retention-days: 7
          if-no-files-found: error

  release:
    name: Create release & update source.json
    needs: build-ipa
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          ref: main
          fetch-depth: 0

      - uses: actions/download-artifact@v4
        with:
          name: ipa
          path: artifacts

      - name: Generate changelog
        id: changelog
        uses: requarks/changelog-action@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          tag: ${{ needs.build-ipa.outputs.tag }}
          writeToFile: false

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ needs.build-ipa.outputs.tag }}
          name: Seam ${{ needs.build-ipa.outputs.tag }}
          body: ${{ steps.changelog.outputs.changes }}
          files: artifacts/Seam-${{ needs.build-ipa.outputs.tag }}.ipa
          fail_on_unmatched_files: true

      - name: Update docs/source.json
        env:
          VERSION: ${{ needs.build-ipa.outputs.version }}
          IPA_SIZE: ${{ needs.build-ipa.outputs.ipa_size }}
          IPA_SHA256: ${{ needs.build-ipa.outputs.ipa_sha256 }}
          TAG: ${{ needs.build-ipa.outputs.tag }}
          CHANGES: ${{ steps.changelog.outputs.changes }}
          REPO: ${{ github.repository }}
        run: node .github/scripts/update-source.mjs

      - name: Commit & push source.json
        run: |
          set -euo pipefail
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add docs/source.json
          if git diff --staged --quiet; then
            echo "No source.json changes"
            exit 0
          fi
          git commit -m "chore(release): update source.json for ${{ needs.build-ipa.outputs.tag }}"
          git push origin HEAD:main
```

### `.github/scripts/update-source.mjs`

```js
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_PATH = path.resolve('docs/source.json');
const REPO = process.env.REPO;
const TAG = process.env.TAG;
const VERSION = process.env.VERSION;
const IPA_SIZE = Number(process.env.IPA_SIZE);
const CHANGES = process.env.CHANGES || '';

const downloadURL = `https://github.com/${REPO}/releases/download/${TAG}/Seam-${TAG}.ipa`;
const versionDate = new Date().toISOString().slice(0, 10);
const [owner, name] = REPO.split('/');
const sourceURL = `https://${owner}.github.io/${name}/source.json`;

const source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
const app = source.apps?.[0];
if (!app) throw new Error('apps[0] not found');

const newVersion = {
  version: VERSION,
  date: versionDate,
  localizedDescription: CHANGES.trim() || `Release ${TAG}`,
  downloadURL,
  size: IPA_SIZE,
  minOSVersion: '15.1',
};

app.versions = [
  newVersion,
  ...(app.versions || []).filter((v) => v.version !== VERSION),
];

// SideStore は top-level も見るため同期
app.version = newVersion.version;
app.versionDate = newVersion.date;
app.versionDescription = newVersion.localizedDescription;
app.downloadURL = newVersion.downloadURL;
app.size = newVersion.size;

source.sourceURL = sourceURL;

fs.writeFileSync(SOURCE_PATH, JSON.stringify(source, null, 2) + '\n');
console.log(`Updated source.json: ${VERSION} -> ${downloadURL}`);
```

### `docs/source.json` (初期テンプレート)

```json
{
  "$schema": "https://github.com/SideStore/sidestore-source-types/raw/main/schema.json",
  "name": "Seam",
  "identifier": "io.github.sugarshin.seam.source",
  "sourceURL": "https://sugarshin.github.io/seam/source.json",
  "iconURL": "https://sugarshin.github.io/seam/icon.png",
  "subtitle": "Vintage clothing decision helper",
  "description": "Personal iOS app for deciding whether to buy vintage clothing.",
  "website": "https://github.com/sugarshin/seam",
  "tintColor": "#1F2937",
  "apps": [
    {
      "name": "Seam",
      "bundleIdentifier": "com.sugarshin.seam",
      "developerName": "sugarshin",
      "subtitle": "Vintage clothing buy/skip decisions.",
      "localizedDescription": "Compare candidate vintage items against owned items by measurement, price, condition, and duplication risk. Local-first; no auth.",
      "iconURL": "https://sugarshin.github.io/seam/icon.png",
      "tintColor": "#1F2937",
      "category": "lifestyle",
      "screenshotURLs": [],
      "version": "1.0.0",
      "versionDate": "2026-04-26",
      "versionDescription": "Initial release.",
      "downloadURL": "https://github.com/sugarshin/seam/releases/download/v1.0.0/Seam-v1.0.0.ipa",
      "size": 9142842,
      "versions": [
        {
          "version": "1.0.0",
          "date": "2026-04-26",
          "localizedDescription": "Initial release.",
          "downloadURL": "https://github.com/sugarshin/seam/releases/download/v1.0.0/Seam-v1.0.0.ipa",
          "size": 9142842,
          "minOSVersion": "15.1"
        }
      ]
    }
  ],
  "news": []
}
```

---

## Risks & Mitigations

| リスク | 確度 | 影響 | 対策 |
|---|---|---|---|
| `version` 文字列の不一致で UPDATE が出ない | 中 | 更新が iPhone に届かない | CI の Verify version match で防御（YAML に組込済） |
| `versions` 配列順序ミス | 低 | 古い版が "latest" になる | update-source.mjs が先頭挿入を強制 |
| Xcode 26 の RN/Hermes 不整合で archive 失敗 | 中 | CI 失敗 | Podfile post_install で patch（fmt fix 等）、最悪 Xcode 26.0 を `setup-xcode` で固定 |
| GitHub Pages の伝播遅延 | 低 | tag push 直後に refresh しても反映なし | 5〜10 分待つ。CI で deploy 後に curl で確認 ping を入れる強化も可 |
| 公衆 anisette ダウンで SideStore install が失敗 | 中 | UPDATE をタップしても進まない | 既存 LocalDevVPN 構成で運用、必要なら自前 anisette サーバ |
| public repo で IPA が他人に拡散 | 低 | UI のみ漏れ、データ漏洩なし | UI のみ公開で実害なし、気になれば後で private + R2 へ移行 |
| SideStore の Source 仕様メジャー更新 | 低 | Source JSON 互換崩壊 | `$schema` 参照で自動 validation、年1回点検 |
| Background refresh が走らず通知が来ない | 中 | UPDATE に気づかない | iOS Shortcuts で毎朝 SideStore を起動するオートメーション |
| 完全 unsigned IPA を SideStore が拒否する可能性 | 低 | CI ビルドが iPhone で installable じゃない | 万が一の場合 self-signed dummy cert で archive する fallback あり |

---

## Open Questions

1. **`docs/icon.png` を別途用意するか、`packages/app/assets/icon.png` を流用するか**
   - 案: 流用（CI で `cp` してデプロイ）または symlink で管理
2. **Bundle ID は `com.sugarshin.seam` のまま継続か**
   - 現状そのまま。途中で変えると SideStore で別アプリ扱い・データ消失するので維持推奨
3. **iOS Shortcuts による自動 refresh を組むか**
   - 任意。組まなくてもタップで気付ける運用なら不要
4. **GitHub Pages のカスタムドメインを設定するか**
   - 不要。`sugarshin.github.io/seam/` で十分
5. **Xcode 26 RN/Hermes の既知不整合に対する Podfile patch を予防的に入れるか**
   - 現状の Seam では発火していないが、CI で初回ビルドした時に判明する
6. **既存 v1.0.0 を Source 経由に切り替える時の運用**
   - SideStore で既に v1.0.0 が手動 install 済 → Source 追加 → 同 Bundle ID なので自動で「既にインストール済」になる想定。UPDATE 表示は v1.0.1 から
7. **changelog をどう書くか**
   - `requarks/changelog-action` が conventional commits 風の commit message を集めて生成。コミット規約を整えるならここで
8. **`build` ディレクトリと既存 `packages/app/ios/build` の衝突回避**
   - CI のみ `ios/build/` に出力、ローカル `pnpm package-ipa` は引き続き Xcode Archive を使う棲み分け

---

## Next Steps（実装順序）

### P0: GitHub Pages を有効化（5分）
1. `docs/source.json` を上記テンプレートで作成
2. `docs/icon.png` を配置（or 流用 script）
3. GitHub Settings > Pages で `main` / `/docs` を有効化
4. 数分後 `https://sugarshin.github.io/seam/source.json` の到達性を確認

### P1: 初回 v1.0.0 を release upload（10分）
1. `git tag v1.0.0` を打って push
2. GitHub UI から手動で Release `v1.0.0` を作成
3. 既存の `~/Downloads/Seam.ipa` を `Seam-v1.0.0.ipa` にリネームして upload
4. `docs/source.json` の downloadURL が一致することを確認
5. iPhone の SideStore で Sources タブ → `+` → `https://sugarshin.github.io/seam/source.json`
6. Source 経由で v1.0.0 を再認識（既にインストール済なので操作不要）

### P2: GitHub Actions workflow 追加（30分〜1時間）
1. `.github/workflows/release.yml` を上記 YAML で作成
2. `.github/scripts/update-source.mjs` を上記スクリプトで作成
3. PR 作成 → merge

### P3: 検証リリース v1.0.1（15分）
1. `packages/app/app.json` の `expo.version` を `1.0.1` に bump
2. `git commit -am "chore: bump to 1.0.1"`
3. `git tag v1.0.1 && git push --tags`
4. GitHub Actions タブで build 観察（12〜25分）
5. iPhone の SideStore で UPDATE 表示確認 → tap

### P4: 運用改善（任意）
- iOS Shortcuts で「毎朝 SideStore を起動」オートメーション
- Discord/Slack webhook での build 通知
- changelog 生成の commit 規約整備

---

## ベストパス決定の理由

| 検討案 | 採用 | 理由 |
|---|:-:|---|
| **CI unsigned + SideStore Source** | ★ | $0、Apple ID 不要、iPhone で tap1で更新 |
| EAS Build (development build) | ✕ | EAS internal distribution は paid のみ（公式明記）、Free Apple ID 用途には合わない |
| fastlane match + 自前 cert | ✕ | Free Apple ID では構造的に動かない（Certificates ポータルが無い） |
| Self-hosted Mac runner | ✕ | 24/7 Mac 起動と保守コスト、個人運用では割に合わない |
| 手動（現状: pnpm package-ipa） | ✕ | 毎回 Xcode Archive 必要、AirDrop 必要、リリースのたびに 5〜15 分作業 |

---

## まとめ

- **public repo + macos-26 + unsigned archive + SideStore Source** が現時点の唯一の合理解
- 月額 $0、Apple Developer Program 不要、CI に Apple ID secret 持ち込みなし
- iPhone 側は「Sources に登録1回」+「リリースごとに UPDATE タップ1回」
- 完全自動 install は iOS の制約上不可能、これが現実的な最良 UX
- 全体実装時間 4〜8時間、1リリース 5分以下の人手作業

進めるなら P0 から順に着手していけます。実装に移してよろしいですか？
