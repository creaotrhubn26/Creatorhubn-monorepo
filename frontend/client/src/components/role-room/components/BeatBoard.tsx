/**
 * BeatBoard - Story Cards / Beat Sheet View
 * 
 * Visual representation of scene beats as draggable cards.
 * Similar to index cards on a cork board for story structure.
 */

import { useState, useCallback, useMemo, type FC } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  TextField,
  Stack,
  Tooltip,
  Paper,
  Badge,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Fade,
  Zoom,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  DragIndicator as DragIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Movie as SceneIcon,
  Person as CharacterIcon,
  SentimentSatisfied as PositiveIcon,
  SentimentDissatisfied as NegativeIcon,
  SentimentNeutral as NeutralIcon,
  Notes as NotesIcon,
  ColorLens as ColorIcon,
  PlayArrow as PlayIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  GridView as GridViewIcon,
  ViewList as ListViewIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from '@mui/icons-material';
import { BeatCard } from '../services/scriptAnalysisService';

// 7-Tier Responsive System
type ScreenTier = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | '4k';

const useScreenTier = (): { tier: ScreenTier; isMobile: boolean; isTablet: boolean; isDesktop: boolean; is4K: boolean } => {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));      // < 600px
  const isSm = useMediaQuery(theme.breakpoints.between('sm', 'md')); // 600-899px
  const isMd = useMediaQuery(theme.breakpoints.between('md', 'lg')); // 900-1199px
  const isLg = useMediaQuery(theme.breakpoints.between('lg', 'xl')); // 1200-1535px
  const isXl = useMediaQuery(theme.breakpoints.between('xl', 1920)); // 1536-1919px
  const isXxl = useMediaQuery('(min-width: 1920px) and (max-width: 2559px)'); // 1920-2559px
  const is4K = useMediaQuery('(min-width: 2560px)'); // 2560px+

  const tier: ScreenTier = is4K ? '4k' : isXxl ? 'xxl' : isXl ? 'xl' : isLg ? 'lg' : isMd ? 'md' : isSm ? 'sm' : 'xs';
  
  return {
    tier,
    isMobile: tier === 'xs' || tier === 'sm',
    isTablet: tier === 'md',
    isDesktop: tier === 'lg' || tier === 'xl' || tier === 'xxl' || tier === '4k',
    is4K: tier === '4k',
  };
};

const getResponsiveValues = (tier: ScreenTier) => {
  const values = {
    xs: {
      headerFontSize: '0.85rem',
      titleFontSize: '0.75rem',
      bodyFontSize: '0.65rem',
      captionFontSize: '0.55rem',
      buttonSize: 'small' as const,
      iconSize: 16,
      spacing: 0.75,
      padding: 0.75,
      cardPadding: 1,
      gap: 0.75,
      toolbarPadding: 0.5,
      actHeaderFontSize: '0.8rem',
      beatCardWidth: '100%',
      minCardSize: 140,
    },
    sm: {
      headerFontSize: '0.95rem',
      titleFontSize: '0.85rem',
      bodyFontSize: '0.7rem',
      captionFontSize: '0.6rem',
      buttonSize: 'small' as const,
      iconSize: 18,
      spacing: 1,
      padding: 1,
      cardPadding: 1.25,
      gap: 1,
      toolbarPadding: 0.75,
      actHeaderFontSize: '0.9rem',
      beatCardWidth: 'calc(50% - 8px)',
      minCardSize: 150,
    },
    md: {
      headerFontSize: '1rem',
      titleFontSize: '0.9rem',
      bodyFontSize: '0.75rem',
      captionFontSize: '0.65rem',
      buttonSize: 'small' as const,
      iconSize: 20,
      spacing: 1.25,
      padding: 1.5,
      cardPadding: 1.5,
      gap: 1.25,
      toolbarPadding: 1,
      actHeaderFontSize: '1rem',
      beatCardWidth: 'calc(33.333% - 9px)',
      minCardSize: 160,
    },
    lg: {
      headerFontSize: '1.1rem',
      titleFontSize: '0.95rem',
      bodyFontSize: '0.8rem',
      captionFontSize: '0.7rem',
      buttonSize: 'medium' as const,
      iconSize: 22,
      spacing: 1.5,
      padding: 2,
      cardPadding: 1.75,
      gap: 1.5,
      toolbarPadding: 1.25,
      actHeaderFontSize: '1.1rem',
      beatCardWidth: 'calc(25% - 12px)',
      minCardSize: 180,
    },
    xl: {
      headerFontSize: '1.2rem',
      titleFontSize: '1rem',
      bodyFontSize: '0.85rem',
      captionFontSize: '0.75rem',
      buttonSize: 'medium' as const,
      iconSize: 24,
      spacing: 2,
      padding: 2.5,
      cardPadding: 2,
      gap: 2,
      toolbarPadding: 1.5,
      actHeaderFontSize: '1.15rem',
      beatCardWidth: 'calc(20% - 14px)',
      minCardSize: 200,
    },
    xxl: {
      headerFontSize: '1.3rem',
      titleFontSize: '1.05rem',
      bodyFontSize: '0.9rem',
      captionFontSize: '0.8rem',
      buttonSize: 'medium' as const,
      iconSize: 26,
      spacing: 2.5,
      padding: 3,
      cardPadding: 2.25,
      gap: 2.5,
      toolbarPadding: 1.75,
      actHeaderFontSize: '1.25rem',
      beatCardWidth: 'calc(20% - 14px)',
      minCardSize: 220,
    },
    '4k': {
      headerFontSize: '1.5rem',
      titleFontSize: '1.15rem',
      bodyFontSize: '1rem',
      captionFontSize: '0.9rem',
      buttonSize: 'large' as const,
      iconSize: 28,
      spacing: 3,
      padding: 3.5,
      cardPadding: 2.5,
      gap: 3,
      toolbarPadding: 2,
      actHeaderFontSize: '1.4rem',
      beatCardWidth: 'calc(20% - 15px)',
      minCardSize: 260,
    },
  };
  return values[tier];
};

