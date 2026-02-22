/**
 * CreatorHub Norge - Create Package Modal
 * Modal for creating and editing standard packages
 */

import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
import { useClientServicePricing } from '../../services/ClientServicePricingService';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  MenuItem,
  FormControlLabel,
  Switch,
  Chip,
  Alert,
  InputAdornment,
  Divider,
} from '@mui/material';
import Grid2 from '@mui/material/Grid2';
import {
  LocalOffer as PackageIcon,
  PhotoCamera as PhotoIcon,
  Videocam as VideoIcon,
  Edit as EditIcon,
  Print as PrintIcon,
} from '@mui/icons-material';

interface CreatePackageModalProps {
  open: boolean;
  onClose: () => void;
  editData?: any;
  categories: any[];
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

const CreatePackageModal: React.FC<CreatePackageModalProps> = ({
  open,
  onClose,
  editData,
  categories,
  profession = 'photographer'
}) => {
  const [formData, setFormData] = useState({
    name:  ',',
    category: 'bryllup',
    description: '',
    basePrice: '',
    currency: 'NO',
    inclusions: {
      hours: 4,
      images:  50,
      videos:  0,
      editing: true,
      prints:  0,
      albums:  0,
      deliveryDays: 14 },
    serviceTypes: {
      foto: true,
      video: false,
      redigering: true,
      utskrifter: false,
      drone: false
},
    isActive: true
});

  const queryClient = useQueryClient();
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);

  // Client service pricing service integration
  const { 
    formatCurrency,
    getDefaultPrice,
    getMVA,
    getTotalWithMVA,
    isLoading: pricingLoading 
} = useClientServicePricing();

  useEffect(() => {
    if (editData) {
      setFormData({
        name: editData.name ||',',
        category: editData.category || 'bryllup',
        description: editData.description ||'',
        basePrice: editData.basePrice ||'',
        currency: editData.currency || 'NO',
        inclusions: editData.inclusions || {
          hours: 4,
          images:  50,
          videos:  0,
          editing: true,
          prints:  0,
          albums:  0,
          deliveryDays: 14 },
        serviceTypes: editData.serviceTypes || {
          foto: true,
          video: false,
          redigering: true,
          utskrifter: false,
          drone: false
    },
        isActive: editData.isActive !== false
  });
  }
}, [editData]);

  const createPackageMutation = useMutation({
    mutationFn: async (packageData: any) => {
      const url = editData 
        ? `/api/pricing/packages/${editData.id}`
        : '/api/pricing/packages';
      
      const response = await fetch(url, {
        method: editData ? 'PUT' : 'POS',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify(packageData),
    });
      
      if (!response.ok) throw new Error('Failed to save package');
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/packages'] });
      handleClose();
  },
});

