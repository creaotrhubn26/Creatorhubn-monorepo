import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  IconButton,
  LinearProgress,
  Fade,
  Slide,
  Avatar,
  Chip,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Movie as MovieIcon,
  CameraAlt as CameraIcon,
  Brush as ArtIcon,
  MusicNote as MusicIcon,
  Videocam as VideocamIcon,
  Search as SearchIcon,
  Assignment as TaskIcon,
  Timeline as TimelineIcon,
  CheckCircle as CheckIcon,
  Lightbulb as TipIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';
import settingsService from '../services/settingsService';
import { useT, type TranslationKey } from '../../../i18n';
import { TeamIcon as GroupsIcon, ShareCustomIcon as ShareIcon } from './icons/CastingIcons';

export type ProfessionType = 
  | 'director' 
  | 'photographer' 
  | 'cinematographer' 
  | 'producer' 
  | 'art_director' 
  | 'music_video' 
  | 'commercial' 
  | 'documentary'
  | 'general';

interface OnboardingSlide {
  title: string;
  subtitle?: string;
  content: string;
  features?: Array<{
    icon: React.ReactNode;
    title: string;
    description: string;
  }>;
  tips?: string[];
  illustration?: React.ReactNode;
}

interface ProfessionOnboardingContent {
  welcomeTitle: string;
  welcomeSubtitle: string;
  professionIcon: React.ReactNode;
  professionColor: string;
  slides: OnboardingSlide[];
}

