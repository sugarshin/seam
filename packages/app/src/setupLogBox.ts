import { LogBox } from 'react-native';

// LogBox の UI を全面停止する。理由:
// 1. unsigned simulator (CODE_SIGNING_ALLOWED=NO) ビルドでは
//    expo-notifications の DevicePushTokenAutoRegistration が keychain
//    entitlement 欠如で `console.error` を発火し、LogBox の赤画面で UI が覆われる。
// 2. dev mode では LogBox の **黄色 pill** (画面下の "Open debugger to view
//    warnings.") が画面下部の要素を occlude し、Maestro flow を flake させる。
// このアプリはローカル個人利用 (no app store / no remote backend) で、CI でも
// LogBox UI を頼らないので無効化して問題ない。実際の console.error / console.warn
// は metro stdout に残るので debug 時はそちらを参照する。
LogBox.ignoreAllLogs(true);
