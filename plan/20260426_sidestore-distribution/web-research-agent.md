# SideStore 配布の実践調査

調査日時: 2026-04-26
対象: Seam (Expo SDK 54 / React Native 0.81.5 New Architecture / pnpm + Turborepo monorepo / 個人 iPhone 1台 / Free Apple ID / 日本在住)

---

## 概要

- SideStore は **AltStore のフォーク**で、初回 PC 1 回だけで以後 iPhone 単独で再署名できる仕組み。Free Apple ID で 7 日ごとの自動リフレッシュが可能。
- 2026-04 時点の最新は安定版 **0.6.2 (2025-07-01)**、ナイトリー **0.6.3-20260412.1002** (2026-04-12)。安定版は約 9 か月更新が止まっており、iOS 26 系では実質 **ナイトリー / Alpha が必須**。
- 旧来の AltServer + JitterbugPair から、新ツール **iloader (v2.2.4, Tauri/Rust 製, 2026-04-12)** に置き換わっており、PC 側の手順がだいぶ単純化されている。
- VPN は WireGuard が **deprecated** で **StosVPN** または **LocalDevVPN** に統一されつつある。
- **重要な転換点**: 2025-12-18 に **AltStore PAL が日本で正式ローンチ**。EU/日本ユーザーは Notarize 済み・期限なし・3アプリ制限なしで AltStore PAL を使える。ただし AltStore PAL は **「マーケットプレイス経由配布」前提**であり、未公開の自作アプリを Free Apple ID で焼くという用途では SideStore + Free Apple ID か AltStore Classic + 自前 IPA がやはり主流。
- **Seam にとっての結論**: New Arch + Hermes + expo-sqlite + expo-notifications (ローカルのみ) という構成は Free Apple ID + SideStore で動かせる範囲。ただし Hermes/JIT-less と SideStore の特殊なシナリオ(リフレッシュ連発で SideStore 自身が落ちる Issue が複数)、anisette 公衆サーバの落ちやすさ、7 日ごとのリフレッシュ運用に耐える必要あり。詳細は後述。

---

## 1. SideStore 現状

### 1.1 バージョン (2026-04 時点)

