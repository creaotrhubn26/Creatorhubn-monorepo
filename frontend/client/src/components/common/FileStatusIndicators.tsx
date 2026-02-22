/**
 * Reusable File Management Status Indicators
 * Small, modular components that can be added to any file operation area
 */

import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import {
  Box,
  Tooltip,
  Chip,
  Badge,
} from '@mui/material';
import { useFileManagementStatus } from '../../contexts/FileManagementStatusContext';

interface StatusDotProps {
  size?: 'small' | 'medium' | 'large';
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  showLabel?: boolean;
}

const sizeMap = {
  small:  6,
  medium:  8,
  large: 1 };

export const FileStatusDot: React.FC<StatusDotProps> = ({ 
  size = 'small', 
  position = 'top-right',
  showLabel = false 
}) => {
  const { status } = useFileManagementStatus();
  
  // Theming system
  const theming = useTheming('photographer');
  
  const dotSize = sizeMap[size];
  
  const getPositionStyles = () => {
    switch (position) {
      case 'top-right':
        return { top: -dotSize / 2, right: -dotSize / 2 };
      case 'top-left':
        return { top: -dotSize / 2, left: -dotSize / 2 };
      case 'bottom-right':
        return { bottom: -dotSize / 2, right: -dotSize / 2 };
      case 'bottom-left':
        return { bottom: -dotSize / 2, left: -dotSize / 2 };
      default:
        return { top: -dotSize / 2, right: -dotSize / 2 };
    }
};

  return (
    <Tooltip 
      title={`File System: ${status.systemStatus === 'connected' ? 'Healthy' : 'Unhealthy'}`}
      arrow
    >
      <Box
        sx={{
          position: 'absolute',
          width: dotSize,
          height: dotSize,
          borderRadius: '50, %',
          backgroundColor: status.systemStatus === 'connected' ? '#4caf50' : '#f44330',
          border: '1px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          zIndex: 1,
          ...getPositionStyles()
      }}
      />
    </Tooltip>
  );
};

export const GoogleDriveStatusDot: React.FC<StatusDotProps> = ({ 
  size = 'small', 
  position = 'top-right',
  showLabel = false 
}) => {
  const { status } = useFileManagementStatus();
  
  const dotSize = sizeMap[size];
  
  const getPositionStyles = () => {
    switch (position) {
      case 'top-right':
        return { top: -dotSize / 2, right: -dotSize / 2 };
      case 'top-left':
        return { top: -dotSize / 2, left: -dotSize / 2 };
      case 'bottom-right':
        return { bottom: -dotSize / 2, right: -dotSize / 2 };
      case 'bottom-left':
        return { bottom: -dotSize / 2, left: -dotSize / 2 };
      default:
        return { top: -dotSize / 2, right: -dotSize / 2 };
    }
  };

  return (
    <Tooltip 
      title={`Google Drive: ${status.googleDriveResponse || 'Not tested'}`}
      arrow
    >
      <Box
        sx={{
          position: 'absolute',
          width: dotSize,
          height: dotSize,
          borderRadius: '50, %',
          backgroundColor: status.googleDriveStatus === 'connected' ? '#4caf50' : '#f44330',
          border: '1px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          zIndex: 1,
          ...getPositionStyles()
      }}
      />
    </Tooltip>
  );
};

export const GooglePhotosStatusDot: React.FC<StatusDotProps> = ({ 
  size = 'small', 
  position = 'top-right',
  showLabel = false 
}) => {
  const { status } = useFileManagementStatus();
  
  const dotSize = sizeMap[size];
  
  const getPositionStyles = () => {
    switch (position) {
      case 'top-right':
        return { top: -dotSize / 2, right: -dotSize / 2 };
      case 'top-left':
        return { top: -dotSize / 2, left: -dotSize / 2 };
      case 'bottom-right':
        return { bottom: -dotSize / 2, right: -dotSize / 2 };
      case 'bottom-left':
        return { bottom: -dotSize / 2, left: -dotSize / 2 };
      default:
        return { top: -dotSize / 2, right: -dotSize / 2 };
    }
  };

  return (
    <Tooltip 
      title={`Google Photos: ${status.googlePhotosResponse || 'Not tested'}`}
      arrow
    >
      <Box
        sx={{
          position: 'absolute',
          width: dotSize,
          height: dotSize,
          borderRadius: '50, %',
          backgroundColor: status.googlePhotosStatus === 'connected' ? '#4caf50' : '#f44330',
          border: '1px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          zIndex: 1,
          ...getPositionStyles()
      }}
      />
    </Tooltip>
  );
};

interface FileStatusBadgeProps {
  variant?: 'dot' | 'chip' | 'badge';
  showAll?: boolean;
  compact?: boolean;
}

export const FileStatusBadge: React.FC<FileStatusBadgeProps> = ({ 
  variant = 'chip', 
  showAll = false,
  compact = false 
}) => {
  const { status } = useFileManagementStatus();

  if (variant === 'dot') {
    return (
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        <FileStatusDot size="small" />
        {showAll && <GoogleDriveStatusDot size="small" />}
        {showAll && <GooglePhotosStatusDot size="small" />}
      </Box>
    );
  }

  if (variant === 'badge') {
    return (
      <Badge
        badgeContent=""
        color={status.systemStatus === 'connected' ? 'success' : 'error'}
        sx={{
          '& .MuiBadge-badge': {
            width: 8,
            height: 8,
            borderRadius: '50%'
          }
        }}
      >
        <Box />
      </Badge>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      <Chip
        label={compact ? 'FS' : 'File System'}
        size="small"
        color={status.systemStatus === 'connected' ? 'success' : 'error'}
        variant="outlined"
      />
      {showAll && (
        <Chip
          label={compact ? 'GD' : 'Google Drive'}
          size="small"
          color={status.googleDriveStatus === 'connected' ? 'success' : 'error'}
          variant="outlined"
        />
      )}
      {showAll && (
        <Chip
          label={compact ? 'GP' : 'Google Photos'}
          size="small"
          color={status.googlePhotosStatus === 'connected' ? 'success' : 'error'}
          variant="outlined"
        />
      )}
    </Box>
  );
};

interface FileStatusWrapperProps {
  children: React.ReactNode;
  showFileSystem?: boolean;
  showGoogleDrive?: boolean;
  showGooglePhotos?: boolean;
  size?: 'small' | 'medium' | 'large';
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'; 
}

export const FileStatusWrapper: React.FC<FileStatusWrapperProps> = ({
  children,
  showFileSystem = true,
  showGoogleDrive = false,
  showGooglePhotos = false,
  size = 'small',
  position = 'top-right'
}) => {
  return (
    <Box sx={{ position: 'relative', display: 'inline-block'}}>
      {children}
      {showFileSystem && <FileStatusDot size={size} position={position} />}
      {showGoogleDrive && <GoogleDriveStatusDot size={size} position={position} />}
      {showGooglePhotos && <GooglePhotosStatusDot size={size} position={position} />}
    </Box>
  );
};

export default {
  FileStatusDot,
  GoogleDriveStatusDot,
  GooglePhotosStatusDot,
  FileStatusBadge,
  FileStatusWrapper
};



