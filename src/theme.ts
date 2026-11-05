import { create } from 'zustand';
import { PALETTES, setPalette, type Theme } from './scene/ink';

/**
 * Paper (ink on cream) or blueprint (pale lines on Prussian blue). The choice
 * is remembered; until one is made, a dark system theme starts on blueprint.
 */

const KEY = 'gewu-theme';

function initial(): Theme {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === 'paper' || saved === 'blueprint') return saved;
  } catch { /* private mode */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'blueprint' : 'paper';
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', PALETTES[theme].paper);
  setPalette(PALETTES[theme]);
}

export const useTheme = create<{ theme: Theme; set: (theme: Theme) => void }>((set) => ({
  theme: initial(),
  set: (theme) => {
    try { window.localStorage.setItem(KEY, theme); } catch { /* private mode */ }
    apply(theme);
    set({ theme });
  },
}));

apply(useTheme.getState().theme);