interface BeatBoardProps {
  beats: BeatCard[];
  onBeatClick?: (beat: BeatCard) => void;
  onBeatEdit?: (beatId: string, updates: Partial<BeatCard>) => void;
  onBeatReorder?: (beats: BeatCard[]) => void;
  onBeatDelete?: (beatId: string) => void;
  onAddBeat?: () => void;
  readOnly?: boolean;
  actsView?: boolean; // Group by acts
  darkMode?: boolean;
}

// Color palette for beat cards
const BEAT_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#6b7280', // Gray
];

// Emotion icons and colors
const getEmotionIcon = (emotion: 'positive' | 'negative' | 'neutral') => {
  switch (emotion) {
    case 'positive':
      return <PositiveIcon sx={{ color: '#4ade80' }} />;
    case 'negative':
      return <NegativeIcon sx={{ color: '#f87171' }} />;
    default:
      return <NeutralIcon sx={{ color: '#a78bfa' }} />;
  }
};

// Beat Card Component
interface BeatCardItemProps {
  beat: BeatCard;
  isSelected?: boolean;
  onClick?: () => void;
  onEdit?: (updates: Partial<BeatCard>) => void;
  onDelete?: () => void;
  readOnly?: boolean;
  size: 'small' | 'medium' | 'large';
  darkMode?: boolean;
  responsive: ReturnType<typeof getResponsiveValues>;
}

