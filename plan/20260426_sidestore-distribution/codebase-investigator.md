# 調査結果

調査対象: Seam リポジトリ (`/Users/shingosato/dev/src/github.com/sugarshin/seam`)
目的: SideStore + Free Apple ID 署名で Release `.ipa` を作るための iOS ビルド準備状況の可視化
調査日: 2026-04-26

---

## A. Expo 設定

### A-1. `packages/app/app.json` 全フィールド

`packages/app/app.json` (1-29行) より：

```json
{
  "expo": {
    "name": "Seam",
    "slug": "seam",
    "version": "0.0.1",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "seam",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "splash": { "backgroundColor": "#000000" },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.sugarshin.seam"
    },
    "plugins": [
      "expo-router",
      "expo-sqlite",
      "expo-image-picker",
      "expo-notifications",
      "expo-secure-store"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

SideStore 配布観点での評価：

| 項目 | 値 | 場所 | SideStore 配布での意味 |
| --- | --- | --- | --- |
| `ios.bundleIdentifier` | `com.sugarshin.seam` | `app.json:16` | Free Apple ID 署名でも問題なし。**ただし** Free Apple ID は 7日でプロビジョニング失効するので、SideStore 経由で再署名する際は同じ Bundle ID で上書きされる前提。 |
| `ios.supportsTablet` | `false` | `app.json:15` | iPhone 専用。問題なし。 |
| `newArchEnabled` | `true` | `app.json:10` | New Arch 有効。Hermes + Fabric/TurboModules で動作。SideStore 配布自体には影響しないが、Release ビルドで `.ipa` 中の Hermes/Fabric ライブラリのサイズ・コード署名対象が増える点に留意。 |
| `experiments.typedRoutes` | `true` | `app.json:26` | 型生成のみで実機ビルドには影響しない。 |
| `plugins` | `expo-router`, `expo-sqlite`, `expo-image-picker`, `expo-notifications`, `expo-secure-store` | `app.json:18-24` | **すべてオブジェクト形式ではなく文字列形式**。`expo-notifications` プラグインは APNs 用 entitlement / `aps-environment` を要求する設定（モード/icon等のオプション）が**書かれていない**ので、デフォルトの prebuild 結果のみ反映。 |

> 注: `app.json` に `ios.entitlements` フィールドが**存在しない**。つまり Push Notifications/CloudKit/App Groups を Expo 側から要求していない。

### A-2. `eas.json`

`packages/app/eas.json` は **存在しない**（`ls` で確認）。EAS Build は使っていない。SideStore 用にローカル `xcodebuild archive` するか、もしくは Xcode GUI から Archive する設計と整合する。

### A-3. `packages/app/babel.config.js` の inline-import

`packages/app/babel.config.js` (1-10行)：

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: [
      ['inline-import', { extensions: ['.sql'] }],
      'react-native-reanimated/plugin',
    ],
  };
};
```

- `babel-plugin-inline-import` は `.sql` 拡張子を対象に有効化されている（6行目）。
- `packages/app/src/db/migrate.ts` (1-5行) で `import migrations from './migrations/migrations'` し、`migrations.js` がさらに `.sql` を inline import するため、Release `.ipa` でもファイルシステム不要で migration が走る前提。Metro 側でも `metro.config.js:20` で `sourceExts` に `'sql'` を追加して整合。

---

## B. ネイティブ iOS プロジェクト

### B-1. `packages/app/ios/Seam.xcodeproj/project.pbxproj`

| 項目 | Debug 値 | Release 値 | ファイル:行 |
| --- | --- | --- | --- |
| `PRODUCT_BUNDLE_IDENTIFIER` | `com.sugarshin.seam` | `com.sugarshin.seam` | `project.pbxproj:369`, `:397` |
| `CODE_SIGN_ENTITLEMENTS` | `Seam/Seam.entitlements` | `Seam/Seam.entitlements` | `project.pbxproj:352`, `:385` |
| `CODE_SIGN_IDENTITY[sdk=iphoneos*]` | `iPhone Developer` | `iPhone Developer` | `project.pbxproj:434`, `:497` |
| `IPHONEOS_DEPLOYMENT_TARGET` | `15.1` | `15.1` | `project.pbxproj:360`, `:388`, `:453`, `:509` |
| `MARKETING_VERSION` (CFBundleShortVersionString) | `1.0` | `1.0` | `project.pbxproj:362`, `:390` |
| `CURRENT_PROJECT_VERSION` (CFBundleVersion) | `1` | `1` | `project.pbxproj:353`, `:386` |
| `TARGETED_DEVICE_FAMILY` | `1` (iPhone only) | `1` | `project.pbxproj:374`, `:401` |
| `ENABLE_BITCODE` | `NO` | (未指定 = 既定 NO) | `project.pbxproj:354` |
| `SWIFT_VERSION` | `5.0` | `5.0` | `project.pbxproj:373`, `:400` |
| `USE_HERMES` | `true` | `true` | `project.pbxproj:465`, `:519` |
| `defaultConfigurationName` | (両方とも) `Release` | | `project.pbxproj:534`, `:543` |

