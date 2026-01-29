import { Theme, ThemeColors } from '@/types';

// Light Theme Colors
const lightColors: ThemeColors = {
  primary: '#0066cc',
  secondary: '#6c757d',
  background: '#ffffff',
  surface: '#f8f9fa',
  text: '#212529',
  textSecondary: '#6c757d',
  border: '#dee2e6',
  success: '#28a745',
  warning: '#ffc107',
  error: '#dc3545',
  info: '#17a2b8'
};

// Dark Theme Colors
const darkColors: ThemeColors = {
  primary: '#4dabf7',
  secondary: '#adb5bd',
  background: '#121212',
  surface: '#1e1e1e',
  text: '#e0e0e0',
  textSecondary: '#a0a0a0',
  border: '#333333',
  success: '#51cf66',
  warning: '#ffd43b',
  error: '#ff6b6b',
  info: '#22d3ee'
};

// Base theme structure
const baseTheme = {
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px'
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px'
    }
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px'
  },
  shadows: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
    md: '0 4px 6px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08)',
    lg: '0 10px 25px rgba(0, 0, 0, 0.12), 0 5px 10px rgba(0, 0, 0, 0.08)'
  }
};

// Light Theme
export const lightTheme: Theme = {
  mode: 'light',
  colors: lightColors,
  ...baseTheme
};

// Dark Theme
export const darkTheme: Theme = {
  mode: 'dark',
  colors: darkColors,
  ...baseTheme,
  shadows: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.24), 0 1px 2px rgba(0, 0, 0, 0.48)',
    md: '0 4px 6px rgba(0, 0, 0, 0.24), 0 2px 4px rgba(0, 0, 0, 0.16)',
    lg: '0 10px 25px rgba(0, 0, 0, 0.24), 0 5px 10px rgba(0, 0, 0, 0.16)'
  }
};

// Theme collection
export const themes = {
  light: lightTheme,
  dark: darkTheme
} as const;

// CSS Custom Properties Generator
export const generateCSSVariables = (theme: Theme): string => {
  return `
    --color-primary: ${theme.colors.primary};
    --color-secondary: ${theme.colors.secondary};
    --color-background: ${theme.colors.background};
    --color-surface: ${theme.colors.surface};
    --color-text: ${theme.colors.text};
    --color-text-secondary: ${theme.colors.textSecondary};
    --color-border: ${theme.colors.border};
    --color-success: ${theme.colors.success};
    --color-warning: ${theme.colors.warning};
    --color-error: ${theme.colors.error};
    --color-info: ${theme.colors.info};
    
    --spacing-xs: ${theme.spacing.xs};
    --spacing-sm: ${theme.spacing.sm};
    --spacing-md: ${theme.spacing.md};
    --spacing-lg: ${theme.spacing.lg};
    --spacing-xl: ${theme.spacing.xl};
    
    --font-family: ${theme.typography.fontFamily};
    --font-size-xs: ${theme.typography.fontSize.xs};
    --font-size-sm: ${theme.typography.fontSize.sm};
    --font-size-base: ${theme.typography.fontSize.base};
    --font-size-lg: ${theme.typography.fontSize.lg};
    --font-size-xl: ${theme.typography.fontSize.xl};
    --font-size-2xl: ${theme.typography.fontSize['2xl']};
    
    --border-radius-sm: ${theme.borderRadius.sm};
    --border-radius-md: ${theme.borderRadius.md};
    --border-radius-lg: ${theme.borderRadius.lg};
    
    --shadow-sm: ${theme.shadows.sm};
    --shadow-md: ${theme.shadows.md};
    --shadow-lg: ${theme.shadows.lg};
  `;
};