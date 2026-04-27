# SideStore で Seam (Expo SDK 54) を Free Apple ID 運用するための公式ドキュメント調査

調査日: 2026-04-26
対象アプリ: Seam (`/Users/shingosato/dev/src/github.com/sugarshin/seam`)
構成: Expo SDK 54 / React Native 0.81.5 / New Architecture 有効 / pnpm + Turborepo monorepo
方針: Apple Developer Program に加入せず、Free Apple ID + SideStore のみで自分の iPhone に配布

> 注: 本セッションでは Context7 MCP ツールが利用不可だったため、公式ドキュメント (Expo, React Native, Apple Developer, SideStore Docs, GitHub) を WebFetch / WebSearch で直接読み取り、引用を付して整理した。「公式ドキュメントに記載なし」と判断した項目は明記している。

---

## 1. Expo 公式

### 1.1 Expo SDK 54 の iOS / Xcode 要件

公式 Changelog (`expo.dev/changelog/sdk-54`) より:

- **Xcode 16.1 以上必須**(Xcode 26 推奨。iOS 26 の Liquid Glass / `expo-glass-effect` を使う場合は Xcode 26 が必要)
- **Node 20.19.4 以上必須**
- React Native は **precompiled XCFrameworks** で配布される。RNTester で M4 Max クリーンビルド 120 秒 → 10 秒に短縮の事例あり。
- SDK 54 が **Legacy Architecture をサポートする最後のリリース**。SDK 55 (RN 0.83 想定) は New Architecture のみ。SDK 53 プロジェクトの 75% は既に New Arch。
- `expo-av` は SDK 55 で削除。`SafeAreaView` は非推奨で `react-native-safe-area-context` 推奨。

iOS 最低デプロイメントターゲットは Changelog ページからは明示されないが、React Native 0.81 の最低 iOS 15.1 (1.4 節参照) に追従するのが既定。

引用元:
- https://expo.dev/changelog/sdk-54

### 1.2 `expo prebuild` の仕様と再生成時の注意

公式ドキュメント (`docs.expo.dev/workflow/continuous-native-generation/`) より:

- 推奨フォーム: `npx expo prebuild` または `npx expo prebuild --clean`。
- 引用: *"If you modify the generated directories manually then you risk losing your changes the next time you run `npx expo prebuild --clean`."*
- `--clean` は既存の `ios/` `android/` を削除してから再生成する。「最も安全な使い方で、ほとんどのケースで推奨」と公式が記載。
- 直接 native コードを編集するのではなく、**config plugin を書くこと**が公式推奨。
- ネイティブディレクトリを git 管理した場合、**EAS Build は prebuild を再実行しない**(変更を上書きしないため)。一方、CNG (Continuous Native Generation) ワークフローでは `ios/` `android/` を `.gitignore` するのが推奨。

Seam への含意:
- 現状 `packages/app/ios/Seam.xcworkspace` は prebuild 済みでコミットされている前提なので、**Apple Developer 設定や SideStore 用の Bundle ID 変更は config plugin / app.json 経由で行い、`prebuild --clean` で再生成する** のが安全。
- ただしリリースビルドの直前に手動で Xcode の Signing & Capabilities を弄ると `--clean` で吹き飛ぶ。Free Apple ID で Personal Team を選ぶ操作も `--clean` 後に再実行が必要。

引用元:
- https://docs.expo.dev/workflow/continuous-native-generation/

### 1.3 `expo run:ios --configuration Release`

Expo CLI ドキュメントより:

```sh
npx expo run:ios --configuration Release
```

- 公式の説明: *"This build is not automatically code signed for submission to the Apple App Store"* / *"Native code signing requires several network requests and is prone to many different types of errors from the Apple servers."*
- 主に「本番でのみ再現するバグの確認」用と位置付けられている。
- App Store 提出向け本番ビルドは EAS Build を推奨と明記。