#### 署名 Style と Development Team

`project.pbxproj:172-179`:

```
attributes = {
    LastUpgradeCheck = 1130;
    TargetAttributes = {
        13B07F861A680F5B00A75B9A = {
            LastSwiftMigration = 1250;
        };
    };
};
```

- `ProvisioningStyle` キー (`Manual` / `Automatic`) も、`DevelopmentTeam` キーも `TargetAttributes` に**入っていない**。
- `buildSettings` 配下にも `DEVELOPMENT_TEAM`, `PROVISIONING_PROFILE`, `PROVISIONING_PROFILE_SPECIFIER`, `CODE_SIGN_STYLE` のキーは出現せず（`grep` で 0 件）。
- これは Expo prebuild のデフォルト出力のままで、**Xcode で開いた時点で「Automatic / Team 未設定」状態**。SideStore 用の Free Apple ID で初めて Xcode に Apple ID を追加し、ターゲットに割り当てる必要がある。
- `CODE_SIGN_IDENTITY[sdk=iphoneos*] = "iPhone Developer"` (`project.pbxproj:434`, `:497`) は古い (Xcode 13 以前互換の) 表記だが、Xcode 15+ では自動で `Apple Development` に解決される。Free Apple ID で署名する場合、Xcode が `Apple Development: <your-email> (XXXXXXXXXX)` を発行して使う。

#### Scheme

`packages/app/ios/Seam.xcodeproj/xcshareddata/xcschemes/Seam.xcscheme` (1-89行)：

- `BuildAction.parallelizeBuildables = "YES"`, `buildImplicitDependencies = "YES"` (3-7行)。
- Archive build configuration: `Release` (`Seam.xcscheme:84-87`)。
- `revealArchiveInOrganizer = "YES"` (`Seam.xcscheme:86`) なので Archive 完了後 Organizer が開く。**SideStore 向けには Organizer から "Distribute App > Custom > Development" or "Ad-Hoc" → IPA 化、ではなく `xcodebuild -exportArchive` か Organizer の "Distribute App > Custom > Copy App"**（あるいは手動で `.xcarchive` 中の `.app` を `Payload/` に詰めて `.ipa` にする）の使い分けが必要。
- Workspace `Seam.xcworkspace/contents.xcworkspacedata` には `Seam.xcodeproj` と `Pods/Pods.xcodeproj` の 2 つだけがリストされている (1-11行)。

### B-2. `packages/app/ios/Podfile` の特殊設定

`packages/app/ios/Podfile` (1-66行) より New Arch / Hermes 関連の重要設定：

- `ENV['RCT_NEW_ARCH_ENABLED'] = podfile_properties['newArchEnabled'] == 'true' ? '1' : '0'` (`Podfile:7`)
- `platform :ios, podfile_properties['ios.deploymentTarget'] || '15.1'` (`Podfile:10`)
- `:hermes_enabled => podfile_properties['expo.jsEngine'] == nil || podfile_properties['expo.jsEngine'] == 'hermes'` (`Podfile:41`)
- `:mac_catalyst_enabled => false` (`Podfile:51`)
- `post_install` で全リソースバンドルの `CODE_SIGNING_ALLOWED = 'NO'` を付与 (`Podfile:57-64`)。これは Free Apple ID で .bundle が署名できない問題の回避策として**そのまま機能する**重要な設定。

`packages/app/ios/Podfile.properties.json` (1-6行)：

```json
{
  "expo.jsEngine": "hermes",
  "EX_DEV_CLIENT_NETWORK_INSPECTOR": "true",
  "newArchEnabled": "true"
}
```

- Hermes 有効、New Arch 有効。Release ビルドではネイティブの dev-client network inspector は無効化される設計（`#if DEBUG` ガードが React Native 内にあるため）。

