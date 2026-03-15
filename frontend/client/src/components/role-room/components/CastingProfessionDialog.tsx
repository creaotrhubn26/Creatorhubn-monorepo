import { useState, useRef, useEffect, type SyntheticEvent } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Card,
  CardActionArea,
  Collapse,
} from '@mui/material';
import {
  PhotoCamera as PhotoCameraIcon,
  Videocam as VideocamIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Person as PersonIcon,
  SupervisorAccount as SupervisorAccountIcon,
  Movie as MovieIcon,
  CameraAlt as CameraAltIcon,
  Face as FaceIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import authSessionService from '../services/authSessionService';
import { TeamIcon as GroupsIcon } from './icons/CastingIcons';
import { motion, AnimatePresence } from 'framer-motion';

export type CastingProfessionCategory = 'foto' | 'video' | 'felles' | 'admin';
export type CastingProfessionSelection = {
  categoryId: CastingProfessionCategory;
  roleId: string;
};

interface CastingProfessionDialogProps {
  open: boolean;
  onSelect: (selection: CastingProfessionSelection) => void;
}

const professionCategories = [
  {
    id: 'admin' as const,
    name: 'Admin',
    description: 'Administrasjon og ledelse',
    logo: '/role-admin.png',
    icon: SettingsIcon,
    color: '#ef4444',
    gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%)',
    glowColor: 'rgba(239, 68, 68, 0.4)',
    roles: [
      { id: 'owner', label: 'Eier', description: 'Full tilgang til alt', icon: SupervisorAccountIcon },
      { id: 'admin', label: 'Administrator', description: 'Brukeradministrasjon og innstillinger', icon: SettingsIcon },
    ],
  },
  {
    id: 'foto' as const,
    name: 'Foto',
    description: 'Stillbilder og fotoprosjekter',
    logo: '/role-foto.png',
    icon: PhotoCameraIcon,
    color: '#10b981',
    gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    roles: [
      { id: 'photographer', label: 'Fotograf', description: 'Leder fotoshoots', icon: PhotoCameraIcon },
      { id: 'film_photographer', label: 'Innholdsprodusent', description: 'Storyboard, manus og leveranser', icon: MovieIcon },
      { id: 'photo_director', label: 'Fotodirektør', description: 'Kreativ ledelse for foto', icon: CameraAltIcon },
      { id: 'photo_assistant', label: 'Fotoassistent', description: 'Støttefunksjon', icon: PersonIcon },
    ],
  },
  {
    id: 'video' as const,
    name: 'Video',
    description: 'Film og videoproduksjon',
    logo: '/role-video.png',
    icon: VideocamIcon,
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%)',
    glowColor: 'rgba(139, 92, 246, 0.4)',
    roles: [
      { id: 'director', label: 'Regissør', description: 'Kreativ ledelse for video', icon: MovieIcon },
      { id: 'producer', label: 'Produsent', description: 'Prosjektledelse og budsjett', icon: SupervisorAccountIcon },
      { id: 'casting_director', label: 'Casting Director', description: 'Ansvarlig for casting-prosessen', icon: GroupsIcon },
      { id: 'camera_operator', label: 'Kameraoperatør', description: 'Teknisk utførelse', icon: VideocamIcon },
    ],
  },
  {
    id: 'felles' as const,
    name: 'Felles/Andre',
    description: 'Talent, agenter og klienter',
    logo: '/role-felles.png',
    icon: GroupsIcon,
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)',
    glowColor: 'rgba(245, 158, 11, 0.4)',
    roles: [
      { id: 'talent', label: 'Talent/Modell', description: 'De som castes', icon: FaceIcon },
      { id: 'agent', label: 'Agent', description: 'Representerer talent', icon: PersonIcon },
      { id: 'client', label: 'Klient', description: 'Oppdragsgiver/merkevare', icon: BusinessIcon },
    ],
  },
];

