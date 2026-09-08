// '#808bf5' is the app's actual, established brand purple — it's hardcoded across 38
// screens (221 occurrences) as the real accent color users see everywhere: buttons,
// active tab, links, spinners. `primary` here used to be '#6366f1', a color that only
// ever showed up in 4 files (and always alongside '#808bf5' in the same file, never on
// its own) — so it was the theme system drifting from the app's actual identity, not
// the other way around. Fixed to match reality rather than repainting 38 screens to
// match an unused token.
export const brand = {
  primary: '#808bf5',
  primaryMuted: '#818cf8',
  primaryTint: '#eef0fe',
  primaryDark: '#4f46e5',
  gradient: ['#818cf8', '#808bf5', '#4f46e5'] as const,
};

export const semantic = {
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  like: '#ec4899',
};

export const lightColors = {
  ...brand,
  ...semantic,
  background: '#fafafa',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  overlay: 'rgba(15, 15, 20, 0.5)',
  border: '#ececef',
  borderStrong: '#e2e2e7',
  text: {
    primary: '#15151a',
    secondary: '#6b6b76',
    muted: '#9c9ca6',
    inverse: '#ffffff',
  },
};

export const darkColors = {
  ...brand,
  ...semantic,
  background: '#0a0a0d',
  surface: '#17171c',
  surfaceElevated: '#1f1f26',
  overlay: 'rgba(0, 0, 0, 0.6)',
  border: '#232329',
  borderStrong: '#2c2c33',
  text: {
    primary: '#f5f5f7',
    secondary: '#a3a3ad',
    muted: '#6f6f79',
    inverse: '#15151a',
  },
};

export type ThemeColors = typeof lightColors;