Seam への含意: 本コマンドで開発機の iPhone に Release build を直接インストールすることは可能(Free Apple ID + Personal Team で署名)。ただし `.ipa` 生成は別途 Xcode の Archive → Export Development が必要。

引用元:
- https://docs.expo.dev/more/expo-cli/

### 1.4 `eas build --local` で `.ipa` を作る

公式 (`docs.expo.dev/build-reference/local-builds/`) より:

```sh
eas build --platform ios --local
```

- 「EAS Build サーバ上で動くものとほぼ同じ手順をローカル実行する」と明記。
- 必須環境(iOS): **fastlane**, **CocoaPods**, Node.js, Xcode。macOS / Linux のみ正式サポート (Windows は WSL)。
- *"You are responsible for making sure that the environment has all the necessary tools installed"*。
- **Apple Developer Program 必須かは公式ドキュメント上では明示されていない**。ただし `--local` で internal distribution の `.ipa` を出力する際は何らかの署名が必要で、自動的に signing アセットを EAS から取得しようとする。Free Apple ID のみで完全に non-interactive に `.ipa` が出るかは公式ドキュメントに記載なし。
- ローカル開発ビルドガイド (`docs.expo.dev/guides/local-app-production/`) では引用: *"Paid Apple Developer membership"* が iOS Release build の前提として明記されており、これは EAS / 一般的な Production リリース前提。

Seam への含意:
- **`eas build --local` を使う場合も Apple ID の signing 連携は必須**。Free Apple ID では EAS 内蔵 credentials manager の対象外なので、Xcode 経由のローカル archive (1.5 節) のほうが現実的。
- `eas build:run -p ios` と組み合わせて simulator build なら Apple Developer Program 不要 (1.6 節)。ただし実機向けには有効性が不明。

引用元:
- https://docs.expo.dev/build-reference/local-builds/
- https://docs.expo.dev/guides/local-app-production/

### 1.5 Xcode から Archive する場合の Expo + pnpm monorepo 固有の注意

公式 (`docs.expo.dev/guides/monorepos/`) より:

- Bun / npm / pnpm / Yarn の workspaces をファーストクラスサポート。
- **SDK 52 以降は `expo/metro-config` が monorepo 用 Metro 設定を自動構成**。古い手動 `watchFolders` は削除推奨。
- pnpm の **isolated install** は SDK 54+ でサポートされるが、一部 RN ライブラリでビルドエラーの実績あり。問題が起きたら `pnpm-workspace.yaml` で `nodeLinker: hoisted` を検討。
- 引用: *"Duplicate React Native versions in a single monorepo are not supported"* / *"Duplicate React version in a single app will cause runtime errors."*。`pnpm why --depth=10 react-native` で調査推奨。
- `eas build` 用には各 app の root (`packages/app`) から実行し、`eas.json` / `credentials.json` も app root に置く。必要なら `postinstall` で他 workspace のビルドを行う。

Seam への含意:
- `cd packages/app && pnpm ios` の流れと整合。Xcode から archive する場合は `xed packages/app/ios` で `Seam.xcworkspace` を開く。
- pnpm の symlink 構造で **Pods が monorepo root の `node_modules` を参照する**ため、Pods のパスは `packages/app/ios/Pods/` 配下、ヘッダ参照は `../../../node_modules/...` 形式になりがち。これは Expo Autolinking が解決するが、CLAUDE.md の方針通り `@seam/domain` `@seam/shared` は build 不要のソース直参照なので Pod 化されない。

引用元:
- https://docs.expo.dev/guides/monorepos/
- https://docs.expo.dev/build-reference/build-with-monorepos/

### 1.6 EAS Build シミュレータビルド (参考)

`eas.json` に `ios.simulator: true` を設定し `eas build -p ios --profile preview` で simulator 用 `.app` を生成可能。
引用: *"This provides a standalone (independent of Expo Go) version of the app running without needing to deploy to TestFlight"*。

