# 公式ドキュメント調査

**調査日**: 2026-04-27
**対象**: Seam (Expo SDK 54 + React Native 0.81.5, Free Apple ID 署名) の GitHub Actions による iOS リリース自動化
**手法**: 各公式ドキュメント（GitHub Docs / Apple Developer / Expo Docs / AltStore FAQ / SideStore Wiki / fastlane Docs / Xcode man page）からの直接抜粋。引用元 URL を必ず付記。

> 注: 本調査は公開Webドキュメント（GitHub Docs, Apple Developer, Expo Docs 等）を直接 WebFetch / WebSearch で参照して得た情報をまとめている。「公式ドキュメントに記載なし」という事実も明記している。

---

## 1. GitHub Actions

### 1.1 macos-latest Runner Image (macOS 15, 2026-04時点)

引用元: [actions/runner-images macos-15 README](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-Readme.md)

| 項目 | 値 |
|---|---|
| OS | macOS 15.7.5 (Sequoia) |
| デフォルト Xcode | **16.4 (build 16F6)** |
| 利用可能 Xcode | 16.0〜16.4, 26.0〜26.3 |
| Node.js | 22.22.2 (current)、20.20.2 / 24.15.0 もキャッシュ |
| Ruby | 3.3.11 (current) |
| CocoaPods | **1.16.2** |
| Fastlane | 2.233.0 |
| Xcodes | 1.6.2 |
| iOS SDK | 18.0〜18.5 + 26.0〜26.2 |

**Apple Silicon 注記**: ドキュメントは "compatibility across modern macOS Apple Silicon systems running version 15.7.5" としており、`macos-latest` = `macos-15` = M-series ホストである。

