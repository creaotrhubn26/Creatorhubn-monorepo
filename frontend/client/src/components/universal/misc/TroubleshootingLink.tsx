import React from 'react';
import { Button, Tooltip } from '@mui/material';
import { Link } from 'wouter';
import { TrendingUp } from '@mui/icons-material';
import { useTheming } from '../../../utils/theming-helper';

export function TroubleshootingLink() {
  const theming = useTheming('photographer');

  return (
    <Tooltip title="Apne feilsoking og systemstatus">
      <Link href="/troubleshooting">
        <Button
          variant="outlined"
          size="small"
          startIcon={<TrendingUp />}
          sx={{
            borderColor: theming.colors.accent,
            color: theming.colors.primary,
            '&:hover': {
              borderColor: theming.colors.primary,
              backgroundColor: `${theming.colors.light}66`,
            },
          }}
        >
          System Status
        </Button>
      </Link>
    </Tooltip>
  );
}

export default TroubleshootingLink;

