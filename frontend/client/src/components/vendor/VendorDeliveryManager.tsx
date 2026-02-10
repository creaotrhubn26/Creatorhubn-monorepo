import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  LinearProgress,
  Paper,
  alpha,
  useTheme,
  Tooltip,
  Badge,
  Stack,
  InputAdornment
} from '@mui/material';
import {
  LocalShipping,
  Add,
  Edit,
  Delete,
  ContentCopy,
  Visibility,
  CloudUpload,
  InsertDriveFile,
  VideoFile,
  Image,
  Link as LinkIcon,
  Download,
  CheckCircle,
  Schedule,
  DraftsOutlined,
  Send,
  Close,
  ExpandMore,
  ExpandLess,
  FileCopy
} from '@mui/icons-material';

interface VendorDeliveryManagerProps {
  vendorType: string;
  vendorName: string;
  userId: string;
  vendorId?: string;
}

interface Delivery {
  id: string;
  vendor_id: string;
  couple_name: string;
  couple_email: string;
  access_code: string;
  title: string;
  description: string;
  wedding_date: string;
  status: string;
  created_at: string;
  updated_at: string;
  items?: DeliveryItem[];
}

interface DeliveryItem {
  id: string;
  delivery_id: string;
  type: string;
  label: string;
  url: string;
  description: string;
  sort_order: number;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'; icon: React.ReactElement }> = {
  draft: { label: 'Under arbeid', color: 'default', icon: <DraftsOutlined /> },
  active: { label: 'Aktiv', color: 'success', icon: <CheckCircle /> },
  scheduled: { label: 'Planlagt', color: 'info', icon: <Schedule /> },
  archived: { label: 'Arkivert', color: 'warning', icon: <FileCopy /> },
};

const itemTypeIcons: Record<string, React.ReactElement> = {
  video: <VideoFile />,
  image: <Image />,
  file: <InsertDriveFile />,
  link: <LinkIcon />,
  download: <Download />,
};

