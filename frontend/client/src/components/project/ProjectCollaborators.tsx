/**
 * CreatorHub Norge - Project Collaborators & Invitations
 * Inviter eksterne personer til prosjekter med søk i eksisterende brukere
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import EditCollaboratorDialog from './EditCollaboratorDialog';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import {
  Box,
  Typography,
  Button,
  TextField,
  Autocomplete,
  Chip,
  Avatar,
  List,
  Tabs,
  Tab,
  Snackbar,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Grid,
  Paper,
  CircularProgress,
} from '@mui/material';
import {
  PersonAdd,
  Search,
  Send,
  Group,
  CameraAlt,
  MusicNote,
  ContactPage,
} from '@mui/icons-material';
import type { ProjectCollaborator } from '@/types/project-collaborator';

interface ExistingUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profession: string;
  profileImageUrl?: string;
  businessName?: string;
}

interface ProjectCollaboratorsProps {
  projectData: any;
  onCollaboratorsChange: (collaborators: ProjectCollaborator[]) => void;
  currentUserProfession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise'
}

export default function ProjectCollaborators({
  projectData,
  onCollaboratorsChange,
  currentUserProfession
}: ProjectCollaboratorsProps) {
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  const [collaborators, setCollaborators] = useState<ProjectCollaborator[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<ExistingUser | null>(null);
  const [manualEntry, setManualEntry] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'photographer' as ProjectCollaborator['role']
});
  const [isManualMode, setIsManualMode] = useState(false);
  const [searchMode, setSearchMode] = useState(0); // 0 = CreatorHub, 1 = Google Contacts
  const [_googleContacts, _setGoogleContacts] = useState<any[]>([]);
  const [_isLoadingGoogleContacts, _setIsLoadingGoogleContacts] = useState(false);
  const [showGoogleAuthSnackbar, setShowGoogleAuthSnackbar] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<ProjectCollaborator | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [pendingGoogleSaveData, setPendingGoogleSaveData] = useState<{ firstName: string; lastName: string; email: string; phone?: string; role: string } | null>(null);

  const handleEditCollaborator = (collaborator: ProjectCollaborator) => {
    setEditingCollaborator(collaborator);
    setShowEditDialog(true);
};

  const handleUpdateCollaborator = (updatedCollaborator: ProjectCollaborator) => {
    setCollaborators(prev => 
      prev.map(c => c.id === updatedCollaborator.id ? updatedCollaborator : c)
    );
};

  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming(currentUserProfession || 'photographer');

  // Søk i eksisterende brukere (CreatorHub Norge)
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['/api/users/search', searchQuery],
    enabled: searchQuery.length >= 2 && !isManualMode && searchMode === 0,
    queryFn: async () => {
      return apiRequest(`/api/users/search?q=${searchQuery}`);
  },
    retry: false
});

  // Søk i Google kontakter
  const { data: googleSearchResults, isLoading: isSearchingGoogle } = useQuery({
    queryKey: ['/api/google/people/search-contacts', searchQuery],
    enabled: searchQuery.length >= 2 && !isManualMode && searchMode === 1,
    queryFn: async () => {
      return apiRequest(`/api/google/people/search-contacts?q=${searchQuery}`);
  },
    retry: false
});

  // Legg til samarbeidspartner
  const _addCollaboratorMutation = useMutation({
    mutationFn: async (collaborator: Omit<ProjectCollaborator, 'id' | 'addedAt'>) => {
      return apiRequest('/api/projects/collaborators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(collaborator)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects/collaborators'] });
    }
  });

  // Send invitasjon
  const sendInvitationMutation = useMutation({
    mutationFn: async (_collaboratorId: string) => {
      return apiRequest(`/api/projects/collaborators/${_collaboratorId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId: projectData?.id || '',
          projectName: projectData?.projectName || '',
          clientName: projectData?.clientName || ''
        })
      });
    }
  });

  // Lagre kontakt i Google People
  const saveToGoogleContactsMutation = useMutation({
    mutationFn: async (contactData: any) => {
      return apiRequest('/api/google/people/create-contact', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify({
          firstName: contactData.firstName,
          lastName: contactData.lastName,
          email: contactData.email,
          phone: contactData.phone,
          profession: contactData.role,
          companyName: contactData.companyName,
          notes: `Samarbeidspartner fra CreatorHub Norge, prosjekt: ${projectData.projectName}`
      })
    });
  }
});

  // Oppdater collaborators når de endres
  useEffect(() => {
    onCollaboratorsChange(collaborators);
}, [collaborators, onCollaboratorsChange]);

  const handleAddExistingUser = () => {
    if (!selectedUser) return;

    const newCollaborator: ProjectCollaborator = {
      name: `${selectedUser.firstName} ${selectedUser.lastName}`,
      email: selectedUser.email,
      role: selectedUser.profession as ProjectCollaborator['role'],
      isExistingUser: true,
      userId: selectedUser.id,
      profileImageUrl: selectedUser.profileImageUrl,
      invitationStatus: 'not_sent',
      addedBy: user?.id || 'current-user',
      addedAt: new Date().toISOString()
};

    setCollaborators(prev => [...prev, newCollaborator]);
    setSelectedUser(null);
    setSearchQuery('');
    setShowAddDialog(false);
};

  const handleAddManualEntry = async () => {
    if (!manualEntry.name || !manualEntry.email) return;

    const [firstName, ...lastNameParts] = manualEntry.name.split(' ');
    const lastName = lastNameParts.join(' ');

    const newCollaborator: ProjectCollaborator = {
      name: manualEntry.name,
      email: manualEntry.email,
      phone: manualEntry.phone,
      role: manualEntry.role,
      isExistingUser: false,
      invitationStatus: 'not_sent',
      addedBy: user?.id || 'current-user',
      addedAt: new Date().toISOString()
};

    setCollaborators(prev => [...prev, newCollaborator]);

    // Lagre data for eventuell Google-lagring og vis dialogboks
    setPendingGoogleSaveData({
      firstName,
      lastName,
      email: manualEntry.email,
      phone: manualEntry.phone,
      role: manualEntry.role
    });

    setManualEntry({ name: '', email: '', phone: '', role: 'photographer',});
    setIsManualMode(false);
    setShowAddDialog(false);
  };

  const handleSaveToGoogle = async () => {
    if (!pendingGoogleSaveData) return;
    try {
      await saveToGoogleContactsMutation.mutateAsync({
        firstName: pendingGoogleSaveData.firstName,
        lastName: pendingGoogleSaveData.lastName,
        email: pendingGoogleSaveData.email,
        phone: pendingGoogleSaveData.phone,
        role: pendingGoogleSaveData.role,
        companyName: ''
      });
    } catch (error) {
      console.error('Failed to save to Google contacts: ', error);
    }
    setPendingGoogleSaveData(null);
  };

  const handleAddGoogleContact = () => {
    if (!selectedUser) return;

    const newCollaborator: ProjectCollaborator = {
      name: `${selectedUser.firstName} ${selectedUser.lastName}`,
      email: selectedUser.email,
      phone: selectedUser.businessName,
      role: selectedUser.profession as ProjectCollaborator['role'] || 'assistant',
      isExistingUser: false,
      invitationStatus: 'not_sent',
      addedBy: user?.id || 'current-user',
      addedAt: new Date().toISOString()
};

    setCollaborators(prev => [...prev, newCollaborator]);
    setSelectedUser(null);
    setSearchQuery('');
    setShowAddDialog(false);
};

  const handleRemoveCollaborator = (index: number) => {
    setCollaborators(prev => prev.filter((_, i) => i !== index));
};

  const handleSendInvitation = async (collaborator: ProjectCollaborator, index: number) => {
    try {
      await sendInvitationMutation.mutateAsync(collaborator.id || '');
      
      setCollaborators(prev => prev.map((collab, i) => 
        i === index 
          ? { ...collab, invitationStatus: 'pending',}
          : collab
      ));
  } catch (error) {
      console.error('Failed to send invitation:', error);
  }
};

  const getRoleIcon = (role: string) => {
    const roleType = role as 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'client' | 'assistant' | 'coordinator';
    switch (roleType) {
      case 'photographer': return <CameraAlt />;
      case 'videographer': return theming.getThemedIcon('videocam');
      case 'music_producer': return <MusicNote />;
      case 'vendor': return theming.getThemedIcon('store');
      case 'client': return theming.getThemedIcon('business');
      default: return theming.getThemedIcon('group');
  }
};

  const getRoleColor = (role: ProjectCollaborator['role']) => {
    const roleType = role as 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'client' | 'assistant' | 'coordinator';
    switch (roleType) {
      case 'photographer': return 'primary';
      case 'videographer': return 'secondary';
      case 'music_producer': return 'success';
      case 'vendor': return 'warning';
      case 'client': return 'info';
      default: return 'default';
}
};

  const getRoleName = (role: string) => {
    const roleType = role as 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'client' | 'assistant' | 'coordinator';
    const roleNames: Record<string, string> = {
      photographer: getProfessionDisplayName('photographer'),
      videographer: getProfessionDisplayName('videographer'),
      music_producer: getProfessionDisplayName('music_producer'),
      vendor: getProfessionDisplayName('vendor'),
      client: 'Klient',
      assistant: 'Assistent',
      coordinator: 'Koordinator'
};
    return roleNames[roleType] || roleType;
};

  const getInvitationStatusColor = (status: ProjectCollaborator['invitationStatus']) => {
    switch (status) {
      case 'accepted': return 'success';
      case 'pending': return 'warning';
      case 'declined': return 'error';
      default: return 'default';
}
};

  const getInvitationStatusText = (status: ProjectCollaborator['invitationStatus']) => {
    switch (status) {
      case 'accepted': return 'Godtatt';
      case 'pending': return 'Venter';
      case 'declined': return 'Avslått';
      default: return 'Ikke sendt';
}
};

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
          Samarbeidspartnere og invitasjoner
        </Typography>
        <Button variant="contained"
          startIcon={<PersonAdd />}
          onClick={() => setShowAddDialog(true)}
        >
          Inviter person
        </Button>
      </Box>

      {collaborators.length === 0 ? (
        <Alert severity="info">
          <Typography variant="body2">
            Ingen samarbeidspartnere lagt til ennå. Inviter andre {getProfessionDisplayName('photographer').toLowerCase()}er, {getProfessionDisplayName('videographer').toLowerCase()}er, 
            {getProfessionDisplayName('vendor').toLowerCase()}er eller koordinatorer for å samarbeide om prosjektet.
          </Typography>
        </Alert>
      ) : (
        <List>
          {collaborators.map((collaborator, index) => (
            <ListItem key={index} divider>
              <ListItemAvatar>
                <Avatar 
                  src={collaborator.profileImageUrl}
                  sx={{ bgcolor: `${getRoleColor(collaborator.role)}.main` }}
                >
                  {getRoleIcon(collaborator.role)}
                </Avatar>
              </ListItemAvatar>
              
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {collaborator.name}
                    </Typography>
                    <Chip 
                      label={getRoleName(collaborator.role)}
                      size="small"
                      color={getRoleColor(collaborator.role) as any}
                      variant="outlined"
                    />
                    {collaborator.isExistingUser && (
                      <Chip 
                        label="CreatorHub bruker"
                        size="small"
                        color="success"
                        variant="filled"
                      />
                    )}
                  </Box>
              }
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      📧 {collaborator.email}
                    </Typography>
                    {collaborator.phone && (
                      <Typography variant="body2" color="text.secondary">
                        📞 {collaborator.phone}
                      </Typography>
                    )}
                    <Box display="flex" alignItems="center" gap={1} mt={1}>
                      <Chip 
                        label={getInvitationStatusText(collaborator.invitationStatus)}
                        size="small"
                        color={getInvitationStatusColor(collaborator.invitationStatus) as any}
                        variant="outlined"
                      />
                      <Typography variant="caption" color="text.secondary">
                        Lagt til {new Date(collaborator.addedAt).toLocaleDateString('nb-NO')}
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={theming.getThemedIcon('edit')}
                        onClick={() => handleEditCollaborator(collaborator)}
                        sx={{ ml:  1 }}
                      >
                        Rediger
                      </Button>
                    </Box>
                  </Box>
              }
              />
              
              <ListItemSecondaryAction>
                <Box display="flex" gap={1}>
                  {collaborator.invitationStatus === 'not_sent' && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Send />}
                      onClick={() => handleSendInvitation(collaborator, index)}
                      disabled={sendInvitationMutation.isPending}
                    >
                      Send invitasjon
                    </Button>
                  )}
                  <IconButton
                    edge="end"
                    onClick={() => handleRemoveCollaborator(index)}
                    color="error"
                  >
                    {theming.getThemedIcon('delete')}
                  </IconButton>
                </Box>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}

      {/* Add Collaborator Dialog */}
      <Dialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={2}>
            <PersonAdd />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Inviter samarbeidspartner
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Box sx={{ mb:  3 }}>
            <Button
              variant={isManualMode ? 'outlined' : 'contained'}
              onClick={() => setIsManualMode(false)}
              sx={{ mr:  1 }}
            >
              Søk brukere
            </Button>
            <Button
              variant={isManualMode ? 'contained' : 'outlined'}
              onClick={() => setIsManualMode(true)}
            >
              Legg til manuelt
            </Button>
          </Box>

          {!isManualMode ? (
            <Box>
              <Tabs 
                value={searchMode}
                onChange={(_, newValue) => setSearchMode(newValue)}
                sx={{ mb:  2 }}
              >
              <Tab 
                icon={<Group />}
                label="CreatorHub Norge" 
                iconPosition="start"
              />
                <Tab 
                  icon={<ContactPage />}
                  label="Google kontakter" 
                  iconPosition="start"
                />
              </Tabs>

              {searchMode === 0 ? (
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Søk i CreatorHub Norge
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                    Finn eksisterende brukere som allerede er registrert i CreatorHub Norge
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Søk i Google kontakter
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                    Finn kontakter fra din Google kontaktliste
                  </Typography>
                  <Alert severity="info" sx={{ mb:  2 }}>
                    <Typography variant="body2">
                      🔄 Google kontakter krever utvidet OAuth tilgang. 
                      <Button 
                        size="small" 
                        onClick={() => setShowGoogleAuthSnackbar(true)}
                        sx={{ ml:  1 }}
                      >
                        Aktiver nå
                      </Button>
                    </Typography>
                  </Alert>
                </Box>
              )}
              
              <Autocomplete<ExistingUser>
                options={searchMode === 0 ? (searchResults || []) : (googleSearchResults || [])}
                getOptionLabel={(option: ExistingUser) => 
                  searchMode === 0 
                    ? `${option.firstName} ${option.lastName} (${option.email})`
                    : `${option.businessName || option.firstName + ' ' + option.lastName} (${option.email})`
              }
                renderOption={(props, option: ExistingUser) => (
                  <Box component="li" {...props}>
                    <Avatar 
                      src={option.profileImageUrl}
                      sx={{ mr: 2, width:  32, height: 32}}
                    >
                      {searchMode === 0 
                        ? getRoleIcon(option.profession)
                        : <ContactPage />
                    }
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2">
                        {searchMode === 0 
                          ? `${option.firstName} ${option.lastName}`
                          : `${option.firstName} ${option.lastName}`
                      }
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {option.email} • {searchMode === 0 
                          ? getRoleName(option.profession)
                          : getRoleName(option.profession)
                      }
                      </Typography>
                      {option.businessName && (
                        <Typography variant="caption" color="text.secondary">
                          {option.businessName}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
                loading={searchMode === 0 ? isSearching : isSearchingGoogle}
                onInputChange={(_, value) => setSearchQuery(value)}
                onChange={(_, value: ExistingUser | null) => setSelectedUser(value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={searchMode === 0 ? "Søk etter navn eller e-post" : "Søk i Google kontakter"}
                    variant="outlined"
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: <Search sx={{ mr: 1, color: 'text.secondary'}} />,
                      endAdornment: (
                        <>
                          {(isSearching || isSearchingGoogle) ? <CircularProgress size={0} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      )}}
                  />
                )}
              />

              {selectedUser && (
                <Paper elevation={1} sx={{ p: 2, mt: 2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Valgt {searchMode === 0 ? 'bruker': 'kontakt'}:
                  </Typography>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar src={selectedUser.profileImageUrl}>
                      {searchMode === 0 
                        ? getRoleIcon(selectedUser.profession)
                        : <ContactPage />
                    }
                    </Avatar>
                    <Box>
                      <Typography variant="body1">
                        {searchMode === 0 
                          ? `${selectedUser.firstName} ${selectedUser.lastName}`
                          : `${selectedUser.firstName} ${selectedUser.lastName}`
                      }
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedUser.email} • {getRoleName(selectedUser.profession)}
                      </Typography>
                      {searchMode === 1 && (
                        <Chip 
                          label="Fra Google kontakter"
                          size="small"
                          color="info"
                          icon={<ContactPage />}
                        />
                      )}
                    </Box>
                  </Box>
                </Paper>
              )}
            </Box>
          ) : (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Legg til ekstern person
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                For personer som ikke finnes i CreatorHub Norge eller Google kontakter
              </Typography>
              
              <Alert severity="info" sx={{ mb:  2 }}>
                💾 Du kan velge å lagre nye kontakter i Google kontakter for fremtidig bruk
              </Alert>
              
              <Grid container spacing={2}>
                <Grid xs={12}>
                  <TextField
                    fullWidth
                    label="Fullt navn"
                    value={manualEntry.name}
                    onChange={(e) => setManualEntry(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </Grid>
                <Grid xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="E-post"
                    type="email"
                    value={manualEntry.email}
                    onChange={(e) => setManualEntry(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </Grid>
                <Grid xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Telefon"
                    value={manualEntry.phone}
                    onChange={(e) => setManualEntry(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </Grid>
                <Grid xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Rolle i prosjektet</InputLabel>
                    <Select
                      value={manualEntry.role}
                      onChange={(e) => setManualEntry(prev => ({ ...prev, role: e.target.value as ProjectCollaborator['role'] }))}
                      label="Rolle i prosjektet"
                    >
                      <MenuItem value="photographer">
                        <Box display="flex" alignItems="center" gap={1}>
                          <CameraAlt /> {getProfessionDisplayName('photographer')}
                        </Box>
                      </MenuItem>
                      <MenuItem value="videographer">
                        <Box display="flex" alignItems="center" gap={1}>
                          {theming.getThemedIcon('videocam')} {getProfessionDisplayName('videographer')}
                        </Box>
                      </MenuItem>
                      <MenuItem value="music_producer">
                        <Box display="flex" alignItems="center" gap={1}>
                          <MusicNote /> {getProfessionDisplayName('music_producer')}
                        </Box>
                      </MenuItem>
                      <MenuItem value="vendor">
                        <Box display="flex" alignItems="center" gap={1}>
                          {theming.getThemedIcon('store')} Leverandør
                        </Box>
                      </MenuItem>
                      <MenuItem value="assistant">
                        <Box display="flex" alignItems="center" gap={1}>
                          {theming.getThemedIcon('group')} Assistent
                        </Box>
                      </MenuItem>
                      <MenuItem value="coordinator">
                        <Box display="flex" alignItems="center" gap={1}>
                          {theming.getThemedIcon('business')} Koordinator
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>
            Avbryt
          </Button>
          <Button variant="contained"
            onClick={
              isManualMode 
                ? handleAddManualEntry 
                : searchMode === 0 
                  ? handleAddExistingUser 
                  : handleAddGoogleContact
          }
            disabled={
              isManualMode 
                ? !manualEntry.name || !manualEntry.email
                : !selectedUser
          }
            startIcon={<PersonAdd />}
          >
            Legg til
          </Button>
        </DialogActions>
      </Dialog>

      {/* Google Auth Snackbar */}
      <Snackbar
        open={showGoogleAuthSnackbar}
        autoHideDuration={6000}
        onClose={() => setShowGoogleAuthSnackbar(false)}
        message="Google kontakter integrasjon er konfigurert i systemet. Kontakt administrator for aktivering."
        action={
          <Button 
            color="inherit" 
            size="small" 
            onClick={() => setShowGoogleAuthSnackbar(false)}
          >
            Lukk
          </Button>
      }
      />

      {/* Edit Collaborator Dialog */}
      <EditCollaboratorDialog
        open={showEditDialog}
        collaborator={editingCollaborator}
        onClose={() => {
          setShowEditDialog(false);
          setEditingCollaborator(null);
      }}
        onUpdate={handleUpdateCollaborator}
      />

      {/* Save to Google Contacts Dialog */}
      <Dialog open={!!pendingGoogleSaveData} onClose={() => setPendingGoogleSaveData(null)}>
        <DialogTitle>Lagre i Google Kontakter</DialogTitle>
        <DialogContent>
          <Typography>
            Vil du lagre {pendingGoogleSaveData?.firstName} {pendingGoogleSaveData?.lastName} i Google kontakter for fremtidig bruk?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingGoogleSaveData(null)}>Nei takk</Button>
          <Button onClick={handleSaveToGoogle} variant="contained" color="primary">
            Ja, lagre
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}