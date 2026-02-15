import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

const MemoryCardIcon: React.FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H6V4h2v6l2-1.5L12 10V4h6v16z" />
    </SvgIcon>
  );
};

export default MemoryCardIcon;
