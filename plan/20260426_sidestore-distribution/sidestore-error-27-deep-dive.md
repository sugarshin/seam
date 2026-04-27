# MinimuxerError 27 根本原因調査

調査日: 2026-04-26
対象: iPhone 14 / iOS 26.3.1 (Build 23D8133 系) + macOS Sequoia 15.7.3 + SideStore stable 0.6.2 + iloader v2.2.4

## TL;DR (結論先出し)

**ほぼ確実な根本原因 (推定信頼度: 高)**

1. **SideStore 0.6.2 stable は iOS 26 系を完全には公式サポートしていない**。iOS 17.4+ が JIT 限定での "対応下限" であり、stable 0.6.2 が想定する pairing / minimuxer の挙動は iOS 18 以前を主軸にしている。
2. **iloader v2.2.4 の Manage Pairing File → Place In All Apps は SideStore App ID 配下の `pairingFile.plist` を上書きする操作**だが、SideStore 0.6.2 stable がそのファイルを正しく読み込めていない、または iloader 側が生成する **RPPairing 形式** (iOS 17.4+ 用の新形式) を 0.6.2 stable の minimuxer が解釈しきれていない可能性がある。
3. **VPN プロファイル (LocalDevVPN) が iOS 設定に存在しない** のは異常。SideStore 0.6.2 stable は LocalDevVPN (App Store 配布の別アプリ) を **必須** とする。VPN が無い状態では minimuxer が AFC コネクションを確立できず、結果として `MinimuxerError 27 = AFC was unable to manage files` が発生する。これが本件の最有力原因。
4. iOS 26.3.1 自体は Apple が SideStore を意図的に潰した **iOS 26.4 Beta の lockdown 検証強化より前** のバージョンなので、26.4 の致命的破壊は受けていない。つまり「**ちゃんと前提を満たせば 26.3.1 で 0.6.2 が動く可能性は残っている**」。

**今すぐ試すべき手順 (優先度順) は本書末尾「結論」を参照。** とくに **「LocalDevVPN を App Store からインストールして起動 → Connect」** がおそらく欠けている工程。

---

## 1. エラーコード 27 の定義

### 公式ドキュメントによる定義

