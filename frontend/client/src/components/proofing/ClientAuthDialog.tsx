/**
 * CreatorHub Norge - FASE 2: Client Authentication Dialog
 * Sikker PIN/passord-pålogging for client proofing sessions
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Lock,
  Security,
  AccessTime,
  Warning,
} from '@mui/icons-material';

interface ClientAuthDialogProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (sessionData: any) => void;
  sessionToken: string;
  requiresPin?: boolean;
  requiresPassword?: boolean;
  lockoutUntil?: string | null;
  maxAttempts?: number
}

export const ClientAuthDialog: React.FC<ClientAuthDialogProps> = ({
  open,
  onClose,
  onAuthenticated,
  sessionToken,
  requiresPin = true,
  requiresPassword = false,
  lockoutUntil,
  maxAttempts = 3 }) => {
  const [pin, setPin] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(maxAttempts);

  // Check if session is currently locked
  const isLocked = lockoutUntil && new Date(lockoutUntil) > new Date();
  const timeUntilUnlock = isLocked ? Math.ceil((new Date(lockoutUntil!).getTime() - new Date().getTime()) / 1000 / 60) : 0;

  const handleAuthenticate = async () => {
    if (loading) return;
    
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/proofing/authenticate', {
        headers: {
          'Content-Type' : 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({
          sessionToken,
          pin: requiresPin ? pin : undefined,
          password: requiresPassword ? password : undefined
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Authentication successful
        onAuthenticated(data.session);
        setPin('');
        setPassword('');
        setError('');
      } else {
        // Authentication failed
        setError(data.error || 'Autentiseringsfeil');
        
        if (data.attemptsLeft !== undefined) {
          setAttemptsLeft(data.attemptsLeft);
      }

        // Clear form on failed attempt
        if (requiresPin) setPin(', ');
        if (requiresPassword) setPassword(', ');
    }
  } catch (error) {
      console.error('Authentication error: ', error);
      setError('Nettverksfeil - prøv igjen');
  } finally {
      setLoading(false);
  }
};

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !loading && !isLocked) {
      handleAuthenticate();
}
};

  return (
    <Dialog 
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, rgba(26, 31, 46, 0.98) 0%, rgba(37, 42, 58, 0.98) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(25, 107, 53, 0.3)',
          borderRadius: 3 }
    }}
    >
      <DialogTitle sx={{ 
        textAlign: 'center', 
        color: '#fff', 
        borderBottom: '1px solid rgba(25, 107, 53, 0.2)',
        pb: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={1}>
          <Security sx={{ color: '#FF6B35' }} />
          <Typography variant="h5" component="span" sx={{  fontWeight: 600}}>
            Sikker pålogging
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)' }}>
          Skriv inn din tilgangskode for å se bildene
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt:  3 }}>
        {isLocked ? (
          <Card sx={{
            ...theming.getThemedCardSx(),
            bgcolor: 'rgba(24, 67, 54, 0.1)',
            border: '1px solid rgba(24, 67, 54, 0.3)',
            mb: 2}}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Warning sx={{ color: '#f44336' }} />
                <Typography variant="h6" sx={{ color: '#f44336' }}>
                  Session låst
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.82)' }}>
                For mange feilede forsøk. Prøv igjen om {timeUntilUnlock} minutter.
              </Typography>
              <Box display="flex" alignItems="center" gap={1} mt={1}>
                <AccessTime sx={{ fontSize:  16, color: 'rgba(255,255,255,0.52)' }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.52)' }}>
                  Låst til: {new Date(lockoutUntil!).toLocaleTimeString(', ')}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <>
            {error && (
              <Alert
                severity="error"
                sx={{
                  mb: 2,
                  bgcolor: 'rgba(244, 67, 54, 0.1)',
                  border: '1px solid rgba(244, 67, 54, 0.3)','& .MuiAlert-message': { color: '#fff' }
                }}
              >
                {error}
                {attemptsLeft < maxAttempts && attemptsLeft > 0 && (
                  <Typography variant="caption" display="block" sx={{ mt: 0.5, opacity: 0.8 }}>
                    {attemptsLeft} forsøk igjen
                  </Typography>
                )}
              </Alert>
            )}

            <Box display="flex" flexDirection="column" gap={3}>
              {requiresPin && (
                <Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', mb: 1 }}>
                    PIN-kode:
                  </Typography>
                  <TextField
                    fullWidth
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.slice(0, 6))}
                    onKeyDown={handleKeyPress}
                    placeholder="Skriv inn 6-sifret PIN"
                    disabled={loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock sx={{ color: 'rgba(255,255,255,0.52)' }} />
                        </InputAdornment>
                      ),
                      sx: {
                        color: '#fff',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 2, '& .MuiOutlinedInput-notchedOutline': {
                          border: 'none'
                        }, '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.08)'
                        }, '&.Mui-focused': {
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          border: '1px solid #FF6B35'
                        }
                      }
                    }}
                  />
                </Box>
              )}

              {requiresPassword && (
                <Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', mb: 1 }}>
                    Passord:
                  </Typography>
                  <TextField
                    fullWidth
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Skriv inn passord"
                    disabled={loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock sx={{ color: 'rgba(255,255,255,0.52)' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            sx={{ color: 'rgba(255,255,255,0.52)' }}
                          >
                            {showPassword ? theming.getThemedIcon('visibilityOff') : theming.getThemedIcon('visibility')}
                          </IconButton>
                        </InputAdornment>
                      ),
                      sx: {
                        color: '#fff',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 2,
                        '& .MuiOutlinedInput-notchedOutline': {
                          border: 'none'
                        },
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.08)'
                        },
                        '&.Mui-focused': {
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          border: '1px solid #FF6B35'
                        }
                      }
                    }}
                  />
                </Box>
              )}

              {/* Security Info */}
              <Card sx={{
                bgcolor: 'rgba(33, 150, 243, 0.1)',
                border: '1px solid rgba(33, 150, 243, 0.3)',
                ...theming.getThemedCardSx()
              }}>
                <CardContent sx={{ py: 2, ...theming.getThemedCardSx() }}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Security sx={{ fontSize: 16, color: '#2196f3' }} />
                    <Typography variant="caption" sx={{ color: '#2196f3' }}>
                      Sikkerhetsinformasjon
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    Bildene er beskyttet med vannstempling og høyere oppløsning krever godkjenning.
                  </Typography>
                  <Box display="flex" gap={1} mt={1}>
                    <Chip 
                      label="Vannstempling aktiv" 
                      size="small" 
                      sx={{ 
                        bgcolor: 'rgba(6, 175, 80, 0.2)', 
                        color: '#4caf50',
                        fontSize: '0.7rem'
                  }}
                    />
                    <Chip 
                      label="Nedlasting begrenset" 
                      size="small" 
                      sx={{ 
                        bgcolor: 'rgba(255, 152, 0, 0.18)', 
                        color: '#ff9800',
                        fontSize: '0.7rem'
                  }}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p:  3, pt:  2 }}>
        <Button 
          onClick={onClose}
          sx={{ color: 'rgba(255,255,255,0.72)' }}
          disabled={loading}
        >
          Avbryt
        </Button>
        <Button onClick={handleAuthenticate}
          variant="contained"
          disabled={loading || isLocked || (!pin && requiresPin) || (!password && requiresPassword)}
          sx={{
            background: 'linear-gradient(45deg, #FF6B35 30%, #F7931E 90%)',
            color: '#fff',
            px: 4,
            py: 1,
            position: 'relative', '&:disabled': {
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.3)'
            },
            ...theming.getThemedButtonSx()
          }}>
          {loading && (
            <CircularProgress 
              size={20}
              sx={{ 
                position: 'absolute',
                color: '#fff'}}
            />
          )}
          <span style={{ opacity: loading ? 0 : 1 }}>
            {isLocked ? 'Låst' : 'Logg inn'}
          </span>
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClientAuthDialog;
