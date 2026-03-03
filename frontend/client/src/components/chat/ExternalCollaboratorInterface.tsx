import React, { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { ChipProps } from '@mui/material';
import {
  BusinessCenter,
  CalendarToday,
  Email,
  Group,
  PersonAdd,
  Delete,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useDemoMode } from '../../contexts/DemoModeContext';
import { useTheming } from '../../utils/theming-helper';

interface ExternalCollaborator {
  id: string;
  name: string;
  email: string;
  role: string;
  company?: string;
  phone?: string;
  status: 'active' | 'pending' | 'inactive';
  invitedAt: string;
  lastActive?: string;
  projects: string[];
  permissions: string[];
}

interface ExternalCollaboratorInterfaceProps {
  projectId?: string;
  profession?: string;
}

interface NewCollaboratorInput {
  name: string;
  email: string;
  role: string;
  company: string;
  phone: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const normalizeCollaborator = (value: unknown): ExternalCollaborator | null => {
  if (!isObject(value)) return null;

  const id = asString(value.id);
  const name = asString(value.name);
  const email = asString(value.email);

  if (!id || !name || !email) return null;

  const statusRaw = asString(value.status);
  const status: ExternalCollaborator['status'] =
    statusRaw === 'active' || statusRaw === 'pending' || statusRaw === 'inactive'
      ? statusRaw
      : 'pending';

  const projects = Array.isArray(value.projects)
    ? value.projects.map((project) => asString(project)).filter((project) => project.length > 0)
    : [];

  const permissions = Array.isArray(value.permissions)
    ? value.permissions
        .map((permission) => asString(permission))
        .filter((permission) => permission.length > 0)
    : [];

  return {
    id,
    name,
    email,
    role: asString(value.role, 'other'),
    company: asString(value.company) || undefined,
    phone: asString(value.phone) || undefined,
    status,
    invitedAt: asString(value.invitedAt, new Date().toISOString()),
    lastActive: asString(value.lastActive) || undefined,
    projects,
    permissions,
  };
};

const statusColor = (status: ExternalCollaborator['status']): ChipProps['color'] => {
  if (status === 'active') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'inactive') return 'error';
  return 'default';
};

const roleLabel = (role: string): string => {
  const map: Record<string, string> = {
    client: 'Klient',
    assistant: 'Assistent',
    editor: 'Redaktør',
    vendor: 'Leverandør',
    contractor: 'Underleverandør',
    consultant: 'Konsulent',
    other: 'Annet',
  };
  return map[role] ?? role;
};

export default function ExternalCollaboratorInterface({
  projectId,
  profession = 'photographer',
}: ExternalCollaboratorInterfaceProps) {
  const { user } = useAuth();
  const { isDemoMode } = useDemoMode();
  const theming = useTheming(profession);
  const queryClient = useQueryClient();

  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [newCollaborator, setNewCollaborator] = useState<NewCollaboratorInput>({
    name: '',
    email: '',
    role: 'client',
    company: '',
    phone: '',
  });

  const collaboratorsQuery = useQuery<ExternalCollaborator[]>({
    queryKey: ['external-collaborators', projectId],
    queryFn: async () => {
      const result = await apiRequest(
        `/api/collaborators/external${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`,
      );

      if (!Array.isArray(result)) {
        return [];
      }

      return result
        .map(normalizeCollaborator)
        .filter((collaborator): collaborator is ExternalCollaborator => collaborator !== null);
    },
    retry: false,
  });

  const inviteMutation = useMutation({
    mutationFn: async (payload: NewCollaboratorInput) =>
      apiRequest('/api/collaborators/invite', {
        method: 'POST',
        body: {
          ...payload,
          projectId,
          profession,
          invitedBy: isObject(user) ? asString((user as Record<string, unknown>).id) : undefined,
          demoMode: isDemoMode,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['external-collaborators'] });
      setShowInviteDialog(false);
      setNewCollaborator({ name: '', email: '', role: 'client', company: '', phone: '' });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (collaboratorId: string) =>
      apiRequest(`/api/collaborators/${encodeURIComponent(collaboratorId)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['external-collaborators'] });
      setSelectedCollaboratorId(null);
    },
  });

  const collaborators = collaboratorsQuery.data ?? [];

  const selectedCollaborator = useMemo(
    () => collaborators.find((collaborator) => collaborator.id === selectedCollaboratorId) ?? null,
    [collaborators, selectedCollaboratorId],
  );

  const handleInvite = () => {
    if (!newCollaborator.name || !newCollaborator.email || !newCollaborator.role) {
      return;
    }
    inviteMutation.mutate(newCollaborator);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Group color="primary" />
          Eksterne Samarbeidspartnere
        </Typography>
        <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setShowInviteDialog(true)}>
          Inviter samarbeidspartner
        </Button>
      </Box>

      {projectId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Viser samarbeidspartnere for prosjekt: <strong>{projectId}</strong>
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Samarbeidspartnere ({collaborators.length})
              </Typography>

              {collaboratorsQuery.isLoading ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <Typography>Laster samarbeidspartnere...</Typography>
                </Box>
              ) : collaborators.length === 0 ? (
                <Typography color="text.secondary">Ingen samarbeidspartnere lagt til enda.</Typography>
              ) : (
                <List>
                  {collaborators.map((collaborator) => (
                    <ListItem
                      key={collaborator.id}
                      onClick={() => setSelectedCollaboratorId(collaborator.id)}
                      sx={{
                        border: '1px solid',
                        borderColor: selectedCollaboratorId === collaborator.id ? 'primary.main' : 'divider',
                        borderRadius: 1,
                        mb: 1,
                        cursor: 'pointer',
                      }}
                    >
                      <ListItemIcon>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {collaborator.name.charAt(0).toUpperCase()}
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle1">{collaborator.name}</Typography>
                            <Chip
                              label={collaborator.status.toUpperCase()}
                              size="small"
                              color={statusColor(collaborator.status)}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              <Email fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                              {collaborator.email}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              <BusinessCenter fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                              {roleLabel(collaborator.role)}
                              {collaborator.company ? ` - ${collaborator.company}` : ''}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              <CalendarToday fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                              Invitert: {new Date(collaborator.invitedAt).toLocaleDateString('nb-NO')}
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => removeMutation.mutate(collaborator.id)}
                          disabled={removeMutation.isPending}
                        >
                          <Delete />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Statistikk
              </Typography>
              <StackStat label="Totalt" value={collaborators.length} />
              <StackStat
                label="Aktive"
                value={collaborators.filter((collaborator) => collaborator.status === 'active').length}
              />
              <StackStat
                label="Ventende"
                value={collaborators.filter((collaborator) => collaborator.status === 'pending').length}
              />
            </CardContent>
          </Card>

          {selectedCollaborator && (
            <Card sx={{ mt: 2, ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="subtitle1" sx={{ color: theming.colors.primary, mb: 1 }}>
                  Valgt samarbeidspartner
                </Typography>
                <Typography variant="body2">{selectedCollaborator.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedCollaborator.email}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedCollaborator.permissions.length} tillatelser • {selectedCollaborator.projects.length}{' '}
                  prosjekter
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      <Dialog open={showInviteDialog} onClose={() => setShowInviteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Inviter ny samarbeidspartner</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Navn"
              value={newCollaborator.name}
              onChange={(event) =>
                setNewCollaborator((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              required
              fullWidth
            />
            <TextField
              label="E-post"
              type="email"
              value={newCollaborator.email}
              onChange={(event) =>
                setNewCollaborator((prev) => ({
                  ...prev,
                  email: event.target.value,
                }))
              }
              required
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="external-collaborator-role-label">Rolle</InputLabel>
              <Select
                labelId="external-collaborator-role-label"
                label="Rolle"
                value={newCollaborator.role}
                onChange={(event) =>
                  setNewCollaborator((prev) => ({
                    ...prev,
                    role: event.target.value,
                  }))
                }
              >
                <MenuItem value="client">Klient</MenuItem>
                <MenuItem value="assistant">Assistent</MenuItem>
                <MenuItem value="editor">Redaktør</MenuItem>
                <MenuItem value="vendor">Leverandør</MenuItem>
                <MenuItem value="contractor">Underleverandør</MenuItem>
                <MenuItem value="consultant">Konsulent</MenuItem>
                <MenuItem value="other">Annet</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Firma"
              value={newCollaborator.company}
              onChange={(event) =>
                setNewCollaborator((prev) => ({
                  ...prev,
                  company: event.target.value,
                }))
              }
              fullWidth
            />
            <TextField
              label="Telefon"
              value={newCollaborator.phone}
              onChange={(event) =>
                setNewCollaborator((prev) => ({
                  ...prev,
                  phone: event.target.value,
                }))
              }
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInviteDialog(false)}>Avbryt</Button>
          <Button variant="contained" onClick={handleInvite} disabled={inviteMutation.isPending}>
            {inviteMutation.isPending ? 'Inviterer...' : 'Send invitasjon'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function StackStat({ label, value }: { label: string; value: number }) {
  return (
    <Paper sx={{ p: 2, textAlign: 'center', mb: 1.5 }}>
      <Typography variant="h4" color="primary">
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}
