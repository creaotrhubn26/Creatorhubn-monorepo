import React, { useMemo } from 'react';
import { Box, Container, Typography } from '@mui/material';
import SmartMeetingNotesEditor from '@/components/meeting-system/SmartMeetingNotesEditor';

type Profession = 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';

function readProfession(value: string | null): Profession {
  const normalized = String(value || '').trim();
  if (
    normalized === 'photographer'
    || normalized === 'videographer'
    || normalized === 'music_producer'
    || normalized === 'vendor'
    || normalized === 'enterprise'
  ) {
    return normalized;
  }
  return 'photographer';
}

export default function SmartMeetingNotesPage(): JSX.Element {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const profession = readProfession(params.get('profession'));
  const projectId = String(params.get('projectId') || '').trim() || undefined;
  const meetingId = String(params.get('meetingId') || '').trim() || `meeting-${window.crypto.randomUUID()}`;
  const weddingTimelineId = String(params.get('weddingTimelineId') || '').trim();

  return (
    <Box sx={{ minHeight: '100vh', py: { xs: 3, md: 5 }, background: 'linear-gradient(180deg, #f7f4ee 0%, #efe7d8 100%)' }}>
      <Container maxWidth="lg">
        <Box sx={{ mb: 3 }}>
          <Typography variant="overline" sx={{ color: '#8b6b3f', fontWeight: 800, letterSpacing: '0.14em' }}>
            CreatorHub Meeting Notes
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#201913', mb: 0.75 }}>
            Full møteeditor
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Her jobber du videre med samme møtenotat, prosjektkobling og NotebookLM-kontekst som ble opprettet i hurtigflyten.
          </Typography>
        </Box>

        <SmartMeetingNotesEditor
          meetingId={meetingId}
          profession={profession}
          projectId={projectId}
          weddingTimelineId={weddingTimelineId || undefined}
        />
      </Container>
    </Box>
  );
}