### B-3. `packages/app/ios/Podfile.lock` の主要 Pod バージョン

**重大な不整合**: Podfile.lock のバージョンが JS 側と乖離している（後述 F 章参照）。

`Podfile.lock` (1-75行, 68-70行, 1741-1828行) より：

| Pod | 解決バージョン | ファイル:行 |
| --- | --- | --- |
| `Expo` | `52.0.49` | `Podfile.lock:13` |
| `ExpoModulesCore` | `2.2.3` | `Podfile.lock:35` |
| `EXNotifications` | `0.29.14` | `Podfile.lock:11` |
| `ExpoSQLite` | `15.1.4` | `Podfile.lock:62` |
| `ExpoFileSystem` | `18.0.12` | `Podfile.lock:19` |
| `ExpoImagePicker` | `16.0.6` | `Podfile.lock:29` |
| `ExpoImageManipulator` | `13.0.6` | `Podfile.lock:25` |
| `ExpoSecureStore` | `14.0.1` | `Podfile.lock:58` |
| `EXApplication` | `6.0.2` | `Podfile.lock:4` |
| `EXConstants` | `17.0.8` | `Podfile.lock:6` |
| `React-Core` | `0.76.9` | `Podfile.lock:122` |
| `hermes-engine` | `0.76.9` | `Podfile.lock:68` |
| `RNReanimated` | `3.16.7` | `Podfile.lock:1741` |
| `RNGestureHandler` | `2.20.2` | `Podfile.lock:1720` |
| `RNScreens` | `4.4.0` | `Podfile.lock:1828` |
| `RNCAsyncStorage` | `1.23.1` | `Podfile.lock:1699` |
| `RCT-Folly` | `2024.10.14.00` | `Podfile.lock:83` |
| COCOAPODS | `1.16.2` | `Podfile.lock:2250` |

> JS 側 (`packages/app/package.json:29-46`) は `expo: ~54.0.33`, `react-native: 0.81.5` を要求しているのに、Pods は SDK 52 / RN 0.76.9 のまま。**`pnpm prebuild` または `pod install --repo-update` を再実行しないと Release ビルドで JS<>Native のバイナリ非互換になる可能性が極めて高い**。

### B-4. `packages/app/ios/Seam/Info.plist`

`packages/app/ios/Seam/Info.plist` (1-87行) より権限文字列と URL Schemes：

| キー | 値 | 行 |
| --- | --- | --- |
| `CFBundleShortVersionString` | `0.0.1` | `Info.plist:21-22` |
| `CFBundleVersion` | `1` | `Info.plist:35-36` |
| `LSMinimumSystemVersion` | `12.0` | `Info.plist:37-38` |
| `LSRequiresIPhoneOS` | `true` | `Info.plist:39-40` |
| `NSAppTransportSecurity.NSAllowsArbitraryLoads` | `false` | `Info.plist:41-44` |
| `NSAppTransportSecurity.NSAllowsLocalNetworking` | `true` | `Info.plist:41-47` |
| `NSCameraUsageDescription` | "Allow $(PRODUCT_NAME) to access your camera" | `Info.plist:48-49` |
| `NSFaceIDUsageDescription` | "Allow $(PRODUCT_NAME) to access your Face ID biometric data." | `Info.plist:50-51` |
| `NSMicrophoneUsageDescription` | "Allow $(PRODUCT_NAME) to access your microphone" | `Info.plist:52-53` |
| `NSPhotoLibraryUsageDescription` | "Allow $(PRODUCT_NAME) to access your photos" | `Info.plist:54-55` |
| `CFBundleURLSchemes` | `seam`, `com.sugarshin.seam` | `Info.plist:25-34` |
| `NSUserActivityTypes` | `$(PRODUCT_BUNDLE_IDENTIFIER).expo.index_route` | `Info.plist:56-59` |
| `UIRequiredDeviceCapabilities` | `arm64` | `Info.plist:62-65` |
| `UIStatusBarStyle` | `UIStatusBarStyleDefault` | `Info.plist:68-69` |
| `UIUserInterfaceStyle` | `Automatic` | `Info.plist:82-83` |
| `CADisableMinimumFrameDurationOnPhone` | `true` | `Info.plist:5-6` |

> 仕様書記載の `expo-image-picker`/`expo-image-manipulator`/`expo-camera` 系は写真ライブラリ＋カメラを使うため、Camera/Photo Library 説明文は揃っている。Microphone は使っていなさそうだが Expo prebuild の既定で入れている。

