/**
 * Handla mobile theme — mirrors the web app's dark base + gold accent palette.
 */
export const colors = {
  // Base surfaces (darkest → lighter)
  bg: '#0a0a0a',
  bgDeep: '#080808',
  surface: '#0c0c0c',
  surfaceAlt: '#111111',
  card: 'rgba(255,255,255,0.02)',
  cardAlt: 'rgba(255,255,255,0.04)',

  // Borders
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.16)',

  // Accent (gold)
  accent: '#fbbf24',
  accentDim: '#f59e0b',
  accentSoft: 'rgba(251,191,36,0.15)',
  accentBorder: 'rgba(251,191,36,0.30)',

  // Text
  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.60)',
  textFaint: 'rgba(255,255,255,0.40)',
  textDim: 'rgba(255,255,255,0.25)',

  // Semantic
  success: '#34d399',
  successSoft: 'rgba(52,211,153,0.12)',
  danger: '#f87171',
  dangerSoft: 'rgba(248,113,113,0.12)',
  warning: '#fbbf24',
  info: '#60a5fa',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const font = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;
