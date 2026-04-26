import { Tabs } from 'expo-router';
import { useThemeColors } from '../../src/theme';

export default function TabsLayout() {
  const palette = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: palette.bg },
        headerTintColor: palette.text,
        tabBarStyle: {
          backgroundColor: palette.bg,
          borderTopColor: palette.border,
        },
        tabBarActiveTintColor: palette.text,
        tabBarInactiveTintColor: palette.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarAccessibilityLabel: 'Home タブ' }}
      />
      <Tabs.Screen
        name="closet"
        options={{ title: 'Closet', tabBarAccessibilityLabel: 'Closet タブ' }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{ title: 'Wishlist', tabBarAccessibilityLabel: 'Wishlist タブ' }}
      />
      <Tabs.Screen
        name="compare"
        options={{ title: 'Compare', tabBarAccessibilityLabel: 'Compare タブ' }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Stats', tabBarAccessibilityLabel: 'Stats タブ' }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarAccessibilityLabel: 'Settings タブ' }}
      />
    </Tabs>
  );
}
