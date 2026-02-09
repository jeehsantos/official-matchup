import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';
const THEME_CACHE_KEY = 'theme-cache';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Always check localStorage first — this is the user's explicit choice
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }

    // Fall back to sessionStorage cache (survives Supabase auth clearing localStorage)
    const cached = sessionStorage.getItem(THEME_CACHE_KEY) as Theme | null;
    if (cached === 'light' || cached === 'dark') {
      localStorage.setItem(THEME_STORAGE_KEY, cached);
      return cached;
    }

    // First-time visitor: default to dark (matches project aesthetic).
    // Save immediately so the theme is locked in.
    const defaultTheme: Theme = 'dark';
    localStorage.setItem(THEME_STORAGE_KEY, defaultTheme);
    sessionStorage.setItem(THEME_CACHE_KEY, defaultTheme);
    return defaultTheme;
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
