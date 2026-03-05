import React from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';

interface AcademyPlayerStudioProps {
  src: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
  onLoadedMetadata?: React.ReactEventHandler<HTMLVideoElement>;
  onTimeUpdate?: React.ReactEventHandler<HTMLVideoElement>;
  onPlay?: React.ReactEventHandler<HTMLVideoElement>;
  onPause?: React.ReactEventHandler<HTMLVideoElement>;
  muted?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  controls?: boolean;
  objectFit?: React.CSSProperties['objectFit'];
  containerSx?: SxProps<Theme>;
  videoStyle?: React.CSSProperties;
  children?: React.ReactNode;
}

const defaultContainerSx: SxProps<Theme> = {
  borderRadius: 1,
  overflow: 'hidden',
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
  position: 'relative',
  aspectRatio: '16 / 9',
  background:
    'radial-gradient(circle at 70% 16%, rgba(248,179,33,0.18), rgba(9,12,18,0) 46%), linear-gradient(145deg, rgba(20,24,35,0.96), rgba(9,12,18,0.96))',
};

function AcademyPlayerStudio({
  src,
  videoRef,
  onLoadedMetadata,
  onTimeUpdate,
  onPlay,
  onPause,
  muted = false,
  autoPlay = false,
  loop = false,
  controls = false,
  objectFit = 'cover',
  containerSx,
  videoStyle,
  children,
}: AcademyPlayerStudioProps) {
  return (
    <Box sx={{ ...defaultContainerSx, ...containerSx }}>
      <video
        ref={videoRef}
        src={src}
        muted={muted}
        autoPlay={autoPlay}
        loop={loop}
        controls={controls}
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onPlay={onPlay}
        onPause={onPause}
        style={{
          width: '100%',
          height: '100%',
          objectFit,
          display: 'block',
          transform: 'none',
          ...videoStyle,
        }}
      />
      {children}
    </Box>
  );
}

export default AcademyPlayerStudio;