### B-5. `packages/app/ios/Seam/Seam.entitlements`

`packages/app/ios/Seam/Seam.entitlements` (1-8行) **全文**：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>aps-environment</key>
    <string>development</string>
  </dict>
</plist>
```

- **`aps-environment = development` のみ**（Push Notifications entitlement）。CloudKit, App Groups, Associated Domains などは入っていない。
- **`aps-environment` は Free Apple ID では署名できない**（Apple Developer Program 加入必須の機能）。SideStore で焼く際にこの entitlement が含まれていると Xcode/codesign が `Provisioning profile doesn't include the aps-environment entitlement` エラーで失敗する。
- これは **app.json の `plugins: [..., "expo-notifications", ...]` (`app.json:22`) が `aps-environment` を自動付与している**ため。Local Notification しか使っていないので、Free Apple ID 署名のためには **entitlement から `aps-environment` を取り除く必要がある**（C 章で根拠詳述）。

### B-6. `packages/app/ios/Seam/AppDelegate.mm`

`AppDelegate.mm` (44-59行) でリモート通知デリゲート実装：

```objc
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{ return [super application:application didRegisterForRemoteNotificationsWithDeviceToken:deviceToken]; }
- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
{ return [super application:application didFailToRegisterForRemoteNotificationsWithError:error]; }
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler
{ return [super application:application didReceiveRemoteNotification:userInfo fetchCompletionHandler:completionHandler]; }
```

> コメント (`AppDelegate.mm:44`, `:50`, `:56`): "Explicitly define remote notification delegates to ensure compatibility with some third-party libraries"
> APNs ハンドラの**ガラ**は実装されているが、JS 側からは push token を取得していない（C 章参照）。

---

## C. 通知と Push の実態

### C-1. `packages/app/src/notifications/` の API 利用状況

`packages/app/src/notifications/notificationManager.ts` (133行) で利用している `expo-notifications` API は以下の 5 つ**のみ**（`grep "Notifications\." packages/app/src/` 全件）：

| API | 行 | 種類 |
| --- | --- | --- |
| `Notifications.setNotificationHandler` | `notificationManager.ts:39` | フォアグラウンド表示制御 (ローカルOK) |
| `Notifications.getPermissionsAsync` | `notificationManager.ts:58` | 権限確認 (ローカルOK) |
| `Notifications.requestPermissionsAsync` | `notificationManager.ts:61` | 権限要求 (ローカルOK) |
| `Notifications.scheduleNotificationAsync` | `notificationManager.ts:106` | **ローカル**通知スケジュール |
| `Notifications.SchedulableTriggerInputTypes.DATE` | `notificationManager.ts:113` | DATE トリガー = ローカル |
| `Notifications.cancelScheduledNotificationAsync` | `notificationManager.ts:130` | ローカル通知キャンセル |

`grep -rn "getDevicePushTokenAsync\|getExpoPushTokenAsync\|registerForRemoteNotifications\|registerPushTokenAsync" packages/app/src/` の結果は **0 件**。

**結論**: Push Notifications (APNs) は**一切**使っていない。`scheduleAuctionReminders` (`notificationManager.ts:93-124`) は `Notifications.scheduleNotificationAsync` で `type: DATE` の trigger を組み合わせる純粋なローカル通知。リマインダーの永続化は SQLite の `reminders` テーブル (`packages/app/src/db/schema.ts:297`) で行うため、APNs サーバー側の状態管理も不要。

### C-2. `app.json` の `expo-notifications` プラグイン設定

`packages/app/app.json:22`: `"expo-notifications"` (文字列、オプション無し)。

しかし Expo の `expo-notifications` config plugin は **デフォルトで `aps-environment = development` を `Seam.entitlements` に書き込む**仕様 (B-5 の現状と一致)。Local-only でも entitlement が付与されてしまうのが Expo prebuild の既知の振る舞い。

> SideStore 配布上の意味：Free Apple ID では `aps-environment` をつけたまま署名できないので、prebuild 後に手動で entitlement を消す or `expo-notifications` プラグインを app.json から外して再 prebuild する、または `xcodebuild` 時に `--codesign-identity-flags` で entitlement を上書きするいずれかの対処が必要。

---

## D. データ永続化と再インストール耐性

### D-1. SQLite ファイルの保存先

`packages/app/src/db/client.ts` (1-10行) **全文**：

