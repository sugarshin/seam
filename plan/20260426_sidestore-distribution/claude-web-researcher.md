# SideStore + Apple サイドロード最新動向（2026-04）

調査日: 2026-04-26
対象アプリ: Seam（個人向け iOS アプリ、Expo SDK 54 + React Native 0.81.5 New Architecture）
前提: Apple Developer Program ($99/年) を使わず、Free Apple ID で自分の iPhone に永続インストールしたい

---

## A. SideStore 最新状況

### A-1. リリースバージョン（2026-04 時点）

| バージョン | リリース日 | 主な変更点 |
|----|----|----|
| **0.6.3 (Nightly)** | 2026-04-12 / 2026-03-03 ビルド | VPN configuration が active 状態を正しく報告するよう修正、Widget 関連バグ fix（`ViewApp.intentdefinition` 必須） |
| 0.6.2 | 2025-07-01 | "Rebase 2.0 wip" by @nythepegasus、refresh が install 系処理を行わず provisioning profile 更新のみに専念するよう変更、minimuxer 更新で **built-in JIT** 機能追加 |
| 0.6.1 | 2025-04-09 | EM Proxy パートに **StosVPN** を追加 |
| 0.6.0 | 2025-03-08 | AltStore 2.0 系の変更を取り込み |

事実ベース（一次情報）:
- 最新 stable 系列は **0.6.3 のアルファ/ナイトリー段階**（2026-04-12 ビルド）
- iOS 26.4 対応のためアルファ版が出ている

