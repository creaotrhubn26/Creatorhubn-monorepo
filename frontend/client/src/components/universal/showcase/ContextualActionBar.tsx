/**
 * Contextual Action Bar Component
 * Replaces floating action panels with a sticky top bar
 * Shows profession-specific actions when items are selected
 */

import React from 'react';
import {
  Box,
  Button,
  IconButton,
  Chip,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  Typography,
  Divider,
  Stack
} from '@mui/material';
import { useDynamicProfessions } from '../../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import {
  AutoFixHigh,
  Copyright,
  ContentCopy,
  DriveFileMove,
  CloudDownload,
  Favorite,
  Edit,
  Archive,
  Delete,
  Undo,
  Redo,
  MoreVert,
  Close,
  Share,
  AttachMoney,
  // Video icons
  MovieCreation,
  TrendingUp as TimelineIcon,
  Layers,
  VolumeUp,
  Subtitles,
  HighQuality,
  // Music icons
  GraphicEq,
  Security,
  LibraryAdd,
  // Vendor icons
  Business,
  ViewModule,
  Payment
} from '@mui/icons-material';

interface ContextualActionBarProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  selectedCount: number;
  accentColor: string;
  onClearSelection: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isProcessing?: boolean;
  processingMessage?: string;
  progress?: number;
  // Action handlers
  onEnhance?: () => void;
  onWatermark?: () => void;
  onCopy?: () => void;
  onMove?: () => void;
  onDownload?: () => void;
  onFavorite?: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onSetPrice?: () => void;
  // Videographer actions
  onAddToSequence?: () => void;
  onGenerateProxy?: () => void;
  onExportSocial?: () => void;
  onRenderPresets?: () => void;
  // Music producer actions
  onExtractStems?: () => void;
  onAudioWatermark?: () => void;
  onAnalyzeAudio?: () => void;
  onAddToSamplePack?: () => void;
  // Vendor actions
  onAddToBundle?: () => void;
  onEditPricing?: () => void;
  onAddVariants?: () => void;
  onUpdateInventory?: () => void;
}

