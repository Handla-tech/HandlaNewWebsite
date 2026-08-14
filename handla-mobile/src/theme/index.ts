/**
 * Handla mobile theme — light & dark palettes.
 *
 * The palette is reactive: components read it via `useTheme()` (backed by a
 * persisted zustand store) so a theme switch re-renders the tree. The static
 * `colors` export remains as the DARK palette for any non-reactive module-scope
 * usage / backwards-compatibility, but screens should prefer `useTheme()`.
 */
import { create } from 'zustand';
import { Appearance, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ThemeMode = 'light' | 'dark';

// ─── Shared brand accent (gold) ─────────────────────────────────────────────
const ACCENT = '#fbbf24';
const ACCENT_DIM = '#f59e0b';

// ─── Palette shape ──────────────────────────────────────────────────────────
export interface Palette {
  bg: string; bgDeep: string; surface: string; surfaceAlt: string;
  card: string; cardAlt: string; border: string; borderStrong: string;
  accent: string; accentDim: string; accentSoft: string; accentBorder: string;
  text: string; textMuted: string; textFaint: string; textDim: string;
  success: string; successSoft: string; danger: string; dangerSoft: string;
  warning: string; info: string; inputBg: string;

  // ── Glassmorphism tokens ───────────────────────────────────────────────
  /** Fill painted on top of a BlurView so the frost is tinted, not muddy. */
  glass: string;
  /** A slightly stronger glass fill for raised / hero surfaces. */
  glassStrong: string;
  /** Hairline highlight along a glass card's top edge (specular sheen). */
  glassHighlight: string;
  /** Blur tint mode for expo-blur BlurView. */
  blurTint: 'light' | 'dark' | 'default';
  /** Background gradient stops (deep → surface) for screens. */
  bgGradient: [string, string, string];
  /** Accent gradient (used on primary buttons, hero glow, active bars). */
  accentGradient: [string, string];
  /** Ambient colored glow blobs behind the hero (top-right / bottom-left). */
  glowA: string;
  glowB: string;
  /** Shadow color for elevation helpers. */
  shadow: string;
  /** Multi-hue palette for categorical charts (donuts, stacked bars). */
  chart: string[];
}

// ─── Dark palette (default) ─────────────────────────────────────────────────
export const darkColors: Palette = {
  bg: '#0a0a0a',
  bgDeep: '#080808',
  surface: '#0c0c0c',
  surfaceAlt: '#111111',
  card: 'rgba(255,255,255,0.02)',
  cardAlt: 'rgba(255,255,255,0.04)',

  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.16)',

  accent: ACCENT,
  accentDim: ACCENT_DIM,
  accentSoft: 'rgba(251,191,36,0.15)',
  accentBorder: 'rgba(251,191,36,0.30)',

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

  // Input fill (used by ui.tsx Input)
  inputBg: 'rgba(0,0,0,0.4)',

  // Glass
  glass: 'rgba(255,255,255,0.05)',
  glassStrong: 'rgba(255,255,255,0.08)',
  glassHighlight: 'rgba(255,255,255,0.14)',
  blurTint: 'dark',
  bgGradient: ['#070707', '#0b0b0d', '#0a0a0a'],
  accentGradient: ['#fcd34d', '#f59e0b'],
  glowA: 'rgba(251,191,36,0.22)',
  glowB: 'rgba(96,165,250,0.14)',
  shadow: '#000000',
  chart: ['#fbbf24', '#60a5fa', '#34d399', '#f87171', '#a78bfa', '#f472b6', '#22d3ee'],
} as const;

