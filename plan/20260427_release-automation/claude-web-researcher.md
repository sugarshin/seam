# Release Automation Deep Dive

> Seam (Expo SDK 54 / React Native 0.81 New Arch / iOS) を tag push → IPA ビルド →
> GitHub Releases upload → SideStore Source JSON 更新 → iPhone で "Update" ボタン
> までを自動化するための実践調査。
>
> 前提: Free Apple ID, LocalDevVPN + SideStore stable 0.6.2 + iloader,
> 個人 1 ユーザー長期運用, Apple Developer Program ($99) 未加入。

---

## TL;DR (結論先出し)

**ベストパス: 「CI で ad-hoc / unsigned IPA を作成 → GitHub Releases に upload →
GitHub Pages で SideStore Source JSON を配信 → SideStore がデバイス側で再署名」**

理由:
- SideStore は受け取った IPA をデバイス上で **必ず Free Apple ID 由来の Personal Team
  証明書で resign する**。CI 側の署名は破棄される。よって CI 側には Apple ID 関連の
  認証情報を一切持ち込まない構成が成立する。
- Free Apple ID の 7 日 cert / 10 App-ID/週の制約は、すべて **iPhone 側 SideStore が消費**
  する制約であり、CI には伝播しない。
- GitHub-hosted macOS runner は public repo で **無料無制限**。M1 ベースで
  `xcodebuild archive` が回る (macos-26 GA / Xcode 26 系)。
- Source JSON は GitHub Pages で公開すれば SideStore が認識可能。version 文字列は
  CFBundleShortVersionString と完全一致が必須。

`pnpm package-ipa` で生成しているローカル IPA と等価のものを CI で再現するだけ
であり、署名要件が消えるため "Apple ID secret を CI に持ち込む" タイプの構成は
**選んではならない**。

---

## A. GitHub Actions iOS Free Apple ID ビルド

### A-1. macOS runner と Xcode の現状 (2026-04 時点)

