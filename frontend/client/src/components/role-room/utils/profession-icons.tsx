import React from 'react';
import {
  CameraAlt,
  Videocam,
  Lightbulb,
  TheaterComedy,
  ContentCut,
  Person,
  Work,
} from '@mui/icons-material';

const iconMap: Record<string, React.ReactNode> = {
  camera: <CameraAlt />,
  video: <Videocam />,
  light: <Lightbulb />,
  director: <TheaterComedy />,
  edit: <ContentCut />,
  person: <Person />,
  default: <Work />,
};

export const getProfessionIcon = (iconName: string): React.ReactNode => {
  return iconMap[iconName] || iconMap.default;
};

export const getProfessionIconComponent = (iconName: string) => {
  const icons: Record<string, React.FC> = {
    camera: CameraAlt,
    video: Videocam,
    light: Lightbulb,
    director: TheaterComedy,
    edit: ContentCut,
    person: Person,
    default: Work,
  };
  return icons[iconName] || icons.default;
};

export default getProfessionIcon;