Seam への含意: 開発機 iPhone に直接サイドロードしたいので simulator build は対象外だが、CI でのスモークテスト用には選択肢。

引用元:
- https://docs.expo.dev/build-reference/simulators/

### 1.7 expo-notifications の Capability / Entitlement 要件

公式 (`docs.expo.dev/versions/latest/sdk/notifications/`) より:

- 引用: *"The iOS APNs entitlement is _always_ set to 'development'"*。これは push 通知を扱う場合の話。
- ローカル通知のみで使う場合に Push Notifications capability が完全に不要かは **公式ドキュメントには明示なし**。Expo Go では「Local notifications (in-app notifications) remain available in Expo Go」と記載。
- 一般論として、`UserNotifications` framework のローカル通知は entitlement 不要だが、`expo-notifications` の config plugin が **デフォルトで `aps-environment` entitlement を埋め込む** 場合、Personal Team では provisioning profile 生成に失敗する (Apple フォーラム引用「Personal development teams ... do not support the Push Notifications capability」)。
- Seam の運用は「ローカル通知のみ」なので、**`app.json` で push 関連の plugin プロパティを無効化** するか、`expo-notifications` の plugin を最小構成で使う必要がある。詳しい設定は公式ドキュメントに直接の指示なし。

引用元:
- https://docs.expo.dev/versions/latest/sdk/notifications/
- https://developer.apple.com/forums/thread/718388

### 1.8 expo-sqlite

公式より:

- 追加 capability は **App Groups (`com.apple.security.application-groups`) のみ** (他アプリ/拡張と DB を共有する場合)。Seam は単一アプリで完結するため不要。
- `SQLCipher is not supported on Expo Go` と記載があるが、ネイティブビルドでは利用可。
- Free Apple ID 制約は記載なし。基本的に entitlement 不要なので Personal Team で問題ない想定。

引用元:
- https://docs.expo.dev/versions/latest/sdk/sqlite/

### 1.9 expo-secure-store

公式より:

- iOS では `kSecClassGenericPassword` で Keychain Services を使用。
- Face ID 利用時は **`NSFaceIDUsageDescription` を Info.plist に追加**。
- `requireAuthentication` は Expo Go 上で `NSFaceIDUsageDescription` 不在のため未サポート。
- Keychain Sharing capability の必要性については **公式ドキュメントに記載なし**。app group 経由で複数アプリ間共有する場合のみ必要となる(一般論)。Seam は単一アプリなので不要。
- Free Apple ID で利用不可になる記載は **なし**。

引用元:
- https://docs.expo.dev/versions/latest/sdk/securestore/

### 1.10 expo-image-picker

公式より、Info.plist に以下が必要:

```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>Give $(PRODUCT_NAME) permission to save photos</string>
<key>NSCameraUsageDescription</key>
<string>Give $(PRODUCT_NAME) permission to access your camera</string>
<key>NSMicrophoneUsageDescription</key>
<string>Give $(PRODUCT_NAME) permission to use your microphone</string>
```

- これらは usage description のみで、entitlement や capability は要求しない。
- Free Apple ID 制約に関する記載は **なし**。Personal Team で問題ない想定。

引用元:
- https://docs.expo.dev/versions/latest/sdk/imagepicker/

### 1.11 EAS Build が同期する iOS Capabilities

公式 (`docs.expo.dev/build-reference/ios-capabilities/`) より:

- EAS Build は `ios.entitlements` (Expo) または `*.entitlements` (bare RN) を Apple Developer Console と自動同期する。
- 「サポート対象外」と明記されているのは **HLS Interstitial Previews のみ**。
- Push Notifications, iCloud, Associated Domains, HealthKit, HomeKit, Sign In with Apple, Apple Pay, NFC Tag Reading, SiriKit など 60+ capability に対応。
- **Personal Team で利用可能な capability の一覧は公式ドキュメントには記載なし** → Apple のフォーラム情報 (3.2 節) に依存。
- `EXPO_NO_CAPABILITY_SYNC=1` で同期を無効化できる。

