import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Theme, ThemeMode } from '@/types';
import { themes, generateCSSVariables } from '@/themes';

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: ThemeMode;
}

// Detect system preference
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

// Get stored theme or default
const getInitialTheme = (defaultTheme?: ThemeMode): ThemeMode => {
  if (typeof window === 'undefined') return defaultTheme || 'light';
  
  const stored = localStorage.getItem('theme') as ThemeMode;
  if (stored && (stored === 'light' || stored === 'dark' || stored === 'auto')) {
    return stored;
  }
  
  return defaultTheme || 'auto';
};

// Resolve theme based on mode
const resolveTheme = (mode: ThemeMode): Theme => {
  if (mode === 'auto') {
    const systemTheme = getSystemTheme();
    return themes[systemTheme];
  }
  return themes[mode];
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ 
  children, 
  defaultTheme = 'auto' 
}) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => 
    getInitialTheme(defaultTheme)
  );
  const [isLoading, setIsLoading] = useState(true);
  
  const theme = resolveTheme(themeMode);

  // Update CSS variables when theme changes
  useEffect(() => {
    const root = document.documentElement;
    const cssVariables = generateCSSVariables(theme);
    
    // Apply CSS variables
    const style = document.createElement('style');
    style.textContent = `:root { ${cssVariables} }`;
    
    // Remove previous theme style
    const existingStyle = document.getElementById('theme-variables');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    style.id = 'theme-variables';
    document.head.appendChild(style);
    
    // Update data attribute for theme-aware CSS
    root.setAttribute('data-theme', theme.mode);
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme.colors.background);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = theme.colors.background;
      document.head.appendChild(meta);
    }
    
    setIsLoading(false);
  }, [theme]);

  // Listen to system theme changes when in auto mode
  useEffect(() => {
    if (themeMode !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      // Force re-render to update theme
      setThemeModeState('auto');
    };

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [themeMode]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('theme', mode);
  };

  const toggleTheme = () => {
    const newMode = theme.mode === 'light' ? 'dark' : 'light';
    setThemeMode(newMode);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeMode,
        toggleTheme,
        setThemeMode,
        isLoading
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// CSS-in-JS helper hook
export const useThemeStyles = () => {
  const { theme } = useTheme();
  
  return {
    theme,
    css: {
      background: theme.colors.background,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily
    }
  };
};