export default function VendorDeliveryManager({ vendorType, vendorName, userId, vendorId }: VendorDeliveryManagerProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const resolvedVendorId = vendorId || userId;

  const [createOpen, setCreateOpen] = useState(false);
  const [editDelivery, setEditDelivery] = useState<Delivery | null>(null);
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null);
  const [addItemDeliveryId, setAddItemDeliveryId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    couple_name: '',
    couple_email: '',
    title: '',
    description: '',
    wedding_date: '',
  });
  const [itemForm, setItemForm] = useState({
    type: 'file',
    label: '',
    url: '',
    description: '',
  });

  // Fetch deliveries
  const { data: deliveriesData, isLoading } = useQuery({
    queryKey: ['/api/deliveries', resolvedVendorId],
    queryFn: () => apiRequest(`/api/deliveries/${resolvedVendorId}`),
    enabled: !!resolvedVendorId,
  });

  // Fetch single delivery with items when expanded
  const { data: expandedData } = useQuery({
    queryKey: ['/api/deliveries', resolvedVendorId, expandedDelivery],
    queryFn: () => apiRequest(`/api/deliveries/${resolvedVendorId}/${expandedDelivery}`),
    enabled: !!expandedDelivery,
  });

  // Create delivery
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/deliveries/${resolvedVendorId}`, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deliveries', resolvedVendorId] });
      setCreateOpen(false);
      resetForm();
    },
  });

  // Update delivery
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest(`/api/deliveries/${resolvedVendorId}/${id}`, { method: 'PATCH', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deliveries', resolvedVendorId] });
      setEditDelivery(null);
      resetForm();
    },
  });

  // Delete delivery
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/deliveries/${resolvedVendorId}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deliveries', resolvedVendorId] });
    },
  });

  // Add item
  const addItemMutation = useMutation({
    mutationFn: ({ deliveryId, data }: { deliveryId: string; data: any }) => apiRequest(`/api/deliveries/${resolvedVendorId}/${deliveryId}/items`, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/deliveries', resolvedVendorId, variables.deliveryId] });
      setAddItemDeliveryId(null);
      setItemForm({ type: 'file', label: '', url: '', description: '' });
    },
  });

  // Delete item
  const deleteItemMutation = useMutation({
    mutationFn: ({ deliveryId, itemId }: { deliveryId: string; itemId: string }) => apiRequest(`/api/deliveries/${resolvedVendorId}/${deliveryId}/items/${itemId}`, { method: 'DELETE' }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/deliveries', resolvedVendorId, variables.deliveryId] });
    },
  });

  const resetForm = () => {
    setFormData({ couple_name: '', couple_email: '', title: '', description: '', wedding_date: '' });
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const deliveries: Delivery[] = deliveriesData?.deliveries || [];
  const activeCount = deliveries.filter(d => d.status === 'active').length;
  const draftCount = deliveries.filter(d => d.status === 'draft').length;

  if (isLoading) {
    return <LinearProgress />;
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Badge badgeContent={activeCount} color="success">
              <LocalShipping color="primary" />
            </Badge>
            {' '}Leveranser — {vendorName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {vendorType === 'photographer' ? 'Bildepakker' : vendorType === 'videographer' ? 'Videopakker' : 'Leveranser'} — {deliveries.length} totalt, {activeCount} aktive, {draftCount} under arbeid
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateOpen(true)}
          sx={{ borderRadius: 2 }}
        >
          Ny leveranse
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Totalt', value: deliveries.length, color: theme.palette.primary.main },
          { label: 'Aktive', value: activeCount, color: theme.palette.success.main },
          { label: 'Under arbeid', value: draftCount, color: theme.palette.grey[500] },
          { label: 'Arkiverte', value: deliveries.filter(d => d.status === 'archived').length, color: theme.palette.warning.main },
        ].map((stat) => (
          <Grid item xs={6} sm={3} key={stat.label}>
            <Paper sx={{ p: 2, textAlign: 'center', border: `1px solid ${alpha(stat.color, 0.3)}`, borderRadius: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: stat.color }}>{stat.value}</Typography>
              <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Deliveries List */}
      {deliveries.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center', border: `1px dashed ${theme.palette.divider}` }}>
          <LocalShipping sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">Ingen leveranser ennå</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Opprett din første leveranse for å dele med klienter.
          </Typography>
          <Button variant="outlined" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
            Opprett leveranse
          </Button>
        </Card>
      ) : (
        <Stack spacing={2}>
          {deliveries.map((delivery) => {
            const isExpanded = expandedDelivery === delivery.id;
            const items = isExpanded ? (expandedData?.items || []) : [];
            const statusInfo = statusConfig[delivery.status] || statusConfig.draft;

            return (
              <Card key={delivery.id} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                <CardContent sx={{ pb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>{delivery.title}</Typography>
                        <Chip
                          size="small"
                          label={statusInfo.label}
                          color={statusInfo.color}
                          icon={statusInfo.icon}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {delivery.couple_name} {delivery.couple_email ? `(${delivery.couple_email})` : ''}
                      </Typography>
                      {delivery.wedding_date && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          Bryllupsdato: {new Date(delivery.wedding_date).toLocaleDateString('nb-NO')}
                        </Typography>
                      )}
                      {delivery.description && (
                        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                          {delivery.description}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Tooltip title={copiedCode === delivery.access_code ? 'Kopiert!' : 'Kopier tilgangskode'}>
                        <Chip
                          label={delivery.access_code}
                          size="small"
                          variant="outlined"
                          onClick={() => handleCopyCode(delivery.access_code)}
                          icon={copiedCode === delivery.access_code ? <CheckCircle /> : <ContentCopy />}
                          color={copiedCode === delivery.access_code ? 'success' : 'default'}
                          sx={{ fontFamily: 'monospace', fontWeight: 600 }}
                        />
                      </Tooltip>
                    </Box>
                  </Box>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2, justifyContent: 'space-between' }}>
                  <Box>
                    <Button
                      size="small"
                      startIcon={isExpanded ? <ExpandLess /> : <ExpandMore />}
                      onClick={() => setExpandedDelivery(isExpanded ? null : delivery.id)}
                    >
                      {isExpanded ? 'Skjul' : 'Vis'} elementer
                    </Button>
                    <Button size="small" startIcon={<Add />} onClick={() => setAddItemDeliveryId(delivery.id)}>
                      Legg til
                    </Button>
                  </Box>
                  <Box>
                    {delivery.status === 'draft' && (
                      <Button
                        size="small"
                        color="success"
                        startIcon={<Send />}
                        onClick={() => updateMutation.mutate({ id: delivery.id, data: { status: 'active' } })}
                      >
                        Publiser
                      </Button>
                    )}
                    <IconButton size="small" onClick={() => { setEditDelivery(delivery); setFormData({ couple_name: delivery.couple_name, couple_email: delivery.couple_email, title: delivery.title, description: delivery.description, wedding_date: delivery.wedding_date }); }}>
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (window.confirm('Er du sikker på at du vil slette denne leveransen?')) deleteMutation.mutate(delivery.id); }}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                </CardActions>

                {/* Expanded Items */}
                {isExpanded && (
                  <Box sx={{ px: 2, pb: 2 }}>
                    <Divider sx={{ mb: 2 }} />
                    {items.length === 0 ? (
                      <Alert severity="info" sx={{ borderRadius: 2 }}>
                        Ingen elementer lagt til ennå. Legg til filer, lenker eller innhold.
                      </Alert>
                    ) : (
                      <List dense>
                        {items.map((item: DeliveryItem) => (
                          <ListItem key={item.id} sx={{ borderRadius: 1, mb: 0.5, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              {itemTypeIcons[item.type] || <InsertDriveFile />}
                            </ListItemIcon>
                            <ListItemText
                              primary={item.label}
                              secondary={item.description || item.url}
                            />
                            <ListItemSecondaryAction>
                              {item.url && (
                                <IconButton size="small" component="a" href={item.url} target="_blank" rel="noopener">
                                  <Visibility fontSize="small" />
                                </IconButton>
                              )}
                              <IconButton size="small" color="error" onClick={() => deleteItemMutation.mutate({ deliveryId: delivery.id, itemId: item.id })}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </ListItemSecondaryAction>
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Box>
                )}
              </Card>
            );
          })}
        </Stack>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={createOpen || !!editDelivery} onClose={() => { setCreateOpen(false); setEditDelivery(null); resetForm(); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {editDelivery ? 'Rediger leveranse' : 'Ny leveranse'}
          <IconButton size="small" onClick={() => { setCreateOpen(false); setEditDelivery(null); resetForm(); }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Tittel"
              fullWidth
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="f.eks. Bryllupsfilm September 2025"
            />
            <TextField
              label="Par-navn"
              fullWidth
              value={formData.couple_name}
              onChange={(e) => setFormData(prev => ({ ...prev, couple_name: e.target.value }))}
              placeholder="f.eks. Kristine & Thomas"
            />
            <TextField
              label="E-post"
              fullWidth
              type="email"
              value={formData.couple_email}
              onChange={(e) => setFormData(prev => ({ ...prev, couple_email: e.target.value }))}
              placeholder="par@eksempel.no"
            />
            <TextField
              label="Bryllupsdato"
              fullWidth
              type="date"
              value={formData.wedding_date}
              onChange={(e) => setFormData(prev => ({ ...prev, wedding_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Beskrivelse"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Beskrivelse av leveransen..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCreateOpen(false); setEditDelivery(null); resetForm(); }}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (editDelivery) {
                updateMutation.mutate({ id: editDelivery.id, data: formData });
              } else {
                createMutation.mutate(formData);
              }
            }}
            disabled={!formData.title}
          >
            {editDelivery ? 'Lagre' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={!!addItemDeliveryId} onClose={() => { setAddItemDeliveryId(null); setItemForm({ type: 'file', label: '', url: '', description: '' }); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Legg til element
          <IconButton size="small" onClick={() => { setAddItemDeliveryId(null); setItemForm({ type: 'file', label: '', url: '', description: '' }); }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {['file', 'video', 'image', 'link', 'download'].map((type) => (
                <Chip
                  key={type}
                  label={type === 'file' ? 'Fil' : type === 'video' ? 'Video' : type === 'image' ? 'Bilde' : type === 'link' ? 'Lenke' : 'Nedlasting'}
                  icon={itemTypeIcons[type]}
                  variant={itemForm.type === type ? 'filled' : 'outlined'}
                  color={itemForm.type === type ? 'primary' : 'default'}
                  onClick={() => setItemForm(prev => ({ ...prev, type }))}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
            <TextField
              label="Navn"
              fullWidth
              value={itemForm.label}
              onChange={(e) => setItemForm(prev => ({ ...prev, label: e.target.value }))}
              placeholder="f.eks. Highlights Film (4K)"
            />
            <TextField
              label="URL / Lenke"
              fullWidth
              value={itemForm.url}
              onChange={(e) => setItemForm(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://..."
              InputProps={{
                startAdornment: <InputAdornment position="start"><LinkIcon fontSize="small" /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Last opp fil">
                      <IconButton size="small" component="label">
                        <CloudUpload fontSize="small" />
                        <input type="file" hidden onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setItemForm(prev => ({
                              ...prev,
                              label: prev.label || file.name,
                              url: URL.createObjectURL(file)
                            }));
                          }
                        }} />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Beskrivelse"
              fullWidth
              value={itemForm.description}
              onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Kort beskrivelse..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddItemDeliveryId(null); setItemForm({ type: 'file', label: '', url: '', description: '' }); }}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (addItemDeliveryId) {
                addItemMutation.mutate({ deliveryId: addItemDeliveryId, data: itemForm });
              }
            }}
            disabled={!itemForm.label}
          >
            Legg til
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