export function CastingProfessionDialog({ open, onSelect }: CastingProfessionDialogProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [hoveredRole, setHoveredRole] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const selectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (selectTimerRef.current) {
        clearTimeout(selectTimerRef.current);
      }
    };
  }, []);

  const handleCategoryClick = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  const handleRoleSelect = (categoryId: CastingProfessionCategory, roleId: string) => {
    setSelectedRole(roleId);
    void authSessionService.setSelectedProfession(roleId);
    if (selectTimerRef.current) clearTimeout(selectTimerRef.current);
    selectTimerRef.current = setTimeout(() => {
      onSelect({ categoryId, roleId });
    }, 200);
  };

  return (
    <Dialog
      open={open}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'transparent',
          boxShadow: 'none',
          overflow: 'visible',
        },
      }}
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
          },
        },
      }}
      onClose={(_event, reason) => {
        // Block backdrop click but allow Escape key
        if (reason === 'backdropClick') {
          return;
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <Box
          sx={{
            background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
            borderRadius: 4,
            border: '1px solid rgba(139, 92, 246, 0.2)',
            overflow: 'hidden',
            position: 'relative',
            maxHeight: '85vh',
            overflowY: 'auto',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '60%',
              height: '1px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(139, 92, 246, 0.5) 50%, transparent 100%)',
            }}
          />
          
          <DialogTitle sx={{ pt: 4, pb: 2, textAlign: 'center' }}>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <img
                src="/role-room-assets/TheRoleRoom_Logo_Tagline.webp"
                alt="The Role Room"
                style={{
                  width: 120,
                  height: 120,
                  marginBottom: 16,
                  filter: 'drop-shadow(0 0 25px rgba(139, 92, 246, 0.4))',
                }}
                onError={(e: SyntheticEvent<HTMLImageElement>) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #ffffff 0%, #a78bfa 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 1,
                }}
              >
                Velg din rolle
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  color: 'rgba(255,255,255,0.87)',
                  maxWidth: 400,
                  mx: 'auto',
                }}
              >
                Velg en kategori og deretter din spesifikke rolle
              </Typography>
            </motion.div>
          </DialogTitle>
          
          <DialogContent sx={{ pt: 2, pb: 4, px: 4 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <AnimatePresence>
                {professionCategories.map((category, index) => {
                  const isExpanded = expandedCategory === category.id;
                  
                  return (
                    <motion.div
                      key={category.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ 
                        delay: 0.3 + index * 0.1,
                        duration: 0.4,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <Card
                        sx={{
                          background: category.gradient,
                          border: `2px solid ${isExpanded ? category.color : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: 3,
                          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                          boxShadow: isExpanded 
                            ? `0 10px 30px -5px ${category.glowColor}`
                            : '0 4px 20px rgba(0,0,0,0.2)',
                          overflow: 'hidden',
                        }}
                      >
                        <CardActionArea 
                          onClick={() => handleCategoryClick(category.id)}
                          sx={{ 
                            p: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box
                              sx={{
                                width: 56,
                                height: 56,
                                borderRadius: '50%',
                                background: `linear-gradient(135deg, ${category.color}30 0%, ${category.color}10 100%)`,
                                border: `2px solid ${category.color}50`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                              }}
                            >
                              <img
                                src={category.logo}
                                alt={category.name}
                                style={{
                                  width: 48,
                                  height: 48,
                                  objectFit: 'cover',
                                  filter: `drop-shadow(0 0 8px ${category.glowColor})`,
                                }}
                                onError={(e: SyntheticEvent<HTMLImageElement>) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </Box>
                            <Box>
                              <Typography variant="h6" sx={{ fontWeight: 600, color: '#fff' }}>
                                {category.name}
                              </Typography>
                              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                                {category.description}
                              </Typography>
                            </Box>
                          </Box>
                          {isExpanded ? (
                            <ExpandLessIcon sx={{ color: category.color }} />
                          ) : (
                            <ExpandMoreIcon sx={{ color: 'rgba(255,255,255,0.87)' }} />
                          )}
                        </CardActionArea>
                        
                        <Collapse in={isExpanded}>
                          <Box sx={{ px: 2, pb: 2 }}>
                            <Box
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                                gap: 1.5,
                                mt: 1,
                              }}
                            >
                              {category.roles.map((role) => {
                                const RoleIcon = role.icon;
                                const isHovered = hoveredRole === role.id;
                                const isSelected = selectedRole === role.id;
                                
                                return (
                                  <motion.div
                                    key={role.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ 
                                      opacity: 1, 
                                      scale: isSelected ? 0.95 : 1,
                                    }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    <Card
                                      sx={{
                                        bgcolor: isHovered ? `${category.color}20` : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${isHovered ? category.color : 'rgba(255,255,255,0.1)'}`,
                                        borderRadius: 2,
                                        transition: 'all 0.2s ease',
                                        cursor: 'pointer',
                                        '&:hover': {
                                          transform: 'translateY(-2px)',
                                          boxShadow: `0 8px 20px -5px ${category.glowColor}`,
                                        },
                                      }}
                                      onMouseEnter={() => setHoveredRole(role.id)}
                                      onMouseLeave={() => setHoveredRole(null)}
                                      onClick={() => handleRoleSelect(category.id, role.id)}
                                    >
                                      <Box sx={{ p: 2, textAlign: 'center' }}>
                                        <Box
                                          sx={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: '50%',
                                            bgcolor: `${category.color}20`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            mx: 'auto',
                                            mb: 1,
                                          }}
                                        >
                                          <RoleIcon sx={{ fontSize: 20, color: category.color }} />
                                        </Box>
                                        <Typography 
                                          variant="subtitle2" 
                                          sx={{ 
                                            fontWeight: 600, 
                                            color: '#fff',
                                            mb: 0.5,
                                          }}
                                        >
                                          {role.label}
                                        </Typography>
                                        <Typography 
                                          variant="caption" 
                                          sx={{ 
                                            color: 'rgba(255,255,255,0.87)',
                                            display: 'block',
                                            lineHeight: 1.3,
                                          }}
                                        >
                                          {role.description}
                                        </Typography>
                                      </Box>
                                    </Card>
                                  </motion.div>
                                );
                              })}
                            </Box>
                          </Box>
                        </Collapse>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </Box>
          </DialogContent>
          
          <Box
            sx={{
              px: 4,
              pb: 3,
              textAlign: 'center',
            }}
          >
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'rgba(255,255,255,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
              }}
            >
              <Box
                component="span"
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: '#10b981',
                  animation: 'pulse 2s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 0.5, transform: 'scale(1)' },
                    '50%': { opacity: 1, transform: 'scale(1.2)' },
                  },
                }}
              />
              Klikk på en kategori for å se roller
            </Typography>
          </Box>
        </Box>
      </motion.div>
    </Dialog>
  );
}