| チャネル | バージョン | 日付 | 出典 |
|---|---|---|---|
| Nightly | `0.6.3-20260412.1002+4deda922` | 2026-04-12 | [Releases](https://github.com/SideStore/SideStore/releases) |
| Alpha | `0.6.3-20260303.286+dfdac41a` | 2025-12-14 | 同上 |
| **Stable** | **`0.6.2`** | **2025-07-01** | 同上 |
| 0.6.1 | 0.6.1 | 2025-04-09 | 同上 |
| 0.6.0 | 0.6.0 | 2025-03-08 | **使うなと公式が警告** |

事実:
- 安定版 0.6.2 は AltStore 2.0 アップストリーム取り込み + iOS 17.4+ JIT 対応 + 証明書 import/export + WireGuard → StosVPN 移行 を含む大型リリース。
- 0.6.0 は明示的に "DO NOT use this build" と警告されている (release notes 公式)。
- 安定版が 9 か月更新されていないので、**iOS 18.6 以降や iOS 26 では事実上 Nightly を入れる方が問題が少ない** という傾向が複数のガイドで言及されている ([snip.hateblo.jp 2025-11-23](https://snip.hateblo.jp/entry/sidestore-ios26))。

### 1.2 iOS 対応

公式 docs ([Install](https://docs.sidestore.io/docs/installation/install)) で明記:
- **iOS 15.0 - 15.8.6** / **16.0 - 17.7.7** / **18.0 以降** すべて対応。
- iOS 16+ は Developer Mode をオンにする必要あり。
- iOS 17.4+ は Apple の制限変更で JIT を SideStore 単独で有効化できない → **StikDebug** (旧 StikJIT) または LocalDevVPN 経由 ([JIT docs](https://docs.sidestore.io/docs/advanced/jit))。
- iOS 26 では **JIT が再度壊された**。SideStore 内蔵 JIT が動くのは TXM 非対応 (≒ 4 年以上前) のデバイスのみ。新しい iPhone では JIT は事実上不可。
- **iOS 26.4 で refresh が壊れる Issue ([#1222, 2026-03-25](https://github.com/SideStore/SideStore/issues/1222))** が報告 → workaround あるが効かない人もいる。

推測: Seam は Hermes バイトコードで動くので **JIT 不要**。Hermes は AOT コンパイルだけで動く設計。したがって iOS 26 の JIT 問題は Seam には致命傷にならない (詳細後述)。

### 1.3 StikJIT / StosVPN / LocalDevVPN の関係

事実:
- **StosVPN** (旧 WireGuard 置き換え): SideStore 公式が用意する VPN。Swift 99% で実装、オフライン JIT 対応、WireGuard より安定とうたう ([StosVPN](https://github.com/SideStore/StosVPN))。**正式 release は未だ無い** (`There aren't any releases here`)。アプリは TestFlight 経由か iloader 経由で導入。
- **LocalDevVPN**: 同じく VPN だが App Store から普通に入る。最近のドキュメントは LocalDevVPN を第一推奨にしている。
- **StikDebug** (旧 StikJIT): JIT 有効化用ヘルパー。AltStore 公式ソースから入れる。pairing file を読み込ませて "Connect by App" で JIT を有効化する仕組み。
- バックグラウンドリフレッシュ: SideStore は **VPN を「自分は PC である」と iOS に思わせる** ことで、PC が常駐しなくても期限を再延長できる。VPN が切れているとリフレッシュは失敗する。
- 既知の不具合: StosVPN は **しばしば自動切断され、長時間バックグラウンド維持できない** ([Issue #1046, 2025-08](https://github.com/SideStore/SideStore/issues/1046), Issues タブのコメント)。

### 1.4 AltStore との違い

公式 [FAQ](https://docs.sidestore.io/docs/faq) と [iosgodsipa.pro 比較](https://iosgodsipa.pro/help/altstore-or-sidestore/) より:

| 項目 | AltStore Classic | SideStore | AltStore PAL (EU/日本) |
|---|---|---|---|
| 初期セットアップ PC | 必要 | 必要 (1 回のみ) | 不要 (Safari 経由) |
| 日常運用 PC | **常時必要** (refresh のたび) | **不要** (VPN で自走) | 不要 |
| anisette | AltServer がローカル生成 (Mac の Mail プラグイン経由) | **公衆サーバに依存** | 不要 (Apple Notarized) |
| 3 アプリ上限 (Free Apple ID) | あり | あり (LiveContainer で回避可) | **なし** |
| 期限 | 7 日 | 7 日 | **なし** |
| 日本対応 | OK (Free Apple ID) | OK | **2025-12-18 から OK** ([9to5Mac](https://9to5mac.com/2025/12/18/following-sweeping-app-store-changes-altstore-pal-launches-in-japan/)) |
| 自作 (未 Notarize) IPA | 可 | 可 | **不可** (Notarize 必須) |
| 安定性 | 成熟 | 実験的 (フォーク) | 成熟 |

重要: **AltStore PAL は「Notarize された開発者のアプリを配布する公式マーケットプレイス」**。Seam を **Apple に Notarize 申請せず個人 iPhone に焼く** 用途では、AltStore PAL は **使えない** と見るべき (詳細は §7)。

### 1.5 日本ユーザー固有の問題

事実:
- **Asia リージョンの anisette 公衆サーバは存在しない**: [Issue #453](https://github.com/SideStore/SideStore/issues/453) (2023-08, Closed as not planned)。日本ユーザーは欧米サーバに到達する必要がある。
- 公式登録 anisette サーバ 14 個 ([servers.json](https://github.com/SideStore/anisette-servers/blob/main/servers.json)): `ani.sidestore.io`, `ani.sidestore.app`, `ani.sidestore.zip`, `ani.846969.xyz`, `ani.npeg.us`, `5.249.163.88:6969` (HTTP のみ), `anisette.wedotstud.io`, `ani.xu30.top`, `ani.owoellen.rocks`, `ani.idevicehacked.com`, `ani.neoarz.com`, `ani3server.fly.dev`, `ani.jaydenha.uk`, `anisette.crystall1ne.dev`。
- 公衆 anisette が一斉に落ちる事象が定期的に発生 ([#432](https://github.com/SideStore/SideStore/issues/432), [#690](https://github.com/SideStore/SideStore/issues/690), [#567](https://github.com/SideStore/SideStore/issues/567))。落ちるとリフレッシュが完全に止まる。
- 日本ユーザー (snip.hateblo.jp、ichitaso.com) は **公衆 anisette サーバに到達できる** 旨をレポートしており、地理的ブロックはない。ただし **古い anisette サーバを使うと Apple ID がロックされる** リスクが docs に明記されている。
- 推測: 多用するなら **自前 anisette サーバを立てる** ([Dadoum/anisette-v3-server](https://github.com/Dadoum/anisette-v3-server)) のが堅い。Docker compose イメージあり ([V4NT-ORG](https://github.com/V4NT-ORG/my-SideStore-Anisette-docker-compose))。

---

## 2. Pairing File

### 2.1 用語と仕組み

`.mobiledevicepairing` (旧 `.plist`) は **iPhone と PC が信頼関係を結んだ証**。SideStore は実行中、これを iOS の usbmuxd エミュレートに使い、iPhone 自身に対して PC に成りすますことで再署名を通す。

事実 ([Pairing File docs](https://docs.sidestore.io/docs/advanced/pairing-file)):
- pairing file は **iOS アップデート / リセット / 不定期に勝手に失効** する → 失効したら作り直し → SideStore に再 import が必要。
- **iOS 17.4+ は RPPairing モード**、それ以前は Lockdown モードを使う。

### 2.2 pairing file の作り方 (macOS, 2026-04 時点の現実解)

**結論: jitterbugpair は古い。今は iloader か idevice_pair / iDevicePair を使う。**

- 公式推奨 (2026): **iloader を使う**。USB 接続するだけで pairing file の生成・転送・差し込みを自動でやる ([iloader v2.2.4](https://github.com/nab138/iloader)、[iloader.site](https://iloader.site/))。macOS 10.15+ なら usbmuxd は OS 内蔵。
- 代替手動: **iDevicePair** (`iDevicePair--macos-universal.dmg`) GUI ツール ([techybuff.com 2025](https://techybuff.com/idevice-pair-generate-pairing-file/))。
- 旧来: `jitterbugpair-macos.zip` ([osy/Jitterbug](https://github.com/osy/Jitterbug/releases))。CLI で `jitterbugpair` を実行すると `<UDID>.mobiledevicepairing` がカレントディレクトリに出る。Sonoma/Sequoia 互換の明示的な情報は乏しいが、依存ライブラリ (`brew install meson openssl@1.1 libusbmuxd libimobiledevice pkg-config`) を入れた上でビルドすれば動く実例あり。

iloader を使う場合の手順 (Seam 推奨):
1. `iloader-x.y.z.dmg` を [GitHub releases](https://github.com/nab138/iloader/releases) からダウンロード。
2. iPhone を USB 接続、`Trust This Computer` をタップ。
3. iloader を起動 → Apple ID でサインイン (大文字小文字注意)。
4. デバイスを選択 → "Install SideStore (Stable)" or "Install LiveContainer + SideStore"。
5. iloader が pairing file の生成・配置を自動で行う。
6. iOS 側で Settings → General → VPN & Device Management で開発者証明書を Trust。
7. iOS 16+ なら Settings → Privacy & Security → Developer Mode を ON。

### 2.3 SideStore に渡す方法

事実 ([Pairing File docs](https://docs.sidestore.io/docs/advanced/pairing-file)、[snip.hateblo.jp](https://snip.hateblo.jp/entry/SideStore)):

iloader を使う限り **転送は不要**。手動で渡す場合は:
- **iCloud Drive** が最推奨 (拡張子が壊れにくい)。Windows ユーザーは特に。
- **AirDrop / メール添付**: 拡張子が `.txt` に化けたり `.mobiledevicepairi` に切れたりする → **必ず zip にしてから送る** (snip.hateblo.jp 追記)。
- 受信した iPhone 側で Files → On My iPhone → SideStore に置き、SideStore を起動して `ALTPairingFile.mobiledevicepairing` を読み込ませる。

---

## 3. `.ipa` ビルド

### 3.1 大前提

事実:
- **Free Apple ID + Personal Team では Xcode の Distribute App から App Store / Ad Hoc / Enterprise いずれも選べない**。Personal Team は Development 署名しか発行できない ([Apple Developer Forums #102272](https://developer.apple.com/forums/thread/102272)、[Apple Community 255781574](https://discussions.apple.com/thread/255781574))。
- ただし **SideStore は Personal Team で Development 署名された IPA でも、自分で再署名するから OK**。SideStore に渡す IPA は **未署名 / 自己署名 / 任意の署名** で良い。実際の署名は SideStore 側でユーザー Apple ID + Personal Team を使って **iPhone 上で再生成** する。
- これが SideStore 配布の肝。**「Distribute できないエラー」は回避というより「そもそも Distribute から IPA を作る必要がない」** が正解。

### 3.2 推奨手順 (Seam の場合)

#### 手順 A: Xcode の Archive → Organizer から手動で .ipa を作る (簡単)

1. `cd packages/app && pnpm prebuild` で `ios/` を生成 (CNG 構成)。
2. `cd ios && pod install`。pnpm + workspace の場合 `node_modules` の解決が monorepo ホイストで壊れることがある — RN 0.81+ は Hermes / RN ヘッダ参照が壊れやすい。`packages/app/ios/.xcode.env` 等で `NODE_BINARY` を絶対パスにする、もしくは `expo-build-properties` に `useFrameworks: 'static'` などを設定 ([medium.com Shanavas Shaji](https://medium.com/@shanavascruise/new-architecture-by-default-hermes-ios-expo-updates-can-break-your-ios-builds-4e98d89a1648))。
3. `xed ios` で Xcode を開く。
4. Project → Signing & Capabilities → Team を **Personal Team (Free)** に変更 ([fyi/setup-xcode-signing.md](https://github.com/expo/fyi/blob/main/setup-xcode-signing.md))。
5. Bundle Identifier を **既に他のアプリで使っていない、グローバルに一意な値** にする。Free Apple ID は **7 日に 10 個までしか App ID を作れない** ため使い回し推奨。
6. Scheme を Release に変更 (Edit Scheme → Run → Build Configuration: Release)。
7. Destination を **Any iOS Device (arm64)** に設定。
8. Product → Archive。
9. Organizer で対象 archive を選択 → **Distribute App は使わない**。代わりに右クリック → "Show in Finder" → `.xcarchive` を表示 → Show Package Contents。
10. `Products/Applications/<App>.app` を取り出す。
11. デスクトップに `Payload/` フォルダを作り、中に `<App>.app` を入れて zip 圧縮 → 拡張子を `.ipa` に変更 ([magnetar Medium 2019](https://medium.com/m%CE%BBgn%CE%BEt%CE%BBr/how-to-export-a-ipa-file-from-xcode-without-a-dev-account-bac8b2645ad3)、[bakhoang Medium 2019](https://medium.com/@bakhoang/how-to-build-ipa-file-without-apple-developer-account-be0910c005a0))。

これが **Free Apple ID で .ipa を作る古典的な抜け道**。SideStore に渡せば再署名されるので、署名状態は問題にならない。

#### 手順 B: xcodebuild で CLI ビルド (再現性高い)

ベース: [ajpagente xcb-with-xcconfig](https://ajpagente.github.io/mobile/xcb-with-xcconfig/)、[Francesco149 gist](https://gist.github.com/Francesco149/a050b4637d8ea1b4e76ccccda68490b2)、[smartbear blog](https://smartbear.com/blog/tips-on-how-to-archive-and-export-ipa-from-script/)。

```sh
# 1) prebuild
pnpm --filter @seam/app prebuild

# 2) Pods
cd packages/app/ios
pod install

# 3) Archive
xcodebuild \
  -workspace Seam.xcworkspace \
  -scheme Seam \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath build/Seam.xcarchive \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=<YOUR_PERSONAL_TEAM_ID> \
  -allowProvisioningUpdates \
  archive

# 4) export は使わずに .xcarchive から手動で IPA を作る
mkdir -p build/Payload
cp -R build/Seam.xcarchive/Products/Applications/Seam.app build/Payload/
(cd build && zip -r Seam.ipa Payload/)
```

Personal Team ID の取得は [Francesco149 の `xcodeteam.sh`](https://gist.github.com/Francesco149/a050b4637d8ea1b4e76ccccda68490b2) または `security find-identity -p codesigning -v` で `Apple Development: ...` の OU を見る。

`-allowProvisioningUpdates` は **Free Apple ID の Personal Team でも provisioning profile を自動更新できるようにするフラグ**。これがないと CLI では Personal Team 署名が通らない実例が多数 ([testdevlab 2024](https://www.testdevlab.com/blog/xcode-provisioning-profile-automation-for-ci))。

注意: `-exportArchive -exportOptionsPlist` で IPA を出そうとすると、Personal Team では `method` を `development` にしても **「No iOS Distribution signing certificate matching team ID」** で落ちる。手動 zip 方式で回避するのが現実解。

### 3.3 Expo / RN 0.81 / SDK 54 の罠

事実 ([Expo issue #41824](https://github.com/expo/expo/issues/41824)、[Migrating to RN 0.82 dev.to 2025](https://dev.to/haider_mukhtar/migrating-to-react-native-082-unlocking-the-full-power-of-the-new-architecture-in-expo-apps-2ca7)):

1. **New Architecture + Hermes + iOS で、起動直後にクラッシュする** Expo SDK 54 系の既知問題が複数報告。Expo SDK 54 はこの組み合わせがデフォルトなので、**SDK 54.0.x の最新パッチに上げる** + `expo-doctor` でチェックすること。
2. **`useFrameworks: 'static'` と Hermes の組み合わせで起動クラッシュ** ([Expo issue #19517](https://github.com/expo/expo/issues/19517))。`expo-build-properties` で明示しない限り問題ないが、Pods 解決で迷ったときに `static` を指定して直そうとすると別の地雷を踏むことがある。
3. **CocoaPods Xcode 16 の互換性**: Xcode 16 + CocoaPods 1.15+ は依存解決が厳格。`pod install --repo-update` を打つ、`pod cache clean --all`、`pod install --verbose` で原因を見る。
4. **Updates.reloadAsync() が iOS 起動直後にクラッシュ** ([Expo issue #21347](https://github.com/expo/expo/issues/21347)) — workaround は `expo-updates` の disabled or 起動から少し遅らせる。
5. **`Skip Install = NO` を Release に設定** しないと Archive しても Organizer に出ない ([RN issue #34673](https://github.com/facebook/react-native/issues/34673))。
6. **pnpm workspace + RN 0.81**: `node_modules` ホイストで RN 内部の `Pods` の `HEADER_SEARCH_PATHS` 解決が壊れることがある。回避策は `packages/app/.npmrc` に `node-linker=hoisted` または `public-hoist-pattern[]=*react-native*`。
7. **Hermes は JIT なし** で動く AOT 設計 ([reactnative.dev/docs/hermes](https://reactnative.dev/docs/hermes)、[heartit.tech 2025](https://heartit.tech/react-native-jsi-deep-dive-part-1-the-runtime-you-never-see/))。SideStore で JIT 有効化が出来なくても **Hermes アプリは動く**。これは Seam にとって追い風。

### 3.4 New Architecture 有効時の追加ステップ

- `app.json` の `experiments.newArchEnabled` および `expo-build-properties` の `ios.newArchEnabled: true` を確認 ([Expo new-architecture docs](https://docs.expo.dev/guides/new-architecture/))。
- `RCT_NEW_ARCH_ENABLED=1` 環境変数で `pod install` し直す。
- Pods 再生成: `cd packages/app/ios && rm -rf Pods Podfile.lock && pod install`。
- New Arch では一部サードパーティが非対応 (`@react-native-community/clipboard` 等は別 lib に置換)。`npx expo-doctor@latest` でチェック。Seam の依存 (expo-sqlite, expo-notifications, expo-secure-store, expo-image-picker) は **すべて Expo 公式で New Arch 対応済み**。

### 3.5 pnpm workspace での Pods 解決

- `pod install` 中の依存解決は `node_modules/` 経由で行うため、pnpm の symlink が React Native CLI から見えないことがある。
- 推奨設定: `packages/app/.npmrc` に `node-linker=hoisted` を入れて従来の `node_modules` レイアウトに近づける。
- `metro.config.js` で `watchFolders` に monorepo root を追加し、`resolver.nodeModulesPaths` を明示。
- これは `@seam/domain` `@seam/shared` を `./src/index.ts` 直接参照しているプロジェクト方針と整合。`tsconfig` の paths はビルド時には Babel が解決するので、ネイティブビルドには影響しない。
- 推測: Seam は既に `Metro + tsconfig paths` を整えているので、Pods 解決で詰まる確率は低い。問題が起きるとしたら **Node の絶対パスがハードコードされた `.xcode.env.local`** が他人の機械で動かない、というレベル。

---

## 4. SideStore へのインストール

### 4.1 IPA を iPhone の SideStore に渡す方法

事実 ([Install docs](https://docs.sidestore.io/docs/installation/install)、複数の日本語ガイド):

- **iCloud Drive 経由** (推奨): macOS で iCloud Drive にコピー → iPhone の Files → On My iPhone → SideStore に移動。
- **AirDrop**: macOS から直接 iPhone へ。受信時に "Open in" → SideStore を選ぶ。
- **直接 URL**: SideStore は HTTPS URL からの IPA 取得に対応 (Sources 機能)。GitHub Releases や自分のサーバに上げて URL を SideStore に登録する方式が拡張性高い。
- iPhone 側で SideStore を開き → My Apps タブ → "+" → IPA を選択。
- 直後に "Keep App Extensions (Use Main Profile)" / "Remove App Extensions" を聞かれる。**Seam は extension を使っていないので "Use Main Profile" 推奨** (もう一つの選択は Roxas.framework クラッシュの原因になったことがある [Issue #861](https://github.com/SideStore/SideStore/issues/861))。

### 4.2 Free Apple ID の上限と影響

事実 ([SideStore FAQ](https://docs.sidestore.io/docs/faq)、[techybuff 2025](https://techybuff.com/bypass-three-app-limit-with-sidestore-2025/)):

| 制限 | 値 | Seam への影響 |
|---|---|---|
| 同時インストール App ID 数 | **3** (SideStore 自身を含む) | SideStore + StikDebug + Seam = ちょうど 3。余裕なし。 |
| 7 日間あたりの App ID 登録上限 | **10** | 開発中に頻繁にビルドし直すと枯れる。Bundle ID を固定すれば 1 個しか消費しない。 |
| 10 デバイス制限 | 7 日に 10 device | 個人 1 台なら無関係。 |
| アプリ証明書期限 | **7 日** | 7 日に 1 回 SideStore で refresh が必要。 |

回避策:
- **LiveContainer**: 1 アプリの中で他のアプリを実行する仕組み。LiveContainer をホストにすれば、その中で動くアプリは App ID を消費しない → **3 アプリ制限を実質撤廃** ([snip.hateblo.jp LiveContainer ガイド](https://snip.hateblo.jp/entry/SideStore-LiveContainer))。Seam を LiveContainer の中で動かすことも理論上は可能だが、ネイティブ機能 (expo-sqlite の sandbox、photo library アクセス、SecureStore Keychain) との互換は要検証。
- **AltStore PAL** (日本ローンチ済み): 上限なし。ただし Notarize 必須なので Seam 用途には不適。
- **$99/年 Apple Developer Program 加入**: 上限解消 + 365 日期限。本格運用に近づくならこれが王道。

### 4.3 7 日リフレッシュが確実に走る条件

事実 ([JIT docs](https://docs.sidestore.io/docs/advanced/jit)、[StosVPN issues](https://github.com/SideStore/StosVPN/issues)):

成功条件:
1. iPhone が **Wi-Fi 接続**。
2. **LocalDevVPN または StosVPN がアクティブ**。
3. SideStore の **Background App Refresh が ON**。
4. SideStore に **有効な pairing file** が読み込まれている。
5. **anisette サーバが疎通可能**。
6. iPhone のロック解除中もしくは Background Refresh の Apple 側 daemon が動くタイミングを引ける。

リフレッシュ失敗の頻発パターン:
- StosVPN のバックグラウンド切断 ([Issue #1046](https://github.com/SideStore/SideStore/issues/1046))。
- anisette サーバの一時停止 ([#432](https://github.com/SideStore/SideStore/issues/432) [#690](https://github.com/SideStore/SideStore/issues/690))。
- pairing file の自然失効 (iOS アップデート / リセット)。
- iOS 26.4 での refresh 不可 ([#1222](https://github.com/SideStore/SideStore/issues/1222))。

実用上の運用パターン (snip.hateblo.jp、Zenn ryuya0124):
- **iOS Shortcuts で週 1 回 SideStore を起動する自動化** を作る。例: 毎週土曜 4:00 に Shortcut が SideStore を開く → SideStore が起動時にバックグラウンド refresh をキック。
- 手動: Home → SideStore → My Apps → "7 DAYS" タップ → Refresh All。

JIT 必要性: **Seam は Hermes ベース なので JIT 不要**。StikDebug の手動起動は不要。LocalDevVPN だけ動いていればよい。

---

## 5. 既知の落とし穴

### 5.1 SideStore 自身のリフレッシュ起因クラッシュ

- [Issue #623 (2024-05, Closed)](https://github.com/SideStore/SideStore/issues/623): Refresh All の途中で SideStore がクラッシュする。1 個ずつ refresh する workaround あり。
- [Issue #711](https://github.com/SideStore/SideStore/issues/711): self-refresh 後に SideStore が起動しなくなる。
- [Issue #861 (2024)](https://github.com/SideStore/SideStore/issues/861): "Remove App Extensions" を選ぶと Roxas.framework のコード署名が破損して起動不可。**"Keep App Extensions (Use Main Profile)" を選ぶこと**。
- [Issue #493](https://github.com/SideStore/SideStore/issues/493): SideStore のホーム画面ウィジェットがあると refresh 後にクラッシュ → **ウィジェットを使わない**。0.6.3 nightly で widget 修正が入ったとのこと (release notes)。

### 5.2 Expo / RN 特有

事実 + 推測:
- **Hermes + New Arch + iOS の起動クラッシュ** (Expo issue #41824): 該当する SDK パッチが当たっているか確認。
- **大きい IPA**: Hermes + New Arch + Expo modules の static 構成だと IPA が 50-80 MB になる。SideStore 側のサイズ制限は明示されていないが、転送は遅い。500 MB 以上の事例で apt の `[BUG] install fail` を踏んだという確証ある記事は見つからなかった (推測: 数百 MB 程度なら問題ない)。
- **expo-notifications**: Free Apple ID は `aps-environment` entitlement を持たないので **リモートプッシュは不可**。Seam は **ローカル通知のみ** なので問題なし。`UNUserNotificationCenter` だけ使う設計は Free Apple ID + SideStore で動く。
- **expo-sqlite**: アプリの sandbox 内 (`Library/LocalDatabase/` または `documents/`) に保存される。SideStore による refresh は **既存のアプリ Bundle 上に再署名** するだけで、**Sandbox は壊さない**。実例ベースで「refresh で SQLite が消える」現象は確認できなかった。ただし Bundle ID が変わると Sandbox 単位が変わるので **Bundle ID は絶対に固定**。
- **expo-secure-store (Keychain)**: Keychain Access Group が App Group ID にひもづく。Personal Team の App ID は Team ID プレフィックスが付くので、別の Apple ID で再署名すると **Keychain にアクセスできなくなる**。同じ Apple ID を使い続ければ問題ない。
- **expo-image-picker**: NSPhotoLibraryUsageDescription / NSCameraUsageDescription が Info.plist に必要。Personal Team 署名でもこれらは普通に動く。

### 5.3 リフレッシュ後に起動しなくなる系

- 上記 #861 の Roxas.framework 問題が代表例。
- 別ケース: 0.6.0 の migration バグ (release notes で警告)。
- 推奨: **0.6.2 stable または 0.6.3 nightly を使い、0.6.0 を絶対に経由しない**。

### 5.4 iOS バージョン依存

| iOS | 状態 |
|---|---|
| 15-16 | 安定 |
| 17.0-17.3 | 安定 (JIT は SideJITServer 必須、ただし Seam では不要) |
| 17.4-17.7 | 安定 (StikDebug 推奨、ただし Seam では不要) |
| 18.0-18.6 | 安定 (Developer Mode 必須) |
| 18.7+ | 動く (snip.hateblo.jp 確認済) |
| 26.0-26.3 | 動く (LocalDevVPN 経由)、JIT は古いデバイスのみ |
| **26.4** | **refresh が壊れている [#1222]** |

### 5.5 anisette サーバ問題

- 公衆 anisette サーバはたびたびダウン → refresh 不能。
- 古い anisette サーバを使うと Apple ID が一時ロック ([#567](https://github.com/SideStore/SideStore/issues/567))。
- 対策: SideStore Settings → Anisette Server を v3 系の生きているサーバに変える。**理想は自前 (`Dadoum/anisette-v3-server` を Render/Fly.io にデプロイ)**。

---

## 6. 日本ユーザーの実例

### 6.1 主要な日本語記事

| 媒体 | 記事 | 日付 | 注目点 |
|---|---|---|---|
| 昨日より1mm進化するための備忘録 | [SideStoreのインストール方法](https://snip.hateblo.jp/entry/SideStore) | 2025-04-23 (更新 2025-11-23) | iPhone 16 / iOS 18.4 で実機検証。AltServer Windows 11 で動かない事象。 |
| 同上 | [iOS 26向けSideStore 最新インストール](https://snip.hateblo.jp/entry/sidestore-ios26) | 2025-11-23 (更新 2025-12-19) | iOS 26 + iPhone 16 で動作確認。StikDebug → LocalDevVPN への移行を解説。 |
| 同上 | [SideStore × LiveContainer で 3 アプリ制限突破](https://snip.hateblo.jp/entry/SideStore-LiveContainer) | (具体的日付不明、2025) | LiveContainer 構成の利点。 |
| Zenn (ryuya0124) | [iPadでLiveContainer+SideStoreを使いサイドロード](https://zenn.dev/ryuya0124/articles/3d0e1e2f10fdcc) | 2025-09-21 (更新 2025-12-31) | iPad で実機検証。Windows 11 AltServer 不調 → Sideloadly か macOS 推奨。**サイドロード専用 Apple ID を別途作るべき**と明記。 |
| Will feel Tips (ichitaso) | [SideStore - iPhone 単体でSideloadアプリの署名](https://ichitaso.com/iphone/how-to-use-sidestore/) | (取得失敗、ただし検索結果に掲載) | iPhone 単独運用の利点を解説。 |
| sp7pc.com | [SideStoreのインストール方法](https://sp7pc.com/apple/ios/72161) | 2024-2025 | 一般読者向け。 |

### 6.2 日本ユーザーが anisette で困った事例

- 日本語記事内では **公衆 anisette サーバ (ani.sidestore.io) が普通に通る** という実体験が大半。地域ブロックは確認されていない。
- ただし全 anisette が一斉ダウンする時間帯があり、**そのときに Apple ID Login がループする** 事象が報告 (snip.hateblo.jp の "解決方法" セクション)。対処は別の anisette を試すか、時間を置いて再試行。

### 6.3 「無料で永続的に iPhone に焼き続ける」現状のベスト構成 (2026-04 時点)

複数の日本語ガイドと公式 docs を総合した推奨スタック:

```
[ macOS 13+ ]
   └─ iloader v2.2.4 で SideStore Stable 0.6.2 をインストール
        └─ pairing file は iloader が自動で生成・iPhone に転送

[ iPhone (iOS 17.x or 18.x or 26.x except 26.4) ]
   ├─ LocalDevVPN (App Store 無料) — 常時 ON でもバッテリ影響軽微
   ├─ SideStore — 自分の Apple ID でサインイン
   │     └─ Settings → Anisette → ani.sidestore.io か自前
   ├─ (任意) StikDebug — JIT が必要なアプリ用 (Seam 不要)
   ├─ (任意) LiveContainer — 3 アプリ制限を回避したい場合
   └─ Seam.ipa — SideStore で再署名済み、7 日ごとに自動 refresh

[ 自動化 ]
   └─ iOS Shortcuts で週 1 回 SideStore を開く自動化
```

専用 Apple ID を 1 個作る (普段使いと分離する) のが日本語ガイドの**共通推奨**。

---

## 7. AltStore 比較

### 7.1 AltStore PAL (日本) は Seam に使えない

事実 ([9to5Mac 2025-12-18](https://9to5mac.com/2025/12/18/following-sweeping-app-store-changes-altstore-pal-launches-in-japan/)、[MacRumors 2025-12-18](https://www.macrumors.com/2025/12/18/altstore-japan-launch/)):

- 2025-12-18 から **iOS 18.0+ で日本 App Store アカウント保有者** は AltStore PAL を Safari からインストール可能。
- **物理的に日本にいる必要あり** (位置情報判定)。
- 期限なし、3 アプリ制限なし、Apple Notarize 済み。
- **配布できるのは Apple Notarize を通過した開発者のアプリのみ** = AltStore 経由のマーケットプレイスに登録済みアプリだけ。
- **未登録 / 未 Notarize の自作 IPA を直接焼くことはできない**。
- 開発者ライセンス: AltStore PAL 経由で配布するには **EU/日本のデベロッパー登録** + Apple の Core Technology Fee (CTF) または公益免除申請が必要。**個人 1 台で身内利用** という Seam の用途には完全に過剰。

結論: AltStore PAL は **「合法な代替マーケット」** として有用だが、**Seam の自作 IPA を焼く目的には使えない**。

### 7.2 AltStore Classic vs SideStore (Free Apple ID + 自作 IPA 用途)

ベース: [AltStore FAQ](https://faq.altstore.io/altstore-classic/your-altstore)、[iosgodsipa 比較](https://iosgodsipa.pro/help/altstore-or-sidestore/)、[ios18apps.com altstore-vs-sideloadly-vs-sidestore](https://ios18apps.com/altstore-vs-sideloadly-vs-sidestore/)。

| 観点 | AltStore Classic | SideStore | Seam にとっての影響 |
|---|---|---|---|
| 必要 PC | **常時必要** (refresh のたび AltServer 起動) | 初回のみ | SideStore 圧勝 |
| Mac 24/7 起動 | 必要 (毎週の自動 refresh) | 不要 | SideStore 圧勝 |
| anisette | ローカル生成 (Mac の Mail プラグイン経由) | 公衆サーバ依存 | AltStore は外部依存ゼロで安定 |
| 安定性 | 成熟、バグ少 | 実験的、不具合多 | AltStore 有利 |
| 日本対応 | OK | OK | 同等 |
| 開発活発度 | やや停滞 (PAL 注力) | 活発 | SideStore 有利 |
| LiveContainer 対応 | △ | ◎ | SideStore 有利 |
| 7 日 refresh 実行 | Mac 経由 | iPhone 単独 | 開発機 (Mac) を毎日触るなら AltStore も実用的 |

### 7.3 推奨判断

- **開発用 Mac を毎日起動して使うなら AltStore Classic** が安定で楽 (anisette を自分の Mac が生成するので外部障害ゼロ)。
- **iPhone を持ったまま外出して 1 週間 Mac に触らない可能性があるなら SideStore** (Mac 不要)。
- Seam は **個人開発** で開発機が日々動いているはずなので、**「初期は AltStore Classic で開発体験を安定化、必要になったら SideStore に移行」** が現実的。両者は IPA 形式が同じなので乗り換えコストは低い。

---

## 結論：Seam 配布に推奨する手順骨子

### Phase 0: 前提準備 (1 回だけ、所要 30-60 分)

1. **専用 Apple ID** を 1 個作る (本番アカウントと分離。日本語ガイドで共通推奨)。
2. iPhone を iOS 18.6 以降に上げる (26.4 は避ける)。
3. iPhone で Settings → Privacy & Security → Developer Mode を ON。
4. macOS で [iloader v2.2.4 dmg](https://github.com/nab138/iloader/releases) をダウンロード。
5. iPhone を USB 接続 → iloader 起動 → 専用 Apple ID でサインイン → "Install SideStore (Stable 0.6.2)" を実行。
6. iPhone: Settings → General → VPN & Device Management で開発者証明書を Trust。
7. iPhone: App Store から **LocalDevVPN** をインストールし接続。
8. iPhone: SideStore を開き、専用 Apple ID でサインイン → My Apps の "7 DAYS" をタップで初回 refresh。

### Phase 1: Seam の IPA を作る (リリースのたびに繰り返し、所要 5-15 分)

1. `pnpm install`
2. `pnpm --filter @seam/app prebuild`
3. `cd packages/app/ios && pod install`
4. `xed .` で Xcode を開く。
5. プロジェクト → Signing & Capabilities → Team を Personal Team に設定。
6. Bundle Identifier を **二度と変えない値に固定** (例: `dev.shingosato.seam`)。
7. Scheme: Release / Destination: Any iOS Device (arm64)。
8. `Skip Install = NO` を Release で確認。
9. Product → Archive。
10. Organizer で `.xcarchive` を Show in Finder → Show Package Contents → `Products/Applications/Seam.app`。
11. ターミナル:
    ```sh
    cd /tmp && rm -rf Payload && mkdir Payload
    cp -R "/path/to/Seam.xcarchive/Products/Applications/Seam.app" Payload/
    zip -r Seam.ipa Payload/
    ```
12. 出来た `Seam.ipa` を AirDrop か iCloud Drive で iPhone へ。

### Phase 2: SideStore に流し込む (所要 1-2 分)

1. iPhone の Files → SideStore フォルダに `Seam.ipa` を置く。
2. SideStore → My Apps → "+" → `Seam.ipa` を選択。
3. "Keep App Extensions (Use Main Profile)" を選択 (Roxas クラッシュ回避)。
4. 数秒〜十数秒で Home に Seam アイコンが現れる。

### Phase 3: 7 日ごとの運用

- iOS Shortcuts で **毎週土曜 4:00 に SideStore を開く** Automation を作成 (画面ロック解除前提なので、深夜 1 度ロック解除する瞬間に走るとベター)。
- バッテリ設定: SideStore と LocalDevVPN を **Background App Refresh ON** + 低電力モード OFF にする。
- pairing file が失効したら iloader を Mac で起動して "Manage Pairing File" → "Place" で再注入。
- anisette が落ちて refresh 失敗したら SideStore Settings → Anisette Server を別サーバに切替。
- IPA のバージョンアップは Phase 1 を再実行 → Phase 2 で同じ Bundle ID で上書き install (DB と Keychain は残る)。

### リスクと推奨運用ルール

- **Bundle ID は不変**: SQLite と Keychain と Photo paths を保持するため。
- **App ID 上限 (10/週)** を消費するので、開発中は Bundle ID を変えない。
- **0.6.0 / iOS 26.4 を避ける**。
- **ウィジェットを使わない** (#493 回避)。
- **Refresh は 1 個ずつ** (#623 回避、ただし 0.6.2+ では改善されている可能性)。
- **Mac を毎日起動するなら AltStore Classic も検討する余地あり** (anisette 安定性で勝る)。

### 想定される落とし穴 (発生時の備え)

1. **Hermes + New Arch 起動クラッシュ**: SDK 54 の最新パッチに上げる ([Expo #41824](https://github.com/expo/expo/issues/41824))。
2. **anisette 一斉ダウン**: 自前 anisette ([Dadoum/anisette-v3-server](https://github.com/Dadoum/anisette-v3-server)) を Fly.io 等にデプロイ。
3. **iOS アップデートで pairing file 失効**: iloader で再生成。
4. **専用 Apple ID 一時ロック**: 古い anisette サーバを使ったときに発生しがち。最新サーバに切替。
5. **SideStore 自身が壊れた**: iloader → "Install SideStore" で上書き再インストール。

---

## 参考ソース

| # | ソース名 | URL | 取得方法 | 信頼性 |
|---|---|---|---|---|
| 1 | SideStore Releases | https://github.com/SideStore/SideStore/releases | WebFetch | 高 |
| 2 | SideStore Docs - FAQ | https://docs.sidestore.io/docs/faq | WebFetch | 高 |
| 3 | SideStore Docs - Install | https://docs.sidestore.io/docs/installation/install | WebFetch | 高 |
| 4 | SideStore Docs - Pairing File | https://docs.sidestore.io/docs/advanced/pairing-file | WebFetch | 高 |
| 5 | SideStore Docs - Prerequisites | https://docs.sidestore.io/docs/installation/prerequisites | WebFetch | 高 |
| 6 | SideStore Docs - JIT | https://docs.sidestore.io/docs/advanced/jit | WebFetch | 高 |
| 7 | SideStore Docs - Common Issues | https://docs.sidestore.io/docs/troubleshooting/common-issues | WebFetch | 高 |
| 8 | SideStore Docs - Error Codes | https://docs.sidestore.io/docs/troubleshooting/error-codes | WebFetch | 高 |
| 9 | SideStore Docs - Release Notes | https://docs.sidestore.io/docs/release-notes | WebFetch | 高 |
| 10 | StosVPN | https://github.com/SideStore/StosVPN | WebFetch | 高 |
| 11 | StosVPN Releases | https://github.com/SideStore/StosVPN/releases | WebFetch | 高 |
| 12 | SideStore anisette-servers | https://github.com/SideStore/anisette-servers | WebFetch | 高 |
| 13 | servers.json | https://github.com/SideStore/anisette-servers/blob/main/servers.json | WebFetch | 高 |
| 14 | iloader README | https://github.com/nab138/iloader | WebFetch | 高 |
| 15 | iloader.site | https://iloader.site/ | WebFetch | 中 |
| 16 | Issue #1046 (StosVPN refresh) | https://github.com/SideStore/SideStore/issues/1046 | WebFetch | 高 |
| 17 | Issue #623 (Refresh crash) | https://github.com/SideStore/SideStore/issues/623 | WebFetch | 高 |
| 18 | Issue #861 (Roxas crash) | https://github.com/SideStore/SideStore/issues/861 | WebFetch | 高 |
| 19 | Issue #1222 (iOS 26.4 bug) | https://github.com/SideStore/SideStore/issues/1222 | WebFetch | 高 |
| 20 | Issue #453 (Asia anisette) | https://github.com/SideStore/SideStore/issues/453 | WebFetch | 高 |
| 21 | Issue #233 (Modify Bundle ID) | https://github.com/SideStore/SideStore/issues/233 | WebFetch | 高 |
| 22 | Issue #147 (mobiledevicepairing) | https://github.com/SideStore/SideStore/issues/147 | WebFetch | 高 |
| 23 | snip.hateblo.jp - SideStore 基本 | https://snip.hateblo.jp/entry/SideStore | WebFetch | 中 |
| 24 | snip.hateblo.jp - iOS 26 | https://snip.hateblo.jp/entry/sidestore-ios26 | WebFetch | 中 |
| 25 | snip.hateblo.jp - LiveContainer | https://snip.hateblo.jp/entry/SideStore-LiveContainer | WebSearch | 中 |
| 26 | Zenn ryuya0124 | https://zenn.dev/ryuya0124/articles/3d0e1e2f10fdcc | WebFetch | 中 |
| 27 | LiveContainer + SideStore Gist | https://gist.github.com/sinceohsix/688637ac04695d1ff38f844acc8ba7f3 | WebFetch | 中 |
| 28 | ipswdl.com - iOS 26 ガイド | https://ipswdl.com/blog/post/how-to-install-sidestore-livecontainer-on-ios-26/ | WebFetch | 中 |
| 29 | iosgodsipa AltStore vs SideStore | https://iosgodsipa.pro/help/altstore-or-sidestore/ | WebSearch | 中 |
| 30 | 9to5Mac AltStore PAL Japan | https://9to5mac.com/2025/12/18/following-sweeping-app-store-changes-altstore-pal-launches-in-japan/ | WebFetch | 高 |
| 31 | MacRumors AltStore Japan | https://www.macrumors.com/2025/12/18/altstore-japan-launch/ | WebSearch | 高 |
| 32 | AltStore Classic FAQ | https://faq.altstore.io/altstore-classic/your-altstore | WebFetch | 高 |
| 33 | Expo iOS local production build | https://docs.expo.dev/guides/local-app-production/ | WebFetch | 高 |
| 34 | Expo new architecture | https://docs.expo.dev/guides/new-architecture/ | WebFetch | 高 |
| 35 | Expo fyi - Xcode signing | https://github.com/expo/fyi/blob/main/setup-xcode-signing.md | WebFetch | 高 |
| 36 | Expo issue #41824 (Hermes new arch crash) | https://github.com/expo/expo/issues/41824 | WebSearch | 高 |
| 37 | Expo issue #19517 (Hermes static frameworks) | https://github.com/expo/expo/issues/19517 | WebSearch | 高 |
| 38 | Expo issue #21347 (reloadAsync crash) | https://github.com/expo/expo/issues/21347 | WebSearch | 高 |
| 39 | RN issue #34673 (Skip Install) | https://github.com/facebook/react-native/issues/34673 | WebSearch | 高 |
| 40 | Hermes overview | https://reactnative.dev/docs/hermes | WebSearch | 高 |
| 41 | Francesco149 gist (Personal Team xcodegen) | https://gist.github.com/Francesco149/a050b4637d8ea1b4e76ccccda68490b2 | WebFetch | 中 |
| 42 | magnetar Medium - export IPA without dev account | https://medium.com/m%CE%BBgn%CE%BEt%CE%BBr/how-to-export-a-ipa-file-from-xcode-without-a-dev-account-bac8b2645ad3 | WebFetch | 中 |
| 43 | bakhoang Medium - IPA without dev account | https://medium.com/@bakhoang/how-to-build-ipa-file-without-apple-developer-account-be0910c005a0 | WebFetch | 中 |
| 44 | techybuff iDevice Pair 2025 | https://techybuff.com/idevice-pair-generate-pairing-file/ | WebSearch | 中 |
| 45 | techybuff bypass 3-app 2025 | https://techybuff.com/bypass-three-app-limit-with-sidestore-2025/ | WebSearch | 中 |
| 46 | osy/Jitterbug | https://github.com/osy/Jitterbug/releases | WebSearch | 高 |
| 47 | Dadoum anisette-v3-server | https://github.com/Dadoum/anisette-v3-server | WebSearch | 高 |
| 48 | Apple Developer thread #102272 | https://developer.apple.com/forums/thread/102272 | WebSearch | 高 |
| 49 | testdevlab Xcode provisioning | https://www.testdevlab.com/blog/xcode-provisioning-profile-automation-for-ci | WebSearch | 中 |
| 50 | Tenorshare - SideStore won't launch iOS 18 | https://www.tenorshare.com/ios-app/unable-to-launch-sidestore.html | WebFetch | 低 |

---

## 補足・注意事項

- **情報の鮮度**: 最も新しい一次情報は SideStore Nightly 0.6.3-20260412.1002 (2026-04-12) と iloader v2.2.4 (2026-04-12)。安定版 0.6.2 は 2025-07-01 で 9 か月止まっている。記事ベースの最新は snip.hateblo.jp の iOS 26 ガイド (更新 2025-12-19)。
- **推測と事実**: 推測パートには明示的に「推測」と書いた。Seam のスタックでの実機検証は本調査では行っていない (調査スコープ外) — 公式 docs と類似事例ベースで「動くはず」と判断した部分が多い。Hermes が JIT 不要で動くこと、expo-notifications のローカルが APN entitlement 不要で動くこと、expo-sqlite が refresh で消えないこと、これらは **広く動作実績があるが Seam で個別検証していない** ので、最初の Phase 0/1 の通しで実機確認することを推奨。
- **SideStore は実験的**: 公式 docs が「public beta」と明記している。本番運用 (たとえ個人でも 1 年継続) の前提なら、Apple Developer Program ($99/年) 加入が依然として最も楽。Seam の規模感だと趣味ライン上下なので Free + SideStore で十分実用。
- **AltStore PAL は使えない**: Seam を Notarize する気がないなら AltStore PAL (日本) は選択肢に入らない。誤って "AltStore があるなら PAL でいいのでは" と判断しないよう注意。
- **法的・利用規約面**: Free Apple ID で自作アプリを自分の iPhone に焼いて自分で使うのは Apple Developer Agreement の範囲内 (Personal use)。第三者に配布するとアウト。Seam は個人 1 台用と明記されているので問題ない。
