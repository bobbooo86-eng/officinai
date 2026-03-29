import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'officinai_theme';

function applyTheme(theme: Theme) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  document.documentElement.classList.toggle('dark', isDark);
}

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return 'light';
}

// Listen for system color scheme changes
let mediaQuery: MediaQueryList | null = null;
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

function setupSystemListener(theme: Theme) {
  // Clean up previous listener
  if (mediaQuery && mediaListener) {
    mediaQuery.removeEventListener('change', mediaListener);
  }

  if (theme === 'system') {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaListener = () => applyTheme('system');
    mediaQuery.addEventListener('change', mediaListener);
  }
}

const initialTheme = getStoredTheme();
applyTheme(initialTheme);
setupSystemListener(initialTheme);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,

  setTheme: (theme: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage unavailable
    }
    applyTheme(theme);
    setupSystemListener(theme);
    set({ theme });
  },
}));