- **macos-26 が GA**。Apple Silicon (arm64) ネイティブ。Xcode 26 系がプリインストール。
  ([macos-26 GA changelog](https://github.blog/changelog/2026-02-26-macos-26-is-now-generally-available-for-github-hosted-runners/),
  [public preview 告知](https://github.blog/changelog/2025-09-11-actions-macos-26-image-now-in-public-preview/))
- 利用可能なラベル: `macos-26`, `macos-26-intel`, `macos-26-large`, `macos-26-xlarge`。
- **public repo は無料無制限**。private repo は無料分の月次クォータからの消費で macOS は
  Linux の **10x multiplier**。([Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing))
- Xcode 26.x は React Native 0.81 (Hermes) との組み合わせで `fmt` の consteval 周り、
  Firebase の Swift toolchain 不整合などの既知問題があるが、いずれも回避策あり。
  ([Xcode 26.4 RN 修正例](https://iamdevjay.medium.com/xcode-26-4-just-broke-your-react-native-build-yeah-mine-too-heres-the-fix-9348b1921b39),
  [SDK 26 + Firebase fix](https://medium.com/@ayushshukla3999/upgrading-react-native-to-ios-sdk-26-github-actions-firebase-fix-9704a173cd5f),
  [fmt consteval fix](https://bleepingswift.com/blog/fmt-consteval-error-xcode-26-4-react-native))

### A-2. Free Apple ID Cert を CI に持ち込む方法 (推奨しない)

技術的には可能だが、**運用上の負債が大きすぎて推奨できない**。

| 課題 | 詳細 |
| --- | --- |
| Cert 7 日期限 | Personal Team の Development Cert は固定で 7 日。CI 用 secret を週 1 で更新する手間 |
| Keychain export 形式 | macOS Keychain export の `.p12` は RC2 暗号化で、最近の OpenSSL 3.x runner で読めず legacy フラグ要 ([注釈](https://github.com/Apple-Actions/import-codesign-certs)) |
| Cert 自動更新の対話性 | Free Apple ID の Cert 自動再発行は実機 Run か Xcode GUI が必要。CI では無理 |
| App ID 10/週 | CI から `xcodebuild -allowProvisioningUpdates` を発行すると枠を消費する可能性 ([SideStore #68](https://github.com/SideStore/SideStore/issues/68)) |
| Apple ID 2FA | Apple ID 認証は基本 2FA 必須で CI に密結合させづらい |

**結論: Free Apple ID で CI が能動的に Apple サービスへ認証しに行く構成は破綻する。**

### A-3. 「CI で署名しない」が正解

これがベストパスの核心。SideStore のドキュメントと FAQ から:

> SideStore resigns apps with your personal development certificate, and then uses
> a specially designed VPN in order to trick iOS into installing them.
> ([SideStore FAQ](https://docs.sidestore.io/docs/faq), [SideStore README](https://github.com/SideStore/SideStore))

つまり SideStore に渡す IPA は **iPhone 上で codesign を全部塗り直される**。
CI 側で何で署名していようが (有効な dev cert / ad-hoc / 無署名) 関係ない。
[Sideloadly 系の記事](https://oivoodoo.medium.com/build-unsigned-ios-ipa-to-install-via-sideloadly-930e00ac9b26)
でも同じく "unsigned IPA を Sideloadly で渡せば device で resign される" 手順が
紹介されている (SideStore の resign フローはこれと同じファミリー)。

ただし注意点:
- IPA が **構造的に妥当** であること (`Payload/<App>.app/`, `Info.plist`, embedded
  framework に重複 entitlement が無い、bitcode 不要、etc.) が必要。
- 一部の entitlement (push notification, app groups, associated domains) は
  Free Apple ID Personal Team では使えない。Seam の現状は expo-notifications
  (local notifications のみ; APNs を使わない) なので問題なし。

### A-4. unsigned / ad-hoc archive の作り方 (推奨手順)

`expo prebuild` 済み or `ios/` を git に commit していれば、Xcode CLI で archive できる。
React Native 公式と Apple Forums の合意フローに沿うと:

```sh
# 1. archive (CODE_SIGNING_ALLOWED=NO で無署名 archive)
xcodebuild -workspace ios/Seam.xcworkspace \
  -scheme Seam \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -archivePath build/Seam.xcarchive \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  archive

# 2. Payload zip 化 (ExportArchive を使わずに自前で IPA 化)
mkdir -p build/Payload
cp -r build/Seam.xcarchive/Products/Applications/Seam.app build/Payload/
cd build && zip -qry Seam.ipa Payload && cd ..
```

このスタイルで unsigned IPA を作る手順は
[Korsak の記事](https://oivoodoo.medium.com/build-unsigned-ios-ipa-to-install-via-sideloadly-930e00ac9b26) /
[DEV Community 版](https://dev.to/oivoodoo/build-unsigned-ios-ipa-to-install-via-sideloadly-236f)
が事実上のリファレンス。

代替: `xcodebuild -exportArchive` + `signingStyle: manual` + 偽 cert を用意して
ad-hoc 風 IPA を出す方法もあるが、結局 SideStore で resign されるので unsigned が一番楽。

### A-5. fastlane match / EAS / 自宅 Mac runner の評価

| 案 | Free Apple ID で動くか | 月コスト | ビルド時間 | 運用負荷 |
| --- | --- | --- | --- | --- |
| **CI unsigned + SideStore resign** ★推奨 | ✅ | $0 (public repo 無料) | 10–20 min | 低 |
| fastlane match | ❌ (Apple Developer Program 必須) | $99/年 + $0 CI | 8–15 min | 中 |
| EAS Build (managed credentials) | ❌ production iOS には Developer Program 必須 ([Expo docs](https://docs.expo.dev/build/setup/), [EAS issue #997](https://github.com/expo/eas-cli/issues/997)) | $0 (free tier) – $19+/月 | 6–12 min | 低 |
| EAS Build (development build, simulator) | ✅ ただし simulator binary は SideStore に通せない | $0 | – | – |
| 自宅 Mac の self-hosted runner | ✅ | 電気代 | 10–20 min | 高 (常時起動 / セキュリティ / メンテ) |

参考: [Codemagic も Apple Developer Program 必須](https://codemagic.io/build-ios-without-mac/),
[Self-hosted macOS runner](https://josephduffy.co.uk/posts/self-hosting-macos-github-runners),
[EAS local build w/ GH Actions](https://dev.to/rgomezp/how-to-set-up-an-eas-local-build-on-github-actions-1l0i)

**EAS Build は Apple Developer Program 加入が事実上の前提**。Seam の要件には合わない。
self-hosted runner は技術的には魅力だが、個人運用で常時 Mac を CI 用途に張り付ける
コストは見合わない。

---

## B. SideStore Sources JSON 仕様

### B-1. 公式仕様の所在

- 公式型定義 (TypeScript / JSON Schema): [SideStore/sidestore-source-types](https://github.com/SideStore/sidestore-source-types)
- 公開ドキュメントサイト: [sidestore.io/sidestore-source-types](https://sidestore.io/sidestore-source-types/)
- npm パッケージ: [`sidestore-source-types`](https://www.npmjs.com/package/sidestore-source-types)
- JSON Schema URL (各 Source に `$schema` で参照可能): `https://github.com/SideStore/sidestore-source-types/raw/main/schema.json`
- 公式 docs (現行): [SideStore Docs - App Sources](https://docs.sidestore.io/docs/advanced/app-sources)
- AltStore 仕様 (互換のベース): [Make a Source - AltStore FAQ](https://faq.altstore.io/developers/make-a-source)
- 実例: [SideStore Community Source](https://github.com/SideStore/Community-Source/blob/main/sidecommunity.json),
  [apps.json sample](https://github.com/SideStore/apps.json/blob/main/_includes/source.json)

### B-2. AltStore Source との互換性

SideStore は AltStore Source を **概ね受け入れる** が、以下の点で挙動が異なる:

- **必須**: `versions` 配列を使う場合でも、SideStore は **トップレベル `downloadURL`
  を要求する** ([Issue #735](https://github.com/SideStore/SideStore/issues/735))。
  AltStore は `versions[0].downloadURL` から推論する。
- 両対応するなら **常に top-level `downloadURL` も書く** のが鉄則。

### B-3. 必須 / 任意フィールド一覧 (実用最小集合)

#### Source ルート

| フィールド | 必須 | 型 | 説明 |
| --- | --- | --- | --- |
| `name` | ✅ | string | Source の表示名 |
| `identifier` | ✅ | string | Source 一意 ID (変更すると既存登録が壊れる; 例: 逆ドメイン) |
| `apps` | ✅ | array | App エントリ |
| `news` | – | array | News フィード |
| `sourceURL` | – | string | この JSON の自己参照 URL (CDN/短縮 URL 用) |
| `iconURL` | – | string | Source アイコン |
| `tintColor` | – | string | UI tint (hex) |
| `subtitle` / `description` / `website` | – | string | 表示用メタ |

#### App エントリ (必須)

`name`, `bundleIdentifier`, `developerName`, `localizedDescription`, `iconURL`, `versions`

#### App エントリ (任意 / 重要なもの)

`subtitle`, `tintColor`, `screenshotURLs` (string[] か `{imageURL,width,height}[]`),
`category`, `appPermissions`, `beta`, `size` (top-level 互換用), `version` (top-level 互換用),
`versionDate`, `versionDescription`, `downloadURL` (★ SideStore 互換のため top-level に書く)

#### Version オブジェクト (必須)

`version`, `date`, `downloadURL`, `size`

(任意: `localizedDescription`, `minOSVersion`, `maxOSVersion`, `absoluteVersion`, `buildVersion`, `marketingVersion`)

#### News オブジェクト (必須)

`title`, `identifier`, `caption`, `date`

(任意: `notify` (true で SideStore がプッシュ表示を試みる), `imageURL`, `tintColor`, `appID`, `url`)

### B-4. 更新検知ロジック

SideStore Connect docs の記述から確定している事項:

> The version must match your application's CFBundleShortVersionString
> (located in Info.plist) in order for SideStore updates to work properly.
> ([SideStore Connect](https://connect.sidestore.io/docs/developer/apps-json))

> SideStore displays the first version (with compatible min/max iOS versions)
> in the list as the "latest" release regardless of version or date, so the
> order that versions appear must be in reverse chronological order.

要件まとめ:

1. **`version` の文字列は IPA の `Info.plist` の `CFBundleShortVersionString` と一致必須**
   (大文字小文字・前後空白も含めて完全一致)。
2. **`versions` 配列は新しい順 (reverse chronological) に並べる**。SideStore は配列の
   先頭を最新と判定する。SemVer ではなく **配列順序** が真実。
3. インストール済み version 文字列とソース先頭 version 文字列が **異なる** と "Update"
   が表示される (≧ 比較ではなく単純な不一致比較に近い実装で、
   [Issue #705](https://github.com/SideStore/SideStore/issues/705) に既知バグあり:
   "lower than current でも update notification が出ることがある"。
   これは順序を厳密に保てば回避できる)。
4. CFBundleShortVersionString は **3 つの整数のみ** (`MAJOR.MINOR.PATCH`) が iOS 公式
   ルール ([Apple Docs](https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleshortversionstring))。
   `1.0.0-beta.1` のような pre-release は NG。

### B-5. ホスティング要件

- **Source JSON は anonymous で HTTPS GET 可能でなければならない**。private GitHub
  repo の raw URL (token 必須) は SideStore からアクセスできない → **public 配信必須**。
- 推奨: GitHub Pages (custom domain で HTTPS, 無料)。
  ([securing GitHub Pages with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https))
- IPA 自体も同じく public な HTTPS URL が必要 → **GitHub Releases (public repo) が
  最も素直**。
- SideSource の caching は Cloudflare Workers ベースで、custom domain でないと
  Cache API が効かない仕様 ([SideSource doc](https://sidestore.io/SideSource/index.html))。
  個人用なら subresource caching は気にしなくてよい。

### B-6. SideStore のソース pull タイミング

公式に明文化されている記述は薄い (FAQ や Issues を総合すると):

- **SideStore アプリ起動時 / Sources タブ表示時 / pull-to-refresh** に取得。
- **バックグラウンド refresh ジョブ** は基本的に「インストール済みアプリの再署名」が
  目的で、Sources の自動 poll は主目的ではない (Issues で "background refresh"
  関連バグが多発; [#496](https://github.com/SideStore/SideStore/issues/496),
  [#705](https://github.com/SideStore/SideStore/issues/705))。
- News エントリで `notify: true` を立てるとアプリ起動時にプッシュ通知系の表示が
  出ることがある (実装依存; AltStore 由来の挙動)。
- **完全自動 push 通知** は LocalDevVPN + iOS BG refresh + SideStore 内部実装の
  「気まぐれ」に左右されるため、過信しない。

実用上の運用感:
- iPhone を開いて SideStore を起動 → 上から下にスワイプして refresh → 数秒で
  "Update Available" が出る。
- これがユーザーに必要な唯一のアクション。

---

## C. IPA & マニフェストホスティング戦略

### C-1. GitHub Releases の制約

- 1 ファイル **2 GB 上限**。Seam の RN/Expo IPA は 30–80 MB レンジが想定値で余裕。
- 1 release あたりのアセット数 / 容量上限はソフト制限なし (実用上気にしない)。
- **public repo の release asset は anonymous でダウンロード可能**:
  ```
  https://github.com/<owner>/<repo>/releases/download/<tag>/<asset>
  https://github.com/<owner>/<repo>/releases/latest/download/<asset>
  ```
  ([Linking to releases](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases))
- private repo の release asset は **PAT が必要** で SideStore は対応していない →
  **public repo か、外部ホスティング必須**。

### C-2. Source JSON 自体の配置

3 つの選択肢:

| 配置 | 自動更新 | URL 安定性 | 実装難度 |
| --- | --- | --- | --- |
| **A. 同 repo の `docs/` を GitHub Pages 公開** ★推奨 | git push で即時 | 高 | 低 |
| B. 同 repo の `gh-pages` ブランチ | branch push で即時 | 高 | 中 |
| C. release latest tag に同梱 | release 公開で即時 | `releases/latest/download/source.json` | 中 |

**A 案を推奨**。理由:
- ワークフローからは `peaceiris/actions-gh-pages` などで `docs/` を deploy するか、
  あるいは公式 [`actions/deploy-pages`](https://github.com/actions/deploy-pages) を使う。
- `https://<owner>.github.io/<repo>/source.json` で安定。
- Source JSON 履歴が main ブランチに git diff として残るので追跡しやすい。
- `docs/source.json` のみ更新する小さい commit を CI 自身が push する pattern。

### C-3. CDN / キャッシュの注意

- GitHub Pages は Fastly キャッシュを噛む。新規デプロイから世界配信に伝播するまで数十秒
  〜数分。SideStore の手動 refresh で問題なく見える。
- GitHub Releases の asset URL は CDN ベースで安定。
- 古いキャッシュを掴まれて困った場合は `?v=<tag>` クエリ等で busting できるが、SideStore
  に正規 URL を渡すために URL を変えない方針が良い。

### C-4. Cloudflare R2 など外部ホスティング

不要。public repo + GitHub Releases + GitHub Pages で完結する。

将来 private にするなら:
- IPA は R2 public bucket (`*.r2.dev`) 経由が候補 ([Cloudflare R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/))
- Pre-signed URL は **custom domain では発行不可** ([R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/))
  かつ **SideStore は更新されないリンクが必要** なので presigned URL は実質使えない
- → custom domain + WAF HMAC validation で同等の半私有を実現する道もあるが Pro plan ($25/月) 必要

個人運用かつ Seam が公開されて困る情報を含まない (UI/UX のみ; ユーザーデータは
ローカル SQLite) ことを考えると **public 維持で良い**。

---

## D. iPhone 側の自動化ループ

### D-1. 完全自動更新は **不可**

- iOS のアプリ更新はユーザー操作 (タップ) 1 回が必須。
- LocalDevVPN は「Personal Team cert を 1 週間ごとに resign する」仕事専門で、
  新規 IPA 取得とインストールは別レイヤ。
- SideStore に "auto-update" モードは存在しない (FAQ にもなし)。
- 正規 App Store ですら自動更新はバックグラウンドだが任意で OFF にできる程度。
- **AltStore Pro / SideStore 有料機能** で自動更新が解禁される機能は提供されていない
  (AltStore PAL は EU でのマーケットプレース機能であり、自動更新の話とは別)。

### D-2. 現実的なフロー

1. tag push (`git tag v1.0.1 && git push --tags`)
2. GitHub Actions が IPA を build → release upload → Source JSON 更新
3. (5–15 分後) iPhone で SideStore.app を開く
4. Sources タブで pull-to-refresh
5. 該当アプリの行に **"UPDATE"** ボタンが出る
6. タップ
7. ダウンロード → Personal Team cert で resign → LocalDevVPN 経由でインストール
8. 通常 30–60 秒で完了

この 4–6 のステップが「タップ 1〜2 回」で済む状態が、現状実現可能な最良の体験。

### D-3. 通知について

- News エントリに `"notify": true, "appID": "<bundleID>"` を仕込むとリリース時に
  通知らしき表示は出る (実装は AltStore 由来でやや不安定)。
- 確実に push 通知させたければ News を 1 件追加する CI ステップを足す価値あり。
- ただし主たる更新気付きルートは **SideStore を能動的に開いて refresh すること**。

### D-4. iOS Shortcuts による自動 refresh の活用

[TechyBuff の手順](https://techybuff.com/refresh-sidestore-sideloaded-automode/) にあるように、
iOS Shortcuts + 個人オートメーションで「毎朝 9:00 に Refresh All Apps を実行」が可能。
これは **resign refresh** であって新版 install とは別だが、結果的に「SideStore が
バックグラウンドで起動 → 同時に Sources を pull → Update available 表示」につながる
副次効果は期待できる。

---

## E. Expo / RN リリース自動化ベスプラ

### E-1. ビルド時間の目安 (macos-26 / Apple Silicon)

- React Native + Hermes archive: **10–25 分**。Pods cache が効くと 2–4 倍速。
  ([Hermes archive 時間問題](https://github.com/facebook/react-native/issues/31314),
  [Cache Pods 4x](https://retyui.medium.com/using-cache-pods-react-native-can-speed-up-ios-builds-by-4-times-ff0ed9e7afdb))
- monorepo (pnpm + Turborepo) の `pnpm install` は cache 復元で 30 秒以内。
- IPA 化 (Payload zip) は数秒。

### E-2. キャッシュ戦略 (実例)

```yaml
# pnpm store
- uses: actions/cache@v4
  with:
    path: |
      ~/.pnpm-store
      ~/Library/pnpm/store
    key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}

# Pods
- uses: actions/cache@v4
  with:
    path: |
      packages/app/ios/Pods
      ~/Library/Caches/CocoaPods
      ~/.cocoapods
    key: ${{ runner.os }}-pods-${{ hashFiles('packages/app/ios/Podfile.lock') }}

# DerivedData (任意; ビルド成果物の incremental 用)
- uses: actions/cache@v4
  with:
    path: ~/Library/Developer/Xcode/DerivedData
    key: ${{ runner.os }}-xcode-derived-${{ hashFiles('packages/app/ios/Podfile.lock', 'packages/app/ios/**/*.pbxproj') }}
```

### E-3. version bump と changelog

選択肢:

| ツール | 動作 | 採用判断 |
| --- | --- | --- |
| 手動 `git tag` | コミット → tag push のみ | ★推奨 (Seam は個人運用) |
| [`stovmascript/react-native-version`](https://github.com/stovmascript/react-native-version) | `npm version patch` で iOS / Android version を自動同期 | 任意採用 |
| [`semantic-release-expo`](https://github.com/byCedric/semantic-release-expo) | conventional commits ベース完全自動 | 個人運用ではオーバーキル |
| [`requarks/changelog-action`](https://github.com/requarks/changelog-action) | tag 間 changelog 生成のみ | ★推奨 (release notes 生成に使う) |

**推奨**: 手動で `app.json` の `expo.version` と `expo.ios.buildNumber` を bump し、
`git tag v1.0.1` を push。CI が release notes は自動生成、Source JSON も自動更新。

### E-4. ビルド失敗時の通知

- 個人運用なら GitHub の email 通知で十分
- 強化したいなら [`tsickert/discord-webhook`](https://github.com/tsickert/discord-webhook-action)
  または [`slackapi/slack-github-action`](https://github.com/slackapi/slack-github-action)

---

## F. セキュリティ

### F-1. CI に Apple ID 関連 secret を置かない (推奨構成)

ベストパスでは **CI に Apple ID / Cert / Provisioning profile を一切渡さない**ので、
secret 漏洩リスクが原理的に存在しない。これがこの構成最大のセキュリティ的利点。

### F-2. Free Apple ID の App ID 10/週枠の消費

- ベストパスでは CI から Apple Developer Portal に一切アクセスしないため、枠は消費しない。
- 枠を消費するのは iPhone 側 SideStore のみ。
  - 同一 bundleID は 1 枠で済む (bundleID 変更しなければ更新でも追加消費なし)
  - **SideStore で複数アプリをガンガン入れない**運用なら枠の心配は不要

### F-3. public repo + IPA 漏洩リスク

- 他人が IPA をダウンロードして自分の SideStore でインストールすることは技術的に可能。
- ただし Seam は「個人の所有衣類データを管理するアプリ」で、UI が公開されても損害は
  考えにくい。ユーザーデータはアプリ内 SQLite なので IPA に含まれない。
- 商標・ブランドリスクが気になる場合のみ private 化を検討。

### F-4. Source JSON の改ざん

- repo に push 権を持つのは本人のみ。GitHub Pages の deploy は Actions の `GITHUB_TOKEN`
  で行うので外部から書き換え不可。
- Source URL に Cloudflare などを噛ませると DNS 面のリスクが増えるため、生 GitHub
  Pages のサブドメインで運用する方が攻撃面は小さい。

---

## ベストパス推奨 (具体的 YAML + JSON)

### 推奨リポジトリ構成

```
sugarshin/seam/                          # public repo
├── packages/app/
├── packages/domain/
├── packages/shared/
├── docs/                                # GitHub Pages root
│   ├── index.html                       # (任意; プロジェクト紹介)
│   ├── source.json                      # ★ SideStore Source manifest
│   └── icon.png
├── .github/
│   ├── workflows/
│   │   ├── test.yml                     # 既存 CI
│   │   └── release.yml                  # ★ 新規: tag push で IPA + release + source.json
│   └── scripts/
│       └── update-source.mjs            # ★ release artifact から source.json を更新
├── plan/
└── README.md
```

GitHub Pages の設定: Settings → Pages → Source: "Deploy from a branch" → `main` / `/docs`。
公開 URL: `https://sugarshin.github.io/seam/source.json`

### `.github/workflows/release.yml`

```yaml
name: release

on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'   # CFBundleShortVersionString と整合する 3-segment のみ
  workflow_dispatch:
    inputs:
      tag:
        description: 'Release tag (e.g. v1.0.1)'
        required: true

permissions:
  contents: write   # release upload + main への source.json push

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

    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Resolve tag
        id: tag
        run: |
          TAG="${{ github.event.inputs.tag || github.ref_name }}"
          echo "tag=${TAG}" >> "$GITHUB_OUTPUT"
          echo "version=${TAG#v}" >> "$GITHUB_OUTPUT"

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Setup Ruby (CocoaPods)
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.3'
          bundler-cache: true
          working-directory: packages/app

      - name: Cache pnpm store
        uses: actions/cache@v4
        with:
          path: |
            ~/.pnpm-store
            ~/Library/pnpm/store
          key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}

      - name: Install JS deps
        run: pnpm install --frozen-lockfile

      - name: Verify version match
        # app.json の expo.version と tag の version 部分が一致していること
        run: |
          APP_VERSION=$(node -p "require('./packages/app/app.json').expo.version")
          TAG_VERSION="${{ steps.tag.outputs.version }}"
          if [ "$APP_VERSION" != "$TAG_VERSION" ]; then
            echo "::error::app.json version ($APP_VERSION) does not match tag ($TAG_VERSION)"
            exit 1
          fi

      - name: Expo prebuild (regenerate ios/)
        working-directory: packages/app
        run: pnpm exec expo prebuild --platform ios --clean --no-install

      - name: Cache Pods
        id: pods-cache
        uses: actions/cache@v4
        with:
          path: |
            packages/app/ios/Pods
            ~/Library/Caches/CocoaPods
            ~/.cocoapods
          key: ${{ runner.os }}-pods-${{ hashFiles('packages/app/ios/Podfile.lock') }}
          restore-keys: |
            ${{ runner.os }}-pods-

      - name: Pod install
        working-directory: packages/app/ios
        run: |
          # New Architecture / Hermes 対応
          RCT_NEW_ARCH_ENABLED=1 USE_HERMES=1 pod install --repo-update

      - name: Cache Xcode DerivedData
        uses: actions/cache@v4
        with:
          path: ~/Library/Developer/Xcode/DerivedData
          key: ${{ runner.os }}-xcode-derived-${{ hashFiles('packages/app/ios/Podfile.lock', 'packages/app/ios/**/*.pbxproj') }}
          restore-keys: |
            ${{ runner.os }}-xcode-derived-

      - name: Select Xcode
        run: sudo xcode-select -s /Applications/Xcode_26.app

      - name: Show toolchain
        run: |
          xcodebuild -version
          xcrun simctl list runtimes | head -n 30 || true

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
          cp -R build/Seam.xcarchive/Products/Applications/Seam.app build/Payload/
          (cd build && zip -qry "Seam-${{ steps.tag.outputs.tag }}.ipa" Payload)
          IPA_PATH="$(pwd)/build/Seam-${{ steps.tag.outputs.tag }}.ipa"
          echo "ipa_path=$IPA_PATH" >> "$GITHUB_OUTPUT"
          ls -lh "$IPA_PATH"

      - name: Compute metadata
        id: meta
        run: |
          IPA_PATH="${{ steps.package.outputs.ipa_path }}"
          SIZE=$(stat -f%z "$IPA_PATH")
          SHA=$(shasum -a 256 "$IPA_PATH" | awk '{print $1}')
          VERSION="${{ steps.tag.outputs.version }}"
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"
          echo "ipa_size=$SIZE" >> "$GITHUB_OUTPUT"
          echo "ipa_sha256=$SHA" >> "$GITHUB_OUTPUT"

      - name: Upload IPA artifact (handoff to next job)
        uses: actions/upload-artifact@v4
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
      - name: Checkout
        uses: actions/checkout@v5
        with:
          ref: main
          fetch-depth: 0

      - name: Resolve tag
        id: tag
        run: |
          TAG="${{ github.event.inputs.tag || github.ref_name }}"
          echo "tag=${TAG}" >> "$GITHUB_OUTPUT"
          echo "version=${TAG#v}" >> "$GITHUB_OUTPUT"

      - name: Download IPA
        uses: actions/download-artifact@v4
        with:
          name: ipa
          path: artifacts

      - name: Generate changelog
        id: changelog
        uses: requarks/changelog-action@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          tag: ${{ steps.tag.outputs.tag }}
          writeToFile: false

      - name: Create GitHub Release
        id: gh_release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ steps.tag.outputs.tag }}
          name: Seam ${{ steps.tag.outputs.tag }}
          body: ${{ steps.changelog.outputs.changes }}
          files: artifacts/Seam-${{ steps.tag.outputs.tag }}.ipa
          fail_on_unmatched_files: true
          generate_release_notes: false

      - name: Update docs/source.json
        env:
          VERSION: ${{ needs.build-ipa.outputs.version }}
          IPA_SIZE: ${{ needs.build-ipa.outputs.ipa_size }}
          IPA_SHA256: ${{ needs.build-ipa.outputs.ipa_sha256 }}
          TAG: ${{ steps.tag.outputs.tag }}
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
          git commit -m "chore(release): update source.json for ${{ steps.tag.outputs.tag }}"
          git push origin HEAD:main
```

### `.github/scripts/update-source.mjs`

```js
// Node 20+; ESM. Pure stdlib only.
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_PATH = path.resolve('docs/source.json');
const REPO = process.env.REPO; // e.g. "sugarshin/seam"
const TAG = process.env.TAG;
const VERSION = process.env.VERSION;
const IPA_SIZE = Number(process.env.IPA_SIZE);
const IPA_SHA256 = process.env.IPA_SHA256;
const CHANGES = process.env.CHANGES || '';

const downloadURL = `https://github.com/${REPO}/releases/download/${TAG}/Seam-${TAG}.ipa`;
const versionDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const sourceURL = `https://${REPO.split('/')[0]}.github.io/${REPO.split('/')[1]}/source.json`;

const source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
const app = source.apps?.[0];
if (!app) throw new Error('apps[0] not found in source.json template');

const newVersion = {
  version: VERSION,
  date: versionDate,
  localizedDescription: CHANGES.trim() || `Release ${TAG}`,
  downloadURL,
  size: IPA_SIZE,
  sha256: IPA_SHA256, // SideStore は無視するが運用ログとして残す
  minOSVersion: '17.0',
};

// reverse chronological 維持: 先頭に挿入し、同 version は除去
app.versions = [newVersion, ...(app.versions || []).filter(v => v.version !== VERSION)];

// SideStore 互換のため top-level も最新で同期
app.version = newVersion.version;
app.versionDate = newVersion.date;
app.versionDescription = newVersion.localizedDescription;
app.downloadURL = newVersion.downloadURL;
app.size = newVersion.size;

source.sourceURL = sourceURL;

fs.writeFileSync(SOURCE_PATH, JSON.stringify(source, null, 2) + '\n');
console.log('Updated docs/source.json');
console.log({ version: VERSION, size: IPA_SIZE, downloadURL });
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
      "bundleIdentifier": "io.github.sugarshin.seam",
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
      "size": 0,
      "versions": [
        {
          "version": "1.0.0",
          "date": "2026-04-26",
          "localizedDescription": "Initial release.",
          "downloadURL": "https://github.com/sugarshin/seam/releases/download/v1.0.0/Seam-v1.0.0.ipa",
          "size": 0,
          "minOSVersion": "17.0"
        }
      ]
    }
  ],
  "news": []
}
```

### iPhone 側の初期セットアップ (一度だけ)

1. SideStore.app を開く
2. Sources タブ → 右上 `+` → URL 入力: `https://sugarshin.github.io/seam/source.json`
3. Seam が一覧に出たら "FREE" を tap してインストール
4. 以降、tag push する度に "UPDATE" が出るので tap するだけ

---

## 各代替案 Pros/Cons 比較

| 案 | 月額 | CI で Apple ID 必要 | 実装難度 | iPhone 側 UX | 長期運用 |
| --- | --- | --- | --- | --- | --- |
| **CI unsigned + SideStore Source** ★ | $0 | ❌ | 中 | tap 1 で update | ◎ |
| EAS Build (development build) + SideStore Source | $0 | ❌ (Apple ID 任意) | 低 | tap 1 で update | △ ($99 必要シーン多発) |
| fastlane match + 自前 cert | $99/年 + α | ✅ | 高 | tap 1 で update | △ |
| Self-hosted Mac runner + 実機 cert refresh | 電気代 + 機材 | ❌ (ローカル) | 高 | tap 1 で update | △ メンテ負荷 |
| 手動 (現状維持: ローカル `pnpm package-ipa`) | $0 | ❌ | 0 | iloader / Files で都度 | × 手間 |

---

## 想定運用コスト

| 項目 | 値 |
| --- | --- |
| 初期実装時間 | 4–8 時間 (workflow + script + GitHub Pages 配信確認 + 端末側初期設定) |
| 1 回のリリース時間 (人手) | 5 分以下 (`app.json` bump → commit → tag push → iPhone で tap) |
| 1 回のビルド時間 (CI) | 12–25 分 (cache hit 時は 8–15 分) |
| 月額固定費 | $0 (public repo, GitHub Pages, GitHub Releases すべて無料) |
| Apple Developer Program | 不要 |

---

## 既知のリスクと回避策

| リスク | 影響 | 回避策 |
| --- | --- | --- |
| 7 日 cert 期限 | アプリが起動しなくなる | LocalDevVPN + SideStore 既存設定 (現運用ですでに対処済み) |
| 10 App-ID/週 | 新規 bundle ID をたくさん作ると枠が尽きる | bundle ID を変えない / 1 アプリしか入れない |
| `version` 文字列の不一致 | SideStore が更新を検知しない or 偽 update 通知が出る ([#705](https://github.com/SideStore/SideStore/issues/705)) | `app.json` ↔ tag ↔ source.json `version` を CI で integrity check (上記 YAML に組込済) |
| `versions` 配列順序ミス | 古い版が "latest" になる | `update-source.mjs` で先頭挿入を強制 (上記 script に実装済) |
| GitHub Pages の伝播遅延 | tag push 直後に refresh しても反映されない | 5–10 分待つ。CI で deploy → 確認 ping を入れる強化策あり |
| Xcode 26 の RN/Hermes 不整合 | archive が失敗 | [Firebase fix](https://medium.com/@ayushshukla3999/upgrading-react-native-to-ios-sdk-26-github-actions-firebase-fix-9704a173cd5f), [fmt fix](https://bleepingswift.com/blog/fmt-consteval-error-xcode-26-4-react-native) を podfile post_install で適用 |
| public repo で IPA が他人に拡散 | ブランド/プライバシーリスク低 (UI のみ) | 気になれば private repo + R2 public bucket へ移行 |
| SideStore がメジャーアップデートで Source 仕様変更 | Source JSON 互換が壊れる | `$schema` フィールド + types pkg を見て年 1 回点検 |
| SideStore background refresh 不安定 | 通知が来ないことがある | iOS Shortcuts で毎朝 SideStore を起動するオートメーションを設定 |

---

## 推奨実装順序 (チェックリスト)

1. [ ] `docs/source.json` を上のテンプレートで commit (現状の v1.0.0 を反映)
2. [ ] Settings → Pages で `main` ブランチ `/docs` を有効化
3. [ ] iPhone の SideStore に `https://sugarshin.github.io/seam/source.json` を Source 登録
4. [ ] `.github/workflows/release.yml` と `.github/scripts/update-source.mjs` を追加
5. [ ] `app.json` の `expo.version` と `expo.ios.buildNumber` を `1.0.1` に bump
6. [ ] PR レビュー + merge → `git tag v1.0.1 && git push --tags`
7. [ ] Actions ログを見守って release 完了を確認
8. [ ] iPhone の SideStore で Sources タブを pull-to-refresh → "UPDATE" 確認 → tap

これで「`git tag` → 数十分後に iPhone で tap 1 回」のループが完成する。

---

## 主な参考文献

### SideStore / AltStore
- [SideStore main repo](https://github.com/SideStore/SideStore)
- [SideStore Docs](https://docs.sidestore.io/)
- [SideStore FAQ](https://docs.sidestore.io/docs/faq)
- [SideStore App Sources docs](https://docs.sidestore.io/docs/advanced/app-sources)
- [sidestore-source-types repo (TS + JSON Schema)](https://github.com/SideStore/sidestore-source-types)
- [sidestore-source-types docs site](https://sidestore.io/sidestore-source-types/)
- [SideStore Connect: apps.json endpoint docs](https://connect.sidestore.io/docs/developer/apps-json)
- [SideStore Community-Source 実例](https://github.com/SideStore/Community-Source/blob/main/sidecommunity.json)
- [SideStore apps.json sample](https://github.com/SideStore/apps.json/blob/main/_includes/source.json)
- [Issue #735: AltStore source compat with SideStore](https://github.com/SideStore/SideStore/issues/735)
- [Issue #705: update notification for already-updated app](https://github.com/SideStore/SideStore/issues/705)
- [Issue #68: 10 App-ID limit / Universal App IDs](https://github.com/SideStore/SideStore/issues/68)
- [Issue #496: background refresh not working](https://github.com/SideStore/SideStore/issues/496)
- [AltStore Make a Source](https://faq.altstore.io/developers/make-a-source)
- [AltStore App IDs FAQ](https://faq.altstore.io/altstore-classic/app-ids)

### GitHub Actions / iOS CI
- [macos-26 GA changelog](https://github.blog/changelog/2026-02-26-macos-26-is-now-generally-available-for-github-hosted-runners/)
- [macos-26 public preview](https://github.blog/changelog/2025-09-11-actions-macos-26-image-now-in-public-preview/)
- [Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)
- [GH Docs: Installing Apple cert on macOS runners](https://docs.github.com/en/actions/use-cases-and-examples/deploying/installing-an-apple-certificate-on-macos-runners-for-xcode-development)
- [Apple-Actions/import-codesign-certs](https://github.com/Apple-Actions/import-codesign-certs)
- [softprops/action-gh-release](https://github.com/softprops/action-gh-release)
- [requarks/changelog-action](https://github.com/requarks/changelog-action)

### React Native / Expo
- [Expo SDK 54 changelog](https://expo.dev/changelog/sdk-54)
- [Expo iOS build process](https://docs.expo.dev/build-reference/ios-builds/)
- [Expo: New Architecture guide](https://docs.expo.dev/guides/new-architecture/)
- [EAS Build setup](https://docs.expo.dev/build/setup/)
- [Build unsigned iOS IPA for Sideloadly](https://oivoodoo.medium.com/build-unsigned-ios-ipa-to-install-via-sideloadly-930e00ac9b26)
- [Cache Pods 4x speedup](https://retyui.medium.com/using-cache-pods-react-native-can-speed-up-ios-builds-by-4-times-ff0ed9e7afdb)
- [Hermes archive 時間問題](https://github.com/facebook/react-native/issues/31314)
- [Xcode 26 / RN fix (fmt consteval)](https://bleepingswift.com/blog/fmt-consteval-error-xcode-26-4-react-native)
- [Xcode 26 + RN + Firebase + GH Actions 修正](https://medium.com/@ayushshukla3999/upgrading-react-native-to-ios-sdk-26-github-actions-firebase-fix-9704a173cd5f)
- [Xcode 26.4 RN 修正](https://iamdevjay.medium.com/xcode-26-4-just-broke-your-react-native-build-yeah-mine-too-heres-the-fix-9348b1921b39)

### Hosting
- [GitHub linking-to-releases doc](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases)
- [GitHub Pages with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [Cloudflare R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [SideSource (Cloudflare Worker for sources)](https://sidestore.io/SideSource/index.html)

### Apple Docs
- [CFBundleShortVersionString](https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleshortversionstring)
- [Apple Developer Program: What's Included](https://developer.apple.com/programs/whats-included/)
