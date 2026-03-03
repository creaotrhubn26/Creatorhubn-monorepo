/**
 * Live Cursor Tracking - Real-time cursor positions and user presence.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Chip,
  Paper,
  Slider,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

interface CursorPosition {
  x: number;
  y: number;
  elementId: string;
  elementType: string;
  offset?: number;
}

interface UserCursor {
  userId: string;
  userName: string;
  userColor: string;
  userAvatar?: string;
  position: CursorPosition;
  isActive: boolean;
  lastSeen: Date;
  isTyping: boolean;
  typingText?: string;
}

interface LiveCursorTrackingProps {
  documentId: string;
  currentUserId: string;
  onCursorMove: (position: CursorPosition) => void;
  onUserHover: (userId: string) => void;
  className?: string;
}

const INITIAL_CURSOR_SEED: Omit<UserCursor, 'lastSeen' | 'isTyping' | 'typingText'>[] = [
  {
    userId: 'remote-1',
    userName: 'Anna',
    userColor: '#ff7043',
    position: { x: 80, y: 120, elementId: 'paragraph-1', elementType: 'text', offset: 0 },
    isActive: true,
  },
  {
    userId: 'remote-2',
    userName: 'Mark',
    userColor: '#26a69a',
    position: { x: 240, y: 210, elementId: 'diagram-2', elementType: 'diagram', offset: 0 },
    isActive: true,
  },
  {
    userId: 'remote-3',
    userName: 'Sofia',
    userColor: '#5c6bc0',
    position: { x: 320, y: 90, elementId: 'heading-1', elementType: 'text', offset: 0 },
    isActive: true,
  },
];

function jitter(value: number, min: number, max: number): number {
  const next = value + (Math.random() - 0.5) * 20;
  return Math.max(min, Math.min(max, next));
}

function formatLastSeen(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) {
    return 'just now';
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export const LiveCursorTracking: React.FC<LiveCursorTrackingProps> = ({
  documentId,
  currentUserId,
  onCursorMove,
  onUserHover,
  className,
}) => {
  const theming = useTheming('photographer');
  const containerRef = useRef<HTMLDivElement>(null);

  const [showCursors, setShowCursors] = useState(true);
  const [cursorOpacity, setCursorOpacity] = useState(1);
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
  const [userCursors, setUserCursors] = useState<UserCursor[]>(
    INITIAL_CURSOR_SEED.map((seed) => ({
      ...seed,
      lastSeen: new Date(),
      isTyping: false,
      typingText: undefined,
    })),
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setUserCursors((previous) =>
        previous.map((cursor) => {
          const width = containerRef.current?.clientWidth ?? 700;
          const height = containerRef.current?.clientHeight ?? 380;
          const isTyping = Math.random() > 0.75;

          return {
            ...cursor,
            lastSeen: new Date(),
            isTyping,
            typingText: isTyping ? 'Typing...' : undefined,
            position: {
              ...cursor.position,
              x: jitter(cursor.position.x, 8, Math.max(8, width - 24)),
              y: jitter(cursor.position.y, 8, Math.max(8, height - 24)),
            },
          };
        }),
      );
    }, 1100);

    return () => {
      window.clearInterval(interval);
    };
  }, [documentId]);

  const visibleCursors = useMemo(
    () => userCursors.filter((cursor) => cursor.userId !== currentUserId),
    [currentUserId, userCursors],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const position: CursorPosition = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        elementId: 'editor-canvas',
        elementType: 'text',
        offset: 0,
      };
      onCursorMove(position);
    },
    [onCursorMove],
  );

  return (
    <Box className={className} sx={{ width: '100%' }}>
      <Paper sx={{ ...theming.getThemedCardSx(), p: 1.5, mb: 1 }}>
        <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2" sx={{ color: theming.colors.primary }}>
              Live Cursor Tracking
            </Typography>
            <Chip size="small" label={`${visibleCursors.length} active`} />
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {showCursors ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
            <Switch checked={showCursors} onChange={(event) => setShowCursors(event.target.checked)} />
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 56 }}>
            Opacity
          </Typography>
          <Slider
            min={0.2}
            max={1}
            step={0.1}
            value={cursorOpacity}
            onChange={(_event, value) => setCursorOpacity(Number(value))}
            sx={{ maxWidth: 220 }}
          />
        </Stack>
      </Paper>

      <Paper
        ref={containerRef}
        onMouseMove={handleMouseMove}
        sx={{
          border: '1px dashed',
          borderColor: 'divider',
          height: 320,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {showCursors
          ? visibleCursors.map((cursor) => {
              const isHovered = hoveredUserId === cursor.userId;
              return (
                <Tooltip
                  key={cursor.userId}
                  title={`${cursor.userName} • ${formatLastSeen(cursor.lastSeen)}`}
                  placement="top"
                >
                  <Box
                    sx={{
                      cursor: 'pointer',
                      left: cursor.position.x,
                      opacity: cursorOpacity,
                      position: 'absolute',
                      top: cursor.position.y,
                      transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                      transition: 'transform 120ms ease',
                      zIndex: 2,
                    }}
                    onMouseEnter={() => {
                      setHoveredUserId(cursor.userId);
                      onUserHover(cursor.userId);
                    }}
                    onMouseLeave={() => setHoveredUserId(null)}
                  >
                    <Box
                      sx={{
                        borderBottom: `12px solid ${cursor.userColor}`,
                        borderLeft: '8px solid transparent',
                        borderRight: '8px solid transparent',
                        height: 0,
                        width: 0,
                      }}
                    />
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                      <Avatar src={cursor.userAvatar} sx={{ width: 20, height: 20, fontSize: 11 }}>
                        {cursor.userName.slice(0, 1)}
                      </Avatar>
                      <Chip
                        size="small"
                        label={cursor.isTyping ? cursor.typingText ?? cursor.userName : cursor.userName}
                        sx={{
                          bgcolor: cursor.userColor,
                          color: '#fff',
                          height: 18,
                          '& .MuiChip-label': { px: 0.75, fontSize: 10 },
                        }}
                      />
                    </Stack>
                  </Box>
                </Tooltip>
              );
            })
          : null}

        {!showCursors ? (
          <Stack sx={{ alignItems: 'center', height: '100%', justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Cursor tracking is turned off.
            </Typography>
          </Stack>
        ) : null}
      </Paper>
    </Box>
  );
};

export default LiveCursorTracking;
