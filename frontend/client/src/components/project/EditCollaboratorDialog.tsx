/**
 * CreatorHub Norge - Edit Collaborator Dialog
 * Redigering av samarbeidspartner informasjon
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Edit,
  Save,
  Close,
  ContactPage,
  CloudSync,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import type { ProjectCollaborator } from '@/types/project-collaborator';

interface EditCollaboratorDialogProps {
  open: boolean;
  collaborator: ProjectCollaborator | null;
  onClose: () => void;
  onUpdate: (updatedCollaborator: ProjectCollaborator) => void
}

export default function EditCollaboratorDialog({ 
  open, 
  collaborator, 
  onClose, 
  onUpdate 
}: EditCollaboratorDialogProps): JSX.Element | null {
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  const [formData, setFormData] = useState<ProjectCollaborator>({
    name: '',
    email: '',
    phone: '',
    role: 'photographer',
    isExistingUser: false,
    invitationStatus: 'not_sent',
    addedBy: '',
    addedAt: ''
});
  const [updateGoogleContact, setUpdateGoogleContact] = useState(false);
  const [brregSearchResults, setBrregSearchResults] = useState<any[]>([]);
  const [brregSearchQuery, setBrregSearchQuery] = useState(' ');
  const [isSearchingBrreg, setIsSearchingBrreg] = useState(false);
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  // Oppdater lokale data
  const updateCollaboratorMutation = useMutation({
    mutationFn: async (data: ProjectCollaborator) => {
      return apiRequest(`/api/projects/collaborators/${collaborator?.id}`, {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'PUT',
        body: JSON.stringify(data)
  });
  },
    onSuccess: (result) => {
      console.log('Collaborator updated successfully, :', result);
      onUpdate(result.collaborator);
      queryClient.invalidateQueries({ queryKey: ['/api/projects/collaborators'] });
  }
});

  // Oppdater Google kontakt
  const updateGoogleContactMutation = useMutation({
    mutationFn: async (data: any) => {
      const [firstName, ...lastNameParts] = data.name.split(' ');
      const lastName = lastNameParts.join(' ');
      
      return apiRequest(`/api/google/people/update-contact/${collaborator?.googleContactId}`, {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'PUT',
        body: JSON.stringify({
          firstName,
          lastName,
          email: data.email,
          phone: data.phone,
          profession: data.role,
          companyName: data.companyName,
          notes: data.notes,
          organizationNumber: data.organizationNumber
    })
    });
  },
    onSuccess: () => {
      console.log('Google contact updated successfully');
    }
  });

  // Initialiser form data når collaborator endres
  useEffect(() => {
    if (collaborator) {
      setFormData({
        ...collaborator
    });
      setUpdateGoogleContact(!!collaborator.googleContactId);
  }
}, [collaborator]);

  const handleInputChange = (field: keyof ProjectCollaborator, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
  }));
};

  // Søk i Brreg når bedriftsnavn endres
  const searchBrregCompanies = async (query: string) => {
    if (query.length < 2) {
      setBrregSearchResults([]);
      return;
}

    setIsSearchingBrreg(true);
    try {
      const response = await apiRequest(`/api/brreg/search?q=${encodeURIComponent(query)}&size=5`);
      setBrregSearchResults(response.data?.businesses || []);
  } catch (error) {
      console.error('Brreg search failed: ', error);
      setBrregSearchResults([]);
  } finally {
      setIsSearchingBrreg(false);
  }
};

  // Håndter valg av bedrift fra Brreg
  const handleSelectBrregCompany = (company: any) => {
    setFormData(prev => ({
      ...prev,
      companyName: company.name,
      organizationNumber: company.orgNumber
}));
    setBrregSearchResults([]);
    setBrregSearchQuery('');
};

  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      return;
  }

    try {
      // Oppdater lokal samarbeidspartner data
      await updateCollaboratorMutation.mutateAsync(formData);

      // Oppdater Google kontakt hvis ønsket og tilgjengelig
      if (updateGoogleContact && collaborator?.googleContactId) {
        try {
          await updateGoogleContactMutation.mutateAsync(formData);
      } catch (googleError) {
          console.error('Failed to update Google contact:', googleError);
          // Fortsett selv om Google oppdatering feiler
      }
    }

      onClose();
  } catch (error) {
      console.error('Failed to update collaborator:', error);
  }
};

  const getRoleName = (role: string) => {
    const roleNames = {
      photographer: getProfessionDisplayName('photographer'),
      videographer: getProfessionDisplayName('videographer'),
      music_producer: getProfessionDisplayName('music_producer'),
      assistant: 'Assistent',
      coordinator: 'Koordinator',
      vendor: getProfessionDisplayName('vendor')
};
    return roleNames[role as keyof typeof roleNames] || role;
};

  if (!collaborator) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <Edit color="primary" />
          <Box>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Rediger Samarbeidspartner
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Oppdater kontaktinformasjon og detaljer
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {collaborator.source && (
          <Alert severity="info" sx={{ mb:  3 }}>
            <Box display="flex" alignItems="center" gap={1}>
              {collaborator.source === 'google_contacts' && <ContactPage />}
              <Typography variant="body2">
                {collaborator.source === 'creatorhub' && 'CreatorHub Norge bruker'}
                {collaborator.source === 'google_contacts' && 'Fra Google kontakter'}
                {collaborator.source === 'manual' && 'Manuelt lagt til'}
              </Typography>
            </Box>
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }} sm={6}>
            <TextField
              fullWidth
              label="Navn"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
            />
          </Grid>
          <Grid size={{ xs: 12 }} sm={6}>
            <TextField
              fullWidth
              label="E-post"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
            />
          </Grid>
          <Grid size={{ xs: 12 }} sm={6}>
            <TextField
              fullWidth
              label="Telefon"
              value={formData.phone || ''}
              onChange={(e) => handleInputChange('phone', e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12 }} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Rolle</InputLabel>
              <Select
                value={formData.role}
                label="Rolle"
                onChange={(e) => handleInputChange('role', e.target.value)}
              >
                <MenuItem value="photographer">{getProfessionDisplayName('photographer')}</MenuItem>
                <MenuItem value="videographer">{getProfessionDisplayName('videographer')}</MenuItem>
                <MenuItem value="music_producer">{getProfessionDisplayName('music_producer')}</MenuItem>
                <MenuItem value="assistant">Assistent</MenuItem>
                <MenuItem value="coordinator">Koordinator</MenuItem>
                <MenuItem value="vendor">Leverandør</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12 }} sm={6}>
            <TextField
              fullWidth
              label="Bedriftsnavn"
              value={formData.companyName || ''}
              onChange={(e) => {
                handleInputChange('companyName', e.target.value);
                setBrregSearchQuery(e.target.value);
                searchBrregCompanies(e.target.value);
            }}
              helperText="Start å skrive for å søke i Brønnøysundregistrene"
            />
            {brregSearchResults.length > 0 && (
              <Box sx={{ mt: 1, maxHeight: 200, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                {brregSearchResults.map((company, index) => (
                  <Box
                    key={index}
                    sx={{ 
                      p: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover',},
                      borderBottom: index < brregSearchResults.length - 1 ? 1 : 0,
                      borderColor: 'divider'
                }}
                    onClick={() => handleSelectBrregCompany(company)}
                  >
                    <Typography variant="body2" fontWeight="medium">
                      {company.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Org.nr: {company.orgNumber} • {company.businessAddress?.city || 'Ukjent sted'}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Grid>
          <Grid size={{ xs: 12 }} sm={6}>
            <TextField
              fullWidth
              label="Organisasjonsnummer"
              value={formData.organizationNumber || ''}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, ''); // Kun tall
                if (value.length <= 9) {
                  handleInputChange('organizationNumber', value);
              }
            }}
              inputProps={{ 
                maxLength:  9,
                pattern: '[0-9]*'
          }}
              helperText="9 siffer (automatisk fylt fra bedriftssøk)"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Notater"
              multiline
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Tilleggsinfo om samarbeidspartneren..."
            />
          </Grid>

          {collaborator.googleContactId && (
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={updateGoogleContact}
                    onChange={(e) => setUpdateGoogleContact(e.target.checked)}
                    color="primary"
                  />
              }
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <CloudSync />
                    <Typography>
                      Oppdater også i Google kontakter
                    </Typography>
                  </Box>
              }
              />
              <Typography variant="body2" color="text.secondary" sx={{ ml:  4 }}>
                Endringer synkroniseres automatisk med din Google kontaktliste
              </Typography>
            </Grid>
          )}
        </Grid>

        {(updateCollaboratorMutation.isPending || updateGoogleContactMutation.isPending) && (
          <Alert severity="info" sx={{ mt:  2 }}>
            <Typography>Oppdaterer kontaktinformasjon...</Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} startIcon={theming.getThemedIcon('close')}>
          Avbryt
        </Button>
        <Button variant="contained"
          onClick={handleSave}
          disabled={
            !formData.name || 
            !formData.email || 
            updateCollaboratorMutation.isPending ||
            updateGoogleContactMutation.isPending
        }
          startIcon={theming.getThemedIcon('save')}
         sx={theming.getThemedButtonSx()}>
          Lagre endringer
        </Button>
      </DialogActions>
    </Dialog>
  );
}