  const handleClose = () => {
    setFormData({
      name: ', ',
      category: 'bryllup',
      description: ', ',
      basePrice: ', ',
      currency: 'NO',
      inclusions: {
        hours: 4,
        images:  50,
        videos:  0,
        editing: true,
        prints:  0,
        albums:  0,
        deliveryDays: 14 },
      serviceTypes: {
        foto: true,
        video: false,
        redigering: true,
        utskrifter: false,
        drone: false
  },
      isActive: true
});
    onClose();
};

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.basePrice) return;

    const packageData = {
      ...formData,
      basePrice: parseFloat(formData.basePrice).toString()
};

    createPackageMutation.mutate(packageData);
};

  const handleInclusionChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      inclusions: {
        ...prev.inclusions,
        [field]: value
    }
  }));
};

  const handleServiceTypeChange = (service: string, enabled: boolean) => {
    setFormData(prev => ({
      ...prev,
      serviceTypes: {
        ...prev.serviceTypes,
        [service]: enabled
    }
  }));
};

  const getCategoryName = (category: string) => {
    const found = categories.find(c => c.category === category);
    return found ? found.name : category;
};

  // Suggest default pricing based on category
  const suggestDefaultPricing = async (category: string) => {
    try {
      // Map category to profession for pricing suggestions
      const categoryToProfession: Record<string, string> = {
        'bryllup':'photographer','portrett':'photographer','familie':'photographer','barn':'photographer','bedrift':'photographer','event':'photographer', 'video':'videographer', 'musikk' : 'music_producer'
    };

      const profession = categoryToProfession[category] || 'photographer';
      const defaultPrice = await getDefaultPrice(profession);
      
      if (defaultPrice && defaultPrice > 0) {
        setFormData(prev => ({
          ...prev,
          basePrice: defaultPrice.toString()
      }));
    }
  } catch (error) {
      console.warn('Could not fetch default pricing: ', error);
  }
};

  // Format price using centralized service
  const formatPrice = (price: number | string) => {
    try {
      const numPrice = typeof price === 'string' ? parseFloat(price) : price;
      if (isNaN(numPrice)) return '0 NOK';
      return formatCurrency(numPrice, 'NOK');
  } catch (error) {
      // Fallback formatting
      const numPrice = typeof price === 'string' ? parseFloat(price) : price;
      if (isNaN(numPrice)) return '0 NOK';
      return `${numPrice.toLocaleString('nb-NO')} NOK`;
  }
};

  return (
    <Dialog 
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '90vh'
    }
    }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
          <PackageIcon color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            {editData ? 'Rediger pakke' : 'Opprett ny standardpakke'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Grid2 container spacing={3}>
          {/* Basic Information */}
          <Grid2 size={{ xs: 12 }}>
            <Typography variant="h6" color="primary" gutterBottom sx={{ color: theming.colors.primary }}>
              Grunnleggende informasjon
            </Typography>
          </Grid2>

          <Grid2 size={{ xs: 12 }} sm={6}>
            <TextField
              fullWidth
              label="Pakkenavn"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="f.eks. Bryllup Premium, Portrett Basic"
              required
            />
          </Grid2>

          <Grid2 size={{ xs: 12 }} sm={6}>
            <TextField
              fullWidth
              select
              label="Kategori"
              value={formData.category}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, category: e.target.value }));
                // Suggest default pricing when category changes
                if (e.target.value && !editData) {
                  suggestDefaultPricing(e.target.value);
              }
            }}
              required
              helperText={categories.length === 0 ? "Opprett først en kategori i 'Kategorier' fanen" : ""}
            >
              {categories.length === 0 ? (
                <MenuItem disabled value="">
                  Ingen kategorier tilgjengelig - opprett en først
                </MenuItem>
              ) : (
                categories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </MenuItem>
                ))
              )}
            </TextField>
          </Grid2>

          <Grid2 size={{ xs: 12 }} sm={6}>
            <TextField
              fullWidth
              label="Grunnpris"
              type="number"
              value={formData.basePrice}
              onChange={(e) => setFormData(prev => ({ ...prev, basePrice: e.target.value }))}
              InputProps={{
                endAdornment: <InputAdornment position="end">NOK</InputAdornment>}}
              helperText={!editData ? "Velg kategori for å få forslag til pris" : ""}
              required
            />
          </Grid2>

          <Grid2 size={{ xs: 12 }} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                />
            }
              label="Aktiv pakke"
            />
          </Grid2>

          <Grid2 size={{ xs: 12 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Beskrivelse"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Beskriv hva som inkluderes i denne pakken..."
            />
          </Grid2>

          <Grid2 size={{ xs: 12 }}>
            <Divider />
          </Grid2>

          {/* Package Inclusions */}
          <Grid2 size={{ xs: 12 }}>
            <Typography variant="h6" color="primary" gutterBottom sx={{ color: theming.colors.primary }}>
              Pakkeinnhold
            </Typography>
          </Grid2>

          <Grid2 size={{ xs: 12 }} sm={6} md={4}>
            <TextField
              fullWidth
              label="Timer inkludert"
              type="number"
              value={formData.inclusions.hours}
              onChange={(e) => handleInclusionChange('hours', parseInt(e.target.value) || 0)}
              InputProps={{
                endAdornment: <InputAdornment position="end">timer</InputAdornment>}}
            />
          </Grid2>

          <Grid2 size={{ xs: 12 }} sm={6} md={4}>
            <TextField
              fullWidth
              label="Bilder inkludert"
              type="number"
              value={formData.inclusions.images}
              onChange={(e) => handleInclusionChange('images', parseInt(e.target.value) || 0)}
              InputProps={{
                endAdornment: <InputAdornment position="end">bilder</InputAdornment>}}
            />
          </Grid2>

          <Grid2 size={{ xs: 12 }} sm={6} md={4}>
            <TextField
              fullWidth
              label="Videoer inkludert"
              type="number"
              value={formData.inclusions.videos}
              onChange={(e) => handleInclusionChange('videos', parseInt(e.target.value) || 0)}
              InputProps={{
                endAdornment: <InputAdornment position="end">videoer</InputAdornment>}}
            />
          </Grid2>

          <Grid2 size={{ xs: 12 }} sm={6} md={4}>
            <TextField
              fullWidth
              label="Utskrifter inkludert"
              type="number"
              value={formData.inclusions.prints}
              onChange={(e) => handleInclusionChange('prints', parseInt(e.target.value) || 0)}
              InputProps={{
                endAdornment: <InputAdornment position="end">utskrifter</InputAdornment>}}
            />
          </Grid2>

          <Grid2 size={{ xs: 12 }} sm={6} md={4}>
            <TextField
              fullWidth
              label="Album inkludert"
              type="number"
              value={formData.inclusions.albums}
              onChange={(e) => handleInclusionChange('albums', parseInt(e.target.value) || 0)}
              InputProps={{
                endAdornment: <InputAdornment position="end">album</InputAdornment>}}
            />
          </Grid2>

          <Grid2 size={{ xs: 12 }} sm={6} md={4}>
            <TextField
              fullWidth
              label="Leveringstid"
              type="number"
              value={formData.inclusions.deliveryDays}
              onChange={(e) => handleInclusionChange('deliveryDays', parseInt(e.target.value) || 0)}
              InputProps={{
                endAdornment: <InputAdornment position="end">dager</InputAdornment>}}
            />
          </Grid2>

          <Grid2 size={{ xs: 12 }}>
            <Divider />
          </Grid2>

          {/* Service Types */}
          <Grid2 size={{ xs: 12 }}>
            <Typography variant="h6" color="primary" gutterBottom sx={{ color: theming.colors.primary }}>
              Tjenester inkludert
            </Typography>
          </Grid2>

          <Grid2 size={{ xs: 12 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.serviceTypes.foto}
                    onChange={(e) => handleServiceTypeChange('foto', e.target.checked)}
                    icon={<PhotoIcon />}
                    checkedIcon={<PhotoIcon />}
                  />
              }
                label="Fotografering"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.serviceTypes.video}
                    onChange={(e) => handleServiceTypeChange('video', e.target.checked)}
                    icon={<VideoIcon />}
                    checkedIcon={<VideoIcon />}
                  />
              }
                label="Videografering"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.serviceTypes.redigering}
                    onChange={(e) => handleServiceTypeChange('redigering', e.target.checked)}
                    icon={<EditIcon />}
                    checkedIcon={<EditIcon />}
                  />
              }
                label="Redigering"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.serviceTypes.utskrifter}
                    onChange={(e) => handleServiceTypeChange('utskrifter', e.target.checked)}
                    icon={<PrintIcon />}
                    checkedIcon={<PrintIcon />}
                  />
              }
                label="Utskrifter"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.serviceTypes.drone}
                    onChange={(e) => handleServiceTypeChange('drone', e.target.checked)}
                  />
              }
                label="Dronefotografering"
              />
            </Box>
          </Grid2>

          {/* Additional Options */}
          <Grid2 size={{ xs: 12 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.inclusions.editing}
                  onChange={(e) => handleInclusionChange('editing', e.target.checked)}
                />
            }
              label="Redigering inkludert i prisen"
            />
          </Grid2>
        </Grid2>

        {/* Preview */}
        <Box sx={{ mt:  3, p: 2, bgcolor: 'grey.5', borderRadius:  1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Forhåndsvisning: </Typography>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>{formData.name || 'Pakkenavn'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {formData.description || 'Ingen beskrivelse'}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            <Chip size="small" label={getCategoryName(formData.category)} />
            <Chip size="small" label={`${formData.inclusions.hours} timer`} />
            <Chip size="small" label={`${formData.inclusions.images} bilder`} />
            {formData.inclusions.videos > 0 && (
              <Chip size="small" label={`${formData.inclusions.videos} videoer`} />
            )}
            {formData.inclusions.editing && (
              <Chip size="small" label="Redigering" />
            )}
          </Box>
          <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
            {formatPrice(formData.basePrice)}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          Avbryt
        </Button>
        <Button variant="contained"
          onClick={handleSubmit}
          disabled={!formData.name.trim() || !formData.basePrice || createPackageMutation.isPending}
         sx={theming.getThemedButtonSx()}>
          {createPackageMutation.isPending 
            ? 'Lagrer...' 
            : editData 
              ? 'Oppdater pakke' : 'Opprett pakke'
        }
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreatePackageModal;