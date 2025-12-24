import React from 'react';

export const DAVINCI_COLORS = {
  primary: '#FF4D4D',
  secondary: '#333333',
  accent: '#00A0E3',
  background: '#1A1A1A',
  text: '#FFFFFF'
};

export const DaVinciResolveFullLogo: React.FC<{ width?: number; height?: number }> = ({ 
  width = 200, 
  height = 50 
}) => (
  <div style={{ 
    width, 
    height, 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    color: DAVINCI_COLORS.primary,
    fontWeight: 'bold',
    fontSize: '1.2rem'
  }}>
    DaVinci Resolve
  </div>
);

export const PoweredByDaVinci: React.FC = () => (
  <div style={{ 
    display: 'flex', 
    alignItems: 'center', 
    gap: '0.5rem',
    fontSize: '0.8rem',
    color: DAVINCI_COLORS.secondary
  }}>
    Powered by DaVinci Resolve
  </div>
);

export default DaVinciResolveFullLogo;
