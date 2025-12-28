/**
 * CreatorHub Norge Community - Welcome Onboarding Dialog
 * 
 * Interactive onboarding flow for new community members
 * Solves: "Hard to onboard - no welcome map" problem
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Alert,
  LinearProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  WavingHand as Waving,
  EmojiPeople,
  Forum,
  Gavel as Rule,
  EmojiEvents,
  CheckCircle,
  Close,
  ArrowForward,
  ArrowBack,
  Lightbulb,
  Celebration,
  RocketLaunch,
  PersonAdd,
  Search,
  Chat,
  Handshake,
  Star,
  School,
  WorkspacePremium,
  ThumbUp,
} from '@mui/icons-material';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';

interface WelcomeOnboardingDialogProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  onComplete: () => void;
}

export default function WelcomeOnboardingDialog({
  open,
  onClose,
  userName,
  onComplete,
}: WelcomeOnboardingDialogProps) {
  const [activeStep, setActiveStep] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();

  const steps = [
    {
      label: 'Velkommen til CreatorHub Norge!',
      icon: <Waving />,
      content: (
        <Box>
          <Typography
            variant="h6"
            sx={{
              color: '#fff',
              fontWeight: 700,
              mb: 1.5,
              fontSize: { xs: '1.2rem', sm: '1.4rem', md: '1.6rem' },
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            Velkommen til fellesskapet
            <Waving sx={{ color: '#f59e0b', fontSize: { xs: 24, sm: 28, md: 32 } }} />
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'rgba(255, 255, 255, 0.9)',
              mb: 2.5,
              fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' },
              lineHeight: 1.7,
            }}
          >
            Dette er din guide til å bli en aktiv del av Norges største kreative fellesskap. Bruk <Box component="strong" sx={{ color: '#f59e0b', fontWeight: 600 }}>5-10 minutter</Box> på denne guiden for å komme raskt i gang.
          </Typography>
          
          {/* Profession-specific section */}
          <Paper
            sx={{
              p: { xs: 2, sm: 2.5 },
              background: 'rgba(26, 26, 46, 0.6)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: '12px',
              mb: 2.5,
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                color: '#f59e0b',
                fontWeight: 600,
                mb: 1,
                fontSize: { xs: '0.9rem', sm: '0.95rem', md: '1rem' },
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Star sx={{ fontSize: { xs: 18, sm: 20 }, color: '#f59e0b' }} />
              Tilpasset for deg som {getProfessionDisplayName()}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.95rem' },
              }}
            >
              Denne guiden er tilpasset din profesjon. Du vil se tips og kanaler som er relevante for {getProfessionDisplayName().toLowerCase()}-miljøet.
            </Typography>
          </Paper>
          
          {/* What you'll learn section */}
          <Typography
            variant="subtitle1"
            sx={{
              color: '#fff',
              fontWeight: 600,
              mb: 2,
              fontSize: { xs: '1rem', sm: '1.1rem', md: '1.2rem' },
            }}
          >
            Hva du vil lære:
          </Typography>
          <List sx={{ '& .MuiListItem-root': { mb: 1, px: 0 } }}>
            {[
              'Navigere i kanaler og grupper',
              'Sende meldinger med emoji og vedlegg',
              'Starte private samtaler',
              'Delta i avstemninger og polls',
              'Få hjelp fra mentorer',
              'Tjene badges og poeng',
            ].map((item, index) => (
              <ListItem key={index} sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <CheckCircle sx={{ color: '#10b981', fontSize: { xs: 18, sm: 20 } }} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography
                      sx={{
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.95rem' },
                      }}
                    >
                      {item}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
          <Paper
            sx={{
              p: 2.5,
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 88, 12, 0.08) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '12px',
              mt: 2,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' },
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Lightbulb sx={{ fontSize: { xs: 18, sm: 20, md: 22 }, color: '#f59e0b', mr: 0.5 }} />
              Dette tar bare 2 minutter, og du kan alltid hoppe over.
            </Typography>
          </Paper>
        </Box>
      ),
    },
    {
      label: 'Hvordan fungerer community?',
      icon: <Forum />,
      content: (
        <Box>
          <Typography
            variant="h6"
            sx={{
              color: '#fff',
              fontWeight: 600,
              mb: 3,
              fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.5rem' },
            }}
          >
            Her er det viktigste du trenger å vite:
          </Typography>
          <List sx={{ '& .MuiListItem-root': { mb: 1.5 } }}>
            <ListItem
              sx={{
                background: 'rgba(26, 26, 46, 0.6)',
                borderRadius: '12px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                p: 2,
              }}
            >
              <ListItemIcon>
                <CheckCircle sx={{ color: '#10b981', fontSize: { xs: 24, sm: 28, md: 32 } }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography
                    sx={{
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' },
                      mb: 0.5,
                    }}
                  >
                    Kanaler
                  </Typography>
                }
                secondary={
                  <Typography
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.95rem' },
                    }}
                  >
                    Hver kanal har et spesifikt tema (f.eks. #color-grading, #lighting)
                  </Typography>
                }
              />
            </ListItem>
            <ListItem
              sx={{
                background: 'rgba(26, 26, 46, 0.6)',
                borderRadius: '12px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                p: 2,
              }}
            >
              <ListItemIcon>
                <CheckCircle sx={{ color: '#10b981', fontSize: { xs: 24, sm: 28, md: 32 } }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography
                    sx={{
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' },
                      mb: 0.5,
                    }}
                  >
                    Tråder
                  </Typography>
                }
                secondary={
                  <Typography
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.95rem' },
                    }}
                  >
                    Svar på meldinger for å starte en tråd. Hold diskusjoner organisert!
                  </Typography>
                }
              />
            </ListItem>
            <ListItem
              sx={{
                background: 'rgba(26, 26, 46, 0.6)',
                borderRadius: '12px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                p: 2,
              }}
            >
              <ListItemIcon>
                <CheckCircle sx={{ color: '#10b981', fontSize: { xs: 24, sm: 28, md: 32 } }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography
                    sx={{
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' },
                      mb: 0.5,
                    }}
                  >
                    Reaksjoner
                  </Typography>
                }
                secondary={
                  <Typography
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.95rem' },
                    }}
                  >
                    Bruk emojis for å reagere på innlegg uten å spamme tråden
                  </Typography>
                }
              />
            </ListItem>
            <ListItem
              sx={{
                background: 'rgba(26, 26, 46, 0.6)',
                borderRadius: '12px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                p: 2,
              }}
            >
              <ListItemIcon>
                <CheckCircle sx={{ color: '#10b981', fontSize: { xs: 24, sm: 28, md: 32 } }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography
                    sx={{
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' },
                      mb: 0.5,
                    }}
                  >
                    Søk
                  </Typography>
                }
                secondary={
                  <Typography
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.95rem' },
                    }}
                  >
                    Bruk søkefunksjonen før du spør - noen har kanskje allerede svart!
                  </Typography>
                }
              />
            </ListItem>
          </List>
        </Box>
      ),
    },
    {
      label: 'Retningslinjer',
      icon: <Rule />,
      content: (
        <Box>
          <Typography
            variant="h6"
            sx={{
              color: '#fff',
              fontWeight: 600,
              mb: 3,
              fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.5rem' },
            }}
          >
            For å holde community høykvalitet, følg disse reglene:
          </Typography>
          <Paper
            sx={{
              p: { xs: 2, sm: 2.5, md: 3 },
              mt: 2,
              background: 'rgba(26, 26, 46, 0.8)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '16px',
            }}
          >
            <List sx={{ '& .MuiListItem-root': { mb: 1.5, px: 0 } }}>
              <ListItem>
                <Typography
                  sx={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: { xs: '0.9rem', sm: '0.95rem', md: '1rem' },
                  }}
                >
                  <CheckCircle sx={{ color: '#10b981', fontSize: { xs: 18, sm: 20, md: 22 }, mr: 1 }} />
                  <Box component="strong" sx={{ color: '#fff', fontWeight: 600 }}>Vær respektfull</Box> - Alle nivåer er velkomne
                </Typography>
              </ListItem>
              <ListItem>
                <Typography
                  sx={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: { xs: '0.9rem', sm: '0.95rem', md: '1rem' },
                  }}
                >
                  <CheckCircle sx={{ color: '#10b981', fontSize: { xs: 18, sm: 20, md: 22 }, mr: 1 }} />
                  <Box component="strong" sx={{ color: '#fff', fontWeight: 600 }}>Hold deg til temaet</Box> - Bruk riktig kanal
                </Typography>
              </ListItem>
              <ListItem>
                <Typography
                  sx={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: { xs: '0.9rem', sm: '0.95rem', md: '1rem' },
                  }}
                >
                  <CheckCircle sx={{ color: '#10b981', fontSize: { xs: 18, sm: 20, md: 22 }, mr: 1 }} />
                  <Box component="strong" sx={{ color: '#fff', fontWeight: 600 }}>Søk først</Box> - Unngå duplikater
                </Typography>
              </ListItem>
              <ListItem>
                <Typography
                  sx={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: { xs: '0.9rem', sm: '0.95rem', md: '1rem' },
                  }}
                >
                  <CheckCircle sx={{ color: '#10b981', fontSize: { xs: 18, sm: 20, md: 22 }, mr: 1 }} />
                  <Box component="strong" sx={{ color: '#fff', fontWeight: 600 }}>Del kunnskap</Box> - Hjelp andre når du kan
                </Typography>
              </ListItem>
              <ListItem>
                <Typography
                  sx={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: { xs: '0.9rem', sm: '0.95rem', md: '1rem' },
                  }}
                >
                  <Close sx={{ color: '#ef4444', fontSize: { xs: 18, sm: 20, md: 22 }, mr: 1 }} />
                  <Box component="strong" sx={{ color: '#fff', fontWeight: 600 }}>Ingen spam</Box> - Ikke reklame uten tillatelse
                </Typography>
              </ListItem>
              <ListItem>
                <Typography
                  sx={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: { xs: '0.9rem', sm: '0.95rem', md: '1rem' },
                  }}
                >
                  <Close sx={{ color: '#ef4444', fontSize: { xs: 18, sm: 20, md: 22 }, mr: 1 }} />
                  <Box component="strong" sx={{ color: '#fff', fontWeight: 600 }}>Ingen gatekeeping</Box> - Alle kan lære
                </Typography>
              </ListItem>
            </List>
          </Paper>
        </Box>
      ),
    },
    {
      label: 'Badges & Progresjon',
      icon: <EmojiEvents />,
      content: (
        <Box>
          <Typography
            variant="h6"
            sx={{
              color: '#fff',
              fontWeight: 600,
              mb: 3,
              fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.5rem' },
            }}
          >
            Tjen badges ved å være aktiv i community:
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: { xs: 1, sm: 1.5 },
              mt: 2,
            }}
          >
            <Chip
              icon={<Celebration sx={{ fontSize: { xs: 16, sm: 18, md: 20 }, color: '#10b981' }} />}
              label="Første Melding"
              sx={{
                bgcolor: 'rgba(16, 185, 129, 0.2)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' },
                height: { xs: '32px', sm: '36px', md: '40px' },
                fontWeight: 600,
              }}
            />
            <Chip
              icon={<Star sx={{ fontSize: { xs: 16, sm: 18, md: 20 }, color: '#3b82f6' }} />}
              label="Aktivt Medlem"
              sx={{
                bgcolor: 'rgba(59, 130, 246, 0.2)',
                color: '#3b82f6',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' },
                height: { xs: '32px', sm: '36px', md: '40px' },
                fontWeight: 600,
              }}
            />
            <Chip
              icon={<Handshake sx={{ fontSize: { xs: 16, sm: 18, md: 20 }, color: '#f59e0b' }} />}
              label="Hjelpsom"
              sx={{
                bgcolor: 'rgba(245, 158, 11, 0.2)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' },
                height: { xs: '32px', sm: '36px', md: '40px' },
                fontWeight: 600,
              }}
            />
            <Chip
              icon={<School sx={{ fontSize: { xs: 16, sm: 18, md: 20 }, color: '#8b5cf6' }} />}
              label="Mentor"
              sx={{
                bgcolor: 'rgba(139, 92, 246, 0.2)',
                color: '#8b5cf6',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' },
                height: { xs: '32px', sm: '36px', md: '40px' },
                fontWeight: 600,
              }}
            />
            <Chip
              icon={<WorkspacePremium sx={{ fontSize: { xs: 16, sm: 18, md: 20 }, color: '#FFD700' }} />}
              label="Toppbidragsyter"
              sx={{
                bgcolor: 'rgba(255, 215, 0, 0.2)',
                color: '#FFD700',
                border: '1px solid rgba(255, 215, 0, 0.3)',
                fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' },
                height: { xs: '32px', sm: '36px', md: '40px' },
                fontWeight: 600,
              }}
            />
          </Box>
          <Paper
            sx={{
              p: 2.5,
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.08) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              mt: 3,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' },
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Lightbulb sx={{ fontSize: { xs: 18, sm: 20, md: 22 }, color: '#10b981', mr: 0.5 }} />
              Send din første melding for å tjene "Første Melding" badge!
            </Typography>
          </Paper>
        </Box>
      ),
    },
    {
      label: 'Du er klar!',
      icon: <RocketLaunch />,
      content: (
        <Box>
          <Typography
            variant="h6"
            sx={{
              color: '#fff',
              fontWeight: 700,
              mb: 2,
              fontSize: { xs: '1.3rem', sm: '1.5rem', md: '1.7rem' },
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            Perfekt! Du er nå klar til å delta i community.
            <Celebration sx={{ color: '#f59e0b', fontSize: { xs: 24, sm: 28, md: 32 } }} />
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'rgba(255, 255, 255, 0.8)',
              mb: 3,
              fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' },
            }}
          >
            Her er noen forslag til hvordan du kan starte:
          </Typography>
          <List sx={{ '& .MuiListItem-root': { mb: 1.5 } }}>
            <ListItem
              sx={{
                background: 'rgba(26, 26, 46, 0.6)',
                borderRadius: '12px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                p: 2,
              }}
            >
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: { xs: '0.9rem', sm: '0.95rem', md: '1rem' },
                }}
              >
                <PersonAdd sx={{ fontSize: { xs: 20, sm: 22, md: 24 }, color: '#f59e0b', mr: 1.5 }} />
                Presenter deg selv i <Box component="strong" sx={{ color: '#f59e0b', fontWeight: 600 }}>#general</Box>
              </Typography>
            </ListItem>
            <ListItem
              sx={{
                background: 'rgba(26, 26, 46, 0.6)',
                borderRadius: '12px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                p: 2,
              }}
            >
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: { xs: '0.9rem', sm: '0.95rem', md: '1rem' },
                }}
              >
                <Search sx={{ fontSize: { xs: 20, sm: 22, md: 24 }, color: '#f59e0b', mr: 1.5 }} />
                Utforsk kanaler og finn temaer du er interessert i
              </Typography>
            </ListItem>
            <ListItem
              sx={{
                background: 'rgba(26, 26, 46, 0.6)',
                borderRadius: '12px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                p: 2,
              }}
            >
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: { xs: '0.9rem', sm: '0.95rem', md: '1rem' },
                }}
              >
                <Chat sx={{ fontSize: { xs: 20, sm: 22, md: 24 }, color: '#f59e0b', mr: 1.5 }} />
                Still spørsmål - vi er her for å hjelpe!
              </Typography>
            </ListItem>
            <ListItem
              sx={{
                background: 'rgba(26, 26, 46, 0.6)',
                borderRadius: '12px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                p: 2,
              }}
            >
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: { xs: '0.9rem', sm: '0.95rem', md: '1rem' },
                }}
              >
                <Handshake sx={{ fontSize: { xs: 20, sm: 22, md: 24 }, color: '#f59e0b', mr: 1.5 }} />
                Hjelp andre når du kan - det er slik vi vokser sammen
              </Typography>
            </ListItem>
          </List>
        </Box>
      ),
    },
  ];

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      onComplete();
      onClose();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSkip = () => {
    onComplete();
    onClose();
  };

  // Calculate progress
  const progress = ((activeStep + 1) / steps.length) * 100;

  return (
    <Dialog
      open={open}
      onClose={handleSkip}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1a1a2e',
          backgroundImage: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: { xs: '16px', sm: '20px', md: '24px' },
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(245, 158, 11, 0.1)',
          maxHeight: { xs: '90vh', sm: '85vh' },
          overflow: 'hidden',
        },
      }}
    >
      {/* Progress Bar */}
      <Box
        sx={{
          position: 'relative',
          height: '4px',
          background: 'rgba(245, 158, 11, 0.1)',
        }}
      >
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: '4px',
            background: 'rgba(245, 158, 11, 0.1)',
            '& .MuiLinearProgress-bar': {
              background: 'linear-gradient(90deg, #f59e0b 0%, #ea580c 100%)',
            },
          }}
        />
      </Box>

      <DialogTitle
        sx={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 88, 12, 0.08) 100%)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
          pb: { xs: 2.5, sm: 3 },
          pt: { xs: 3, sm: 3.5 },
          px: { xs: 2.5, sm: 3, md: 4 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 }, flex: 1 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(234, 88, 12, 0.1) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {React.cloneElement(steps[activeStep].icon, {
                sx: {
                  fontSize: { xs: 28, sm: 32, md: 36 },
                  color: '#f59e0b',
                },
              })}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="h5"
                sx={{
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: { xs: '1.3rem', sm: '1.5rem', md: '1.7rem' },
                  mb: 0.5,
                }}
              >
                Velkommen til Fellesskapet
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.95rem' },
                }}
              >
                Din komplette guide til CreatorHub Norge Community
              </Typography>
            </Box>
          </Box>
          <Button
            onClick={handleSkip}
            sx={{
              minWidth: 'auto',
              width: { xs: 36, sm: 40 },
              height: { xs: 36, sm: 40 },
              borderRadius: '50%',
              color: 'rgba(255, 255, 255, 0.7)',
              '&:hover': {
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#f59e0b',
              },
            }}
          >
            <Close />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          px: { xs: 2.5, sm: 3, md: 4 },
          py: { xs: 3, sm: 3.5, md: 4 },
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(0, 0, 0, 0.1)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(245, 158, 11, 0.3)',
            borderRadius: '4px',
            '&:hover': {
              background: 'rgba(245, 158, 11, 0.5)',
            },
          },
        }}
      >
        <Stepper
          activeStep={activeStep}
          orientation="vertical"
          sx={{
            '& .MuiStep-root': {
              '& .MuiStepLabel-root': {
                '& .MuiStepLabel-label': {
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: { xs: '1rem', sm: '1.1rem', md: '1.2rem' },
                  '&.Mui-active': {
                    color: '#f59e0b',
                  },
                  '&.Mui-completed': {
                    color: '#10b981',
                  },
                },
                '& .MuiStepLabel-iconContainer': {
                  '& .MuiSvgIcon-root': {
                    color: 'rgba(255, 255, 255, 0.3)',
                    fontSize: { xs: 28, sm: 32 },
                    '&.Mui-active': {
                      color: '#f59e0b',
                    },
                    '&.Mui-completed': {
                      color: '#10b981',
                    },
                  },
                },
              },
              '& .MuiStepContent-root': {
                borderLeft: '2px solid rgba(245, 158, 11, 0.2)',
                pl: { xs: 3, sm: 4 },
                mt: 2,
              },
            },
          }}
        >
          {steps.map((step, index) => (
            <Step key={step.label} completed={index < activeStep}>
              <StepLabel>{step.label}</StepLabel>
              <StepContent>
                {step.content}
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>

      <DialogActions
        sx={{
          px: { xs: 2.5, sm: 3, md: 4 },
          py: { xs: 2, sm: 2.5 },
          borderTop: '1px solid rgba(245, 158, 11, 0.2)',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, transparent 100%)',
          gap: { xs: 1, sm: 1.5 },
        }}
      >
        <Button
          onClick={handleSkip}
          sx={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' },
            '&:hover': {
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'rgba(255, 255, 255, 0.9)',
            },
          }}
        >
          Hopp over
        </Button>
        {activeStep > 0 && (
          <Button
            onClick={handleBack}
            startIcon={<ArrowBack />}
            sx={{
              color: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' },
              minHeight: { xs: '44px', sm: '48px' },
              px: { xs: 2, sm: 2.5 },
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.1)',
                borderColor: 'rgba(255, 255, 255, 0.3)',
              },
            }}
          >
            Tilbake
          </Button>
        )}
        <Button
          onClick={handleNext}
          variant="contained"
          endIcon={<ArrowForward />}
          sx={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
            color: '#fff',
            fontWeight: 600,
            fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' },
            minHeight: { xs: '44px', sm: '48px' },
            px: { xs: 2.5, sm: 3 },
            borderRadius: { xs: '10px', sm: '12px' },
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
            '&:hover': {
              background: 'linear-gradient(135deg, #d97706 0%, #c2410c 100%)',
              boxShadow: '0 6px 16px rgba(245, 158, 11, 0.4)',
            },
          }}
        >
          {activeStep === steps.length - 1 ? 'Kom i gang!' : 'Neste'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