const buildProfessionContent = (
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): Record<ProfessionType, ProfessionOnboardingContent> => ({
  director: {
    welcomeTitle: t('profOnboard.director.wTitle'),
    welcomeSubtitle: t('profOnboard.director.wSub'),
    professionIcon: <MovieIcon sx={{ fontSize: 48 }} />,
    professionColor: '#e91e63',
    slides: [
      {
        title: t('profOnboard.whatIsTitle'),
        subtitle: t('profOnboard.director.s1sub'),
        content: t('profOnboard.director.s1c'),
        illustration: (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 2, 
            flexWrap: 'wrap',
            py: 2 
          }}>
            {['Casting', 'Shot List', 'Storyboard', 'Team'].map((item, i) => (
              <Paper
                key={item}
                elevation={3}
                sx={{
                  p: 2,
                  bgcolor: 'rgba(233,30,99,0.1)',
                  border: '1px solid rgba(233,30,99,0.3)',
                  borderRadius: 2,
                  minWidth: 80,
                  textAlign: 'center',
                  animation: `fadeInUp 0.5s ease ${i * 0.1}s both`,
                  '@keyframes fadeInUp': {
                    from: { opacity: 0, transform: 'translateY(20px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                <Typography variant="body2" sx={{ color: '#e91e63', fontWeight: 600 }}>
                  {item}
                </Typography>
              </Paper>
            ))}
          </Box>
        ),
      },
      {
        title: t('profOnboard.director.s2t'),
        subtitle: t('profOnboard.director.s2sub'),
        content: t('profOnboard.director.s2c'),
        features: [
          {
            icon: <VideocamIcon sx={{ color: '#e91e63' }} />,
            title: t('profOnboard.director.s2f1t'),
            description: t('profOnboard.director.s2f1d'),
          },
          {
            icon: <GroupsIcon sx={{ color: '#e91e63' }} />,
            title: t('profOnboard.director.s2f2t'),
            description: t('profOnboard.director.s2f2d'),
          },
          {
            icon: <TimelineIcon sx={{ color: '#e91e63' }} />,
            title: t('profOnboard.director.s2f3t'),
            description: t('profOnboard.director.s2f3d'),
          },
        ],
      },
      {
        title: t('profOnboard.howToFind'),
        subtitle: t('profOnboard.director.s3sub'),
        content: t('profOnboard.director.s3c'),
        features: [
          {
            icon: <SearchIcon sx={{ color: '#10b981' }} />,
            title: t('profOnboard.director.s3f1t'),
            description: t('profOnboard.director.s3f1d'),
          },
          {
            icon: <TaskIcon sx={{ color: '#10b981' }} />,
            title: t('profOnboard.director.s3f2t'),
            description: t('profOnboard.director.s3f2d'),
          },
          {
            icon: <MovieIcon sx={{ color: '#10b981' }} />,
            title: t('profOnboard.director.s3f3t'),
            description: t('profOnboard.director.s3f3d'),
          },
        ],
        tips: [
          t('profOnboard.tipCtrlF'),
          t('profOnboard.director.s3tip2'),
          t('profOnboard.director.s3tip3'),
        ],
      },
      {
        title: t('profOnboard.director.s4t'),
        subtitle: t('profOnboard.director.s4sub'),
        content: t('profOnboard.director.s4c'),
        features: [
          {
            icon: <ShareIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.shareProject'),
            description: t('profOnboard.director.s4f1d'),
          },
          {
            icon: <TaskIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.director.s4f2t'),
            description: t('profOnboard.director.s4f2d'),
          },
          {
            icon: <GroupsIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.director.s4f3t'),
            description: t('profOnboard.director.s4f3d'),
          },
        ],
        tips: [
          t('profOnboard.director.s4tip1'),
          t('profOnboard.director.s4tip2'),
          t('profOnboard.director.s4tip3'),
        ],
      },
    ],
  },
  photographer: {
    welcomeTitle: t('profOnboard.photographer.wTitle'),
    welcomeSubtitle: t('profOnboard.photographer.wSub'),
    professionIcon: <CameraIcon sx={{ fontSize: 48 }} />,
    professionColor: '#10b981',
    slides: [
      {
        title: t('profOnboard.whatIsTitle'),
        subtitle: t('profOnboard.photographer.s1sub'),
        content: t('profOnboard.photographer.s1c'),
        illustration: (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 2, 
            flexWrap: 'wrap',
            py: 2 
          }}>
            {['Moodboard', 'Shot List', t('profOnboard.photographer.illo.models'), t('profOnboard.photographer.illo.equipment')].map((item, i) => (
              <Paper
                key={item}
                elevation={3}
                sx={{
                  p: 2,
                  bgcolor: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: 2,
                  minWidth: 80,
                  textAlign: 'center',
                  animation: `fadeInUp 0.5s ease ${i * 0.1}s both`,
                  '@keyframes fadeInUp': {
                    from: { opacity: 0, transform: 'translateY(20px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 600 }}>
                  {item}
                </Typography>
              </Paper>
            ))}
          </Box>
        ),
      },
      {
        title: t('profOnboard.photographer.s2t'),
        subtitle: t('profOnboard.photographer.s2sub'),
        content: t('profOnboard.photographer.s2c'),
        features: [
          {
            icon: <CameraIcon sx={{ color: '#10b981' }} />,
            title: t('profOnboard.photographer.s2f1t'),
            description: t('profOnboard.photographer.s2f1d'),
          },
          {
            icon: <GroupsIcon sx={{ color: '#10b981' }} />,
            title: t('profOnboard.photographer.s2f2t'),
            description: t('profOnboard.photographer.s2f2d'),
          },
          {
            icon: <TimelineIcon sx={{ color: '#10b981' }} />,
            title: t('profOnboard.photographer.s2f3t'),
            description: t('profOnboard.photographer.s2f3d'),
          },
        ],
      },
      {
        title: t('profOnboard.howToFind'),
        subtitle: t('profOnboard.photographer.s3sub'),
        content: t('profOnboard.photographer.s3c'),
        features: [
          {
            icon: <SearchIcon sx={{ color: '#10b981' }} />,
            title: t('profOnboard.photographer.s3f1t'),
            description: t('profOnboard.photographer.s3f1d'),
          },
          {
            icon: <TaskIcon sx={{ color: '#10b981' }} />,
            title: t('profOnboard.photographer.s3f2t'),
            description: t('profOnboard.photographer.s3f2d'),
          },
          {
            icon: <CameraIcon sx={{ color: '#10b981' }} />,
            title: t('profOnboard.photographer.s3f3t'),
            description: t('profOnboard.photographer.s3f3d'),
          },
        ],
        tips: [
          t('profOnboard.photographer.s3tip1'),
          t('profOnboard.photographer.s3tip2'),
          t('profOnboard.photographer.s3tip3'),
        ],
      },
      {
        title: t('profOnboard.photographer.s4t'),
        subtitle: t('profOnboard.photographer.s4sub'),
        content: t('profOnboard.photographer.s4c'),
        features: [
          {
            icon: <ShareIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.photographer.s4f1t'),
            description: t('profOnboard.photographer.s4f1d'),
          },
          {
            icon: <TaskIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.checklists'),
            description: t('profOnboard.photographer.s4f2d'),
          },
          {
            icon: <GroupsIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.photographer.s4f3t'),
            description: t('profOnboard.photographer.s4f3d'),
          },
        ],
      },
    ],
  },
  cinematographer: {
    welcomeTitle: t('profOnboard.cinematographer.wTitle'),
    welcomeSubtitle: t('profOnboard.cinematographer.wSub'),
    professionIcon: <VideocamIcon sx={{ fontSize: 48 }} />,
    professionColor: '#f59e0b',
    slides: [
      {
        title: t('profOnboard.whatIsTitle'),
        subtitle: t('profOnboard.cinematographer.s1sub'),
        content: t('profOnboard.cinematographer.s1c'),
        illustration: (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 2, 
            flexWrap: 'wrap',
            py: 2 
          }}>
            {[t('profOnboard.cinematographer.illo.camera'), t('profOnboard.cinematographer.illo.light'), t('profOnboard.cinematographer.illo.movement'), t('profOnboard.cinematographer.illo.color')].map((item, i) => (
              <Paper
                key={item}
                elevation={3}
                sx={{
                  p: 2,
                  bgcolor: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: 2,
                  minWidth: 80,
                  textAlign: 'center',
                  animation: `fadeInUp 0.5s ease ${i * 0.1}s both`,
                  '@keyframes fadeInUp': {
                    from: { opacity: 0, transform: 'translateY(20px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                <Typography variant="body2" sx={{ color: '#f59e0b', fontWeight: 600 }}>
                  {item}
                </Typography>
              </Paper>
            ))}
          </Box>
        ),
      },
      {
        title: t('profOnboard.cinematographer.s2t'),
        subtitle: t('profOnboard.cinematographer.s2sub'),
        content: t('profOnboard.cinematographer.s2c'),
        features: [
          {
            icon: <VideocamIcon sx={{ color: '#f59e0b' }} />,
            title: t('profOnboard.cinematographer.s2f1t'),
            description: t('profOnboard.cinematographer.s2f1d'),
          },
          {
            icon: <TipIcon sx={{ color: '#f59e0b' }} />,
            title: t('profOnboard.cinematographer.s2f2t'),
            description: t('profOnboard.cinematographer.s2f2d'),
          },
          {
            icon: <TimelineIcon sx={{ color: '#f59e0b' }} />,
            title: 'Storyboard',
            description: t('profOnboard.cinematographer.s2f3d'),
          },
        ],
      },
      {
        title: t('profOnboard.howToFind'),
        subtitle: t('profOnboard.cinematographer.s3sub'),
        content: t('profOnboard.cinematographer.s3c'),
        features: [
          {
            icon: <SearchIcon sx={{ color: '#f59e0b' }} />,
            title: t('profOnboard.cinematographer.s3f1t'),
            description: t('profOnboard.cinematographer.s3f1d'),
          },
          {
            icon: <TaskIcon sx={{ color: '#f59e0b' }} />,
            title: t('profOnboard.cinematographer.s3f2t'),
            description: t('profOnboard.cinematographer.s3f2d'),
          },
          {
            icon: <VideocamIcon sx={{ color: '#f59e0b' }} />,
            title: t('profOnboard.cinematographer.s3f3t'),
            description: t('profOnboard.cinematographer.s3f3d'),
          },
        ],
      },
      {
        title: t('profOnboard.cinematographer.s4t'),
        subtitle: t('profOnboard.cinematographer.s4sub'),
        content: t('profOnboard.cinematographer.s4c'),
        features: [
          {
            icon: <ShareIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.cinematographer.s4f1t'),
            description: t('profOnboard.cinematographer.s4f1d'),
          },
          {
            icon: <TaskIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.cinematographer.s4f2t'),
            description: t('profOnboard.cinematographer.s4f2d'),
          },
          {
            icon: <GroupsIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.cinematographer.s4f3t'),
            description: t('profOnboard.cinematographer.s4f3d'),
          },
        ],
      },
    ],
  },
  producer: {
    welcomeTitle: t('profOnboard.producer.wTitle'),
    welcomeSubtitle: t('profOnboard.producer.wSub'),
    professionIcon: <TaskIcon sx={{ fontSize: 48 }} />,
    professionColor: '#8b5cf6',
    slides: [
      {
        title: t('profOnboard.whatIsTitle'),
        subtitle: t('profOnboard.producer.s1sub'),
        content: t('profOnboard.producer.s1c'),
        illustration: (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 2, 
            flexWrap: 'wrap',
            py: 2 
          }}>
            {['Storyboard', 'Media', t('profOnboard.producer.illo.timeline'), t('profOnboard.producer.illo.delivery')].map((item, i) => (
              <Paper
                key={item}
                elevation={3}
                sx={{
                  p: 2,
                  bgcolor: 'rgba(139,92,246,0.1)',
                  border: '1px solid rgba(139,92,246,0.3)',
                  borderRadius: 2,
                  minWidth: 80,
                  textAlign: 'center',
                  animation: `fadeInUp 0.5s ease ${i * 0.1}s both`,
                  '@keyframes fadeInUp': {
                    from: { opacity: 0, transform: 'translateY(20px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                <Typography variant="body2" sx={{ color: 'var(--role-violet, #8b5cf6)', fontWeight: 600 }}>
                  {item}
                </Typography>
              </Paper>
            ))}
          </Box>
        ),
      },
      {
        title: t('profOnboard.producer.s2t'),
        subtitle: t('profOnboard.producer.s2sub'),
        content: t('profOnboard.producer.s2c'),
        features: [
          {
            icon: <TimelineIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.producer.s2f1t'),
            description: t('profOnboard.producer.s2f1d'),
          },
          {
            icon: <GroupsIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.producer.s2f2t'),
            description: t('profOnboard.producer.s2f2d'),
          },
          {
            icon: <TaskIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.producer.s2f3t'),
            description: t('profOnboard.producer.s2f3d'),
          },
        ],
      },
      {
        title: t('profOnboard.howToFind'),
        subtitle: t('profOnboard.producer.s3sub'),
        content: t('profOnboard.producer.s3c'),
        features: [
          {
            icon: <SearchIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.producer.s3f1t'),
            description: t('profOnboard.producer.s3f1d'),
          },
          {
            icon: <TaskIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.producer.s3f2t'),
            description: t('profOnboard.producer.s3f2d'),
          },
          {
            icon: <GroupsIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.producer.s3f3t'),
            description: t('profOnboard.producer.s3f3d'),
          },
        ],
      },
      {
        title: t('profOnboard.producer.s4t'),
        subtitle: t('profOnboard.producer.s4sub'),
        content: t('profOnboard.producer.s4c'),
        features: [
          {
            icon: <ShareIcon sx={{ color: '#10b981' }} />,
            title: t('profOnboard.producer.s4f1t'),
            description: t('profOnboard.producer.s4f1d'),
          },
          {
            icon: <TaskIcon sx={{ color: '#10b981' }} />,
            title: t('profOnboard.producer.s4f2t'),
            description: t('profOnboard.producer.s4f2d'),
          },
          {
            icon: <CheckIcon sx={{ color: '#10b981' }} />,
            title: t('profOnboard.producer.s4f3t'),
            description: t('profOnboard.producer.s4f3d'),
          },
        ],
      },
    ],
  },
  art_director: {
    welcomeTitle: t('profOnboard.art_director.wTitle'),
    welcomeSubtitle: t('profOnboard.art_director.wSub'),
    professionIcon: <ArtIcon sx={{ fontSize: 48 }} />,
    professionColor: '#ec4899',
    slides: [
      {
        title: t('profOnboard.whatIsTitle'),
        subtitle: t('profOnboard.art_director.s1sub'),
        content: t('profOnboard.art_director.s1c'),
        features: [
          {
            icon: <ArtIcon sx={{ color: '#ec4899' }} />,
            title: 'Mood boards',
            description: t('profOnboard.art_director.s1f1d'),
          },
          {
            icon: <CameraIcon sx={{ color: '#ec4899' }} />,
            title: t('profOnboard.art_director.s1f2t'),
            description: t('profOnboard.art_director.s1f2d'),
          },
          {
            icon: <GroupsIcon sx={{ color: '#ec4899' }} />,
            title: t('profOnboard.art_director.s1f3t'),
            description: t('profOnboard.art_director.s1f3d'),
          },
        ],
      },
      {
        title: t('profOnboard.howToFind'),
        content: t('profOnboard.art_director.s2c'),
        features: [
          {
            icon: <SearchIcon sx={{ color: '#ec4899' }} />,
            title: t('profOnboard.art_director.s2f1t'),
            description: t('profOnboard.art_director.s2f1d'),
          },
          {
            icon: <TaskIcon sx={{ color: '#ec4899' }} />,
            title: t('profOnboard.art_director.s2f2t'),
            description: t('profOnboard.art_director.s2f2d'),
          },
        ],
      },
      {
        title: t('profOnboard.art_director.s3t'),
        content: t('profOnboard.art_director.s3c'),
        features: [
          {
            icon: <ShareIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.art_director.s3f1t'),
            description: t('profOnboard.art_director.s3f1d'),
          },
          {
            icon: <TaskIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.checklists'),
            description: t('profOnboard.art_director.s3f2d'),
          },
        ],
      },
    ],
  },
  music_video: {
    welcomeTitle: t('profOnboard.music_video.wTitle'),
    welcomeSubtitle: t('profOnboard.music_video.wSub'),
    professionIcon: <MusicIcon sx={{ fontSize: 48 }} />,
    professionColor: '#06b6d4',
    slides: [
      {
        title: t('profOnboard.whatIsTitle'),
        subtitle: t('profOnboard.music_video.s1sub'),
        content: t('profOnboard.music_video.s1c'),
        features: [
          {
            icon: <MusicIcon sx={{ color: '#06b6d4' }} />,
            title: t('profOnboard.music_video.s1f1t'),
            description: t('profOnboard.music_video.s1f1d'),
          },
          {
            icon: <VideocamIcon sx={{ color: '#06b6d4' }} />,
            title: t('profOnboard.music_video.s1f2t'),
            description: t('profOnboard.music_video.s1f2d'),
          },
          {
            icon: <GroupsIcon sx={{ color: '#06b6d4' }} />,
            title: t('profOnboard.music_video.s1f3t'),
            description: t('profOnboard.music_video.s1f3d'),
          },
        ],
      },
      {
        title: t('profOnboard.music_video.s2t'),
        content: t('profOnboard.music_video.s2c'),
        features: [
          {
            icon: <TimelineIcon sx={{ color: '#06b6d4' }} />,
            title: 'Storyboard',
            description: t('profOnboard.music_video.s2f1d'),
          },
          {
            icon: <TaskIcon sx={{ color: '#06b6d4' }} />,
            title: t('profOnboard.music_video.s2f2t'),
            description: t('profOnboard.music_video.s2f2d'),
          },
        ],
      },
      {
        title: t('profOnboard.music_video.s3t'),
        content: t('profOnboard.music_video.s3c'),
        features: [
          {
            icon: <ShareIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.music_video.s3f1t'),
            description: t('profOnboard.music_video.s3f1d'),
          },
          {
            icon: <GroupsIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.music_video.s3f2t'),
            description: t('profOnboard.music_video.s3f2d'),
          },
        ],
      },
    ],
  },
  commercial: {
    welcomeTitle: t('profOnboard.commercial.wTitle'),
    welcomeSubtitle: t('profOnboard.commercial.wSub'),
    professionIcon: <PlayIcon sx={{ fontSize: 48 }} />,
    professionColor: '#f97316',
    slides: [
      {
        title: t('profOnboard.whatIsTitle'),
        subtitle: t('profOnboard.commercial.s1sub'),
        content: t('profOnboard.commercial.s1c'),
        features: [
          {
            icon: <PlayIcon sx={{ color: '#f97316' }} />,
            title: t('profOnboard.commercial.s1f1t'),
            description: t('profOnboard.commercial.s1f1d'),
          },
          {
            icon: <GroupsIcon sx={{ color: '#f97316' }} />,
            title: 'Casting',
            description: t('profOnboard.commercial.s1f2d'),
          },
          {
            icon: <TaskIcon sx={{ color: '#f97316' }} />,
            title: t('profOnboard.commercial.s1f3t'),
            description: t('profOnboard.commercial.s1f3d'),
          },
        ],
      },
      {
        title: t('profOnboard.commercial.s2t'),
        content: t('profOnboard.commercial.s2c'),
        features: [
          {
            icon: <TimelineIcon sx={{ color: '#f97316' }} />,
            title: t('profOnboard.commercial.s2f1t'),
            description: t('profOnboard.commercial.s2f1d'),
          },
          {
            icon: <CheckIcon sx={{ color: '#f97316' }} />,
            title: t('profOnboard.checklists'),
            description: t('profOnboard.commercial.s2f2d'),
          },
        ],
      },
      {
        title: t('profOnboard.commercial.s3t'),
        content: t('profOnboard.commercial.s3c'),
        features: [
          {
            icon: <ShareIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.commercial.s3f1t'),
            description: t('profOnboard.commercial.s3f1d'),
          },
          {
            icon: <GroupsIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.commercial.s3f2t'),
            description: t('profOnboard.commercial.s3f2d'),
          },
        ],
      },
    ],
  },
  documentary: {
    welcomeTitle: t('profOnboard.documentary.wTitle'),
    welcomeSubtitle: t('profOnboard.documentary.wSub'),
    professionIcon: <MovieIcon sx={{ fontSize: 48 }} />,
    professionColor: '#84cc16',
    slides: [
      {
        title: t('profOnboard.whatIsTitle'),
        subtitle: t('profOnboard.documentary.s1sub'),
        content: t('profOnboard.documentary.s1c'),
        features: [
          {
            icon: <MovieIcon sx={{ color: '#84cc16' }} />,
            title: t('profOnboard.documentary.s1f1t'),
            description: t('profOnboard.documentary.s1f1d'),
          },
          {
            icon: <GroupsIcon sx={{ color: '#84cc16' }} />,
            title: t('profOnboard.documentary.s1f2t'),
            description: t('profOnboard.documentary.s1f2d'),
          },
          {
            icon: <TimelineIcon sx={{ color: '#84cc16' }} />,
            title: t('profOnboard.documentary.s1f3t'),
            description: t('profOnboard.documentary.s1f3d'),
          },
        ],
      },
      {
        title: t('profOnboard.documentary.s2t'),
        content: t('profOnboard.documentary.s2c'),
        features: [
          {
            icon: <TaskIcon sx={{ color: '#84cc16' }} />,
            title: t('profOnboard.documentary.s2f1t'),
            description: t('profOnboard.documentary.s2f1d'),
          },
          {
            icon: <SearchIcon sx={{ color: '#84cc16' }} />,
            title: t('profOnboard.documentary.s2f2t'),
            description: t('profOnboard.documentary.s2f2d'),
          },
        ],
      },
      {
        title: t('profOnboard.documentary.s3t'),
        content: t('profOnboard.documentary.s3c'),
        features: [
          {
            icon: <ShareIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.documentary.s3f1t'),
            description: t('profOnboard.documentary.s3f1d'),
          },
          {
            icon: <GroupsIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.documentary.s3f2t'),
            description: t('profOnboard.documentary.s3f2d'),
          },
        ],
      },
    ],
  },
  general: {
    welcomeTitle: t('profOnboard.general.wTitle'),
    welcomeSubtitle: t('profOnboard.general.wSub'),
    professionIcon: <MovieIcon sx={{ fontSize: 48 }} />,
    professionColor: '#6366f1',
    slides: [
      {
        title: t('profOnboard.whatIsTitle'),
        subtitle: t('profOnboard.general.s1sub'),
        content: t('profOnboard.general.s1c'),
        illustration: (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 2, 
            flexWrap: 'wrap',
            py: 2 
          }}>
            {['Casting', 'Shot List', 'Storyboard', 'Team'].map((item, i) => (
              <Paper
                key={item}
                elevation={3}
                sx={{
                  p: 2,
                  bgcolor: 'rgba(99,102,241,0.1)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: 2,
                  minWidth: 80,
                  textAlign: 'center',
                  animation: `fadeInUp 0.5s ease ${i * 0.1}s both`,
                  '@keyframes fadeInUp': {
                    from: { opacity: 0, transform: 'translateY(20px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                <Typography variant="body2" sx={{ color: '#6366f1', fontWeight: 600 }}>
                  {item}
                </Typography>
              </Paper>
            ))}
          </Box>
        ),
      },
      {
        title: t('profOnboard.general.s2t'),
        subtitle: t('profOnboard.general.s2sub'),
        content: t('profOnboard.general.s2c'),
        features: [
          {
            icon: <GroupsIcon sx={{ color: '#6366f1' }} />,
            title: 'Casting',
            description: t('profOnboard.general.s2f1d'),
          },
          {
            icon: <VideocamIcon sx={{ color: '#6366f1' }} />,
            title: 'Shot List',
            description: t('profOnboard.general.s2f2d'),
          },
          {
            icon: <TimelineIcon sx={{ color: '#6366f1' }} />,
            title: 'AI Storyboard',
            description: t('profOnboard.general.s2f3d'),
          },
        ],
      },
      {
        title: t('profOnboard.howToFind'),
        subtitle: t('profOnboard.general.s3sub'),
        content: t('profOnboard.general.s3c'),
        features: [
          {
            icon: <SearchIcon sx={{ color: '#6366f1' }} />,
            title: t('profOnboard.general.s3f1t'),
            description: t('profOnboard.general.s3f1d'),
          },
          {
            icon: <TaskIcon sx={{ color: '#6366f1' }} />,
            title: t('profOnboard.general.s3f2t'),
            description: t('profOnboard.general.s3f2d'),
          },
          {
            icon: <MovieIcon sx={{ color: '#6366f1' }} />,
            title: t('profOnboard.general.s3f3t'),
            description: t('profOnboard.general.s3f3d'),
          },
        ],
        tips: [
          t('profOnboard.tipCtrlF'),
          t('profOnboard.general.s3tip2'),
          t('profOnboard.general.s3tip3'),
        ],
      },
      {
        title: t('profOnboard.general.s4t'),
        subtitle: t('profOnboard.general.s4sub'),
        content: t('profOnboard.general.s4c'),
        features: [
          {
            icon: <ShareIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.shareProject'),
            description: t('profOnboard.general.s4f1d'),
          },
          {
            icon: <TaskIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: t('profOnboard.general.s4f2t'),
            description: t('profOnboard.general.s4f2d'),
          },
          {
            icon: <GroupsIcon sx={{ color: 'var(--role-violet, #8b5cf6)' }} />,
            title: 'Kanban',
            description: t('profOnboard.general.s4f3d'),
          },
        ],
      },
    ],
  },
});

interface ProfessionOnboardingDialogProps {
  open: boolean;
  onClose: () => void;
  profession: ProfessionType;
  userName?: string;
}

const ONBOARDING_NAMESPACE = 'roleRoom_onboardingCompleted';
const LEGACY_ONBOARDING_NAMESPACE = 'virtualStudio_onboardingCompleted';

export function ProfessionOnboardingDialog({
  open,
  onClose,
  profession,
  userName,
}: ProfessionOnboardingDialogProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');
  
  const { t } = useT();
  const professionContent = useMemo(() => buildProfessionContent(t), [t]);
  const content = professionContent[profession] || professionContent.general;
  const slides = content.slides;
  const totalSlides = slides.length;
  const progress = ((currentSlide + 1) / totalSlides) * 100;

  useEffect(() => {
    if (open) {
      setCurrentSlide(0);
    }
  }, [open]);

  const handleNext = () => {
    if (currentSlide < totalSlides - 1) {
      setSlideDirection('left');
      setCurrentSlide(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentSlide > 0) {
      setSlideDirection('right');
      setCurrentSlide(prev => prev - 1);
    }
  };

  const markCompleted = async () => {
    const cached =
      (await settingsService.getSetting<Record<string, boolean>>(ONBOARDING_NAMESPACE))
      || (await settingsService.getSetting<Record<string, boolean>>(LEGACY_ONBOARDING_NAMESPACE))
      || {};
    const updated = { ...cached, [profession]: true };
    await settingsService.setSetting(ONBOARDING_NAMESPACE, updated);
    await settingsService.deleteSetting(LEGACY_ONBOARDING_NAMESPACE);
  };

  const handleComplete = () => {
    void markCompleted();
    onClose();
  };

  const handleSkip = () => {
    void markCompleted();
    onClose();
  };

  const currentSlideData = slides[currentSlide];

  return (
    <Dialog
      open={open}
      onClose={handleSkip}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1a1a2e',
          backgroundImage: `radial-gradient(circle at top right, ${content.professionColor}15 0%, transparent 50%)`,
          border: `1px solid ${content.professionColor}40`,
          borderRadius: 3,
          overflow: 'hidden',
          maxHeight: '90vh',
        },
      }}
    >
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 4,
          bgcolor: 'rgba(255,255,255,0.1)',
          '& .MuiLinearProgress-bar': {
            bgcolor: content.professionColor,
          },
        }}
      />

      <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
        <IconButton
          onClick={handleSkip}
          size="small"
          aria-label={t('profOnboard.aria.close')}
          sx={{ color: 'rgba(255,255,255,0.87)', '&:hover': { color: 'white' } }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
        {currentSlide === 0 && (
          <Fade in timeout={500}>
            <Box
              sx={{
                textAlign: 'center',
                py: 4,
                px: 3,
                borderBottom: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: `${content.professionColor}20`,
                  color: content.professionColor,
                  mx: 'auto',
                  mb: 2,
                  border: `2px solid ${content.professionColor}`,
                }}
              >
                {content.professionIcon}
              </Avatar>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  color: 'white',
                  mb: 1,
                }}
              >
                {userName ? `${content.welcomeTitle.replace('!', `, ${userName}!`)}` : content.welcomeTitle}
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{ color: 'rgba(255,255,255,0.87)' }}
              >
                {content.welcomeSubtitle}
              </Typography>
            </Box>
          </Fade>
        )}

        <Box sx={{ p: 4, minHeight: 400 }}>
          <Slide direction={slideDirection} in key={currentSlide} timeout={300}>
            <Box>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: 'white',
                  mb: 1,
                }}
              >
                {currentSlideData.title}
              </Typography>

              {currentSlideData.subtitle && (
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: content.professionColor,
                    mb: 2,
                    fontWeight: 600,
                  }}
                >
                  {currentSlideData.subtitle}
                </Typography>
              )}

              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.8)',
                  mb: 3,
                  lineHeight: 1.7,
                }}
              >
                {currentSlideData.content}
              </Typography>

              {currentSlideData.illustration && (
                <Box sx={{ mb: 3 }}>
                  {currentSlideData.illustration}
                </Box>
              )}

              {currentSlideData.features && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                  {currentSlideData.features.map((feature, index) => (
                    <Fade in timeout={500} style={{ transitionDelay: `${index * 100}ms` }} key={feature.title}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          bgcolor: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 2,
                          transition: 'all 0.2s',
                          '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.08)',
                            borderColor: `${content.professionColor}40`,
                          },
                        }}
                      >
                        <Box
                          sx={{
                            p: 1,
                            bgcolor: `${content.professionColor}15`,
                            borderRadius: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {feature.icon}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600, color: 'white', mb: 0.5 }}
                          >
                            {feature.title}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: 'rgba(255,255,255,0.87)' }}
                          >
                            {feature.description}
                          </Typography>
                        </Box>
                      </Paper>
                    </Fade>
                  ))}
                </Box>
              )}

              {currentSlideData.tips && currentSlideData.tips.length > 0 && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: `${content.professionColor}10`,
                    border: `1px solid ${content.professionColor}30`,
                    borderRadius: 2,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <TipIcon sx={{ color: content.professionColor, fontSize: 20 }} />
                    <Typography
                      variant="subtitle2"
                      sx={{ color: content.professionColor, fontWeight: 600 }}
                    >
                      Tips
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {currentSlideData.tips.map((tip, index) => (
                      <Chip
                        key={index}
                        label={tip}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.1)',
                          color: 'rgba(255,255,255,0.9)',
                          '& .MuiChip-label': { px: 1.5 },
                        }}
                      />
                    ))}
                  </Box>
                </Paper>
              )}
            </Box>
          </Slide>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 3,
            borderTop: '1px solid rgba(255,255,255,0.1)',
            bgcolor: 'rgba(0,0,0,0.2)',
          }}
        >
          <Box sx={{ display: 'flex', gap: 1 }}>
            {slides.map((_, index) => (
              <Box
                key={index}
                onClick={() => {
                  setSlideDirection(index > currentSlide ? 'left' : 'right');
                  setCurrentSlide(index);
                }}
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: index === currentSlide ? content.professionColor : 'rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: index === currentSlide ? content.professionColor : 'rgba(255,255,255,0.5)',
                    transform: 'scale(1.2)',
                  },
                }}
              />
            ))}
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            {currentSlide > 0 && (
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={handlePrevious}
                sx={{
                  borderColor: 'rgba(255,255,255,0.3)',
                  color: 'white',
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.5)',
                    bgcolor: 'rgba(255,255,255,0.05)',
                  },
                }}
              >{t('profOnboard.back')}</Button>
            )}

            <Button
              variant="contained"
              endIcon={currentSlide === totalSlides - 1 ? <CheckIcon /> : <ArrowForwardIcon />}
              onClick={handleNext}
              sx={{
                bgcolor: content.professionColor,
                '&:hover': {
                  bgcolor: content.professionColor,
                  filter: 'brightness(1.1)',
                },
              }}
            >
              {currentSlide === totalSlides - 1 ? t('profOnboard.getStarted') : t('profOnboard.next')}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export function useProfessionOnboarding(profession: ProfessionType | null) {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (profession) {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const checkStatus = async () => {
        const cached =
          (await settingsService.getSetting<Record<string, boolean>>(ONBOARDING_NAMESPACE))
          || (await settingsService.getSetting<Record<string, boolean>>(LEGACY_ONBOARDING_NAMESPACE));
        if (cached && !(await settingsService.getSetting<Record<string, boolean>>(ONBOARDING_NAMESPACE))) {
          await settingsService.setSetting(ONBOARDING_NAMESPACE, cached);
          await settingsService.deleteSetting(LEGACY_ONBOARDING_NAMESPACE);
        }
        if (cached?.[profession]) return;

        timer = setTimeout(() => {
          setShowOnboarding(true);
        }, 500);
      };
      void checkStatus();
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
    return undefined;
  }, [profession]);

  const triggerOnboarding = () => {
    setShowOnboarding(true);
  };

  const closeOnboarding = () => {
    setShowOnboarding(false);
  };

  const resetOnboarding = (prof?: ProfessionType) => {
    const target = prof || profession;
    if (!target) return;
    const reset = async () => {
      const cached =
        (await settingsService.getSetting<Record<string, boolean>>(ONBOARDING_NAMESPACE))
        || (await settingsService.getSetting<Record<string, boolean>>(LEGACY_ONBOARDING_NAMESPACE))
        || {};
      if (cached[target]) {
        const updated = { ...cached };
        delete updated[target];
        await settingsService.setSetting(ONBOARDING_NAMESPACE, updated);
        await settingsService.deleteSetting(LEGACY_ONBOARDING_NAMESPACE);
      }
    };
    void reset();
  };

  return {
    showOnboarding,
    triggerOnboarding,
    closeOnboarding,
    resetOnboarding,
  };
}
