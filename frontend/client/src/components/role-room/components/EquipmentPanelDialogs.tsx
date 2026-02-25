/**
 * EquipmentPanelDialogs — All dialog components extracted from EquipmentManagementPanel.
 * 
 * This file contains the 17 modal dialogs that were previously inline in the
 * 5,828-line monolith. They consume state via useEquipmentPanel() context.
 * 
 * Dialogs included:
 *  1. Add/Edit Equipment
 *  2. Assign Crew
 *  3. Bookings
 *  4. Templates List
 *  5. Template Form
 *  6. Shop/Vendors
 *  7. New Category
 *  8. Image Picker
 *  9. Delete Confirmation
 * 10. Bulk Actions
 * 11. History/Audit
 * 12. Maintenance
 * 13. Create Booking
 * 14. Check-out
 * 15. Check-in
 * 16. Reports
 * 17. Offline Outbox
 */

import {
  Box,
  Typography,
  Button,
  IconButton,
  Card,
  CardContent,
  CardMedia,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Stack,
  Grid,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Grow,
  InputAdornment,
  LinearProgress,
  CircularProgress,
  Tabs,
  Tab,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  Image as ImageIcon,
  Person as PersonIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Block as BlockIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  Bookmark as BookmarkIcon,
  ShoppingCart as ShoppingCartIcon,
  OpenInNew as OpenInNewIcon,
  PlaylistAdd as PlaylistAddIcon,
  Star as StarIcon,
  CloudUpload as CloudUploadIcon,
  Link as LinkIcon,
  PhotoLibrary as PhotoLibraryIcon,
  Movie as MovieIcon,
  History as HistoryIcon,
  CalendarToday as CalendarTodayIcon,
  QrCode as QrCodeIcon,
  FileDownload as DownloadIcon,
  FileUpload as UploadIcon,
  FileCopy as DuplicateIcon,
  SelectAll as SelectAllIcon,
  CheckBox as CheckboxIcon,
  CheckBoxOutlineBlank as CheckboxOutlineIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  Assignment as CheckOutIcon,
  AssignmentReturn as CheckInIcon,
  Summarize as ReportIcon,
  WifiOff as OfflineIcon,
  Sync as SyncIcon,
  AssignmentLate as MissingItemIcon,
} from '@mui/icons-material';
import { EquipmentIcon as BuildIcon, LocationsIcon as LocationIcon } from './icons/CastingIcons';
import { useEquipmentPanel } from './EquipmentPanelContext';

const TOUCH_TARGET_SIZE = 44;

const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #9333ea',
    outlineOffset: 2,
  },
};

const STATUS_LABELS: Record<string, string> = {
  available: 'Tilgjengelig',
  in_use: 'I bruk',
  maintenance: 'Service',
  retired: 'Utfaset',
};

const STATUS_COLORS: Record<string, string> = {
  available: '#4caf50',
  in_use: '#2196f3',
  maintenance: '#ff9800',
  retired: '#9e9e9e',
};

const CONDITION_LABELS: Record<string, string> = {
  excellent: 'Utmerket',
  good: 'Bra',
  fair: 'Akseptabel',
  poor: 'Dårlig',
  needs_repair: 'Trenger reparasjon',
};

const CONDITION_COLORS: Record<string, string> = {
  excellent: '#4caf50',
  good: '#8bc34a',
  fair: '#ff9800',
  poor: '#f44336',
  needs_repair: '#d32f2f',
};

/**
 * All ctx.equipment panel dialogs, consuming state from EquipmentPanelContext.
 */