Seam への含意: Free Apple ID で archive する場合は EAS の credential 同期は使わず、Xcode の Personal Team automatic signing に任せるのが自然。`EXPO_NO_CAPABILITY_SYNC=1` 相当の運用 (= EAS を使わない) になる。

引用元:
- https://docs.expo.dev/build-reference/ios-capabilities/

---

## 2. React Native 公式

### 2.1 React Native 0.81 のリリース内容

公式 blog (`reactnative.dev/blog/2025/08/12/react-native-0.81`, 2025-08-12) より:

- **Xcode 最低バージョン: 16.1 へ引き上げ**。
- **Node.js 最低: 20.19.4 (Maintenance LTS)**。
- 実験機能として **Precompiled iOS builds**: `RCT_USE_RN_DEP=1 RCT_USE_PREBUILT_RNCORE=1 bundle exec pod install` で有効化、最大 10x 高速。
  - 制約: React Native 内部のデバッグ不可 (自分のネイティブコードはデバッグ可)。Xcode 26 Beta では現状サポート外、回避策として `SWIFT_ENABLE_EXPLICIT_MODULES=NO`。
- Android: Android 16 (API 36) ターゲット既定化。edge-to-edge 強制。Predictive back gesture 既定有効。16 KB page size 要件 (2025-11-01 効力)。
- **JavaScriptCore (JSC) のビルトイン削除**。JSC が必要なら `react-native-community/javascriptcore` を別途利用。Hermes ユーザーは影響なし。
- `<SafeAreaView>` 非推奨。
- C++ ライブラリ作者は `target_compile_reactnative_options()` を使う必要あり。
- 0.81 が最新 stable。0.78.x はサポート外。

