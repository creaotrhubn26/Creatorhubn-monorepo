import { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayArrow as PlayArrowIcon,
  Movie as MovieIcon,
  Videocam as VideocamIcon,
} from '@mui/icons-material';
import { TeamIcon as GroupsIcon, CalendarCustomIcon as CalendarIcon } from './icons/CastingIcons';
import LoginDialog from './LoginDialog';

interface CastingLandingPageProps {
  onEnter: () => void;
}

export function CastingLandingPage({ onEnter }: CastingLandingPageProps) {
  const [showIntro, setShowIntro] = useState(true);
  const [introPhase, setIntroPhase] = useState(0);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);

  // Memoize particle positions so they don't recalculate on every render
  const particlePositions = useMemo(() => 
    Array.from({ length: 20 }, () => ({
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
    })), []
  );

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    
    timers.push(setTimeout(() => setIntroPhase(1), 500));
    timers.push(setTimeout(() => setIntroPhase(2), 1800));
    timers.push(setTimeout(() => setIntroPhase(3), 3000));
    timers.push(setTimeout(() => setShowIntro(false), 4500));
    
    return () => timers.forEach(clearTimeout);
  }, []);

  const skipIntro = () => {
    setShowIntro(false);
  };

  const handleStartClick = () => {
    setLoginDialogOpen(true);
  };

  const handleLoginSuccess = (_user: { id: number; email: string; role: string; display_name: string }) => {
    setLoginDialogOpen(false);
    // Reload the page - the app will now show planner since user is authenticated
    window.location.reload();
  };

  const features = [
    { icon: <GroupsIcon sx={{ fontSize: 40 }} />, title: 'Rolleadministrasjon', desc: 'Opprett og administrer roller for produksjoner' },
    { icon: <MovieIcon sx={{ fontSize: 40 }} />, title: 'Kandidatdatabase', desc: 'Organiser kandidater med bilder og profiler' },
    { icon: <CalendarIcon sx={{ fontSize: 40 }} />, title: 'Timeplanlegging', desc: 'Planlegg auditions og innspillingsdager' },
    { icon: <VideocamIcon sx={{ fontSize: 40 }} />, title: 'Bildelister', desc: 'Lag detaljerte shot-lister for hver scene' },
  ];

  return (
    <Box sx={{ 
      width: '100%', 
      minHeight: '100vh', 
      bgcolor: '#0a0a0f',
      overflowX: loginDialogOpen ? 'visible' : 'hidden',
      overflowY: loginDialogOpen ? 'visible' : 'auto',
      position: 'relative',
    }}>
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0a0a0f',
              pointerEvents: showIntro ? 'auto' : 'none',
            }}
          >
            <Box sx={{ 
              position: 'absolute',
              inset: 0,
              overflow: 'hidden',
            }}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: introPhase >= 1 ? 0.15 : 0 }}
                transition={{ duration: 2 }}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '200vmax',
                  height: '200vmax',
                  background: 'radial-gradient(circle, #8b5cf6 0%, transparent 50%)',
                }}
              />
              
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: introPhase >= 2 ? [0, 0.6, 0] : 0,
                    scale: introPhase >= 2 ? [0, 1, 1.5] : 0,
                  }}
                  transition={{ 
                    duration: 3,
                    delay: i * 0.1,
                    repeat: Infinity,
                    repeatDelay: 2,
                  }}
                  style={{
                    position: 'absolute',
                    top: particlePositions[i].top,
                    left: particlePositions[i].left,
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: '#8b5cf6',
                  }}
                />
              ))}
            </Box>

            <Box sx={{ textAlign: 'center', zIndex: 10 }}>
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ 
                  scale: introPhase >= 1 ? 1 : 0,
                  rotate: introPhase >= 1 ? 0 : -180,
                }}
                transition={{ 
                  type: 'spring',
                  stiffness: 200,
                  damping: 20,
                  duration: 1.2,
                }}
              >
                <img
                  src="/casting-planner-logo.png"
                  alt="Casting Planner"
                  style={{
                    width: 160,
                    height: 160,
                    borderRadius: 16,
                    boxShadow: '0 0 60px rgba(139, 92, 246, 0.5)',
                  }}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ 
                  opacity: introPhase >= 2 ? 1 : 0,
                  y: introPhase >= 2 ? 0 : 30,
                }}
                transition={{ duration: 0.8 }}
              >
                <Typography
                  variant="h2"
                  sx={{
                    mt: 4,
                    fontWeight: 700,
                    fontSize: { xs: '2rem', sm: '3rem', md: '4rem' },
                    background: 'linear-gradient(135deg, #fff 0%, #8b5cf6 50%, #6366f1 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Casting Planner
                </Typography>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ 
                  opacity: introPhase >= 3 ? 1 : 0,
                }}
                transition={{ duration: 0.6 }}
              >
                <Typography
                  sx={{
                    mt: 2,
                    color: 'rgba(255,255,255,0.87)',
                    fontSize: { xs: '1rem', sm: '1.25rem' },
                    fontWeight: 300,
                    letterSpacing: '0.1em',
                  }}
                >
                  Profesjonell casting og produksjonsplanlegging
                </Typography>
              </motion.div>
            </Box>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              style={{
                position: 'absolute',
                bottom: 40,
                right: 40,
              }}
            >
              <Button
                onClick={skipIntro}
                sx={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '0.85rem',
                  '&:hover': { color: 'rgba(255,255,255,0.8)' },
                }}
              >
                Hopp over
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: showIntro ? 0 : 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Box sx={{
          background: 'linear-gradient(180deg, rgba(139,92,246,0.1) 0%, transparent 50%)',
          minHeight: '100vh',
        }}>
          <Container maxWidth="lg" sx={{ pt: { xs: 8, md: 12 }, pb: 8 }}>
            <Box sx={{ textAlign: 'center', mb: 10 }}>
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.8 }}
              >
                <img
                  src="/casting-planner-logo.png"
                  alt="Casting Planner"
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 12,
                    marginBottom: 24,
                    boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3)',
                  }}
                />
              </motion.div>

              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.8 }}
              >
                <Typography
                  variant="h1"
                  sx={{
                    fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
                    fontWeight: 800,
                    color: '#fff',
                    mb: 2,
                    lineHeight: 1.1,
                  }}
                >
                  Din komplette{' '}
                  <Box component="span" sx={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>
                    casting-løsning
                  </Box>
                </Typography>
              </motion.div>

              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.8 }}
              >
                <Typography
                  sx={{
                    fontSize: { xs: '1.1rem', sm: '1.25rem' },
                    color: 'rgba(255,255,255,0.87)',
                    maxWidth: 600,
                    mx: 'auto',
                    mb: 5,
                    lineHeight: 1.7,
                  }}
                >
                  Planlegg produksjoner, administrer roller og kandidater, 
                  og hold oversikt over hele casting-prosessen fra én plattform.
                </Typography>
              </motion.div>

              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.1, duration: 0.8 }}
              >
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleStartClick}
                  startIcon={<PlayArrowIcon />}
                  sx={{
                    px: 5,
                    py: 2,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                    boxShadow: '0 8px 32px rgba(139, 92, 246, 0.4)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #9b6cf6 0%, #7376f1 100%)',
                      boxShadow: '0 12px 40px rgba(139, 92, 246, 0.5)',
                      transform: 'translateY(-2px)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  Start Casting Planner
                </Button>
              </motion.div>
            </Box>

            <Box sx={{ 
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
              gap: 3,
            }}>
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1.3 + index * 0.15, duration: 0.6 }}
                >
                  <Box sx={{
                    p: 4,
                    borderRadius: 3,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      bgcolor: 'rgba(139,92,246,0.1)',
                      borderColor: 'rgba(139,92,246,0.3)',
                      transform: 'translateY(-4px)',
                    },
                  }}>
                    <Box sx={{ 
                      color: '#8b5cf6',
                      mb: 2,
                    }}>
                      {feature.icon}
                    </Box>
                    <Typography sx={{ 
                      color: '#fff', 
                      fontWeight: 600,
                      fontSize: '1.1rem',
                      mb: 1,
                    }}>
                      {feature.title}
                    </Typography>
                    <Typography sx={{ 
                      color: 'rgba(255,255,255,0.87)',
                      fontSize: '0.9rem',
                      lineHeight: 1.5,
                    }}>
                      {feature.desc}
                    </Typography>
                  </Box>
                </motion.div>
              ))}
            </Box>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.2, duration: 1 }}
            >
              <Box sx={{ 
                mt: 12, 
                textAlign: 'center',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}>
                <Typography>
                  En del av
                </Typography>
                <img 
                  src="/creatorhub-virtual-studio-logo.svg" 
                  alt="CreatorHub Virtual Studio"
                  style={{ 
                    height: '40px',
                    opacity: 0.7,
                    filter: 'brightness(1.2)',
                  }}
                />
              </Box>
            </motion.div>
          </Container>
        </Box>
      </motion.div>

      <LoginDialog
        open={loginDialogOpen}
        onClose={() => setLoginDialogOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        isLandingPage={true}
      />
    </Box>
  );
}
