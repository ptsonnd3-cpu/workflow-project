import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeMode } from '@/types';
import './ThemeSwitcher.css';

interface ThemeSwitcherProps {
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ 
  showLabel = true, 
  size = 'md',
  className = '' 
}) => {
  const { themeMode, setThemeMode, theme, isLoading } = useTheme();

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  if (isLoading) {
    return (
      <div className={`theme-switcher theme-switcher--${size} ${className}`}>
        <div className="theme-switcher__loading">
          <div className="theme-switcher__spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className={`theme-switcher theme-switcher--${size} ${className}`}>
      {showLabel && (
        <span className="theme-switcher__label">Theme:</span>
      )}
      
      <div className="theme-switcher__options">
        <button
          className={`theme-switcher__option ${themeMode === 'light' ? 'theme-switcher__option--active' : ''}`}
          onClick={() => handleThemeChange('light')}
          title="Light theme"
          type="button"
        >
          <span className="theme-switcher__icon">☀️</span>
          {size === 'lg' && <span className="theme-switcher__text">Light</span>}
        </button>

        <button
          className={`theme-switcher__option ${themeMode === 'dark' ? 'theme-switcher__option--active' : ''}`}
          onClick={() => handleThemeChange('dark')}
          title="Dark theme"
          type="button"
        >
          <span className="theme-switcher__icon">🌙</span>
          {size === 'lg' && <span className="theme-switcher__text">Dark</span>}
        </button>

        <button
          className={`theme-switcher__option ${themeMode === 'auto' ? 'theme-switcher__option--active' : ''}`}
          onClick={() => handleThemeChange('auto')}
          title="Auto (system preference)"
          type="button"
        >
          <span className="theme-switcher__icon">🖥️</span>
          {size === 'lg' && <span className="theme-switcher__text">Auto</span>}
        </button>
      </div>

      {showLabel && themeMode === 'auto' && (
        <span className="theme-switcher__hint">
          (using {theme.mode})
        </span>
      )}
    </div>
  );
};

export default ThemeSwitcher;