iOS 最低デプロイメントターゲットの直接の言及は本ブログにはないが、関連の RN community discussion (#812) では **0.76 で iOS 15.1 へ引き上げ** が公式に確認されており、0.81 もその水準を維持。

引用元:
- https://reactnative.dev/blog/2025/08/12/react-native-0.81
- https://github.com/react-native-community/discussions-and-proposals/discussions/812

### 2.2 New Architecture (Fabric / TurboModules) 有効時のビルド差分

公式 (`reactnative.dev/docs/the-new-architecture/landing-page`) より:

- React Native **0.76 以降は New Architecture がデフォルト有効**。
- iOS で無効化したい場合: `Podfile` に `ENV['RCT_NEW_ARCH_ENABLED'] = '0'` を設定し `bundle exec pod install`。
- Android で無効化: `gradle.properties` の `newArchEnabled=false`。
- New Arch は同期 layout、React 18 concurrent renderer (Suspense / Transitions / 自動 batching)、JSI による高速 JS↔Native 通信を提供。
- パフォーマンスは即座に改善するわけではなく、リファクタが必要な場合あり、と公式が明記。

Seam への含意:
- Seam は New Architecture 有効想定なので、`RCT_NEW_ARCH_ENABLED=1` の Pods が生成される。Pod install のたびに対応 codegen が走るため、`pod install` のコストは増える。
- Hermes が既定で有効 (RN 0.81 / Expo SDK 54)。`NSCodeSigning` 観点で特別な entitlement は不要。

引用元:
- https://reactnative.dev/docs/the-new-architecture/landing-page

---

## 3. Apple 公式 (Free Apple ID / Personal Team)

### 3.1 Free Apple ID (Personal Team) の Provisioning 制限

Apple の公式 Help / Forum および React Native 周辺の二次ソースを総合すると:

- **Provisioning Profile の有効期限: 7 日間**(profile 作成時刻起算)。期限切れ後はアプリが起動しなくなる。
- **同時インストール可能アプリ数: 3** (SideStore 自身もこの 3 にカウントされる、SideStore FAQ 参照)。
- **App ID 登録上限: 10 / 7 日間**。週内に 11 個目の bundle ID を登録できない。

これは Apple 公式 (`developer.apple.com/support/compare-memberships/`) や Apple Developer Forum の複数スレッドで言及されているが、Apple 自身が明文の SLA として 1 ページにまとめている公式ドキュメントは見当たらない (公式ドキュメントに直接該当 ページなし。Forum 回答ベース)。

引用元:
- https://developer.apple.com/support/compare-memberships/
- https://developer.apple.com/forums/thread/49304
- https://developer.apple.com/forums/thread/669516
- https://developer.apple.com/forums/thread/797959
- https://news.ycombinator.com/item?id=36023322

### 3.2 Personal Team で使えない Capability

Apple Developer Forum (`forums/thread/718388`, `forums/thread/84144`) より、Free Apple ID の Personal Team に対して以下のメッセージが出力される:

```
Cannot create a iOS App Development provisioning profile for "[app-id]".
Personal development teams, including "[Developer Name]",
do not support the Push Notifications capability.
```

公式に明文化されていないが、Forum や Expo / Apple 周辺の二次ドキュメントによれば **Personal Team では以下が利用不可**:

- Push Notifications (APNs)
- iCloud (CloudKit / iCloud Documents)
- Associated Domains (Universal Links / web credentials)
- 一部の HealthKit / HomeKit / Sign in with Apple / Apple Pay / NFC 関連

Seam への含意:
- ローカル通知のみのため push capability は Bundle ID から除去する必要あり。
- iCloud / Associated Domains 等は Seam では不使用なので問題なし。

引用元:
- https://developer.apple.com/forums/thread/718388
- https://developer.apple.com/forums/thread/84144
- https://github.com/artsy/eigen/issues/2410

### 3.3 Xcode の Archive → Export Development 手順

Apple 公式 (`developer.apple.com/documentation/Xcode/distributing-your-app-to-registered-devices`) を踏まえた手順:

1. Xcode で対象 scheme を選び `Product → Archive`(Generic iOS Device 選択)。
2. Organizer ウィンドウで archive を選択し `Distribute App`。
3. `Custom` → `Development` (または `Release Testing`) を選ぶ。
4. 自分の Personal Team を選択。Provisioning は automatic で署名。
5. `Export` で `.ipa` を出力し、ローカル保存。

注意: Free Apple ID では `App Store Connect` / `TestFlight` / `Ad Hoc` 配布は不可。`Development` distribution のみ。

引用元:
- https://developer.apple.com/documentation/Xcode/distributing-your-app-to-registered-devices

### 3.4 Pairing File の概念 (Apple 観点)

Apple 公式に「Pairing File」という単独ドキュメントは見当たらないが、概念としては iOS デバイスを USB 経由で初めて Mac/PC に接続したときに `lockdownd` が生成する trust record (mobile device pairing record) で、`/var/db/lockdown/<UDID>.plist` 相当のもの。SideStore など 3rd party ツールが iOS デバイスと無線で `lockdownd` を喋るために必要。

公式ドキュメントに記載なし(Apple 内部仕様)。SideStore Docs と `idevice_pair` README が事実上の公開情報源。

---

## 4. SideStore 公式

### 4.1 概要 / 必要要件

SideStore Docs (`docs.sidestore.io`) と GitHub README より:

- **untethered, community-driven な altstore fork**。AltServer (PC 常駐) を不要にしている。
- 対応 iOS/iPadOS:
  - 15.0 - 15.8.6
  - 16.0 - 17.7.7
  - 18.0 - 26.x
- **最低 iOS 14**(GitHub README) だが、現行 docs では 15+ が main support。
- Mac/PC 側必須要件 (初回インストール時): USB ケーブル、Apple ID、`iloader` (公式インストーラ)。
- ライセンス: AGPLv3。最新 stable: **0.6.2** (2025-07-01)。0.6.0 は broken と公式マーク済み。
- StosVPN 統合、bulk source 追加、in-app markdown、証明書 import/export、iOS 17.4+ JIT サポート等が 0.6.2 の変更点。

引用元:
- https://docs.sidestore.io/docs/installation/install
- https://github.com/SideStore/SideStore
- https://github.com/SideStore/SideStore/releases

### 4.2 インストール手順 (iOS 18+ 想定)

公式 docs より:

1. **PC/Mac 側**
   - iPhone を USB で接続。
   - `iloader` を起動。
   - Apple ID でサインイン (Personal Team)。
   - デバイスを選択し `Install SideStore (Stable)` を実行。
2. **iPhone 側**
   - 設定 → 一般 → VPN とデバイス管理 で自身の Apple ID を信頼。
   - 設定 → プライバシーとセキュリティ → **Developer Mode を有効化** (iOS 16+ で必須)。
   - SideStore アプリを開いて Apple ID でサインイン。
   - VPN プロファイル(LocalDevVPN または StosVPN)を有効化。
   - `My Apps` の `7 DAYS` カウンタをタップして refresh が動くことを確認。

引用元:
- https://docs.sidestore.io/docs/installation/install

### 4.3 Pairing File の取得方法

公式 docs (`docs/advanced/pairing-file`, `docs/advanced/alternative`) より:

- SideStore は **`.mobiledevicepairing` ファイル** (古い版では `.plist`) のみ受け付ける。
- 取得手段:
  1. **`iloader`** で `Manage Pairing File → Place` (推奨。SideStore docs で第一選択)。
  2. **`jitterbugpair`**: macOS / Linux / Windows64 のバイナリ。USB 接続 + パスコード入力で `~/ALTPairingFile.mobiledevicepairing` を生成。AirDrop/iCloud 等で iPhone に転送。
  3. **`idevice_pair`** (Rust + egui, MIT, クロスプラットフォーム): `ALTPairingFile.mobiledevicepairing` を生成。Windows では iTunes、Linux では `usbmuxd` が前提。Developer Mode と SideStore 等のサイドロード済みアプリが事前条件。
- 引用: *"It is always recommended to zip your pairing file before transferring it."*(拡張子が `.txt` に化けるのを避けるため)。
- Pairing file は **iOS のアップデート/リセット時に失効する**。失効すると refresh が止まり、再生成 → 再インポートが必要。
- 引用: *"Apple's fault and there is nothing we can do to fix it."* (失効はランダムに発生することがあると公式が認めている)

引用元:
- https://docs.sidestore.io/docs/advanced/pairing-file
- https://docs.sidestore.io/docs/advanced/alternative
- https://github.com/jkcoxson/idevice_pair

### 4.4 `.ipa` のサイドロード手順

公式 Docs + 周辺記事より:

1. SideStore のインストール完了 + LocalDevVPN/StosVPN が ON の状態。
2. `.ipa` を iCloud Drive / Files App / AirDrop で iPhone に転送。
3. SideStore の `My Apps` タブを開き、左上の `+` をタップ。
4. ファイルピッカーで `.ipa` を選択 → 自動で resign + install。
5. ホーム画面にアプリが追加される。
6. 7 日カウンタが各アプリ毎に表示される。

注: 初回 SideStore 自体のインストールは PC 必須だが、**以降の `.ipa` サイドロードは iPhone 単体で完結**。

引用元:
- https://docs.sidestore.io/docs/installation/install
- (周辺記事) https://www.idownloadblog.com/2024/07/17/how-to-use-sidestore/

### 4.5 Refresh の仕組み / アプリ上限 / 有効期間

公式 FAQ (`docs.sidestore.io/docs/faq`) より:

- **Free Apple ID では同時 3 アプリまで(SideStore 自身を含む)**。
- **同一 7 日間に登録可能な App ID は 10 種類まで**。
- バックグラウンドで periodic refresh により 7 日間の development 証明書を再発行 → アプリの 7 日失効を防ぐ。
- 有料 Apple Developer Program ($99/年) なら 3 アプリ制限は撤廃され、有効期間 365 日に延長。
- iOS 17.4+ では SideStore 0.6.2 内蔵 JIT 機能、または StikDebug (旧 StikJIT) が必要。iOS 16 以下はアプリ長押しで JIT 化可。

Seam への含意:
- Seam (1 アプリ) + SideStore 本体 (1 アプリ) で 2 / 3 枠を消費する想定。残り 1 枠は AltStore 系の他アプリや LiveContainer 等のために残る。
- Seam は JIT 不要(Hermes 利用、ネイティブ JS executor)なので JIT 関連の制約は気にしなくて良い。

引用元:
- https://docs.sidestore.io/docs/faq

### 4.6 WireGuard / StosVPN / LocalDevVPN

公式 (`github.com/SideStore/StosVPN`, FAQ) より:

- 旧来 SideStore は **WireGuard tunnel** を利用してデバイス内ループバックで `lockdownd` 通信を hijack していた。
- **StosVPN** は SideStore チームが開発した代替 VPN クライアント。
  - 引用: *"A VPN for SideStore and StikJIT that is much more stable and supports offline JIT Enabling"*
  - Swift 99.8% / C 0.2% 構成、MIT License、SideStore オーガニゼーション管理。
  - WireGuard と異なり iOS 制限の影響を受けず、セルラー回線でも動作。
- **LocalDevVPN**: SideStore 0.6.x で導入された組み込みローカル VPN。WireGuard / StosVPN を別途インストールしなくても refresh が機能する。
- 一部のサードパーティ実装 (例: `xddxdd/sidestore-vpn`) は LAN 全体で SideStore refresh を可能にするゲートウェイ的役割。

Seam への含意:
- 自宅 WiFi だけで運用するなら LocalDevVPN だけで十分。外出先で refresh を回したい場合は StosVPN を併用すると安定する。
- Apple のローカル VPN 制限により、他の VPN プロファイル(社内 VPN など)と排他。Seam の運用上は問題なし。

引用元:
- https://github.com/SideStore/StosVPN
- https://docs.sidestore.io/docs/troubleshooting/common-issues
- https://docs.sidestore.io/docs/faq

### 4.7 Anisette サーバ

FAQ より:

- Apple ID 認証時に Apple サーバに送る anti-replay token (anisette) を中継するサーバ。SideStore は公式 anisette サーバまたはユーザがホストするものを利用可能。
- ログインエラーの主因は *"temporary Anisette server downtime"* と公式が記載。Apple ID ロック回避には自前ホストが推奨されることがある。
- 公式 docs 内に詳細な設定 UI 説明はあるが、本記事範囲では **「公式 anisette サーバが既定。トラブル時にカスタムサーバに切替」** と理解すれば良い。

引用元:
- https://docs.sidestore.io/docs/faq
- https://docs.sidestore.io/docs/troubleshooting/common-issues

### 4.8 共通トラブル

公式 (`docs/troubleshooting/common-issues`) より:

- AFC 接続失敗 → LocalDevVPN を試す、DNS ブロッカー無効化、再起動。
- インストールハング → キャッシュクリア、Anisette サーバ変更、`adi.pb` リセット、pairing file 再生成。
- 起動失敗 → iloader 経由で再インストール。最悪は SideStore とインストール済アプリ全削除 → 再 setup。
- nightly build は不安定。安定運用には stable を推奨。

引用元:
- https://docs.sidestore.io/docs/troubleshooting/common-issues

---

## まとめ: 実装計画への示唆

1. **Bundle ID と Capability を Personal Team 互換に整える**。
   - `app.json` の `ios.bundleIdentifier` は `com.sugarshin.seam` のままで OK。Personal Team は wildcard / 自由な reverse-DNS の bundle ID を扱える。
   - **expo-notifications の Push Notifications capability(APNs entitlement)を必ず除去する**。`aps-environment` が provisioning profile に乗ると Personal Team では「Push capability not supported」で署名失敗する。`app.json` から push 用 plugin オプションを外す or プロジェクトの `*.entitlements` から `aps-environment` を削除して、ローカル通知のみにする。
   - iCloud / Associated Domains / Sign in with Apple は Seam では未使用なので追加しない。

2. **Xcode から Archive → Export Development で `.ipa` を作るのが最も現実的**。
   - `cd packages/app && pnpm prebuild`(必要なら `--clean`)→ `xed ios` → Signing & Capabilities で **Personal Team を選択 + Automatic signing**。Bundle ID は SideStore でも使う `com.sugarshin.seam`(またはサイドロード専用に変えてもよい)。
   - `Product → Archive` → Organizer → `Distribute App → Custom → Development → Personal Team` → `Export` で `.ipa` 取得。
   - **`expo prebuild --clean` を再実行すると Xcode 側の手動編集 (signing team 選択) が消える**。`app.json` の `ios.developmentTeam` 等で再現できる範囲は config plugin 化し、それ以外は archive 直前に手動再設定する運用が必要。
   - `eas build --local` は Apple Developer Program なし運用での挙動が公式ドキュメントに明示されておらず、Free Apple ID 環境では Xcode archive のほうが安全。

3. **`.ipa` の SideStore 配布フロー**。
   - 初回のみ Mac で `iloader` を起動 → Apple ID サインイン → SideStore 本体を iPhone にインストール。
   - 同タイミングで `iloader` または `idevice_pair` で **`.mobiledevicepairing` を生成 → SideStore に取り込む**。失効を見越して生成手順をスクリプト化しておくと運用が楽。
   - iPhone 側で Developer Mode を有効化(iOS 18+)。
   - `Seam.ipa` を iCloud Drive にアップ → iPhone の SideStore で `My Apps → +` から選択 → 自動 resign + install。
   - 以後の更新は `.ipa` を入れ替えて同じ手順。SideStore は 7 日 refresh をバックグラウンドで自動実行。
   - **3 アプリ枠**は SideStore (1) + Seam (1) + 空き 1 で運用する。AltStore 等を入れない限り十分。

4. **monorepo 由来の落とし穴に備える**。
   - `packages/app/ios/` は prebuild 済みでコミット済の前提。**`pnpm install` の度に Pods をきれいにしたい場合は `cd packages/app/ios && pod install` を明示**。Expo SDK 54 + RN 0.81 の precompiled XCFrameworks を活かすため、`RCT_USE_PREBUILT_RNCORE=1` の設定で archive 時間を短縮できる。ただしこの flag は実験的で、Xcode 26 Beta では `SWIFT_ENABLE_EXPLICIT_MODULES=NO` の workaround が必要。
   - `pnpm-workspace.yaml` の isolation がビルド時の native 解決でトラブる場合は `nodeLinker: hoisted` も検討(SDK 54 の公式推奨フォールバック)。
   - Workspace alias (`@seam/domain`, `@seam/shared`) はソース直参照なので Pod 化されず、archive で特別なケアは不要。

5. **失効と再 sign の運用設計を最初に決める**。
   - Free Apple ID + SideStore 運用では「**7 日経つと開かなくなる、Pairing file が突然失効する**」のは仕様。Seam の起動時に「最後にデータエクスポートしたタイミング」を記録しておき、長期保管したい記録は JSON / CSV エクスポート(既に実装あり)で外部退避できる前提で UX を設計する。
   - VPN は LocalDevVPN を既定にし、外出先 refresh が不安定なら StosVPN を後付け。Anisette は公式サーバ既定で、ログイン詰まりが出たら別サーバに切替。
   - SideStore 0.6.2 は安定版だが、nightly や 0.6.0 系は避ける。`iloader` 経由で stable に固定。
