import { LogBox } from 'react-native';

// On unsigned simulator/dev builds (e.g. the E2E build produced with
// `CODE_SIGNING_ALLOWED=NO`), the Keychain Access Group entitlement is
// missing. expo-notifications' DevicePushTokenAutoRegistration runs at module
// load and calls `console.error` when keychain access fails, which surfaces as
// a fullscreen LogBox overlay in Debug builds and blocks Maestro from reaching
// the tab bar. The error itself is harmless for this app (no remote push
// backend), so we silence it here. This must execute before
// `expo-notifications` is imported anywhere.
LogBox.ignoreLogs([/\[expo-notifications\] Error reading persisted server registration info/]);
