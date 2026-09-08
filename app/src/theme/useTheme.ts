import { useColorScheme } from 'react-native';
import { lightColors, darkColors } from './colors';
import { spacing, radius } from './spacing';
import { typography } from './typography';
import { shadows } from './shadows';

export function useTheme() {
  const isDark = useColorScheme() === 'dark';
  return {
    isDark,
    colors: isDark ? darkColors : lightColors,
    spacing,
    radius,
    typography,
    shadows,
  };
}

export type Theme = ReturnType<typeof useTheme>;
