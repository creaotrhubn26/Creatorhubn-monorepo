/**
 * Template Icon Component
 * Renders MUI icon based on icon name string
 */

import React from 'react';
import {
  Movie as MovieIcon,
  Tv as TvIcon,
  VideoLibrary as VideoLibraryIcon,
  Campaign as CampaignIcon,
  MovieCreation as MovieCreationIcon,
  ChatBubble as ChatBubbleIcon,
  FlashOn as FlashOnIcon,
  Timer as TimerIcon,
  History as HistoryIcon,
  Phone as PhoneIcon,
  Person as PersonIcon,
  PersonOutline as PersonOutlineIcon,
  School as SchoolIcon,
  Rocket as RocketIcon,
  Architecture as ArchitectureIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';

interface TemplateIconProps {
  iconName?: string;
  sx?: any;
}

export const TemplateIcon: React.FC<TemplateIconProps> = ({ iconName, sx }) => {
  const iconMap: Record<string, React.ReactElement> = {
    'Movie': <MovieIcon sx={sx} />,
    'Tv': <TvIcon sx={sx} />,
    'VideoLibrary': <VideoLibraryIcon sx={sx} />,
    'Campaign': <CampaignIcon sx={sx} />,
    'MovieCreation': <MovieCreationIcon sx={sx} />,
    'ChatBubble': <ChatBubbleIcon sx={sx} />,
    'FlashOn': <FlashOnIcon sx={sx} />,
    'Timer': <TimerIcon sx={sx} />,
    'History': <HistoryIcon sx={sx} />,
    'Phone': <PhoneIcon sx={sx} />,
    'Person': <PersonIcon sx={sx} />,
    'PersonOutline': <PersonOutlineIcon sx={sx} />,
    'School': <SchoolIcon sx={sx} />,
    'Rocket': <RocketIcon sx={sx} />,
    'Architecture': <ArchitectureIcon sx={sx} />,
  };

  return iconMap[iconName || ''] || <DescriptionIcon sx={sx} />;
};