export function EquipmentPanelDialogs() {
  const ctx = useEquipmentPanel();

  return (
    <>
      <Dialog
        open={ctx.dialogOpen}
        onClose={() => ctx.setDialogOpen(false)}
        maxWidth="md"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          } 
        }}
      >
        <DialogTitle id={ctx.dialogTitleId} sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(147,51,234,0.15) 0%, rgba(109,40,217,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(147,51,234,0.3)',
            }}>
              <BuildIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {ctx.editingEquipment ? 'Rediger utstyr' : 'Legg til nytt utstyr'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                {ctx.editingEquipment ? 'Oppdater informasjon om utstyret' : 'Fyll inn detaljer for det nye utstyret'}
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={() => ctx.setDialogOpen(false)} 
            sx={{ 
              ...focusVisibleStyles,
              bgcolor: 'rgba(255,255,255,0.05)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, px: 3 }}>
          <Grid container spacing={2.5}>
            <Grid xs={12} sm={6}>
              <TextField
                fullWidth
                label="Navn *"
                value={ctx.formData.name}
                onChange={(e) => {
                  ctx.setFormData({ ...ctx.formData, name: e.target.value });
                  if (ctx.formErrors.name) ctx.setFormErrors({ ...ctx.formErrors, name: '' });
                }}
                error={!!ctx.formErrors.name}
                helperText={ctx.formErrors.name}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: ctx.formErrors.name ? '#f44336' : 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: ctx.formErrors.name ? '#f44336' : 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: ctx.formErrors.name ? '#f44336' : '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: ctx.formErrors.name ? '#f44336' : 'rgba(255,255,255,0.6)' },
                  '& .MuiFormHelperText-root': { color: '#f44336' },
                }}
              />
            </Grid>
            <Grid xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Kategori</InputLabel>
                <Select
                  value={ctx.formData.category}
                  onChange={(e) => {
                    if (e.target.value === '__add_new__') {
                      ctx.setNewCategoryDialogOpen(true);
                    } else {
                      ctx.setFormData({ ...ctx.formData, category: e.target.value });
                    }
                  }}
                  label="Kategori"
                  sx={{ 
                    color: '#fff', 
                    bgcolor: 'rgba(0,0,0,0.2)',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                  }}
                  MenuProps={{
                    PaperProps: { sx: { bgcolor: '#1c2128', border: '1px solid rgba(255,255,255,0.1)', maxHeight: 350 } }
                  }}
                >
                  {ctx.allCategories.map(cat => (
                    <MenuItem key={cat} value={cat}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ctx.getCategoryColor(cat) }} />
                          {cat}
                        </Box>
                        {ctx.customCategories.includes(cat) && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              ctx.handleRemoveCustomCategory(cat);
                            }}
                            sx={{ 
                              p: 0.5, 
                              color: 'rgba(255,255,255,0.87)', 
                              '&:hover': { color: '#f44336' } 
                            }}
                          >
                            <CloseIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                  <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
                  <MenuItem value="__add_new__" sx={{ color: '#4caf50' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AddIcon sx={{ fontSize: 18 }} />
                      Legg til ny kategori...
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField
                fullWidth
                label="Merke"
                value={ctx.formData.brand}
                onChange={(e) => ctx.setFormData({ ...ctx.formData, brand: e.target.value })}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField
                fullWidth
                label="Modell"
                value={ctx.formData.model}
                onChange={(e) => ctx.setFormData({ ...ctx.formData, model: e.target.value })}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField
                fullWidth
                label="Serienummer"
                value={ctx.formData.serialNumber}
                onChange={(e) => ctx.setFormData({ ...ctx.formData, serialNumber: e.target.value })}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField
                fullWidth
                label="Firmware-versjon (nåværende)"
                placeholder="f.eks. 1.2.0"
                value={ctx.formData.firmwareCurrent}
                onChange={(e) => ctx.setFormData({ ...ctx.formData, firmwareCurrent: e.target.value })}
                helperText="Skriv inn installert firmware-versjon for å sjekke oppdateringer"
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                  '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' },
                }}
              />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Antall"
                value={ctx.formData.quantity}
                onChange={(e) => ctx.setFormData({ ...ctx.formData, quantity: parseInt(e.target.value) || 1 })}
                inputProps={{ min: 1 }}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
            </Grid>
            <Grid xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Status</InputLabel>
                <Select
                  value={ctx.formData.status}
                  onChange={(e) => ctx.setFormData({ ...ctx.formData, status: e.target.value as Equipment['status'] })}
                  label="Status"
                  sx={{ 
                    color: '#fff', 
                    bgcolor: 'rgba(0,0,0,0.2)',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                  }}
                  MenuProps={{
                    PaperProps: { sx: { bgcolor: '#1c2128', border: '1px solid rgba(255,255,255,0.1)' } }
                  }}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STATUS_COLORS[value] }} />
                        {label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Tilstand</InputLabel>
                <Select
                  value={ctx.formData.condition}
                  onChange={(e) => ctx.setFormData({ ...ctx.formData, condition: e.target.value as Equipment['condition'] })}
                  label="Tilstand"
                  sx={{ 
                    color: '#fff', 
                    bgcolor: 'rgba(0,0,0,0.2)',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                  }}
                  MenuProps={{
                    PaperProps: { sx: { bgcolor: '#1c2128', border: '1px solid rgba(255,255,255,0.1)' } }
                  }}
                >
                  {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: CONDITION_COLORS[value] }} />
                        {label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={12}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Lagerlokasjon</InputLabel>
                <Select
                  value={ctx.formData.primaryLocationId}
                  onChange={(e) => ctx.setFormData({ ...ctx.formData, primaryLocationId: e.target.value })}
                  label="Lagerlokasjon"
                  sx={{ 
                    color: '#fff', 
                    bgcolor: 'rgba(0,0,0,0.2)',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                  }}
                  MenuProps={{
                    PaperProps: { sx: { bgcolor: '#1c2128', border: '1px solid rgba(255,255,255,0.1)' } }
                  }}
                >
                  <MenuItem value="">Ingen</MenuItem>
                  {ctx.locations.map(loc => (
                    <MenuItem key={loc.id} value={loc.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocationIcon sx={{ fontSize: 16, color: '#64b5f6' }} />
                        {loc.name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={12}>
              <TextField
                fullWidth
                label="Beskrivelse"
                value={ctx.formData.description}
                onChange={(e) => ctx.setFormData({ ...ctx.formData, description: e.target.value })}
                multiline
                rows={2}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
            </Grid>
            <Grid xs={12}>
              <TextField
                fullWidth
                label="Notater"
                value={ctx.formData.notes}
                onChange={(e) => ctx.setFormData({ ...ctx.formData, notes: e.target.value })}
                multiline
                rows={2}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
            </Grid>
            
            {/* Global Equipment Toggle */}
            <Grid xs={12}>
              <Box sx={{ 
                p: 2, 
                borderRadius: 2, 
                bgcolor: ctx.formData.isGlobal ? 'rgba(33,150,243,0.1)' : 'rgba(0,0,0,0.2)',
                border: ctx.formData.isGlobal ? '1px solid rgba(33,150,243,0.3)' : '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s',
              }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600 }}>
                    Globalt utstyr
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    {ctx.formData.isGlobal 
                      ? 'Tilgjengelig i alle prosjekter' 
                      : 'Kun tilknyttet dette prosjektet'}
                  </Typography>
                </Box>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    cursor: 'pointer',
                  }}
                  onClick={() => ctx.setFormData({ ...ctx.formData, isGlobal: !ctx.formData.isGlobal })}
                >
                  <Typography variant="body2" sx={{ color: ctx.formData.isGlobal ? '#2196f3' : 'rgba(255,255,255,0.5)' }}>
                    {ctx.formData.isGlobal ? 'Ja' : 'Nei'}
                  </Typography>
                  <Box sx={{
                    width: 48,
                    height: 26,
                    borderRadius: 13,
                    bgcolor: ctx.formData.isGlobal ? '#2196f3' : 'rgba(255,255,255,0.2)',
                    position: 'relative',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}>
                    <Box sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      bgcolor: '#fff',
                      position: 'absolute',
                      top: 2,
                      left: ctx.formData.isGlobal ? 24 : 2,
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }} />
                  </Box>
                </Box>
              </Box>
            </Grid>
            
            {/* Image Picker Section with Drag & Drop */}
            <Grid xs={12}>
              <Box 
                ref={ctx.dropZoneRef}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                sx={{ 
                  p: 2, 
                  borderRadius: 2, 
                  bgcolor: ctx.isDragging ? 'rgba(147,51,234,0.1)' : 'rgba(0,0,0,0.2)',
                  border: ctx.isDragging ? '2px dashed #9333ea' : '1px solid rgba(255,255,255,0.08)',
                  transition: 'all 0.2s',
                }}
              >
                <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  Utstyrsbilde
                  {ctx.isDragging && <Chip label="Slipp bildet her!" size="small" sx={{ bgcolor: '#9333ea', color: '#fff', fontSize: '0.7rem' }} />}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  {/* Image Preview */}
                  <Box sx={{
                    width: 140,
                    height: 100,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    borderRadius: 2,
                    border: ctx.isDragging ? '2px solid #9333ea' : '2px dashed rgba(255,255,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'rgba(147,51,234,0.3)',
                    },
                  }}>
                    {ctx.formData.imageUrl ? (
                      <img
                        src={ctx.formData.imageUrl}
                        alt="Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { (e.target as HTMLImageElement).src = ''; }}
                      />
                    ) : (
                    <ImageIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.2)' }} />
                    )}
                  </Box>
                
                  {/* Image Actions */}
                  <Stack spacing={1.5} sx={{ flex: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<SearchIcon />}
                      onClick={() => {
                        ctx.setImagePickerOpen(true);
                        ctx.setImagePickerTab(0);
                        ctx.setImageSearchQuery(ctx.formData.name || ctx.formData.category || '');
                      }}
                      sx={{ 
                        borderColor: 'rgba(147,51,234,0.5)', 
                        color: '#9333ea',
                        borderRadius: 2,
                        py: 1,
                        justifyContent: 'flex-start',
                        '&:hover': { borderColor: '#9333ea', bgcolor: 'rgba(147,51,234,0.1)' },
                      }}
                    >
                      Søk bilder
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<CloudUploadIcon />}
                      onClick={() => ctx.fileInputRef.current?.click()}
                      sx={{ 
                        borderColor: 'rgba(76,175,80,0.5)', 
                        color: '#4caf50',
                        borderRadius: 2,
                        py: 1,
                        justifyContent: 'flex-start',
                        '&:hover': { borderColor: '#4caf50', bgcolor: 'rgba(76,175,80,0.1)' },
                      }}
                    >
                      Last opp fil
                    </Button>
                    <input
                      ref={ctx.fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={ctx.handleFileUpload}
                    />
                    <TextField
                      size="small"
                      placeholder="Eller lim inn bilde-URL..."
                      value={ctx.tempImageUrl}
                      onChange={(e) => ctx.setTempImageUrl(e.target.value)}
                      onBlur={() => ctx.setFormData({ ...ctx.formData, imageUrl: ctx.tempImageUrl.trim() })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          ctx.setFormData({ ...ctx.formData, imageUrl: ctx.tempImageUrl.trim() });
                        }
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LinkIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 18 }} />
                          </InputAdornment>
                        ),
                        endAdornment: (ctx.tempImageUrl || ctx.formData.imageUrl) && (
                          <InputAdornment position="end">
                            {ctx.tempImageUrl.trim() !== (ctx.formData.imageUrl || '') && (
                              <IconButton
                                size="small"
                                onClick={() => ctx.setFormData({ ...ctx.formData, imageUrl: ctx.tempImageUrl.trim() })}
                                sx={{ color: 'rgba(255,255,255,0.87)', '&:hover': { color: '#4caf50' } }}
                              >
                                <SaveIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            )}
                            <IconButton
                              size="small"
                              onClick={() => {
                                ctx.setTempImageUrl('');
                                ctx.setFormData({ ...ctx.formData, imageUrl: '' });
                              }}
                              sx={{ color: 'rgba(255,255,255,0.87)', '&:hover': { color: '#f44336' } }}
                            >
                              <CloseIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      sx={{ 
                        '& .MuiOutlinedInput-root': { 
                          bgcolor: 'rgba(0,0,0,0.2)', 
                          color: '#fff',
                          borderRadius: 2,
                          '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                        },
                      }}
                    />
                  </Stack>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          p: 2.5, 
          px: 3,
          gap: 1.5,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.2) 0%, transparent 100%)',
        }}>
          <Button
            onClick={() => ctx.setDialogOpen(false)}
            startIcon={<CancelIcon />}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE, 
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
              ...focusVisibleStyles,
            }}
          >
            Avbryt
          </Button>
          <Button
            onClick={ctx.handleSave}
            variant="contained"
            startIcon={<SaveIcon />}
            sx={{
              background: 'linear-gradient(135deg, #9333ea 0%, #6d28d9 100%)',
              color: '#000',
              fontWeight: 700,
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 4,
              boxShadow: '0 4px 14px rgba(147,51,234,0.3)',
              '&:hover': { 
                background: 'linear-gradient(135deg, #c084fc 0%, #9333ea 100%)',
                boxShadow: '0 6px 20px rgba(147,51,234,0.4)',
              },
              ...focusVisibleStyles,
            }}
          >
            {ctx.editingEquipment ? 'Oppdater' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={ctx.assignDialogOpen}
        onClose={() => ctx.setAssignDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(33,150,243,0.15) 0%, rgba(30,136,229,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(33,150,243,0.3)',
            }}>
              <PersonIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Tilordne utstyrsansvarlig
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                Velg hvem som skal ha ansvar for utstyret
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={() => ctx.setAssignDialogOpen(false)} 
            sx={{ 
              ...focusVisibleStyles,
              bgcolor: 'rgba(255,255,255,0.05)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, px: 3 }}>
          <Box sx={{ 
            p: 2, 
            mb: 2.5, 
            borderRadius: 2, 
            bgcolor: 'rgba(33,150,243,0.08)',
            border: '1px solid rgba(33,150,243,0.2)',
          }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              Valgt utstyr: <strong style={{ color: '#fff' }}>{ctx.selectedEquipmentForAssign?.name}</strong>
            </Typography>
          </Box>
          <FormControl fullWidth>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Velg teammedlem</InputLabel>
            <Select
              value={ctx.selectedCrewId}
              onChange={(e) => ctx.setSelectedCrewId(e.target.value)}
              label="Velg teammedlem"
              sx={{ 
                color: '#fff', 
                bgcolor: 'rgba(0,0,0,0.2)',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(33,150,243,0.3)' },
              }}
              MenuProps={{
                PaperProps: { sx: { bgcolor: '#1c2128', border: '1px solid rgba(255,255,255,0.1)' } }
              }}
            >
              {ctx.crewMembers.map(crew => (
                <MenuItem key={crew.id} value={crew.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: 'rgba(33,150,243,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <PersonIcon sx={{ fontSize: 16, color: '#2196f3' }} />
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{crew.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>{crew.role}</Typography>
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          p: 2.5, 
          px: 3,
          gap: 1.5,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.2) 0%, transparent 100%)',
        }}>
          <Button
            onClick={() => ctx.setAssignDialogOpen(false)}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            Avbryt
          </Button>
          <Button
            onClick={ctx.handleAssign}
            variant="contained"
            disabled={!ctx.selectedCrewId}
            sx={{
              background: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 100%)',
              color: '#fff',
              fontWeight: 700,
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 4,
              boxShadow: '0 4px 14px rgba(33,150,243,0.3)',
              '&:hover': { 
                background: 'linear-gradient(135deg, #42a5f5 0%, #2196f3 100%)',
                boxShadow: '0 6px 20px rgba(33,150,243,0.4)',
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.87)',
              },
            }}
          >
            Tilordne
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={ctx.bookingsDialogOpen}
        onClose={() => ctx.setBookingsDialogOpen(false)}
        maxWidth="md"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(76,175,80,0.15) 0%, rgba(67,160,71,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(76,175,80,0.3)',
            }}>
              <ScheduleIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Bookinger
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                {ctx.selectedEquipmentBookings?.name}
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={() => ctx.setBookingsDialogOpen(false)} 
            sx={{ 
              ...focusVisibleStyles,
              bgcolor: 'rgba(255,255,255,0.05)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, px: 3 }}>
          {ctx.bookings.length === 0 && ctx.availability.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5, color: 'rgba(255,255,255,0.87)' }}>
              <Box sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: 'rgba(76,175,80,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}>
                <CheckCircleIcon sx={{ fontSize: 40, color: '#4caf50' }} />
              </Box>
              <Typography sx={{ fontWeight: 500 }}>Ingen aktive bookinger eller blokkeringer</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>Dette utstyret er tilgjengelig for booking</Typography>
            </Box>
          ) : (
            <Stack spacing={2}>
              {ctx.bookings.map(booking => (
                <Box key={booking.id} sx={{ 
                  p: 2.5, 
                  bgcolor: 'rgba(33, 150, 243, 0.08)', 
                  borderRadius: 2,
                  border: '1px solid rgba(33, 150, 243, 0.2)',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: 'rgba(33, 150, 243, 0.12)' },
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 600 }}>
                      {booking.purpose || 'Booking'}
                    </Typography>
                    <Chip
                      label={booking.status}
                      size="small"
                      sx={{ 
                        bgcolor: booking.status === 'confirmed' ? '#4caf50' : '#9333ea',
                        color: '#fff',
                        fontWeight: 600,
                        borderRadius: 1.5,
                      }}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 1 }}>
                    {booking.start_date} - {booking.end_date}
                  </Typography>
                </Box>
              ))}
              {ctx.availability.map(avail => (
                <Box key={avail.id} sx={{ 
                  p: 2.5, 
                  bgcolor: avail.status === 'service' ? 'rgba(147, 51, 234, 0.08)' : 'rgba(244, 67, 54, 0.08)', 
                  borderRadius: 2,
                  border: `1px solid ${avail.status === 'service' ? 'rgba(147, 51, 234, 0.2)' : 'rgba(244, 67, 54, 0.2)'}`,
                  transition: 'all 0.2s',
                  '&:hover': { 
                    bgcolor: avail.status === 'service' ? 'rgba(147, 51, 234, 0.12)' : 'rgba(244, 67, 54, 0.12)',
                  },
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {avail.status === 'service' ? (
                        <WarningIcon sx={{ color: '#9333ea' }} />
                      ) : (
                        <BlockIcon sx={{ color: '#f44336' }} />
                      )}
                      <Typography sx={{ fontWeight: 600 }}>
                        {avail.status === 'service' ? 'Service' : 'Utilgjengelig'}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 1 }}>
                    {avail.start_date} - {avail.end_date}
                  </Typography>
                  {avail.reason && (
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 0.5 }}>
                      Grunn: {avail.reason}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          p: 2.5, 
          px: 3,
          justifyContent: 'space-between',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.2) 0%, transparent 100%)',
        }}>
          <Button
            startIcon={<AddIcon />}
            onClick={ctx.handleOpenCreateBooking}
            sx={{ 
              color: '#2196f3',
              borderRadius: 2,
              '&:hover': { bgcolor: 'rgba(33,150,243,0.1)' },
            }}
          >
            Ny booking
          </Button>
          <Button
            onClick={() => ctx.setBookingsDialogOpen(false)}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={ctx.templatesDialogOpen}
        onClose={() => ctx.setTemplatesDialogOpen(false)}
        maxWidth="md"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(76,175,80,0.15) 0%, rgba(67,160,71,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(76,175,80,0.3)',
            }}>
              <BookmarkIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Utstyrs-maler</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                Forhåndsdefinerte utstyrssett
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={() => ctx.setTemplatesDialogOpen(false)} 
            sx={{ 
              ...focusVisibleStyles,
              bgcolor: 'rgba(255,255,255,0.05)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, px: 3 }}>
          {ctx.templates.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5, color: 'rgba(255,255,255,0.87)' }}>
              <Box sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: 'rgba(76,175,80,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}>
                <BookmarkIcon sx={{ fontSize: 36, opacity: 0.5 }} />
              </Box>
              <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 600 }}>Ingen maler ennå</Typography>
              <Typography variant="body2" sx={{ mb: 3 }}>
                {ctx.selectedEquipmentIds.size > 0 
                  ? `${ctx.selectedEquipmentIds.size} utstyr valgt - klikk for å lage mal` 
                  : 'Velg utstyr med checkboxer, eller lag mal fra alt'}
              </Typography>
              {ctx.equipment.length > 0 && (
                <Button
                  variant="outlined"
                  startIcon={<CopyIcon />}
                  onClick={ctx.handleCreateTemplateFromEquipment}
                  sx={{ 
                    borderColor: 'rgba(76,175,80,0.5)', 
                    color: '#4caf50',
                    borderRadius: 2,
                    '&:hover': { borderColor: '#4caf50', bgcolor: 'rgba(76,175,80,0.1)' },
                  }}
                >
                  {ctx.selectedEquipmentIds.size > 0 
                    ? `Lag mal fra ${ctx.selectedEquipmentIds.size} valgte` 
                    : 'Lag mal fra alt utstyr'}
                </Button>
              )}
            </Box>
          ) : (
            <Stack spacing={2}>
              {ctx.templates.map(template => (
                <Card key={template.id} sx={{ 
                  bgcolor: template.is_global ? 'rgba(33,150,243,0.08)' : 'rgba(0,0,0,0.2)', 
                  border: template.is_global 
                    ? '1px solid rgba(33,150,243,0.3)' 
                    : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 2,
                  transition: 'all 0.2s',
                  '&:hover': { 
                    bgcolor: template.is_global ? 'rgba(33,150,243,0.12)' : 'rgba(0,0,0,0.3)',
                    borderColor: template.is_global ? 'rgba(33,150,243,0.5)' : 'rgba(76,175,80,0.3)',
                  },
                }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box>
                        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                          {template.is_global && (
                            <Tooltip title="Global mal - tilgjengelig i alle prosjekter">
                              <PublicIcon sx={{ color: '#2196f3', fontSize: 20 }} />
                            </Tooltip>
                          )}
                          {template.name}
                          {template.is_default && (
                            <StarIcon sx={{ color: '#9333ea', fontSize: 18 }} />
                          )}
                        </Typography>
                        {template.description && (
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 0.5 }}>
                            {template.description}
                          </Typography>
                        )}
                        {/* Show project association info */}
                        <Typography variant="caption" sx={{ 
                          color: template.is_global ? '#2196f3' : 'rgba(255,255,255,0.4)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 0.5,
                          mt: 0.5,
                        }}>
                          {template.is_global ? (
                            <>
                              <PublicIcon sx={{ fontSize: 12 }} />
                              Tilgjengelig i alle prosjekter
                            </>
                          ) : (
                            <>
                              <LockIcon sx={{ fontSize: 12 }} />
                              Kun dette prosjektet
                            </>
                          )}
                        </Typography>
                      </Box>
                      <Chip 
                        label={`${template.item_count || 0} elementer`} 
                        size="small" 
                        sx={{ 
                          bgcolor: 'rgba(76,175,80,0.15)', 
                          color: '#4caf50',
                          fontWeight: 600,
                          borderRadius: 1.5,
                        }} 
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                      {template.is_global && (
                        <Chip 
                          icon={<PublicIcon sx={{ fontSize: '14px !important' }} />} 
                          label="Global" 
                          size="small" 
                          sx={{ 
                            bgcolor: 'rgba(33,150,243,0.15)', 
                            color: '#2196f3',
                            borderRadius: 1,
                            '& .MuiChip-icon': { color: '#2196f3' },
                          }} 
                        />
                      )}
                      {template.category && (
                        <Chip label={template.category} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.87)', borderRadius: 1 }} />
                      )}
                      {template.use_case && (
                        <Chip label={template.use_case} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.87)', borderRadius: 1 }} />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<PlaylistAddIcon />}
                        onClick={() => ctx.handleApplyTemplate(template.id)}
                        sx={{ 
                          background: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
                          color: '#fff', 
                          borderRadius: 1.5,
                          fontWeight: 600,
                          '&:hover': { background: 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)' },
                        }}
                      >
                        Bruk mal
                      </Button>
                      <IconButton 
                        size="small" 
                        onClick={() => ctx.handleDeleteTemplate(template.id)}
                        sx={{ 
                          color: 'rgba(244,67,54,0.7)',
                          '&:hover': { color: '#f44336', bgcolor: 'rgba(244,67,54,0.1)' },
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          p: 2.5, 
          px: 3,
          justifyContent: 'space-between',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.2) 0%, transparent 100%)',
        }}>
          {ctx.equipment.length > 0 && (
            <Button
              startIcon={<CopyIcon />}
              onClick={ctx.handleCreateTemplateFromEquipment}
              sx={{ 
                color: '#4caf50',
                borderRadius: 2,
                '&:hover': { bgcolor: 'rgba(76,175,80,0.1)' },
              }}
            >
              {ctx.selectedEquipmentIds.size > 0 
                ? `Lag mal fra ${ctx.selectedEquipmentIds.size} valgte` 
                : 'Lag mal fra alt utstyr'}
            </Button>
          )}
          <Button
            onClick={() => ctx.setTemplatesDialogOpen(false)}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* Template Form Dialog - for creating/editing ctx.templates */}
      <Dialog
        open={ctx.templateFormOpen}
        onClose={() => ctx.setTemplateFormOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          background: 'linear-gradient(135deg, rgba(76,175,80,0.15) 0%, rgba(67,160,71,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <BookmarkIcon sx={{ color: '#fff', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {ctx.editingTemplate ? 'Rediger mal' : 'Opprett mal'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
              {ctx.templateFormData.items.length} elementer
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={2.5}>
            <TextField
              label="Navn på mal"
              value={ctx.templateFormData.name}
              onChange={e => ctx.setTemplateFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
              sx={{ 
                '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.03)' },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                '& .MuiOutlinedInput-input': { color: '#fff' },
              }}
            />
            <TextField
              label="Beskrivelse"
              value={ctx.templateFormData.description}
              onChange={e => ctx.setTemplateFormData(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              rows={2}
              sx={{ 
                '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.03)' },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                '& .MuiOutlinedInput-input': { color: '#fff' },
              }}
            />
            <Grid container spacing={2}>
              <Grid xs={6}>
                <TextField
                  label="Kategori"
                  value={ctx.templateFormData.category}
                  onChange={e => ctx.setTemplateFormData(prev => ({ ...prev, category: e.target.value }))}
                  fullWidth
                  sx={{ 
                    '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.03)' },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                    '& .MuiOutlinedInput-input': { color: '#fff' },
                  }}
                />
              </Grid>
              <Grid xs={6}>
                <TextField
                  label="Bruksområde"
                  value={ctx.templateFormData.use_case}
                  onChange={e => ctx.setTemplateFormData(prev => ({ ...prev, use_case: e.target.value }))}
                  fullWidth
                  sx={{ 
                    '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.03)' },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                    '& .MuiOutlinedInput-input': { color: '#fff' },
                  }}
                />
              </Grid>
            </Grid>

            {/* Global template toggle */}
            <Box 
              onClick={() => ctx.setTemplateFormData(prev => ({ ...prev, is_global: !prev.is_global }))}
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                p: 2,
                borderRadius: 2,
                bgcolor: ctx.templateFormData.is_global ? 'rgba(33,150,243,0.1)' : 'rgba(255,255,255,0.03)',
                border: ctx.templateFormData.is_global 
                  ? '1px solid rgba(33,150,243,0.4)' 
                  : '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { 
                  borderColor: ctx.templateFormData.is_global 
                    ? 'rgba(33,150,243,0.6)' 
                    : 'rgba(255,255,255,0.2)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: ctx.templateFormData.is_global ? 'rgba(33,150,243,0.2)' : 'rgba(255,255,255,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {ctx.templateFormData.is_global ? (
                    <PublicIcon sx={{ color: '#2196f3' }} />
                  ) : (
                    <LockIcon sx={{ color: 'rgba(255,255,255,0.87)' }} />
                  )}
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: ctx.templateFormData.is_global ? '#2196f3' : '#fff' }}>
                    {ctx.templateFormData.is_global ? 'Global mal' : 'Prosjekt-mal'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    {ctx.templateFormData.is_global 
                      ? 'Tilgjengelig i alle prosjekter' 
                      : 'Kun tilgjengelig i dette prosjektet'}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{
                width: 50,
                height: 26,
                borderRadius: 13,
                bgcolor: ctx.templateFormData.is_global ? '#2196f3' : 'rgba(255,255,255,0.2)',
                position: 'relative',
                transition: 'all 0.2s',
              }}>
                <Box sx={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  bgcolor: '#fff',
                  position: 'absolute',
                  top: 2,
                  left: ctx.templateFormData.is_global ? 26 : 2,
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }} />
              </Box>
            </Box>

            {/* Preview of items */}
            {ctx.templateFormData.items.length > 0 && (
              <Box sx={{ 
                bgcolor: 'rgba(0,0,0,0.2)', 
                borderRadius: 2, 
                p: 2,
                maxHeight: 200,
                overflow: 'auto',
              }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1, display: 'block' }}>
                  Inkluderte elementer:
                </Typography>
                {ctx.templateFormData.items.map((item, idx) => (
                  <Chip
                    key={idx}
                    label={item.name}
                    size="small"
                    sx={{ 
                      m: 0.5, 
                      bgcolor: 'rgba(76,175,80,0.15)', 
                      color: '#4caf50',
                      borderRadius: 1,
                    }}
                  />
                ))}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          p: 2.5,
          gap: 1,
        }}>
          <Button
            onClick={() => ctx.setTemplateFormOpen(false)}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              borderRadius: 2,
              px: 3,
            }}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={ctx.handleSaveTemplate}
            disabled={!ctx.templateFormData.name.trim()}
            sx={{ 
              background: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
              borderRadius: 2,
              px: 3,
              fontWeight: 600,
            }}
          >
            {ctx.editingTemplate ? 'Oppdater mal' : 'Opprett mal'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={ctx.shopDialogOpen}
        onClose={() => ctx.setShopDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(33,150,243,0.15) 0%, rgba(30,136,229,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(33,150,243,0.3)',
            }}>
              <ShoppingCartIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Kjøp utstyr via foto.no</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                Norges ledende utstyrsleverandør
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={() => ctx.setShopDialogOpen(false)} 
            sx={{ 
              ...focusVisibleStyles,
              bgcolor: 'rgba(255,255,255,0.05)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, px: 3 }}>
          {ctx.vendorCategories.length > 0 && (
            <Box sx={{ mb: 2.5 }}>
              <FormControl size="small" sx={{ minWidth: 260 }}>
                <InputLabel id="vendor-category-label" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  Produktkategori
                </InputLabel>
                <Select
                  labelId="vendor-category-label"
                  value={ctx.selectedVendorCategory}
                  label="Produktkategori"
                  onChange={(e) => ctx.setSelectedVendorCategory(e.target.value)}
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(33,150,243,0.5)' },
                    '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.87)' },
                  }}
                >
                  <MenuItem value="all">Alle kategorier</MenuItem>
                  {ctx.vendorCategories.map((category) => (
                    <MenuItem key={category.category} value={category.category}>
                      {category.category} ({category.count})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}

          <Box sx={{ 
            textAlign: 'center', 
            py: 5,
            background: 'linear-gradient(135deg, rgba(33,150,243,0.08) 0%, rgba(33,150,243,0.03) 100%)',
            borderRadius: 2,
            border: '1px solid rgba(33,150,243,0.15)',
          }}>
            <Box sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'rgba(33,150,243,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}>
              <ShoppingCartIcon sx={{ fontSize: 40, color: '#2196f3' }} />
            </Box>
            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
              Bygg nytt lager via foto.no
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.87)', mb: 4, maxWidth: 500, mx: 'auto' }}>
              Norges ledende leverandør av foto- og videoutstyr. 
              Finn alt du trenger for profesjonell produksjon.
            </Typography>
            <Stack spacing={1.5} sx={{ maxWidth: 320, mx: 'auto' }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<OpenInNewIcon />}
                onClick={() => window.open('https://www.foto.no/foto/kamera', '_blank')}
                sx={{ 
                  background: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 100%)',
                  color: '#fff', 
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  '&:hover': { background: 'linear-gradient(135deg, #42a5f5 0%, #2196f3 100%)' } 
                }}
              >
                Kameraer
              </Button>
              <Button
                variant="contained"
                size="large"
                startIcon={<OpenInNewIcon />}
                onClick={() => window.open('https://www.foto.no/foto/foto-tilbehor/belysning', '_blank')}
                sx={{ 
                  background: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 100%)',
                  color: '#fff', 
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  '&:hover': { background: 'linear-gradient(135deg, #42a5f5 0%, #2196f3 100%)' } 
                }}
              >
                Lys og belysning
              </Button>
              <Button
                variant="contained"
                size="large"
                startIcon={<OpenInNewIcon />}
                onClick={() => window.open('https://www.foto.no/video', '_blank')}
                sx={{ 
                  background: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 100%)',
                  color: '#fff', 
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  '&:hover': { background: 'linear-gradient(135deg, #42a5f5 0%, #2196f3 100%)' } 
                }}
              >
                Videoutstyr
              </Button>
              <Button
                variant="contained"
                size="large"
                startIcon={<OpenInNewIcon />}
                onClick={() => window.open('https://www.foto.no/lyd', '_blank')}
                sx={{ 
                  background: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 100%)',
                  color: '#fff', 
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  '&:hover': { background: 'linear-gradient(135deg, #42a5f5 0%, #2196f3 100%)' } 
                }}
              >
                Lydopptak
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<OpenInNewIcon />}
                onClick={() => window.open('https://www.foto.no', '_blank')}
                sx={{ 
                  borderColor: 'rgba(33,150,243,0.5)', 
                  color: '#2196f3', 
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  '&:hover': { borderColor: '#2196f3', bgcolor: 'rgba(33,150,243,0.1)' } 
                }}
              >
                Alle kategorier
              </Button>
            </Stack>
          </Box>
          
          {ctx.vendorLinks.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 2 }}>
                Anbefalte produkter
              </Typography>
              <Grid container spacing={2}>
                {ctx.vendorLinks.filter(l => l.is_recommended).map(link => (
                  <Grid xs={12} sm={6} md={4} key={link.id}>
                    <Card 
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.05)', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' }
                      }}
                      onClick={() => window.open(link.affiliate_url || link.product_url, '_blank')}
                    >
                      <CardContent>
                        <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600 }}>
                          {link.product_name}
                        </Typography>
                        {link.description && (
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 1 }}>
                            {link.description}
                          </Typography>
                        )}
                        {link.price && (
                          <Typography variant="h6" sx={{ color: '#4caf50', mt: 1, fontWeight: 700 }}>
                            kr {link.price.toLocaleString('nb-NO')},-
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                          <Chip label={link.category} size="small" sx={{ bgcolor: 'rgba(33,150,243,0.2)', color: '#2196f3' }} />
                          <OpenInNewIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.87)' }} />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          p: 2.5, 
          px: 3,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.2) 0%, transparent 100%)',
        }}>
          <Button
            onClick={() => ctx.setShopDialogOpen(false)}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Category Dialog */}
      <Dialog
        open={ctx.newCategoryDialogOpen}
        onClose={() => {
          ctx.setNewCategoryDialogOpen(false);
          ctx.setNewCategoryName('');
        }}
        maxWidth="xs"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(76,175,80,0.15) 0%, rgba(67,160,71,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(76,175,80,0.3)',
            }}>
              <AddIcon sx={{ color: '#fff', fontSize: 22 }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Ny kategori
            </Typography>
          </Box>
          <IconButton 
            onClick={() => ctx.setNewCategoryDialogOpen(false)}
            sx={{ 
              bgcolor: 'rgba(255,255,255,0.05)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, px: 3 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 2 }}>
            Egendefinerte kategorier lagres lokalt og er tilgjengelige for dette prosjektet.
          </Typography>
          <TextField
            fullWidth
            label="Kategorinavn"
            value={ctx.newCategoryName}
            onChange={(e) => ctx.setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && ctx.newCategoryName.trim()) {
                ctx.handleAddCustomCategory();
              }
            }}
            autoFocus
            placeholder="F.eks. Drone, Greenscreen..."
            sx={{ 
              '& .MuiOutlinedInput-root': { 
                bgcolor: 'rgba(0,0,0,0.2)', 
                color: '#fff',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(76,175,80,0.3)' },
                '&.Mui-focused fieldset': { borderColor: '#4caf50' },
              },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
            }}
          />
          {ctx.customCategories.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1, display: 'block' }}>
                Dine egendefinerte kategorier:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {ctx.customCategories.map(cat => (
                  <Chip
                    key={cat}
                    label={cat}
                    size="small"
                    onDelete={() => ctx.handleRemoveCustomCategory(cat)}
                    sx={{ 
                      bgcolor: 'rgba(76,175,80,0.15)', 
                      color: '#4caf50',
                      '& .MuiChip-deleteIcon': { color: 'rgba(76,175,80,0.5)', '&:hover': { color: '#f44336' } },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          p: 2.5, 
          px: 3,
          gap: 1.5,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.2) 0%, transparent 100%)',
        }}>
          <Button
            onClick={() => {
              ctx.setNewCategoryDialogOpen(false);
              ctx.setNewCategoryName('');
            }}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            Avbryt
          </Button>
          <Button
            onClick={ctx.handleAddCustomCategory}
            variant="contained"
            disabled={!ctx.newCategoryName.trim() || ctx.allCategories.includes(ctx.newCategoryName.trim())}
            sx={{
              background: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
              color: '#fff',
              fontWeight: 700,
              borderRadius: 2,
              px: 3,
              boxShadow: '0 4px 14px rgba(76,175,80,0.3)',
              '&:hover': { 
                background: 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)',
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.87)',
              },
            }}
          >
            Legg til
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Picker Dialog */}
      <Dialog
        open={ctx.imagePickerOpen}
        onClose={() => {
          ctx.setImagePickerOpen(false);
          setImageSearchResults([]);
          ctx.setImageSearchQuery('');
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3, 
            minHeight: 500,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(156,39,176,0.15) 0%, rgba(142,36,170,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #9c27b0 0%, #8e24aa 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(156,39,176,0.3)',
            }}>
              <PhotoLibraryIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Velg bilde for utstyr
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                Søk i flere kilder eller last opp
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={() => ctx.setImagePickerOpen(false)}
            sx={{ 
              bgcolor: 'rgba(255,255,255,0.05)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Tabs
            value={ctx.imagePickerTab}
            onChange={(_, v) => ctx.setImagePickerTab(v)}
            sx={{
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              px: 2,
              '& .MuiTab-root': { color: 'rgba(255,255,255,0.87)' },
              '& .Mui-selected': { color: '#9333ea' },
              '& .MuiTabs-indicator': { bgcolor: '#9333ea' },
            }}
          >
            <Tab icon={<SearchIcon />} label="Søk bilder" iconPosition="start" />
            <Tab icon={<MovieIcon />} label="Filmreferanser" iconPosition="start" />
          </Tabs>
          
          <Box sx={{ p: 2 }}>
            {/* Search Input */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                placeholder={ctx.imagePickerTab === 0 ? "Søk etter utstyr, props, rekvisitter..." : "Søk film for referansebilder..."}
                value={ctx.imageSearchQuery}
                onChange={(e) => ctx.setImageSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ctx.searchImages(ctx.imageSearchQuery)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'rgba(255,255,255,0.87)' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(255,255,255,0.05)', 
                    color: '#fff',
                  } 
                }}
              />
              <Button
                variant="contained"
                onClick={() => ctx.searchImages(ctx.imageSearchQuery)}
                disabled={ctx.imageSearchLoading || !ctx.imageSearchQuery.trim()}
                sx={{ 
                  bgcolor: '#9333ea', 
                  color: '#000',
                  minWidth: 100,
                  '&:hover': { bgcolor: '#6d28d9' },
                }}
              >
                {ctx.imageSearchLoading ? <CircularProgress size={20} /> : 'Søk'}
              </Button>
            </Box>
            
            {/* Quick Search Suggestions */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              {['Kamera', 'Lys', 'Stativ', 'Mikrofon', 'Drone', 'Generator', 'Film props', 'Studio ctx.equipment'].map((term) => (
                <Chip
                  key={term}
                  label={term}
                  size="small"
                  onClick={() => {
                    ctx.setImageSearchQuery(term);
                    ctx.searchImages(term);
                  }}
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.1)', 
                    color: '#fff',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(147,51,234,0.2)' },
                  }}
                />
              ))}
            </Box>
            
            {/* Search Results */}
            {ctx.imageSearchLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4, flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <CircularProgress sx={{ color: '#9333ea' }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  Søker i Pexels, Pixabay, Unsplash, Openverse, Wikimedia...
                </Typography>
              </Box>
            ) : ctx.imageSearchResults.length > 0 ? (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    {ctx.imageSearchResults.length} bilder funnet • Klikk for å velge
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {[
                      { name: 'pexels', color: '#05bc9e', label: 'Pexels' },
                      { name: 'pixabay', color: '#27a955', label: 'Pixabay' },
                      { name: 'unsplash', color: '#2196f3', label: 'Unsplash' },
                      { name: 'openverse', color: '#9c27b0', label: 'Openverse' },
                      { name: 'wikimedia', color: '#3e85ba', label: 'Wikimedia' },
                      { name: 'shotcafe', color: '#9333ea', label: 'shot.cafe' },
                    ].filter(s => ctx.imageSearchResults.some(r => r.source === s.name))
                    .map(s => (
                      <Box
                        key={s.name}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 0.5,
                          py: 0.25,
                          borderRadius: 0.5,
                          bgcolor: `${s.color}22`,
                        }}
                      >
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: s.color }} />
                        <Typography variant="caption" sx={{ color: s.color, fontSize: '9px', fontWeight: 600 }}>
                          {s.label} ({ctx.imageSearchResults.filter(r => r.source === s.name).length})
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
                <ImageList cols={ctx.isMobile ? 2 : ctx.isTablet ? 3 : 4} gap={8} sx={{ maxHeight: 350 }}>
                  {ctx.imageSearchResults.map((img) => (
                    <ImageListItem 
                      key={img.id}
                      sx={{ 
                        cursor: 'pointer',
                        borderRadius: 1,
                        overflow: 'hidden',
                        border: '2px solid transparent',
                        transition: 'all 0.2s',
                        '&:hover': { 
                          border: '2px solid #9333ea',
                          transform: 'scale(1.02)',
                        },
                      }}
                      onClick={() => ctx.handleSelectSearchImage(img.url)}
                    >
                      <img
                        src={img.thumbnailUrl}
                        alt={img.description || 'Search result'}
                        loading="lazy"
                        style={{ height: 120, objectFit: 'cover' }}
                        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-image.png'; }}
                      />
                      <ImageListItemBar
                        subtitle={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="caption" sx={{ 
                              textTransform: 'capitalize',
                              bgcolor: 
                                img.source === 'unsplash' ? 'rgba(33,150,243,0.4)' : 
                                img.source === 'pexels' ? 'rgba(5,188,158,0.4)' :
                                img.source === 'pixabay' ? 'rgba(39,169,85,0.4)' :
                                img.source === 'openverse' ? 'rgba(156,39,176,0.4)' :
                                img.source === 'wikimedia' ? 'rgba(62,133,186,0.4)' :
                                img.source === 'shotcafe' ? 'rgba(147,51,234,0.4)' :
                                'rgba(100,100,100,0.4)',
                              px: 0.5,
                              borderRadius: 0.5,
                              fontSize: '9px',
                              fontWeight: 600,
                            }}>
                              {img.source === 'shotcafe' ? 'shot.cafe' : img.source}
                            </Typography>
                            {img.photographer && (
                              <Typography variant="caption" sx={{ opacity: 0.7, ml: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '9px' }}>
                                {img.photographer}
                              </Typography>
                            )}
                          </Box>
                        }
                        sx={{
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                          '& .MuiImageListItemBar-title': { fontSize: 12 },
                        }}
                      />
                    </ImageListItem>
                  ))}
                </ImageList>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', mt: 1, display: 'block', textAlign: 'center' }}>
                  Bilder fra Unsplash & shot.cafe • Kun for intern referanse
                </Typography>
              </Box>
            ) : (
              <Box sx={{ 
                textAlign: 'center', 
                py: 6, 
                color: 'rgba(255,255,255,0.87)',
              }}>
                <PhotoLibraryIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
                <Typography variant="body1">
                  Søk etter bilder av utstyr og rekvisitter
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Resultater fra Unsplash og shot.cafe
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
          <Button
            onClick={() => {
              ctx.setImagePickerOpen(false);
              setImageSearchResults([]);
            }}
            sx={{ color: 'rgba(255,255,255,0.87)' }}
          >
            Avbryt
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={ctx.deleteDialogOpen}
        onClose={() => ctx.setDeleteDialogOpen(false)}
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,77,77,0.3)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            maxWidth: 400,
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          background: 'linear-gradient(135deg, rgba(244,67,54,0.15) 0%, rgba(211,47,47,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(244,67,54,0.3)',
          }}>
            <DeleteIcon sx={{ color: '#fff', fontSize: 24 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Bekreft sletting</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography>
            Er du sikker på at du vil slette <strong>"{ctx.equipmentToDelete?.name}"</strong>?
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 1 }}>
            Denne handlingen kan ikke angres.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          p: 2.5,
          gap: 1,
        }}>
          <Button
            onClick={() => ctx.setDeleteDialogOpen(false)}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 3,
            }}
          >
            Avbryt
          </Button>
          <Button
            onClick={ctx.handleConfirmDelete}
            variant="contained"
            sx={{ 
              bgcolor: '#f44336',
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: '#d32f2f' },
            }}
          >
            Slett
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Action Dialog */}
      <Dialog
        open={ctx.bulkActionDialogOpen}
        onClose={() => ctx.setBulkActionDialogOpen(false)}
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            maxWidth: 450,
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          background: ctx.bulkActionType === 'delete' 
            ? 'linear-gradient(135deg, rgba(244,67,54,0.15) 0%, rgba(211,47,47,0.1) 100%)'
            : 'linear-gradient(135deg, rgba(147,51,234,0.15) 0%, rgba(245,124,0,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            background: ctx.bulkActionType === 'delete'
              ? 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)'
              : 'linear-gradient(135deg, #9333ea 0%, #6d28d9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {ctx.bulkActionType === 'delete' ? <DeleteIcon /> : <EditIcon />}
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {ctx.bulkActionType === 'delete' ? 'Slett valgt utstyr' : 
             ctx.bulkActionType === 'status' ? 'Endre status' : 'Tilordne utstyr'}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography sx={{ mb: 2 }}>
            {ctx.selectedEquipmentIds.size} utstyr valgt
          </Typography>
          {ctx.bulkActionType === 'status' && (
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Ny status</InputLabel>
              <Select
                value={ctx.bulkNewStatus}
                onChange={(e) => ctx.setBulkNewStatus(e.target.value as Equipment['status'])}
                label="Ny status"
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {ctx.bulkActionType === 'assign' && (
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Tilordne til</InputLabel>
              <Select
                value={ctx.bulkAssignCrewId}
                onChange={(e) => ctx.setBulkAssignCrewId(e.target.value)}
                label="Tilordne til"
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                {ctx.crewMembers.map((crew) => (
                  <MenuItem key={crew.id} value={crew.id}>{crew.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {ctx.bulkActionType === 'delete' && (
            <Typography variant="body2" sx={{ color: 'rgba(255,77,77,0.8)' }}>
              Denne handlingen kan ikke angres!
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2.5, gap: 1 }}>
          <Button onClick={() => ctx.setBulkActionDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Avbryt
          </Button>
          <Button
            onClick={ctx.handleConfirmBulkAction}
            variant="contained"
            sx={{ 
              bgcolor: ctx.bulkActionType === 'delete' ? '#f44336' : '#9333ea',
              '&:hover': { bgcolor: ctx.bulkActionType === 'delete' ? '#d32f2f' : '#6d28d9' },
            }}
          >
            Bekreft
          </Button>
        </DialogActions>
      </Dialog>

      {/* History Dialog */}
      <Dialog
        open={ctx.historyDialogOpen}
        onClose={() => ctx.setHistoryDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(156,39,176,0.15) 0%, rgba(142,36,170,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #9c27b0 0%, #8e24aa 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <HistoryIcon sx={{ color: '#fff' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Historikk</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                {ctx.selectedEquipmentHistory?.name}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => ctx.setHistoryDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            {ctx.equipmentHistory.map((entry) => (
              <Box key={entry.id} sx={{ 
                p: 2, 
                bgcolor: 'rgba(255,255,255,0.03)', 
                borderRadius: 2,
                borderLeft: '3px solid #9c27b0',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{entry.action}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    {new Date(entry.timestamp).toLocaleString('nb-NO')}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>{entry.details}</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>av {entry.user}</Typography>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
          <Button onClick={() => ctx.setHistoryDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Maintenance Dialog */}
      <Dialog
        open={ctx.maintenanceDialogOpen}
        onClose={() => ctx.setMaintenanceDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          background: 'linear-gradient(135deg, rgba(0,150,136,0.15) 0%, rgba(0,137,123,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #009688 0%, #00897b 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <BuildIcon sx={{ color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Planlegg vedlikehold</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
              {ctx.selectedEquipmentMaintenance?.name}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={3}>
            <TextField
              label="Dato"
              type="date"
              value={ctx.maintenanceForm.scheduledDate}
              onChange={(e) => ctx.setMaintenanceForm({ ...ctx.maintenanceForm, scheduledDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Type vedlikehold</InputLabel>
              <Select
                value={ctx.maintenanceForm.type}
                onChange={(e) => ctx.setMaintenanceForm({ ...ctx.maintenanceForm, type: e.target.value as typeof ctx.maintenanceForm.type })}
                label="Type vedlikehold"
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                <MenuItem value="routine">Rutinemessig vedlikehold</MenuItem>
                <MenuItem value="repair">Reparasjon</MenuItem>
                <MenuItem value="inspection">Inspeksjon</MenuItem>
                <MenuItem value="calibration">Kalibrering</MenuItem>
                <MenuItem value="cleaning">Rengjøring</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Notater"
              value={ctx.maintenanceForm.notes}
              onChange={(e) => ctx.setMaintenanceForm({ ...ctx.maintenanceForm, notes: e.target.value })}
              multiline
              rows={3}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2.5, gap: 1 }}>
          <Button onClick={() => ctx.setMaintenanceDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Avbryt
          </Button>
          <Button
            onClick={ctx.handleScheduleMaintenance}
            variant="contained"
            sx={{ bgcolor: '#009688', '&:hover': { bgcolor: '#00897b' } }}
          >
            Planlegg
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Booking Dialog */}
      <Dialog
        open={ctx.createBookingDialogOpen}
        onClose={() => ctx.setCreateBookingDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          background: 'linear-gradient(135deg, rgba(33,150,243,0.15) 0%, rgba(30,136,229,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <CalendarTodayIcon sx={{ color: '#fff' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Ny booking</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={3}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Startdato"
                type="date"
                value={ctx.bookingForm.startDate}
                onChange={(e) => {
                  const v = e.target.value;
                  ctx.setBookingForm(f => ({ ...f, startDate: v }));
                  checkBookingConflicts(v, ctx.bookingForm.endDate);
                }}
                InputLabelProps={{ shrink: true }}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
              <TextField
                label="Sluttdato"
                type="date"
                value={ctx.bookingForm.endDate}
                onChange={(e) => {
                  const v = e.target.value;
                  ctx.setBookingForm(f => ({ ...f, endDate: v }));
                  checkBookingConflicts(ctx.bookingForm.startDate, v);
                }}
                InputLabelProps={{ shrink: true }}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
            </Box>
            {ctx.conflictChecking && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255,255,255,0.6)' }}>
                <CircularProgress size={14} sx={{ color: 'inherit' }} />
                <Typography variant="caption">Sjekker konflikter…</Typography>
              </Box>
            )}
            {!ctx.conflictChecking && ctx.bookingConflicts.length > 0 && (
              <Box sx={{
                p: 2, borderRadius: 2,
                bgcolor: 'rgba(147,51,234,0.12)',
                border: '1px solid rgba(147,51,234,0.4)',
                display: 'flex', alignItems: 'flex-start', gap: 1.5,
              }}>
                <WarningIcon sx={{ color: '#9333ea', mt: 0.25, flexShrink: 0 }} />
                <Box>
                  <Typography variant="body2" sx={{ color: '#c084fc', fontWeight: 600 }}>
                    {ctx.bookingConflicts.length} konflikt{ctx.bookingConflicts.length > 1 ? 'er' : ''} funnet
                  </Typography>
                  {ctx.bookingConflicts.map(c => (
                    <Typography key={c.id} variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block' }}>
                      {c.type === 'booking' ? `Booking: ${c.purpose ?? ''}` : c.reason ?? c.type} ({c.start_date} – {c.end_date})
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}
            <TextField
              label="Formål"
              value={ctx.bookingForm.purpose}
              onChange={(e) => ctx.setBookingForm({ ...ctx.bookingForm, purpose: e.target.value })}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
            <TextField
              label="Notater"
              value={ctx.bookingForm.notes}
              onChange={(e) => ctx.setBookingForm({ ...ctx.bookingForm, notes: e.target.value })}
              multiline
              rows={2}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2.5, gap: 1 }}>
          <Button onClick={() => ctx.setCreateBookingDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Avbryt
          </Button>
          <Button
            onClick={ctx.handleCreateBooking}
            variant="contained"
            sx={{ bgcolor: '#2196f3', '&:hover': { bgcolor: '#1e88e5' } }}
          >
            Opprett booking
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Check-out Dialog ─────────────────────────── */}
      <Dialog open={ctx.checkoutDialogOpen} onClose={() => ctx.setCheckoutDialogOpen(false)} maxWidth="sm" fullWidth TransitionComponent={Grow}
        PaperProps={{ sx: { bgcolor: 'rgba(28,33,40,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 1 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, background: 'linear-gradient(135deg, #2196f3, #1565c0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckOutIcon sx={{ color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>Sjekk ut utstyr</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>{ctx.checkoutEquipment?.name}</Typography>
          </Box>
          <IconButton onClick={() => ctx.setCheckoutDialogOpen(false)} sx={{ ml: 'auto', color: 'rgba(255,255,255,0.6)' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2.5}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Sjekkes ut til *</InputLabel>
              <Select value={ctx.checkoutForm.crewId} onChange={(e) => ctx.setCheckoutForm(f => ({ ...f, crewId: e.target.value }))} label="Sjekkes ut til *"
                sx={{ bgcolor: 'rgba(255,255,255,0.05)', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}>
                {ctx.crewMembers.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label="Antall" type="number" inputProps={{ min: 1, max: ctx.checkoutEquipment?.quantity ?? 99 }}
              value={ctx.checkoutForm.quantity}
              onChange={(e) => ctx.setCheckoutForm(f => ({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' } }}
            />
            <TextField label="Formål" value={ctx.checkoutForm.purpose} onChange={(e) => ctx.setCheckoutForm(f => ({ ...f, purpose: e.target.value }))} fullWidth
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' } }} />
            {!ctx.isOnline && (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(147,51,234,0.1)', border: '1px solid rgba(147,51,234,0.3)', display: 'flex', gap: 1, alignItems: 'center' }}>
                <OfflineIcon sx={{ color: '#9333ea', fontSize: 18 }} />
                <Typography variant="caption" sx={{ color: '#c084fc' }}>Du er offline — operasjonen lagres i kø og synkroniseres automatisk</Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2.5, gap: 1 }}>
          <Button onClick={() => ctx.setCheckoutDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>Avbryt</Button>
          <Button onClick={ctx.handleConfirmCheckout} variant="contained" disabled={!ctx.checkoutForm.crewId}
            sx={{ bgcolor: '#2196f3', '&:hover': { bgcolor: '#1e88e5' } }}>
            {ctx.isOnline ? 'Sjekk ut' : 'Legg i kø'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Check-in Dialog ──────────────────────────── */}
      <Dialog open={ctx.checkinDialogOpen} onClose={() => ctx.setCheckinDialogOpen(false)} maxWidth="sm" fullWidth TransitionComponent={Grow}
        PaperProps={{ sx: { bgcolor: 'rgba(28,33,40,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 1 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, background: 'linear-gradient(135deg, #4caf50, #2e7d32)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckInIcon sx={{ color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>Lever inn utstyr</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>{ctx.checkinEquipment?.name}</Typography>
          </Box>
          <IconButton onClick={() => ctx.setCheckinDialogOpen(false)} sx={{ ml: 'auto', color: 'rgba(255,255,255,0.6)' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2.5}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Tilstand ved retur</InputLabel>
              <Select value={ctx.checkinForm.condition} onChange={(e) => ctx.setCheckinForm(f => ({ ...f, condition: e.target.value as Equipment['condition'] }))} label="Tilstand ved retur"
                sx={{ bgcolor: 'rgba(255,255,255,0.05)', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}>
                {Object.entries(CONDITION_LABELS).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Merknader" multiline rows={2} value={ctx.checkinForm.notes} onChange={(e) => ctx.setCheckinForm(f => ({ ...f, notes: e.target.value }))} fullWidth
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' } }} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2.5, gap: 1 }}>
          <Button onClick={() => ctx.setCheckinDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>Avbryt</Button>
          <Button onClick={ctx.handleConfirmCheckin} variant="contained" sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#43a047' } }}>Lever inn</Button>
        </DialogActions>
      </Dialog>

      {/* ── Reports Dialog ───────────────────────────── */}
      <Dialog open={ctx.reportsDialogOpen} onClose={() => ctx.setReportsDialogOpen(false)} maxWidth="md" fullWidth TransitionComponent={Grow}
        PaperProps={{ sx: { bgcolor: 'rgba(28,33,40,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 0 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, background: 'linear-gradient(135deg, #9c27b0, #6a1b9a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ReportIcon sx={{ color: '#fff' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>Rapporter</Typography>
          <IconButton onClick={() => ctx.setReportsDialogOpen(false)} sx={{ ml: 'auto', color: 'rgba(255,255,255,0.6)' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <Tabs value={ctx.reportsTab} onChange={(_, v) => ctx.setReportsTab(v)} sx={{ px: 3, '& .MuiTabs-indicator': { bgcolor: '#9c27b0' }, '& .MuiTab-root': { color: 'rgba(255,255,255,0.6)', '&.Mui-selected': { color: '#ce93d8' } } }}>
          <Tab label="Utstyrsliste" />
          <Tab label={`Manglende (${missingItems.length})`} />
          <Tab label={`Vedlikehold / Rep. (${maintenanceItems.length})`} />
        </Tabs>
        <DialogContent sx={{ pt: 2 }}>
          {ctx.reportsTab === 0 && (
            <Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 2 }}>
                Fullstendig utstyrsliste for prosjektet — {ctx.equipment.length} elementer
              </Typography>
              <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
                {ctx.equipment.map(eq => (
                  <Box key={eq.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <Chip label={STATUS_LABELS[eq.status]} size="small" sx={{ bgcolor: `${STATUS_COLORS[eq.status]}20`, color: STATUS_COLORS[eq.status], fontSize: '0.65rem', minWidth: 80 }} />
                    <Typography variant="body2" sx={{ color: '#fff', flex: 1, fontWeight: 600 }}>{eq.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{eq.brand} {eq.model}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', minWidth: 50 }}>×{eq.quantity}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', minWidth: 80 }}>{ctx.getCrewName(eq.assignees?.[0]?.crew_id ?? '')}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
          {ctx.reportsTab === 1 && (
            <Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 2 }}>
                Tilgjengelig utstyr uten tildelt ansvarlig — {missingItems.length} elementer
              </Typography>
              {missingItems.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CheckCircleIcon sx={{ fontSize: 40, color: '#4caf50', mb: 1 }} />
                  <Typography sx={{ color: '#4caf50' }}>Alt utstyr er tilordnet</Typography>
                </Box>
              ) : (
                <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
                  {missingItems.map(eq => (
                    <Box key={eq.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <MissingItemIcon sx={{ color: '#9333ea', fontSize: 18, flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ color: '#fff', flex: 1, fontWeight: 600 }}>{eq.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{eq.category}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>×{eq.quantity}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
          {ctx.reportsTab === 2 && (
            <Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 2 }}>
                Utstyr som trenger vedlikehold eller reparasjon — {maintenanceItems.length} elementer
              </Typography>
              {maintenanceItems.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CheckCircleIcon sx={{ fontSize: 40, color: '#4caf50', mb: 1 }} />
                  <Typography sx={{ color: '#4caf50' }}>Ingen vedlikeholdsoppgaver</Typography>
                </Box>
              ) : (
                <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
                  {maintenanceItems.map(eq => (
                    <Box key={eq.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <WarningIcon sx={{ color: '#f44336', fontSize: 18, flexShrink: 0 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>{eq.name}</Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{eq.notes ?? 'Ingen merknader'}</Typography>
                      </Box>
                      <Chip label={CONDITION_LABELS[eq.condition]} size="small" sx={{ bgcolor: `${CONDITION_COLORS[eq.condition]}20`, color: CONDITION_COLORS[eq.condition], fontSize: '0.65rem' }} />
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2.5, gap: 1 }}>
          <Button onClick={() => ctx.setReportsDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>Lukk</Button>
          <Button onClick={ctx.handleDownloadGearList} variant="contained" startIcon={<DownloadIcon />}
            sx={{ bgcolor: '#9c27b0', '&:hover': { bgcolor: '#8e24aa' } }}>
            Last ned CSV
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Offline outbox viewer ────────────────────── */}
      <Dialog open={ctx.offlineOutboxOpen} onClose={() => ctx.setOfflineOutboxOpen(false)} maxWidth="sm" fullWidth TransitionComponent={Grow}
        PaperProps={{ sx: { bgcolor: 'rgba(28,33,40,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 1 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, background: 'linear-gradient(135deg, #f44336, #b71c1c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <OfflineIcon sx={{ color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>Offline-kø</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>{offlineQueueCount} operasjon(er) venter</Typography>
          </Box>
          <IconButton onClick={() => ctx.setOfflineOutboxOpen(false)} sx={{ ml: 'auto', color: 'rgba(255,255,255,0.6)' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {ctx.offlineQueue.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircleIcon sx={{ fontSize: 40, color: '#4caf50', mb: 1 }} />
              <Typography sx={{ color: '#4caf50' }}>Ingen ventende operasjoner</Typography>
            </Box>
          ) : (
            <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
              {ctx.offlineQueue.map(e => (
                <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {e.type === 'checkout' ? <CheckOutIcon sx={{ color: '#2196f3', fontSize: 20 }} /> : <CheckInIcon sx={{ color: '#4caf50', fontSize: 20 }} />}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                      {e.type === 'checkout' ? 'Sjekk ut' : 'Lever inn'} — {e.payload.equipmentId.slice(0, 8)}…
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                      {new Date(e.ts).toLocaleString('nb-NO')}
                    </Typography>
                  </Box>
                  <Chip label="Venter" size="small" sx={{ bgcolor: 'rgba(147,51,234,0.15)', color: '#c084fc' }} />
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2.5, gap: 1 }}>
          <Button onClick={() => { ctx.persistOfflineQueue([]); ctx.setOfflineOutboxOpen(false); }} sx={{ color: '#f44336' }}>Slett kø</Button>
          <Button onClick={() => ctx.setOfflineOutboxOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>Lukk</Button>
          <Button onClick={ctx.handleSyncOfflineQueue} variant="contained" startIcon={<SyncIcon />} disabled={!ctx.isOnline}
            sx={{ bgcolor: '#2196f3', '&:hover': { bgcolor: '#1e88e5' } }}>
            Synkroniser nå
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default EquipmentPanelDialogs;
