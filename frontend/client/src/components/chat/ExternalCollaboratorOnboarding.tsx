import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  Group,
  PersonAdd,
  Security,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';
import { useDemoMode } from '../../contexts/DemoModeContext';

interface ExternalCollaboratorOnboardingProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  profession?: string;
  userEmail?: string;
}

interface BasicInfo {
  name: string;
  email: string;
  role: string;
}

interface CommunicationPreferences {
  email: boolean;
  chat: boolean;
  notifications: boolean;
}

interface OnboardingForm {
  basic: BasicInfo;
  permissions: string[];
  projectAccess: string[];
  securityLevel: 'standard' | 'enhanced' | 'maximum';
  communication: CommunicationPreferences;
  notes: string;
}

const availablePermissions = [
  'View Projects',
  'Edit Projects',
  'Upload Files',
  'Download Files',
  'Create Tasks',
  'Assign Tasks',
  'View Reports',
  'Manage Users',
  'System Settings',
];

const availableProjects = [
  'Wedding Photography - Sarah & John',
  'Corporate Video - Tech Startup',
  'Music Production - Album Recording',
  'Event Planning - Summer Festival',
  'Product Photography - E-commerce',
];

export default function ExternalCollaboratorOnboarding({
  open,
  onClose,
  onComplete,
  profession = 'admin',
  userEmail,
}: ExternalCollaboratorOnboardingProps) {
  const theming = useTheming('photographer');
  const { isDemoMode } = useDemoMode();

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<OnboardingForm>({
    basic: {
      name: '',
      email: '',
      role: 'client',
    },
    permissions: [],
    projectAccess: [],
    securityLevel: 'standard',
    communication: {
      email: true,
      chat: true,
      notifications: true,
    },
    notes: '',
  });

  const steps = ['Basic Information', 'Role & Permissions', 'Project Access', 'Security', 'Review'];

  const projectId = useMemo(() => {
    const initials = form.basic.name
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
    const timestamp = Date.now().toString().slice(-4);
    return `${initials || 'CL'}-${timestamp}`;
  }, [form.basic.name]);

  const togglePermission = (permission: string) => {
    setForm((previous) => ({
      ...previous,
      permissions: previous.permissions.includes(permission)
        ? previous.permissions.filter((entry) => entry !== permission)
        : [...previous.permissions, permission],
    }));
  };

  const toggleProjectAccess = (project: string) => {
    setForm((previous) => ({
      ...previous,
      projectAccess: previous.projectAccess.includes(project)
        ? previous.projectAccess.filter((entry) => entry !== project)
        : [...previous.projectAccess, project],
    }));
  };

  const updateCommunication = (key: keyof CommunicationPreferences, value: boolean) => {
    setForm((previous) => ({
      ...previous,
      communication: {
        ...previous.communication,
        [key]: value,
      },
    }));
  };

  const canProceed = useMemo(() => {
    if (activeStep === 0) {
      return Boolean(form.basic.name && form.basic.email && form.basic.role);
    }
    return true;
  }, [activeStep, form.basic]);

  const handleComplete = async () => {
    setLoading(true);
    try {
      await apiRequest('/api/collaborators/onboarding', {
        method: 'POST',
        body: {
          profession,
          userEmail,
          demoMode: isDemoMode,
          projectId,
          form,
        },
      });
      onComplete();
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    if (activeStep === 0) {
      return (
        <Box sx={{ p: 1 }}>
          <Typography variant="h6" gutterBottom>
            <PersonAdd sx={{ mr: 1, verticalAlign: 'middle' }} />
            Basic Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Full Name"
                value={form.basic.name}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    basic: { ...previous.basic, name: event.target.value },
                  }))
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="email"
                label="Email Address"
                value={form.basic.email}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    basic: { ...previous.basic, email: event.target.value },
                  }))
                }
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel id="onboarding-role-label">Role</InputLabel>
                <Select
                  labelId="onboarding-role-label"
                  label="Role"
                  value={form.basic.role}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      basic: { ...previous.basic, role: event.target.value },
                    }))
                  }
                >
                  <MenuItem value="photographer">Photographer</MenuItem>
                  <MenuItem value="videographer">Videographer</MenuItem>
                  <MenuItem value="music_producer">Music Producer</MenuItem>
                  <MenuItem value="vendor">Vendor</MenuItem>
                  <MenuItem value="client">Client</MenuItem>
                  <MenuItem value="admin">Administrator</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>
      );
    }

    if (activeStep === 1) {
      return (
        <Box sx={{ p: 1 }}>
          <Typography variant="h6" gutterBottom>
            <Security sx={{ mr: 1, verticalAlign: 'middle' }} />
            Role & Permissions
          </Typography>
          <List>
            {availablePermissions.map((permission) => (
              <ListItem key={permission}>
                <ListItemIcon>
                  <Checkbox
                    checked={form.permissions.includes(permission)}
                    onChange={() => togglePermission(permission)}
                  />
                </ListItemIcon>
                <ListItemText primary={permission} />
              </ListItem>
            ))}
          </List>
        </Box>
      );
    }

    if (activeStep === 2) {
      return (
        <Box sx={{ p: 1 }}>
          <Typography variant="h6" gutterBottom>
            <Group sx={{ mr: 1, verticalAlign: 'middle' }} />
            Project Access
          </Typography>
          <List>
            {availableProjects.map((project) => (
              <ListItem key={project}>
                <ListItemIcon>
                  <Checkbox
                    checked={form.projectAccess.includes(project)}
                    onChange={() => toggleProjectAccess(project)}
                  />
                </ListItemIcon>
                <ListItemText primary={project} />
              </ListItem>
            ))}
          </List>
        </Box>
      );
    }

    if (activeStep === 3) {
      return (
        <Box sx={{ p: 1 }}>
          <Typography variant="h6" gutterBottom>
            <Security sx={{ mr: 1, verticalAlign: 'middle' }} />
            Security Settings
          </Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="onboarding-security-level-label">Security Level</InputLabel>
            <Select
              labelId="onboarding-security-level-label"
              value={form.securityLevel}
              label="Security Level"
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  securityLevel: event.target.value as OnboardingForm['securityLevel'],
                }))
              }
            >
              <MenuItem value="standard">Standard</MenuItem>
              <MenuItem value="enhanced">Enhanced</MenuItem>
              <MenuItem value="maximum">Maximum</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                checked={form.communication.email}
                onChange={(event) => updateCommunication('email', event.target.checked)}
              />
            }
            label="Email Notifications"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.communication.chat}
                onChange={(event) => updateCommunication('chat', event.target.checked)}
              />
            }
            label="Chat Access"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.communication.notifications}
                onChange={(event) => updateCommunication('notifications', event.target.checked)}
              />
            }
            label="Push Notifications"
          />

          <TextField
            fullWidth
            multiline
            rows={3}
            sx={{ mt: 2 }}
            label="Additional Notes"
            value={form.notes}
            onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
          />
        </Box>
      );
    }

    return (
      <Box sx={{ p: 1 }}>
        <Typography variant="h6" gutterBottom>
          <CheckCircle sx={{ mr: 1, verticalAlign: 'middle' }} />
          Review & Complete
        </Typography>

        <Card sx={{ mb: 2, ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="subtitle1">Basic Information</Typography>
            <Typography>Name: {form.basic.name}</Typography>
            <Typography>Email: {form.basic.email}</Typography>
            <Typography>Role: {form.basic.role}</Typography>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2, ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="subtitle1">Permissions</Typography>
            {form.permissions.length === 0 ? (
              <Typography color="text.secondary">No explicit permissions selected.</Typography>
            ) : (
              form.permissions.map((permission) => (
                <Typography key={permission}>• {permission}</Typography>
              ))
            )}
          </CardContent>
        </Card>

        <Alert severity="info">
          Invitation will be sent to <strong>{form.basic.email || 'the collaborator'}</strong>.
          Project reference ID: <strong>{projectId}</strong>
        </Alert>
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center">
          <PersonAdd sx={{ mr: 1 }} />
          External Collaborator Onboarding
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {renderStep()}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>

        <Button onClick={() => setActiveStep((step) => Math.max(0, step - 1))} disabled={activeStep === 0 || loading}>
          Back
        </Button>

        {activeStep === steps.length - 1 ? (
          <Button variant="contained" onClick={() => void handleComplete()} disabled={loading}>
            {loading ? 'Completing...' : 'Complete Onboarding'}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={() => setActiveStep((step) => Math.min(steps.length - 1, step + 1))}
            disabled={!canProceed || loading}
          >
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