const BeatCardItem: FC<BeatCardItemProps> = ({
  beat,
  isSelected,
  onClick,
  onEdit,
  onDelete,
  readOnly = false,
  size = 'medium',
  darkMode = true,
  responsive,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(beat.notes || '');
  const [colorMenuAnchor, setColorMenuAnchor] = useState<HTMLElement | null>(null);
  const cardMinWidth = size === 'small' ? responsive.minCardSize * 0.7 : size === 'medium' ? responsive.minCardSize : responsive.minCardSize * 1.2;

  const handleSaveNotes = () => {
    onEdit?.({ notes: editText });
    setIsEditing(false);
  };

  const handleColorSelect = (color: string) => {
    onEdit?.({ color });
    setColorMenuAnchor(null);
  };

  const cardWidth = cardMinWidth;
  const cardHeight = size === 'small' ? responsive.minCardSize * 0.8 : size === 'medium' ? responsive.minCardSize * 1.1 : responsive.minCardSize * 1.5;

  return (
    <Zoom in timeout={200}>
      <Card
        onClick={onClick}
        sx={{
          width: cardWidth,
          height: cardHeight,
          m: responsive.gap / 2,
          cursor: 'pointer',
          border: isSelected ? `2px solid #3b82f6` : `1px solid rgba(255,255,255,0.1)`,
          bgcolor: beat.color ? `${beat.color}15` : darkMode ? 'rgba(30,30,30,0.9)' : 'rgba(255,255,255,0.95)',
          borderLeft: `${responsive.spacing / 2}px solid ${beat.color || '#6b7280'}`,
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: `translateY(-${responsive.spacing / 4}px)`,
            boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
            borderColor: beat.color || 'rgba(255,255,255,0.3)',
          },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Drag Handle */}
        {!readOnly && (
          <Box
            sx={{
              position: 'absolute',
              top: 4,
              left: 4,
              opacity: 0.5,
              cursor: 'grab',
              '&:hover': { opacity: 1 },
            }}
          >
            <DragIcon fontSize="small" />
          </Box>
        )}

        {/* Action Buttons */}
        {!readOnly && (
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              position: 'absolute',
              top: 4,
              right: 4,
              opacity: 0,
              transition: 'opacity 0.2s',
              '.MuiCard-root:hover &': { opacity: 1 },
            }}
          >
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setColorMenuAnchor(e.currentTarget);
              }}
            >
              <ColorIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}

        <CardContent sx={{ p: responsive.cardPadding, pt: responsive.spacing * 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Scene Header */}
          <Stack direction="row" alignItems="center" spacing={responsive.gap / 2} sx={{ mb: responsive.spacing }}>
            <Chip
              label={`Scene ${beat.sceneNumber}`}
              size="small"
              sx={{
                bgcolor: beat.color || '#6b7280',
                color: 'white',
                fontWeight: 600,
                fontSize: responsive.captionFontSize,
                height: responsive.spacing * 2,
              }}
            />
            {getEmotionIcon(beat.emotion)}
            <Typography variant="caption" sx={{ opacity: 0.6, ml: 'auto', fontSize: `${responsive.captionFontSize}` }}>
              p.{beat.pageNumber}
            </Typography>
          </Stack>

          {/* Scene Heading */}
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              textTransform: 'uppercase',
              fontSize: responsive.bodyFontSize,
              color: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
              lineHeight: 1.3,
              mb: responsive.spacing / 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {beat.heading}
          </Typography>

          {/* Beat Summary */}
          {isEditing ? (
            <TextField
              size="small"
              multiline
              rows={2}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleSaveNotes}
              autoFocus
              fullWidth
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: '0.75rem',
                },
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.75rem',
                color: darkMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
                flex: 1,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: size === 'small' ? 2 : size === 'medium' ? 3 : 5,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.4,
              }}
            >
              {beat.notes || beat.beat}
            </Typography>
          )}

          {/* Characters */}
          {beat.characters.length > 0 && size !== 'small' && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 'auto', pt: 1, flexWrap: 'wrap', gap: 0.5 }}>
              {beat.characters.slice(0, 3).map((char, idx) => (
                <Tooltip key={idx} title={char}>
                  <Badge
                    badgeContent={<CharacterIcon sx={{ fontSize: 8 }} />}
                    sx={{
                      '& .MuiBadge-badge': {
                        bgcolor: 'transparent',
                        color: 'inherit',
                        top: -2,
                        right: -2,
                      },
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        bgcolor: 'rgba(59,130,246,0.2)',
                        px: 0.5,
                        py: 0.25,
                        borderRadius: 0.5,
                        fontSize: '0.6rem',
                        maxWidth: 50,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {char}
                    </Typography>
                  </Badge>
                </Tooltip>
              ))}
              {beat.characters.length > 3 && (
                <Typography variant="caption" sx={{ opacity: 0.6, fontSize: '0.6rem' }}>
                  +{beat.characters.length - 3}
                </Typography>
              )}
            </Stack>
          )}
        </CardContent>

        {/* Color Menu */}
        <Menu
          anchorEl={colorMenuAnchor}
          open={Boolean(colorMenuAnchor)}
          onClose={() => setColorMenuAnchor(null)}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, p: 1 }}>
            {BEAT_COLORS.map((color) => (
              <Box
                key={color}
                onClick={() => handleColorSelect(color)}
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: color,
                  borderRadius: 1,
                  cursor: 'pointer',
                  border: beat.color === color ? '2px solid white' : 'none',
                  '&:hover': { opacity: 0.8 },
                }}
              />
            ))}
          </Box>
        </Menu>
      </Card>
    </Zoom>
  );
};