**注意点**:
- Xcode 26.2+ で `xcodebuild` が BUILD SUCCEEDED 後にハングする既知バグあり（[react-native-community/cli#2768](https://github.com/react-native-community/cli/issues/2768)）。CI 用 Xcode は当面 `16.4` 系をピン留めするのが安全。
- `setup-xcode` で明示的に Xcode バージョンをピン留め可能（後述）。

### 1.2 Xcode のバージョン選択 (`maxim-lobanov/setup-xcode`)

引用元: [maxim-lobanov/setup-xcode README](https://github.com/maxim-lobanov/setup-xcode)

```yaml
- uses: maxim-lobanov/setup-xcode@v1
  with:
    xcode-version: 'latest-stable'   # or '16.4' / '^16.2.0'
```

- `latest-stable`: 最新安定版
- `latest`: ベータ含む最新
- SemVer 文字列: `'16'`, `'16.4'`, `'26.3'`（YAML で数値扱いされないようクォート必須）

### 1.3 actions/cache のキャッシュ戦略

引用元: [actions/cache README](https://github.com/actions/cache)（v5.0.5 時点、Node 24 ランタイム）

公式が示す主な仕様:
- `path` は files / directories / wildcard が指定可（`@actions/glob` 構文）
- `key` は `hashFiles()` で動的生成可
- `restore-keys` で部分一致フォールバック
- リポジトリの **キャッシュ総容量上限 10GB**, 7日未使用で自動退避
- `cache-hit` 出力でスキップ判定 (`'true'` / `'false'` / `''`)
- Action Runner v2.327.1+ が必要

公式 README が **iOS 関連で具体的にパス例として挙げているもの**:
- Node.js: `node_modules`
- Ruby: bundler ディレクトリ
- iOS: **`Pods` ディレクトリ（CocoaPods）**, **Xcode `DerivedData`**
- pnpm: pnpm cache directory

> **重要な事実**: GitHub Docs に「iOS 用の正式キャッシュ例」は存在しない。Apple/CocoaPods 公式も iOS CI 用キャッシュ手法のレファレンスは出していない。コミュニティ慣習が `~/Library/Caches/CocoaPods` + `Pods` + `hashFiles('**/Podfile.lock')` を使うが、**これは非公式**。

### 1.4 Apple 証明書のキーチェーン import (公式手順)

引用元: [Installing an Apple certificate on macOS runners for Xcode development - GitHub Docs](https://docs.github.com/en/actions/use-cases-and-examples/deploying/installing-an-apple-certificate-on-macos-runners-for-xcode-development)

**この手順が現時点で GitHub 公式が示す唯一の Apple 署名 CI セットアップである。** YAML 抜粋（公式まま）:

```yaml
- name: Install the Apple certificate and provisioning profile
  env:
    BUILD_CERTIFICATE_BASE64: ${{ secrets.BUILD_CERTIFICATE_BASE64 }}
    P12_PASSWORD: ${{ secrets.P12_PASSWORD }}
    BUILD_PROVISION_PROFILE_BASE64: ${{ secrets.BUILD_PROVISION_PROFILE_BASE64 }}
    KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
  run: |
    CERTIFICATE_PATH=$RUNNER_TEMP/build_certificate.p12
    PP_PATH=$RUNNER_TEMP/build_pp.mobileprovision
    KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db

    echo -n "$BUILD_CERTIFICATE_BASE64" | base64 --decode -o $CERTIFICATE_PATH
    echo -n "$BUILD_PROVISION_PROFILE_BASE64" | base64 --decode -o $PP_PATH

    security create-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
    security set-keychain-settings -lut 21600 $KEYCHAIN_PATH
    security unlock-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH

    security import $CERTIFICATE_PATH -P "$P12_PASSWORD" -A -t cert -f pkcs12 -k $KEYCHAIN_PATH
    security set-key-partition-list -S apple-tool:,apple: -k "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
    security list-keychain -d user -s $KEYCHAIN_PATH

    mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
    cp $PP_PATH ~/Library/MobileDevice/Provisioning\ Profiles
```

公式のポイント:
- iOS は `.mobileprovision`、macOS は `.provisionprofile`
- GitHub-hosted runner は自動 cleanup されるが、self-hosted は手動 cleanup 必須
- `KEYCHAIN_PASSWORD` は任意のランダム文字列で良い

> Free Apple ID で発行できるのは「**Apple Development**」証明書のみであり、Distribution / Ad Hoc は発行できない（後述「3. Apple 認証」「5.4」参照）。**証明書の base64 をリポジトリ Secrets に置く前提自体は Free Apple ID でも動くが、Provisioning Profile が 7 日で expire するので運用上は別の課題が発生する**。

### 1.5 Workflow Trigger の使い分け

引用元: [Events that trigger workflows - GitHub Docs](https://docs.github.com/en/actions/reference/events-that-trigger-workflows)

| トリガー | 起動方法 | 主な用途 |
|---|---|---|
| `push` (with `tags:`) | Git tag push | リリース自動化 |
| `workflow_dispatch` | UI / CLI / REST API | 手動実行（手動リリース、再実行） |
| `workflow_call` | 他 workflow から call | 再利用可能 workflow |
| `repository_dispatch` | REST API 外部イベント | 外部システム連携 |

**Tag push（リリース自動化の本命）**:
```yaml
on:
  push:
    tags:
      - v1.**          # v1.0.0, v1.2.3 など
```
公式注記: 「Events won't trigger if more than three tags are pushed simultaneously」

**workflow_dispatch (inputs最大 25, payload最大 65,535 chars)**:
```yaml
on:
  workflow_dispatch:
    inputs:
      logLevel:
        description: 'Log level'
        required: true
        default: 'warning'
        type: choice
        options: [info, warning, debug]
```
- `inputs.<name>` または `github.event.inputs.<name>` で参照（前者は型保持）
- CLI: `gh workflow run greet.yml -f name=mona`

**workflow_call**:
- 入力には `type` 必須（`boolean` / `number` / `string`）
- `secrets:` を別途宣言する必要あり
- caller 側 `GITHUB_SHA`, `GITHUB_REF` をそのまま継承

### 1.6 Artifact upload と GitHub Releases 連携

引用元:
- [actions/upload-artifact](https://github.com/actions/upload-artifact)
- [softprops/action-gh-release](https://github.com/softprops/action-gh-release) (v3.0.0, 2026-04-12)

**用途の分離**:
- `actions/upload-artifact`: ワークフロー実行内の一時的な保管（デフォルト 90 日保持、`retention-days` で 1〜90 設定可）
- `softprops/action-gh-release`: GitHub Releases に永続的に attach

`softprops/action-gh-release@v3` の主要 input:
| input | 説明 |
|---|---|
| `files` | "Newline-delimited globs of paths to assets to upload for release" |
| `tag_name` | デフォルト `github.ref_name`、`refs/tags/<name>` を `<name>` に正規化 |
| `body_path` | リリースノートをファイルから読込 |
| `draft` | デフォルト false |
| `prerelease` | プレリリースフラグ |
| `fail_on_unmatched_files` | glob 不一致でジョブ失敗 |

必要な `permissions`:
```yaml
permissions:
  contents: write
```

引用: 「Existing releases update when assets are re-uploaded to the same tag」

---

## 2. xcodebuild

### 2.1 公式 man page の主要オプション

引用元: [xcodebuild(1) man page (Keith Smiley mirror)](https://keith.github.io/xcode-man-pages/xcodebuild.1.html)

| オプション | 公式記述 |
|---|---|
| `archive` | "Archive a scheme from the build root (SYMROOT). This requires specifying a scheme." |
| `-exportArchive` | "specifies that an archive should be distributed. Requires `-archivePath` and `-exportOptionsPlist`."（さらに `-exportPath` 必須、他 action と併用不可）|
| `-exportOptionsPlist` | "Specifies options for `-exportArchive`."（`xcodebuild -help` で詳細） |
| `-allowProvisioningUpdates` | "Allows xcodebuild to communicate with the Apple Developer website. For automatically signed targets, xcodebuild will create and update profiles, app IDs, and certificates."（Xcode の Accounts に Apple ID 設定要） |
| `-allowProvisioningDeviceRegistration` | "Allows xcodebuild to register your destination device on the Apple Developer website if necessary." `-allowProvisioningUpdates` 必須 |
| `-destination` | `generic/platform=iOS` で device 不要の generic build |
| `-archivePath`, `-workspace`, `-scheme`, `-configuration` | アーカイブ出力先 / workspace / scheme / Debug or Release 等 |

### 2.2 ExportOptions.plist の主要キー

引用元: [Apple Developer Forums - exportOptionsPlist flag values (#12822)](https://developer.apple.com/forums/thread/12822) ほか

> **重要な事実**: Apple の Developer Documentation 本体には ExportOptions.plist 全キーを列挙した正式リファレンスは公開されておらず、`xcodebuild -h` の出力か Apple Developer Forums の散在情報が事実上の出典。

主要キー（`xcodebuild -h` 由来、Forums で頻繁に引用される値）:

| キー | 値の例 |
|---|---|
| `method` | `app-store`, `ad-hoc`, `enterprise`, `development`, `developer-id`, `mac-application` |
| `signingStyle` | `automatic` または `manual` |
| `teamID` | Apple Team ID |
| `signingCertificate` | "Apple Development", "Apple Distribution", "iPhone Developer" 等 |
| `provisioningProfiles` | `{ "<bundleID>": "<profile name or UUID>" }` (manual時必須) |
| `compileBitcode` | bool |
| `stripSwiftSymbols` | bool |
| `uploadSymbols` | bool |

**Manual signing example (Forums 提示の典型)**:
```xml
<dict>
  <key>method</key><string>development</string>
  <key>signingStyle</key><string>manual</string>
  <key>teamID</key><string>XXXXXXXXXX</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>com.example.seam</key><string>Seam Dev Profile</string>
  </dict>
</dict>
```

### 2.3 signingStyle: manual vs automatic

引用元: [Apple Developer Forums #756119](https://developer.apple.com/forums/thread/756119)

公式ドキュメントに manual / automatic の包括的比較は無いが、forums 経由で確認できる挙動:

- **automatic**: Xcode（または `-allowProvisioningUpdates` ありの xcodebuild）が証明書・プロファイル・App ID を自動作成・更新。`DEVELOPMENT_TEAM` の指定が必要。
- **manual**: `provisioningProfiles` ディクショナリで bundle ID → プロファイル名（または UUID）の明示マッピング必須。CI に証明書とプロファイルを事前 import する用途に向く。

forums で**Xcode Cloud と等価とされる「ad-hoc 風」CI 設定**（automatic 寄り）:
```bash
xcrun xcodebuild \
  -workspace app.xcworkspace -scheme prod -configuration Release \
  -destination generic/platform=iOS \
  -archivePath ./build/prod.xcarchive \
  CODE_SIGN_IDENTITY=- \
  AD_HOC_CODE_SIGNING_ALLOWED=YES \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=ZZZZZZZZZZ \
  clean archive
```
ただし出典が Apple Developer Forums であり、**Apple の公式ドキュメントには CI 向けの推奨設定の記述は無い**。

### 2.4 unsigned build の可否

引用元: [Apple Developer Forums #95624 - "Can I use xcodebuild to build an archive without signing it?"](https://developer.apple.com/forums/thread/95624)

> **公式回答（要旨）**: Xcode 9 以降、iOS Application 用に完全 unsigned アーカイブを作るのは原則できない。
>
> ```
> Code signing is required for product type 'Application' in SDK 'iOS 11.2'
> ```
>
> `CODE_SIGN_IDENTITY=` `CODE_SIGNING_REQUIRED=NO` を組み合わせても **iOS 11+ SDK では効かない**。

ワークアラウンドとして forums で示されているのは「`CODE_SIGNING_ALLOWED=NO` も同時指定」だが、これも **Application target には実質効かない**。Apple 公式が示す「正規」のフローはあくまで「Personal Team でも何らかの development 署名を当てる」または「再署名する（codesign）」。

### 2.5 `xcrun altool` / `xcrun notarytool`

引用元: [Apple Developer Forums - notarization 関連スレッド](https://developer.apple.com/forums)

- `altool` は AppStore 配信・notarization 用、`notarytool` は macOS notarization 用。
- **iOS の sideload 用 IPA を SideStore に流す用途では一切不要**。
- これらはどちらも **paid Apple Developer Program アカウント前提**。Free Apple ID では使えない。

---

## 3. Apple 認証

### 3.1 Free Apple ID と Apple Developer Program の差

引用元: [Apple Developer - Choosing a Membership](https://developer.apple.com/support/compare-memberships/)

**Free Apple Account が含むもの**:
- Xcode、ベータ OS、ドキュメント、Feedback Assistant
- 実機での on-device testing
- Apple Developer Forums 閲覧/投稿

**Free Apple ID = Personal Team の制約（Xcode 経由のみ）**:
- App ID 同時最大 10 個 / **各 7 日で expire**
- テスト機 1 platform あたり 3 台 / **各 7 日で expire**
- **Provisioning Profile も 7 日で expire**（再署名・再インストール必須）
- App Store, TestFlight, Ad Hoc, Enterprise 配信 **全て不可**
- Certificates, IDs & Profiles ポータル **アクセス不可**
- 利用可能 capability 限定（例: Push Notifications 等は不可）

引用 (compare-memberships): "Distribute to App Store, Apple Business Manager, and Apple School Manager — Apple Developer Program ($99/year) のみ"

### 3.2 App-Specific Password (CI 観点)

引用元: [fastlane Authentication docs](https://docs.fastlane.tools/getting-started/ios/authentication/)

- `appleid.apple.com/account/manage` で発行
- 環境変数 `FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD` 経由で渡せる
- **Critical**: "The application specific password will **not** work if your action usage does anything else than uploading the binary."
- つまり、AppStore Connect / TestFlight への **アップロード専用**。証明書発行・プロファイル取得など fastlane match のような操作には使えない。

### 3.3 2FA bypass は不可能

引用元: [fastlane Authentication docs](https://docs.fastlane.tools/getting-started/ios/authentication/)

> "As of March 2021, Apple requires all developer accounts to use 2FA — this method no longer functions."

CI で 2FA セッションを保つ手法（fastlane spaceauth）の制約:
- セッションは「region-specific」=== 同じ CI マシンで生成・利用しないと短命化
- 有効期間は **1 day 〜 1 month**（geolocation 依存）
- **少なくとも月 1 回再生成必須**
- 環境変数 `FASTLANE_SESSION` で渡す

### 3.4 App Store Connect API Key（推奨だが Free 不可）

- fastlane 推奨方式。`.p8` キー + Issuer ID + Key ID
- ただし **Apple Developer Program の Account Holder / Admin のみ発行可能**
- Free Apple ID では発行不可

---

## 4. fastlane

### 4.1 一般的な iOS lane の典型

引用元: [fastlane docs - getting started](https://docs.fastlane.tools/getting-started/ios/)

主要 action:
- **`gym`** (alias `build_app`): xcodebuild ラッパー、Archive + Export を一括
- **`pilot`**: TestFlight アップロード
- **`match`**: 証明書・プロファイル同期（後述）

### 4.2 fastlane match の概要と要件

引用元: [fastlane match docs](https://docs.fastlane.tools/actions/match/)

公式記述からの要点:
- 管理対象プロファイルの種類: **Development, Ad Hoc, App Store, Enterprise, Developer ID, Mac Installer Distribution**
- 中央リポジトリ（Git / S3 / GCS）に証明書・profile を保存
- **Apple Developer Program 必須**。`username` パラメータ（Apple ID）と `team_id` 指定でポータルにアクセスする前提

> **公式ドキュメントに「Free Apple ID 対応」の言及は一切ない**。
> match は Certificates, IDs & Profiles ポータルへ API でアクセスして profile/cert を生成・取得するため、**Free Apple ID では動作不能**（ポータル自体が Free アカウントに開放されていない）。

### 4.3 Free Apple ID で fastlane match が使えない理由

整理:
1. Free Apple ID は developer.apple.com の Certificates, IDs & Profiles に **ログインしてもアクセスできない**
2. fastlane match はそのポータル（spaceship 経由）を叩く実装
3. → **構造的に動かない**
4. 代替策（後述）: Xcode 上の Personal Team → 7日ごとの手動再署名 / Free 用の独自スクリプト / `expo prebuild` + 手動 xcodebuild + ローカル証明書

### 4.4 代替策（公式 + コミュニティ）

公式（Apple ID + 2FA セッション維持）:
- `fastlane spaceauth -u user@apple.id` → `FASTLANE_SESSION` 環境変数 → CI へ
- 制約: 月 1 回程度再生成必須、region 依存

非公式 / コミュニティ:
- `xcodegen` + Personal Team で開発署名し IPA 化、SideStore で再署名（SideStore は **JIT デバッグ用 anisetteServer 経由で 7 日制限を回避**できることが community で知られているが、これは Apple 公式のサポート外）

---

## 5. EAS Build (Expo)

### 5.1 Distribution Type

引用元: [docs.expo.dev/build/eas-json](https://docs.expo.dev/build/eas-json/)

EAS Build profile の `distribution`:
- `internal` — ad-hoc / TestFlight 内部 / development
- `store` — App Store 提出
- (省略時) — store 扱い

引用: "Production Builds … cannot be installed directly on your Android Emulator or device, or iOS Simulator or device"

### 5.2 Internal Distribution の要件

引用元: [docs.expo.dev/build/internal-distribution](https://docs.expo.dev/build/internal-distribution/)

- iOS の internal distribution は **ad-hoc provisioning profile** を使う
- 100 デバイス/年（Apple ポータルの登録上限）
- `eas device:create` で UDID 登録
- **明確に「a paid Apple Developer account required」と記述あり**
- → **Free Apple ID では使えない**

### 5.3 Local Apple Credentials（credentials.json）

引用元: [docs.expo.dev/app-signing/local-credentials](https://docs.expo.dev/app-signing/local-credentials/)

```json
{
  "ios": {
    "provisioningProfilePath": "ios/certs/profile.mobileprovision",
    "distributionCertificate": {
      "path": "ios/certs/dist.p12",
      "password": "PASSWORD"
    }
  }
}
```

- **Distribution Certificate は paid Apple Developer のみ生成可** と明記
- 「Free Apple ID 制約」へは公式に言及なし
- `credentials.json` 含む全ての p12/profile は `.gitignore` 必須

### 5.4 `eas build --local`

引用元: [docs.expo.dev/build-reference/local-builds](https://docs.expo.dev/build-reference/local-builds/)

要点:
- 認証必須: `eas login` または `EXPO_TOKEN`
- 利用シーン: 「サーバー再現できないビルド失敗のデバッグ」「サードパーティ CI を使えない組織内基盤」
- 環境変数:
  - `EAS_LOCAL_BUILD_SKIP_CLEANUP=1` — 終了後クリーンアップしない
  - `EAS_LOCAL_BUILD_WORKINGDIR` — 作業ディレクトリ
  - `EAS_LOCAL_BUILD_ARTIFACTS_DIR` — 成果物出力先（デフォルト cwd）
- **制約**:
  - Node.js, Yarn, fastlane, CocoaPods, NDK 等のバージョンカスタマイズ非対応
  - キャッシュ非対応
  - シークレット環境変数はローカル設定必須
  - **macOS / Linux のみサポート（Windows・WSL 不可）** → macos-latest runner で動く
  - 「GitHub Actions 公式サポート」の言及は **無い**（実行可能だが公式の手順は提供されていない）

### 5.5 Free Tier・無料枠

引用元: [docs.expo.dev/build/setup](https://docs.expo.dev/build/setup/)

引用: "EAS Build is available to anyone with an Expo account, regardless of whether you pay for EAS or use our Free plan."

- Free plan でも EAS Build 利用可
- 同時実行数や priority queue は paid のみ
- iOS App Store ビルドには **Apple Developer Program $99/年必須** と明記
- Free Apple ID 制約は本ページに無し

### 5.6 EAS Submit（参考）

- `eas submit` で TestFlight / App Store / Play Store へ提出
- **paid アカウント必須**
- 本タスクでは不要

---

## 6. Expo prebuild on CI

### 6.1 Continuous Native Generation (CNG)

引用元: [docs.expo.dev/workflow/continuous-native-generation](https://docs.expo.dev/workflow/continuous-native-generation/)

公式記述要旨:
- ネイティブディレクトリ（`ios/`, `android/`）は **長期維持せず必要時に生成** するのが CNG の思想
- 新規 Expo プロジェクトでは `ios/` `android/` を **自動的に .gitignore する**
- 手動でネイティブコードを変更している場合は commit する → "EAS Build will not run Prebuild to avoid overwriting any changes."

### 6.2 `expo prebuild --clean`

公式引用 (CNG ページ):
- `--clean` は「既存のネイティブディレクトリを削除してから再生成」
- `--clean` 無しは「既存ファイルの上に重ねるので速いが結果が一致しない可能性」
- "Using `--clean` is the safest way to use the prebuild command and is generally recommended"
- **CI では git status の uncommitted 警告は自動スキップ**される
- 環境変数 `EXPO_NO_GIT_STATUS=1` でこのチェック無効化可

引用元: [docs.expo.dev/more/expo-cli](https://docs.expo.dev/more/expo-cli/)
- `--platform <ios|android|all>`
- `--no-install`: 依存関係インストールスキップ。iOS では `pod-install` もスキップ

### 6.3 ios/ を commit すべきか

公式の判断材料:
- **デフォルトの推奨: gitignore + CI で毎回 prebuild --clean**（Continuous Native Generation）
- 例外: ネイティブコードを手で変更している場合は commit
- EAS Build は ios/ がリポジトリ内にあれば prebuild をスキップする

Seam の現状（CLAUDE.md より）: `prebuild` コマンドが `package.json` に存在し、`pnpm prebuild` で再生成可能 → **gitignore + CI 毎回再生成パターンが Expo 公式推奨に沿う**。

---

## 7. CocoaPods on CI

### 7.1 公式の指針

引用元: [actions/runner-images macos-15 README](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-Readme.md)

- macos-15 runner にデフォルトで **CocoaPods 1.16.2** プリインストール
- Ruby 3.3.11 が current
- M-series host 互換

### 7.2 React Native 0.81 の Precompiled XCFrameworks 利用条件

引用元: [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54), [Expo SDK 54 Beta](https://expo.dev/changelog/sdk-54-beta)

公式記述要点:
- React Native 0.81 から **`ReactNativeDependencies.xcframework`**（Glog, Folly, DoubleConversion など third-party をプリコンパイル）が同梱
- Expo SDK 54 でデフォルト有効
- 引用: "using the precompiled XCFrameworks reduced clean build times for RNTester from about 120 seconds to 10 seconds (on an M4 Max)"
- **既知問題（重要）**: "In React Native 0.81.0, apps that are compiled in Release using the precompiled XCFrameworks **can't be submitted to the store**: this will be resolved in 0.81.1"
  - Seam は React Native **0.81.5** 利用なので、すでに修正版範囲
- **`use_frameworks!` と非互換**: "Precompiled React Native for iOS is not compatible with use_frameworks!. When using use_frameworks!, React Native for iOS will always build from source."
- 設定キー: `expo-build-properties` の **`ios.buildReactNativeFromSource`** を `false`（デフォルト）→ precompiled 使用、`true` → ソースビルド

### 7.3 `expo.precompileXCFrameworks` という設定キーの存在

> **公式ドキュメントに `expo.precompileXCFrameworks` という設定キーは見つからなかった**。
>
> Expo SDK 54 changelog / `expo-build-properties` ドキュメントが言及するのは:
> - `ios.buildReactNativeFromSource`（precompiled 利用の制御フラグ）
> - `ios.useFrameworks`（'static' | 'dynamic'、`use_frameworks!` 切替）
> - `ios.forceStaticLinking`
>
> ユーザの質問にあった `expo.precompileXCFrameworks` は **正確には `ios.buildReactNativeFromSource` の逆フラグ** に該当する可能性が高い。

引用元: [Expo build-properties docs](https://docs.expo.dev/versions/latest/sdk/build-properties/)

### 7.4 キャッシュ戦略（公式情報なし、慣習）

> **公式ドキュメントに「CocoaPods/iOS 専用の正式なキャッシュ戦略」は記述されていない**。
> [actions/cache README](https://github.com/actions/cache) は path 例として `Pods` ディレクトリを挙げるのみ。

コミュニティで広く使われるパターン（参考）:
```yaml
- uses: actions/cache@v5
  with:
    path: |
      ~/Library/Caches/CocoaPods
      ~/.cocoapods
      packages/app/ios/Pods
    key: ${{ runner.os }}-pods-${{ hashFiles('packages/app/ios/Podfile.lock') }}
    restore-keys: ${{ runner.os }}-pods-
```

注意: **`expo prebuild --clean` を CI で毎回流す場合、Podfile.lock も再生成されるため hashFiles() のキーが毎回変わる可能性がある**。ロック前提のキャッシュは prebuild の出力安定性に依存する。

---

## 8. SideStore / AltStore Source 公式仕様

### 8.1 AltStore Source 公式仕様

引用元: [AltStore - Make a Source FAQ](https://faq.altstore.io/developers/make-a-source) (LLM-friendly: [llms-full.txt](https://faq.altstore.io/llms-full.txt))

#### Source オブジェクト（root）

**Required**:
- `name` (string) — Source の表示名
- `apps` (array) — App オブジェクトの配列

**Optional**:
- `subtitle`, `description`, `iconURL`, `headerURL`(3:2比率推奨), `website`, `fediUsername`, `patreonURL`, `tintColor`(`#RRGGBB`), `featuredApps` (max 5 bundleID array), `news` (array)

#### App オブジェクト

**Required**:
- `name`, `bundleIdentifier`(case-sensitive、Info.plist の `CFBundleIdentifier` と一致), `developerName`, `localizedDescription`, `iconURL`, `versions` (array)

**Optional**:
- `marketplaceID` (PAL 用), `subtitle`, `tintColor`, `category` (`developer | entertainment | games | lifestyle | other | photo-video | social | utilities`), `screenshots`, `appPermissions`, `patreon`

#### Version オブジェクト

**Required**:
- `version` (= `CFBundleShortVersionString`)
- `buildVersion` (= `CFBundleVersion`)
- `date` (ISO 8601, `YYYY-MM-DD` 等)
- `downloadURL`
- `size` (bytes)

**Optional**:
- `marketingVersion`, `localizedDescription`, `assetURLs`, `minOSVersion`, `maxOSVersion`

#### バージョン更新ルール
- AltStore は **`versions[0]`（先頭）が最新**として扱う
- 互換性チェックで先頭から順に評価

#### 完全な最小例（公式から）
```json
{
  "name": "Example Source",
  "apps": [
    {
      "name": "Example App",
      "bundleIdentifier": "com.example.app",
      "developerName": "Example Developer",
      "localizedDescription": "An example application.",
      "iconURL": "https://example.com/icon.png",
      "versions": [
        {
          "version": "1.0",
          "buildVersion": "1",
          "date": "2024-01-15",
          "downloadURL": "https://example.com/app.ipa",
          "size": 50000000
        }
      ],
      "appPermissions": { "entitlements": [], "privacy": {} }
    }
  ],
  "news": []
}
```

### 8.2 SideStore Source 仕様

#### 公式 / 準公式の出典
- [SideStore Connect docs - apps.json endpoint](https://connect.sidestore.io/docs/developer/apps-json)
- [sidestore-source-types Version interface](https://sidestore.io/sidestore-source-types/interfaces/Version.html)
- [SideStore/apps.json _includes/source.json template](https://github.com/SideStore/apps.json/blob/main/_includes/source.json)
- [SideStore/Community-Source/sidecommunity.json (実例)](https://github.com/SideStore/Community-Source/blob/main/sidecommunity.json)
- [SideStore/SideStore Issue #735（互換性差分）](https://github.com/SideStore/SideStore/issues/735)

#### AltStore との重要な差分

引用 (Issue #735):
> "SideStore always expects there to be a 'downloadURL' key at the app top-level, regardless of the presence of a 'versions' array."
>
> AltStore は `versions` 配列があれば top-level `downloadURL` を省略可（先頭 version の URL を使う）。**SideStore は省略不可**。

#### SideStore の app 構造（template + sidestore-source-types から）

Top-level (Source) フィールド:
- `name`, `identifier`, `sourceURL`, `iconURL`, `userinfo`, `apps`, `news`

App フィールド:
- **必須**: `name`, `bundleIdentifier`, `developerName`, `version`, `versionDate`, `downloadURL`, `localizedDescription`, `iconURL`, `size`
- **追加**: `subtitle`, `versionDescription`, `tintColor`, `screenshotURLs`(配列), `permissions`(`type` + `usageDescription`), `appPermissions`, `versions`(過去版アーカイブ), `beta`, `appID`, `absoluteVersion`

Version 配列要素（`sidestore-source-types`）:
```typescript
interface Version {
  version: string;        // CFBundleShortVersionString
  date: string;           // YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
  downloadURL: string;
  size: number;           // bytes
  localizedDescription?: string;
  minOSVersion?: string;
  maxOSVersion?: string;
}
```

> **重要**: SideStore Version interface には **`buildVersion` フィールドが定義されていない**（AltStore は必須）。SideStore 専用 source としては不要、AltStore 互換にするなら付ける。

Permission オブジェクト:
```json
{ "type": "background-fetch", "usageDescription": "..." }
```

#### SideStore source.json template（SideStore/apps.json から）

```json
{
  "name": "SideStore Official",
  "identifier": "com.SideStore.SideStore",
  "sourceURL": "https://...",
  "iconURL": "https://...",
  "userinfo": {},
  "apps": [
    {
      "name": "App Name",
      "bundleIdentifier": "com.example.app",
      "developerName": "Dev",
      "version": "1.0",
      "versionDate": "2026-04-27T00:00:00",
      "versionDescription": "...",
      "downloadURL": "https://.../app.ipa",
      "size": 12345678,
      "localizedDescription": "...",
      "iconURL": "https://.../icon.png",
      "tintColor": "#000000",
      "screenshotURLs": [],
      "permissions": [],
      "versions": [
        {
          "version": "1.0",
          "date": "2026-04-27",
          "downloadURL": "https://.../app-1.0.ipa",
          "size": 12345678
        }
      ]
    }
  ],
  "news": []
}
```

### 8.3 AltStore / SideStore 両対応のための実装上の注意

両方をサポートする最低限のルール:
1. App 直下に `downloadURL`, `version`, `versionDate`, `size` を持たせる（SideStore 必須）
2. 加えて `versions` 配列も持たせ、`buildVersion`, `date`, `downloadURL`, `size` を含める（AltStore 必須）
3. 両者で `versions[0]` と top-level の整合性を取る

---

## 9. GitHub Releases API

### 9.1 `gh release create` (GitHub CLI)

引用元: [gh release create manual](https://cli.github.com/manual/gh_release_create)

```
gh release create [<tag>] [<filename>... | <pattern>...]
```

主要フラグ:
| フラグ | 意味 |
|---|---|
| `-t, --title <string>` | リリースタイトル |
| `-n, --notes <string>` | リリースノート |
| `-F, --notes-file <file>` | リリースノートをファイルから（`-` で stdin） |
| `-d, --draft` | ドラフト |
| `-p, --prerelease` | プレリリース |
| `--target <branch>` | tag が無い場合に作るベース |
| `--verify-tag` | tag が remote に存在しないとエラー |
| `--generate-notes` | 自動生成 |
| `--latest` | "Latest" 指定の制御 |
| `--discussion-category <name>` | discussion 開始 |

アセットラベル: `'/path/to/asset.zip#My display label'`

例: `gh release create v1.2.3 ./dist/*.tgz --notes "release"`

### 9.2 `gh release upload`

引用元: [gh release upload manual](https://cli.github.com/manual/gh_release_upload)

```
gh release upload <tag> <files>... [flags]
```
- `--clobber`: 同名アセットを削除して再アップロード（**失敗時に元アセットが失われる点に注意**）
- ラベル: `app.dmg#"macOS Package"`

### 9.3 REST API (`POST /repos/{owner}/{repo}/releases/{release_id}/assets`)

引用元: [GitHub REST API - Releases assets](https://docs.github.com/en/rest/releases/assets)

- アップロードは **`uploads.github.com`** (api.github.com とは別ホスト)
- リクエストボディは raw binary、`Content-Type` ヘッダ必須
- レスポンスに `browser_download_url` (URI 形式)
- アセット state: `uploaded` / `open` / `starter`(失敗時)

### 9.4 Private Repo の Asset URL 認証

引用元: [GitHub Community Discussion #47453](https://github.com/orgs/community/discussions/47453), [GitHub REST API](https://docs.github.com/en/rest/releases/assets)

公式記述:
- Released **public** アセット → `browser_download_url` 直 GET 可
- Released **private** アセット → `browser_download_url` を直 GET しても 404 / 認可エラー

公式手順:
1. `Authorization: Bearer <TOKEN>` ヘッダを付ける
2. `Accept: application/octet-stream` を付ける
3. リダイレクト追従

curl 例（公式 / discussion から）:
```bash
curl -L \
  -H "Accept: application/octet-stream" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/OWNER/REPO/releases/assets/ASSET_ID \
  -o app.ipa
```

> **本タスクへの含意**: SideStore の Source JSON が指す `downloadURL` は **public でないと SideStore がそのままアクセスできない**。
> Seam は public repo（`github.com/sugarshin/seam`）のため、Releases も public 扱いで `browser_download_url` を直接埋め込めば良い。

---

## 10. その他参考

### 10.1 ExpoModulesProvider.swift の生成タイミング

引用元: [docs.expo.dev/modules/autolinking](https://docs.expo.dev/modules/autolinking/)

公式記述要点:
- Expo Autolinking は CocoaPods 統合を持ち、`pod install` 時に Expo modules を解決
- Podfile で `use_expo_modules!` を呼ぶ → autolinking CLI が走る
- 解決順序: react-native.config.js → searchPaths → nativeModulesDir(`./modules/`) → Node 解決
- `ExpoModulesProvider.swift` は **`pod install` 中に autogenerate される**（公式 autolinking docs にはファイル名の明示は無いが、SDK 54 changelog と PR 履歴で確認）

### 10.2 React Native 0.81 New Arch ビルド時間影響

引用元: [Expo SDK 54 changelog](https://expo.dev/changelog/sdk-54), [Precompiled React Native for iOS blog](https://expo.dev/blog/precompiled-react-native-for-ios)

- New Architecture (Fabric/TurboModules/JSI) は SDK 54 / RN 0.81 でデフォルト
- precompiled XCFrameworks 導入により **clean build が約 12 倍高速化**（RNTester で 120s → 10s on M4 Max）
- ただし「app 全体」の高速化率は依存関係次第（小プロジェクトほど効果大）
- New Arch そのもののビルド時間影響について **公式は数値を出していない**

### 10.3 Expo SDK 54 Node.js 要件

引用元: [Expo SDK 54 changelog](https://expo.dev/changelog/sdk-54)

- 最低 Node **20.19.4** 以上
- Seam の package.json でも対応する Node 設定が必要（CI `setup-node` で `node-version: '20.19.4'` 以上を指定）

### 10.4 Free Apple ID + Personal Team での 7日 expire の運用

引用元 (技術): [Apple Developer - Provisioning Profile updates](https://developer.apple.com/help/account/provisioning-profiles/provisioning-profile-updates/)

- Free Apple ID の Provisioning Profile は 7 日で expire（Apple 公式 compare-memberships にも明記）
- Apple Developer Program（paid）でも、June 6, 2021 以降に作られたチームの **offline provisioning profile は 7 日**
- 通常の (paid) ad-hoc/development は 1 年程度有効
- → **CI で IPA をビルドした時点から 7 日カウント開始**となるため、SideStore からインストールしてからの実機での動作可能期間も 7 日制限を継承する

> SideStore / AltStore はデバイス側で **再署名（refresh）** することで Free 7 日制約を運用回避するが、これは Apple の公式サポート対象外の手法。

### 10.5 Xcode 26 / macOS 26 の既知の不具合

引用元: [react-native-community/cli Issue #2768](https://github.com/react-native-community/cli/issues/2768)

- Xcode 26.2+ で `xcodebuild` が BUILD SUCCEEDED 後にハング（SWBBuildService が pipe を閉じない）
- 2026-04 時点で `react-native run-ios` 系で既知問題
- **回避**: `setup-xcode` で `16.4` 系をピン留め

---

## まとめ：公式情報から導かれる制約と選択肢

### A. Free Apple ID 縛りで「公式に決定済み」となっている事実

1. **fastlane match 不可** — Certificates, IDs & Profiles ポータルにアクセスできないため構造的に不可（[fastlane match docs](https://docs.fastlane.tools/actions/match/)）
2. **EAS Build の internal distribution 不可** — paid Apple Developer Program 必須（[docs.expo.dev/build/internal-distribution](https://docs.expo.dev/build/internal-distribution/)）
3. **EAS Local Credentials の "distributionCertificate" 入手不可** — Distribution Certificate は paid のみ（[docs.expo.dev/app-signing/local-credentials](https://docs.expo.dev/app-signing/local-credentials/)）
4. **TestFlight / App Store / Ad-hoc / Enterprise 配信 全て不可**（[Apple - Compare Memberships](https://developer.apple.com/support/compare-memberships/)）
5. **xcrun altool / notarytool 不要かつ使用不可**
6. **完全 unsigned IPA も不可**（iOS 11+ SDK で xcodebuild が拒否、[Apple Forums #95624](https://developer.apple.com/forums/thread/95624)）
7. **App-Specific Password はアップロード専用**（[fastlane authentication](https://docs.fastlane.tools/getting-started/ios/authentication/)）

### B. 公式情報から自然に導かれる構成方針

**Tag push トリガーで GitHub Actions 化する場合の最も保守的な構成**:

1. **Trigger**: `on: push: tags: ['v*.*.*']` + `workflow_dispatch`（手動再実行の保険）
2. **Runner**: `macos-latest` （= macOS 15）
3. **Xcode pin**: `maxim-lobanov/setup-xcode@v1` で `xcode-version: '16.4'`（26.x は run-ios ハング既知）
4. **Node**: `actions/setup-node@v4` で `'20.19.4'` 以上、cache: pnpm
5. **Cache**:
   - pnpm store
   - `~/Library/Caches/CocoaPods`, `~/.cocoapods`, `packages/app/ios/Pods`（hashFiles `Podfile.lock`）
   - **DerivedData は通常推奨されない**（公式キャッシュ戦略の例示はなし、肥大化しがち）
6. **Native generation**: `expo prebuild --clean -p ios`（`EXPO_NO_GIT_STATUS=1`）
7. **Cocoapods**: precompiled XCFrameworks をデフォルトで使用（`buildReactNativeFromSource: false`）
8. **Signing**:
   - **Option A — 開発署名（Free Apple ID）**: GitHub Docs 公式の `security` コマンド手順で .p12 + .mobileprovision を import → `xcodebuild ... -allowProvisioningUpdates -archivePath ...` → ExportOptions.plist は `method: development`, `signingStyle: manual`, `provisioningProfiles: { com.example.seam: <profile name> }`
     - 制約: **Profile は 7 日で expire** → タグ push してビルドしても 7 日後には実機で起動不可。SideStore 等で再署名する運用前提なら問題ない。
   - **Option B — `signingStyle: automatic` + `-allowProvisioningUpdates`**: Apple ID と 2FA を CI で扱う必要 → `FASTLANE_SESSION` で月 1 更新が現実的に必須。Seam の用途には重い。
   - **Option C — Free 7日 を許容して ローカル/手動で再署名**: CI では `CODE_SIGN_IDENTITY=-` などで「最低限の archive」を作り、IPA の codesign を後段で行う。Apple Forums の Xcode Cloud 風レシピ（[Forums #756119](https://developer.apple.com/forums/thread/756119)）を参考に。
9. **Archive→IPA**: `xcodebuild -exportArchive -archivePath ... -exportOptionsPlist ... -exportPath ...`
10. **GitHub Releases**: `softprops/action-gh-release@v3` で IPA を upload。`tag_name: ${{ github.ref_name }}`、`fail_on_unmatched_files: true`、permissions: `contents: write`
11. **SideStore Source JSON の更新**: 別ジョブまたは別 step で `apps[0].downloadURL` および `apps[0].versions[0].downloadURL` を新リリースの `https://github.com/sugarshin/seam/releases/download/<tag>/seam.ipa` に書き換え、同一 release または別ブランチに commit。
    - public repo 前提なので `browser_download_url` をそのまま埋めればよい。

### C. 「公式ドキュメントに記述なし」と明記すべき事項

1. **iOS 用の正式キャッシュ戦略は GitHub / Apple / CocoaPods いずれも公式公開していない**（actions/cache が path 例として `Pods` を挙げるのみ）
2. **`expo.precompileXCFrameworks` というキー名は Expo 公式ドキュメントに存在しない**（実態は `ios.buildReactNativeFromSource`）
3. **`eas build --local` を GitHub Actions で動かす公式手順は無い**（macOS/Linux で動くことのみ明記）
4. **xcodebuild の ExportOptions.plist 全キーリファレンスは Apple Developer Documentation 本体にない**（`xcodebuild -h` と Apple Developer Forums が事実上の出典）
5. **Free Apple ID で fastlane match が動かない理由は公式に直接の記述はない**（match docs は paid 前提のみ書く / Free 言及なし）
6. **AltStore / SideStore のどちらも JSON Schema (json-schema.org 形式) は公式提供されていない**。SideStore は `sidestore-source-types`（TypeScript 型定義）が事実上のスキーマ。
7. **SideStore がデバイス側で 7 日制約を回避する詳細手順は Apple 公式サポート外**

### D. 推奨する次のステップ

1. **pin 戦略**: Xcode 16.4, Node 20.19.4 以上、CocoaPods 1.16.2（macos-15 同梱）
2. **公式手順をそのまま採用**: GitHub Docs の `security create-keychain` 手順は Apple ID 種別に依存しないため、Free Apple ID で発行した Apple Development 証明書 + Personal Team の Provisioning Profile でも適用可能
3. **`signingStyle: manual` + ExportOptions.plist 直書き** が CI で最も挙動が安定する
4. **SideStore 仕様優先**: AltStore 互換も維持しつつ、`downloadURL` を app top-level にも置く
5. **release notes 自動化**: `gh release create --generate-notes` または `softprops/action-gh-release@v3` の `body_path`

### E. 主要参考 URL 一覧

#### GitHub Actions
- [actions/runner-images macos-15 README](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-Readme.md)
- [Installing an Apple certificate on macOS runners for Xcode development - GitHub Docs](https://docs.github.com/en/actions/use-cases-and-examples/deploying/installing-an-apple-certificate-on-macos-runners-for-xcode-development)
- [actions/cache](https://github.com/actions/cache)
- [maxim-lobanov/setup-xcode](https://github.com/maxim-lobanov/setup-xcode)
- [Events that trigger workflows - GitHub Docs](https://docs.github.com/en/actions/reference/events-that-trigger-workflows)
- [softprops/action-gh-release](https://github.com/softprops/action-gh-release)

#### xcodebuild / Apple
- [xcodebuild(1) man page (Keith Smiley mirror)](https://keith.github.io/xcode-man-pages/xcodebuild.1.html)
- [Apple Compare Memberships](https://developer.apple.com/support/compare-memberships/)
- [Apple Provisioning Profile updates](https://developer.apple.com/help/account/provisioning-profiles/provisioning-profile-updates/)
- [Apple Developer Forums #95624 (unsigned archive)](https://developer.apple.com/forums/thread/95624)
- [Apple Developer Forums #756119 (CI signing)](https://developer.apple.com/forums/thread/756119)
- [Apple Developer Forums #688626 (exportArchive failures)](https://developer.apple.com/forums/thread/688626)

#### Expo
- [docs.expo.dev/workflow/continuous-native-generation](https://docs.expo.dev/workflow/continuous-native-generation/)
- [docs.expo.dev/build-reference/local-builds](https://docs.expo.dev/build-reference/local-builds/)
- [docs.expo.dev/app-signing/local-credentials](https://docs.expo.dev/app-signing/local-credentials/)
- [docs.expo.dev/build/internal-distribution](https://docs.expo.dev/build/internal-distribution/)
- [docs.expo.dev/build/eas-json](https://docs.expo.dev/build/eas-json/)
- [docs.expo.dev/build/setup](https://docs.expo.dev/build/setup/)
- [docs.expo.dev/modules/autolinking](https://docs.expo.dev/modules/autolinking/)
- [docs.expo.dev/versions/latest/sdk/build-properties](https://docs.expo.dev/versions/latest/sdk/build-properties/)
- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54)
- [Expo SDK 54 Beta Changelog](https://expo.dev/changelog/sdk-54-beta)
- [Precompiled React Native for iOS Blog](https://expo.dev/blog/precompiled-react-native-for-ios)

#### fastlane
- [fastlane Authentication](https://docs.fastlane.tools/getting-started/ios/authentication/)
- [fastlane match](https://docs.fastlane.tools/actions/match/)

#### SideStore / AltStore
- [AltStore - Make a Source FAQ](https://faq.altstore.io/developers/make-a-source)
- [AltStore llms-full.txt](https://faq.altstore.io/llms-full.txt)
- [SideStore Connect apps.json endpoint](https://connect.sidestore.io/docs/developer/apps-json)
- [sidestore-source-types Version interface](https://sidestore.io/sidestore-source-types/interfaces/Version.html)
- [SideStore/apps.json source.json template](https://github.com/SideStore/apps.json/blob/main/_includes/source.json)
- [SideStore/Community-Source sidecommunity.json](https://github.com/SideStore/Community-Source/blob/main/sidecommunity.json)
- [SideStore Issue #735 (compatibility)](https://github.com/SideStore/SideStore/issues/735)

#### GitHub Releases / CLI
- [gh release create manual](https://cli.github.com/manual/gh_release_create)
- [gh release upload manual](https://cli.github.com/manual/gh_release_upload)
- [GitHub REST API - Releases assets](https://docs.github.com/en/rest/releases/assets)
- [GitHub Community Discussion #47453 (private asset auth)](https://github.com/orgs/community/discussions/47453)

#### React Native
- [react-native-community/cli Issue #2768 (Xcode 26 hang)](https://github.com/react-native-community/cli/issues/2768)
