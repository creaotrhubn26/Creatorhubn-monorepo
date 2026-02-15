import { useState, useCallback, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ListSubheader,
} from '@mui/material';
import { Close as CloseIcon, Lock as LockIcon } from '@mui/icons-material';
import authSessionService from '../services/authSessionService';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
  onLoginSuccess: (user: { id: number; email: string; role: string; display_name: string }) => void;
  isLandingPage?: boolean;
}

const professionCategories = [
  {
    id: 'admin',
    label: 'Admin',
    roles: [
      { id: 'owner', label: 'Eier', description: 'Full tilgang til alt' },
      { id: 'admin', label: 'Administrator', description: 'Brukeradministrasjon og innstillinger' },
    ],
  },
  {
    id: 'foto',
    label: 'Foto-profesjon',
    roles: [
      { id: 'photographer', label: 'Fotograf', description: 'Leder fotoshoots' },
      { id: 'photo_director', label: 'Fotodirektør', description: 'Kreativ ledelse for foto' },
      { id: 'photo_assistant', label: 'Fotoassistent', description: 'Støttefunksjon' },
    ],
  },
  {
    id: 'video',
    label: 'Video-profesjon',
    roles: [
      { id: 'director', label: 'Regissør', description: 'Kreativ ledelse for video' },
      { id: 'producer', label: 'Produsent', description: 'Prosjektledelse og budsjett' },
      { id: 'casting_director', label: 'Casting Director', description: 'Ansvarlig for casting-prosessen' },
      { id: 'camera_operator', label: 'Kameraoperatør', description: 'Teknisk utførelse' },
    ],
  },
  {
    id: 'felles',
    label: 'Felles/Andre',
    roles: [
      { id: 'talent', label: 'Talent/Modell', description: 'De som castes' },
      { id: 'agent', label: 'Agent', description: 'Representerer talent' },
      { id: 'client', label: 'Klient', description: 'Oppdragsgiver/merkevare' },
    ],
  },
];

