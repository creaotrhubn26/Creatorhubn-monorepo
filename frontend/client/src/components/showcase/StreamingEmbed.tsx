// @ts-nocheck
/**
 * StreamingEmbed — Slice 9X.81
 *
 * Detekter Spotify / SoundCloud / YouTube / Vimeo / Apple Music-URL
 * og rendrer riktig iframe-embed for showcase-items. Returnerer null
 * hvis URL ikke matcher noen kjent provider — caller faller tilbake
 * til standard <img>/<video>-rendering.
 *
 * Brukes for music_producer (Spotify/SoundCloud) og videographer
 * (YouTube/Vimeo). Photographer-items har sjelden embeds.
 */

import React from 'react';
import { Box } from '@mui/material';

interface Props {
  url: string;
  title?: string;
  /** Tving en bestemt provider hvis URL ikke kan detekteres */
  provider?: 'spotify' | 'soundcloud' | 'youtube' | 'vimeo' | 'apple-music';
  /** Aspect-ratio for video-embeds; ignorert for audio (compact) */
  aspectRatio?: string;
}

interface DetectedEmbed {
  provider: 'spotify' | 'soundcloud' | 'youtube' | 'vimeo' | 'apple-music';
  embedUrl: string;
  isAudio: boolean;
  height?: number;
}

export function detectStreamingEmbed(url: string): DetectedEmbed | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // YouTube — youtube.com/watch?v=ID, youtu.be/ID, shorts/ID
  const ytMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (ytMatch) {
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`,
      isAudio: false,
    };
  }

  // Vimeo — vimeo.com/ID
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    return {
      provider: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      isAudio: false,
    };
  }

  // Spotify — track/album/playlist/episode
  const spotifyMatch = trimmed.match(
    /open\.spotify\.com\/(track|album|playlist|episode|show|artist)\/([a-zA-Z0-9]+)/,
  );
  if (spotifyMatch) {
    return {
      provider: 'spotify',
      embedUrl: `https://open.spotify.com/embed/${spotifyMatch[1]}/${spotifyMatch[2]}`,
      isAudio: true,
      height: spotifyMatch[1] === 'track' || spotifyMatch[1] === 'episode' ? 152 : 380,
    };
  }

  // SoundCloud — needs full URL passed to widget API
  if (/soundcloud\.com\//.test(trimmed)) {
    return {
      provider: 'soundcloud',
      embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(trimmed)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`,
      isAudio: true,
      height: 166,
    };
  }

  // Apple Music — music.apple.com/.../album/.../id123 eller song?i=123
  if (/music\.apple\.com\//.test(trimmed)) {
    return {
      provider: 'apple-music',
      // Apple bruker embed.music.apple.com som mirror
      embedUrl: trimmed.replace('music.apple.com', 'embed.music.apple.com'),
      isAudio: true,
      height: 175,
    };
  }

  return null;
}

const StreamingEmbed: React.FC<Props> = ({ url, title, provider: forcedProvider, aspectRatio = '16 / 9' }) => {
  const detected = detectStreamingEmbed(url);
  if (!detected && !forcedProvider) return null;

  const provider = forcedProvider || detected!.provider;
  const embedUrl = detected?.embedUrl || url;
  const isAudio = detected?.isAudio ?? (provider === 'spotify' || provider === 'soundcloud' || provider === 'apple-music');
  const height = detected?.height || (isAudio ? 152 : undefined);

  const titleSafe = title || `${provider} embed`;

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        ...(isAudio
          ? { height: `${height || 152}px` }
          : { aspectRatio, overflow: 'hidden', borderRadius: 2 }),
      }}
    >
      <iframe
        src={embedUrl}
        title={titleSafe}
        loading="lazy"
        allow={
          provider === 'youtube' || provider === 'vimeo'
            ? 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
            : 'autoplay; clipboard-write; encrypted-media; picture-in-picture'
        }
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: isAudio ? 12 : 8,
        }}
      />
    </Box>
  );
};

export default StreamingEmbed;
