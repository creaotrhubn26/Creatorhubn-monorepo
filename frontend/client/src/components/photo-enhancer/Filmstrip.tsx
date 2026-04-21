import React, { useCallback } from 'react';
import { Box, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import {
  Check as CheckIcon,
  Close as CloseIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import type { SessionImage } from '../../lib/enhancer-session/types';

export interface FilmstripProps {
  images: SessionImage[];
  selectedId: string | null;
  multiSelectIds: string[];
  onSelect: (id: string, event: React.MouseEvent) => void;
  onRemove?: (id: string) => void;
}

/**
 * Horizontal strip of tappable thumbnails. Shows rating stars, pick/reject
 * flag, and an "enhanced" check when a final render exists. Hidden by the
 * parent when session has ≤1 image.
 */
export function Filmstrip(props: FilmstripProps) {
  const { images, selectedId, multiSelectIds, onSelect, onRemove } = props;
  const selected = new Set(multiSelectIds);

  const handleClick = useCallback(
    (id: string) => (event: React.MouseEvent) => {
      event.preventDefault();
      onSelect(id, event);
    },
    [onSelect],
  );

  if (images.length === 0) return null;

  return (
    <Box
      role="listbox"
      aria-label="Session filmstrip"
      sx={{
        display: 'flex',
        gap: 1,
        overflowX: 'auto',
        py: 1,
        px: 0.5,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        '&::-webkit-scrollbar': { height: 6 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'action.disabled', borderRadius: 3 },
      }}
    >
      {images.map((image) => {
        const isActive = image.id === selectedId;
        const isMulti = selected.has(image.id);
        const border = isActive ? 'primary.main' : isMulti ? 'secondary.main' : 'transparent';
        return (
          <Box
            key={image.id}
            role="option"
            aria-selected={isActive || isMulti}
            onClick={handleClick(image.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(image.id, event as unknown as React.MouseEvent);
              }
            }}
            tabIndex={0}
            sx={{
              position: 'relative',
              flex: '0 0 auto',
              width: 96,
              height: 96,
              borderRadius: 1.5,
              overflow: 'hidden',
              border: '2px solid',
              borderColor: border,
              cursor: 'pointer',
              bgcolor: 'grey.900',
              outline: 'none',
              transition: 'border-color 120ms',
              opacity: image.flag === 'reject' ? 0.45 : 1,
            }}
          >
            <img
              src={image.previewUrl}
              alt={image.fileName}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              draggable={false}
            />

            <Box
              sx={{
                position: 'absolute',
                top: 4,
                left: 4,
                right: 4,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              {image.rating > 0 ? (
                <Stack direction="row" spacing={0.25} alignItems="center" sx={filmstripBadgeSx}>
                  <StarIcon sx={{ fontSize: 12 }} />
                  <Typography variant="caption" sx={{ fontSize: 10 }}>
                    {image.rating}
                  </Typography>
                </Stack>
              ) : (
                <span />
              )}

              {image.flag === 'pick' ? (
                <Box sx={{ ...filmstripBadgeSx, bgcolor: 'success.dark' }}>
                  <CheckIcon sx={{ fontSize: 12 }} />
                </Box>
              ) : image.flag === 'reject' ? (
                <Box sx={{ ...filmstripBadgeSx, bgcolor: 'error.dark' }}>
                  <CloseIcon sx={{ fontSize: 12 }} />
                </Box>
              ) : null}
            </Box>

            <Box
              sx={{
                position: 'absolute',
                bottom: 4,
                left: 4,
                right: 4,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'common.white',
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  fontSize: 10,
                }}
                title={image.fileName}
              >
                {image.fileName}
              </Typography>
              {image.enhancedUrl ? (
                <Chip
                  size="small"
                  label="✓"
                  color="success"
                  sx={{ height: 14, '& .MuiChip-label': { px: 0.5, fontSize: 9 } }}
                />
              ) : null}
            </Box>

            {onRemove && (
              <Tooltip title="Fjern fra sesjonen" placement="top">
                <IconButton
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(image.id);
                  }}
                  sx={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    width: 18,
                    height: 18,
                    opacity: 0,
                    transition: 'opacity 120ms',
                    '.MuiBox-root:hover &': { opacity: 1 },
                    '&:hover': { bgcolor: 'background.paper' },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

const filmstripBadgeSx = {
  bgcolor: 'rgba(0,0,0,0.6)',
  color: 'common.white',
  borderRadius: '999px',
  px: 0.5,
  py: 0.125,
  minWidth: 14,
  height: 14,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const;
