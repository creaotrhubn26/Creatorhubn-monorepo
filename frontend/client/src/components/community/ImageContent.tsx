/**
 * ImageContent Component
 * 
 * Handles image content display with gallery and zoom functionality
 */

import React, { useState } from 'react';
import {
  Box,
  Dialog,
  IconButton,
  Typography,
} from '@mui/material';
import { ZoomIn, Close } from '@mui/icons-material';

interface ImageContentProps {
  images: string | string[];
  alt?: string;
  gallery?: boolean;
}

export const ImageContent: React.FC<ImageContentProps> = ({ 
  images, 
  alt = 'Onboarding content image',
  gallery = false 
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);

  const imageArray = Array.isArray(images) ? images : [images];

  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setZoomOpen(true);
  };

  const handleCloseZoom = () => {
    setZoomOpen(false);
    setSelectedImage(null);
  };

  if (imageArray.length === 0) {
    return null;
  }

  return (
    <>
      <Box sx={{ mt: 2 }}>
        {gallery && imageArray.length > 1 ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 2,
            }}
          >
            {imageArray.map((imageUrl, index) => (
              <Box
                key={index}
                sx={{
                  position: 'relative',
                  cursor: 'pointer',
                  borderRadius: 2,
                  overflow: 'hidden',
                  '&:hover .zoom-overlay': {
                    opacity: 1,
                  },
                }}
                onClick={() => handleImageClick(imageUrl)}
              >
                <Box
                  component="img"
                  src={imageUrl}
                  alt={`${alt} ${index + 1}`}
                  sx={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                  }}
                  loading="lazy"
                />
                <Box
                  className="zoom-overlay"
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    bgcolor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0,
                    transition: 'opacity 0.3s',
                  }}
                >
                  <ZoomIn sx={{ color: 'white', fontSize: 40 }} />
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <Box
            sx={{
              position: 'relative',
              cursor: 'pointer',
              borderRadius: 2,
              overflow: 'hidden',
              '&:hover .zoom-overlay': {
                opacity: 1,
              },
            }}
            onClick={() => handleImageClick(imageArray[0])}
          >
            <Box
              component="img"
              src={imageArray[0]}
              alt={alt}
              sx={{
                width: '100%',
                height: 'auto',
                display: 'block',
              }}
              loading="lazy"
            />
            <Box
              className="zoom-overlay"
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.3s',
              }}
            >
              <ZoomIn sx={{ color: 'white', fontSize: 40 }} />
            </Box>
          </Box>
        )}
      </Box>

      {/* Zoom Dialog */}
      <Dialog
        open={zoomOpen}
        onClose={handleCloseZoom}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'rgba(0, 0, 0, 0.9)',
            boxShadow: 'none',
          },
        }}
      >
        <Box sx={{ position: 'relative', p: 2 }}>
          <IconButton
            onClick={handleCloseZoom}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              color: 'white',
              zIndex: 1,
            }}
          >
            <Close />
          </IconButton>
          {selectedImage && (
            <Box
              component="img"
              src={selectedImage}
              alt={alt}
              sx={{
                width: '100%',
                height: 'auto',
                maxHeight: '90vh',
                objectFit: 'contain',
              }}
            />
          )}
        </Box>
      </Dialog>
    </>
  );
};

export default ImageContent;

