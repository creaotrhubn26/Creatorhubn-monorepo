import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  Box, 
  Typography, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  Alert, 
  CircularProgress,
  Card,
  CardContent,
  Divider,
  IconButton,
  InputAdornment
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Visibility, 
  VisibilityOff, 
  Login, 
  Person, 
  Lock,
  Close
} from '@mui/icons-material';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
  onLoginSuccess?: (user: any) => void
}

export default function LoginDialog({ 
  open, 
  onClose, 
  onLoginSuccess 
}: LoginDialogProps) {
  const { login } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    setError('');
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const data = await login(formData.email, formData.password);
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      onLoginSuccess?.(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Innlogging feilet. Sjekk e-post og passord.');
    } finally {
      setIsLoading(false);
    }
  }, [formData, login, queryClient, onLoginSuccess, onClose]);

  const handleClose = () => {
    setFormData({ email: '', password: '', rememberMe: false });
    setError('');
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Person color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Logg inn på CreatorHub</Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>
      
      <Divider />
      
      <DialogContent sx={{ pt: 3 }}>
        <Card variant="outlined" sx={theming.getThemedCardSx()}>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}
                
                <TextField
                  fullWidth
                  label="E-postadresse"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange('email')}
                  required
                  disabled={isLoading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Person color="action" />
                      </InputAdornment>
                    )
                  }}
                />
                
                <TextField
                  fullWidth
                  label="Passord"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange('password')}
                  required
                  disabled={isLoading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          disabled={isLoading}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Box>
            </form>
          </CardContent>
        </Card>
      </DialogContent>
      
      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button 
          onClick={handleClose}
          disabled={isLoading}
        >
          Avbryt
        </Button>
        <Button 
          variant="contained"
          onClick={handleSubmit}
          disabled={isLoading || !formData.email || !formData.password}
          startIcon={isLoading ? <CircularProgress size={20} /> : <Login />}
        >
          {isLoading ? 'Logger inn...' : 'Logg inn'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
