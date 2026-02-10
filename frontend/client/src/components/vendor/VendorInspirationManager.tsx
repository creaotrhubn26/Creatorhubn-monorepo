import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
  Stack,
  Switch,
  FormControlLabel,
  InputAdornment,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Tab,
  Tabs
} from '@mui/material';
import {
  AutoAwesome,
  Add,
  Edit,
  Delete,
  Visibility,
  Image,
  VideoFile,
  CheckCircle,
  Schedule,
  DraftsOutlined,
  Close,
  Category,
  AttachMoney,
  Email,
  Phone,
  Language,
  Photo,
  PlayCircle,
  Send,
  Block,
  Inbox,
  Reply
} from '@mui/icons-material';

interface VendorInspirationManagerProps {
  vendorType: string;
  vendorName: string;
  userId: string;
  vendorId?: string;
}

interface InspirationCategory {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
}

interface Inspiration {
  id: string;
  vendor_id: string;
  category_id: string;
  category_name?: string;
  category_icon?: string;
  title: string;
  description: string;
  cover_image_url: string;
  price_summary: string;
  price_min: number;
  price_max: number;
  currency: string;
  website_url: string;
  inquiry_email: string;
  inquiry_phone: string;
  cta_label: string;
  cta_url: string;
  allow_inquiry_form: boolean;
  status: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  media?: InspirationMedia[];
  inquiries?: InspirationInquiry[];
}

interface InspirationMedia {
  id: string;
  inspiration_id: string;
  type: string;
  url: string;
  caption: string;
  sort_order: number;
  created_at: string;
}

interface InspirationInquiry {
  id: string;
  inspiration_id: string;
  vendor_id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  wedding_date: string;
  status: string;
  created_at: string;
  inspiration_title?: string;
}

const statusConfig: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'; icon: React.ReactElement }> = {
  draft: { label: 'Utkast', color: 'default', icon: <DraftsOutlined /> },
  pending: { label: 'Venter godkjenning', color: 'info', icon: <Schedule /> },
  approved: { label: 'Godkjent', color: 'success', icon: <CheckCircle /> },
  rejected: { label: 'Avvist', color: 'error', icon: <Block /> },
};

const categoryIcons: Record<string, string> = {
  camera: '📸',
  flower: '💐',
  decoration: '🎀',
  cake: '🎂',
  venue: '🏰',
  table: '🍽️',
  bouquet: '💐',
  hair: '💇‍♀️',
  photo: '📷',
  invitation: '💌',
};

