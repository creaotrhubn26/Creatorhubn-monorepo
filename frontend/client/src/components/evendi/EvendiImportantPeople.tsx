import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemAvatar,
  Avatar,
  Alert,
  Tooltip,
  Divider,
  CircularProgress,
  Collapse,
} from '@mui/material';
import {
  People,
  PersonAdd,
  Edit,
  Delete,
  Phone,
  Email,
  Star,
  RecordVoiceOver,
  Camera,
  Videocam,
  MusicNote,
  LocalFlorist,
  Restaurant,
  EmojiPeople,
  ExpandMore,
  ExpandLess,
  Refresh,
  Notes,
} from '@mui/icons-material';

interface ImportantPerson {
  id: string;
  couple_id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  notes?: string;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

interface CoupleContact {
  couple_id: string;
  couple_name: string;
}

interface EvendiImportantPeopleProps {
  coupleId?: string;
  coupleName?: string;
}

const ROLE_OPTIONS = [
  { value: 'toastmaster', label: 'Toastmaster', icon: <RecordVoiceOver fontSize="small" /> },
  { value: 'bestman', label: 'Bestmann / Forlover', icon: <Star fontSize="small" /> },
  { value: 'maidofhonor', label: 'Forlover (Brud)', icon: <Star fontSize="small" /> },
  { value: 'groomsman', label: 'Forlovere (Brudgom)', icon: <EmojiPeople fontSize="small" /> },
  { value: 'bridesmaid', label: 'Brudepike', icon: <EmojiPeople fontSize="small" /> },
  { value: 'other', label: 'Annet', icon: <People fontSize="small" /> },
];

const VENDOR_ROLE_OPTIONS = [
  { value: 'Fotograf', label: 'Fotograf', icon: <Camera fontSize="small" /> },
  { value: 'Videograf', label: 'Videograf', icon: <Videocam fontSize="small" /> },
  { value: 'DJ', label: 'DJ', icon: <MusicNote fontSize="small" /> },
  { value: 'Florist', label: 'Florist', icon: <LocalFlorist fontSize="small" /> },
  { value: 'Catering', label: 'Catering', icon: <Restaurant fontSize="small" /> },
  { value: 'Koordinator', label: 'Koordinator', icon: <EmojiPeople fontSize="small" /> },
];

function getRoleIcon(role: string) {
  const all = [...ROLE_OPTIONS, ...VENDOR_ROLE_OPTIONS];
  const found = all.find(r => r.value.toLowerCase() === role?.toLowerCase() || r.label.toLowerCase() === role?.toLowerCase());
  return found?.icon || <People fontSize="small" />;
}

function getRoleLabel(role: string) {
  const all = [...ROLE_OPTIONS, ...VENDOR_ROLE_OPTIONS];
  const found = all.find(r => r.value.toLowerCase() === role?.toLowerCase());
  return found?.label || role;
}

function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    toastmaster: '#9C27B0',
    bestman: '#1976D2',
    maidofhonor: '#E91E63',
    groomsman: '#1976D2',
    bridesmaid: '#E91E63',
    fotograf: '#FF9800',
    videograf: '#FF5722',
    dj: '#00BCD4',
    florist: '#4CAF50',
    catering: '#795548',
    koordinator: '#607D8B',
    other: '#9E9E9E',
  };
  return colors[role?.toLowerCase()] || '#9E9E9E';
}

