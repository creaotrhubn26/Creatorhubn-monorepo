import React, { useEffect } from 'react';
import type { ShowcaseItem } from '@/types/showcase';
import {
  Box,
  Typography,
  Card as MuiCard,
  CardMedia,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  PlayArrow,
  Favorite,
  FavoriteBorder,
  Share,
  Download,
  Fullscreen,
  Description,
  Comment,
  Security,
  AccessTime,
  Edit,
  Archive,
  Copyright,
  TrendingUp as TimelineIcon,
  Layers,
  GraphicEq,
  LibraryAdd,
  School,
  CheckCircle,
  RadioButtonUnchecked,
  AutoFixHigh,
  AccountBalance,
  AttachMoney,
  OpenInNew,
  Business,
  ViewModule,
  Sync
} from '@mui/icons-material';

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export interface ShowcaseCardProps {
  item: ShowcaseItem;
  profession: string;
  accentColor: string;
  clientMode?: boolean;
  clientSelections: string[];
  handleClientSelection: (id: string) => void;
  favorites: Set<string>;
  toggleFavorite: (id: string) => void;
  showComments: boolean;
  setShowComments: (show: boolean) => void;
  setSelectedItem: (item: ShowcaseItem) => void;
  handleDownload: (item: ShowcaseItem) => void;
  showcaseSettings: any;
  analytics: any;
  effectiveUserId: string;
  addNotification: (notification: any) => void;
  features: any;
  setSelectedItemForPublish: (item: ShowcaseItem | null) => void;
  setShowPublishToAcademyDialog: (show: boolean) => void;
  setSelectedItemForCommunityShare: (item: ShowcaseItem | null) => void;
  setShowShareToCommunityDialog: (show: boolean) => void;
  adminMode?: boolean;
  onOpenProject?: (item: ShowcaseItem) => void;
  projectState?: 'delivered' | 'in_review';
  clientSession?: { id: string } | null;
  getProfessionDisplayName: (profession?: string) => string;
  setSelectedItemForStateUpdate: (item: ShowcaseItem | null) => void;
  setNewProjectState: (state: 'delivered' | 'in_review') => void;
  setProjectStateUpdateOpen: (open: boolean) => void;
  setShowProToolsDialog?: (show: boolean) => void;
  setSelectedItemForWedflow?: (item: ShowcaseItem | null) => void;
  setShowPublishToWedflowDialog?: (show: boolean) => void;
}

