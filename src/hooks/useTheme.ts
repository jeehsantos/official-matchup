import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import React from 'react';

type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';
const THEME_CACHE_KEY = 'theme-cache';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  if (stored) {
    sessionStorage.setItem(THEME_CACHE_KEY, stored);
    return stored;
  }
  const cached = sessionStorage.getItem(THEME_CACHE_KEY) as Theme | null;
  if (cached) {
    localStorage.setItem(THEME_STORAGE_KEY, cached);
    return cached;
  }
  const systemPreference: Theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  localStorage.setItem(THEME_STORAGE_KEY, systemPreference);
  sessionStorage.setItem(THEME_CACHE_KEY, systemPreference);
  return systemPreference;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    sessionStorage.setItem(THEME_CACHE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggleTheme = useCallback(() => setThemeState(prev => prev === 'light' ? 'dark' : 'light'), []);

  return React.createElement(ThemeContext.Provider, { value: { theme, setTheme, toggleTheme } }, children);
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
