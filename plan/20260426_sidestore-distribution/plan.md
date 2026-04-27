# Execution Plan: SideStore で Seam を個人 iPhone に Free Apple ID 配布する

最終更新: 2026-04-26
リサーチ成果物:
- [context7-doc-researcher.md](./context7-doc-researcher.md)
- [codebase-investigator.md](./codebase-investigator.md)
- [web-research-agent.md](./web-research-agent.md)
- [claude-web-researcher.md](./claude-web-researcher.md)

---

## Summary

Seam（Expo SDK 54 + RN 0.81.5 New Architecture / Hermes）を、Apple Developer Program 未加入のまま個人 iPhone に **SideStore + Free Apple ID** で焼き、7日ごとのバックグラウンド再署名で運用する。Hermes は JIT を必要としないため StikDebug などのデバッグ系コンパニオンは不要、構成は最小化できる。本リポジトリには `aps-environment` entitlement と SDK52 時代の Pods が残っており、まずそこを掃除しないと Free 署名で archive が通らない。

---

## Research Insights

### Official Documentation（context7）

- **Expo SDK 54 / RN 0.81 ビルド要件**: Xcode 16.1 以上、Node 20.19.4 以上、iOS Deployment Target 15.1（既設）。New Architecture は RN 0.76 以降デフォルト ON。
- **`eas build --local` は Free Apple ID 環境での挙動が公式に明示されていない** → 公式は依然として「Archive → Export Development」が確実、と推奨。
- **Free Apple ID (Personal Team) の制限**: 7日有効、同時 3 アプリ、7日に App ID 10 個まで、**Push Notifications capability は不可**（`aps-environment` を持つ entitlement は署名失敗）。CloudKit / Associated Domains / Sign in with Apple なども不可（Seam は未使用）。
- **expo-notifications**: ローカル通知のみの利用でも `aps-environment` を勝手に付与するケースが報告されている（[expo#27668](https://github.com/expo/expo/issues/27668)）。Free 署名のためには明示除去が必要。
- **SideStore 公式（stable 0.6.2 / 2025-07-01）**: iOS 15.0–26.x をサポート、初回のみ PC が必要（`iloader` 経由で SideStore 自身をインストール）、その後は iPhone 単体で `.ipa` を取り込み可能。LocalDevVPN または StosVPN で7日 refresh を起動。

### Codebase Analysis（codebase-investigator）

#### 即対応が必要な3点

1. **Pods が SDK 52 のまま** — JS は Expo 54 / RN 0.81.5 (`pnpm-lock.yaml:2771,3794`) なのに `Podfile.lock:13` は Expo 52.0.49、`:122` は React-Core 0.76.9。`pnpm prebuild --clean` & `pod install` を再実行しない限り Release archive が通らない / 起動時クラッシュする。
2. **`aps-environment = development` が残存** — `packages/app/ios/Seam/Seam.entitlements:5-6` に Push 用 entitlement。Free Apple ID では署名不可。Seam は `notificationManager.ts` 内で `Notifications.scheduleNotificationAsync` のみ使用、`getDevicePushTokenAsync` 系は0件 → 削除して機能影響なし。
3. **Code Signing 未設定** — `project.pbxproj:172-179` の `TargetAttributes` に `ProvisioningStyle`/`DevelopmentTeam` なし、buildSettings にも `DEVELOPMENT_TEAM`/`CODE_SIGN_STYLE` キー0件 → Xcode で Personal Team を初回手動割り当てが必要。

#### Free 配布にプラスに働いている既存設定

- `Podfile:57-64` の `post_install` で全 resource bundle に `CODE_SIGNING_ALLOWED = NO` を強制 → Free Personal Team で resource bundle が署名失敗する典型問題を **最初から回避**。
- iOS Deployment Target **15.1** (`project.pbxproj:360`)、`TARGETED_DEVICE_FAMILY = 1`（iPhone のみ）、`ENABLE_BITCODE = NO`、Hermes 有効（`Podfile.properties.json:2`）— Free 署名で素直に archive できる方向。
- データ層は完全に sandbox `Documents/` 配下（`db/client.ts` の `openDatabaseSync('seam.db')`、`photos/savePhoto.ts:11` の `FileSystem.documentDirectory`）→ SideStore の7日 Refresh はバンドルの再署名のみでデータ領域は触らないため、データ消失リスクなし。

#### 軽微な不整合

- `app.json:5` の `version: "0.0.1"` と `project.pbxproj:362,390` の `MARKETING_VERSION = 1.0` がずれている（Info.plist は `0.0.1`）。正式リリース化に合わせて統一推奨。

### Web Research（web-research-agent + claude-web-researcher 統合）

#### SideStore 周辺の最新動向（2026-04 時点）

| 項目 | 最新 |
|---|---|
| SideStore stable | **0.6.2**（2025-07-01、9ヶ月停滞） |
| SideStore nightly/alpha | **0.6.3-alpha**（2026-04-12） |
| iloader（旧 AltServer 相当） | **v2.2.4**（2026-04-12） |
| Pairing 取得ツール | iloader が `jitterbugpair` を内包 |
| 7日 refresh の中継 | **StosVPN**（SideStore 0.6.3 で内蔵化） |

- 0.6.0 は壊れているため使用禁止（公式警告）。
- **iOS 26.4 で Apple が lockdownd の接続検証を変更し refresh が一時的に破壊された**（[#1222](https://github.com/SideStore/SideStore/issues/1222)）。alpha 系では既に対応済。安定運用するなら現状の iOS バージョンと SideStore チャンネル（stable / nightly）の組合せに気を付ける必要あり。
- **Hermes は JIT 不要** → Seam は StikDebug や VPN-JIT 仕組みを併用しなくてよい。
- 公衆 anisette サーバは過去複数回ダウン → 安定運用したいなら自前 anisette（[Dadoum/anisette-v3-server](https://github.com/Dadoum/anisette-v3-server)）を Fly.io 等にホスティングするのが最も堅い（ただし最初は公衆で十分）。

#### Free Apple ID で `.ipa` を作る正しいやり方

- Personal Team では Xcode の `Distribute App` から App Store / Ad Hoc IPA を出せない。
- **しかし SideStore は受け取った IPA を iPhone 上で再署名する** ので、Distribute は本来不要。
- 正攻法: `Product > Archive` → `.xcarchive` を Finder で展開 → `Products/Applications/Seam.app` を取り出し → `Payload/Seam.app/` 構造で zip → 拡張子を `.ipa` に変更。

#### 既知の地雷

- IPA 作成時に **"Remove App Extensions" を選ぶと Roxas.framework クラッシュ** ([#861](https://github.com/SideStore/SideStore/issues/861)) → "Keep App Extensions" を維持。
- SideStore のホーム画面ウィジェット併用で refresh 後クラッシュ ([#493](https://github.com/SideStore/SideStore/issues/493))。
- StosVPN の自動切断で refresh が silently fail することがある ([#1046](https://github.com/SideStore/SideStore/issues/1046))。
- Bundle ID を変えると Apple ID 10/週上限を消費する → 今の `com.sugarshin.seam` を固定。
- AltStore PAL は 2025-12-18 に日本ローンチしたが、**Notarize 必須** で自作アプリ配布には使えない。Seam 用途には Classic か SideStore のいずれか。

---

## Recommended Approach

### フェーズ A: ビルドの土台を整える（コード変更を伴う、約30分）

> **このフェーズは現リポジトリのコード/ネイティブプロジェクトに変更が入る。**

**A-1. Pods を SDK 54 に揃える**
- `cd packages/app && pnpm prebuild --clean`
- 注意: prebuild は `ios/` 全体を再生成するため、Xcode で手動編集した署名設定は飛ぶ。署名はフェーズ B でやる。
- 完了後、`Podfile.lock` の主要バージョンが Expo 54.x / React-Core 0.81.x に上がっていることを確認。

**A-2. APNs entitlement を除去**
- `packages/app/ios/Seam/Seam.entitlements` から `aps-environment` を削除。
- ただし `prebuild --clean` で再生成されるため、再発防止のため `app.json` 側で expo-notifications プラグインの設定を確認し、Push 関連 entitlement を付けない構成にする。
- 候補:
  - `app.json` の `ios` に `entitlements: {}` を明示し、Push 系を expo の自動付与から外す。
  - もしくは `expo-build-properties` プラグインで `usesAppleSignIn=false` 等の不要 capability を抑制。
- 最終手段: prebuild 後・archive 前に `Seam.entitlements` から `aps-environment` を消す手順をスクリプト化（`scripts/strip-push-entitlement.sh` など）。
- **検証**: `Notifications.scheduleNotificationAsync` 系のローカル通知が Free 署名アプリで動くこと（実機で要確認）。

**A-3. バージョン整合**
- `app.json` の `version` を `1.0.0` に上げる（最初の正式リリース）。
- `expo prebuild` が `MARKETING_VERSION` と Info.plist `CFBundleShortVersionString` を `version` から自動生成するため、`prebuild --clean` 後は揃う想定。揃っていなければ `app.json` の `ios.buildNumber` も明示。
- Git tag `v1.0.0` を打って後から「初リリース時のソース」を辿れるように。

### フェーズ B: 初回の Release ビルド（Mac で1回、約30分）

**B-1. Xcode で Personal Team 署名を割り当てる**
- `cd packages/app && open ios/Seam.xcworkspace`
- `Seam` ターゲット → Signing & Capabilities
- Team: 自分の Apple ID（Personal Team）
- Bundle Identifier: `com.sugarshin.seam`（変えない）
- もし `com.sugarshin.seam` が他人と衝突して Apple に App ID 登録できない場合のみ `com.<github-id>.seam.personal` 等にリネーム（ただしこれは10/週枠を1個消費する）。
- Capabilities タブで Push Notifications 系を **追加しない**こと。

**B-2. Archive と Export**
- Scheme: `Seam`、Configuration: **Release**
- デバイス選択: **Any iOS Device (arm64)**
- `Product > Archive`（5〜10分）
- Organizer が開いたら、Distribute App ではなく **Show in Finder** で `.xcarchive` を取り出し
- `.xcarchive/Products/Applications/Seam.app` を `Payload/` ディレクトリに入れて `Payload/` を zip → 拡張子 `.zip` を `.ipa` に変更

```sh
# .xcarchive を見つけたあとの定型操作（ipa 化）
ARCHIVE=~/Library/Developer/Xcode/Archives/2026-04-26/Seam\ 26-4-26\ HH.MM.xcarchive
WORK=$(mktemp -d)
mkdir "$WORK/Payload"
cp -R "$ARCHIVE/Products/Applications/Seam.app" "$WORK/Payload/"
( cd "$WORK" && zip -ry Seam.ipa Payload )
mv "$WORK/Seam.ipa" ~/Downloads/Seam.ipa
```

- **App Extensions は削除しない**（Roxas.framework クラッシュ予防）。

### フェーズ C: SideStore 環境のセットアップ（初回のみ、約30分）

**C-1. iPhone 側準備**
- SideStore 自身を iloader でインストール（公式 https://docs.sidestore.io/docs/installation/install ）。
- macOS 側で `iloader v2.2.4`（https://github.com/SideStore/iloader/releases ）をダウンロード。
- iPhone を USB-C / Lightning で Mac に接続し、iPhone 側で「このコンピュータを信頼」。
- `iloader` を Mac で起動 → Apple ID 認証（**App 用パスワード**を appleid.apple.com で発行して使うこと、生パスワードは不可）。
- `iloader` が **Pairing File** と **SideStore.ipa** を書き込み、iPhone のホームに SideStore が登場。
- iPhone 側で 設定 > 一般 > VPN とデバイス管理 → 自分の Apple ID プロファイルを **信頼**。

**C-2. SideStore の初期設定**
- SideStore アプリを起動 → 同じ Apple ID + App 用パスワードでサインイン。
- Anisette サーバ: 初期は公衆サーバ（NicholiAtKish 等）で十分。後述の堅牢化で自前に変更可。
- バージョン選択:
  - 安定優先 → **stable 0.6.2**
  - iOS 26.4 を使っている / nightly の修正が必要 → **0.6.3 alpha** に切り替え
- Refresh 用 VPN: 内蔵 LocalDevVPN（or StosVPN）を ON。

**C-3. Seam.ipa を SideStore に投入**
- `~/Downloads/Seam.ipa` を AirDrop or iCloud Drive 経由で iPhone に送る。
- iPhone の Files アプリから SideStore で開く（or SideStore 内の "+" から選択）。
- "Keep App Extensions" を選択（"Remove" にしない）。
- インストール完了 → ホーム画面に Seam が登場、起動して動作確認。

### フェーズ D: 7日 Refresh 運用（毎日0手 〜 週1の最小手）

- StosVPN（or LocalDevVPN）が常時 ON で、iPhone が WiFi に繋がっている時間にバックグラウンドで再署名される。
- **理想**: ユーザーは何もしない。週1で SideStore アプリを開いて "My Apps" の残り日数を確認するだけ。
- silently fail 対策として、**6日目に手動 Refresh を1回実行する**運用を週1の習慣にする（30秒で済む）。
- iPhone と Mac の同 WiFi は不要（SideStore は Apple サーバ経由で自己完結する）。

### フェーズ E: 将来的な堅牢化（任意、必要になったら）

- **自前 anisette サーバ**: 公衆 anisette がダウンしたら、[Dadoum/anisette-v3-server](https://github.com/Dadoum/anisette-v3-server) を Fly.io / Render に立てて SideStore の anisette 設定で URL を差し替え。
- **3アプリ枠の節約**: SideStore + Seam で2枠。残り1枠を別アプリに使う場合、[LiveContainer](https://github.com/LiveContainer/LiveContainer) でゲストアプリを動かして枠節約する選択肢あり（やりすぎなので最初は不要）。
- **アップデート手順のスクリプト化**: フェーズ B のアーカイブ → IPA 化を `scripts/build-sidestore-ipa.sh` 等に落とし込み、`pnpm sideload:build` 一発で `.ipa` が出る状態に。

---

## Risks & Mitigations

| リスク | 確度 | 影響 | 対策 |
|---|---|---|---|
| `aps-environment` 残存で archive が署名失敗 | 高 | archive 不可 | フェーズ A-2 で必ず除去・自動再付与の防止 |
| Pods が SDK52 のままで起動クラッシュ | 高 | 起動不可 | フェーズ A-1 の `prebuild --clean` 必須 |
| iOS 26.4 で refresh 失敗 | 中 | 7日後に起動不可 | nightly 0.6.3 にチャンネル切替 / iOS バージョンに注意 |
| 公衆 anisette サーバ障害で sign-in / refresh 不可 | 中 | refresh 失敗 | 障害が連発したらフェーズ E で自前 anisette |
| Bundle ID 衝突で App ID 登録不可 | 低 | リネーム必要 | 衝突したら `com.<id>.seam.personal` 等に変更（10/週枠を1消費） |
| 7日 refresh が silently fail | 中 | 起動不可 | 週1で手動 Refresh を習慣化、StosVPN 常時 ON |
| iOS major upgrade（例: 27.0）で SideStore 非対応 | 低 | 一時的に新規 install 不可 | OS upgrade を急がない、SideStore alpha/nightly を待つ |
| App 用パスワード漏洩で Apple ID 経由で逆侵入 | 低 | アカウント侵害 | App 用パスワードは SideStore 専用に発行・使い回さない |
| `prebuild --clean` で Xcode 手動設定が消える | 高 | 毎回再設定 | Personal Team 設定は `app.json`/プラグインで自動化、もしくは prebuild 後に流す script を用意 |
| Free 7日縛りが将来更に厳しくなる | 低 | 移行必要 | その時点で AltStore Classic / 有料 Developer Program に切替 |
| データ消失（refresh 失敗・iOS 復元時など） | 低 | 試着・購入記録ロスト | `src/backup/` の JSON/CSV エクスポートを月1で iCloud に保存 |

---

## Open Questions

1. **iPhone の iOS バージョンは何？** — iOS 26.4 を使っているなら SideStore は alpha 系を選ぶ判断になる。最新の OS なら nightly 必須、安定運用なら 26.3 等に留まる選択もある。
2. **Apple ID は普段使いと同じものを使うか？** — App 用パスワードでスコープを切れば実害は小さいが、心理的に分けたいなら専用 Apple ID を新規作成する選択もある（その場合 Pairing も別 ID で）。
3. **`expo-notifications` プラグインで自動付与される `aps-environment` をどう抑制するのが正解か？** — 公式 issue ([#27668](https://github.com/expo/expo/issues/27668)) によると `app.json` の `ios.entitlements` での明示上書きで解決した報告あり。フェーズ A-2 で実装する具体的方法を最初の数回の prebuild で固める必要がある。
4. **Mac の Xcode から `.ipa` を作る作業を将来 GitHub Actions に移すか？** — Free Apple ID は CI から扱いにくい（App 用パスワード + 端末ペアリングが要るため）。当面はローカル運用で十分。
5. **`expo-secure-store` の Keychain Access Group は Free 署名で問題ないか？** — `Seam.entitlements` の `keychain-access-groups` の値次第。 Personal Team 署名で衝突しないか archive で要確認。

---

## Next Steps

優先順に整理。

### P0（着手即時、フェーズ A）
1. `cd packages/app && pnpm prebuild --clean` を実行し、Pods を SDK 54 系に揃える
2. `Seam.entitlements` から `aps-environment` を除去し、ローカル通知が動作することを実機で確認
3. `app.json` の `ios.entitlements` を明示し、`prebuild` 再実行で Push が再付与されないことを確認
4. `app.json:version` を `1.0.0` に更新

### P1（Mac 1台で完結、フェーズ B-C）
5. Xcode で Personal Team を割り当て、Release Archive を作成
6. `.xcarchive` から `Payload/Seam.app` 形式で `.ipa` をパッケージング（Roxas クラッシュ予防に Extensions は保持）
7. iloader v2.2.4 で iPhone に SideStore（stable 0.6.2 or alpha 0.6.3）を導入
8. SideStore に Seam.ipa を投入してホーム画面で起動確認

### P2（運用安定化、フェーズ D）
9. StosVPN（or LocalDevVPN）常時 ON 設定
10. 6日目 manual Refresh の週次タスクをカレンダー登録
11. `src/backup/` の JSON エクスポートを月1で iCloud に取る習慣化

### P3（将来の品質向上、フェーズ E）
12. `scripts/build-sidestore-ipa.sh`（archive → ipa 化を1コマンド化）
13. 公衆 anisette が不安定なら Fly.io に anisette-v3-server を立てる
14. リリース毎の `.ipa` を GitHub Releases に添付（自分用バックアップ・端末再ペア時の素材）

---

## 参考: 1コマンドでの再リリース手順（フェーズ A-D 完了後）

```sh
# 1. ソース更新後（ローカル）
cd packages/app
pnpm prebuild --clean    # 必要に応じて
# Xcode で Archive → ipa 化 → AirDrop で iPhone へ送信
# SideStore で開く → Keep Extensions → 上書きインストール
```

通常のコード変更だけなら prebuild --clean は不要、Archive のみでも `.ipa` は更新できる。