export default function EvendiImportantPeople({ coupleId: propCoupleId, coupleName: propCoupleName }: EvendiImportantPeopleProps) {
  const [people, setPeople] = useState<ImportantPerson[]>([]);
  const [contacts, setContacts] = useState<CoupleContact[]>([]);
  const [selectedCoupleId, setSelectedCoupleId] = useState(propCoupleId || '');
  const [selectedCoupleName, setSelectedCoupleName] = useState(propCoupleName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPerson, setEditPerson] = useState<ImportantPerson | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Load contacts (couples the vendor is connected to)
  useEffect(() => {
    if (propCoupleId) {
      setSelectedCoupleId(propCoupleId);
      setSelectedCoupleName(propCoupleName || '');
      return;
    }
    loadContacts();
  }, [propCoupleId]);

  // Load people when couple changes
  useEffect(() => {
    if (selectedCoupleId) {
      loadPeople();
    }
  }, [selectedCoupleId]);

  async function loadContacts() {
    try {
      const data = await apiRequest('/api/evendi/contacts');
      setContacts(data.contacts || []);
      if (data.contacts?.length === 1 && !selectedCoupleId) {
        setSelectedCoupleId(data.contacts[0].couple_id);
        setSelectedCoupleName(data.contacts[0].couple_name);
      }
    } catch (err) {
      console.error('Failed to load contacts:', err);
    }
  }

  async function loadPeople() {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/api/evendi/important-people?coupleId=${selectedCoupleId}`);
      setPeople(data.people || []);
    } catch (err) {
      console.error('Failed to load important people:', err);
      setError('Kunne ikke hente viktige personer');
    } finally {
      setLoading(false);
    }
  }

  function openAddDialog() {
    setEditPerson(null);
    setFormName('');
    setFormRole('other');
    setFormPhone('');
    setFormEmail('');
    setFormNotes('');
    setDialogOpen(true);
  }

  function openEditDialog(person: ImportantPerson) {
    setEditPerson(person);
    setFormName(person.name);
    setFormRole(person.role);
    setFormPhone(person.phone || '');
    setFormEmail(person.email || '');
    setFormNotes(person.notes || '');
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formRole) return;

    try {
      if (editPerson) {
        await apiRequest(`/api/evendi/important-people/${editPerson.id}`, {
          method: 'PATCH',
          body: {
            name: formName.trim(),
            role: formRole,
            phone: formPhone.trim() || null,
            email: formEmail.trim() || null,
            notes: formNotes.trim() || null,
          },
        });
      } else {
        await apiRequest('/api/evendi/important-people', {
          method: 'POST',
          body: {
            coupleId: selectedCoupleId,
            name: formName.trim(),
            role: formRole,
            phone: formPhone.trim() || null,
            email: formEmail.trim() || null,
            notes: formNotes.trim() || null,
          },
        });
      }
      setDialogOpen(false);
      loadPeople();
    } catch (err) {
      console.error('Failed to save person:', err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Slette denne personen?')) return;
    try {
      await apiRequest(`/api/evendi/important-people/${id}`, { method: 'DELETE' });
      loadPeople();
    } catch (err) {
      console.error('Failed to delete person:', err);
    }
  }

  // Group people by role
  const brideParty = people.filter(p => ['maidofhonor', 'bridesmaid'].includes(p.role?.toLowerCase()));
  const groomParty = people.filter(p => ['bestman', 'groomsman'].includes(p.role?.toLowerCase()));
  const toastmasters = people.filter(p => p.role?.toLowerCase() === 'toastmaster');
  const vendors = people.filter(p => VENDOR_ROLE_OPTIONS.some(v => v.value.toLowerCase() === p.role?.toLowerCase()));
  const others = people.filter(p =>
    !brideParty.includes(p) && !groomParty.includes(p) &&
    !toastmasters.includes(p) && !vendors.includes(p)
  );

  const groups = [
    { title: 'Toastmaster', items: toastmasters, color: '#9C27B0' },
    { title: 'Brudens Følge', items: brideParty, color: '#E91E63' },
    { title: 'Brudgommens Følge', items: groomParty, color: '#1976D2' },
    { title: 'Leverandører', items: vendors, color: '#FF9800' },
    { title: 'Andre', items: others, color: '#607D8B' },
  ].filter(g => g.items.length > 0);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <img src="/evendi-logo.png" alt="Evendi" style={{ width: 28, height: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Deltakere & Leverandører
          </Typography>
          <Chip
            label="EVENDI"
            size="small"
            sx={{ bgcolor: '#E91E63', color: '#fff', fontWeight: 700, fontSize: '0.65rem', height: 20 }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Oppdater">
            <IconButton onClick={loadPeople} disabled={!selectedCoupleId}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            onClick={openAddDialog}
            disabled={!selectedCoupleId}
            sx={{ bgcolor: '#E91E63', '&:hover': { bgcolor: '#C2185B' } }}
          >
            Legg til person
          </Button>
        </Box>
      </Box>

      {/* Couple selector (if not provided via props) */}
      {!propCoupleId && contacts.length > 0 && (
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Velg brudepar</InputLabel>
          <Select
            value={selectedCoupleId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedCoupleId(id);
              const c = contacts.find(c => c.couple_id === id);
              setSelectedCoupleName(c?.couple_name || '');
            }}
            label="Velg brudepar"
          >
            {contacts.map(c => (
              <MenuItem key={c.couple_id} value={c.couple_id}>{c.couple_name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {!selectedCoupleId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Velg et brudepar for å se viktige personer og leverandører knyttet til bryllupet.
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress sx={{ color: '#E91E63' }} />
        </Box>
      ) : selectedCoupleId ? (
        <>
          {/* Stats row */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <Card sx={{ bgcolor: 'rgba(233, 30, 99, 0.08)', border: '1px solid rgba(233, 30, 99, 0.2)' }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#E91E63' }}>
                    {people.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Totalt personer
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card sx={{ bgcolor: 'rgba(156, 39, 176, 0.08)', border: '1px solid rgba(156, 39, 176, 0.2)' }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#9C27B0' }}>
                    {toastmasters.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Toastmaster(e)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card sx={{ bgcolor: 'rgba(25, 118, 210, 0.08)', border: '1px solid rgba(25, 118, 210, 0.2)' }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#1976D2' }}>
                    {brideParty.length + groomParty.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Forlovere / Følge
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card sx={{ bgcolor: 'rgba(255, 152, 0, 0.08)', border: '1px solid rgba(255, 152, 0, 0.2)' }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#FF9800' }}>
                    {vendors.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Leverandører
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* People groups */}
          {groups.length === 0 ? (
            <Card sx={{ p: 4, textAlign: 'center', bgcolor: 'rgba(0,0,0,0.02)' }}>
              <People sx={{ fontSize: 48, color: '#bbb', mb: 1 }} />
              <Typography variant="h6" color="text.secondary">
                Ingen personer lagt til ennå
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {selectedCoupleName ? `Legg til viktige personer for ${selectedCoupleName}` : 'Legg til viktige personer for bryllupet'}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<PersonAdd />}
                onClick={openAddDialog}
                sx={{ borderColor: '#E91E63', color: '#E91E63' }}
              >
                Legg til første person
              </Button>
            </Card>
          ) : (
            groups.map(group => (
              <Card key={group.title} sx={{ mb: 2, border: `1px solid ${group.color}22` }}>
                <Box sx={{
                  px: 2, py: 1,
                  bgcolor: `${group.color}11`,
                  borderBottom: `1px solid ${group.color}22`,
                  display: 'flex', alignItems: 'center', gap: 1
                }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: group.color }}>
                    {group.title}
                  </Typography>
                  <Chip label={group.items.length} size="small" sx={{ bgcolor: group.color, color: '#fff', height: 20, fontSize: '0.7rem' }} />
                </Box>
                <List dense disablePadding>
                  {group.items.map((person, idx) => (
                    <React.Fragment key={person.id}>
                      {idx > 0 && <Divider />}
                      <ListItem
                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' } }}
                        onClick={() => setExpandedId(expandedId === person.id ? null : person.id)}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: getRoleColor(person.role), width: 36, height: 36 }}>
                            {getRoleIcon(person.role)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>{person.name}</Typography>
                              <Chip
                                label={getRoleLabel(person.role)}
                                size="small"
                                sx={{
                                  bgcolor: `${getRoleColor(person.role)}22`,
                                  color: getRoleColor(person.role),
                                  fontWeight: 600,
                                  fontSize: '0.65rem',
                                  height: 20,
                                }}
                              />
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                              {person.phone && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Phone sx={{ fontSize: 14, color: 'text.secondary' }} />
                                  <Typography variant="caption">{person.phone}</Typography>
                                </Box>
                              )}
                              {person.email && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Email sx={{ fontSize: 14, color: 'text.secondary' }} />
                                  <Typography variant="caption">{person.email}</Typography>
                                </Box>
                              )}
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Tooltip title="Rediger">
                              <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEditDialog(person); }}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Slett">
                              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(person.id); }} sx={{ color: 'error.main' }}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {expandedId === person.id ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                          </Box>
                        </ListItemSecondaryAction>
                      </ListItem>
                      <Collapse in={expandedId === person.id}>
                        <Box sx={{ px: 4, pb: 2, pt: 0.5, bgcolor: 'rgba(0,0,0,0.01)' }}>
                          {person.notes && (
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                              <Notes sx={{ fontSize: 16, color: 'text.secondary', mt: 0.3 }} />
                              <Typography variant="body2" color="text.secondary">{person.notes}</Typography>
                            </Box>
                          )}
                          {person.email && (
                            <Box sx={{ mb: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                E-post: <a href={`mailto:${person.email}`} style={{ color: '#E91E63' }}>{person.email}</a>
                              </Typography>
                            </Box>
                          )}
                          {person.phone && (
                            <Box sx={{ mb: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                Telefon: <a href={`tel:${person.phone}`} style={{ color: '#E91E63' }}>{person.phone}</a>
                              </Typography>
                            </Box>
                          )}
                          <Typography variant="caption" color="text.disabled">
                            Lagt til: {person.created_at ? new Date(person.created_at).toLocaleDateString('nb-NO') : '—'}
                          </Typography>
                        </Box>
                      </Collapse>
                    </React.Fragment>
                  ))}
                </List>
              </Card>
            ))
          )}
        </>
      ) : null}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <img src="/evendi-logo.png" alt="Evendi" style={{ width: 24, height: 24 }} />
          {editPerson ? 'Rediger person' : 'Legg til person'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Navn"
            fullWidth
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
            required
          />

          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Rolle</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            {[...ROLE_OPTIONS, ...VENDOR_ROLE_OPTIONS].map(r => (
              <Chip
                key={r.value}
                icon={r.icon as React.ReactElement}
                label={r.label}
                size="small"
                onClick={() => setFormRole(r.value)}
                sx={{
                  bgcolor: formRole === r.value ? `${getRoleColor(r.value)}22` : 'transparent',
                  border: `1px solid ${formRole === r.value ? getRoleColor(r.value) : '#ddd'}`,
                  color: formRole === r.value ? getRoleColor(r.value) : 'text.secondary',
                  fontWeight: formRole === r.value ? 700 : 400,
                  cursor: 'pointer',
                }}
              />
            ))}
          </Box>

          <TextField
            label="Telefon"
            fullWidth
            value={formPhone}
            onChange={(e) => setFormPhone(e.target.value)}
            sx={{ mb: 2 }}
            type="tel"
          />
          <TextField
            label="E-post"
            fullWidth
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            sx={{ mb: 2 }}
            type="email"
          />
          <TextField
            label="Notater"
            fullWidth
            multiline
            rows={2}
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            placeholder="Spesielle behov, allergier, etc."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!formName.trim() || !formRole}
            sx={{ bgcolor: '#E91E63', '&:hover': { bgcolor: '#C2185B' } }}
          >
            {editPerson ? 'Lagre endringer' : 'Legg til'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
