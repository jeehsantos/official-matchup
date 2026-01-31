import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';
const THEME_CACHE_KEY = 'theme-cache';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Always check localStorage first and use it if available
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (stored) {
      sessionStorage.setItem(THEME_CACHE_KEY, stored);
      return stored;
    }

    // Fall back to cached theme (e.g. if auth sign-out cleared localStorage)
    const cached = sessionStorage.getItem(THEME_CACHE_KEY) as Theme | null;
    if (cached) {
      localStorage.setItem(THEME_STORAGE_KEY, cached);
      return cached;
    }

    // Only use system preference if no stored preference exists
    // Then immediately save it to prevent future changes
    const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    localStorage.setItem(THEME_STORAGE_KEY, systemPreference);
    sessionStorage.setItem(THEME_CACHE_KEY, systemPreference);
    return systemPreference;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Always persist theme choice
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    sessionStorage.setItem(THEME_CACHE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return { theme, setTheme, toggleTheme };
}