const ShowcaseCard = React.memo(({
  item,
  profession,
  accentColor,
  clientMode,
  clientSelections,
  handleClientSelection,
  favorites,
  toggleFavorite,
  showComments,
  setShowComments,
  setSelectedItem,
  handleDownload,
  showcaseSettings,
  analytics,
  effectiveUserId,
  addNotification,
  features,
  setSelectedItemForPublish,
  setShowPublishToAcademyDialog,
  setSelectedItemForCommunityShare,
  setShowShareToCommunityDialog,
  adminMode,
  onOpenProject,
  projectState,
  clientSession,
  getProfessionDisplayName,
  setSelectedItemForStateUpdate,
  setNewProjectState,
  setProjectStateUpdateOpen,
  setShowProToolsDialog,
  setSelectedItemForWedflow,
  setShowPublishToWedflowDialog
}: ShowcaseCardProps) => {
  const [contextMenu, setContextMenu] = React.useState<{
    mouseX: number;
    mouseY: number;
} | null>(null);

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? {
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6 }
        : null
    );
  };

  const handleClose = () => {
    setContextMenu(null);
};

  const handleEditItem = () => {
    console.log('Edit item: ', item);
    
    addNotification({
      message: `Redigerer ${item.title || item.fileType}...`,
      type: 'info'
    });
    
    if (item.fileType === 'photo') {
      setSelectedItem(item);
} else if (item.fileType === 'video') {
      setSelectedItem(item);
} else {
      setSelectedItem(item);
}
    handleClose();
};

  useEffect(() => {
    if (!showcaseSettings.keyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'd':
            e.preventDefault();
            handleDownload(item);
            break;
          case 'e':
            e.preventDefault();
            handleEditItem();
            break;
          case 'f':
            e.preventDefault();
            setSelectedItem(item);
            break;
          case 's':
            e.preventDefault();
            handleClientSelection(item.id);
            break;
          case 'l':
            e.preventDefault();
            toggleFavorite(item.id);
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
}, [showcaseSettings.keyboardShortcuts, item, handleDownload, setSelectedItem, handleClientSelection, toggleFavorite]);

  return (
  <Box sx={{ 
    width: '100%'
}} key={item.id}>
    <MuiCard 
      onContextMenu={handleContextMenu}
      onDoubleClick={() => {
        if (showcaseSettings.doubleClickAction === 'fullscreen') {
          setSelectedItem(item);
        } else if (showcaseSettings.doubleClickAction === 'download') {
          handleDownload(item);
        } else if (showcaseSettings.doubleClickAction === 'select') {
          handleClientSelection(item.id);
        }
      }}
      sx={{ 
        bgcolor: showcaseSettings.cardBackground === 'dark' ? 'rgba(6, 31, 46, 0.8)' :
                showcaseSettings.cardBackground === 'light' ? 'rgba(2, 5, 5, 255, 255, 0.9)' :
                showcaseSettings.cardBackground === 'transparent' ? 'transparent' :
                'rgba(26, 31, 46, 0.8)',
        background: showcaseSettings.cardBackground === 'dark' ? 
                   'linear-gradient(145deg, rgba(26, 31, 46, 0.9), rgba(31, 36, 50, 0.7))' :
                   showcaseSettings.cardBackground === 'light' ?
                   'linear-gradient(145deg, rgba(2, 5, 5, 255, 255, 0.9), rgba(2, 4, 5, 245, 245, 0.7))' :
                   'linear-gradient(145deg, rgba(26, 31, 46, 0.9), rgba(31, 36, 50, 0.7))',
        border: '1px solid rgba(2, 5, 5, 107, 53, 0.1)',
        borderRadius: showcaseSettings.cardBorderRadius === 'none' ? 0 :
                     showcaseSettings.cardBorderRadius === 'small' ? 1 :
                     showcaseSettings.cardBorderRadius === 'medium' ? 3 :
                     showcaseSettings.cardBorderRadius === 'large' ? 6 : 3,
        overflow: 'hidden',
        cursor: 'pointer',
        backdropFilter: 'blur(20px)',
        boxShadow: showcaseSettings.cardShadow === 'none' ? 'none' :
                  showcaseSettings.cardShadow === 'subtle' ? '0 1px 3px rgba(0,0,0,0.12)' :
                  showcaseSettings.cardShadow === 'medium' ? '0 4px 20px rgba(0,0,0,0.3), 0 1px 4px rgba(2, 5, 5, 107, 53, 0.1)' :
                  showcaseSettings.cardShadow === 'strong' ? '0 8px 30px rgba(0,0,0,0.5), 0 2px 8px rgba(2, 5, 5, 107, 53, 0.2)' :
                  '0 4px 20px rgba(0,0,0,0.3), 0 1px 4px rgba(2, 5, 5, 107, 53, 0.1)',
        position: 'relative',
        transition: showcaseSettings.animationSpeed === 'disabled' ? 'none' :
                   showcaseSettings.animationSpeed === 'slow' ? 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' :
                   showcaseSettings.animationSpeed === 'fast' ? 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)' :
                   'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        minHeight: showcaseSettings.cardSize === 'small' ? 200 :
                  showcaseSettings.cardSize === 'medium' ? 300 :
                  showcaseSettings.cardSize === 'large' ? 400 :
                  showcaseSettings.cardSize === 'extra-large' ? 500 : 300, '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, rgba(2, 5, 5, 107, 53, 0.03), transparent, rgba(2, 5, 5, 140, 0, 0.03))',
          opacity: 0,
          transition: 'opacity 0.3s ease',
          pointerEvents: 'none',
          zIndex: 1,
        }, '&:hover': {
          transform: showcaseSettings.hoverEffects === 'none' ? 'none' :
                    showcaseSettings.hoverEffects === 'glow' ? 'translateY(-4px)' :
                    showcaseSettings.hoverEffects === 'scale' ? 'translateY(-8px) scale(1.02)' :
                    showcaseSettings.hoverEffects === 'fade' ? 'translateY(-4px)' :
                    'translateY(-8px) scale(1.02)',
          borderColor: 'rgba(25, 107, 53, 0.3)',
          boxShadow: showcaseSettings.hoverEffects === 'none' ? 'inherit' :
                    showcaseSettings.hoverEffects === 'glow' ? '0 0 20px rgba(25, 107, 53, 0.4)' :
                    showcaseSettings.hoverEffects === 'scale' ? '0 20px 40px rgba(0,0,0,0.4), 0 8px 16px rgba(25, 107, 53, 0.2)' :
                    showcaseSettings.hoverEffects === 'fade' ? '0 4px 20px rgba(0,0,0,0.2)' :
                    '0 20px 40px rgba(0,0,0,0.4), 0 8px 16px rgba(25, 107, 53, 0.2)',
          opacity: showcaseSettings.hoverEffects === 'fade' ? 0.8 : 1, '&::before': {
            opacity: showcaseSettings.hoverEffects === 'none' ? 0 : 1,
          },
        }, '&:active': {
          transform: 'translateY(-4px) scale(1.01)',
        }}}>
      <Box sx={{ position: 'relative' }}>
        <CardMedia
          component="img"
          height="auto"
          image={(() => {
            const baseUrl = item.thumbnailUrl || 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e';
            const quality = showcaseSettings.imageQuality === 'low' ? 'w=120&h=120&q=60' :
                           showcaseSettings.imageQuality === 'medium' ? 'w=240&h=240&q=80' :
                           showcaseSettings.imageQuality === 'high' ? 'w=480&h=480&q=90' :
                           'w=120&h=120&q=100';
            return `${baseUrl}?${quality}&fit=crop`;
          })()}
          alt={`${getProfessionDisplayName(profession) || 'Innhold'}: ${item.title} - Klikk for å se fullskjerm`}
          loading={showcaseSettings.lazyLoading ? "lazy" : "eager"}
          sx={{ 
            objectFit: 'cover',
            transition: 'opacity 0.3s ease',
            aspectRatio: showcaseSettings.imageAspectRatio === 'square' ? '1/1' :
                        showcaseSettings.imageAspectRatio === '16:9' ? '16/9' :
                        showcaseSettings.imageAspectRatio === '4:3' ? '4/3' :
                        showcaseSettings.imageAspectRatio === '3:2' ? '3/2' :
                        showcaseSettings.imageAspectRatio === 'original' ? 'auto' : '16/9',
            width: '100%',
            height: 'auto'
          }}
          onClick={() => {
            if (showcaseSettings.viewTracking && analytics?.trackEvent && showcaseSettings.analyticsTracking) {
              analytics.trackEvent('item_viewed', {
                itemId: item.id,
                profession,
                fileType: item.fileType,
                userId: effectiveUserId,
                timestamp: new Date().toISOString(),
                action: 'click'
              });
            }

            if (showcaseSettings.soundEffects) {
              const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
              audio.volume = 0.1;
              audio.play().catch(() => {});
            }

            if (showcaseSettings.clickAction === 'fullscreen') {
              setSelectedItem(item);
            } else if (showcaseSettings.clickAction === 'download') {
              handleDownload(item);
            } else if (showcaseSettings.clickAction === 'select') {
              handleClientSelection(item.id);
            }
      }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = profession === 'photographer' 
              ? 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=120&h=120&fit=crop'
              : profession === 'videographer'
              ? 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=120&h=120&fit=crop'
              : profession === 'music_producer'
              ? 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=120&h=120&fit=crop'
              : 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=120&h=120&fit=crop';
          }}
        />
        
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          bgcolor: 'rgba(0,0,0,0.7)',
          borderRadius: '50%',
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {profession === 'photographer' ? (
            <Fullscreen sx={{ color: '#fff', fontSize: 18 }} />
          ) : profession === 'videographer' ? (
            <PlayArrow sx={{ color: '#fff', fontSize: 18 }} />
          ) : profession === 'music_producer' ? (
            <PlayArrow sx={{ color: '#fff', fontSize: 18 }} />
          ) : (
            <Description sx={{ color: '#fff', fontSize: 18 }} />
          )}
        </Box>

        {showcaseSettings.watermark !== 'none' && projectState !== 'delivered' && (
          <Box sx={{
            position: 'absolute',
            [showcaseSettings.watermarkPosition.includes('top') ? 'top' : 'bottom']: 8,
            [showcaseSettings.watermarkPosition.includes('left') ? 'left' : 'right']: 8,
            ...(showcaseSettings.watermarkPosition === 'center' && {
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            }),
            bgcolor: `rgba(0,0,0,${(showcaseSettings.watermarkOpacity || 70) / 100})`,
            color: '#fff',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: showcaseSettings.watermarkSize === 'small' ? '0.7rem' : 
                     showcaseSettings.watermarkSize === 'medium' ? '0.9rem' : '1.1rem',
            fontWeight: 500,
            backdropFilter: 'blur(4px)',
            zIndex: 2,
            transition: 'all 0.3s ease-in-out'
          }}>
            {showcaseSettings.watermark === 'text' ? (showcaseSettings.watermarkText || 'CreatorHub') :
             showcaseSettings.watermark === 'logo' ? '🏢' :
             showcaseSettings.watermark === 'both' ? `🏢 ${showcaseSettings.watermarkText || 'CreatorHub'}` : ','}
          </Box>
        )}

        {profession === 'videographer' && (
          <Chip
            label="2: 34"
            size="small"
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              bgcolor: 'rgba(0,0,0,0.8)',
              color: '#fff',
              fontSize: '0.7rem',
              height: 20 }}
          />
        )}

        {profession === 'music_producer' && showcaseSettings.audioWatermarkEnabled && (
          <Chip
            icon={<Security sx={{ fontSize: '0.8rem' }} />}
            label="Lyd-vannmerke"
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              right:  8,
              bgcolor: 'rgba(6, 175, 80, 0.9)',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 500,
              height: 20, '& .MuiChip-icon': {
                color: '#fff',
              }}}
          />
        )}
      </Box>

      <CardContent sx={{ p: 2, bgcolor: '#1a1f2e' }}>
        <Typography variant="subtitle2" sx={{ 
          fontWeight: 600, 
          color: '#fff',
          mb: 0.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {item.title}
        </Typography>
        
        <Typography variant="caption" sx={{ 
          color: 'rgba(2, 5, 5,255,255,0.7)',
          display: 'block',
          mb: 1 }}>
          {item.stats?.views} visninger • {new Date().toLocaleDateString('no-NO')}
        </Typography>

        {adminMode && item.projectId && (
          <Box sx={{ mb: 1 }}>
            <Tooltip title="View Project Timeline">
              <Chip 
                icon={<TimelineIcon />} 
                label="Project" 
                size="small" 
                color="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenProject?.(item);
                }}
                sx={{ cursor: 'pointer' }}
              />
            </Tooltip>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {showcaseSettings.showSelectionButton && (
              <IconButton
                size={showcaseSettings.mobileButtonSize === 'small' ? 'small' : 
                      showcaseSettings.mobileButtonSize === 'large' ? 'large' : 'medium'}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClientSelection(item.id);
                }}
                sx={{
                  color: clientSelections.includes(item.id) ? accentColor : 'rgba(2, 5, 5,255,255,0.5)',
                  bgcolor: clientSelections.includes(item.id) ? 'rgba(2, 5, 5, 107, 53, 0.2)' : 'transparent',
                  variant: showcaseSettings.buttonStyle === 'filled' ? 'contained' :
                          showcaseSettings.buttonStyle === 'outlined' ? 'outlined' :
                          showcaseSettings.buttonStyle === 'text' ? 'text' : 'text','&:hover': { 
                    color: accentColor,
                    bgcolor: showcaseSettings.buttonStyle === 'filled' ? accentColor :
                            showcaseSettings.buttonStyle === 'outlined' ? 'rgba(2, 5, 5, 107, 53, 0.1)' :
                            'rgba(2, 5, 5, 107, 53, 0.1)'
                  }
                }}
              >
                {clientSelections.includes(item.id) ? 
                  <CheckCircle sx={{ fontSize: 16 }} /> : 
                  <RadioButtonUnchecked sx={{ fontSize: 16 }} />
                }
              </IconButton>
            )}

            {showcaseSettings.showFavoriteButton && (
              <IconButton 
                size={showcaseSettings.mobileButtonSize === 'small' ? 'small' : 
                      showcaseSettings.mobileButtonSize === 'large' ? 'large' : 'medium'}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(item.id);
                }}
                sx={{ 
                  color: favorites.has(item.id) ? '#ff4444' : 'rgba(2, 5, 5,255,255,0.5)','&:hover': { color: '#ff4444' }
                }}
              >
                {favorites.has(item.id) ? <Favorite sx={{ fontSize: 16 }} /> : <FavoriteBorder sx={{ fontSize: 16 }} />}
              </IconButton>
            )}
            
            {showcaseSettings.showCommentButton && (
              <IconButton 
                size={showcaseSettings.mobileButtonSize === 'small' ? 'small' : 
                      showcaseSettings.mobileButtonSize === 'large' ? 'large' : 'medium'} 
                disabled={projectState === 'delivered'}
                sx={{ 
                  color: projectState === 'delivered' ? 'rgba(2, 5, 5,255,255,0.2)' : 'rgba(2, 5, 5,255,255,0.5)','&:hover': { color: projectState === 'delivered' ? 'rgba(2, 5, 5,255,255,0.2)' : '#fff' }
                }}
                onClick={() => setShowComments(!showComments)}
              >
                <Comment sx={{ fontSize: 16 }} />
              </IconButton>
            )}
            
            {showcaseSettings.showDownloadButton && (
              <IconButton 
                size={showcaseSettings.mobileButtonSize === 'small' ? 'small' : 
                      showcaseSettings.mobileButtonSize === 'large' ? 'large' : 'medium'} 
                disabled={projectState === 'in_review'}
                sx={{ 
                  color: projectState === 'in_review' ? 'rgba(2, 5, 5,255,255,0.2)' : 'rgba(2, 5, 5,255,255,0.5)','&:hover': { color: projectState === 'in_review' ? 'rgba(2, 5, 5,255,255,0.2)' : accentColor }
            }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(item);
            }}
              >
                <Download sx={{ fontSize: 16 }} />
              </IconButton>
            )}

            {showcaseSettings.showFullscreenButton && (
              <IconButton 
                size={showcaseSettings.mobileButtonSize === 'small' ? 'small' : 
                      showcaseSettings.mobileButtonSize === 'large' ? 'large' : 'medium'} 
                sx={{ 
                  color: 'rgba(2, 5, 5,255,255,0.5)','&:hover': { color: '#9C27B0' }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedItem(item);
            }}
              >
                <Fullscreen sx={{ fontSize: 16 }} />
              </IconButton>
            )}

            {adminMode && item.projectId && (
              <Tooltip title="View Project Timeline">
                <IconButton 
                  size={showcaseSettings.mobileButtonSize === 'small' ? 'small' : 
                        showcaseSettings.mobileButtonSize === 'large' ? 'large' : 'medium'} 
                  sx={{ 
                    color: 'rgba(2, 5, 5,255,255,0.5)','&:hover': { color: accentColor }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProject?.(item);
                  }}
                >
                  <TimelineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}

            {adminMode && item.projectId && clientSession && (
              <Tooltip title="Update Project State">
                <IconButton 
                  size={showcaseSettings.mobileButtonSize === 'small' ? 'small' : 
                        showcaseSettings.mobileButtonSize === 'large' ? 'large' : 'medium'} 
                  sx={{ 
                    color: projectState === 'delivered' ? '#4caf50' : '#ff9800','&:hover': { color: projectState === 'delivered' ? '#388e3c' : '#f57c00' }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedItemForStateUpdate(item);
                    setNewProjectState(projectState || 'in_review');
                    setProjectStateUpdateOpen(true);
                  }}
                >
                  <CheckCircle sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          
          {showcaseSettings.showStatusText && (
            <Typography variant="caption" sx={{ color: 'rgba(2, 5, 5,255,255,0.5)' }}>
              {[
                clientSelections.includes(item.id) ? 'Valgt' : 'Ikke valgt',
                favorites.has(item.id) ? 'Favoritt' : 'Ikke favoritt',
                ...(showcaseSettings.showViewCount && item.stats?.views ? [`${item.stats.views} visninger`] : []),
                ...(showcaseSettings.showLikeCount && item.stats?.likes ? [`${item.stats.likes} likes`] : []),
                ...(showcaseSettings.showUploadDate && item.createdAt ? [new Date(item.createdAt).toLocaleDateString('no-NO')] : []),
                ...(showcaseSettings.showFileSize && item.fileUrl ? [formatFileSize(item.fileSize || item.size || 0)] : []),
                ...(showcaseSettings.showProfessionBadge ? [getProfessionDisplayName(profession) || 'Leverandør'] : []),
                ...(showcaseSettings.showAITags && item.aiTags ? item.aiTags.slice(0, 2) : [])
              ].join(' • ')}
            </Typography>
          )}
        </Box>
      </CardContent>
    </MuiCard>
    
    {showcaseSettings.enableContextMenu && (
      <Menu
        open={contextMenu !== null}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        {showcaseSettings.showDownloadButton && (
          <MenuItem onClick={() => {
            handleDownload(item);
            handleClose();
          }}>
            <ListItemIcon>
              <Download fontSize="small" />
            </ListItemIcon>
            <ListItemText>Last ned</ListItemText>
          </MenuItem>
        )}
        
        {showcaseSettings.showEditButton && (
          <MenuItem onClick={handleEditItem}>
            <ListItemIcon>
              <Edit fontSize="small" />
            </ListItemIcon>
            <ListItemText>Rediger</ListItemText>
          </MenuItem>
        )}
        
        <MenuItem onClick={() => {
          setSelectedItem(item);
          handleClose();
    }}>
          <ListItemIcon>
            <Fullscreen fontSize="small" />
          </ListItemIcon>
          <ListItemText>Se fullskjerm</ListItemText>
        </MenuItem>
        
        {showcaseSettings.showSelectionButton && (
          <MenuItem onClick={() => {
            handleClientSelection(item.id);
            handleClose();
          }}>
            <ListItemIcon>
              {clientSelections.includes(item.id) ? <CheckCircle fontSize="small" /> : <RadioButtonUnchecked fontSize="small" />}
            </ListItemIcon>
            <ListItemText>
              {clientSelections.includes(item.id) ? 'Fjern fra valg' : 'Legg til valg'}
            </ListItemText>
          </MenuItem>
        )}
        
        {showcaseSettings.showFavoriteButton && (
          <MenuItem onClick={() => {
            toggleFavorite(item.id);
            handleClose();
          }}>
            <ListItemIcon>
              {favorites.has(item.id) ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
            </ListItemIcon>
            <ListItemText>
              {favorites.has(item.id) ? 'Fjern fra favoritter' : 'Legg til favoritter'}
            </ListItemText>
          </MenuItem>
        )}
        
        {showcaseSettings.showCommentButton && (
          <MenuItem onClick={() => {
            setShowComments(!showComments);
            handleClose();
          }}>
            <ListItemIcon>
              <Comment fontSize="small" />
            </ListItemIcon>
            <ListItemText>Kommentarer</ListItemText>
          </MenuItem>
        )}
        
        <Divider sx={{ my: 1 }} />
        
        {profession === 'photographer' && (
          <>
            <MenuItem onClick={() => {
              addNotification({
                message: 'Åpner CreatorHub Photo Enhancer...',
                type: 'info',
                duration: 2000 });
              handleClose();
            }}>
              <ListItemIcon>
                <AutoFixHigh fontSize="small" sx={{ color: '#FF6B35' }} />
              </ListItemIcon>
              <ListItemText>Enhance Photo (AI)</ListItemText>
            </MenuItem>
            
            <MenuItem onClick={() => {
              addNotification({
                message: 'Åpner vannmerke-dialog...',
                type: 'info',
                duration: 2000 });
              handleClose();
            }}>
              <ListItemIcon>
                <Copyright fontSize="small" sx={{ color: '#FF8C00' }} />
              </ListItemIcon>
              <ListItemText>Apply Watermark</ListItemText>
            </MenuItem>
            
            <MenuItem onClick={() => {
              addNotification({
                message: 'Sender til Lightroom...',
                type: 'success',
                duration: 2000 });
              handleClose();
            }}>
              <ListItemIcon>
                <OpenInNew fontSize="small" sx={{ color: '#31A8FF' }} />
              </ListItemIcon>
              <ListItemText>Send to Lightroom</ListItemText>
            </MenuItem>
            
            <MenuItem onClick={() => {
              addNotification({
                message: 'Sett pris for dette bildet',
                type: 'info',
                duration: 2000 });
              handleClose();
            }}>
              <ListItemIcon>
                <AttachMoney fontSize="small" sx={{ color: '#4CAF50' }} />
              </ListItemIcon>
              <ListItemText>Set Price</ListItemText>
            </MenuItem>
          </>
        )}
        
        {profession === 'videographer' && (
          <>
            <MenuItem onClick={() => {
              addNotification({
                message: 'Legger til i sekvens...',
                type: 'info',
                duration: 2000 });
              handleClose();
            }}>
              <ListItemIcon>
                <TimelineIcon fontSize="small" sx={{ color: '#E74C3C' }} />
              </ListItemIcon>
              <ListItemText>Add to Sequence</ListItemText>
            </MenuItem>
            
            <MenuItem onClick={() => {
              addNotification({
                message: 'Genererer proxy-fil...',
                type: 'info',
                duration: 2000 });
              handleClose();
            }}>
              <ListItemIcon>
                <Layers fontSize="small" sx={{ color: '#C0392B' }} />
              </ListItemIcon>
              <ListItemText>Generate Proxy</ListItemText>
            </MenuItem>
            
            <MenuItem onClick={() => {
              addNotification({
                message: 'Eksporterer for sosiale medier...',
                type: 'info',
                duration: 2000 });
              handleClose();
            }}>
              <ListItemIcon>
                <Share fontSize="small" sx={{ color: '#3498DB' }} />
              </ListItemIcon>
              <ListItemText>Export for Social Media</ListItemText>
            </MenuItem>
            
            <MenuItem onClick={() => {
              addNotification({
                message: 'Legg til tidskode-kommentar',
                type: 'info',
                duration: 2000 });
              handleClose();
            }}>
              <ListItemIcon>
                <AccessTime fontSize="small" sx={{ color: '#F39C12' }} />
              </ListItemIcon>
              <ListItemText>Add Timecode Comment</ListItemText>
            </MenuItem>
          </>
        )}
        
        {profession === 'music_producer' && (
          <>
            <MenuItem onClick={() => {
              addNotification({
                message: 'Split Sheet: Gå til "Split Sheets"-fanen i dashboardet for å opprette split sheet for dette sporet',
                type: 'info',
                duration: 4000
              });
              handleClose();
            }}>
              <ListItemIcon>
                <AccountBalance fontSize="small" sx={{ color: '#9f7aea' }} />
              </ListItemIcon>
              <ListItemText>Opprett Split Sheet</ListItemText>
            </MenuItem>
            
            <MenuItem onClick={() => {
              addNotification({
                message: 'Ekstraherer stems...',
                type: 'info',
                duration: 2000 });
              handleClose();
            }}>
              <ListItemIcon>
                <GraphicEq fontSize="small" sx={{ color: '#9B59B6' }} />
              </ListItemIcon>
              <ListItemText>Extract Stems</ListItemText>
            </MenuItem>
            
            <MenuItem onClick={() => {
              addNotification({
                message: 'Setter lyd-vannmerke...',
                type: 'info',
                duration: 2000 });
              handleClose();
            }}>
              <ListItemIcon>
                <Security fontSize="small" sx={{ color: '#8E44AD' }} />
              </ListItemIcon>
              <ListItemText>Apply Audio Watermark</ListItemText>
            </MenuItem>
            
            <MenuItem onClick={() => {
              addNotification({
                message: 'Analyserer audio med AI...',
                type: 'info' });
              handleClose();
            }}>
              <ListItemIcon>
                <AutoFixHigh fontSize="small" sx={{ color: '#E74C3C' }} />
              </ListItemIcon>
              <ListItemText>Analyze Audio (AI)</ListItemText>
            </MenuItem>
            
            <MenuItem onClick={() => {
              addNotification({
                message: 'Legger til i sample pack...',
                type: 'info' });
              handleClose();
            }}>
              <ListItemIcon>
                <LibraryAdd fontSize="small" sx={{ color: '#27AE60' }} />
              </ListItemIcon>
              <ListItemText>Add to Sample Pack</ListItemText>
            </MenuItem>
            
            <MenuItem onClick={() => {
              setShowProToolsDialog?.(true);
              handleClose();
            }}>
              <ListItemIcon>
                <Sync fontSize="small" sx={{ color: '#9B59B6' }} />
              </ListItemIcon>
              <ListItemText>Sync with Pro Tools</ListItemText>
            </MenuItem>
          </>
        )}
        
        {profession === 'vendor' && (
          <>
            <MenuItem onClick={() => {
              addNotification({
                message: 'Legger til i produktpakke...',
                type: 'info',
                duration: 2000 });
              handleClose();
            }}>
              <ListItemIcon>
                <Business fontSize="small" sx={{ color: '#3498DB' }} />
              </ListItemIcon>
              <ListItemText>Add to Product Bundle</ListItemText>
            </MenuItem>
            
            <MenuItem onClick={() => {
              addNotification({
                message: 'Redigerer prising...',
                type: 'info',
                duration: 2000 });
              handleClose();
            }}>
              <ListItemIcon>
                <AttachMoney fontSize="small" sx={{ color: '#27AE60' }} />
              </ListItemIcon>
              <ListItemText>Edit Pricing</ListItemText>
            </MenuItem>
            
            <MenuItem onClick={() => {
              addNotification({
                message: 'Legger til varianter...',
                type: 'info',
                duration: 2000 });
              handleClose();
            }}>
              <ListItemIcon>
                <ViewModule fontSize="small" sx={{ color: '#E67E22' }} />
              </ListItemIcon>
              <ListItemText>Add Variants</ListItemText>
            </MenuItem>
            
            <MenuItem onClick={() => {
              addNotification({
                message: 'Oppdaterer lagerstatus...',
                type: 'info',
                duration: 2000 });
              handleClose();
            }}>
              <ListItemIcon>
                <Archive fontSize="small" sx={{ color: '#95A5A6' }} />
              </ListItemIcon>
              <ListItemText>Update Inventory</ListItemText>
            </MenuItem>
          </>
        )}
        
        {features.checkFeatureAccess('publish-to-academy')?.hasAccess && (
          <>
            <Divider sx={{ my: 1 }} />
            <MenuItem onClick={() => {
              setSelectedItemForPublish(item);
              setShowPublishToAcademyDialog(true);
              handleClose();
            }}>
              <ListItemIcon>
                <School fontSize="small" sx={{ color: '#ff8c00' }} />
              </ListItemIcon>
              <ListItemText>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Publiser til Academy
                  <Chip label="PRO" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#ff8c00', color: 'white' }} />
                </Box>
              </ListItemText>
            </MenuItem>
          </>
        )}
        
        <MenuItem onClick={() => {
          setSelectedItemForCommunityShare(item);
          setShowShareToCommunityDialog(true);
          handleClose();
        }}>
          <ListItemIcon>
            <Share fontSize="small" sx={{ color: '#2196f3' }} />
          </ListItemIcon>
          <ListItemText>Del til Community</ListItemText>
        </MenuItem>

        {setSelectedItemForWedflow && setShowPublishToWedflowDialog && (
          <>
            <Divider sx={{ my: 1 }} />
            <MenuItem onClick={() => {
              setSelectedItemForWedflow(item);
              setShowPublishToWedflowDialog(true);
              handleClose();
            }}>
              <ListItemIcon>
                <OpenInNew fontSize="small" sx={{ color: '#E91E63' }} />
              </ListItemIcon>
              <ListItemText>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Publiser til Wedflow
                  <Chip label="DELIVERY" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#E91E63', color: 'white' }} />
                </Box>
              </ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>
    )}
    </Box>
  );
});

export default ShowcaseCard;
