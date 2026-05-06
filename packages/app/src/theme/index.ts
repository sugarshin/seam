import { createContext, createElement, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

/**
 * Minimal monochrome theme — vintage / archive aesthetic.
 * Tokens are intentionally small; expand as the UI grows.
 *
 * `colors` continues to point at the light palette so existing top-level
 * `import { colors } from '../theme'` callsites keep working without any
 * runtime change. New code that wants automatic dark-mode adoption should
 * call `useThemeColors()` instead.
 */
export const lightColors = {
  bg: '#FFFFFF',
  bgInverse: '#0E0E0E',
  surface: '#F6F5F1',
  surfaceAlt: '#EDECE6',
  border: '#D6D3CB',
  text: '#1A1A1A',
  textMuted: '#666666',
  textInverse: '#FFFFFF',
  accent: '#1A1A1A',

  // semantic
  same: '#3F8B4E',
  close: '#7AA85B',
  different: '#C9933B',
  warning: '#B53C3C',
  ng: '#7A1F1F',
} as const;

export type ColorPalette = { readonly [K in keyof typeof lightColors]: string };

export const darkColors: ColorPalette = {
  bg: '#0E0E0E',
  bgInverse: '#FFFFFF',
  surface: '#1A1A1A',
  surfaceAlt: '#242424',
  border: '#2E2E2E',
  text: '#F2F2F2',
  textMuted: '#9C9C9C',
  textInverse: '#0E0E0E',
  accent: '#F2F2F2',

  // semantic — slightly lifted for contrast on dark surfaces
  same: '#4FA361',
  close: '#90C475',
  different: '#D9A24E',
  warning: '#D85959',
  ng: '#9C2E2E',
};

export const colors = lightColors;

export type ColorToken = keyof typeof lightColors;

// Single subscription point for the OS color scheme. Subscribing inside every
// screen via `useColorScheme()` was causing brief light/dark mismatches across
// screens during native-stack push transitions: a freshly-mounted detail
// screen would briefly compute a different palette than the already-mounted
// root layout, and the iOS native header re-styled mid-animation as the
// per-screen subscription caught up. Funnelling the subscription through a
// single ThemeProvider at the app root keeps every consumer in lockstep.
const ThemeContext = createContext<ColorPalette | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? darkColors : lightColors;
  return createElement(ThemeContext.Provider, { value: palette }, children);
};

export const useThemeColors = (): ColorPalette => {
  const ctx = useContext(ThemeContext);
  return ctx ?? lightColors;
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
} as const;

export const font = {
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 22,
    xxl: 28,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;
