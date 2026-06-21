import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, CircularProgress, InputAdornment } from '@mui/material';
import { Grain, Email, Lock } from '@mui/icons-material';
import { setCredentials } from '../../store/authSlice';
import api from '../../services/api';
import { isDesktop } from '../../services/desktopAdapter';
import { desktopLogin } from '../../services/offlineAuth';

export default function Login() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let credentials;
      if (isDesktop) {
        credentials = await desktopLogin({ ...form, millId: 1 });
      } else {
        const { data } = await api.post('/auth/login', { ...form, millId: 1 });
        credentials = data.data;
      }
      dispatch(setCredentials(credentials));
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'primary.main' }}>
      <Card sx={{ width: '100%', maxWidth: 400, mx: 2 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Grain sx={{ fontSize: 52, color: 'primary.main' }} />
            <Typography variant="h5" fontWeight="bold" color="primary">{t('app.name')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('app.tagline')}</Typography>
          </Box>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth label={t('auth.email')} value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              margin="normal" type="email" required autoComplete="email"
              InputProps={{ startAdornment: <InputAdornment position="start"><Email /></InputAdornment> }}
            />
            <TextField
              fullWidth label={t('auth.password')} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              margin="normal" type="password" required autoComplete="current-password"
              InputProps={{ startAdornment: <InputAdornment position="start"><Lock /></InputAdornment> }}
            />
            <Button fullWidth variant="contained" type="submit" disabled={loading} size="large" sx={{ mt: 3 }}>
              {loading ? <CircularProgress size={24} color="inherit" /> : t('auth.loginBtn')}
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
            Default: admin@ricemill.com / Admin@1234
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
