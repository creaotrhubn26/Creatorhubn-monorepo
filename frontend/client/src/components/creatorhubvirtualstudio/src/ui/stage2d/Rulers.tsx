import * as React from 'react';
import { Box } from '@mui/material';

export default function Rulers() {
  return (
    <>
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 24,
          bgcolor: '#fff',
          borderBottom: '1px solid #e5e7eb'}}
      />
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 24,
          bgcolor: '#fff',
          borderRight: '1px solid #e5e7eb'}}
      />
    </>
  );
}
