import React, { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Business as BusinessIcon,
  CheckCircle as CheckIcon,
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';

import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../utils/theming-helper';

interface BusinessLogoUploadProps {
  userId?: string;
  organizationNumber?: string;
  businessName?: string;
  currentLogoUrl?: string;
  onLogoUpdated?: (logoUrl: string) => void;
  size?: 'small' | 'medium' | 'large';
  variant?: 'card' | 'avatar-only';
}

interface BusinessLogoUploadResponse {
  logoUrl: string;
}

function isBusinessLogoUploadResponse(value: unknown): value is BusinessLogoUploadResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { logoUrl?: unknown };
  return typeof candidate.logoUrl === 'string';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof globalThis.Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Det oppstod en feil under opplasting av logo.';
}

export const BusinessLogoUpload: React.FC<BusinessLogoUploadProps> = ({
  userId,
  organizationNumber,
  businessName,
  currentLogoUrl,
  onLogoUpdated,
  size = 'medium',
  variant = 'card',
}) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const resolvedUserId = userId ?? user?.id;
  const resolvedBusinessName = businessName ?? user?.businessName ?? 'Your Business';
  const theming = useTheming(user?.profession ?? 'photographer');
  const canUpload = Boolean(resolvedUserId || organizationNumber);
  const canDelete = Boolean(resolvedUserId);

  const resetSuccessStateLater = () => {
    window.setTimeout(() => setUploadSuccess(false), 3000);
  };

  const clearErrorLater = () => {
    window.setTimeout(() => setUploadError(''), 5000);
  };

  const invalidateLogoQueries = async () => {
    if (!resolvedUserId) {
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/api/business-profile', resolvedUserId] }),
      queryClient.invalidateQueries({ queryKey: ['/api/user-files/logos', resolvedUserId] }),
    ]);
  };

  const getSizeProps = () => {
    switch (size) {
      case 'small':
        return { width: 40, height: 40 };
      case 'large':
        return { width: 120, height: 120 };
      default:
        return { width: 80, height: 80 };
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);

      if (resolvedUserId) {
        formData.append('userId', resolvedUserId);
      }
      if (organizationNumber) {
        formData.append('organizationNumber', organizationNumber);
      }
      formData.append('businessName', resolvedBusinessName);

      const response = await apiRequest('/api/business-logo/upload', {
        method: 'POST',
        body: formData,
      });

      if (!isBusinessLogoUploadResponse(response)) {
        throw new Error('Opplastingen returnerte ikke en gyldig logo-URL.');
      }

      return response;
    },
    onSuccess: async (data) => {
      setUploadSuccess(true);
      setUploadError('');
      onLogoUpdated?.(data.logoUrl);
      await invalidateLogoQueries();
      resetSuccessStateLater();
    },
    onError: (error: unknown) => {
      setUploadError(getErrorMessage(error));
      clearErrorLater();
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!resolvedUserId) {
        throw new Error('Bruker-ID mangler. Kan ikke slette logo.');
      }

      await apiRequest(`/api/business-logo/${resolvedUserId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: async () => {
      setUploadSuccess(true);
      setUploadError('');
      onLogoUpdated?.('');
      await invalidateLogoQueries();
      resetSuccessStateLater();
    },
    onError: (error: unknown) => {
      setUploadError(getErrorMessage(error));
      clearErrorLater();
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Filen er for stor. Maksimal størrelse er 5MB.');
      clearErrorLater();
      return;
    }

    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];

    if (!allowedTypes.includes(file.type)) {
      setUploadError('Ugyldig filtype. Kun JPEG, PNG, GIF, WebP og SVG er tillatt.');
      clearErrorLater();
      return;
    }

    setIsUploading(true);
    setUploadError('');
    uploadMutation.mutate(file);

    if (event.target) {
      event.target.value = '';
    }
  };

  const handleUploadClick = () => {
    if (!canUpload) {
      setUploadError('Logg inn eller velg en organisasjon før du laster opp logo.');
      clearErrorLater();
      return;
    }

    fileInputRef.current?.click();
  };

  const handleDelete = () => {
    if (!canDelete) {
      setUploadError('Logo kan bare slettes når komponenten kjenner bruker-ID.');
      clearErrorLater();
      return;
    }

    if (window.confirm('Er du sikker på at du vil slette logoen?')) {
      deleteMutation.mutate();
    }
  };

  if (variant === 'avatar-only') {
    return (
      <Box position="relative" display="inline-block">
        <Avatar
          src={currentLogoUrl}
          sx={{
            ...getSizeProps(),
            bgcolor: currentLogoUrl ? 'transparent' : 'primary.main',
            cursor: canUpload ? 'pointer' : 'default',
            '&:hover': {
              opacity: canUpload ? 0.8 : 1,
            },
          }}
          onClick={handleUploadClick}
        >
          {!currentLogoUrl && <BusinessIcon />}
        </Avatar>

        {isUploading && (
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            display="flex"
            alignItems="center"
            justifyContent="center"
            bgcolor="rgba(0,0,0,0.5)"
            borderRadius="50%"
          >
            <CircularProgress size={24} color="inherit" />
          </Box>
        )}

        {uploadSuccess && (
          <CheckIcon
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              bgcolor: 'success.main',
              color: 'white',
              borderRadius: '50%',
              fontSize: 20,
            }}
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </Box>
    );
  }

  return (
    <Card sx={{ maxWidth: 360, mx: 'auto', ...theming.getThemedCardSx() }}>
      <CardContent sx={{ textAlign: 'center', p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Bedriftslogo
        </Typography>

        <Box mb={3}>
          <Avatar
            src={currentLogoUrl}
            sx={{
              ...getSizeProps(),
              mx: 'auto',
              mb: 2,
              bgcolor: currentLogoUrl ? 'transparent' : 'primary.main',
              border: '3px solid',
              borderColor: 'divider',
            }}
          >
            {!currentLogoUrl && <BusinessIcon sx={{ fontSize: size === 'large' ? 48 : 32 }} />}
          </Avatar>

          {isUploading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

          <Typography variant="body2" color="text.secondary">
            {currentLogoUrl ? 'Klikk for å endre logo' : 'Last opp bedriftens logo'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {resolvedBusinessName}
          </Typography>
        </Box>

        {!canUpload && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Koble komponenten til en innlogget bruker eller et organisasjonsnummer for å aktivere opplasting.
          </Alert>
        )}

        {uploadError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {uploadError}
          </Alert>
        )}

        {uploadSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Logo oppdatert!
          </Alert>
        )}

        <Box display="flex" gap={1} justifyContent="center">
          <Button
            variant="contained"
            startIcon={currentLogoUrl ? <EditIcon /> : <UploadIcon />}
            onClick={handleUploadClick}
            disabled={isUploading || !canUpload}
          >
            {currentLogoUrl ? 'Endre' : 'Last opp'}
          </Button>

          {currentLogoUrl && (
            <Tooltip title={canDelete ? 'Slett logo' : 'Sletting krever bruker-ID'}>
              <span>
                <IconButton
                  color="error"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending || !canDelete}
                >
                  <DeleteIcon />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Støttede formater: JPG, PNG, GIF, WebP, SVG
          <br />
          Maksimal størrelse: 5MB
        </Typography>
      </CardContent>
    </Card>
  );
};

export default BusinessLogoUpload;
