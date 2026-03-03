/**
 * Profession Tab Adapter
 * Profession-aware tab renderer for UniversalDashboard.
 */

import React from 'react';
import { Alert, Box, Chip, Paper, Stack, Typography } from '@mui/material';
import useProfessionTabs from './hooks/useProfessionTabs';
import RoleRoomDashboardPanel from '../role-room/RoleRoomDashboardPanel';

interface ProfessionTabAdapterProps {
  profession: string;
  tabId: string;
  userId: string;
  [key: string]: unknown;
}

interface AdapterContext {
  profession: string;
  tabId: string;
  userId: string;
  additionalProps: Record<string, unknown>;
}

type TabRenderer = (context: AdapterContext) => JSX.Element;

const FALLBACK_MESSAGES: Record<string, string> = {
  'booking-calendar': 'Booking calendar module is queued for this profession.',
  'pet-profiles': 'Pet profiles module is queued for this profession.',
  'live-cameras': 'Live camera module is queued for this profession.',
  'daily-logs': 'Daily logs module is queued for this profession.',
  'facility-management': 'Facility management module is queued for this profession.',
  'class-schedule': 'Class scheduling module is queued for this profession.',
  memberships: 'Membership module is queued for this profession.',
  'instructor-management': 'Instructor management module is queued for this profession.',
  'studio-booking': 'Studio booking module is queued for this profession.',
  portfolio: 'Portfolio module is queued for this profession.',
  appointments: 'Appointment module is queued for this profession.',
  'design-gallery': 'Design gallery module is queued for this profession.',
  aftercare: 'Aftercare module is queued for this profession.',
  'client-history': 'Client history module is queued for this profession.',
  'product-sales': 'Product sales module is queued for this profession.',
  'client-programs': 'Client program module is queued for this profession.',
  'progress-tracking': 'Progress tracking module is queued for this profession.',
  'nutrition-plans': 'Nutrition plan module is queued for this profession.',
  'session-booking': 'Session booking module is queued for this profession.',
  reservations: 'Reservation module is queued for this profession.',
  'menu-management': 'Menu management module is queued for this profession.',
  'table-management': 'Table management module is queued for this profession.',
  inventory: 'Inventory module is queued for this profession.',
  'event-orders': 'Event order module is queued for this profession.',
  'flower-inventory': 'Flower inventory module is queued for this profession.',
  'delivery-schedule': 'Delivery schedule module is queued for this profession.',
  'design-portfolio': 'Design portfolio module is queued for this profession.',
  enrollment: 'Enrollment module is queued for this profession.',
  'daily-activities': 'Daily activities module is queued for this profession.',
  'parent-communication': 'Parent communication module is queued for this profession.',
  'meal-planning': 'Meal planning module is queued for this profession.',
  'patient-sessions': 'Patient sessions module is queued for this profession.',
  'patient-notes': 'Patient notes module is queued for this profession.',
  telehealth: 'Telehealth module is queued for this profession.',
  'treatment-plans': 'Treatment plans module is queued for this profession.',
  'lesson-schedule': 'Lesson schedule module is queued for this profession.',
  'student-progress': 'Student progress module is queued for this profession.',
  'vehicle-management': 'Vehicle management module is queued for this profession.',
  'theory-tests': 'Theory tests module is queued for this profession.',
  'treatment-booking': 'Treatment booking module is queued for this profession.',
  'client-preferences': 'Client preferences module is queued for this profession.',
  'product-inventory': 'Product inventory module is queued for this profession.',
  'membership-packages': 'Membership packages module is queued for this profession.',
};

function FallbackTab({ profession, tabId }: { profession: string; tabId: string }): JSX.Element {
  const message = FALLBACK_MESSAGES[tabId] ?? 'This tab is not yet implemented for the selected profession.';

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Chip size="small" label={profession} color="primary" />
          <Chip size="small" label={tabId} variant="outlined" />
        </Stack>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          {tabId.replaceAll('-', ' ')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {message}
        </Typography>
        <Alert severity="info">Core universal dashboard behavior remains active while this tab ships.</Alert>
      </Paper>
    </Box>
  );
}

const TAB_RENDERERS: Record<string, TabRenderer> = {
  'role-room': ({ userId, profession, additionalProps }) => (
    <RoleRoomDashboardPanel userId={userId} profession={profession} {...additionalProps} />
  ),
};

export default function ProfessionTabAdapter({ profession, tabId, userId, ...additionalProps }: ProfessionTabAdapterProps): JSX.Element {
  const { hasTab } = useProfessionTabs(profession);

  if (!hasTab(tabId, profession)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">This tab is not available for {profession}.</Alert>
      </Box>
    );
  }

  const renderer = TAB_RENDERERS[tabId];

  if (renderer) {
    return renderer({
      profession,
      tabId,
      userId,
      additionalProps,
    });
  }

  return <FallbackTab profession={profession} tabId={tabId} />;
}