```ts
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

const DB_NAME = 'seam.db';

export const sqlite = openDatabaseSync(DB_NAME, { enableChangeListener: true });
export const db = drizzle(sqlite, { schema });
```

- `expo-sqlite` の `openDatabaseSync('seam.db', ...)` は **アプリの Documents 領域配下の `SQLite/` サブディレクトリ** (`<app sandbox>/Documents/SQLite/seam.db`) にファイルを作る (Expo SQLite SDK の既定動作)。
- Documents 領域は iOS の sandbox container 内で、**iCloud バックアップにも含まれる**領域。**アプリを削除しない限り** OS 側で勝手に消されることはない。

### D-2. 写真の保存先

`packages/app/src/photos/savePhoto.ts` (1-74行)：

| 行 | コード | 意味 |
| --- | --- | --- |
| `:5-6` | `const PHOTOS_DIR = 'photos/'; const THUMB_DIR = 'photos/thumbs/';` | 相対パス。 |
| `:11` | `${FileSystem.documentDirectory ?? ''}${relative}` | **Documents 領域**に絶対化。 |
| `:42-43` | `const mainDest = '${FileSystem.documentDirectory ?? ''}${PHOTOS_DIR}${fileName}'; await FileSystem.moveAsync({ from: main.uri, to: mainDest });` | 元 URI からコピー（picker の tmp を移動）。 |
| `:55-56` | `relativePath: '${PHOTOS_DIR}${fileName}', thumbnailRelativePath: '${THUMB_DIR}${thumbName}'` | DB には**相対パスだけ**を保存（`photos.relative_path` カラム）。 |
| `:72-73` | `export const absolutePathFor = (relativePath: string): string => '${FileSystem.documentDirectory ?? ''}${relativePath}';` | 表示時に絶対化。 |

> `FileSystem.documentDirectory` は `<app sandbox>/Documents/` を指すので、SQLite と同じく **Documents 領域**に保存。

### D-3. 7日 Refresh でデータが残る根拠

- **アプリのアンインストールが発生しない限り**、iOS は app sandbox の `Documents/` を保持する。
- SideStore の "7日に1度の再署名 (Refresh)" は **既存の `.app` バンドルに対して embedded mobileprovision と code signature を差し替えるだけ** で、データディレクトリは触らない（SideStore のドキュメント上の動作）。
- 上記 D-1, D-2 のとおり、SQLite (`seam.db`) も写真ファイル (`photos/*.jpg`, `photos/thumbs/*.jpg`) も `Documents/` に置かれており、**Refresh でアプリ削除→再インストールは発生しない** ので残る。
- `packages/app/src/db/schema.ts` の全テーブル (items, measurements, photos, fitAnchors, candidateInfos, candidateEvaluations, decisionLogs, failureLogs, measurementRules, brandGuides, brandChecklistStates, wearLogs, saleInfos, priceSnapshots, tags, itemTags, reminders) はすべてこの SQLite ファイル内。
- `useDbMigrations()` (`packages/app/src/db/migrate.ts:5`) が起動時に Drizzle マイグレーションを冪等適用するので、Refresh 後に万一スキーマ差分があっても自動で追従する設計。

> **注意点**: もしユーザーが SideStore で **完全アンインストール → 再インストール** をした場合、Documents 領域は OS 仕様上削除される。Refresh と再インストールは別物。Refresh だけで運用する限りデータは残る。

---

## E. ビルドサイズへの影響を持ちうる要素

### E-1. pnpm workspace path mapping の Metro 解決

`packages/app/metro.config.js` (1-22行)：

| 行 | 設定 |
| --- | --- |
| `:5` | `const monorepoRoot = path.resolve(projectRoot, '../..');` |
| `:11` | `config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), monorepoRoot]));` |
| `:14-17` | `config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules'), path.resolve(monorepoRoot, 'node_modules')];` |
| `:20` | `config.resolver.sourceExts = [...config.resolver.sourceExts, 'sql'];` |

- `@seam/domain`, `@seam/shared` は CLAUDE.md の宣言通り**ビルドステップ無しでソース直 import**（`./src/index.ts`）。Metro はワークスペースルート以下を watch しているのですべての TS を bundling 時にバンドルする。
- Release `.ipa` には Metro が出力する **単一の `main.jsbundle`** が `Seam.app/main.jsbundle` として埋め込まれる (`AppDelegate.mm:29` の `[[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"]`)。
- 推奨 `node-linker=hoisted` 設定 (`/.npmrc:3`) により node_modules は flat。Metro が duplicate 解決でつまずく可能性は低い。