export const BeatBoard: FC<BeatBoardProps> = ({
  beats,
  onBeatClick,
  onBeatEdit,
  onBeatReorder,
  onBeatDelete,
  onAddBeat,
  readOnly = false,
  actsView = false,
  darkMode = true,
}) => {
  // 7-Tier responsive system
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);

  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [cardSize, setCardSize] = useState<'small' | 'medium' | 'large'>(isMobile ? 'small' : 'medium');

  const handleBeatClick = useCallback((beat: BeatCard) => {
    setSelectedBeatId(beat.id);
    onBeatClick?.(beat);
  }, [onBeatClick]);

  // Group beats by act (1-3 based on scene number)
  const groupedBeats = useMemo(() => {
    if (!actsView) return { '': beats };
    
    const groups: Record<string, BeatCard[]> = {
      'Akt 1 - Oppsett': [],
      'Akt 2 - Konfrontasjon': [],
      'Akt 3 - Løsning': [],
    };

    const totalScenes = beats.length;
    const act1End = Math.floor(totalScenes * 0.25);
    const act2End = Math.floor(totalScenes * 0.75);

    beats.forEach((beat, idx) => {
      if (idx < act1End) {
        groups['Akt 1 - Oppsett'].push(beat);
      } else if (idx < act2End) {
        groups['Akt 2 - Konfrontasjon'].push(beat);
      } else {
        groups['Akt 3 - Løsning'].push(beat);
      }
    });

    return groups;
  }, [beats, actsView]);

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: darkMode ? '#1a1a2e' : '#f5f5f5',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      <Paper
        elevation={0}
        sx={{
          p: responsive.toolbarPadding,
          display: 'flex',
          alignItems: 'center',
          gap: responsive.gap,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          bgcolor: darkMode ? 'rgba(30,30,50,0.8)' : 'rgba(255,255,255,0.9)',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mr: responsive.gap, fontSize: responsive.headerFontSize }}>
          <SceneIcon sx={{ mr: responsive.gap / 2, fontSize: responsive.iconSize, verticalAlign: 'middle' }} />
          {!isMobile && 'Beat Board'} ({beats.length})
        </Typography>

        <Divider orientation="vertical" flexItem />

        {/* View Mode Toggle */}
        <Tooltip title="Grid View">
          <IconButton
            size={responsive.buttonSize}
            onClick={() => setViewMode('grid')}
            color={viewMode === 'grid' ? 'primary' : 'default'}
          >
            <GridViewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="List View">
          <IconButton
            size={responsive.buttonSize}
            onClick={() => setViewMode('list')}
            color={viewMode === 'list' ? 'primary' : 'default'}
          >
            <ListViewIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem />

        {/* Card Size */}
        <Tooltip title="Smaller Cards">
          <IconButton
            size="small"
            onClick={() => setCardSize(s => s === 'large' ? 'medium' : 'small')}
          >
            <ZoomOutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="caption" sx={{ minWidth: 50, textAlign: 'center' }}>
          {cardSize === 'small' ? 'S' : cardSize === 'medium' ? 'M' : 'L'}
        </Typography>
        <Tooltip title="Larger Cards">
          <IconButton
            size="small"
            onClick={() => setCardSize(s => s === 'small' ? 'medium' : 'large')}
          >
            <ZoomInIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {!readOnly && (
          <>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Add Beat">
              <IconButton size="small" onClick={onAddBeat} color="primary">
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Paper>

      {/* Beat Cards Container */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: responsive.padding,
        }}
      >
        {Object.entries(groupedBeats).map(([actName, actBeats]) => (
          <Box key={actName || 'all'} sx={{ mb: responsive.spacing * 2 }}>
            {actsView && actName && (
              <Typography
                variant="subtitle2"
                sx={{
                  mb: responsive.spacing,
                  pb: responsive.spacing / 2,
                  borderBottom: `2px solid rgba(59,130,246,0.5)`,
                  color: darkMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)',
                  fontWeight: 600,
                  fontSize: responsive.actHeaderFontSize,
                }}
              >
                {actName} ({actBeats.length})
              </Typography>
            )}
            <Box
              sx={{
                display: viewMode === 'grid' ? 'flex' : 'block',
                flexWrap: 'wrap',
                gap: responsive.gap,
              }}
            >
              {actBeats.map((beat) => (
                <BeatCardItem
                  key={beat.id}
                  beat={beat}
                  isSelected={selectedBeatId === beat.id}
                  onClick={() => handleBeatClick(beat)}
                  onEdit={(updates) => onBeatEdit?.(beat.id, updates)}
                  onDelete={() => onBeatDelete?.(beat.id)}
                  readOnly={readOnly}
                  size={cardSize}
                  darkMode={darkMode}
                  responsive={responsive}
                />
              ))}
            </Box>
          </Box>
        ))}

        {beats.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              opacity: 0.5,
            }}
          >
            <NotesIcon sx={{ fontSize: 48, mb: 2 }} />
            <Typography>Ingen scener funnet</Typography>
            <Typography variant="caption">
              Skriv scener i manuset for å se beat-kort her
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default BeatBoard;
