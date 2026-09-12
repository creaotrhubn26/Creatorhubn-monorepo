import React, { useEffect } from 'react';
import type { ShowcaseItem } from '@/types/showcase';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
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
  Sync,
} from '@mui/icons-material';
import {
  CINE,
  CINE_FONT,
  CINE_MOTION,
  withAlpha,
  scrimGradient,
  scrimGradientTop,
  metaLabelSx,
} from './showcaseCinematic';

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
  /**
   * Opens the cinematic detail view (QuickPreview). When provided it becomes the
   * default "view" action for a card; falls back to the legacy setSelectedItem
   * dialog when omitted so existing call-sites keep working.
   */
  onOpenPreview?: (item: ShowcaseItem) => void;
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
  setSelectedItemForEvendi?: (item: ShowcaseItem | null) => void;
  setShowPublishToEvendiDialog?: (show: boolean) => void;
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
  onOpenPreview,
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
  setSelectedItemForEvendi,
  setShowPublishToEvendiDialog
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
    addNotification({
      message: `Redigerer ${item.title || item.fileType}...`,
      type: 'info'
    });
    setSelectedItem(item);
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

  // ── Derived state ───────────────────────────────────────────────────────
  const accent = accentColor || CINE.accent;
  const isSelected = clientSelections.includes(item.id);
  const isFav = favorites.has(item.id);
  const reduced = showcaseSettings.animationSpeed === 'disabled';

  const aspectRatio =
    showcaseSettings.imageAspectRatio === 'square' ? '1 / 1' :
    showcaseSettings.imageAspectRatio === '16:9' ? '16 / 9' :
    showcaseSettings.imageAspectRatio === '4:3' ? '4 / 3' :
    showcaseSettings.imageAspectRatio === '3:2' ? '3 / 2' :
    showcaseSettings.imageAspectRatio === 'original' ? 'auto' :
    '4 / 5'; // cinematic poster default

  const imageSrc = (() => {
    const baseUrl = item.thumbnailUrl || 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e';
    const quality = showcaseSettings.imageQuality === 'low' ? 'w=400&q=60' :
                   showcaseSettings.imageQuality === 'medium' ? 'w=640&q=78' :
                   showcaseSettings.imageQuality === 'high' ? 'w=1080&q=90' :
                   'w=800&q=82';
    return `${baseUrl}?${quality}&fit=crop`;
  })();

  const MediaTypeIcon =
    profession === 'videographer' || profession === 'music_producer' ? PlayArrow :
    profession === 'photographer' ? Fullscreen :
    Description;

  // Default "view" action — cinematic QuickPreview when wired, legacy dialog otherwise.
  const openDetail = onOpenPreview ?? setSelectedItem;

  const handleMediaClick = () => {
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
    if (showcaseSettings.clickAction === 'download') {
      handleDownload(item);
    } else if (showcaseSettings.clickAction === 'select') {
      handleClientSelection(item.id);
    } else {
      openDetail(item);
    }
  };

  const metaLine = [
    showcaseSettings.showViewCount !== false && item.stats?.views ? `${item.stats.views} visninger` : null,
    showcaseSettings.showProfessionBadge ? (getProfessionDisplayName(profession) || 'Leverandør') : null,
    showcaseSettings.showUploadDate && item.createdAt ? new Date(item.createdAt).toLocaleDateString('no-NO') : null,
  ].filter(Boolean).join('  ·  ');

  // Small overlay action button — appears on the scrim, reveals on hover.
  const OverlayAction = ({
    title, onClick, active, activeColor, children, disabled,
  }: {
    title: string;
    onClick: (e: React.MouseEvent) => void;
    active?: boolean;
    activeColor?: string;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <Tooltip title={title} disableInteractive>
      <span>
        <IconButton
          size="small"
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); onClick(e); }}
          sx={{
            color: active ? (activeColor || accent) : 'rgba(255,255,255,0.82)',
            bgcolor: 'rgba(7,7,7,0.55)',
            backdropFilter: 'blur(6px)',
            border: `1px solid ${active ? withAlpha(activeColor || accent, 0.6) : 'rgba(255,255,255,0.12)'}`,
            width: 32,
            height: 32,
            '&:hover': {
              color: activeColor || accent,
              bgcolor: 'rgba(7,7,7,0.85)',
              borderColor: withAlpha(activeColor || accent, 0.7),
            },
            '&.Mui-disabled': { color: 'rgba(255,255,255,0.22)' },
          }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );

  return (
  <Box sx={{ width: '100%' }} key={item.id}>
    <Box
      tabIndex={0}
      role="button"
      aria-label={`${getProfessionDisplayName(profession) || 'Innhold'}: ${item.title}`}
      onContextMenu={handleContextMenu}
      onClick={handleMediaClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(item); }
      }}
      onDoubleClick={() => {
        if (showcaseSettings.doubleClickAction === 'download') handleDownload(item);
        else if (showcaseSettings.doubleClickAction === 'select') handleClientSelection(item.id);
        else openDetail(item);
      }}
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio,
        minHeight: aspectRatio === 'auto' ? 240 : undefined,
        overflow: 'hidden',
        borderRadius: '14px',
        bgcolor: CINE.surfaceSolid,
        border: `1px solid ${isSelected ? withAlpha(accent, 0.55) : CINE.border}`,
        cursor: 'pointer',
        boxShadow: isSelected
          ? `0 0 0 1px ${withAlpha(accent, 0.5)}, 0 16px 40px rgba(0,0,0,0.5)`
          : '0 1px 2px rgba(0,0,0,0.4)',
        transition: reduced ? 'none' : `transform ${CINE_MOTION.base} ${CINE_MOTION.ease}, box-shadow ${CINE_MOTION.base} ${CINE_MOTION.ease}, border-color ${CINE_MOTION.base} ${CINE_MOTION.ease}`,
        '& .cine-img': {
          transition: reduced ? 'none' : `transform ${CINE_MOTION.slow} ${CINE_MOTION.ease}`,
        },
        '& .cine-reveal': {
          opacity: 0,
          transform: 'translateY(8px)',
          transition: reduced ? 'none' : `opacity ${CINE_MOTION.base} ${CINE_MOTION.ease}, transform ${CINE_MOTION.base} ${CINE_MOTION.ease}`,
        },
        '& .cine-title': {
          transition: reduced ? 'none' : `transform ${CINE_MOTION.base} ${CINE_MOTION.ease}`,
        },
        '&:hover, &:focus-visible': reduced ? {
          borderColor: withAlpha(accent, 0.5),
          outline: 'none',
        } : {
          transform: 'translateY(-6px)',
          borderColor: withAlpha(accent, 0.5),
          boxShadow: `0 24px 50px rgba(0,0,0,0.6), 0 0 0 1px ${withAlpha(accent, 0.28)}, 0 0 44px ${withAlpha(accent, 0.18)}`,
          outline: 'none',
          '& .cine-img': { transform: `scale(${CINE_MOTION.hoverZoom})` },
          '& .cine-reveal': { opacity: 1, transform: 'translateY(0)' },
          '& .cine-title': { transform: 'translateY(-2px)' },
        },
        // Touch devices: keep actions/title visible (no hover).
        '@media (hover: none)': {
          '& .cine-reveal': { opacity: 1, transform: 'none' },
        },
      }}
    >
      {/* Media */}
      <Box
        component="img"
        className="cine-img"
        src={imageSrc}
        alt={`${getProfessionDisplayName(profession) || 'Innhold'}: ${item.title}`}
        loading={showcaseSettings.lazyLoading === false ? 'eager' : 'lazy'}
        onError={(e: any) => {
          const target = e.target as HTMLImageElement;
          target.src = profession === 'videographer'
            ? 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&q=82&fit=crop'
            : profession === 'music_producer'
            ? 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=82&fit=crop'
            : 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&q=82&fit=crop';
        }}
        sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />

      {/* Bottom scrim for legibility */}
      <Box sx={{ position: 'absolute', inset: 0, background: scrimGradient, pointerEvents: 'none' }} />
      {/* Subtle top scrim for top chrome */}
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '38%', background: scrimGradientTop, pointerEvents: 'none' }} />

      {/* Centered play/expand affordance (reveals on hover) */}
      <Box
        className="cine-reveal"
        sx={{
          position: 'absolute', top: '46%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 52, height: 52, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: 'rgba(6,8,13,0.55)', backdropFilter: 'blur(8px)',
          border: `1px solid ${withAlpha(accent, 0.5)}`,
          color: '#fff', pointerEvents: 'none',
        }}
      >
        <MediaTypeIcon sx={{ fontSize: 26 }} />
      </Box>

      {/* Top-left: selection ring */}
      {showcaseSettings.showSelectionButton !== false && (clientMode || isSelected || adminMode) && (
        <Box className={isSelected ? undefined : 'cine-reveal'} sx={{ position: 'absolute', top: 10, left: 10 }}>
          <Tooltip title={isSelected ? 'Fjern fra valg' : 'Legg til valg'} disableInteractive>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); handleClientSelection(item.id); }}
              sx={{
                width: 30, height: 30,
                color: isSelected ? '#fff' : 'rgba(255,255,255,0.9)',
                bgcolor: isSelected ? accent : 'rgba(7,7,7,0.5)',
                backdropFilter: 'blur(6px)',
                border: `1px solid ${isSelected ? accent : 'rgba(255,255,255,0.18)'}`,
                '&:hover': { bgcolor: isSelected ? accent : 'rgba(7,7,7,0.8)' },
              }}
            >
              {isSelected ? <CheckCircle sx={{ fontSize: 18 }} /> : <RadioButtonUnchecked sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Top-right: favorite */}
      {showcaseSettings.showFavoriteButton !== false && (
        <Box className={isFav ? undefined : 'cine-reveal'} sx={{ position: 'absolute', top: 10, right: 10 }}>
          <Tooltip title={isFav ? 'Fjern favoritt' : 'Favoritt'} disableInteractive>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
              sx={{
                width: 30, height: 30,
                color: isFav ? CINE.danger : 'rgba(255,255,255,0.9)',
                bgcolor: 'rgba(7,7,7,0.5)', backdropFilter: 'blur(6px)',
                border: '1px solid rgba(255,255,255,0.16)',
                '&:hover': { color: CINE.danger, bgcolor: 'rgba(7,7,7,0.8)' },
              }}
            >
              {isFav ? <Favorite sx={{ fontSize: 17 }} /> : <FavoriteBorder sx={{ fontSize: 17 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Video duration / audio watermark chips */}
      {profession === 'videographer' && (
        <Chip
          label="2:34"
          size="small"
          sx={{
            position: 'absolute', bottom: 64, right: 12,
            bgcolor: 'rgba(6,8,13,0.78)', color: '#fff',
            fontFamily: CINE_FONT, fontWeight: 600, fontSize: '0.68rem', height: 22,
            border: '1px solid rgba(255,255,255,0.14)',
          }}
        />
      )}
      {profession === 'music_producer' && showcaseSettings.audioWatermarkEnabled && (
        <Chip
          icon={<Security sx={{ fontSize: '0.8rem' }} />}
          label="Lyd-vannmerke"
          size="small"
          sx={{
            position: 'absolute', top: 10, left: showcaseSettings.showSelectionButton !== false ? 48 : 10,
            bgcolor: withAlpha(CINE.success, 0.92), color: '#070707',
            fontWeight: 600, fontSize: '0.66rem', height: 22,
            '& .MuiChip-icon': { color: '#070707' },
          }}
        />
      )}

      {/* Watermark (preserved) */}
      {showcaseSettings.watermark && showcaseSettings.watermark !== 'none' && projectState !== 'delivered' && (
        <Box sx={{
          position: 'absolute',
          [showcaseSettings.watermarkPosition?.includes('top') ? 'top' : 'bottom']: 8,
          [showcaseSettings.watermarkPosition?.includes('left') ? 'left' : 'right']: 8,
          ...(showcaseSettings.watermarkPosition === 'center' && {
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)'
          }),
          bgcolor: `rgba(0,0,0,${(showcaseSettings.watermarkOpacity || 70) / 100})`,
          color: '#fff', px: 1, py: 0.5, borderRadius: 1,
          fontSize: showcaseSettings.watermarkSize === 'small' ? '0.7rem' :
                   showcaseSettings.watermarkSize === 'medium' ? '0.9rem' : '1.1rem',
          fontWeight: 500, backdropFilter: 'blur(4px)', zIndex: 2, pointerEvents: 'none',
        }}>
          {showcaseSettings.watermark === 'text' ? (
            <span>{showcaseSettings.watermarkText || 'CreatorHub'}</span>
          ) : showcaseSettings.watermark === 'logo' ? (
            <Business sx={{ fontSize: 'inherit', verticalAlign: 'middle' }} />
          ) : showcaseSettings.watermark === 'both' ? (
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <Business sx={{ fontSize: 'inherit' }} />
              {showcaseSettings.watermarkText || 'CreatorHub'}
            </Box>
          ) : null}
        </Box>
      )}

      {/* Bottom content: title + meta + reveal action bar */}
      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: 1.75, zIndex: 2 }}>
        <Typography
          className="cine-title"
          sx={{
            fontFamily: CINE_FONT, fontWeight: 700, color: '#fff',
            fontSize: '0.98rem', lineHeight: 1.25,
            textShadow: '0 1px 12px rgba(0,0,0,0.6)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {item.title}
        </Typography>

        {metaLine && (
          <Typography sx={{ ...metaLabelSx, color: 'rgba(255,255,255,0.78)', mt: 0.5 }}>
            {metaLine}
          </Typography>
        )}

        {adminMode && item.projectId && (
          <Chip
            icon={<TimelineIcon sx={{ fontSize: 14 }} />}
            label="Prosjekt"
            size="small"
            onClick={(e) => { e.stopPropagation(); onOpenProject?.(item); }}
            sx={{
              mt: 0.75, height: 22, fontSize: '0.66rem', fontWeight: 600,
              bgcolor: withAlpha(accent, 0.18), color: accent,
              border: `1px solid ${withAlpha(accent, 0.4)}`,
              '& .MuiChip-icon': { color: accent },
            }}
          />
        )}

        {/* Action bar — reveals on hover, always shown on touch */}
        <Box className="cine-reveal" sx={{ display: 'flex', gap: 0.75, mt: 1.25, flexWrap: 'wrap' }}>
          {showcaseSettings.showCommentButton !== false && (
            <OverlayAction
              title="Kommentarer"
              disabled={projectState === 'delivered'}
              onClick={() => { setSelectedItem(item); setShowComments(!showComments); }}
            >
              <Comment sx={{ fontSize: 16 }} />
            </OverlayAction>
          )}
          {showcaseSettings.showDownloadButton !== false && (
            <OverlayAction
              title="Last ned"
              disabled={projectState === 'in_review'}
              onClick={() => handleDownload(item)}
            >
              <Download sx={{ fontSize: 16 }} />
            </OverlayAction>
          )}
          {showcaseSettings.showFullscreenButton !== false && (
            <OverlayAction title="Åpne fullskjerm" onClick={() => setSelectedItem(item)}>
              <Fullscreen sx={{ fontSize: 16 }} />
            </OverlayAction>
          )}
          {adminMode && item.projectId && clientSession && (
            <OverlayAction
              title="Oppdater prosjektstatus"
              active
              activeColor={projectState === 'delivered' ? CINE.success : CINE.warning}
              onClick={() => {
                setSelectedItemForStateUpdate(item);
                setNewProjectState(projectState || 'in_review');
                setProjectStateUpdateOpen(true);
              }}
            >
              <CheckCircle sx={{ fontSize: 16 }} />
            </OverlayAction>
          )}
        </Box>
      </Box>
    </Box>

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

        {setSelectedItemForEvendi && setShowPublishToEvendiDialog && (
          <>
            <Divider sx={{ my: 1 }} />
            <MenuItem onClick={() => {
              setSelectedItemForEvendi(item);
              setShowPublishToEvendiDialog(true);
              handleClose();
            }}>
              <ListItemIcon>
                <OpenInNew fontSize="small" sx={{ color: '#E91E63' }} />
              </ListItemIcon>
              <ListItemText>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Publiser til Evendi
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