### E-2. `metro.config.js` の workspace 対応

上記参照。`projectRoot` (= `packages/app`) と `monorepoRoot` の両方の `node_modules` を解決パスに入れているため、`@seam/domain`, `@seam/shared` 以外の deps は flat hoisting に依存。

### E-3. その他バンドルサイズ要素

- Hermes 有効 (`Podfile.properties.json:2`)。Release では JS が Hermes bytecode 化されてサイズ削減。
- `ENABLE_BITCODE = NO` (`project.pbxproj:354`)。Bitcode は iOS 14 で deprecate なので問題なし。
- New Arch + Fabric 有効 (`Podfile.properties.json:4`) → ReactCommon, React-Fabric, ReactCodegen 等の Pod が増える。`Podfile.lock` で `React-Fabric`, `React-RCTFabric`, `ReactCodegen` を確認 (各 0.76.9)。
- `expo-image-picker`, `expo-image-manipulator`, `SDWebImage`, `SDWebImageWebPCoder` (`Podfile.lock`) で WebP 対応 → サイズ増。
- `assets/` のサイズは未確認（イメージ）。

---

## F. リポジトリのバージョン情報

### F-1. ルート `package.json`

`/package.json` (18-22行)：

```json
"engines": { "node": ">=20", "pnpm": ">=9" },
"packageManager": "pnpm@10.33.0"
```

### F-2. `packages/app/package.json` の expo-* / RN バージョン (declared)

`packages/app/package.json:29-46` より：

| 依存 | バージョン |
| --- | --- |
| `expo` | `~54.0.33` |
| `expo-application` | `~7.0.8` |
| `expo-constants` | `~18.0.13` |
| `expo-document-picker` | `~14.0.8` |
| `expo-file-system` | `~19.0.21` |
| `expo-image-manipulator` | `~14.0.8` |
| `expo-image-picker` | `~17.0.10` |
| `expo-linking` | `~8.0.11` |
| `expo-notifications` | `~0.32.16` |
| `expo-router` | `~6.0.23` |
| `expo-secure-store` | `~15.0.8` |
| `expo-sharing` | `~14.0.8` |
| `expo-sqlite` | `~16.0.10` |
| `expo-status-bar` | `~3.0.9` |
| `react` | `19.1.0` |
| `react-dom` | `19.1.0` |
| `react-native` | `0.81.5` |
| `react-native-gesture-handler` | `~2.28.0` |
| `react-native-reanimated` | `~4.1.7` |
| `react-native-safe-area-context` | `5.6.2` |
| `react-native-screens` | `~4.16.0` |

### F-3. `pnpm-lock.yaml` での解決バージョン

`pnpm-lock.yaml` の package descriptors（`grep -nE` 結果）：

| パッケージ | 解決バージョン | ファイル:行 |
| --- | --- | --- |
| `expo` | `54.0.33` | `pnpm-lock.yaml:2771` |
| `react-native` | `0.81.5` | `pnpm-lock.yaml:3794` |
| `expo-notifications` | `0.32.16` | `pnpm-lock.yaml:2703` |
| `expo-router` | `6.0.23` | `pnpm-lock.yaml:2710` |
| `expo-sqlite` | `16.0.10` | `pnpm-lock.yaml:2758` |
| `expo-application` | `7.0.8` | `pnpm-lock.yaml:2630` |
| `expo-file-system` | `19.0.21` | `pnpm-lock.yaml:2653` |
| `expo-image-manipulator` | `14.0.8` | `pnpm-lock.yaml:2671` |
| `expo-image-picker` | `17.0.10` | `pnpm-lock.yaml:2676` |
| `expo-secure-store` | `15.0.8` | `pnpm-lock.yaml:2744` |
| `react-native-reanimated` | `4.1.7` | `pnpm-lock.yaml:3767` |

### F-4. ⚠️ JS 依存と Pods 依存の整合性

| Layer | Expo | React Native | expo-notifications | expo-sqlite |
| --- | --- | --- | --- | --- |
| JS (pnpm-lock) | **54.0.33** | **0.81.5** | **0.32.16** | **16.0.10** |
| Pods (Podfile.lock) | **52.0.49** | **0.76.9** | **0.29.14** | **15.1.4** |

