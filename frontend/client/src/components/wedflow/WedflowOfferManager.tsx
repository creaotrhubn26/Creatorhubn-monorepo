import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, TextField, IconButton, Chip, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem,
  ListItemText, ListItemAvatar, Avatar, Alert, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Select, MenuItem, FormControl, InputLabel, Tooltip
} from '@mui/material';
import {
  Add, Delete, Send, Person, Receipt, CheckCircle,
  Schedule, ExpandMore, ExpandLess, Visibility
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface OfferItem {
  title: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  productId?: string;
}

interface Offer {
  id: string;
  couple_id: string;
  couple_name: string;
  couple_email: string;
  title: string;
  message: string | null;
  status: string;
  total_amount: number;
  currency: string;
  valid_until: string | null;
  created_at: string;
  items: Array<{
    id: string;
    title: string;
    description: string | null;
    quantity: number;
    unit_price: number;
    line_total: number;
  }> | null;
}

interface Contract {
  id: string;
  couple_id: string;
  couple_name: string;
  couple_email: string;
  wedding_date: string | null;
  offer_id: string | null;
  offer_title: string | null;
  offer_total_amount: number | null;
  offer_currency: string | null;
  status: string;
  vendor_role: string | null;
  vendor_category_name: string | null;
  can_view_schedule: boolean;
  can_view_speeches: boolean;
  completed_at: string | null;
  created_at: string;
}

interface Contact {
  id: string;
  display_name: string;
  email: string;
  wedding_date: string | null;
  conversation_id: string;
}

interface EvendiOfferManagerProps {
  evendiCoupleId?: string;
}

export default function WedflowOfferManager({ evendiCoupleId }: EvendiOfferManagerProps) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState<'offers' | 'contracts'>('offers');
  
  // Create offer dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [offerTitle, setOfferTitle] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [selectedCoupleId, setSelectedCoupleId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [offerItems, setOfferItems] = useState<OfferItem[]>([{ title: '', quantity: 1, unitPrice: 0 }]);
  const [submitting, setSubmitting] = useState(false);
  
  // Detail view
  const [expandedOffer, setExpandedOffer] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-select couple from evendiCoupleId when available
  useEffect(() => {
    if (evendiCoupleId && contacts.length > 0) {
      const match = contacts.find(c => c.id === evendiCoupleId);
      if (match && !selectedCoupleId) {
        setSelectedCoupleId(match.id);
      }
    }
  }, [evendiCoupleId, contacts]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [offersRes, contractsRes, contactsRes] = await Promise.all([
        apiRequest('/api/evendi/offers').catch(() => ({ offers: [] })),
        apiRequest('/api/evendi/contracts').catch(() => ({ contracts: [] })),
        apiRequest('/api/evendi/contacts').catch(() => ({ contacts: [] }))
      ]);
      setOffers(offersRes.offers || []);
      setContracts(contractsRes.contracts || []);
      setContacts(contactsRes.contacts || []);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Kunne ikke laste data');
    } finally {
      setLoading(false);
    }
  };

  const formatNOK = (amountInOre: number) => {
    return (amountInOre / 100).toLocaleString('nb-NO', { style: 'currency', currency: 'NOK', minimumFractionDigits: 0 });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'accepted': return 'success';
      case 'declined': return 'error';
      case 'expired': return 'default';
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Venter', accepted: 'Akseptert', declined: 'Avslått', expired: 'Utløpt',
      active: 'Aktiv', completed: 'Fullført', cancelled: 'Kansellert'
    };
    return labels[status] || status;
  };

  const handleAddItem = () => {
    setOfferItems([...offerItems, { title: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setOfferItems(offerItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof OfferItem, value: any) => {
    const updated = [...offerItems];
    updated[index] = { ...updated[index], [field]: value };
    setOfferItems(updated);
  };

  const calculateTotal = () => {
    return offerItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const handleCreateOffer = async () => {
    if (!selectedCoupleId || !offerTitle || !offerItems.some(i => i.title && i.unitPrice > 0)) {
      return;
    }
    setSubmitting(true);
    try {
      const contact = contacts.find(c => c.id === selectedCoupleId);
      await apiRequest('/api/evendi/offers', {
        method: 'POST',
        body: JSON.stringify({
          coupleId: selectedCoupleId,
          conversationId: contact?.conversation_id || null,
          title: offerTitle,
          message: offerMessage || null,
          validUntil: validUntil || null,
          items: offerItems.filter(i => i.title && i.unitPrice > 0)
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      setCreateDialogOpen(false);
      resetForm();
      fetchData();
    } catch (e: any) {
      setError(e.message || 'Kunne ikke opprette tilbud');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    try {
      await apiRequest(`/api/evendi/offers/${offerId}`, { method: 'DELETE' });
      fetchData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const resetForm = () => {
    setOfferTitle('');
    setOfferMessage('');
    setSelectedCoupleId('');
    setValidUntil('');
    setOfferItems([{ title: '', quantity: 1, unitPrice: 0 }]);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Laster Evendi-data...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Header with logo and toggle */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3, border: '2px solid #E91E63', background: 'linear-gradient(135deg, #FCE4EC 0%, #fff 100%)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <img src="/wedflow-logo.png" alt="Evendi" style={{ height: 36 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#E91E63' }}>
              Evendi Tilbud & Kontrakter
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ bgcolor: '#E91E63', '&:hover': { bgcolor: '#C2185B' } }}
          >
            Nytt tilbud
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Chip
            label={`Tilbud (${offers.length})`}
            icon={<Receipt />}
            onClick={() => setActiveView('offers')}
            variant={activeView === 'offers' ? 'filled' : 'outlined'}
            color={activeView === 'offers' ? 'secondary' : 'default'}
            sx={{ fontWeight: 600, fontSize: '0.95rem', py: 2.5, px: 1 }}
          />
          <Chip
            label={`Kontrakter (${contracts.length})`}
            icon={<CheckCircle />}
            onClick={() => setActiveView('contracts')}
            variant={activeView === 'contracts' ? 'filled' : 'outlined'}
            color={activeView === 'contracts' ? 'secondary' : 'default'}
            sx={{ fontWeight: 600, fontSize: '0.95rem', py: 2.5, px: 1 }}
          />
        </Box>
      </Paper>

      {/* Stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
        <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="h4" sx={{ color: '#FF9800', fontWeight: 700 }}>
            {offers.filter(o => o.status === 'pending').length}
          </Typography>
          <Typography variant="body2" color="text.secondary">Ventende tilbud</Typography>
        </Paper>
        <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="h4" sx={{ color: '#4CAF50', fontWeight: 700 }}>
            {offers.filter(o => o.status === 'accepted').length}
          </Typography>
          <Typography variant="body2" color="text.secondary">Aksepterte</Typography>
        </Paper>
        <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="h4" sx={{ color: '#2196F3', fontWeight: 700 }}>
            {contracts.filter(c => c.status === 'active').length}
          </Typography>
          <Typography variant="body2" color="text.secondary">Aktive kontrakter</Typography>
        </Paper>
        <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
          <Typography variant="h4" sx={{ color: '#9C27B0', fontWeight: 700 }}>
            {formatNOK(offers.filter(o => o.status === 'accepted').reduce((s, o) => s + o.total_amount, 0))}
          </Typography>
          <Typography variant="body2" color="text.secondary">Total akseptert</Typography>
        </Paper>
      </Box>

      {/* Offers View */}
      {activeView === 'offers' && (
        <Box>
          {offers.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
              <Receipt sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">Ingen tilbud ennå</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Opprett ditt første tilbud til et par via Evendi
              </Typography>
              <Button variant="contained" startIcon={<Add />} onClick={() => setCreateDialogOpen(true)}
                sx={{ bgcolor: '#E91E63', '&:hover': { bgcolor: '#C2185B' } }}>
                Opprett tilbud
              </Button>
            </Paper>
          ) : (
            <List sx={{ p: 0 }}>
              {offers.map((offer) => (
                <Paper key={offer.id} sx={{ mb: 2, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                  <ListItem
                    component="div"
                    onClick={() => setExpandedOffer(expandedOffer === offer.id ? null : offer.id)}
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: '#E91E63' }}>
                        <Person />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{offer.title}</Typography>
                          <Chip label={getStatusLabel(offer.status)} size="small" color={getStatusColor(offer.status) as any} />
                        </Box>
                      }
                      secondary={
                        <Typography variant="body2" color="text.secondary">
                          {offer.couple_name || offer.couple_email} • {formatNOK(offer.total_amount)} • {new Date(offer.created_at).toLocaleDateString('nb-NO')}
                        </Typography>
                      }
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#E91E63' }}>
                        {formatNOK(offer.total_amount)}
                      </Typography>
                      {expandedOffer === offer.id ? <ExpandLess /> : <ExpandMore />}
                    </Box>
                  </ListItem>

                  {expandedOffer === offer.id && (
                    <Box sx={{ px: 3, pb: 2 }}>
                      <Divider sx={{ mb: 2 }} />
                      {offer.message && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                          "{offer.message}"
                        </Typography>
                      )}
                      {offer.valid_until && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          Gyldig til: {new Date(offer.valid_until).toLocaleDateString('nb-NO')}
                        </Typography>
                      )}

                      {/* Line items table */}
                      {offer.items && offer.items.length > 0 && (
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Linje</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Ant.</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Enhetspris</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="right">Sum</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {offer.items.map((item, i) => (
                                <TableRow key={i}>
                                  <TableCell>
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{item.title}</Typography>
                                    {item.description && <Typography variant="caption" color="text.secondary">{item.description}</Typography>}
                                  </TableCell>
                                  <TableCell align="right">{item.quantity}</TableCell>
                                  <TableCell align="right">{formatNOK(item.unit_price)}</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 600 }}>{formatNOK(item.line_total)}</TableCell>
                                </TableRow>
                              ))}
                              <TableRow>
                                <TableCell colSpan={3} sx={{ fontWeight: 700 }}>Total</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, color: '#E91E63' }}>
                                  {formatNOK(offer.total_amount)}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}

                      <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end' }}>
                        {offer.status === 'pending' && (
                          <Tooltip title="Slett tilbud">
                            <IconButton color="error" onClick={(e) => { e.stopPropagation(); handleDeleteOffer(offer.id); }}>
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                  )}
                </Paper>
              ))}
            </List>
          )}
        </Box>
      )}

      {/* Contracts View */}
      {activeView === 'contracts' && (
        <Box>
          {contracts.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
              <CheckCircle sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">Ingen kontrakter</Typography>
              <Typography variant="body2" color="text.secondary">
                Kontrakter opprettes automatisk når et par aksepterer et tilbud
              </Typography>
            </Paper>
          ) : (
            <List sx={{ p: 0 }}>
              {contracts.map((contract) => (
                <Paper key={contract.id} sx={{ mb: 2, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                  <ListItem component="div">
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: contract.status === 'active' ? '#4CAF50' : '#2196F3' }}>
                        <CheckCircle />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {contract.couple_name || contract.couple_email}
                          </Typography>
                          <Chip label={getStatusLabel(contract.status)} size="small" color={getStatusColor(contract.status) as any} />
                          {contract.vendor_category_name && (
                            <Chip label={contract.vendor_category_name} size="small" variant="outlined" />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          {contract.offer_title && (
                            <Typography variant="body2" color="text.secondary">
                              Tilbud: {contract.offer_title} — {contract.offer_total_amount ? formatNOK(contract.offer_total_amount) : 'N/A'}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary">
                            {contract.wedding_date ? `Bryllup: ${new Date(contract.wedding_date).toLocaleDateString('nb-NO')}` : ''} 
                            {' • '}Opprettet: {new Date(contract.created_at).toLocaleDateString('nb-NO')}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                            {contract.can_view_schedule && <Chip label="Timeplan" size="small" variant="outlined" icon={<Schedule />} />}
                            {contract.can_view_speeches && <Chip label="Taler" size="small" variant="outlined" icon={<Visibility />} />}
                          </Box>
                        </Box>
                      }
                    />
                    {contract.offer_total_amount && (
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#4CAF50', minWidth: 120, textAlign: 'right' }}>
                        {formatNOK(contract.offer_total_amount)}
                      </Typography>
                    )}
                  </ListItem>
                </Paper>
              ))}
            </List>
          )}
        </Box>
      )}

      {/* Create Offer Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#E91E63', color: 'white' }}>
          <img src="/wedflow-logo.png" alt="" style={{ height: 28, filter: 'brightness(10)' }} />
          Opprett nytt tilbud
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Couple selector */}
            <FormControl fullWidth>
              <InputLabel>Velg par</InputLabel>
              <Select value={selectedCoupleId} onChange={(e) => setSelectedCoupleId(e.target.value)} label="Velg par">
                {contacts.map(c => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.display_name || c.email} {c.wedding_date ? `— ${new Date(c.wedding_date).toLocaleDateString('nb-NO')}` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField label="Tittel" value={offerTitle} onChange={e => setOfferTitle(e.target.value)} fullWidth required />
            <TextField label="Melding (valgfritt)" value={offerMessage} onChange={e => setOfferMessage(e.target.value)} fullWidth multiline rows={2} />
            <TextField label="Gyldig til" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} InputLabelProps={{ shrink: true }} />

            {/* Line items */}
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 1 }}>Linjer</Typography>
            {offerItems.map((item, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField size="small" label="Beskrivelse" value={item.title} onChange={e => handleItemChange(index, 'title', e.target.value)} sx={{ flex: 3 }} />
                <TextField size="small" label="Ant." type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)} sx={{ flex: 1 }} inputProps={{ min: 1 }} />
                <TextField size="small" label="Pris (kr)" type="number" value={item.unitPrice / 100 || ''} onChange={e => handleItemChange(index, 'unitPrice', Math.round(parseFloat(e.target.value || '0') * 100))} sx={{ flex: 1.5 }} />
                <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 80, textAlign: 'right' }}>
                  {formatNOK(item.quantity * item.unitPrice)}
                </Typography>
                <IconButton size="small" onClick={() => handleRemoveItem(index)} disabled={offerItems.length <= 1}>
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button startIcon={<Add />} onClick={handleAddItem} size="small" sx={{ alignSelf: 'flex-start' }}>
              Legg til linje
            </Button>

            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Total: {formatNOK(calculateTotal())}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => { setCreateDialogOpen(false); resetForm(); }}>Avbryt</Button>
          <Button
            variant="contained"
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <Send />}
            disabled={submitting || !selectedCoupleId || !offerTitle || !offerItems.some(i => i.title && i.unitPrice > 0)}
            onClick={handleCreateOffer}
            sx={{ bgcolor: '#E91E63', '&:hover': { bgcolor: '#C2185B' } }}
          >
            {submitting ? 'Sender...' : 'Send tilbud'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
