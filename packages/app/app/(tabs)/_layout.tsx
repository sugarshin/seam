import { Tabs } from 'expo-router';
import { useThemeColors } from '../../src/theme';
import { testIds } from '../../src/utils/testIds';

export default function TabsLayout() {
  const palette = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: palette.bg },
        headerTintColor: palette.text,
        headerTitleStyle: { color: palette.text },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: palette.bg,
          borderTopColor: palette.border,
        },
        tabBarActiveTintColor: palette.text,
        tabBarInactiveTintColor: palette.textMuted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarButtonTestID: testIds.tab.home }} />
      <Tabs.Screen
        name="closet"
        options={{ title: 'Closet', tabBarButtonTestID: testIds.tab.closet }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{ title: 'Wishlist', tabBarButtonTestID: testIds.tab.wishlist }}
      />
      <Tabs.Screen
        name="compare"
        options={{ title: 'Compare', tabBarButtonTestID: testIds.tab.compare }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Stats', tabBarButtonTestID: testIds.tab.stats }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarButtonTestID: testIds.tab.settings }}
      />
    </Tabs>
  );
}
