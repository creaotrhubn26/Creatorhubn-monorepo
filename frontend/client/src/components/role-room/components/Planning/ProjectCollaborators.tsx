import React from 'react';
import { 
  Box, 
  Typography, 
  Avatar, 
  Chip, 
  Button,
  Stack,
  IconButton,
  Tooltip,
  Paper
} from '@mui/material';
import { PersonAdd, Delete, Edit, Email } from '@mui/icons-material';
import type { ContributorRole } from '../split-sheets/types';
import { ROLE_DISPLAY_NAMES } from '../split-sheets/types';

interface Collaborator {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: ContributorRole; // Same roles as split sheet
}

interface ProjectCollaboratorsProps {
  collaborators?: Collaborator[];
  onAddCollaborator?: () => void;
  onRemoveCollaborator?: (id: string) => void;
  onEditCollaborator?: (collaborator: Collaborator) => void;
  maxDisplay?: number;
}

const ProjectCollaborators: React.FC<ProjectCollaboratorsProps> = ({
  collaborators = [],
  onAddCollaborator,
  onRemoveCollaborator,
  onEditCollaborator,
  maxDisplay = 10,
}) => {
  const getRoleColor = (role?: ContributorRole) => {
    // Use consistent colors based on role type
    if (!role) return '#6b7280';
    
    // Photographer roles
    if (['second_shooter', 'photo_editor', 'retoucher'].includes(role)) return '#10b981';
    if (['assistant', 'stylist', 'makeup_artist'].includes(role)) return '#3b82f6';
    
    // Videographer roles - leadership
    if (['director', 'producer'].includes(role)) return '#ef4444'; // Red for leadership
    if (['cinematographer', 'camera_operator', 'drone_pilot'].includes(role)) return '#8b5cf6'; // Purple for camera
    if (['video_editor', 'colorist', 'vfx_artist', 'motion_graphics'].includes(role)) return '#f59e0b'; // Orange for post-production
    if (['sound_engineer', 'audio_mixer'].includes(role)) return '#06b6d4'; // Cyan for audio
    if (['grip', 'gaffer'].includes(role)) return '#3b82f6'; // Blue for lighting/grip
    if (['production_assistant', 'script_supervisor', 'location_manager', 'production_designer'].includes(role)) return '#22c55e'; // Green for production support
    
    // Music producer roles
    if (['artist'].includes(role)) return '#10b981';
    if (['songwriter', 'composer', 'mix_engineer'].includes(role)) return '#f59e0b';
    
    // Generic
    if (role === 'collaborator') return '#3b82f6';
    return '#6b7280';
  };

  const getRoleLabel = (role?: ContributorRole) => {
    if (!role) return 'Bidragsyter';
    return ROLE_DISPLAY_NAMES[role] || 'Bidragsyter';
  };

  const displayCollaborators = collaborators.slice(0, maxDisplay);
  const remainingCount = collaborators.length - maxDisplay;

  return (
    <Box>
      {displayCollaborators.length > 0 ? (
        <Stack spacing={1.5}>
          {displayCollaborators.map((collab) => (
            <Paper
              key={collab.id}
              elevation={0}
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                borderRadius: 2,
                bgcolor: 'rgba(25, 118, 210, 0.04)',
                border: '1px solid rgba(25, 118, 210, 0.1)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: 'rgba(25, 118, 210, 0.08)',
                  borderColor: 'rgba(25, 118, 210, 0.2)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }
              }}
            >
              <Avatar
                src={collab.avatar}
                sx={{ 
                  width: 48, 
                  height: 48, 
                  bgcolor: getRoleColor(collab.role),
                  fontWeight: 600,
                  fontSize: '1.125rem'
                }}
              >
                {collab.name.charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography 
                  variant="body1" 
                  sx={{ 
                    fontWeight: 600, 
                    color: 'text.primary',
                    fontSize: '0.95rem',
                    mb: 0.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {collab.name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Email sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: 'text.secondary',
                        fontSize: '0.875rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: { xs: '100%', sm: 200 }
                      }}
                    >
                      {collab.email}
                    </Typography>
                  </Box>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={getRoleLabel(collab.role)}
                  size="small"
                  sx={{
                    height: 24,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    bgcolor: `${getRoleColor(collab.role)}15`,
                    color: getRoleColor(collab.role),
                    border: `1px solid ${getRoleColor(collab.role)}30`,
                  }}
                />
                {onEditCollaborator && (
                  <Tooltip title="Rediger teammedlem">
                    <IconButton
                      size="small"
                      onClick={() => onEditCollaborator(collab)}
                      sx={{
                        color: 'primary.main',
                        '&:hover': {
                          bgcolor: 'primary.light',
                          color: 'primary.dark'
                        }
                      }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {onRemoveCollaborator && (
                  <Tooltip title="Fjern fra team">
                    <IconButton
                      size="small"
                      onClick={() => onRemoveCollaborator(collab.id)}
                      sx={{
                        color: 'error.main',
                        '&:hover': {
                          bgcolor: 'error.light',
                          color: 'error.dark'
                        }
                      }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Paper>
          ))}
          {remainingCount > 0 && (
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'text.secondary',
                fontSize: '0.875rem',
                textAlign: 'center',
                pt: 1
              }}
            >
              + {remainingCount} {remainingCount === 1 ? 'til' : 'til'}
            </Typography>
          )}
        </Stack>
      ) : (
        <Paper
          elevation={0}
          sx={{
            p: 4,
            textAlign: 'center',
            borderRadius: 2,
            bgcolor: 'rgba(0, 0, 0, 0.02)',
            border: '2px dashed rgba(25, 118, 210, 0.2)'
          }}
        >
          <PersonAdd 
            sx={{ 
              fontSize: 48, 
              color: 'text.secondary', 
              mb: 2,
              opacity: 0.5
            }} 
          />
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'text.secondary',
              fontSize: '0.95rem',
              fontWeight: 500,
              mb: 1
            }}
          >
            Ingen teammedlemmer lagt til ennå
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'text.secondary',
              fontSize: '0.875rem',
              mb: 2
            }}
          >
            Legg til teammedlemmer for å samarbeide på prosjektet
          </Typography>
        </Paper>
      )}

      {onAddCollaborator && (
        <Button
          variant="contained"
          startIcon={<PersonAdd />}
          onClick={onAddCollaborator}
          fullWidth
          sx={{
            mt: 2,
            py: 1.5,
            fontWeight: 600,
            fontSize: '0.95rem',
            borderRadius: 2
          }}
        >
          Legg til Teammedlem
        </Button>
      )}
    </Box>
  );
};

export default ProjectCollaborators;