SideStore 公式 docs ([Error Codes](https://docs.sidestore.io/docs/troubleshooting/error-codes)) は MinimuxerError を 2 つだけ列挙している:

| Code | 意味 |
|------|------|
| **4**  | "AFC was unable to manage files on the device" — JIT を非対応 iOS で有効化しようとしたとき (iOS 17.4–18.6 のみサポート) |
| **27** | "AFC was unable to manage files on the device" — Wi-Fi / LocalDevVPN 接続必須、解決しなければ iloader で pairing を入れ直す |

### Rust 内部定義 (推定)

[deepwiki: jkcoxson/minimuxer Error Types Reference](https://deepwiki.com/jkcoxson/minimuxer/8.2-error-types-reference) によれば、minimuxer の Rust enum は 6 カテゴリで構成される:

- Device/Connection: `NoDevice`, `NoConnection`, `PairingFile`
- Service Creation: `CreateLockdown`, `CreateDebug`, `CreateInstproxy` 他
- JIT/Debugging: `Attach`, `Detach`, `LaunchSuccess` 他
- **Installation: `CreateAfc`, `RwAfc`, `InstallApp(String)`, `UninstallApp`** ← ここに 27 が属するとみられる
- Provisioning: `CreateMisagent`, `ProfileInstall`, `ProfileRemove`
- Mounting: `CreateFolder`, `DownloadImage`, `Mount` 他

`CreateAfc` = "Failed to create Apple File Conduit client" (file system access initiation 失敗)
`RwAfc` = "AFC read/write operation failed"

これらは `src/install.rs` 49-108 行で発生する。**コード 27 は AFC 系のうち pairing がそもそも有効化されていない or 認識されていないとき** に出る。

### "invalid pairing" メッセージの意味

iOS デバイスとの暗号化セッション確立に必要な credential (pairing record) が:

- 存在しない
- 期限切れ (`Your pairing file may expire and need to be reimported if you update or reset your iPhone` — [SideStore docs: Pairing File](https://docs.sidestore.io/docs/advanced/pairing-file))
- フォーマットが SideStore 0.6.2 が期待する形と異なる
- VPN が無いため SideStore が usbmuxd-over-loopback でデバイスに到達できない

のいずれかを意味する。

### 関連 GitHub Issue (全て **未解決のまま** 放置されている)

- [#1225 [BUG] AFC minimuxer.MinimuxerError 27](https://github.com/SideStore/SideStore/issues/1225) — iPhone 17 / iOS 26.4 / SideStore 0.6.2、ユーザ自力解決できず、コメント無し
- [#1246 [BUG] minimuxer.minimuxer error 27](https://github.com/SideStore/SideStore/issues/1246) — 0.6.2 reinstall 後に発生、解決策なし
- [#1049 [BUG] minimuxer.MinimuxerError code=27](https://github.com/SideStore/SideStore/issues/1049) — `Idid.cpp(1461): _assert()` を伴う、未解決
- [#951 [BUG] AFC invalid pairing](https://github.com/SideStore/SideStore/issues/951) — pairing 5回リセット + SideStore 7回再インストールでも解決せず、Closed without resolution
- [#1085 [BUG] AFC Invalid Pairing](https://github.com/SideStore/SideStore/issues/1085)
- [#737 [BUG] AFC was unable to manage files...](https://github.com/SideStore/SideStore/issues/737)

→ **公式 issue tracker では「これを実行すれば直る」という決定打が共有されていない**。コミュニティで解決報告が散見されるパターンは「LocalDevVPN を入れる」「nightly に乗り換える」「idevice_pair から RPPairing で生成する」のいずれか。

---

## 2. iOS 26.3.1 互換性

### iOS 26.3.1 とは何か

- リリース日: **2026-03-04** ([9to5Mac](https://9to5mac.com/2026/03/04/apple-releases-ios-26-3-1/), [MacRumors](https://www.macrumors.com/2026/03/04/apple-releases-ios-26-3-1/))
- 公式 RTM Build: **23D8133** ([BetaWiki](https://betawiki.net/wiki/IOS_26.3.1_build_23D8133))
- 中身: Studio Display 対応 + バグ修正 + WebKit 関連 RSR (CVE-2026-20643)
- ユーザが報告した build "23D771330a" は公式 build 表記と一致しない。**おそらく Background Security Improvement 付きの RSR variant か、表記の誤読**。実害があるかは設定 → 一般 → 情報 → モデル番号 / ソフトウェアバージョン で要再確認だが、いずれも iOS 26.3.1 系列で挙動は同じ。

### 26.3 vs 26.4 — Apple の lockdown 仕様変更

これが最重要ポイント:

- **iOS 26.4 Beta** (2026 年に Apple がリリース) で、Apple は **lockdown 接続の検証ロジック** を変更し、SideStore の on-device 署名が壊れた。
  - 出典: [ONE Jailbreak: SideStore Breaks on iOS 26.4 Beta](https://onejailbreak.com/blog/apple-targets-sidestore-signing-in-ios-26-4-beta/) (403 のため要約のみ確認)
  - X 投稿: [@onejailbreak_ status 2025485633028776110](https://x.com/onejailbreak_/status/2025485633028776110) — "SideStore is NOT working on iOS 26.4 Beta 1. Apple updated lockdown connection checks effectively breaking on-device installs. Devs say it looks intentional."
  - 技術詳細: SideStore の同一デバイス内 VPN ループバックで lockdown を騙す手法に対し、Apple が **incoming socket が実際にローカルサブネットに存在するかチェック** するよう lockdown を強化した (jkcoxson 解析)
- **iOS 26.3 / 26.3.1 はこの変更前** のため、原則 SideStore の従来手法は機能する状態のまま。([MacRumors iOS 26.3 security content](https://www.macrumors.com/2026/02/11/ios-26-3-security-vulnerabilities/))

### つまり結論

- iOS 26.3.1 は Apple が「壊した」バージョンではない
- ただし SideStore 0.6.2 stable のリリース時点 (2025-07-01) では iOS 26 系は存在しなかったため、**SideStore 0.6.2 stable から見ると iOS 26.3.1 はテストされていない未来の OS**
- 動く事例は存在する: [silisko: SideStore iOS 26 Setup Guide](https://www.silisko.com/sidestore-ios-26-setup-guide/), [ipswdl: How to Install SideStore + LiveContainer on iOS 26](https://ipswdl.com/blog/post/how-to-install-sidestore-livecontainer-on-ios-26/), [techacrobat](https://www.techacrobat.com/download-sidestore/) が「iOS 16〜26 で動く」と書いている ※ただし日本語のレビュー実例は乏しい
- iOS 26 Developer Beta 2 (26.3 GA より前) では既に **SideStore 0.6.2 で pairing file が機能しない** という [#1186](https://github.com/SideStore/SideStore/issues/1186) が報告されている (Closed だが resolution 不明) → iOS 26 系全体に潜在的な不安定性あり

### 26.x で必要な追加設定 (公式)

- LocalDevVPN を起動して Connect しておくこと ([Install docs](https://docs.sidestore.io/docs/installation/install))
- StikDebug は 26.4 で **rppairing への切り替えが必須** ([StikDebug 3.1.x release notes より、3.1.2 で iOS 26 / TXM JIT 改善あり](https://github.com/StephenDev0/StikDebug/releases))
- → SideStore も同じ流れ。stable 0.6.2 はこの世代に追従していない

---

## 3. iloader v2.2.4 ↔ SideStore 0.6.2 互換性

### iloader v2.2.4 概要

- リリース: **2026-04-12** ([nab138/iloader](https://github.com/nab138/iloader))
- 33 リリース、1.6k stars、現在も活発に開発中
- README の自己紹介: "rppairing+lockdown pairing files" を扱う
- 公式サイト: [iloader.app](https://iloader.app/), [iloader.site](https://iloader.site/)

つまり iloader v2.2.4 は **新旧 2 種類の pairing file** をサポートする:

- **Lockdown (USB-based)**: 従来の plist credentials, usbmuxd 経由
- **RPPairing (Remote Pairing, Network-based)**: iOS 17.4+ 用、CoreDevice handshake / RSD / XPC ベース ([deepwiki: idevice_pair Pairing File Management](https://deepwiki.com/jkcoxson/idevice_pair/4.3-pairing-file-management))

### "Place In All Apps" の挙動 (推定)

公式ドキュメントは "Place" ボタンが **SideStore / StikDebug / Protokolle** 等の各アプリの App Group コンテナに pairing file を直接配置すると説明 ([SideStore docs: Pairing File](https://docs.sidestore.io/docs/advanced/pairing-file))。Place In All Apps は **検出された全 SideStore 系アプリ** の pairing file を一括上書きするバリエーション。

- 配置先 (推定): `App Group/group.com.sidestore.SideStore/pairingFile.plist` 相当のパス
- iloader が AFC 経由でファイルを書き込む (これ自体は SideStore のサンドボックス特例として許可されている App Group 領域への書き込み)

### SideStore 0.6.2 が期待する pairing 形式

- SideStore 0.6.2 (2025-07-01) は **WireGuard を deprecate して StosVPN に完全移行**、Apple ID 証明書の import/export 追加が主変更点 ([Release Notes](https://docs.sidestore.io/docs/release-notes))
- 当時の minimuxer は **Lockdown 形式 pairing** のみ理解する
- **RPPairing は SideStore Nightly (0.6.3-nightly) でしか正式サポートされない**:
  - [ONE Jailbreak X tweet: SideStore Nightly Updates minimuxer to support RPPairing](https://x.com/onejailbreak_/status/2040354961150681389) — "SideStore Nightly Updates minimuxer to support RPPairing (works on iOS 26.4)"

### 推定される非互換シナリオ

1. iloader v2.2.4 がデバイスから **RPPairing 形式** で pair record を取得・配置
2. SideStore 0.6.2 stable の minimuxer は **Lockdown 形式しか読めない** → 解釈失敗 → "could not determine UDID" → 再試行で AFC を呼ぶも client 作れず → MinimuxerError 27 (CreateAfc 系)

これは **iloader が新しすぎる × SideStore が古すぎる** の典型的なバージョン断層。

### 補強事実

- [#1262](https://github.com/SideStore/SideStore/issues/1262) (2026-04-14) は **Nightly 0.6.3-20260412** で UDID 判定エラーが発生し、iloader で何度 pairing 入れ直しても直らない事例。Nightly でも RPPairing が完全には安定していない兆候。
- [#1197](https://github.com/SideStore/SideStore/issues/1197) は 0.6.3-nightly でも minimuxer が `Couldn't fetch first device (timed out)` を吐く。**iloader 単体で pairing を完璧に置くだけでは足りず、minimuxer 側の検出に LocalDevVPN が必要**。

---

## 4. VPN プロファイルの必要性

### 結論: **必須**。これがほぼ確実に欠けている工程

[SideStore docs: Prerequisites](https://docs.sidestore.io/docs/installation/prerequisites) は明確にこう書く:

> "LocalDevVPN ... is essential for SideStore functionality. ... The VPN must remain active whenever you install, update, or refresh apps."

[SideStore docs: Install](https://docs.sidestore.io/docs/installation/install) もインストールフローの中で:

> "Open LocalDevVPN and select 'Connect'."

を必須ステップとして明記。

### LocalDevVPN とは

- App Store で配布されている独立アプリ
  - [App Store: LocalDevVPN (id6755608044)](https://apps.apple.com/us/app/localdevvpn/id6755608044)
  - GitHub mirror: [seomin0610/LocalDevVPN](https://github.com/seomin0610/LocalDevVPN)
- StosVPN ([SideStore/StosVPN](https://github.com/SideStore/StosVPN)) の後継として推奨される on-device VPN
- 機能: ループバック VPN を立ち上げて **同一デバイス内** で usbmuxd / lockdown 通信を成立させる
- 0.6.2 では旧 StosVPN が deprecate されたため、**0.6.2 stable で正規に動かすには LocalDevVPN を併用するのが正解**

### ユーザの状況に対する解釈

ユーザの観察:
- iPhone 設定 → 一般 → VPN とデバイス管理 → VPN セクション = **空**
- iPhone 設定 → VPN メニュー = **空**
- SideStore 内部にも VPN 管理 UI = **無し**

これは **致命的に異常**。LocalDevVPN を App Store からインストールしていないか、インストールしたが起動して Connect していない。SideStore 0.6.2 stable は SideStore アプリ単体では VPN profile を構成しない設計なので、**ユーザ自身が App Store から LocalDevVPN を入れて Connect する必要がある**。

VPN が無いと:
- minimuxer はデバイスに到達するための仮想ネットワークを構築できず
- 結果として AFC client の作成に失敗
- → **MinimuxerError 27 (AFC was unable to manage files / invalid pairing)** が出る

公式 [Common Issues](https://docs.sidestore.io/docs/troubleshooting/common-issues) も AFC エラーの第一の対処として "VPN と Wi-Fi の接続確認" を挙げている。

### 注意

- LocalDevVPN は **VPN プロファイル** を iOS に登録するため、Connect すると iPhone 設定 → 一般 → VPN とデバイス管理 → **VPN** セクションに `LocalDevVPN` 構成プロファイルが表示される。これが見えていないなら起動・接続できていない。
- 「LocalDevVPN を ON のまま使う」という前提は AltStore/SideStore コミュニティでよく忘れられがちな落とし穴。

---

## 5. nightly アクセス方法

### Beta Updates トグルが "No Updates Available" を返す原因

- ユーザがいる stable 0.6.2 は 2025-07-01 リリース。Settings → Enable Beta Updates → Nightly に切り替えても、**SideStore 自身の OTA 更新パスでは現在の installed version からしか上書きできず、nightly source URL が解決できないと "No Updates Available" になる**
- 公式 source URL は `https://apps.sidestore.io/apps.json` (stable) と community source。Nightly は **別の channel** で配布される

### Nightly の正しい入手方法

3 通りある:

#### A. SideStore 内で Beta channel を有効化 + Source 再フェッチ

1. Settings → Enable Beta Updates → Nightly を ON
2. Sources タブで `apps.sidestore.io` の source を pull-to-refresh
3. それでもだめなら一度 source を削除して `https://apps.sidestore.io` を再追加

→ ただしユーザは既にこれを試して失敗。

#### B. iloader から直接 Nightly IPA を sideload

1. **iloader v2.2.4 で nightly チャンネルが選べる** ことを期待:
   - 公式 install docs ([Install](https://docs.sidestore.io/docs/installation/install)) は "Install SideStore (Stable)" を案内するが、iloader UI には Stable / Nightly のドロップダウンが存在 (バージョンによる)
2. 選べない場合は手動で IPA を取得:
   - GitHub Releases: [github.com/SideStore/SideStore/releases/tag/nightly](https://github.com/SideStore/SideStore/releases/tag/nightly)
   - 最新確認済み: **0.6.3-20260412.1002+4deda922** (2026-04-12 build) — fix: source detail view crash, fix: widget
   - その前: 0.6.3-nightly.2025.11.15.25
3. iloader に IPA をドラッグして "Install IPA" or "Install Custom IPA"

#### C. SideSource (SideStore のメタソース)

- [sidestore.io/SideSource](https://sidestore.io/SideSource/index.html) は stable / beta / nightly で別々の channel を提供
- 設定: SideStore → Sources → Add Source URL → 必要なチャンネルの URL
- ただし **SideStore 0.6.2 stable は SideSource 経由の自己更新で nightly を pull する経路を持っていない可能性が高い**

### 推奨

**B が確実**。iloader v2.2.4 で SideStore Nightly IPA を直接インストールし、初回起動時に既存の SideStore 0.6.2 stable を上書き。データ移行は SideStore 公式が「stable→nightly はデータ保持を保証する」と FAQ に書いている ([FAQ](https://docs.sidestore.io/docs/faq))。

---

## 6. 同症状の解決事例

### 完全一致の解決報告は **GitHub 上には皆無**

調査した issue (#1225, #1246, #1049, #951, #1085, #737, #1262, #1197, #1186, #1174, #1194, #1226) すべてで:
- ユーザが pairing file を入れ直しても直らない
- maintainer の応答が無いか "closed as not planned"
- 解決報告のコメントが付いていない

### コミュニティで効果があったとされる手順

ブログ・YouTube ガイド・X tweet で繰り返し言及される workaround:

1. **LocalDevVPN を App Store からインストールして必ず Connect** ([silisko](https://www.silisko.com/sidestore-ios-26-setup-guide/), [ipswdl](https://ipswdl.com/blog/post/how-to-install-sidestore-livecontainer-on-ios-26/), [iphonewired](https://iphonewired.com/firmware-update/1079332/))
2. **idevice_pair (旧 jitterbugpair) から手動で pair record を生成** して SideStore に Import — Lockdown モードで生成 ([techybuff: idevice-pair-generate-pairing-file](https://techybuff.com/idevice-pair-generate-pairing-file/))
3. **SideStore Nightly に乗り換え** + RPPairing で再 pair ([ONE Jailbreak X tweet](https://x.com/onejailbreak_/status/2040354961150681389))
4. **iPhone を完全に再起動 → SideStore 起動 → LocalDevVPN Connect → SideStore 内で 7 DAYS タップ** の順序を厳守
5. **macOS 側の date/time が正確** であること、iCloud / iTunes が最新であること ([Common Issues](https://docs.sidestore.io/docs/troubleshooting/common-issues))
6. Anisette Server を変更する (SideStore Settings 内、Apple ID 認証絡みの "AFC" エラーに効くケースあり)

### YouTube ガイド

- [Fix SideStore Errors: Invalid Pairing/Server Issues/AFC Errors](https://www.youtube.com/watch?v=O7qnffhT1VQ) — Full Troubleshooting Guide
- [SOLVE Error minimuxer is not ready](https://www.youtube.com/watch?v=QQ07K-PBnmU)
- [How To Use iDevicePair (formerly jitterbugpair)](https://www.youtube.com/watch?v=U_YRzDicLkY)

→ いずれも結論は「**LocalDevVPN + RPPairing or Lockdown どちらかで pair をきれいに張り直す**」。

---

## 7. 代替 Pairing 生成手段

### A. idevice_pair (jkcoxson 製の公式推奨ツール、旧 jitterbugpair の正統後継)

- リポジトリ: [jkcoxson/idevice_pair](https://github.com/jkcoxson/idevice_pair)
- macOS バイナリ配布: [Releases](https://github.com/jkcoxson/idevice_pair/releases) v0.1.10 (2025-04-10 系)
- MacPorts: [idevice_pair](https://ports.macports.org/port/idevice_pair/details/)
- 2 モード:
  - **Lockdown** (USB pair record, 旧来形式) → SideStore 0.6.2 stable はこちら
  - **RPPairing** (iOS 17.4+ 用) → SideStore Nightly 0.6.3 + iOS 26.4 ならこちら

#### 使い方 (macOS)

```sh
# brew が無ければ binary を Releases からダウンロードして /Applications に配置
# (idevice_pair は brew formula 未提供、MacPorts のみ)

# GUI 起動 → デバイス選択 → Generate → Install (SideStore を選ぶ)
open -a idevice_pair
```

GUI で:
1. iPhone を USB 接続、ロック解除して home 画面
2. デバイスを選択
3. **Lockdown モード** を選んで Generate
4. "Install" → SideStore を選択 → AFC 経由で SideStore App Group に直接 plist を配置
5. SideStore 起動 → Settings → Pairing File が "OK" になっているか確認

### B. libimobiledevice (`idevicepair pair`)

```sh
brew install libimobiledevice
idevicepair pair          # /var/db/lockdown/<UDID>.plist が生成される
ls /var/db/lockdown/
# UDID.plist を直接 SideStore に Import (SideStore Settings → Import Pairing File)
```

ただし macOS Sequoia 15 系では **`/var/db/lockdown/` が SIP 配下** で読めないことがある。`sudo` 必要。

### C. pymobiledevice3

```sh
pipx install pymobiledevice3
pymobiledevice3 lockdown pair          # plist 生成
pymobiledevice3 lockdown info          # UDID 確認
```

→ 出力された pair record を SideStore に Import。

iOS 17+ 用に RemoteXPC / RSD 系コマンドも持つので、26.x で詰まったらこちらの方が情報量多い。

### D. AltServer 併用 (旧来手法)

AltStore 公式の AltServer で pair → SideStore に流用する方法も理論上は可能だが、AltServer 自体が iOS 26.x で動作不安定との報告あり ([altstoreio/AltStore #1677](https://github.com/altstoreio/AltStore/issues/1677))。優先度低。

---

## 8. その他の根本原因仮説

### 仮説 A: iOS 26.3.1 で Apple が AFC を強化した (推定信頼度: 低)

- iOS 26.3 / 26.3.1 のセキュリティリリースノート ([Apple Support 126346](https://support.apple.com/en-us/126346), [126604](https://support.apple.com/en-us/126604)) に lockdown / AFC 関連の明示的変更は **無い**
- 26.3 は dyld zero-day と kernel root エクスプロイト修正がメイン
- 26.3.1 は Studio Display 対応 + WebKit RSR
- → **26.3.1 で SideStore を直接潰す変更は確認できない**。26.4 で起きた lockdown 検証強化はまだ来ていない。

### 仮説 B: Free Apple ID 署名 + 自作 RN アプリ特有のブロック (推定信頼度: 低)

- IPA 自体は AirDrop で受け渡し → SideStore に投入後の **インストール時** に AFC エラー
- AFC 段階のエラーはまだ署名検証に到達していない (AFC は IPA を /var/mobile/Media/PublicStaging に書く段階)
- → 仮にこのレイヤーで失敗しているなら **IPA 内容や署名は無関係**。Free Apple ID 起因とは考えにくい
- ただし Free Apple ID は 7-day 期限と App ID 上限 (10) があり、ユーザは 4/10 と健全 → こちらも問題なし

### 仮説 C: StikDebug / StikJIT が必要 (推定信頼度: 低)

- StikDebug ([StephenDev0/StikDebug](https://github.com/StephenDev0/StikDebug)) は **JIT 有効化用** で、IPA インストール自体には不要
- 3.1.2 (2026-04-12) で iOS 26 / TXM JIT 対応強化されているが、本件はインストール失敗なので JIT 関連ではない
- → 不要

### 仮説 D: Local Network Access Permission が影響 (推定信頼度: 中)

- iOS 14+ で導入された Local Network 権限。SideStore + LocalDevVPN は loopback 通信なので **Local Network 権限を要求する**
- 設定 → プライバシーとセキュリティ → ローカルネットワーク → SideStore / LocalDevVPN が **ON** になっているか確認
- 初回起動時のダイアログを誤って「許可しない」にしたケースで AFC が失敗する報告あり
- → ユーザが見落としている可能性あり、要確認

### 仮説 E: 自動日付 & 時刻 OFF (推定信頼度: 中)

- iPhone 側の date/time が ±5 分以上ずれていると Apple ID トークンの検証や lockdown handshake が失敗する既知ケース
- SideStore docs ([Common Issues](https://docs.sidestore.io/docs/troubleshooting/common-issues)) も "コンピュータ側の date/time が正確であること" を必須条件としているが、**iPhone 側にも同じ条件が暗黙に効く**
- 設定 → 一般 → 日付と時刻 → 自動設定が ON
- → 要確認

### 仮説 F: iPhone がスリープして Wi-Fi が低電力 stand-by に入る (推定信頼度: 中)

- pair 直後にロック画面に戻して放置すると Wi-Fi 接続が一時切断され、minimuxer のループバックが落ちる
- ユーザは「ロック解除を維持」と書いているので恐らくクリア済みだが、Auto-Lock を Never にしておくとより安全

### 仮説 G: ditto で再生成した IPA が壊れた (推定信頼度: 低)

- `ditto -c -k --keepParent Seam.app Seam.ipa` は正規の手順 (zip 圧縮、`__MACOSX` 含まない)
- 5番目のエラー "data couldn't be read because it isn't in the correct format" は **Payload/ ディレクトリ構造** か **Info.plist** の問題で発生する
- 一度直っているなら IPA 自体は OK の可能性が高いが、再現するなら以下も試す:
  ```sh
  cd /path/with/Payload
  zip -r Seam.ipa Payload          # ditto ではなく zip コマンド
  ```
- ipa の中身検証: `unzip -l Seam.ipa | head` で `Payload/Seam.app/Info.plist` が見えること

### 仮説 H: iloader v2.2.4 と SideStore 0.6.2 のバージョン断層 (推定信頼度: 高 ★)

- 既述の通り、iloader v2.2.4 は **2026-04-12 リリース** で iOS 26.4 の RPPairing を主戦場として開発されている
- SideStore 0.6.2 は **2025-07-01 リリース** で当時 iOS 26 系は存在しなかった
- iloader が「Place In All Apps」で配置するのが RPPairing 形式の plist だった場合、SideStore 0.6.2 stable の minimuxer は読み込みできない
- → **iloader を旧バージョン (v2.1.x など) に下げて Lockdown 形式 pair を強制配置すれば 0.6.2 stable でも通る可能性がある**
- ただしこれは推測ベース。確実な解は **SideStore Nightly 0.6.3 にアップグレードして RPPairing/Lockdown 両対応にする** 方。

---

## 結論: 今この瞬間に試すべき具体的手順 (優先度順)

各ステップを **試したら結果を必ず確認** し、ダメなら次に進む。

### ⭐ Step 1: LocalDevVPN を入れて Connect する (最優先・90% これが原因)

1. iPhone の App Store で **LocalDevVPN** を検索してインストール
   - 直リンク: [apps.apple.com/us/app/localdevvpn/id6755608044](https://apps.apple.com/us/app/localdevvpn/id6755608044)
2. LocalDevVPN を起動
3. 画面の **Connect** ボタンをタップ
4. iOS が「VPN 構成を追加しますか？」と聞いてくるので **許可** + パスコード入力
5. 接続後、iPhone 設定 → 一般 → VPN とデバイス管理 → **VPN** セクションに `LocalDevVPN` が表示されることを確認
6. iPhone 設定 → **VPN** トグルが ON で接続済みステータスを確認 (右上に VPN アイコン)
7. **そのまま LocalDevVPN は起動・接続したまま** SideStore を開く
8. SideStore で Seam.ipa の Install を再試行

→ **これだけで MinimuxerError 27 が解消する見込みが最も高い**。

### Step 2: Local Network Permission と日付/時刻を確認

1. iPhone 設定 → プライバシーとセキュリティ → **ローカルネットワーク**
   - SideStore = ON
   - LocalDevVPN = ON
2. iPhone 設定 → 一般 → 日付と時刻 → **自動設定** = ON
3. macOS 側もシステム設定 → 一般 → 日付と時刻 → 自動設定 = ON

### Step 3: idevice_pair で Lockdown 形式 pair を強制生成 (iloader を信用しない)

```sh
# https://github.com/jkcoxson/idevice_pair/releases から
# idevice_pair-macos-aarch64.dmg を取得
open ~/Downloads/idevice_pair-*.dmg
# /Applications に dragdrop
open -a idevice_pair
```

GUI で:
1. iPhone を USB 接続 (Lightning / USB-C どちらでも) + ロック解除 + ホーム画面
2. デバイス選択
3. **Lockdown モード** を選択 (RPPairing ではなく)
4. Generate → Install → SideStore を選ぶ
5. SideStore を再起動して Settings → Pairing File が緑チェック

### Step 4: SideStore Nightly 0.6.3 に乗り換える

stable 0.6.2 が iOS 26 系で不安定なら、**RPPairing 対応の Nightly に上げる** のが正攻法:

1. macOS で iloader を起動
2. デバイス選択 → **Install SideStore (Nightly)** を選択
   - もしくは [GitHub Releases nightly](https://github.com/SideStore/SideStore/releases/tag/nightly) から最新 IPA (現時点 `0.6.3-20260412.1002+4deda922`) をダウンロード
   - iloader → Install Custom IPA で当該 IPA を投入
3. Apple ID 再ログイン → LocalDevVPN 起動 → Seam.ipa 再インストール

注意: Nightly は **設計通り不安定** ([FAQ](https://docs.sidestore.io/docs/faq))。本番常用は非推奨だが PoC 検証フェーズなら問題ない。

### Step 5: iloader v2.2.4 をダウングレード (Step 4 でもダメなら)

iloader v2.2.4 が SideStore 0.6.2 stable と非互換の RPPairing を吐いている疑い。古いバージョンに戻す:

1. brew で入れたなら `brew uninstall iloader`
2. [GitHub Releases](https://github.com/nab138/iloader/releases) から **v2.0.x or v1.x** の macOS バイナリを取得
3. 旧 iloader で Manage Pairing File → Lockdown 形式で再配置

### Step 6: Maestro / Xcode で代替インストール (最終手段)

PoC 目的が「実機で動作確認」なら、本来 SideStore は必須ではない:

- **Xcode で直接 Run** (本書の文脈ではこれは可能と書かれているので問題なくできるはず)
- **Expo Go + EAS Update** で開発ビルドを iPhone に流す
- **TestFlight (Apple Developer Program $99/year)** で正規配布
  - PoC 段階でこれを払うのは過剰だが、「SideStore で詰まり続けるくらいなら 99 ドル払う」と割り切るのも合理的

### 最悪シナリオと見切り

もし Step 1-5 をすべて試しても解消しないなら、以下が有力:

> **現時点で SideStore stable 0.6.2 で iOS 26.3.1 + Free Apple ID + ユーザ作成 IPA をインストールするのは不安定。**
> **公式の安定版 (0.6.3 stable 相当) が iOS 26 系を完全サポートする日まで待つ必要がある可能性がある。** その場合の代替案は Xcode 直 Run か TestFlight。

iOS 26.4 用の RPPairing 対応 stable がいつ出るかは [SideStore Releases](https://github.com/SideStore/SideStore/releases) を watch するしかない。2026-04-26 時点では未リリース。

---

## 参考リンク (主要なもの)

### SideStore 公式
- [Error Codes](https://docs.sidestore.io/docs/troubleshooting/error-codes)
- [Common Issues](https://docs.sidestore.io/docs/troubleshooting/common-issues)
- [Pairing File](https://docs.sidestore.io/docs/advanced/pairing-file)
- [Prerequisites](https://docs.sidestore.io/docs/installation/prerequisites)
- [Install](https://docs.sidestore.io/docs/installation/install)
- [Release Notes](https://docs.sidestore.io/docs/release-notes)
- [FAQ](https://docs.sidestore.io/docs/faq)
- [GitHub Releases (stable)](https://github.com/SideStore/SideStore/releases)
- [GitHub Releases (nightly)](https://github.com/SideStore/SideStore/releases/tag/nightly)
- [SideStore main repo](https://github.com/SideStore/SideStore)

### GitHub Issues (本件と直接関連)
- [#1225 AFC minimuxer.MinimuxerError 27](https://github.com/SideStore/SideStore/issues/1225)
- [#1246 minimuxer.minimuxer error 27](https://github.com/SideStore/SideStore/issues/1246)
- [#1049 minimuxer.MinimuxerError code=27](https://github.com/SideStore/SideStore/issues/1049)
- [#951 AFC invalid pairing](https://github.com/SideStore/SideStore/issues/951)
- [#1085 AFC Invalid Pairing](https://github.com/SideStore/SideStore/issues/1085)
- [#737 AFC unable to manage files](https://github.com/SideStore/SideStore/issues/737)
- [#1186 Pairing fails on iOS/iPadOS 26 Developer Beta 2](https://github.com/SideStore/SideStore/issues/1186)
- [#1262 SideStore could not determine UDID (iloader)](https://github.com/SideStore/SideStore/issues/1262)
- [#1197 SideStore could not determine UDID](https://github.com/SideStore/SideStore/issues/1197)
- [#1112 SideStore could not determine UDID](https://github.com/SideStore/SideStore/issues/1112)
- [#1174 iOS 26.4 cant refresh apps](https://github.com/SideStore/SideStore/issues/1174)
- [#1194 26.4 beta 2 cant refresh](https://github.com/SideStore/SideStore/issues/1194)
- [#1226 Unable to refresh in Sidestore](https://github.com/SideStore/SideStore/issues/1226)
- [#1229 RRpairing for SideStore (feature request)](https://github.com/SideStore/SideStore/issues/1229)
- [LiveContainer/LiveContainer #1009 SideStore could not determine UDID](https://github.com/LiveContainer/LiveContainer/issues/1009)
- [LiveContainer/LiveContainer #1152 iOS 26.4 compatibility](https://github.com/LiveContainer/LiveContainer/issues/1152)

### iloader / idevice_pair / minimuxer
- [nab138/iloader](https://github.com/nab138/iloader)
- [iloader.app](https://iloader.app/)
- [iloader.site/docs](https://iloader.site/docs/)
- [jkcoxson/idevice](https://github.com/jkcoxson/idevice)
- [jkcoxson/idevice_pair](https://github.com/jkcoxson/idevice_pair)
- [idevice_pair Releases](https://github.com/jkcoxson/idevice_pair/releases)
- [DeepWiki: idevice_pair Pairing File Management](https://deepwiki.com/jkcoxson/idevice_pair/4.3-pairing-file-management)
- [DeepWiki: minimuxer Error Types](https://deepwiki.com/jkcoxson/minimuxer/8.2-error-types-reference)

### LocalDevVPN / StosVPN
- [App Store: LocalDevVPN](https://apps.apple.com/us/app/localdevvpn/id6755608044)
- [seomin0610/LocalDevVPN](https://github.com/seomin0610/LocalDevVPN)
- [SideStore/StosVPN](https://github.com/SideStore/StosVPN)

### iOS / Apple
- [Apple Support: iOS 26.3 security content](https://support.apple.com/en-us/126346)
- [Apple Support: iOS 26.3.1 Background Security Improvements](https://support.apple.com/en-us/126604)
- [Apple Releases iOS 26.3.1 (9to5Mac)](https://9to5mac.com/2026/03/04/apple-releases-ios-26-3-1/)
- [Apple Releases iOS 26.3.1 (MacRumors)](https://www.macrumors.com/2026/03/04/apple-releases-ios-26-3-1/)
- [BetaWiki: iOS 26.3.1 build 23D8133](https://betawiki.net/wiki/IOS_26.3.1_build_23D8133)
- [Apple Targets SideStore Signing in iOS 26.4 Beta](https://onejailbreak.com/blog/apple-targets-sidestore-signing-in-ios-26-4-beta/)
- [@onejailbreak_ X tweet on iOS 26.4 lockdown changes](https://x.com/onejailbreak_/status/2025485633028776110)
- [@onejailbreak_ X tweet on SideStore Nightly RPPairing](https://x.com/onejailbreak_/status/2040354961150681389)

### コミュニティガイド
- [silisko: SideStore iOS 26 Setup Guide](https://www.silisko.com/sidestore-ios-26-setup-guide/)
- [ipswdl: How to Install SideStore + LiveContainer on iOS 26 (2026)](https://ipswdl.com/blog/post/how-to-install-sidestore-livecontainer-on-ios-26/)
- [techybuff: idevice-pair Generate Pairing File](https://techybuff.com/idevice-pair-generate-pairing-file/)
- [iphonewired: Install SideStore + LiveContainer iOS 26](https://iphonewired.com/firmware-update/1079332/)
- [techacrobat: Install SideStore iOS 26 NO PC](https://www.techacrobat.com/download-sidestore/)
- [Lan Tian: Using SideStore without StosVPN across LAN](https://lantian.pub/en/article/modify-computer/sidestore-without-stosvpn-across-lan.lantian/)
- [Gist: Installing LiveContainer+SideStore from start to finish](https://gist.github.com/sinceohsix/688637ac04695d1ff38f844acc8ba7f3)
- [YouTube: Fix SideStore Errors Full Troubleshooting Guide](https://www.youtube.com/watch?v=O7qnffhT1VQ)
- [YouTube: How To Use iDevicePair (formerly jitterbugpair)](https://www.youtube.com/watch?v=U_YRzDicLkY)
