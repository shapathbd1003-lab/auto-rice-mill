import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Typography, List, ListItem, ListItemText, ListItemIcon,
  IconButton, Chip, Button, Divider, CircularProgress, Paper,
} from '@mui/material';
import {
  Notifications as NotifIcon, CheckCircle, Warning, Info,
  AccountBalance, Inventory, DoneAll,
} from '@mui/icons-material';
import { setNotifications, markRead, markAllRead } from '../../store/notificationSlice';
import api from '../../services/api';

const TYPE_META = {
  LOW_STOCK:       { icon: <Inventory />,       color: 'warning' },
  OVERDUE_PAYMENT: { icon: <AccountBalance />,  color: 'error' },
  SALARY_REMINDER: { icon: <Warning />,         color: 'warning' },
  DAILY_SUMMARY:   { icon: <Info />,            color: 'info' },
};

export default function Notifications() {
  const dispatch = useDispatch();
  const { items } = useSelector((s) => s.notifications);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    api.get('/notifications')
      .then((r) => dispatch(setNotifications(r.data.data || [])))
      .finally(() => setLoading(false));
  }, [dispatch]);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = async (id) => {
    await api.put(`/notifications/${id}/read`);
    dispatch(markRead(id));
  };

  const handleMarkAll = async () => {
    await api.put('/notifications/read-all');
    dispatch(markAllRead());
  };

  const meta = (type) => TYPE_META[type] || { icon: <NotifIcon />, color: 'default' };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Notifications</Typography>
        <Button size="small" startIcon={<DoneAll />} onClick={handleMarkAll} disabled={!items.some((n) => !n.is_read)}>
          Mark all read
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <CheckCircle sx={{ fontSize: 56, color: 'success.light', mb: 1 }} />
          <Typography color="text.secondary">No notifications</Typography>
        </Paper>
      ) : (
        <Paper>
          <List disablePadding>
            {items.map((n, idx) => {
              const { icon, color } = meta(n.type);
              return (
                <React.Fragment key={n.id}>
                  {idx > 0 && <Divider />}
                  <ListItem
                    sx={{ bgcolor: n.is_read ? 'transparent' : 'action.hover', alignItems: 'flex-start' }}
                    secondaryAction={
                      !n.is_read && (
                        <IconButton size="small" onClick={() => handleMarkRead(n.id)} title="Mark as read">
                          <CheckCircle fontSize="small" color="success" />
                        </IconButton>
                      )
                    }
                  >
                    <ListItemIcon sx={{ mt: 0.5, color: `${color}.main` }}>{icon}</ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={n.is_read ? 'normal' : 'bold'}>
                            {n.title}
                          </Typography>
                          {!n.is_read && <Chip label="New" size="small" color={color} sx={{ height: 18, fontSize: 10 }} />}
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{n.message}</Typography>
                          <Typography variant="caption" color="text.disabled">
                            {new Date(n.created_at).toLocaleString('en-BD')}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                </React.Fragment>
              );
            })}
          </List>
        </Paper>
      )}
    </Box>
  );
}
