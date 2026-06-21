import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, CircularProgress, InputAdornment,
} from '@mui/material';
import { Person, Lock, Grain } from '@mui/icons-material';
import { setCredentials } from '../../store/authSlice';
import api from '../../services/api';

export default function Login() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const [form, setForm]     = useState({ username: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/v2/auth/login', form);
      dispatch(setCredentials(data.data));
      navigate('/');
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Login failed'
      );
    } finally { setLoading(false); }
  };

  return (
    <Box sx={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', bgcolor:'#1B5E20' }}>
      <Card sx={{ width:'100%', maxWidth:400, mx:2, borderRadius:2 }}>
        <CardContent sx={{ p:{ xs:3, sm:4 } }}>
          <Box sx={{ textAlign:'center', mb:3 }}>
            <Grain sx={{ fontSize:52, color:'#1B5E20' }} />
            <Typography variant="h5" fontWeight="bold" color="#1B5E20">
              Mithila Auto Rice Mill
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ERP Management System v2.0
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth label="Username / Email" value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              margin="normal" required autoComplete="username"
              InputProps={{ startAdornment: <InputAdornment position="start"><Person /></InputAdornment> }}
            />
            <TextField
              fullWidth label="Password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              margin="normal" type="password" required autoComplete="current-password"
              InputProps={{ startAdornment: <InputAdornment position="start"><Lock /></InputAdornment> }}
            />
            <Button
              fullWidth variant="contained" type="submit"
              disabled={loading} size="large"
              sx={{ mt:3, bgcolor:'#1B5E20', '&:hover':{ bgcolor:'#2E7D32' } }}>
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ display:'block', textAlign:'center', mt:2 }}>
            Default: admin@ricemill.com / Admin@1234
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