**整合していない**。`packages/app/ios/Podfile.lock` は SDK 52 のままで、`packages/app/ios/Pods/` も同様に古い (`packages/app/ios/Pods/` ディレクトリ確認: 17 サブディレクトリ存在)。最後の prebuild/`pod install` 時点が SDK 52 だった可能性が極めて高い。

### F-5. 直近のコミットログ

`git log --oneline` (最大 20 件 = 全件)：

```
3e6f871 Add CLAUDE.md
9fdb70f Initial impl
16f529c Merge pull request #1 from sugarshin/renovate/configure
2d4f226 Add renovate.json
8e0ee18 Initial commit
```

> リポジトリは新しく、iOS native フォルダを含む `9fdb70f Initial impl` 1コミットで全体ができている。

---

## まとめ：SideStore 配布に向けた現状評価とリスク

### 現状評価（コード変更なしで即 SideStore 配布できるか？）

**No**。以下のブロッカーがある。

### 必須対応（ブロッカー）

#### B-1. Pods が SDK 52 のまま (最重要)

- `Podfile.lock` は Expo 52 / RN 0.76.9, JS 側は Expo 54 / RN 0.81.5。`packages/app/ios/Pods/` も古い。
- このまま `xcodebuild archive` すると Hermes ABI 不一致, TurboModule registry mismatch, Codegen ヘッダ不在で **ビルドエラーまたは起動時クラッシュ**する。
- **対策**: `cd packages/app && pnpm prebuild --clean` (もしくは `npx expo prebuild --platform ios --clean`) → `cd ios && pod install --repo-update`。`ios/` 配下を再生成する場合は、現在の `Seam.entitlements` の手動編集や Xcode 側の Team 設定が**飛ぶ**点に注意。`pnpm prebuild` (clean なし) → `pod install` で済むかは Expo CLI の出力次第。

#### B-2. `Seam.entitlements` に `aps-environment = development` が残っている

- Free Apple ID では Push Notifications entitlement を含む profile を発行できない。`aps-environment` 付きのまま codesign すると失敗する (`provisioning profile doesn't include aps-environment`)。
- コード上 push token は使っていない (C-1) ので、安全に entitlement を消せる。
- **対策案**:
  - (a) `app.json` の `plugins` から `expo-notifications` を外し prebuild 後に**手動で** entitlement を整える、もしくは
  - (b) prebuild 後に `packages/app/ios/Seam/Seam.entitlements` を編集して `<key>aps-environment</key><string>development</string>` 行を削除（再 prebuild で復活する点に注意し、`app.json` での expo-notifications プラグインの `mode` 指定や `dangerous` config plugin で抑止する）、もしくは
  - (c) Xcode の Capabilities タブで Push Notifications を OFF にしてから Archive する。

#### B-3. Code Signing が未設定

- `project.pbxproj` に `DEVELOPMENT_TEAM`, `CODE_SIGN_STYLE` が無い (B-1 章)。
- **対策**: Xcode で `Seam.xcworkspace` を開き、ターゲット `Seam` の Signing & Capabilities タブで:
  - Apple ID (Free) を Account に追加
  - Team: `<Your Name> (Personal Team)` を選択
  - Provisioning: Automatic
  - Bundle Identifier: そのまま `com.sugarshin.seam` で OK（ただし Free Personal Team では他人と被ると 7日縛りでも署名拒否されるケースあり。被ったら `com.sugarshin.seam.local` 等にリネーム要）

### 強く推奨

#### B-4. `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` が `1.0` / `1` のまま

- `app.json` の `version: "0.0.1"` (`app.json:5`) と pbxproj の `MARKETING_VERSION = 1.0` (`project.pbxproj:362`, `:390`) が**ずれている**。
- prebuild 直後は `app.json` と Info.plist (`CFBundleShortVersionString = 0.0.1` (`Info.plist:21-22`)) と pbxproj `MARKETING_VERSION = 1.0` の三者で不整合がある。Info.plist の `$(MARKETING_VERSION)` 参照が無く直値 0.0.1 になっているため最終 `.ipa` の表示版本は 0.0.1 になるが、SideStore 側の表示と Xcode Organizer の表示が一致しないので将来揉めやすい。
- 7日縛り運用で Build を毎週上げる前提なら `CURRENT_PROJECT_VERSION` のインクリメント運用を考えると良い。

### 強み（SideStore 配布的にプラスに働く既存設定）