参考: [Releases · SideStore/SideStore](https://github.com/SideStore/SideStore/releases) / [Release 0.6.2](https://github.com/SideStore/SideStore/releases/tag/0.6.2) / [Release 0.6.1](https://github.com/SideStore/SideStore/releases/tag/0.6.1)

### A-2. 大きなアーキテクチャ変更

1. **WireGuard → StosVPN への移行**
   - StosVPN は SideStore 公式が出した専用 VPN（[GitHub: SideStore/StosVPN](https://github.com/SideStore/StosVPN)）
   - 設定ファイル不要・オフライン動作可・WireGuard より安定
   - 2025-04 に App Store にも掲載されたが、後に **App Store から削除された**（StikDebug は 2026-01 に App Store 削除済み、StosVPN も同時期削除と推定 — 一次情報未確認）

2. **StikJIT → StikDebug へのリブランド**
   - 旧 `StikJIT/StikJIT` は `StephenDev0/StikDebug` に置き換わった
   - 最新 v3.0.1（2026-03）はオンデバイス JIT、リアルタイムログ、バックグラウンド再接続、GPS spoofing を提供
   - iOS 17.4–26 対応
   - 2026-01 に App Store から削除、現在は SideStore/AltStore ソース経由でサイドロード
   - 参考: [GitHub: StephenDev0/StikDebug](https://github.com/StephenDev0/StikDebug) / [stikdebug.site](https://stikdebug.site/) / [techybuff: StikDebug 2026](https://techybuff.com/stikdebug-enable-jit-on-iphone-ipad-2026/)

3. **Anisette V3 自動運用**
   - V3 anisette サーバ採用以降、ユーザは自前 anisette サーバを建てる必要がなくなった
   - 公式 omnisette-server/Dadoum anisette-v3-server が公開、必要なら自前運用も可能
   - 参考: [Custom Anisette Server | SideStore Docs](https://docs.sidestore.io/docs/advanced/anisette) / [SideStore/anisette-servers](https://github.com/SideStore/anisette-servers)

### A-3. iOS 17 / 18 / 26 の対応状況

- **iOS 17, 18**: 安定動作（複数ガイドが現存、2025-2026 に渡って機能継続）
- **iOS 26.x（メジャーアップデート）**:
  - iOS 26.0–26.3: SideStore 動作 OK
  - **iOS 26.4 Beta 1（2026-03 頃）で Apple が意図的に SideStore を破壊**
    - SideStore 開発者 jkcoxson が、Apple が lockdown 接続の検証方法を変更したことを発見
    - 具体的には VPN（utun）経由の接続をローカルサブネット外でブロック
    - 参考: [piunikaweb: iOS 26.4 may break JIT for sideloaded apps](https://piunikaweb.com/2026/03/26/ios-26-4-may-break-jit-for-sideloaded-apps/) / [onejailbreak: How to fix SideStore on iOS 26.4](https://onejailbreak.com/blog/sidestore-fix-ios-26-4/) / [onejailbreak: Apple targets SideStore signing](https://onejailbreak.com/blog/apple-targets-sidestore-signing-in-ios-26-4-beta/)
  - **暫定 fix**: SideStore Alpha で `LocalDevVPN` の Tunnel/Device IP を、iOS Wi-Fi サブネット範囲内の空き IP に設定
- **iOS 19**: 検索結果に直接の言及なし。iOS 26 系列に統合されている（注: Apple は 2025 年に iOS のバージョン体系を「26」に変更している前提）

### A-4. 日本ユーザー向け注意点

- SideStore 自体は地域制限なし（GitHub からダウンロード可能）
- Anisette サーバはグローバル共用、日本独自のサーバは公式リスト上は不要
- UI は英語ベース（日本語ローカライズ情報は本調査では未確認）
- **重要な代替案として AltStore PAL が 2025-12-18 から日本で利用可能に**（B 章参照）

---

## B. Apple のサイドロード政策

### B-1. EU DMA（既存）

- iOS 17.4（2024-03）から EU 圏で AltStore PAL などサードパーティマーケット解禁
- DMA（Digital Markets Act）に基づく対応
- 既知情報のため詳細は割愛

### B-2. 日本の Mobile Software Competition Act（MSCA）— **2025-12-18 施行（重要更新）**

- **2025-12-18、日本の MSCA が施行され、Apple は日本でも代替アプリマーケット・サードパーティ決済・代替ブラウザを許可**
- 同日、AltStore PAL が日本でローンチ（EU 以来初の海外展開）
- 要件:
  - 物理的に日本国内にいること
  - 日本の App Store アカウントでサインインしていること
  - **iOS 26.2 以上**（一部記事は iOS 18.0+ と記載、複数ソースで矛盾あり）
- 費用:
  - AltStore PAL 自体は無料（Epic MegaGrant により 2025 年は年 €1.50 → 無料化）
  - 補助 Patreon プラン $3–$10/月（任意、特典付き）
- 参考:
  - [9to5Mac: AltStore PAL launches in Japan (2025-12-18)](https://9to5mac.com/2025/12/18/following-sweeping-app-store-changes-altstore-pal-launches-in-japan/)
  - [MacRumors: AltStore Available in Japan One Day After Apple Enables Alternative Marketplaces](https://www.macrumors.com/2025/12/18/altstore-japan-launch/)
  - [Daring Fireball: Apple Announces Changes to iOS in Japan for Compliance With MSCA](https://daringfireball.net/2025/12/apple_japan_msca_compliance)
  - [CSIS: Starting Up the Competition: Japan's Mobile Software Act](https://www.csis.org/blogs/charting-geoeconomics/starting-competition-japans-mobile-software-act)
  - [AltStore PAL download](https://altstore.io/download)

### B-3. AltStore PAL を日本で使うべきか

**事実**:
- 日本ユーザーは 2025-12-18 以降 AltStore PAL を**正規ルートで利用可能**
- AltStore PAL は Apple 公認ルート → Apple ID BAN リスクほぼゼロ・7日縛りなし
- ただし AltStore PAL に登録する**アプリ側（自作 IPA を提供する側）には開発者要件**がある
  - 公式マーケット運営者は AltStore PAL であって、その中で配布されるアプリは Notarization が必要
  - 「個人開発者が自分専用に自作アプリを焼く」用途には依然として AltStore PAL は不向きな可能性あり（一次情報で確証取れず — 推測）

**推測（要確認）**:
- 自作アプリを AltStore PAL 経由で焼くには、AltStore Classic 同様の self-signing フローが残っているかが鍵
- 残っているなら 7日縛りなしで運用できる可能性が大
- 残っていない（公開マーケット用 Notarization のみ）なら、SideStore に頼らざるを得ない

### B-4. Free Provisioning の制限変更

- **基本制限は 2026-04 時点でも変わらず**:
  - 7日有効
  - デバイス3台まで
  - App ID 10個/週まで
  - Push Notifications, iCloud, Background Modes など多くの Capability が**無効**
- 公式: [Apple: Provisioning profile updates](https://developer.apple.com/help/account/provisioning-profiles/provisioning-profile-updates/)
- Apple が 2025–2026 に Free Provisioning の縛りを緩める発表は**一次情報で確認できず**
- むしろ iOS 26.4 で SideStore を意図的に妨害するなど **Apple は強化方向**
  - 2025 年中、署名サービスに紐づく証明書が **「波状的に revoke」** される事象が継続
  - 参考: [State of Sideloading on iOS 2025 (Medium)](https://medium.com/@randomcatto/state-of-sideloading-on-ios-2024-24acc570898d)

---

## C. 関連ツール

### C-1. jitterbugpair

- 役割: PC（macOS / Linux / Windows）に iPhone を USB 接続して `.mobiledevicepairing` ファイルを生成
- これを SideStore に渡すことで iPhone 単独で署名・refresh が回るようになる
- **2026 時点でも引き続き必須ツール**（macOS なら Mac の `idevicepair` で代替可）
- 参考: [GitHub: osy/Jitterbug](https://github.com/osy/Jitterbug) / [SideStore Docs: Pairing File](https://docs.sidestore.io/docs/advanced/pairing-file)

### C-2. AltServer / SideServer

- AltServer は AltStore Classic 用、SideStore は不要
- SideStore 公式に **SideServer-macOS** という別系統あり（バックアップ anisette サーバ + 自動 refresh 用）
- 参考: [SideStore/SideServer-macOS](https://github.com/SideStore/SideServer-macOS)

### C-3. iOS 18 で動く Pairing 取得手段

| 方法 | macOS | Linux | Windows | 備考 |
|----|----|----|----|----|
| jitterbugpair | ○ | ○ | ○ | 標準。USB ペアリング後に CLI 実行 |
| Mac の `idevicepair` | ○ | × | × | macOS 上の libimobiledevice |
| **macOS 不要な手段** | — | — | — | 一次情報では確認できず |

- iOS 18 / 26 共に**初回 pairing には必ず PC が必要**（macOS 推奨）
- 一度ペアリングすれば iPhone 単独で運用可能

### C-4. WireGuard → StosVPN

- 旧構成: WireGuard 公式アプリに SideStore.conf を読み込ませる
- 新構成: StosVPN（設定不要）
- StosVPN が App Store から削除されているため、現在は SideStore リポジトリ／IPA 直接配布から取得
- 参考: [GitHub: SideStore/StosVPN](https://github.com/SideStore/StosVPN) / [techybuff: 4 Epic Ways StosVPN Unleashes SideStore Setup](https://techybuff.com/stosvpn-sidestore-setup-2025/)

### C-5. StikDebug の使い方（最新）

- 役割: オンデバイス JIT 有効化（エミュレータ等で必要）
- ペアリングファイルを一度 PC で生成して取り込めば、以降は iPhone 単独で JIT を ON にできる
- **Seam の用途では JIT は不要**（Hermes は AOT、Reanimated worklets も JIT 不要）

---

## D. Expo / React Native New Architecture を Free 署名でビルドした実例

### D-1. 公式 Expo ドキュメントが示すルート

**結論**: Expo は「EAS を使わずに、Mac + Xcode + Free Apple ID」での個人ビルドを公式にサポートしている。

手順（要点のみ）:
1. `npx expo prebuild -p ios` で `ios/` 生成
2. `xed ios` で Xcode を開く
3. `Signing & Capabilities` → `Automatically manage signing` ON
4. `Add Account` から無料 Apple ID を追加し、Personal Team を Development Team に選択
5. 実機を選択して Run（Xcode が自動で UDID 登録 + 7日プロファイルを発行）
6. iPhone 側で `Settings > General > VPN & Device Management` から証明書を Trust

参考:
- [fyi/setup-xcode-signing.md (expo/fyi)](https://github.com/expo/fyi/blob/main/setup-xcode-signing.md)
- [Expo: Create a release build locally](https://docs.expo.dev/guides/local-app-production/)
- [Expo Docs: App credentials](https://docs.expo.dev/app-signing/app-credentials/)
- [DevGenius: How to build an iOS Expo App without using EAS Build](https://blog.devgenius.io/how-to-build-an-ios-expo-app-without-using-eas-build-78bfc4002a0f)

### D-2. New Architecture の互換性

- **SDK 53 から全 expo-* パッケージが New Architecture 対応**
- React Native 0.82 以降は New Architecture が常時有効（無効化不可）
- SDK 54（Seam が使用中）= RN 0.81.x なので New Architecture を opt-in 制御可能
- 参考: [Expo: React Native's New Architecture](https://docs.expo.dev/guides/new-architecture/) / [React Native 0.83 リリース](https://reactnative.dev/blog/2025/12/10/react-native-0.83)

### D-3. Free 署名で問題になる Capability

| Capability | Free Personal Team | Seam での影響 |
|----|----|----|
| Push Notifications | **不可** | **要対処** — expo-notifications がデフォルトで entitlement を追加 |
| Background Modes | 一部のみ | リマインダーは `UNCalendarNotificationTrigger` ローカル通知なら OK |
| iCloud | 不可 | Seam は local-first なので影響なし |
| App Groups | 不可 | 不要 |
| Associated Domains | 不可 | 不要 |
| Sign in with Apple | 不可 | 不要（auth なし） |

**重要な落とし穴**: `expo-notifications` を入れると `aps-environment` entitlement と Push Notifications capability が **app.json から自動付与**される。Personal Team はこの capability を持てないため、prebuild → Xcode build 時に `Provisioning profile doesn't include the aps-environment entitlement` で失敗する。

回避策（複数報告あり）:
1. `app.json` から `expo-notifications` の plugin 設定を見直し、`aps-environment` を含めない設定にする
2. Custom config plugin で `entitlements.plist` を上書きして `aps-environment` を削除
3. Xcode の Signing & Capabilities タブで Push Notifications を手動で OFF（prebuild 後の native プロジェクトを変更）

参考 issue:
- [expo/expo#27668: Push Notifications entitlement getting added automatically in prebuild](https://github.com/expo/expo/issues/27668)
- [expo/eas-cli#987: Push Notifications Entitlement turned on even when selecting "no"](https://github.com/expo/eas-cli/issues/987)
- [expo/expo#18951: Ability to disable Push Notification entitlements by default](https://github.com/expo/expo/issues/18951)

**Seam にとっての結論**: Seam が使う通知はローカル通知のみ（`expo-notifications` の `scheduleNotificationAsync`）。これは `aps-environment` 不要。app.json から push 関連 entitlement を抜けば Free 署名でビルド可能。

### D-4. Hermes / Pod の codesign 失敗

- 過去、Xcode Archive 時に `Replace Hermes for the right configuration` で署名エラーが出る事案あり（[facebook/react-native#39903](https://github.com/facebook/react-native/issues/39903), [#42221](https://github.com/facebook/react-native/issues/42221)）
- 原因の多くは `.xcode.env.local` の Node パスや、証明書名のクオート起因
- 2026-04 時点で Hermes 自体が Personal Team で動かないという報告は確認できず

### D-5. 2025–2026 の RN/Expo + 個人署名 実例

- 2025 年に RN/Expo を Free Apple ID + SideStore で焼いたという**直接的な公開ブログ事例**は本調査では見つからず（不在）
- ただし以下は確認できる:
  - Expo 公式が `npx expo prebuild` → Xcode の Personal Team 運用を想定したガイドを維持
  - [Yvaine: Create Development Builds Without an Apple Developer Program](https://yvainee.com/blog/create-development-builds-without-an-Apple-Developer-Program) は EAS で他人の Apple ID を共有する方法（Seam 用途には不適）
- **Seam の構成（Expo SDK 54 + RN 0.81 + New Arch + expo-notifications local only）が SideStore で動くという直接の前例はない**が、Free 署名で Xcode build → IPA 化 → SideStore 経由で焼く流れに技術的障害は確認されていない

---

## E. 個人開発者の運用パターン（2026-04 ベスト）

### E-1. Seam 想定ユースケース「自作 RN アプリを iPhone に永続的に焼く」の標準解

**選択肢 1（推奨候補）: Xcode Free Provisioning 直接インストール**
- Mac + Xcode + Free Apple ID + USB ケーブル
- 7日ごとに Mac に繋いで Xcode から Run し直す
- メリット: SideStore 不要、最もシンプル、Apple が壊しにくい
- デメリット: 7日ごとに Mac を引っ張り出す手間
- New Arch / Hermes / 自作 entitlement 全て手元の Xcode 設定で完結

**選択肢 2: SideStore + LiveContainer（Wi-Fi 自動 refresh）**
- SideStore で本体管理、LiveContainer 内に自作 IPA を入れる
- LiveContainer 経由なら **3アプリ枠を消費しない**（[LiveContainer Docs](https://livecontainer.github.io/docs/installation/lc_sidestore)）
- iOS 26.4 で Apple が破壊した経緯あり、Apple のいたちごっこリスクあり
- 参考: [fr0stb1rd: Unlimited Sideload Infrastructure on iOS 26.2.1](https://fr0stb1rd.gitlab.io/posts/ios-26-unlimited-sideload-sidestore-livecontainer/) / [silisko: LiveContainer Guide 2026](https://silisko.com/livecontainer-guide/) / [iosgods: SideStore + LiveContainer Sideloading Guide](https://iosgods.com/topic/199962-sidestore-livecontainer-sideloading-guide-bypass-3-app-limitavoid-revokes/)

**選択肢 3（日本では新たに有効）: AltStore PAL**
- 2025-12-18 から日本で使える正規ルート
- ただし「自作アプリを自分専用に焼く」用途で AltStore PAL の Classic 互換 self-signing フローが日本で使えるかは**一次情報で未確認**
- 公開マーケット配信が前提なら Notarization 必要 → Seam 用途には不向きの可能性

### E-2. 定番の組み合わせ

検索結果上の人気構成（emulator/IPA を入れたい一般ユーザー向け、開発者の自作アプリ向けではない）:

```
SideStore (本体) + StosVPN (内蔵) + StikDebug (JIT 必要時) + LiveContainer (3アプリ枠回避)
```

Seam 用途では JIT 不要・LiveContainer も不要（自作 1 本だけだから）なので、最小構成は:

```
SideStore (内部 StosVPN) + jitterbugpair (初回 pairing 用)
```

### E-3. 自前 anisette サーバ運用

- V3 anisette 採用後は**ほぼ不要**（公開サーバで Apple ID ロックされにくい）
- 自宅 Mac を anisette サーバにする選択肢は残る（[SideStore/omnisette-server](https://github.com/SideStore/omnisette-server)）
- Seam の用途では自前運用するメリット薄い

### E-4. リフレッシュ自動化の信頼性（2025–2026 の最新報告）

- **不安定**: Background refresh が silently fail する報告が継続
  - [SideStore#496: Background refresh not working](https://github.com/SideStore/SideStore/issues/496)
  - [SideStore#893: Automatic refresh reports no errors but app no longer opens](https://github.com/SideStore/SideStore/issues/893)
  - [SideStore#1124: Background refresh broken on iOS 17 — investigate new JIT impact](https://github.com/SideStore/SideStore/issues/1124)
- 「7日 残ってる表示なのに突然開かなくなる」現象が 2025 年も発生
- 実運用上は**手動 refresh をたまに走らせる**前提で構えるのが現実的

---

## F. リスクと落とし穴

### F-1. Apple 遮断リスク（高）

- **Apple は意図的に SideStore を破壊できる**実例あり: iOS 26.4 Beta で lockdown 接続検証を変更し on-device 署名を停止
- パターン: 新しい回避策が普及するたびに OS レベルで対策が入る
- 参考: [State of Sideloading 2025 (Medium)](https://medium.com/@randomcatto/state-of-sideloading-on-ios-2024-24acc570898d) / [piunikaweb: iOS 26.4 may break JIT](https://piunikaweb.com/2026/03/26/ios-26-4-may-break-jit-for-sideloaded-apps/)
- **対策**: iOS major upgrade を即座に行わない（コミュニティが fix を出すまで待つ）

### F-2. Apple ID BAN リスク（低〜中）

- 確認できた事実:
  - Free Apple ID で SideStore を使っているだけで BAN された確定報告は**見つからず**
  - 「Apple ID lock（一時的に Apple ID がロック）」は anisette V3 以前は頻発、現在は減少
  - フェイク Apple ID を使うと BAN リスク高まる
- 対策: メイン Apple ID と分けてサブ Apple ID で運用するのが安全
- 参考: [SideStore#252: SideStore locks Apple ID](https://github.com/SideStore/SideStore/issues/252) / [Hacker News discussion](https://news.ycombinator.com/item?id=36023322)

### F-3. 7日縛りが将来変わる可能性（極小）

- Apple は 2025–2026 に Free Provisioning の 7日制限を変える発表をしていない
- DMA / MSCA 圧力で長期的に変わる可能性は理論上あるが、近未来は **7日縛りは続く**前提で設計するべき

### F-4. データ消失リスク

| 状況 | データ消失する？ | 補足 |
|----|----|----|
| 通常 refresh 失敗 → 再 install | **しない** | Bundle ID 同一なら iOS が data container を維持 |
| アプリを手動削除 → 再 install | **する** | 削除時に container も消える |
| iPhone をリセット | する（iCloud Backup なしなら） | local-first アプリは要注意 |
| 端末再ペアリング | しない（証明書再発行のみ） | pairing file を作り直すだけ |
| iOS major upgrade | 通常はしない | が、SideStore 側が壊れて refresh できないと結果的にアプリ起動不可 |

参考: [Scarlet iOS: How to Back Up Sideloaded Apps and Their Data](https://scarletios.com/how-to-back-up-sideloaded-apps-and-their-data/) / [SideStore FAQ](https://docs.sidestore.io/docs/faq)

**Seam 用途での具体的リスク**:
- Seam は SQLite をアプリの documents directory に保存（local-first）
- 写真も documents directory（schema.ts の `photos.relative_path` で**相対パス**保存している点が良い設計）
- `pnpm --filter @seam/app` で再 install するとき、Bundle ID を変えなければデータ保持される
- ただし iCloud Backup を有効化しておくのがベター（Backup 機能を Seam が `src/backup/` で実装済み = JSON Export / Import がある点が強い）

### F-5. 既知の落とし穴チェックリスト（Seam 固有）

- [ ] `expo-notifications` の `aps-environment` entitlement を Free 署名向けに**外す or push を使わない設定**にする
- [ ] expo-sqlite の動作は Personal Team で問題なし（OSS 多数で実績あり）
- [ ] react-native-reanimated 等の Pod の codesign は通常通る（Hermes も同じ）
- [ ] `experiments.typedRoutes` は build 時のみ影響、署名には無関係
- [ ] 写真の相対パス保存（既に対応済み）が、refresh 時のコンテナパス変動に強い設計

---

## 結論：2026-04 時点で Seam に推奨する構成

### 推奨ランキング

**1位（最推奨）: Xcode Free Provisioning 直接インストール（SideStore 不使用）**
- 理由:
  - Seam は個人 1 人 1 端末用途、distribution 不要
  - 開発者本人なので Mac + Xcode が手元にある前提
  - Apple のいたちごっこに巻き込まれない（Apple 公式ルート）
  - New Architecture / expo-notifications ローカル通知の互換性確認も自分の Xcode 上で完結
- 運用:
  - 7日ごとに Mac に USB 接続 → Xcode で Cmd+R 一発 re-install
  - データ保持される（Bundle ID 不変）
  - Wi-Fi で実機接続できれば USB ケーブルすら不要
- セットアップ手順:
  1. `pnpm --filter @seam/app prebuild` で `ios/` 生成
  2. `cd packages/app && xed ios` で Xcode を開く
  3. Signing & Capabilities で Personal Team を選択
  4. **expo-notifications の Push capability を OFF**（aps-environment を entitlements から除去）
  5. 実機選択 → Run

**2位: SideStore + LiveContainer**
- 理由:
  - 「Mac を毎週引っ張り出すのが嫌」という UX を最重視するなら有り
  - 日本で AltStore PAL が出たとはいえ、自作アプリ用途では SideStore のほうが既存知見多い
- リスク:
  - iOS 26.4 のように Apple が突然壊す
  - Background refresh が silently 失敗する事例継続
  - 写真の相対パス管理は既に Seam が正しく実装済み（コンテナパス変動耐性あり）
- セットアップ:
  - SideStore 0.6.3 alpha + 内蔵 StosVPN + jitterbugpair で 1 回 pairing
  - LiveContainer に Seam の IPA を入れる（3 アプリ枠を消費しない）

**3位（要追加調査）: AltStore PAL 日本版**
- 理由:
  - 2025-12-18 から日本で正規利用可能
  - Apple ID BAN リスクほぼゼロ・7日縛りなしで運用できる**可能性**
- 不確定要素:
  - 「自作アプリを Personal Team 署名で AltStore PAL 経由で焼ける」かは一次情報で未確認
  - もし AltStore Classic 互換の self-signing フローが日本でも有効なら最強候補
  - 公開マーケット配信前提（Notarization 必要）なら不向き
- アクション: 公式 FAQ ([altstore PAL FAQ](https://faq.altstore.io/altstore-pal/what-is-altstore-pal)) を直接確認することを推奨

### Seam 固有の最終提案

```
[フェーズ 1] まずは Xcode Free Provisioning 直接インストール
  - 7日ごとの Mac 接続を許容
  - expo-notifications の push entitlement を外す対応
  - 写真と SQLite の data persistence を確認

[フェーズ 2] 不便さが上回ったら SideStore に移行
  - SideStore 0.6.3+ stable を待つ
  - LiveContainer で 3アプリ枠回避
  - 写真パス管理が既に正しいので移行コスト低い

[フェーズ 3] AltStore PAL 日本版の self-signing 可否を別途調査
  - 可能なら長期運用ベスト
  - 不可ならフェーズ 2 で運用継続
```

---

## 補足：本調査で見つからなかった情報

以下は 2026-04 時点で **一次情報で確証が取れなかった**項目です。意思決定時には別途確認推奨:

1. **AltStore PAL 日本版での self-signing（個人作 IPA を Free Apple ID で焼く）の可否**
   - EU 版 AltStore PAL は Notarization 必須の公開マーケット運用が中心。Classic 互換 self-signing が日本版に組み込まれているかの一次情報未確認。
2. **Expo SDK 54 + RN 0.81 + New Arch + Free Apple ID で SideStore 経由インストールした公開事例**
   - 直接の成功報告ブログ・Issue は本調査で発見できず。
3. **Seam の Reanimated / Drizzle 等 native 依存の Personal Team 互換性**
   - 既知の互換性破壊報告は無いが、確認は実機 build を実施するのが最速。
4. **iOS 26 系で Free Provisioning の 7日制限が緩和された/強化された情報**
   - 公式変更なし、コミュニティ報告でも変化見当たらず。

---

## 主要参考 URL 一覧

### SideStore 本体
- [Releases · SideStore/SideStore](https://github.com/SideStore/SideStore/releases)
- [SideStore Docs](https://docs.sidestore.io/)
- [SideStore Docs: Release Notes](https://docs.sidestore.io/docs/release-notes)
- [SideStore Docs: FAQ](https://docs.sidestore.io/docs/faq)
- [SideStore Docs: Pairing File](https://docs.sidestore.io/docs/advanced/pairing-file)
- [SideStore Docs: Custom Anisette Server](https://docs.sidestore.io/docs/advanced/anisette)
- [SideStore Docs: Enabling JIT](https://docs.sidestore.io/docs/advanced/jit)

### 関連リポジトリ
- [SideStore/StosVPN](https://github.com/SideStore/StosVPN)
- [StephenDev0/StikDebug](https://github.com/StephenDev0/StikDebug)
- [LiveContainer/LiveContainer](https://github.com/LiveContainer/LiveContainer)
- [SideStore/anisette-servers](https://github.com/SideStore/anisette-servers)
- [SideStore/SideServer-macOS](https://github.com/SideStore/SideServer-macOS)
- [Dadoum/anisette-v3-server](https://github.com/Dadoum/anisette-v3-server)
- [osy/Jitterbug](https://github.com/osy/Jitterbug)

### iOS 26.4 問題
- [piunikaweb: iOS 26.4 may break JIT for sideloaded apps](https://piunikaweb.com/2026/03/26/ios-26-4-may-break-jit-for-sideloaded-apps/)
- [onejailbreak: How to fix SideStore on iOS 26.4 — New Alpha Released](https://onejailbreak.com/blog/sidestore-fix-ios-26-4/)
- [onejailbreak: Apple targets SideStore signing in iOS 26.4 Beta](https://onejailbreak.com/blog/apple-targets-sidestore-signing-in-ios-26-4-beta/)

### 日本 MSCA / AltStore PAL
- [9to5Mac: AltStore PAL launches in Japan](https://9to5mac.com/2025/12/18/following-sweeping-app-store-changes-altstore-pal-launches-in-japan/)
- [MacRumors: AltStore Available in Japan](https://www.macrumors.com/2025/12/18/altstore-japan-launch/)
- [Daring Fireball: Apple Announces Changes for MSCA](https://daringfireball.net/2025/12/apple_japan_msca_compliance)
- [CSIS: Japan's Mobile Software Act](https://www.csis.org/blogs/charting-geoeconomics/starting-competition-japans-mobile-software-act)
- [MacRumors: Japan App Store Gets Alternative Marketplaces](https://www.macrumors.com/2025/12/17/japan-app-store-feature-updates/)
- [AltStore PAL download page](https://altstore.io/download)

### Expo / RN 個人署名
- [Expo: Create a release build locally](https://docs.expo.dev/guides/local-app-production/)
- [expo/fyi: setup-xcode-signing.md](https://github.com/expo/fyi/blob/main/setup-xcode-signing.md)
- [Expo: App credentials](https://docs.expo.dev/app-signing/app-credentials/)
- [Expo: React Native New Architecture](https://docs.expo.dev/guides/new-architecture/)
- [DevGenius: How to build an iOS Expo App without using EAS Build](https://blog.devgenius.io/how-to-build-an-ios-expo-app-without-using-eas-build-78bfc4002a0f)
- [expo/expo#27668: Push Notifications entitlement getting added automatically in prebuild](https://github.com/expo/expo/issues/27668)
- [expo/eas-cli#987: Push Notifications Entitlement turned on even when selecting "no"](https://github.com/expo/eas-cli/issues/987)

### コミュニティガイド
- [silisko: iOS Sideloading Complete Guide 2026](https://silisko.com/ios-sideloading-complete-guide-2026/)
- [silisko: LiveContainer iOS 26 Guide 2026](https://silisko.com/livecontainer-guide/)
- [silisko: StikDebug JIT iOS 26 Guide](https://silisko.com/stikdebug-jit-ios-26-guide/)
- [techybuff: StikDebug Enable JIT on iPhone & iPad 2026](https://techybuff.com/stikdebug-enable-jit-on-iphone-ipad-2026/)
- [techybuff: 4 Epic Ways StosVPN Unleashes SideStore Setup](https://techybuff.com/stosvpn-sidestore-setup-2025/)
- [Medium: State of Sideloading on iOS 2025](https://medium.com/@randomcatto/state-of-sideloading-on-ios-2024-24acc570898d)
- [DEV: How iOS Sideloading Actually Works in 2025](https://dev.to/1_king_0b1e1f8bfe6d1/how-ios-sideloading-actually-works-in-2025-dev-certs-altstore-and-the-eu-exception-1m2h)
- [GitHub gist: Installing LiveContainer+SideStore from start to finish](https://gist.github.com/sinceohsix/688637ac04695d1ff38f844acc8ba7f3)
- [GitHub gist: LiveContainer + SideStore (LC+SS): Complete Guide](https://gist.github.com/SoniaMalki/2b34cfeba427a75e53659cb25fd0289d)
- [fr0stb1rd: Unlimited Sideload Infrastructure on iOS 26.2.1](https://fr0stb1rd.gitlab.io/posts/ios-26-unlimited-sideload-sidestore-livecontainer/)

### Apple 公式
- [Apple Developer: Provisioning profile updates](https://developer.apple.com/help/account/provisioning-profiles/provisioning-profile-updates/)
- [Apple Developer: Compare Memberships](https://developer.apple.com/support/compare-memberships/)