export default function VendorInspirationManager({ vendorType, vendorName, userId, vendorId }: VendorInspirationManagerProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const resolvedVendorId = vendorId || userId;

  const [activeSubTab, setActiveSubTab] = useState(0); // 0=gallery, 1=inquiries
  const [createOpen, setCreateOpen] = useState(false);
  const [editInspiration, setEditInspiration] = useState<Inspiration | null>(null);
  const [detailInspiration, setDetailInspiration] = useState<string | null>(null);
  const [addMediaId, setAddMediaId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    category_id: '',
    title: '',
    description: '',
    cover_image_url: '',
    price_summary: '',
    price_min: 0,
    price_max: 0,
    currency: 'NOK',
    website_url: '',
    inquiry_email: '',
    inquiry_phone: '',
    cta_label: 'Kontakt meg',
    cta_url: '',
    allow_inquiry_form: true,
  });
  const [mediaForm, setMediaForm] = useState({
    type: 'image',
    url: '',
    caption: '',
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['/api/inspirations/categories'],
    queryFn: () => apiRequest('/api/inspirations/categories'),
  });

  // Fetch inspirations
  const { data: inspirationsData, isLoading } = useQuery({
    queryKey: ['/api/inspirations', resolvedVendorId],
    queryFn: () => apiRequest(`/api/inspirations/${resolvedVendorId}`),
    enabled: !!resolvedVendorId,
  });

  // Fetch single inspiration with media
  const { data: detailData } = useQuery({
    queryKey: ['/api/inspirations', resolvedVendorId, detailInspiration],
    queryFn: () => apiRequest(`/api/inspirations/${resolvedVendorId}/${detailInspiration}`),
    enabled: !!detailInspiration,
  });

  // Fetch inquiries
  const { data: inquiriesData } = useQuery({
    queryKey: ['/api/inspirations', resolvedVendorId, 'inquiries'],
    queryFn: () => apiRequest(`/api/inspirations/${resolvedVendorId}/inquiries/all`),
    enabled: !!resolvedVendorId,
  });

  // Create inspiration
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/inspirations/${resolvedVendorId}`, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inspirations', resolvedVendorId] });
      setCreateOpen(false);
      resetForm();
    },
  });

  // Update inspiration
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest(`/api/inspirations/${resolvedVendorId}/${id}`, { method: 'PATCH', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inspirations', resolvedVendorId] });
      setEditInspiration(null);
      resetForm();
    },
  });

  // Delete inspiration
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/inspirations/${resolvedVendorId}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inspirations', resolvedVendorId] });
    },
  });

  // Add media
  const addMediaMutation = useMutation({
    mutationFn: ({ inspirationId, data }: { inspirationId: string; data: any }) => apiRequest(`/api/inspirations/${resolvedVendorId}/${inspirationId}/media`, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/inspirations', resolvedVendorId, variables.inspirationId] });
      setAddMediaId(null);
      setMediaForm({ type: 'image', url: '', caption: '' });
    },
  });

  // Delete media
  const deleteMediaMutation = useMutation({
    mutationFn: ({ inspirationId, mediaId }: { inspirationId: string; mediaId: string }) => apiRequest(`/api/inspirations/${resolvedVendorId}/${inspirationId}/media/${mediaId}`, { method: 'DELETE' }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/inspirations', resolvedVendorId, variables.inspirationId] });
    },
  });

  const resetForm = () => {
    setFormData({
      category_id: '', title: '', description: '', cover_image_url: '', price_summary: '',
      price_min: 0, price_max: 0, currency: 'NOK', website_url: '', inquiry_email: '',
      inquiry_phone: '', cta_label: 'Kontakt meg', cta_url: '', allow_inquiry_form: true,
    });
  };

  const categories: InspirationCategory[] = categoriesData?.categories || [];
  const inspirations: Inspiration[] = inspirationsData?.inspirations || [];
  const inquiries: InspirationInquiry[] = inquiriesData?.inquiries || [];
  const approvedCount = inspirations.filter(i => i.status === 'approved').length;
  const draftCount = inspirations.filter(i => i.status === 'draft').length;

  if (isLoading) {
    return <LinearProgress />;
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesome color="primary" /> Inspirasjon — {vendorName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {vendorType === 'photographer' ? 'Vis frem bildene dine' : vendorType === 'videographer' ? 'Vis frem filmene dine' : 'Vis frem arbeidet ditt'} og inspirer bryllupspar — {inspirations.length} oppslag, {approvedCount} godkjente
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateOpen(true)}
          sx={{ borderRadius: 2 }}
        >
          Nytt oppslag
        </Button>
      </Box>

      {/* Sub-tabs */}
      <Tabs value={activeSubTab} onChange={(_, v) => setActiveSubTab(v)} sx={{ mb: 3 }}>
        <Tab label={`Galleri (${inspirations.length})`} icon={<Photo />} iconPosition="start" />
        <Tab label={`Forespørsler (${inquiries.length})`} icon={<Inbox />} iconPosition="start" />
      </Tabs>

      {activeSubTab === 0 && (
        <>
          {/* Stats */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Totalt', value: inspirations.length, color: theme.palette.primary.main },
              { label: 'Godkjente', value: approvedCount, color: theme.palette.success.main },
              { label: 'Utkast', value: draftCount, color: theme.palette.grey[500] },
              { label: 'Forespørsler', value: inquiries.length, color: theme.palette.info.main },
            ].map((stat) => (
              <Grid item xs={6} sm={3} key={stat.label}>
                <Paper sx={{ p: 2, textAlign: 'center', border: `1px solid ${alpha(stat.color, 0.3)}`, borderRadius: 2 }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: stat.color }}>{stat.value}</Typography>
                  <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          {/* Inspirations Grid */}
          {inspirations.length === 0 ? (
            <Card sx={{ p: 4, textAlign: 'center', border: `1px dashed ${theme.palette.divider}` }}>
              <AutoAwesome sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">Ingen inspirasjonsoppslag ennå</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Del ditt beste arbeid og inspirer bryllupspar.
              </Typography>
              <Button variant="outlined" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
                Opprett oppslag
              </Button>
            </Card>
          ) : (
            <Grid container spacing={2}>
              {inspirations.map((inspiration) => {
                const statusInfo = statusConfig[inspiration.status] || statusConfig.draft;
                return (
                  <Grid item xs={12} sm={6} md={4} key={inspiration.id}>
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 2, overflow: 'hidden', border: `1px solid ${theme.palette.divider}` }}>
                      {inspiration.cover_image_url && (
                        <CardMedia
                          component="img"
                          height={180}
                          image={inspiration.cover_image_url}
                          alt={inspiration.title}
                          sx={{ objectFit: 'cover' }}
                        />
                      )}
                      <CardContent sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {inspiration.title}
                          </Typography>
                          <Chip size="small" label={statusInfo.label} color={statusInfo.color} />
                        </Box>
                        {inspiration.category_name && (
                          <Chip
                            size="small"
                            variant="outlined"
                            icon={<Category fontSize="small" />}
                            label={`${categoryIcons[inspiration.category_icon || ''] || '📌'} ${inspiration.category_name}`}
                            sx={{ mb: 1 }}
                          />
                        )}
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {inspiration.description}
                        </Typography>
                        {(inspiration.price_min > 0 || inspiration.price_max > 0) && (
                          <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.success.main }}>
                            {inspiration.price_min?.toLocaleString('nb-NO')} – {inspiration.price_max?.toLocaleString('nb-NO')} {inspiration.currency || 'NOK'}
                          </Typography>
                        )}
                      </CardContent>
                      <CardActions sx={{ px: 2, pb: 2, justifyContent: 'space-between' }}>
                        <Tooltip title="Vis detaljer">
                          <Button size="small" startIcon={<Visibility />} onClick={() => setDetailInspiration(inspiration.id)}>
                            Detaljer
                          </Button>
                        </Tooltip>
                        <Box>
                          {inspiration.status === 'draft' && (
                            <Tooltip title="Publiser oppslaget">
                              <Button size="small" color="success" startIcon={<Send />} onClick={() => updateMutation.mutate({ id: inspiration.id, data: { status: 'approved' } })}>
                                Publiser
                              </Button>
                            </Tooltip>
                          )}
                          <Tooltip title="Rediger">
                          <IconButton size="small" onClick={() => {
                            setEditInspiration(inspiration);
                            setFormData({
                              category_id: inspiration.category_id || '',
                              title: inspiration.title,
                              description: inspiration.description,
                              cover_image_url: inspiration.cover_image_url,
                              price_summary: inspiration.price_summary,
                              price_min: inspiration.price_min,
                              price_max: inspiration.price_max,
                              currency: inspiration.currency || 'NOK',
                              website_url: inspiration.website_url,
                              inquiry_email: inspiration.inquiry_email,
                              inquiry_phone: inspiration.inquiry_phone,
                              cta_label: inspiration.cta_label || 'Kontakt meg',
                              cta_url: inspiration.cta_url,
                              allow_inquiry_form: inspiration.allow_inquiry_form,
                            });
                          }}>
                            <Edit fontSize="small" />
                          </IconButton>
                          </Tooltip>
                          <Tooltip title="Slett oppslaget">
                            <IconButton size="small" color="error" onClick={() => { if (window.confirm('Slett dette oppslaget?')) deleteMutation.mutate(inspiration.id); }}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </CardActions>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </>
      )}

      {/* Inquiries Tab */}
      {activeSubTab === 1 && (
        <Box>
          {inquiries.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Ingen forespørsler mottatt ennå. Forespørsler fra bryllupspar vises her.
            </Alert>
          ) : (
            <Stack spacing={2}>
              {inquiries.map((inquiry) => (
                <Card key={inquiry.id} sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{inquiry.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {inquiry.email} {inquiry.phone ? `• ${inquiry.phone}` : ''}
                        </Typography>
                        {inquiry.wedding_date && (
                          <Typography variant="body2" color="text.secondary">
                            Bryllupsdato: {inquiry.wedding_date}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Chip size="small" label={inquiry.status === 'new' ? 'Ny' : inquiry.status} color={inquiry.status === 'new' ? 'info' : 'default'} />
                        <Typography variant="caption" display="block" color="text.secondary">
                          {new Date(inquiry.created_at).toLocaleDateString('nb-NO')}
                        </Typography>
                      </Box>
                    </Box>
                    {inquiry.inspiration_title && (
                      <Chip size="small" variant="outlined" label={`Re: ${inquiry.inspiration_title}`} sx={{ mt: 1 }} />
                    )}
                    <Typography variant="body2" sx={{ mt: 1, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.04), borderRadius: 1 }}>
                      {inquiry.message}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ px: 2, pb: 2 }}>
                    {inquiry.email && (
                      <Button size="small" startIcon={<Reply />} component="a" href={`mailto:${inquiry.email}`}>
                        Svar på e-post
                      </Button>
                    )}
                  </CardActions>
                </Card>
              ))}
            </Stack>
          )}
        </Box>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={createOpen || !!editInspiration} onClose={() => { setCreateOpen(false); setEditInspiration(null); resetForm(); }} maxWidth="md" fullWidth>
        <DialogTitle>
          {editInspiration ? 'Rediger inspirasjon' : 'Nytt inspirasjonsoppslag'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12}>
              <TextField label="Tittel" fullWidth value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="f.eks. Romantisk bryllupsfilm - Sara & Erik" />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Kategori</InputLabel>
                <Select value={formData.category_id} label="Kategori" onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}>
                  {categories.map(cat => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {categoryIcons[cat.icon] || '📌'} {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Beskrivelse" fullWidth multiline rows={3} value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Forsidebilde URL" fullWidth value={formData.cover_image_url} onChange={(e) => setFormData(prev => ({ ...prev, cover_image_url: e.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start"><Image fontSize="small" /></InputAdornment> }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Pris fra" fullWidth type="number" value={formData.price_min} onChange={(e) => setFormData(prev => ({ ...prev, price_min: Number(e.target.value) }))} InputProps={{ startAdornment: <InputAdornment position="start"><AttachMoney fontSize="small" /></InputAdornment> }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Pris til" fullWidth type="number" value={formData.price_max} onChange={(e) => setFormData(prev => ({ ...prev, price_max: Number(e.target.value) }))} InputProps={{ startAdornment: <InputAdornment position="start"><AttachMoney fontSize="small" /></InputAdornment> }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Prisoversikt" fullWidth value={formData.price_summary} onChange={(e) => setFormData(prev => ({ ...prev, price_summary: e.target.value }))} placeholder="f.eks. Fra 25.000 kr" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Nettside" fullWidth value={formData.website_url} onChange={(e) => setFormData(prev => ({ ...prev, website_url: e.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start"><Language fontSize="small" /></InputAdornment> }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="E-post for forespørsler" fullWidth value={formData.inquiry_email} onChange={(e) => setFormData(prev => ({ ...prev, inquiry_email: e.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start"><Email fontSize="small" /></InputAdornment> }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Telefon" fullWidth value={formData.inquiry_phone} onChange={(e) => setFormData(prev => ({ ...prev, inquiry_phone: e.target.value }))} InputProps={{ startAdornment: <InputAdornment position="start"><Phone fontSize="small" /></InputAdornment> }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="CTA-tekst" fullWidth value={formData.cta_label} onChange={(e) => setFormData(prev => ({ ...prev, cta_label: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={formData.allow_inquiry_form} onChange={(e) => setFormData(prev => ({ ...prev, allow_inquiry_form: e.target.checked }))} />}
                label="Tillat forespørselskjema fra besøkende"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCreateOpen(false); setEditInspiration(null); resetForm(); }}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (editInspiration) {
                updateMutation.mutate({ id: editInspiration.id, data: formData });
              } else {
                createMutation.mutate(formData);
              }
            }}
            disabled={!formData.title}
          >
            {editInspiration ? 'Lagre' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail View Dialog */}
      <Dialog open={!!detailInspiration} onClose={() => setDetailInspiration(null)} maxWidth="md" fullWidth>
        {detailData && (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>{detailData.title}</Typography>
              <Box>
                <Button size="small" startIcon={<Add />} onClick={() => setAddMediaId(detailInspiration!)}>
                  Legg til media
                </Button>
                <IconButton onClick={() => setDetailInspiration(null)}><Close /></IconButton>
              </Box>
            </DialogTitle>
            <DialogContent>
              {detailData.cover_image_url && (
                <Box component="img" src={detailData.cover_image_url} alt={detailData.title}
                  sx={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 2, mb: 2 }} />
              )}
              <Typography variant="body1" sx={{ mb: 2 }}>{detailData.description}</Typography>
              {(detailData.price_min > 0 || detailData.price_max > 0) && (
                <Chip label={`${detailData.price_min?.toLocaleString('nb-NO')} – ${detailData.price_max?.toLocaleString('nb-NO')} ${detailData.currency || 'NOK'}`} color="success" sx={{ mb: 2 }} />
              )}

              {/* Contact details list */}
              {(detailData.inquiry_email || detailData.inquiry_phone || detailData.website_url) && (
                <List dense sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04), borderRadius: 2, mb: 2 }}>
                  {detailData.inquiry_email && (
                    <ListItem>
                      <ListItemIcon><Email color="primary" /></ListItemIcon>
                      <ListItemText primary={detailData.inquiry_email} secondary="Forespørsels-epost" />
                      <ListItemSecondaryAction>
                        <Tooltip title="Send e-post">
                          <IconButton size="small" component="a" href={`mailto:${detailData.inquiry_email}`}>
                            <Send fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  )}
                  {detailData.inquiry_phone && (
                    <ListItem>
                      <ListItemIcon><Phone color="primary" /></ListItemIcon>
                      <ListItemText primary={detailData.inquiry_phone} secondary="Telefon" />
                      <ListItemSecondaryAction>
                        <Tooltip title="Ring">
                          <IconButton size="small" component="a" href={`tel:${detailData.inquiry_phone}`}>
                            <Phone fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  )}
                  {detailData.website_url && (
                    <ListItem>
                      <ListItemIcon><Language color="primary" /></ListItemIcon>
                      <ListItemText primary={detailData.website_url} secondary="Nettside" />
                      <ListItemSecondaryAction>
                        <Tooltip title="Åpne nettside">
                          <IconButton size="small" component="a" href={detailData.website_url} target="_blank">
                            <Language fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  )}
                </List>
              )}

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Media ({detailData.media?.length || 0})
              </Typography>
              {detailData.media && detailData.media.length > 0 ? (
                <ImageList cols={3} gap={8}>
                  {detailData.media.map((m: InspirationMedia) => (
                    <ImageListItem key={m.id}>
                      {m.type === 'video' ? (
                        <Box sx={{ width: '100%', height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.100', borderRadius: 1 }}>
                          <PlayCircle sx={{ fontSize: 48, color: 'primary.main' }} />
                        </Box>
                      ) : (
                        <img src={m.url} alt={m.caption} loading="lazy" style={{ borderRadius: 4, objectFit: 'cover', height: 150 }} />
                      )}
                      <ImageListItemBar
                        title={m.caption || m.type}
                        actionIcon={
                          <IconButton size="small" sx={{ color: 'white' }} onClick={() => deleteMediaMutation.mutate({ inspirationId: detailInspiration!, mediaId: m.id })}>
                            <Delete fontSize="small" />
                          </IconButton>
                        }
                      />
                    </ImageListItem>
                  ))}
                </ImageList>
              ) : (
                <Alert severity="info">Ingen media lagt til ennå.</Alert>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* Add Media Dialog */}
      <Dialog open={!!addMediaId} onClose={() => { setAddMediaId(null); setMediaForm({ type: 'image', url: '', caption: '' }); }} maxWidth="sm" fullWidth>
        <DialogTitle>Legg til media</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {['image', 'video'].map(type => (
                <Chip
                  key={type}
                  label={type === 'image' ? 'Bilde' : 'Video'}
                  icon={type === 'image' ? <Photo /> : <VideoFile />}
                  variant={mediaForm.type === type ? 'filled' : 'outlined'}
                  color={mediaForm.type === type ? 'primary' : 'default'}
                  onClick={() => setMediaForm(prev => ({ ...prev, type }))}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
            <TextField label="URL" fullWidth value={mediaForm.url} onChange={(e) => setMediaForm(prev => ({ ...prev, url: e.target.value }))} placeholder="https://..." />
            <TextField label="Bildetekst" fullWidth value={mediaForm.caption} onChange={(e) => setMediaForm(prev => ({ ...prev, caption: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddMediaId(null); setMediaForm({ type: 'image', url: '', caption: '' }); }}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (addMediaId) {
                addMediaMutation.mutate({ inspirationId: addMediaId, data: mediaForm });
              }
            }}
            disabled={!mediaForm.url}
          >
            Legg til
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