- iOS Deployment Target 15.1 (`project.pbxproj:360` ほか) → SideStore 推奨 (iOS 15+) 範囲。
- `LSRequiresIPhoneOS = true` (`Info.plist:39-40`), `TARGETED_DEVICE_FAMILY = 1` (`project.pbxproj:374`) → iPhone 専用バイナリで余計な iPad slice なし。
- `ENABLE_BITCODE = NO` (`project.pbxproj:354`) → Free profile でも問題なく archive 可能。
- Hermes 有効 (`Podfile.properties.json:2`) → JS は bytecode 化されサイズ・起動時間ともに有利。
- `Podfile post_install` (`Podfile:57-64`) で resource bundle の `CODE_SIGNING_ALLOWED = NO` 強制 → Free Personal Team の "no signing entitlement on bundles" 制約を**そのまま回避できる**重要設定。
- 通知が完全ローカル (C-1) → APNs 不要。`aps-environment` を消しても機能に影響なし。
- データ層が完全に Documents 領域 (D-1, D-2) → 7日 Refresh でデータ消失リスクなし。
- `eas.json` 不在 (A-2) → ローカルビルドフロー前提と整合。

### 推奨ビルド手順（参考、コード変更を伴う）

1. `cd packages/app && pnpm install`
2. `pnpm prebuild --clean`（**※ 既存 ios/ を上書き再生成**）
3. `cd ios && pod install`
4. `Seam.entitlements` から `aps-environment` を削除（または Xcode Capabilities で OFF）
5. Xcode で `Seam.xcworkspace` を開き Personal Team を割当て
6. Scheme を `Seam` / Configuration `Release` で `Product > Archive`
7. Organizer から `.xcarchive` を選び "Distribute App > Custom > Copy App" もしくは `xcodebuild -exportArchive -exportOptionsPlist <plist>` で `.ipa` 化
8. SideStore に転送して焼く

---

### 関連ファイル一覧（要約）

| 役割 | パス |
| --- | --- |
| Expo 設定 | `/Users/shingosato/dev/src/github.com/sugarshin/seam/packages/app/app.json` |
| Babel (inline-import) | `/Users/shingosato/dev/src/github.com/sugarshin/seam/packages/app/babel.config.js` |
| Metro (workspace 解決) | `/Users/shingosato/dev/src/github.com/sugarshin/seam/packages/app/metro.config.js` |
| Xcode project | `/Users/shingosato/dev/src/github.com/sugarshin/seam/packages/app/ios/Seam.xcodeproj/project.pbxproj` |
| Xcode scheme | `/Users/shingosato/dev/src/github.com/sugarshin/seam/packages/app/ios/Seam.xcodeproj/xcshareddata/xcschemes/Seam.xcscheme` |
| Podfile | `/Users/shingosato/dev/src/github.com/sugarshin/seam/packages/app/ios/Podfile` |
| Podfile.lock (古い) | `/Users/shingosato/dev/src/github.com/sugarshin/seam/packages/app/ios/Podfile.lock` |
| Podfile properties | `/Users/shingosato/dev/src/github.com/sugarshin/seam/packages/app/ios/Podfile.properties.json` |
| Info.plist | `/Users/shingosato/dev/src/github.com/sugarshin/seam/packages/app/ios/Seam/Info.plist` |
| Entitlements | `/Users/shingosato/dev/src/github.com/sugarshin/seam/packages/app/ios/Seam/Seam.entitlements` |
| AppDelegate | `/Users/shingosato/dev/src/github.com/sugarshin/seam/packages/app/ios/Seam/AppDelegate.mm` |
| 通知マネージャ | `/Users/shingosato/dev/src/github.com/sugarshin/seam/packages/app/src/notifications/notificationManager.ts` |
| DB クライアント | `/Users/shingosato/dev/src/github.com/sugarshin/seam/packages/app/src/db/client.ts` |
| 写真保存 | `/Users/shingosato/dev/src/github.com/sugarshin/seam/packages/app/src/photos/savePhoto.ts` |
| ルートレイアウト | `/Users/shingosato/dev/src/github.com/sugarshin/seam/packages/app/app/_layout.tsx` |
| ルート package.json | `/Users/shingosato/dev/src/github.com/sugarshin/seam/package.json` |
| App package.json | `/Users/shingosato/dev/src/github.com/sugarshin/seam/packages/app/package.json` |
| pnpm-lock | `/Users/shingosato/dev/src/github.com/sugarshin/seam/pnpm-lock.yaml` |
| .npmrc | `/Users/shingosato/dev/src/github.com/sugarshin/seam/.npmrc` |
