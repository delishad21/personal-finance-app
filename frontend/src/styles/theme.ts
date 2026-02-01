'use client';

import { createTheme, Theme } from '@mui/material/styles';

// Light theme
export const lightTheme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#9c27b0',
      light: '#ba68c8',
      dark: '#7b1fa2',
    },
    success: {
      main: '#2e7d32',
      light: '#4caf50',
      dark: '#1b5e20',
    },
    error: {
      main: '#d32f2f',
      light: '#ef5350',
      dark: '#c62828',
    },
    warning: {
      main: '#ed6c02',
      light: '#ff9800',
      dark: '#e65100',
    },
    info: {
      main: '#0288d1',
      light: '#03a9f4',
      dark: '#01579b',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.6)',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 500,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0px 2px 4px rgba(0,0,0,0.1)',
    '0px 4px 8px rgba(0,0,0,0.12)',
    '0px 6px 12px rgba(0,0,0,0.15)',
    '0px 8px 16px rgba(0,0,0,0.15)',
    '0px 10px 20px rgba(0,0,0,0.15)',
    '0px 12px 24px rgba(0,0,0,0.15)',
    '0px 14px 28px rgba(0,0,0,0.15)',
    '0px 16px 32px rgba(0,0,0,0.15)',
    '0px 18px 36px rgba(0,0,0,0.15)',
    '0px 20px 40px rgba(0,0,0,0.15)',
    '0px 22px 44px rgba(0,0,0,0.15)',
    '0px 24px 48px rgba(0,0,0,0.15)',
    '0px 26px 52px rgba(0,0,0,0.15)',
    '0px 28px 56px rgba(0,0,0,0.15)',
    '0px 30px 60px rgba(0,0,0,0.15)',
    '0px 32px 64px rgba(0,0,0,0.15)',
    '0px 34px 68px rgba(0,0,0,0.15)',
    '0px 36px 72px rgba(0,0,0,0.15)',
    '0px 38px 76px rgba(0,0,0,0.15)',
    '0px 40px 80px rgba(0,0,0,0.15)',
    '0px 42px 84px rgba(0,0,0,0.15)',
    '0px 44px 88px rgba(0,0,0,0.15)',
    '0px 46px 92px rgba(0,0,0,0.15)',
    '0px 48px 96px rgba(0,0,0,0.15)',
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

// Dark theme
export const darkTheme: Theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
      light: '#e3f2fd',
      dark: '#42a5f5',
    },
    secondary: {
      main: '#ce93d8',
      light: '#f3e5f5',
      dark: '#ab47bc',
    },
    success: {
      main: '#66bb6a',
      light: '#81c784',
      dark: '#388e3c',
    },
    error: {
      main: '#f44336',
      light: '#e57373',
      dark: '#d32f2f',
    },
    warning: {
      main: '#ffa726',
      light: '#ffb74d',
      dark: '#f57c00',
    },
    info: {
      main: '#29b6f6',
      light: '#4fc3f7',
      dark: '#0288d1',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 500,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0px 2px 4px rgba(0,0,0,0.5)',
    '0px 4px 8px rgba(0,0,0,0.5)',
    '0px 6px 12px rgba(0,0,0,0.5)',
    '0px 8px 16px rgba(0,0,0,0.5)',
    '0px 10px 20px rgba(0,0,0,0.5)',
    '0px 12px 24px rgba(0,0,0,0.5)',
    '0px 14px 28px rgba(0,0,0,0.5)',
    '0px 16px 32px rgba(0,0,0,0.5)',
    '0px 18px 36px rgba(0,0,0,0.5)',
    '0px 20px 40px rgba(0,0,0,0.5)',
    '0px 22px 44px rgba(0,0,0,0.5)',
    '0px 24px 48px rgba(0,0,0,0.5)',
    '0px 26px 52px rgba(0,0,0,0.5)',
    '0px 28px 56px rgba(0,0,0,0.5)',
    '0px 30px 60px rgba(0,0,0,0.5)',
    '0px 32px 64px rgba(0,0,0,0.5)',
    '0px 34px 68px rgba(0,0,0,0.5)',
    '0px 36px 72px rgba(0,0,0,0.5)',
    '0px 38px 76px rgba(0,0,0,0.5)',
    '0px 40px 80px rgba(0,0,0,0.5)',
    '0px 42px 84px rgba(0,0,0,0.5)',
    '0px 44px 88px rgba(0,0,0,0.5)',
    '0px 46px 92px rgba(0,0,0,0.5)',
    '0px 48px 96px rgba(0,0,0,0.5)',
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundImage: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundImage: 'none',
        },
      },
    },
  },
});
