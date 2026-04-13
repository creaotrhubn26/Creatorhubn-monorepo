import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import ProducerClientReviewPanel from './components/role-room/components/producer/ProducerClientReviewPanel';

const theme = createTheme({
  palette: { mode: 'dark' },
});

function ProducerReviewTestHarness() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3}>
        <div style={{ width: '100vw', minHeight: '100vh', background: '#020617', padding: 24 }}>
          <ProducerClientReviewPanel
            projectId="e2e-review-project"
            projectName="E2E Review Project"
            project={null}
            projectWorkflowStatus="awaiting_client"
            canEdit={false}
            canComment={false}
            canDecide={false}
            canApproveReview={false}
            canRequestReviewChanges={false}
          />
        </div>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ProducerReviewTestHarness />
  </React.StrictMode>,
);
