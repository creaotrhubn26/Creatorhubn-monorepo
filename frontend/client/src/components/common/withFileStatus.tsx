/**
 * Higher-order component to overlay file status indicators.
 */

import React from 'react';
import { FileStatusWrapper } from './FileStatusIndicators';

interface WithFileStatusOptions {
  showFileSystem?: boolean;
  showGoogleDrive?: boolean;
  showGooglePhotos?: boolean;
  size?: 'small' | 'medium' | 'large';
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  onlyOnHover?: boolean;
}

export function withFileStatus<P extends object>(
  Component: React.ComponentType<P>,
  options: WithFileStatusOptions = {},
) {
  const {
    showFileSystem = true,
    showGoogleDrive = false,
    showGooglePhotos = false,
    size = 'small',
    position = 'top-right',
    onlyOnHover = false,
  } = options;

  const Wrapped = (props: P) => {
    const [showIndicators, setShowIndicators] = React.useState(!onlyOnHover);

    const handleMouseEnter = () => {
      if (onlyOnHover) {
        setShowIndicators(true);
      }
    };

    const handleMouseLeave = () => {
      if (onlyOnHover) {
        setShowIndicators(false);
      }
    };

    return (
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ position: 'relative', display: 'inline-block' }}
      >
        {showIndicators ? (
          <FileStatusWrapper
            showFileSystem={showFileSystem}
            showGoogleDrive={showGoogleDrive}
            showGooglePhotos={showGooglePhotos}
            size={size}
            position={position}
          >
            <Component {...props} />
          </FileStatusWrapper>
        ) : (
          <Component {...props} />
        )}
      </div>
    );
  };

  Wrapped.displayName = `withFileStatus(${Component.displayName ?? Component.name ?? 'Component'})`;

  return Wrapped;
}

export const withUploadStatus = <P extends object>(Component: React.ComponentType<P>) =>
  withFileStatus(Component, {
    showFileSystem: true,
    showGoogleDrive: true,
    showGooglePhotos: false,
    size: 'small',
    position: 'top-right',
  });

export const withDownloadStatus = <P extends object>(Component: React.ComponentType<P>) =>
  withFileStatus(Component, {
    showFileSystem: true,
    showGoogleDrive: false,
    showGooglePhotos: false,
    size: 'small',
    position: 'top-right',
  });

export const withFullFileStatus = <P extends object>(Component: React.ComponentType<P>) =>
  withFileStatus(Component, {
    showFileSystem: true,
    showGoogleDrive: true,
    showGooglePhotos: true,
    size: 'medium',
    position: 'top-right',
  });

export const withHoverFileStatus = <P extends object>(Component: React.ComponentType<P>) =>
  withFileStatus(Component, {
    showFileSystem: true,
    showGoogleDrive: true,
    showGooglePhotos: true,
    size: 'small',
    position: 'top-right',
    onlyOnHover: true,
  });