export const ContextualActionBar: React.FC<ContextualActionBarProps> = ({
  profession,
  selectedCount,
  accentColor,
  onClearSelection,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  isProcessing = false,
  processingMessage,
  progress = 0,
  onEnhance,
  onWatermark,
  onCopy,
  onMove,
  onDownload,
  onFavorite,
  onEdit,
  onArchive,
  onDelete,
  onShare,
  onSetPrice,
  onAddToSequence,
  onGenerateProxy,
  onExportSocial,
  onRenderPresets,
  onExtractStems,
  onAudioWatermark,
  onAnalyzeAudio,
  onAddToSamplePack,
  onAddToBundle,
  onEditPricing,
  onAddVariants,
  onUpdateInventory
}) => {
  const [moreMenuAnchor, setMoreMenuAnchor] = React.useState<null | HTMLElement>(null);

  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = profession || professionAdapter.profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || accentColor;

  if (selectedCount === 0) return null;

  // Get profession-specific primary actions (max 4-5 visible)
  const getPrimaryActions = () => {
    switch (profession) {
      case 'photographer':
        return [
          { label: 'Enhance', icon: <AutoFixHigh />, onClick: onEnhance, color: '#FF6B35' },
          { label: 'Watermark', icon: <Copyright />, onClick: onWatermark, color: '#FF8C00' },
          { label: 'Download', icon: <CloudDownload />, onClick: onDownload, color: '#4CAF50' },
          { label: 'Delete', icon: <Delete />, onClick: onDelete, color: '#F44336' }
        ];
      
      case 'videographer':
        return [
          { label: 'Add to Sequence', icon: <TimelineIcon />, onClick: onAddToSequence, color: '#E74C3C' },
          { label: 'Generate Proxy', icon: <Layers />, onClick: onGenerateProxy, color: '#C0392B' },
          { label: 'Export Social', icon: <Share />, onClick: onExportSocial, color: '#3498DB' },
          { label: 'Render', icon: <HighQuality />, onClick: onRenderPresets, color: '#F39C12' }
        ];
      
      case 'music_producer':
        return [
          { label: 'Extract Stems', icon: <GraphicEq />, onClick: onExtractStems, color: '#9B59B6' },
          { label: 'Audio Watermark', icon: <Security />, onClick: onAudioWatermark, color: '#8E44AD' },
          { label: 'Analyze AI', icon: <AutoFixHigh />, onClick: onAnalyzeAudio, color: '#E74C3C' },
          { label: 'Add to Pack', icon: <LibraryAdd />, onClick: onAddToSamplePack, color: '#27AE60' }
        ];
      
      case 'vendor':
        return [
          { label: 'Add to Bundle', icon: <Business />, onClick: onAddToBundle, color: '#3498DB' },
          { label: 'Edit Pricing', icon: <Payment />, onClick: onEditPricing, color: '#27AE60' },
          { label: 'Add Variants', icon: <ViewModule />, onClick: onAddVariants, color: '#E67E22' },
          { label: 'Update Inventory', icon: <Archive />, onClick: onUpdateInventory, color: '#95A5A6' }
        ];
      
      default:
        return [];
    }
  };

  // Get secondary actions (in overflow menu)
  const getSecondaryActions = () => [
    { label: 'Copy', icon: <ContentCopy />, onClick: onCopy },
    { label: 'Move', icon: <DriveFileMove />, onClick: onMove },
    { label: 'Favorite', icon: <Favorite />, onClick: onFavorite },
    { label: 'Edit', icon: <Edit />, onClick: onEdit },
    { label: 'Archive', icon: <Archive />, onClick: onArchive },
    { label: 'Share', icon: <Share />, onClick: onShare }
  ];

  const primaryActions = getPrimaryActions();
  const secondaryActions = getSecondaryActions();

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 120,
        bgcolor: 'rgba(15, 20, 25, 0.98)',
        backdropFilter: 'blur(20px)',
        borderBottom: `2px solid ${accentColor}`,
        boxShadow: `0 4px 20px ${accentColor}40`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: 'slideDown 0.3s ease-out'
      }}
    >
      {/* Processing State */}
      {isProcessing && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 2,
            bgcolor: 'transparent', '& .MuiLinearProgress-bar': {
              bgcolor: accentColor
            }
          }}
        />
      )}

      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2, 
        p: 2,
        maxWidth: '100%',
        overflow: 'hidden'
      }}>
        {/* Selection Info */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          minWidth: 120
        }}>
          {professionIcon && (
            <Box
              component="span"
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: professionColor,
                fontSize: '1.2rem'
              }}
            >
              {professionIcon}
            </Box>
          )}
          <Chip
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {enhancedProfessionConfig?.displayName || profession}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  • {selectedCount} selected
                </Typography>
              </Box>
            }
            size="small"
            sx={{
              bgcolor: `${accentColor}20`,
              color: accentColor,
              fontWeight: 600,
              border: `1px solid ${accentColor}`
            }}
          />
          {isProcessing && processingMessage && (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {processingMessage}...
            </Typography>
          )}
        </Box>

        {/* Primary Actions */}
        <Stack 
          direction="row" 
          spacing={1} 
          sx={{ 
            flex: 1, 
            overflow: 'hidden',
            display: 'flex',
            flexWrap: 'nowrap'
          }}
        >
          {primaryActions.map((action, index) => (
            <Tooltip key={index} title={action.label}>
              <Button
                variant="outlined"
                size="small"
                startIcon={action.icon}
                onClick={action.onClick}
                disabled={isProcessing}
                sx={{
                  borderColor: `${action.color}60`,
                  color: action.color,
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  '&:hover': {
                    borderColor: action.color,
                    bgcolor: `${action.color}20`
                  },
                  display: { xs: 'none', sm: 'inline-flex' }
                }}
              >
                {action.label}
              </Button>
            </Tooltip>
          ))}

          {/* Mobile: Show only icons */}
          <Box sx={{ display: { xs: 'flex', sm: 'none' }, gap: 0.5 }}>
            {primaryActions.slice(0, 3).map((action, index) => (
              <Tooltip key={index} title={action.label}>
                <IconButton
                  size="small"
                  onClick={action.onClick}
                  disabled={isProcessing}
                  sx={{
                    color: action.color, '&:hover': {
                      bgcolor: `${action.color}20`
                    }
                  }}
                >
                  {action.icon}
                </IconButton>
              </Tooltip>
            ))}
          </Box>
        </Stack>

        {/* More Menu */}
        <Tooltip title="More actions">
          <IconButton
            size="small"
            onClick={(e) => setMoreMenuAnchor(e.currentTarget)}
            disabled={isProcessing}
            sx={{
              color: 'rgba(255,255,255,0.7)',
              '&:hover': {
                color: accentColor,
                bgcolor: `${accentColor}20`
              }
            }}
          >
            <MoreVert />
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={moreMenuAnchor}
          open={Boolean(moreMenuAnchor)}
          onClose={() => setMoreMenuAnchor(null)}
        >
          {secondaryActions.map((action, index) => (
            <MenuItem 
              key={index}
              onClick={() => {
                action.onClick?.();
                setMoreMenuAnchor(null);
              }}
            >
              <ListItemIcon>
                {action.icon}
              </ListItemIcon>
              <ListItemText>{action.label}</ListItemText>
            </MenuItem>
          ))}
        </Menu>

        <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

        {/* Undo/Redo */}
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Undo (Cmd+Z)">
            <span>
              <IconButton
                size="small"
                onClick={onUndo}
                disabled={!canUndo || isProcessing}
                sx={{
                  color: canUndo ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
                  '&:hover': {
                    color: accentColor,
                    bgcolor: `${accentColor}20`
                  }
                }}
              >
                <Undo fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          
          <Tooltip title="Redo (Cmd+Shift+Z)">
            <span>
              <IconButton
                size="small"
                onClick={onRedo}
                disabled={!canRedo || isProcessing}
                sx={{
                  color: canRedo ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)',
                  '&:hover': {
                    color: accentColor,
                    bgcolor: `${accentColor}20`
                  }
                }}
              >
                <Redo fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        {/* Close/Clear Selection */}
        <Tooltip title="Clear selection (Esc)">
          <IconButton
            size="small"
            onClick={onClearSelection}
            disabled={isProcessing}
            sx={{
              color: 'rgba(255,255,255,0.7)',
              '&:hover': {
                color: '#F44336',
                bgcolor: 'rgba(244, 67, 54, 0.2)'
              }
            }}
          >
            <Close />
          </IconButton>
        </Tooltip>
      </Box>

      {/* CSS Animation */}
      <style>
        {`
          @keyframes slideDown {
            from {
              transform: translateY(-100%);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}
      </style>
    </Box>
  );
};

export default ContextualActionBar;

