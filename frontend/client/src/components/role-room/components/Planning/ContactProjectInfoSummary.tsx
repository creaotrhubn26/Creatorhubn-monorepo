import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Box,
  Divider,
  Chip,
} from '@mui/material';
import {
  Person,
  Folder,
  Email,
  Phone,
  Event,
  People,
  Business,
  Label,
} from '@mui/icons-material';
import { LocationsIcon as LocationOn } from '../icons/CastingIcons';

interface ContactProjectInfoSummaryProps {
  projectId?: string | number;
  sessionId?: string;
  guestCount?: string | number;
  eventDate?: string;
  eventDates?: Record<number, string>;
  location?: string;
  projectType?: string;
  showProjectType?: boolean; // Only show project type if explicitly set to true
  selectedContact?: {
    displayName?: string;
    email?: string;
    phone?: string;
    companyName?: string;
  } | null;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
}

export const ContactProjectInfoSummary: React.FC<ContactProjectInfoSummaryProps> = ({
  projectId,
  sessionId,
  guestCount,
  eventDate,
  eventDates,
  location,
  projectType,
  showProjectType = false, // Default to false - only show if explicitly enabled
  selectedContact,
  clientName,
  clientEmail,
  clientPhone,
}) => {
  const displayName = selectedContact?.displayName || clientName || '-';
  const displayEmail = selectedContact?.email || clientEmail || '-';
  const displayPhone = selectedContact?.phone || clientPhone || '-';

  return (
    <Card 
      sx={{ 
        mt: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 }, 
        mb: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
        borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        transition: 'box-shadow 0.3s ease',
        '&:hover': {
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
        }
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
        <Typography 
          variant="h6" 
          gutterBottom 
          sx={{ 
            fontWeight: 700, 
            fontSize: { xs: '1.063rem', sm: '1.125rem', md: '1.188rem', lg: '1.25rem', xl: '1.313rem' },
            display: 'flex', 
            alignItems: 'center', 
            gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 },
            mb: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
            color: 'text.primary'
          }}
        >
          <Person sx={{ color: 'primary.main', fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
          Kontakt & Prosjekt-info
        </Typography>
        <Divider sx={{ mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }} />
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 }}>
          {/* Prosjekt Info Section */}
          <Box 
            sx={{ 
              flex: 1,
              p: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
              borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
              bgcolor: 'rgba(25, 118, 210, 0.04)',
              border: '1px solid rgba(25, 118, 210, 0.1)'
            }}
          >
            <Typography 
              variant="subtitle1" 
              sx={{ 
                fontWeight: 700,
                fontSize: { xs: '0.938rem', sm: '0.969rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                display: 'flex', 
                alignItems: 'center', 
                gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 },
                mb: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
                color: 'text.primary'
              }}
            >
              <Folder sx={{ color: 'primary.main', fontSize: { xs: 18, sm: 19, md: 20, lg: 21, xl: 22 } }} />
              Prosjekt
            </Typography>
            <Stack spacing={{ xs: 1.25, sm: 1.5, md: 1.75, lg: 2, xl: 2.25 }}>
              {projectId && (
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
                  p: { xs: 1.5, sm: 1.75, md: 2, lg: 2.25, xl: 2.5 },
                  borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
                  bgcolor: 'rgba(0, 212, 255, 0.1)',
                  border: '2px solid rgba(0, 212, 255, 0.3)',
                }}>
                  <Label sx={{ fontSize: { xs: 18, sm: 19, md: 20, lg: 21, xl: 22 }, color: 'primary.main' }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontWeight: 700,
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem', lg: '0.85rem', xl: '0.9rem' },
                        color: 'primary.main',
                        textTransform: 'uppercase',
                        letterSpacing: { xs: '0.5px', sm: '0.75px', md: '1px', lg: '1.25px', xl: '1.5px' },
                        display: 'block',
                        mb: { xs: 0.375, sm: 0.5, md: 0.625, lg: 0.75, xl: 0.875 }
                      }}
                    >
                      Prosjekt-ID
                    </Typography>
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        fontWeight: 700, 
                        color: 'primary.main', 
                        fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                        fontFamily: 'monospace',
                        letterSpacing: { xs: '0.3px', sm: '0.4px', md: '0.5px', lg: '0.6px', xl: '0.75px' },
                      }}
                    >
                      {projectId}
                    </Typography>
                  </Box>
                </Box>
              )}
              {!projectId && sessionId && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Label sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Box>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        display: 'block',
                        mb: 0.5
                      }}
                    >
                      Draft ID
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.95rem' }}>
                      {sessionId}
                    </Typography>
                  </Box>
                </Box>
              )}
              {!projectId && !sessionId && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Label sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary', fontSize: '0.875rem' }}>
                    Ikke opprettet enda
                  </Typography>
                </Box>
              )}
              {showProjectType && projectType && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Folder sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Box>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        display: 'block',
                        mb: 0.5
                      }}
                    >
                      Prosjekttype
                    </Typography>
                    <Chip 
                      label={projectType} 
                      size="small" 
                      sx={{ 
                        mt: 0.5,
                        fontWeight: 600,
                        fontSize: '0.813rem'
                      }}
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                </Box>
              )}
              {guestCount && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <People sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Box>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        display: 'block',
                        mb: 0.5
                      }}
                    >
                      Gjester
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.95rem' }}>
                      {guestCount}
                    </Typography>
                  </Box>
                </Box>
              )}
              {(eventDate || (eventDates && Object.keys(eventDates).length > 0)) && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Event sx={{ fontSize: 18, color: 'text.secondary', mt: 0.5 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        display: 'block',
                        mb: 0.5
                      }}
                    >
                      {eventDates && Object.keys(eventDates).length > 0 ? 'Datoer' : 'Dato'}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.95rem' }}>
                      {eventDates && Object.keys(eventDates).length > 0
                        ? Object.keys(eventDates)
                            .sort((a, b) => Number(a) - Number(b))
                            .map((k) => eventDates[Number(k)])
                            .join(', ')
                        : eventDate || '-'}
                    </Typography>
                  </Box>
                </Box>
              )}
              {location && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <LocationOn sx={{ fontSize: 18, color: 'text.secondary', mt: 0.5 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        display: 'block',
                        mb: 0.5
                      }}
                    >
                      Lokasjon
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.95rem' }}>
                      {location}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Stack>
          </Box>

          {/* Kontakt Section */}
          <Box 
            sx={{ 
              flex: 1,
              p: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
              borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
              bgcolor: 'rgba(156, 39, 176, 0.04)',
              border: '1px solid rgba(156, 39, 176, 0.1)'
            }}
          >
            <Typography 
              variant="subtitle1" 
              sx={{ 
                fontWeight: 700,
                fontSize: { xs: '0.938rem', sm: '0.969rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
                display: 'flex', 
                alignItems: 'center', 
                gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 },
                mb: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
                color: 'text.primary'
              }}
            >
              <Person sx={{ color: 'secondary.main', fontSize: { xs: 18, sm: 19, md: 20, lg: 21, xl: 22 } }} />
              Kontakt
            </Typography>
            <Stack spacing={{ xs: 1.25, sm: 1.5, md: 1.75, lg: 2, xl: 2.25 }}>
              {displayName && displayName !== '-' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>
                  <Person sx={{ fontSize: { xs: 16, sm: 17, md: 18, lg: 19, xl: 20 }, color: 'text.secondary' }} />
                  <Box>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontWeight: 600,
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem', lg: '0.85rem', xl: '0.9rem' },
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        letterSpacing: { xs: '0.3px', sm: '0.4px', md: '0.5px', lg: '0.6px', xl: '0.75px' },
                        display: 'block',
                        mb: { xs: 0.375, sm: 0.5, md: 0.625, lg: 0.75, xl: 0.875 }
                      }}
                    >
                      Navn
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', fontSize: { xs: '0.875rem', sm: '0.938rem', md: '0.95rem', lg: '1rem', xl: '1.063rem' } }}>
                      {displayName}
                    </Typography>
                  </Box>
                </Box>
              )}
              {displayEmail && displayEmail !== '-' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>
                  <Email sx={{ fontSize: { xs: 16, sm: 17, md: 18, lg: 19, xl: 20 }, color: 'text.secondary' }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontWeight: 600,
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem', lg: '0.85rem', xl: '0.9rem' },
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        letterSpacing: { xs: '0.3px', sm: '0.4px', md: '0.5px', lg: '0.6px', xl: '0.75px' },
                        display: 'block',
                        mb: { xs: 0.375, sm: 0.5, md: 0.625, lg: 0.75, xl: 0.875 }
                      }}
                    >
                      E-post
                    </Typography>
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        fontWeight: 600,
                        color: 'text.primary',
                        fontSize: { xs: '0.875rem', sm: '0.938rem', md: '0.95rem', lg: '1rem', xl: '1.063rem' },
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word'
                      }}
                    >
                      {displayEmail}
                    </Typography>
                  </Box>
                </Box>
              )}
              {displayPhone && displayPhone !== '-' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 } }}>
                  <Phone sx={{ fontSize: { xs: 16, sm: 17, md: 18, lg: 19, xl: 20 }, color: 'text.secondary' }} />
                  <Box>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontWeight: 600,
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem', lg: '0.85rem', xl: '0.9rem' },
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        letterSpacing: { xs: '0.3px', sm: '0.4px', md: '0.5px', lg: '0.6px', xl: '0.75px' },
                        display: 'block',
                        mb: { xs: 0.375, sm: 0.5, md: 0.625, lg: 0.75, xl: 0.875 }
                      }}
                    >
                      Telefon
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', fontSize: { xs: '0.875rem', sm: '0.938rem', md: '0.95rem', lg: '1rem', xl: '1.063rem' } }}>
                      {displayPhone}
                    </Typography>
                  </Box>
                </Box>
              )}
              {selectedContact?.companyName && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Business sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Box>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        display: 'block',
                        mb: 0.5
                      }}
                    >
                      Firma
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.95rem' }}>
                      {selectedContact.companyName}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};


