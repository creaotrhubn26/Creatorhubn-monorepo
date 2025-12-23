/**
 * Sentry Test Component
 * 
 * This component provides buttons to test Sentry error tracking.
 * Add this to any page to verify Sentry is working correctly.
 * 
 * Usage:
 * import SentryTestComponent from './components/test/SentryTestComponent';
 * <SentryTestComponent />
 */

import React from 'react';
import { Box, Button, Card, CardContent, Typography, Stack, Chip } from '@mui/material';
import { 
  BugReport, 
  Send, 
  Person, 
  Label,
  Error as ErrorIcon,
  CheckCircle,
} from '@mui/icons-material';
import { 
  captureErrorToSentry, 
  captureMessageToSentry,
  addSentryBreadcrumb,
  setSentryUser,
  setSentryTags,
} from '../../utils/sentry';

const SentryTestComponent: React.FC = () => {
  const [lastEventId, setLastEventId] = React.useState<string | null>(null);

  const handleTestError = () => {
    addSentryBreadcrumb({
      category: 'test',
      message: 'User clicked "Test Error" button',
      level: 'info',
    });

    try {
      throw new Error('This is a test error from Sentry Test Component!');
    } catch (error) {
      const eventId = captureErrorToSentry(error as Error, {
        testType: 'manual-error',
        component: 'SentryTestComponent',
        timestamp: new Date().toISOString(),
      });
      setLastEventId(eventId);
    }
  };

  const handleTestMessage = () => {
    addSentryBreadcrumb({
      category: 'test',
      message: 'User clicked "Test Message" button',
      level: 'info',
    });

    const eventId = captureMessageToSentry(
      'This is a test message from Sentry Test Component', 'info',
      {
        testType: 'manual-message',
        component: 'SentryTestComponent',
      }
    );
    setLastEventId(eventId);
  };

  const handleSetUser = () => {
    setSentryUser({
      id: 'test-user-123',
      email: 'test@example.com',
      username: 'Test User',
    });

    addSentryBreadcrumb({
      category: 'test',
      message: 'Set test user context',
      level: 'info',
    });

    alert('User context set! Future errors will be associated with this user.');
  };

  const handleSetTags = () => {
    setSentryTags({
      environment: 'test',
      feature: 'sentry-testing',
      version: '1.0.0',
    });

    addSentryBreadcrumb({
      category: 'test',
      message: 'Set test tags',
      level: 'info',
    });

    alert('Tags set! Future errors will include these tags.');
  };

  const handleThrowError = () => {
    addSentryBreadcrumb({
      category: 'test',
      message: 'User clicked "Throw Uncaught Error" button',
      level: 'warning',
    });

    // This will be caught by ErrorBoundary
    throw new Error('This is an uncaught error that will be caught by ErrorBoundary!');
  };

  return (
    <Card sx={{ maxWidth: 600, margin: 'auto', mt: 4 }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BugReport color="error" />
          Sentry Test Component
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Use these buttons to test Sentry error tracking. Check your Sentry dashboard to see the errors.
        </Typography>

        {lastEventId && (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle fontSize="small" />
              Last Event ID: <Chip label={lastEventId.substring(0, 8)} size="small" />
            </Typography>
          </Box>
        )}

        <Stack spacing={2}>
          <Button
            variant="contained"
            color="error"
            startIcon={<ErrorIcon />}
            onClick={handleTestError}
            fullWidth
          >
            Test Caught Error
          </Button>

          <Button
            variant="contained"
            color="warning"
            startIcon={<Send />}
            onClick={handleTestMessage}
            fullWidth
          >
            Test Message
          </Button>

          <Button
            variant="contained"
            color="info"
            startIcon={<Person />}
            onClick={handleSetUser}
            fullWidth
          >
            Set User Context
          </Button>

          <Button
            variant="contained"
            color="secondary"
            startIcon={<Label />}
            onClick={handleSetTags}
            fullWidth
          >
            Set Tags
          </Button>

          <Button
            variant="outlined"
            color="error"
            startIcon={<BugReport />}
            onClick={handleThrowError}
            fullWidth
          >
            Throw Uncaught Error (ErrorBoundary Test)
          </Button>
        </Stack>

        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            <strong>Note:</strong> After clicking a button, check:
            <br />• Browser console for Sentry logs
            <br />• Sentry dashboard at sentry.io
            <br />• Event ID will appear above if successful
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default SentryTestComponent;

