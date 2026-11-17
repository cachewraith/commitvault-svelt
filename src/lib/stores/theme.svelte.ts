export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'cv-theme';

function readStored(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/**
 * Colour theme. Dark is the default; the choice is persisted in localStorage
 * and applied before first paint by `static/theme-init.js`.
 */
class ThemeStore {
  current = $state<Theme>(typeof window === 'undefined' ? 'dark' : readStored());

  get isDark(): boolean {
    return this.current === 'dark';
  }

  set(theme: Theme): void {
    this.current = theme;
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage unavailable (private mode): the theme still applies for this visit.
    }
  }

  toggle(): void {
    this.set(this.current === 'dark' ? 'light' : 'dark');
  }
}

export const theme = new ThemeStore();
