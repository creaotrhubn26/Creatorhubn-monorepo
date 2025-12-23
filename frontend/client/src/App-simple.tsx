import * as React from 'react';
import { Switch, Route } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { creatorHubTheme } from './theme/creatorHubTheme';

function SimpleApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={creatorHubTheme}>
        <CssBaseline />
        <Switch>
          <Route path="/" component={() => (
            <div style={{ padding: '20px',}}>
              <h1>CreatorHub Norge - Simple App</h1>
              <p>This is a simplified version to test if the basic structure works.</p>
              <p>If you see this, the basic React app structure is working!</p>
            </div>
          )} />
          <Route component={() => (
            <div style={{ padding: '20px',}}>
              <h1>404 - Page Not Found</h1>
              <p>This page doesn't exist.</p>
            </div>
          )} />
        </Switch>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default SimpleApp;

