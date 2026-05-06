// Must come before `expo-notifications` is loaded transitively via
// `../src/notifications`. See setupLogBox.ts for why.
import '../src/setupLogBox';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, Text, View } from 'react-native';
import { useDbMigrations } from '../src/db/migrate';
import { configureNotificationHandler } from '../src/notifications';
import { font, space, useThemeColors } from '../src/theme';

// Configure foreground notification presentation once on module load. Safe to
// call multiple times — Expo replaces the handler each time.
configureNotificationHandler();

export default function RootLayout() {
  const { success, error } = useDbMigrations();
  const palette = useThemeColors();

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: space.xl,
          backgroundColor: palette.bg,
        }}
      >
        <Text
          style={{
            fontSize: font.size.lg,
            fontWeight: font.weight.semibold,
            color: palette.warning,
            marginBottom: space.sm,
          }}
        >
          DBの初期化に失敗しました
        </Text>
        <Text
          style={{
            fontSize: font.size.sm,
            color: palette.text,
            textAlign: 'center',
          }}
        >
          {error.message}
        </Text>
      </View>
    );
  }
  if (!success) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: space.xl,
          backgroundColor: palette.bg,
        }}
      >
        <ActivityIndicator color={palette.text} />
        <Text style={{ marginTop: space.md, color: palette.textMuted, fontSize: font.size.sm }}>
          準備中…
        </Text>
      </View>
    );
  }
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.bg }}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: palette.bg },
          headerTintColor: palette.text,
          headerTitleStyle: { color: palette.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: palette.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </GestureHandlerRootView>
  );
}
