import React, { useId, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Tooltip,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Person as PersonIcon,
  Group as GroupIcon,
  Lock as LockIcon,
  Public as PublicIcon,
  Link as LinkIcon,
  ContentCopy as CopyIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  AdminPanelSettings as AdminIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { ShareCustomIcon as ShareIcon } from './icons/CastingIcons';
import type { CastingProject, UserRole, UserRoleType } from '../models/casting';
import { TOUCH_TARGET_SIZE } from '../constants/accessibility';

// WCAG 2.2 - 2.4.7 Focus Visible: clear focus indicator
const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #00d4ff',
    outlineOffset: 2,
  },
};

interface SharedUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  avatar?: string;
}

interface SharingPanelProps {
  project: CastingProject | null;
  onOpenSharingDialog: () => void;
}

// Map UserRoleType to simplified role
const mapRoleType = (roleType: UserRoleType): 'admin' | 'editor' | 'viewer' => {
  switch (roleType) {
    case 'director':
    case 'producer':
      return 'admin';
    case 'casting_director':
    case 'production_manager':
    case 'content_producer':
      return 'editor';
    case 'client_reviewer':
    case 'camera_team':
    case 'agency':
    default:
      return 'viewer';
  }
};

// Extract display name from userId (email)
const getDisplayName = (userId: string): string => {
  if (userId.includes('@')) {
    return userId.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  return userId;
};

export function SharingPanel({
  project,
  onOpenSharingDialog,
}: SharingPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const titleId = useId();
  
  const containerPadding = isMobile ? 2 : isTablet ? 3 : 4;

  // Get shared users from project's userRoles
  const sharedUsers: SharedUser[] = useMemo(() => {
    if (!project?.userRoles || project.userRoles.length === 0) {
      return [];
    }
    
    return project.userRoles.map((userRole: UserRole) => {
      const resolvedUserId = userRole.userId || userRole.email || 'ukjent@creatorhub.local';
      return {
        id: userRole.id,
        name: getDisplayName(resolvedUserId),
        email: resolvedUserId,
        role: mapRoleType(userRole.role),
      };
    });
  }, [project?.userRoles]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return '#ef4444';
      case 'editor': return '#10b981';
      case 'viewer': return '#00d4ff';
      default: return '#6b7280';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'editor': return 'Redaktør';
      case 'viewer': return 'Leser';
      default: return 'Ukjent';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <AdminIcon sx={{ fontSize: 16 }} />;
      case 'editor': return <EditIcon sx={{ fontSize: 16 }} />;
      case 'viewer': return <ViewIcon sx={{ fontSize: 16 }} />;
      default: return <PersonIcon sx={{ fontSize: 16 }} />;
    }
  };

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/casting/${project?.id}`;
    navigator.clipboard.writeText(shareUrl);
    // In real app, show a snackbar notification
  };

  const accessCards = [
    {
      title: 'Privat',
      description: 'Kun inviterte brukere har tilgang',
      icon: LockIcon,
      color: '#ef4444',
      active: true,
    },
    {
      title: 'Team',
      description: 'Alle i teamet kan se prosjektet',
      icon: GroupIcon,
      color: '#10b981',
      active: false,
    },
    {
      title: 'Offentlig',
      description: 'Alle med lenken kan se prosjektet',
      icon: PublicIcon,
      color: '#00d4ff',
      active: false,
    },
  ];

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{ p: containerPadding, width: '100%', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 2.5 }}
    >
      {/* Header with Icon and Title */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 2,
          px: { xs: 1.5, sm: 2 },
          py: { xs: 1.25, sm: 1.5 },
          borderRadius: 2.5,
          border: '1px solid rgba(148,163,184,0.26)',
          background: 'linear-gradient(120deg, rgba(124,58,237,0.16) 0%, rgba(56,189,248,0.1) 52%, rgba(15,23,42,0.22) 100%)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: { xs: 48, sm: 56 },
              height: { xs: 48, sm: 56 },
              borderRadius: 2,
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
              border: '1px solid rgba(233,213,255,0.34)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 24px rgba(147,51,234,0.32)',
            }}
          >
            <ShareIcon sx={{ fontSize: { xs: 24, sm: 28 }, color: '#fff' }} />
          </Box>
          <Box>
            <Typography
              variant="h5"
              id={titleId}
              sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
            >
              Deling og tilgangskontroll
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(226,232,240,0.8)' }}>
              Administrer hvem som har tilgang til prosjektet
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Chip
            size="small"
            label="PRO-VISNING"
            sx={{
              bgcolor: 'rgba(192,132,252,0.2)',
              color: '#f5d0fe',
              border: '1px solid rgba(192,132,252,0.45)',
              fontWeight: 700,
              letterSpacing: 0.4,
            }}
          />
          <Tooltip title="Inviter nye brukere">
            <Button
              variant="contained"
              startIcon={<PersonIcon />}
              onClick={onOpenSharingDialog}
              sx={{
                background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                color: '#fff',
                fontWeight: 700,
                minHeight: TOUCH_TARGET_SIZE,
                '&:hover': { background: 'linear-gradient(135deg, #c084fc 0%, #9333ea 100%)' },
                ...focusVisibleStyles,
              }}
            >
              {isMobile ? 'Inviter' : 'Inviter brukere'}
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Access Level Cards */}
      <Typography variant="h6" sx={{ color: '#fff', mb: 2, fontWeight: 600 }}>
        Tilgangsnivå
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1.5, sm: 2 } }}>
        {accessCards.map((card) => (
          <Box
            key={card.title}
            sx={{
              width: {
                xs: '100%',
                sm: 'calc(33.333% - 11px)',
              },
              minWidth: 0,
            }}
          >
            <Card
              component="button"
              sx={{
                width: '100%',
                bgcolor: card.active ? `${card.color}15` : 'rgba(15,23,42,0.62)',
                border: card.active ? `2px solid ${card.color}` : '1px solid rgba(148,163,184,0.24)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { borderColor: card.color, transform: 'translateY(-2px)' },
                ...focusVisibleStyles,
              }}
            >
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: { xs: 2, sm: 3 } }}>
                <Box
                  sx={{
                    width: { xs: 44, sm: 56 },
                    height: { xs: 44, sm: 56 },
                    borderRadius: 2,
                    bgcolor: `${card.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <card.icon sx={{ fontSize: { xs: 22, sm: 28 }, color: card.color }} />
                </Box>
                <Box sx={{ textAlign: 'left' }}>
                  <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, fontSize: { xs: '1rem', sm: '1.1rem' } }}>
                    {card.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    {card.description}
                  </Typography>
                </Box>
                {card.active && (
                  <Chip
                    label="Aktiv"
                    size="small"
                    sx={{ bgcolor: card.color, color: '#fff', ml: 'auto' }}
                  />
                )}
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>

      {/* Share Link */}
      <Card sx={{ bgcolor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.24)' }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <LinkIcon sx={{ color: '#00d4ff' }} />
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
              Delingslenke
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Box
              sx={{
                flex: 1,
                minWidth: 200,
                p: 1.5,
                bgcolor: 'rgba(255,255,255,0.05)',
                borderRadius: 1,
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {`${window.location.origin}/casting/${project?.id || 'prosjekt-id'}`}
              </Typography>
            </Box>
            <Tooltip title="Kopier lenke">
              <Button
                variant="outlined"
                startIcon={<CopyIcon />}
                onClick={handleCopyLink}
                sx={{
                  borderColor: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  minHeight: TOUCH_TARGET_SIZE,
                  '&:hover': { borderColor: '#00d4ff', bgcolor: 'rgba(0,212,255,0.1)' },
                  ...focusVisibleStyles,
                }}
              >
                {!isMobile && 'Kopier'}
              </Button>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* Shared Users List */}
      <Card sx={{ bgcolor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.24)' }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <GroupIcon sx={{ color: '#10b981' }} />
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
                Delte brukere
              </Typography>
              <Chip label={sharedUsers.length} size="small" sx={{ bgcolor: 'rgba(16,185,129,0.2)', color: '#10b981' }} />
            </Box>
            <Tooltip title="Inviter via e-post">
              <Button
                variant="outlined"
                startIcon={<EmailIcon />}
                onClick={onOpenSharingDialog}
                sx={{
                  borderColor: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  minHeight: TOUCH_TARGET_SIZE,
                  '&:hover': { borderColor: '#10b981', bgcolor: 'rgba(16,185,129,0.1)' },
                  ...focusVisibleStyles,
                }}
              >
                {!isMobile && 'Inviter'}
              </Button>
            </Tooltip>
          </Box>
          
          {sharedUsers.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <GroupIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                Ingen brukere har tilgang ennå
              </Typography>
              <Button
                variant="contained"
                startIcon={<PersonIcon />}
                onClick={onOpenSharingDialog}
                sx={{
                  mt: 2,
                  bgcolor: '#10b981',
                  color: '#fff',
                  minHeight: TOUCH_TARGET_SIZE,
                  '&:hover': { bgcolor: '#059669' },
                  ...focusVisibleStyles,
                }}
              >
                Inviter første bruker
              </Button>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {sharedUsers.map((user) => (
                <ListItem
                  key={user.id}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.02)',
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: getRoleColor(user.role) }}>
                      {user.name.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography sx={{ color: '#fff', fontWeight: 500 }}>
                        {user.name}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                        {user.email}
                      </Typography>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Chip
                      icon={getRoleIcon(user.role)}
                      label={getRoleLabel(user.role)}
                      size="small"
                      sx={{
                        bgcolor: `${getRoleColor(user.role)}20`,
                        color: getRoleColor(user.role),
                        '& .MuiChip-icon': { color: getRoleColor(user.role) },
                      }}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
