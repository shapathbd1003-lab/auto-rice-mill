import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, TextField, CircularProgress, Alert, Select, MenuItem, FormControl, InputLabel,
  Card, CardContent, CardActionArea, Checkbox, Stack, useMediaQuery, useTheme,
  Switch, FormControlLabel,
} from '@mui/material';
import { Add, Edit, Delete, Security, People, History } from '@mui/icons-material';
import api from '../../services/api';

const MODULES = ['masters','vouchers','reports','admin','purchase','sales','production','inventory','accounting','employees','banking'];
const ROLE_COLORS = { Administrator:'error', Manager:'warning', 'Chief Accountant':'primary', 'Junior Accountant':'info', Cashier:'success', 'Store Keeper':'secondary', 'Sales Executive':'success', 'Production Operator':'default', Auditor:'default' };
const ACTION_COLORS = { CREATE:'success', UPDATE:'primary', DELETE:'error', LOGIN:'info', APPROVE:'success', CANCEL:'warning' };

function RolesTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const [form, setForm] = useState({ name:'', description:'', permissions:{} });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = () => { setLoading(true); api.get('/v2/masters/roles').then((r) => setRoles(r.data.data||[])).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditRole(null); setForm({ name:'', description:'', permissions:{} }); setError(''); setDialog(true); };
  const openEdit = (r) => {
    setEditRole(r);
    const perms = {};
    setForm({ name:r.name, description:r.description||'', permissions:perms });
    setError(''); setDialog(true);
  };

  const togglePerm = (module, action) => {
    const perms = { ...form.permissions };
    if (!perms[module]) perms[module] = { can_view:false, can_create:false, can_edit:false, can_delete:false, can_approve:false };
    perms[module][action] = !perms[module][action];
    setForm({ ...form, permissions: perms });
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const permissions = MODULES.map((m) => ({ module:m, ...(form.permissions[m]||{ can_view:false, can_create:false, can_edit:false, can_delete:false, can_approve:false }) }));
      if (editRole) {
        await api.put(`/v2/masters/roles/${editRole.id}`, { name:form.name, description:form.description, permissions });
      } else {
        await api.post('/v2/masters/roles', { name:form.name, description:form.description, permissions });
      }
      setDialog(false); setForm({ name:'', description:'', permissions:{} }); load();
    } catch(e) { setError(e.response?.data?.error?.message||'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/v2/masters/roles/${id}`); setDeleteConfirm(null); load(); }
    catch(e) { alert(e.response?.data?.error?.message||'Cannot delete'); }
  };

  const RoleRow = ({ r }) => (
    <>
      <Chip label={r.name} color={ROLE_COLORS[r.name]||'default'} size="small"/>
      {!r.is_system && (
        <Box sx={{ display:'inline-flex', ml:1 }}>
          <IconButton size="small" onClick={() => openEdit(r)}><Edit fontSize="small"/></IconButton>
          <IconButton size="small" color="error" onClick={() => setDeleteConfirm(r)}><Delete fontSize="small"/></IconButton>
        </Box>
      )}
    </>
  );

  return (
    <>
      <Box sx={{ display:'flex', justifyContent:'flex-end', mb:2 }}>
        <Button variant="contained" startIcon={<Add/>} onClick={openAdd} sx={{ bgcolor:'#1B5E20' }}>
          Create Role
        </Button>
      </Box>

      {isMobile ? (
        <Stack spacing={1}>
          {loading && <Box sx={{ textAlign:'center' }}><CircularProgress size={24}/></Box>}
          {roles.map((r) => (
            <Card key={r.id} variant="outlined">
              <CardContent sx={{ pb:1 }}>
                <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <Box>
                    <Chip label={r.name} color={ROLE_COLORS[r.name]||'default'} size="small" sx={{ mb:0.5 }}/>
                    <Typography variant="caption" display="block" color="text.secondary">{r.description}</Typography>
                    <Chip label={`${r.user_count} users`} size="small" variant="outlined" sx={{ mt:0.5 }}/>
                  </Box>
                  <Box sx={{ display:'flex', gap:0.5 }}>
                    {r.is_system && <Chip label="System" size="small"/>}
                    {!r.is_system && <>
                      <IconButton size="small" onClick={() => openEdit(r)}><Edit fontSize="small"/></IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteConfirm(r)}><Delete fontSize="small"/></IconButton>
                    </>}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <Paper>
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor:'grey.100' }}><TableCell>Role Name</TableCell><TableCell>Description</TableCell><TableCell>Users</TableCell><TableCell>System</TableCell><TableCell align="center">Actions</TableCell></TableRow></TableHead>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={5} align="center"><CircularProgress size={24}/></TableCell></TableRow>
                : roles.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell><Chip label={r.name} color={ROLE_COLORS[r.name]||'default'} size="small"/></TableCell>
                    <TableCell sx={{ color:'text.secondary', fontSize:12 }}>{r.description}</TableCell>
                    <TableCell><Chip label={`${r.user_count} users`} size="small" variant="outlined"/></TableCell>
                    <TableCell>{r.is_system ? <Chip label="System" size="small"/> : '—'}</TableCell>
                    <TableCell align="center">
                      {!r.is_system && <>
                        <IconButton size="small" onClick={() => openEdit(r)}><Edit fontSize="small"/></IconButton>
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(r)}><Delete fontSize="small"/></IconButton>
                      </>}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Create/Edit Role Dialog */}
      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editRole ? `Edit Role: ${editRole.name}` : 'Create New Role'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt:0 }}>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Role Name *" value={form.name} onChange={(e) => setForm({...form,name:e.target.value})} autoFocus disabled={!!editRole?.is_system}/></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Description" value={form.description} onChange={(e) => setForm({...form,description:e.target.value})}/></Grid>
          </Grid>
          <Typography variant="subtitle2" sx={{ mt:2, mb:1 }}>Module Permissions</Typography>
          <Paper variant="outlined" sx={{ overflowX:'auto' }}>
            <Table size="small">
              <TableHead><TableRow sx={{ bgcolor:'grey.50' }}><TableCell>Module</TableCell><TableCell align="center">View</TableCell><TableCell align="center">Create</TableCell><TableCell align="center">Edit</TableCell><TableCell align="center">Delete</TableCell><TableCell align="center">Approve</TableCell></TableRow></TableHead>
              <TableBody>
                {MODULES.map((m) => {
                  const p = form.permissions[m]||{};
                  return (
                    <TableRow key={m} hover>
                      <TableCell sx={{ textTransform:'capitalize', fontSize:12 }}>{m}</TableCell>
                      {['can_view','can_create','can_edit','can_delete','can_approve'].map((a) => (
                        <TableCell key={a} align="center" sx={{ p:0 }}>
                          <Checkbox size="small" checked={!!p[a]} onChange={() => togglePerm(m,a)} sx={{ color:'#1B5E20', '&.Mui-checked':{ color:'#1B5E20' } }}/>
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving||!form.name} sx={{ bgcolor:'#1B5E20' }}>
            {saving ? <CircularProgress size={20}/> : editRole ? 'Update Role' : 'Create Role'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)} maxWidth="xs">
        <DialogTitle>Delete Role?</DialogTitle>
        <DialogContent><Typography>Delete <strong>{deleteConfirm?.name}</strong>? This cannot be undone.</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => handleDelete(deleteConfirm?.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function UsersTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ name:'', email:'', phone:'', password:'', role_ids:[], is_active:true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/v2/masters/users'), api.get('/v2/masters/roles')])
      .then(([u,r]) => { setUsers(u.data.data||[]); setRoles(r.data.data||[]); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditUser(null); setForm({ name:'', email:'', phone:'', password:'', role_ids:[], is_active:true }); setError(''); setDialog(true); };
  const openEdit = (u) => { setEditUser(u); setForm({ name:u.name, email:u.email, phone:u.phone||'', password:'', role_ids:[], is_active:u.is_active }); setError(''); setDialog(true); };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/v2/masters/users/${id}`);
      setDeleteConfirm(null); load();
    } catch(e) { alert(e.response?.data?.error?.message || 'Cannot delete user'); }
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      if (editUser) {
        await api.put(`/v2/masters/users/${editUser.id}`, { name:form.name, phone:form.phone, is_active:form.is_active, ...(form.password ? { password:form.password } : {}), ...(form.role_ids.length>0 ? { role_ids:form.role_ids } : {}) });
      } else {
        await api.post('/v2/masters/users', { name:form.name, email:form.email, phone:form.phone, password:form.password, role_ids:form.role_ids });
      }
      setDialog(false); load();
    } catch(e) { setError(e.response?.data?.error?.message||'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Box sx={{ display:'flex', justifyContent:'flex-end', mb:2 }}>
        <Button variant="contained" startIcon={<Add/>} onClick={openAdd} sx={{ bgcolor:'#1B5E20' }}>Add User</Button>
      </Box>

      {isMobile ? (
        <Stack spacing={1}>
          {loading && <Box sx={{ textAlign:'center' }}><CircularProgress size={24}/></Box>}
          {users.map((u) => (
            <Card key={u.id} variant="outlined">
              <CardContent sx={{ pb:1 }}>
                <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <Box sx={{ flex:1, mr:1 }}>
                    <Typography fontWeight="bold" variant="body2">{u.name}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">{u.email}</Typography>
                    <Box sx={{ mt:0.5, display:'flex', flexWrap:'wrap', gap:0.5 }}>
                      {(u.roles||[]).map((r) => <Chip key={r} label={r} size="small" color={ROLE_COLORS[r]||'default'}/>)}
                    </Box>
                  </Box>
                  <Box sx={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:0.5 }}>
                    <Chip label={u.is_active?'Active':'Inactive'} color={u.is_active?'success':'default'} size="small"/>
                    <Box sx={{ display:'flex' }}>
                      <IconButton size="small" onClick={() => openEdit(u)}><Edit fontSize="small"/></IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteConfirm(u)}><Delete fontSize="small"/></IconButton>
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <Paper>
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor:'grey.100' }}><TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Roles</TableCell><TableCell>Last Login</TableCell><TableCell>Status</TableCell><TableCell align="center">Actions</TableCell></TableRow></TableHead>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={6} align="center"><CircularProgress size={24}/></TableCell></TableRow>
                : users.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell sx={{ fontWeight:'bold' }}>{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{(u.roles||[]).map((r) => <Chip key={r} label={r} size="small" color={ROLE_COLORS[r]||'default'} sx={{ mr:0.5 }}/>)}</TableCell>
                    <TableCell sx={{ fontSize:12 }}>{u.last_login ? new Date(u.last_login).toLocaleDateString('en-IN') : 'Never'}</TableCell>
                    <TableCell><Chip label={u.is_active?'Active':'Inactive'} color={u.is_active?'success':'default'} size="small"/></TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => openEdit(u)}><Edit fontSize="small"/></IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteConfirm(u)}><Delete fontSize="small"/></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editUser ? `Edit: ${editUser.name}` : 'Add New User'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt:0 }}>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Full Name *" value={form.name} onChange={(e) => setForm({...form,name:e.target.value})} autoFocus/></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Email *" value={form.email} onChange={(e) => setForm({...form,email:e.target.value})} disabled={!!editUser}/></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Phone" value={form.phone} onChange={(e) => setForm({...form,phone:e.target.value})}/></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label={editUser ? 'New Password (blank = keep)' : 'Password *'} type="password" value={form.password} onChange={(e) => setForm({...form,password:e.target.value})}/></Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Assign Roles {!editUser && '*'}</InputLabel>
                <Select
                  multiple
                  value={form.role_ids}
                  label={`Assign Roles ${!editUser ? '*' : ''}`}
                  onChange={(e) => setForm({...form,role_ids:e.target.value})}
                  MenuProps={{ PaperProps:{ style:{ maxHeight:200 } } }}
                  renderValue={(sel) => (
                    <Box sx={{ display:'flex', flexWrap:'wrap', gap:0.5 }}>
                      {roles.filter((r) => sel.includes(r.id)).map((r) => <Chip key={r.id} label={r.name} size="small"/>)}
                    </Box>
                  )}>
                  {roles.map((r) => (
                    <MenuItem key={r.id} value={r.id}>
                      <Chip label={r.name} size="small" color={ROLE_COLORS[r.name]||'default'} sx={{ mr:1 }}/>{r.description||r.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {editUser && (
              <Grid item xs={12}>
                <FormControlLabel control={<Switch checked={form.is_active} onChange={(e) => setForm({...form,is_active:e.target.checked})}/>} label="Active"/>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2 }}>
          <Button onClick={() => setDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}
            disabled={saving || !form.name || (!editUser && (!form.email || !form.password || form.role_ids.length===0))}
            sx={{ bgcolor:'#1B5E20' }}>
            {saving ? <CircularProgress size={20}/> : editUser ? 'Update User' : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete User Confirm */}
      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)} maxWidth="xs">
        <DialogTitle>Delete User?</DialogTitle>
        <DialogContent>
          <Typography>Delete <strong>{deleteConfirm?.name}</strong> ({deleteConfirm?.email})?</Typography>
          <Typography variant="body2" color="error" sx={{ mt:1 }}>This will permanently remove the user. This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => handleDelete(deleteConfirm?.id)}>Delete User</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function AuditTab() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(new Date().toISOString().slice(0,10));

  useEffect(() => {
    setLoading(true);
    api.get('/v2/masters/audit-trail', { params:{ from, limit:100 } })
      .then((r) => setLogs(r.data.data||[]))
      .finally(() => setLoading(false));
  }, [from]);

  return (
    <>
      <Box sx={{ mb:2 }}>
        <TextField size="small" type="date" label="From Date" value={from}
          onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink:true }}
          sx={{ width:{ xs:'100%', sm:180 } }}/>
      </Box>

      {isMobile ? (
        <Stack spacing={1}>
          {loading && <Box sx={{ textAlign:'center' }}><CircularProgress size={24}/></Box>}
          {logs.length===0 && !loading && <Paper sx={{ p:3, textAlign:'center', color:'text.secondary' }}>No audit logs</Paper>}
          {logs.map((l) => (
            <Card key={l.id} variant="outlined">
              <CardContent sx={{ py:1 }}>
                <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <Box>
                    <Chip label={l.action} color={ACTION_COLORS[l.action]||'default'} size="small" sx={{ mb:0.5 }}/>
                    <Typography variant="body2" fontWeight="bold">{l.user_name}</Typography>
                    <Typography variant="caption" color="text.secondary">{l.entity_type} — {l.entity_ref||l.entity_id||'—'}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.disabled" sx={{ whiteSpace:'nowrap', ml:1 }}>
                    {new Date(l.created_at).toLocaleDateString('en-IN')}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <Paper>
          <Table size="small">
            <TableHead><TableRow sx={{ bgcolor:'grey.100' }}><TableCell>Time</TableCell><TableCell>User</TableCell><TableCell>Action</TableCell><TableCell>Entity</TableCell><TableCell>Reference</TableCell></TableRow></TableHead>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={5} align="center"><CircularProgress size={24}/></TableCell></TableRow>
                : logs.length===0 ? <TableRow><TableCell colSpan={5} align="center" sx={{ color:'text.secondary' }}>No audit logs</TableCell></TableRow>
                : logs.map((l) => (
                  <TableRow key={l.id} hover>
                    <TableCell sx={{ fontSize:12, whiteSpace:'nowrap' }}>{new Date(l.created_at).toLocaleString('en-IN')}</TableCell>
                    <TableCell>{l.user_name}</TableCell>
                    <TableCell><Chip label={l.action} color={ACTION_COLORS[l.action]||'default'} size="small"/></TableCell>
                    <TableCell sx={{ textTransform:'capitalize' }}>{l.entity_type}</TableCell>
                    <TableCell sx={{ fontSize:12 }}>{l.entity_ref||l.entity_id||'—'}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </>
  );
}

const ADMIN_SECTIONS = [
  { key:'roles',       label:'Roles & Permissions', icon:<Security/>  },
  { key:'users',       label:'Users',                icon:<People/>    },
  { key:'audit-trail', label:'Audit Trail',          icon:<History/>   },
];

export default function Admin() {
  const { section } = useParams();
  const navigate = useNavigate();

  if (!section) {
    return (
      <Box>
        <Typography variant="h5" fontWeight="bold" sx={{ mb:3 }}>Administration</Typography>
        <Grid container spacing={2}>
          {ADMIN_SECTIONS.map((s) => (
            <Grid item xs={12} sm={6} md={4} key={s.key}>
              <Card>
                <CardActionArea onClick={() => navigate(`/admin/${s.key}`)} sx={{ p:2 }}>
                  <Box sx={{ display:'flex', alignItems:'center', gap:2 }}>
                    <Box sx={{ color:'#1B5E20' }}>{s.icon}</Box>
                    <Typography fontWeight="bold">{s.label}</Typography>
                  </Box>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  const sec = ADMIN_SECTIONS.find((s) => s.key===section);

  return (
    <Box>
      <Box sx={{ mb:2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ cursor:'pointer' }} onClick={() => navigate('/admin')}>← Administration</Typography>
        <Typography variant="h5" fontWeight="bold">{sec?.label||section}</Typography>
      </Box>
      {section==='roles'       && <RolesTab/>}
      {section==='users'       && <UsersTab/>}
      {section==='audit-trail' && <AuditTab/>}
    </Box>
  );
}