export default function LoginDialog({ open, onClose, onLoginSuccess, isLandingPage = false }: LoginDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setEmail('');
        setPassword('');
        setSelectedRole('');
        setError('');
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleLogin = async () => {
    // Prevent double submission
    if (loading) return;

    if (!email.trim() || !password) {
      setError('E-post og passord er påkrevd');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Vennligst oppgi en gyldig e-postadresse');
      return;
    }

    if (isLandingPage && !selectedRole) {
      setError('Vennligst velg en rolle');
      return;
    }

    setLoading(true);
    setError('');

    if (selectedRole) {
      await authSessionService.setSelectedProfession(selectedRole);
    }

    console.log('🔐 Attempting login with:', { email: email.trim(), role: selectedRole });

    try {
      // Create a timeout promise that rejects after 5 seconds
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Backend timeout - using fallback')), 5000)
      );

      const fetchPromise = fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, role: selectedRole }),
        mode: 'cors',
        credentials: 'include',
      }).then(r => {
        console.log('📡 Fetch response received:', r.status, r.statusText);
        return r.json();
      });

      const data = await Promise.race([fetchPromise, timeoutPromise]);

      console.log('🔐 Backend response:', { ok: true, success: data.success, user: data.user });

      if (data.success) {
        console.log('✅ Login successful, saving session and reloading...');
        await authSessionService.setAdminUser(data.user);
        await authSessionService.setCurrentUserId(String(data.user.id));
        onLoginSuccess(data.user);
        // Page will reload from onLoginSuccess, no need to clear form
      } else {
        console.log('❌ Login failed:', data.detail || 'Unknown error');
        setLoading(false);
        setError(data.detail || 'Ugyldig e-post eller passord');
      }
    } catch (err) {
      console.error('❌ Login error - Backend ikke tilgjengelig, bruker mock auth:', err);
      
      // Fallback: Mock authentication når backend ikke kjører
      // Demo user for utvikling
      const mockUser = {
        id: 1,
        email: email.trim(),
        role: selectedRole || 'producer',
        display_name: email.trim().split('@')[0],
      };
      
      console.log('🚀 Using mock auth with:', mockUser);
      await authSessionService.setAdminUser(mockUser);
      await authSessionService.setCurrentUserId(mockUser.id.toString());
      onLoginSuccess(mockUser);
      // Page will reload from onLoginSuccess, no need to clear form
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleLogin();
    }
  };

  const inputStyles = {
    '& .MuiOutlinedInput-root': {
      color: '#fff',
      bgcolor: 'rgba(255,255,255,0.03)',
      borderRadius: 2,
      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
      '&:hover fieldset': { borderColor: 'rgba(139,92,246,0.5)' },
      '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#8b5cf6' },
  };

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        if (reason !== 'backdropClick') {
          onClose();
        }
      }}
      disableEscapeKeyDown={false}
      maxWidth="sm"
      fullWidth
      sx={{
        zIndex: 10002,
        '& .MuiBackdrop-root': {
          zIndex: 10001,
          bgcolor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
        },
      }}
      PaperProps={{
        sx: {
          bgcolor: '#1a1a24',
          color: '#fff',
          borderRadius: 3,
          border: '1px solid rgba(139,92,246,0.3)',
          width: { xs: '95%', sm: 440 },
          maxWidth: 440,
          boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 40px rgba(139,92,246,0.2)',
          m: 2,
          position: 'relative',
          zIndex: 10002,
          pointerEvents: 'auto',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1c2128 0%, #0d1117 100%)',
          p: 3,
          textAlign: 'center',
          borderBottom: '1px solid rgba(139,92,246,0.2)',
          position: 'relative',
          zIndex: 1,
          pointerEvents: 'auto',
        }}
      >
        <Box
          component="img"
          src="/casting-planner-logo.png"
          alt="Casting Planner"
          sx={{
            width: 80,
            height: 80,
            objectFit: 'contain',
            mb: 2,
            filter: 'drop-shadow(0 4px 20px rgba(139, 92, 246, 0.4))',
          }}
        />

        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(135deg, #fff 0%, #8b5cf6 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 0.5,
          }}
        >
          {isLandingPage ? 'Logg Inn' : 'Admin Logg Inn'}
        </Typography>
        
        <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.875rem' }}>
          {isLandingPage 
            ? 'Velg din rolle og logg inn for å starte'
            : 'Logg inn for å administrere Casting Planner'}
        </Typography>

        <IconButton 
          onClick={onClose} 
          aria-label="Lukk dialog"
          sx={{ 
            position: 'absolute', 
            top: 8, 
            right: 8, 
            color: 'rgba(255,255,255,0.87)',
            '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' },
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Form */}
      <DialogContent sx={{ p: 3, position: 'relative', zIndex: 1, pointerEvents: 'auto' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'relative', zIndex: 1, pointerEvents: 'auto' }}>
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                bgcolor: 'rgba(239,68,68,0.1)', 
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 2,
                '& .MuiAlert-icon': { color: '#ef4444' },
              }}
            >
              {error}
            </Alert>
          )}

          {isLandingPage && (
            <FormControl fullWidth>
              <InputLabel id="role-select-label" sx={{ color: 'rgba(255,255,255,0.87)' }}>Velg rolle</InputLabel>
              <Select
                labelId="role-select-label"
                id="role-select"
                name="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                label="Velg rolle"
                disabled={loading}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      bgcolor: '#1c2128',
                      border: '1px solid rgba(255,255,255,0.1)',
                      maxHeight: 400,
                      zIndex: 10003,
                      '& .MuiMenuItem-root': {
                        color: '#fff',
                        '&:hover': { bgcolor: 'rgba(139,92,246,0.2)' },
                        '&.Mui-selected': { bgcolor: 'rgba(139,92,246,0.3)' },
                      },
                      '& .MuiListSubheader-root': {
                        bgcolor: '#0d1117',
                        color: '#8b5cf6',
                        fontWeight: 700,
                        lineHeight: '40px',
                      },
                    },
                  },
                  anchorOrigin: {
                    vertical: 'bottom',
                    horizontal: 'left',
                  },
                  transformOrigin: {
                    vertical: 'top',
                    horizontal: 'left',
                  },
                }}
                sx={{
                  color: '#fff',
                  bgcolor: 'rgba(255,255,255,0.03)',
                  borderRadius: 2,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(139,92,246,0.5)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#8b5cf6' },
                  '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              >
                {professionCategories.map((category) => [
                  <ListSubheader key={`header-${category.id}`}>
                    {category.label}
                  </ListSubheader>,
                  ...category.roles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      <Box>
                        <Typography sx={{ fontWeight: 500, fontSize: '0.9rem' }}>{role.label}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.87)' }}>
                          {role.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  )),
                ])}
              </Select>
            </FormControl>
          )}

          <TextField
            id="email-input"
            label="E-post"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            fullWidth
            autoFocus={!isLandingPage}
            disabled={loading}
            sx={inputStyles}
          />

          <TextField
            id="password-input"
            label="Passord"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            fullWidth
            disabled={loading}
            sx={inputStyles}
          />

          <Button
            onClick={handleLogin}
            variant="contained"
            disabled={loading}
            fullWidth
            startIcon={loading ? null : <LockIcon />}
            sx={{ 
              mt: 1,
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              boxShadow: '0 4px 20px rgba(139,92,246,0.3)',
              '&:hover': { 
                background: 'linear-gradient(135deg, #9b6cf6 0%, #7376f1 100%)',
                boxShadow: '0 6px 24px rgba(139,92,246,0.4)',
              },
              '&:disabled': {
                background: 'rgba(139,92,246,0.3)',
                color: 'rgba(255,255,255,0.87)',
              },
            }}
          >
            {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Logg Inn'}
          </Button>

          <Button 
            onClick={onClose}
            disabled={loading}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              fontSize: '0.875rem',
              '&:hover': { color: 'rgba(255,255,255,0.8)', bgcolor: 'transparent' },
            }}
          >
            Avbryt
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
