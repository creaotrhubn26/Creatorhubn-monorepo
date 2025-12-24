import React from 'react';

export const getCameraLogo = (brand: string): React.FC<{ width?: number; height?: number }> => {
  return ({ width = 100, height = 40 }) => (
    <div style={{ 
      width, 
      height, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontWeight: 'bold',
      fontSize: '0.9rem',
      color: '#333'
    }}>
      {brand}
    </div>
  );
};

export default getCameraLogo;
