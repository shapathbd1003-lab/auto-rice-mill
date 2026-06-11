import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary:   { main: '#1B5E20', light: '#4CAF50', dark: '#0a3d0a' },
    secondary: { main: '#FF8F00', light: '#FFB300', dark: '#E65100' },
    background:{ default: '#F5F5F5', paper: '#FFFFFF' },
    success:   { main: '#2E7D32' },
    warning:   { main: '#F57F17' },
    error:     { main: '#C62828' },
    info:      { main: '#0277BD' },
  },
  typography: {
    fontFamily: '"Roboto", "Hind Siliguri", sans-serif',
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiButton: {
      styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } },
    },
    MuiCard: {
      styleOverrides: { root: { borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' } },
    },
    MuiTableHead: {
      styleOverrides: { root: { backgroundColor: '#E8F5E9' } },
    },
  },
});

export default theme;
