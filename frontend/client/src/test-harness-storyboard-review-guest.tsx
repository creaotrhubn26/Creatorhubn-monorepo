import React from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import StoryboardReviewPage from './pages/storyboard-review';

window.history.replaceState({}, '', '/storyboard-review/review-token-e2e');

createRoot(document.getElementById('root')!).render(
  <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
    <CssBaseline />
    <StoryboardReviewPage />
  </ThemeProvider>,
);
