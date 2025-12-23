import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Box, Typography } from '@mui/material';
import { apiRequest } from '@/lib/queryClient';

interface MemoryCardIconProps {
  letter: string;
  type: 'CF' | 'SD' | 'microSD' | 'XQD';
  capacity: string;
  isSelected?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const getCardDimensions = (size: string) => {
  switch (size) {
    case 'small': return { width: 40, height: 30,};
    case 'large': return { width:  80, height: 60,};
    default: return { width: 60, height: 45 };
}
};

const getCardColor = (type: string) => {
  switch (type) {
    case 'CF': return '#1976d2'; // Blå for CompactFlash
    case 'SD': return '#f57c00'; // Oransje for SD
    case 'microSD': return '#388e3c'; // Grønn for microSD
    case 'XQD': return '#7b1fa2'; // Lilla for XQD
    default: return '#424242';
}
};

export function MemoryCardIcon({ letter, type, capacity, isSelected = false, size = 'medium' }: MemoryCardIconProps) {
  const dimensions = getCardDimensions(size);
  const cardColor = getCardColor(type);
  
  return (
    <Box
      sx={{
        width: dimensions.width,
        height: dimensions.height,
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        transform: isSelected ? 'scale(1.1)' : 'scale(1)','&:hover': {
          transform: 'scale(1.05)',
      }
    }}
    >
      {/* Hovedkort */}
      <Box
        sx={{
          width: '100%',
          height: '100%',
          backgroundColor: cardColor,
          borderRadius: '4px',
          border: isSelected ? '3px solid #fff' : '2px solid rgba(0,0,0,0.2)',
          boxShadow: isSelected 
            ? '0 8px 20px rgba(0,0,0,0.3), 0 0 0 2px #2196f3'
            : '0 4px 8px rgba(0,0,0,0.2)',
          background: `linear-gradient(135deg, ${cardColor} 0%, ${cardColor}dd 50%, ${cardColor}aa 100%)`,
          position: 'relative',
          overflow: 'hidden'}}
      >
        {/* Gull kontakter (øverst) */}
        <Box
          sx={{
            position: 'absolute',
            top: '8%',
            left: '10%',
            right: '10%',
            height: '15%',
            background: 'linear-gradient(90deg, #ffd700 0%, #ffed4e 50%, #ffd700 100%)',
            borderRadius: '2px',
            display: 'flex',
            gap: '2px',
            alignItems: 'center',
            justifyContent: 'space-around','&::before, &::after': {
              content: '""',
              width: '8%',
              height: '60%',
              backgroundColor: 'rgba(0,0,0,0.1)',
              borderRadius: '1px',
          }
        }}
        >
          {/* Kontakt-linjer */}
          {[...Array(size === 'small' ? 3 : 5)].map((_, i) => (
            <Box
              key={i}
              sx={{
                width: '1px',
                height: '80%',
                backgroundColor: 'rgba(0,0,0,0.15)'}}
            />
          ))}
        </Box>

        {/* Hovedlabel med bokstav */}
        <Box
          sx={{
            position: 'absolute',
            top: '30%',
            left: '10%',
            right: '10%',
            textAlign: 'center'}}
        >
          <Typography
            variant={size === 'small' ? 'h6' : size === 'large' ? 'h3' : 'h4'}
            sx={{
              color: '#fff',
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
              fontFamily: 'monospace'}}
          >
            {letter}
          </Typography>
        </Box>

        {/* Type og kapasitet */}
        <Box
          sx={{
            position: 'absolute',
            bottom: '8%',
            left: '8%',
            right: '8%',
            textAlign: 'center'}}
        >
          <Typography
            variant={size === 'small' ? 'caption' : 'body2'}
            sx={{
              color: 'rgba(255,255,255,0.9)',
              fontSize: size === 'small' ? '8px' : size === 'large' ? '12px' : '10px',
              fontWeight: 'bold',
              textShadow: '1px 1px 2px rgba(0,0,0,0.5)'}}
          >
            {type}
          </Typography>
          <Typography
            variant={size === 'small' ? 'caption' : 'body2'}
            sx={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: size === 'small' ? '7px' : size === 'large' ? '10px' : '8px',
              textShadow: '1px 1px 2px rgba(0,0,0,0.5)'}}
          >
            {capacity}
          </Typography>
        </Box>

        {/* Hjørne-cut (realistisk minnekort-look) */}
        <Box
          sx={{
            position: 'absolute',
            top:  0,
            right:  0,
            width: '20%',
            height: '20%',
            background: 'linear-gradient(-45deg, transparent 30%, rgba(0,0,0,0.1) 70%)',
            clipPath: 'polygon(50% 0%, 100% 50%, 100% 100%, 0% 100%)'}}
        />

        {/* Skinnende effekt */}
        <Box
          sx={{
            position: 'absolute',
            top:  0,
            left:  0,
            right:  0,
            bottom:  0,
            background: 'linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.1) 40%, transparent 60%)',
            pointerEvents: 'none'}}
        />
      </Box>

      {/* Selected indicator */}
      {isSelected && (
        <Box
          sx={{
            position: 'absolute',
            top:  -2,
            right:  -2,
            width:  16,
            height:  16,
            backgroundColor: '#4caf50',
            borderRadius: '50%',
            border: '2px solid #fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10}}
        >
          <Typography sx={{ color: '#fff', fontSize: '10px', fontWeight: 'bold'}}>
            ✓
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default MemoryCardIcon;