import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ThemeColor = 'navy' | 'emerald' | 'purple' | 'rose' | 'amber' | 'slate';
export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  color: ThemeColor;
  mode: ThemeMode;
  setColor: (c: ThemeColor) => void;
  setMode: (m: ThemeMode) => void;
}

const STORAGE_COLOR = 'theme_color';
const STORAGE_MODE = 'theme_mode';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Each theme defines its base HUE and a few brand-specific lightness values.
 * Every other token (background, card, foreground, muted, border, sidebar,
 * etc.) is derived from this HUE for both light and dark mode, so swapping
 * the theme color recolors the entire UI consistently and keeps contrast
 * legible — no more navy text/cards leaking into other themes.
 */
type ThemeDef = {
  hue: number;          // base hue 0-360
  sat: number;          // background saturation %
  primaryL: number;     // primary lightness (light mode)
  primaryFgDark: boolean; // true => use dark text on primary (e.g. amber)
};

const THEMES: Record<ThemeColor, ThemeDef> = {
  navy:    { hue: 215, sat: 55, primaryL: 28, primaryFgDark: false },
  emerald: { hue: 160, sat: 60, primaryL: 32, primaryFgDark: false },
  purple:  { hue: 265, sat: 55, primaryL: 42, primaryFgDark: false },
  rose:    { hue: 345, sat: 65, primaryL: 46, primaryFgDark: false },
  amber:   { hue: 32,  sat: 80, primaryL: 50, primaryFgDark: true  },
  slate:   { hue: 220, sat: 15, primaryL: 32, primaryFgDark: false },
};

export const THEME_COLORS: { value: ThemeColor; label: string; swatch: string }[] = (
  Object.entries(THEMES) as [ThemeColor, ThemeDef][]
).map(([value, t]) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
  swatch: `hsl(${t.hue} ${Math.max(40, t.sat)}% ${t.primaryL}%)`,
}));

const hsl = (h: number, s: number, l: number) => `${h} ${s}% ${l}%`;

const buildTokens = (color: ThemeColor, mode: ThemeMode) => {
  const t = THEMES[color] ?? THEMES.navy;
  const { hue: h, sat: s, primaryL, primaryFgDark } = t;
  const light = mode === 'light';

  // Foreground / background base
  const bg          = light ? hsl(h, Math.min(20, s), 98) : hsl(h, Math.max(20, s - 25), 7);
  const fg          = light ? hsl(h, 35, 14)              : hsl(h, 15, 95);
  const card        = light ? hsl(0, 0, 100)              : hsl(h, Math.max(20, s - 25), 11);
  const cardFg      = fg;
  const popover     = card;
  const popoverFg   = fg;

  // Primary
  const primary     = hsl(h, s, primaryL);
  const primaryFg   = primaryFgDark ? hsl(0, 0, 10) : hsl(0, 0, 100);

  // Secondary / muted / accent (light tints of the hue)
  const secondary   = light ? hsl(h, Math.min(25, s), 93) : hsl(h, Math.max(15, s - 30), 18);
  const secondaryFg = light ? hsl(h, 40, 22)              : hsl(h, 15, 92);
  const muted       = light ? hsl(h, Math.min(20, s), 95) : hsl(h, Math.max(15, s - 30), 15);
  const mutedFg     = light ? hsl(h, 12, 42)              : hsl(h, 12, 65);
  const accent      = light ? hsl(h, Math.min(35, s), 88) : hsl(h, Math.max(20, s - 25), 22);
  const accentFg    = light ? hsl(h, 40, 20)              : hsl(h, 15, 92);

  // Borders
  const border      = light ? hsl(h, 18, 88)              : hsl(h, 25, 20);
  const input       = border;
  const ring        = primary;

  // Sidebar
  const sidebarBg   = light ? hsl(h, Math.max(40, s), Math.max(18, primaryL - 6))
                            : hsl(h, Math.max(30, s - 15), 10);
  const sidebarFg   = hsl(h, 20, 95);
  const sidebarPrim = light ? hsl(h, 25, 88)              : hsl(h, 25, 80);
  const sidebarPrimFg = light ? hsl(h, s, primaryL)       : hsl(h, s, 12);
  const sidebarAcc  = light ? hsl(h, Math.max(35, s - 10), Math.max(24, primaryL))
                            : hsl(h, Math.max(25, s - 20), 18);
  const sidebarAccFg = hsl(h, 20, 95);
  const sidebarBorder = light ? hsl(h, Math.max(30, s - 15), Math.max(28, primaryL + 4))
                              : hsl(h, Math.max(25, s - 20), 18);
  const sidebarRing = sidebarPrim;

  return {
    '--background': bg,
    '--foreground': fg,
    '--card': card,
    '--card-foreground': cardFg,
    '--popover': popover,
    '--popover-foreground': popoverFg,
    '--primary': primary,
    '--primary-foreground': primaryFg,
    '--secondary': secondary,
    '--secondary-foreground': secondaryFg,
    '--muted': muted,
    '--muted-foreground': mutedFg,
    '--accent': accent,
    '--accent-foreground': accentFg,
    '--border': border,
    '--input': input,
    '--ring': ring,
    '--card-hover': primary,
    '--sidebar-background': sidebarBg,
    '--sidebar-foreground': sidebarFg,
    '--sidebar-primary': sidebarPrim,
    '--sidebar-primary-foreground': sidebarPrimFg,
    '--sidebar-accent': sidebarAcc,
    '--sidebar-accent-foreground': sidebarAccFg,
    '--sidebar-border': sidebarBorder,
    '--sidebar-ring': sidebarRing,
  } as Record<string, string>;
};

const readStored = <T extends string>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return (v as T) || fallback;
  } catch {
    return fallback;
  }
};

export const applyTheme = (color: ThemeColor, mode: ThemeMode) => {
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  const tokens = buildTokens(color, mode);
  for (const [k, v] of Object.entries(tokens)) {
    root.style.setProperty(k, v);
  }
};

// Apply immediately on import to avoid flash of unstyled theme.
if (typeof document !== 'undefined') {
  applyTheme(
    readStored<ThemeColor>(STORAGE_COLOR, 'navy'),
    readStored<ThemeMode>(STORAGE_MODE, 'light'),
  );
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [color, setColorState] = useState<ThemeColor>(() => readStored<ThemeColor>(STORAGE_COLOR, 'navy'));
  const [mode, setModeState] = useState<ThemeMode>(() => readStored<ThemeMode>(STORAGE_MODE, 'light'));

  useEffect(() => { applyTheme(color, mode); }, [color, mode]);

  const setColor = useCallback((c: ThemeColor) => {
    setColorState(c);
    try { localStorage.setItem(STORAGE_COLOR, c); } catch {}
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try { localStorage.setItem(STORAGE_MODE, m); } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ color, mode, setColor, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
