// Theme override: 'system' (default, follows prefers-color-scheme), 'light' or
// 'dark'. The choice is per-device, so localStorage — not the user doc.
const STORAGE_KEY = 'wc26-theme';

const META_COLORS = { light: '#006341', dark: '#131417' };

export function getTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* storage unavailable */ }
  return 'system';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') {
    root.dataset.theme = theme;
  } else {
    delete root.dataset.theme;
  }
  // Browser-chrome colour: the browser picks the <meta theme-color> whose
  // media query matches the SYSTEM scheme, so an override must set both.
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    const own = meta.media.includes('dark') ? META_COLORS.dark : META_COLORS.light;
    meta.content = theme === 'system' ? own : META_COLORS[theme];
  }
}

export function setTheme(theme) {
  try {
    if (theme === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch { /* storage unavailable */ }
  applyTheme(theme);
}