// ─── Light palette ──────────────────────────────────────────────────────────
export const lightColors: Palette = {
  bg: '#f6f7f9',
  bgDeep: '#eceef1',
  surface: '#ffffff',
  surfaceAlt: '#f0f2f5',
  card: '#ffffff',
  cardAlt: '#f0f2f5',

  border: 'rgba(17,20,26,0.12)',
  borderStrong: 'rgba(17,20,26,0.20)',

  // Darker gold reads better on light surfaces
  accent: '#b7791f',
  accentDim: '#8a5a12',
  accentSoft: 'rgba(183,121,31,0.12)',
  accentBorder: 'rgba(183,121,31,0.35)',

  text: '#0f1115',
  textMuted: 'rgba(17,20,26,0.65)',
  textFaint: 'rgba(17,20,26,0.50)',
  textDim: 'rgba(17,20,26,0.38)',

  success: '#059669',
  successSoft: 'rgba(5,150,105,0.12)',
  danger: '#dc2626',
  dangerSoft: 'rgba(220,38,38,0.10)',
  warning: '#b7791f',
  info: '#2563eb',

  inputBg: '#ffffff',

  // Glass — on light we frost a translucent white for a soft, premium feel
  glass: 'rgba(255,255,255,0.55)',
  glassStrong: 'rgba(255,255,255,0.72)',
  glassHighlight: 'rgba(255,255,255,0.9)',
  blurTint: 'light',
  bgGradient: ['#eef1f6', '#f4f6f9', '#f6f7f9'],
  accentGradient: ['#d4a017', '#b7791f'],
  glowA: 'rgba(183,121,31,0.16)',
  glowB: 'rgba(37,99,235,0.10)',
  shadow: '#1a2233',
  chart: ['#b7791f', '#2563eb', '#059669', '#dc2626', '#7c3aed', '#db2777', '#0891b2'],
};

export const palettes: Record<ThemeMode, Palette> = {
  dark: darkColors,
  light: lightColors,
};

/** Static DARK palette — legacy / non-reactive default. */
export const colors = darkColors;

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

// ─── Elevation helpers ──────────────────────────────────────────────────────
// Cross-platform soft shadows. Pass the active palette's `shadow` color so the
// glow tints correctly in both light and dark modes.
export function elevation(
  level: 1 | 2 | 3,
  shadowColor = '#000000',
): {
  shadowColor: string; shadowOpacity: number; shadowRadius: number;
  shadowOffset: { width: number; height: number }; elevation: number;
} {
  const map = {
    1: { shadowOpacity: 0.12, shadowRadius: 8, offY: 3, elevation: 3 },
    2: { shadowOpacity: 0.18, shadowRadius: 18, offY: 8, elevation: 8 },
    3: { shadowOpacity: 0.28, shadowRadius: 30, offY: 14, elevation: 16 },
  } as const;
  const m = map[level];
  return {
    shadowColor,
    shadowOpacity: m.shadowOpacity,
    shadowRadius: m.shadowRadius,
    shadowOffset: { width: 0, height: m.offY },
    elevation: m.elevation,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Theme store (persisted)
// ═══════════════════════════════════════════════════════════════════════════
const THEME_KEY = 'handla_theme';
const isWeb = Platform.OS === 'web';

async function persistMode(mode: ThemeMode): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.setItem(THEME_KEY, mode);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(THEME_KEY, mode);
  } catch {
    /* ignore */
  }
}

async function readPersistedMode(): Promise<ThemeMode | null> {
  if (isWeb) {
    try {
      const v = globalThis.localStorage?.getItem(THEME_KEY) ?? null;
      return v === 'light' || v === 'dark' ? v : null;
    } catch {
      return null;
    }
  }
  try {
    const v = await SecureStore.getItemAsync(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

interface ThemeState {
  mode: ThemeMode;
  colors: Palette;
  hydrated: boolean;
  /** Load persisted preference (falling back to the OS color scheme). */
  hydrate: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggle: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'dark',
  colors: darkColors,
  hydrated: false,

  hydrate: async () => {
    const stored = await readPersistedMode();
    const mode: ThemeMode = stored ?? (Appearance.getColorScheme() === 'light' ? 'light' : 'dark');
    set({ mode, colors: palettes[mode], hydrated: true });
  },

  setMode: async (mode) => {
    if (mode === get().mode) return;
    await persistMode(mode);
    set({ mode, colors: palettes[mode] });
  },

  toggle: async () => {
    const next: ThemeMode = get().mode === 'dark' ? 'light' : 'dark';
    await persistMode(next);
    set({ mode: next, colors: palettes[next] });
  },
}));

/**
 * Ergonomic theme hook. Returns the ACTIVE palette plus controls.
 * Re-renders the consuming component whenever the mode changes.
 */
export function useTheme() {
  const mode = useThemeStore((s) => s.mode);
  const activeColors = useThemeStore((s) => s.colors);
  const setMode = useThemeStore((s) => s.setMode);
  const toggle = useThemeStore((s) => s.toggle);
  return { colors: activeColors, mode, isDark: mode === 'dark', setMode, toggle, spacing, radius, font, elevation };
}
