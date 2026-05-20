import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import {
  AutoAwesome,
  CloudDone,
  Description,
  FolderOpen,
  InsertDriveFile,
  OpenInNew,
  Refresh,
  SmartToy,
  VideoCall,
} from '@mui/icons-material';
import {
  notebookLmWorkspaceService,
  type NotebookLmWorkspaceStatus,
} from '@/services/notebookLmWorkspaceService';

interface NotebookLmWorkspaceCardProps {
  status?: NotebookLmWorkspaceStatus;
  loading?: boolean;
  syncing?: boolean;
  onSync?: () => void;
  dense?: boolean;
  profession?: string;
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return 'Ikke synket ennå';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Ikke synket ennå';
  }

  return parsed.toLocaleString('no-NO');
}

function buildMeetingNoteHref(
  status: NotebookLmWorkspaceStatus | undefined,
  meetingId: string | null,
  profession?: string,
): string | null {
  if (!meetingId) {
    return null;
  }

  const params = new URLSearchParams();
  params.set('meetingId', meetingId);

  const resolvedProfession = profession || status?.scope.profession || undefined;
  if (resolvedProfession) {
    params.set('profession', resolvedProfession);
  }

  if (status?.scope.projectId) {
    params.set('projectId', status.scope.projectId);
  }

  if (status?.scope.clientId) {
    params.set('clientId', status.scope.clientId);
  }

  return `/smart-meeting-notes?${params.toString()}`;
}

export function NotebookLmWorkspaceCard({
  status,
  loading = false,
  syncing = false,
  onSync,
  dense = false,
  profession,
}: NotebookLmWorkspaceCardProps): JSX.Element {
  const firstSource = status?.sourceDocuments.find((entry) => entry.googleDocUrl) || null;
  const workspaceDocumentUrl = status?.workspace?.workspaceDocumentUrl || null;
  const driveFolderUrl = status?.workspace?.driveFolderUrl || null;
  const notebookLmUrl = status?.workspace?.metadata?.notebookLmUrl;
  const sourceDocuments = (status?.sourceDocuments || []).slice(0, dense ? 2 : 5);
  const sourceCount = status?.sourceDocumentCount || 0;
  const meetingNoteCount = status?.meetingNoteCount || 0;
  const workspaceTitle = status?.workspace?.title || 'NotebookLM Workspace';
  const workspaceDescription = status?.workspace?.description || 'Arbeidsdokumentet samler møtenotater, Google Docs-kilder og prosjektkontekst i ett forskningsrom.';
  const creatorHubModeDescription = status?.workspaceReady
    ? 'CreatorHub holder arbeidsrommet, kildene og møtenotatene oppdatert her inne. Når du vil bruke NotebookLM for oppsummering og spørsmål, åpnes Google sin flate i et nytt vindu.'
    : 'Klargjør arbeidsrommet først. Deretter blir møtenotater og Google Docs-kilder samlet her inne, og NotebookLM bruker samme kilder videre.';
  const latestMeetingHref = buildMeetingNoteHref(status, status?.latestMeetingId || firstSource?.meetingId || null, profession);

  return (
    <Card
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'rgba(120, 96, 52, 0.18)',
        background: 'linear-gradient(180deg, #fbf6ee 0%, #f5efe4 100%)',
        boxShadow: '0 20px 60px rgba(54, 43, 18, 0.12)',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at top right, rgba(197, 168, 117, 0.18), transparent 34%), radial-gradient(circle at bottom left, rgba(79, 109, 122, 0.12), transparent 28%)',
          pointerEvents: 'none',
        },
      }}
    >
      <CardContent sx={{ position: 'relative', p: dense ? 2 : 3, zIndex: 1 }}>
        <Stack spacing={dense ? 2 : 2.5}>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: dense ? '1fr' : { xs: '1fr', xl: 'minmax(0, 1.4fr) minmax(320px, 0.95fr)' },
            }}
          >
            <Box
              sx={{
                p: dense ? 2 : 2.5,
                borderRadius: 3,
                border: '1px solid rgba(120, 96, 52, 0.14)',
                background: 'linear-gradient(180deg, rgba(255,252,246,0.96) 0%, rgba(255,249,241,0.92) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
              }}
            >
              <Stack spacing={dense ? 1.5 : 2}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography
                      variant="overline"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.75,
                        color: '#7b5a2f',
                        fontWeight: 800,
                        letterSpacing: '0.14em',
                      }}
                    >
                      <SmartToy sx={{ fontSize: 16 }} />
                      CreatorHub NotebookLM
                    </Typography>
                    <Typography
                      variant={dense ? 'h6' : 'h5'}
                      sx={{ mt: 0.5, fontWeight: 800, color: '#201913', letterSpacing: '-0.02em' }}
                    >
                      {workspaceTitle}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.75, maxWidth: 760, color: 'rgba(52, 42, 26, 0.72)' }}>
                      {workspaceDescription}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                    {loading ? <CircularProgress size={18} /> : null}
                    <Chip
                      size="small"
                      icon={<CloudDone />}
                      label={status?.connected ? 'Workspace koblet' : 'Workspace frakoblet'}
                      sx={{
                        bgcolor: status?.connected ? 'rgba(77, 124, 81, 0.14)' : 'rgba(173, 109, 41, 0.12)',
                        color: status?.connected ? '#2f5d38' : '#8a5316',
                        border: '1px solid',
                        borderColor: status?.connected ? 'rgba(77, 124, 81, 0.22)' : 'rgba(173, 109, 41, 0.22)',
                        fontWeight: 700,
                      }}
                    />
                    {status?.googleEmail ? (
                      <Chip
                        size="small"
                        label={status.googleEmail}
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(120, 96, 52, 0.12)',
                          color: '#5a4630',
                        }}
                      />
                    ) : null}
                  </Stack>
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gap: 1.25,
                    gridTemplateColumns: dense ? { xs: 'repeat(2, minmax(0, 1fr))' } : { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                  }}
                >
                  {[
                    {
                      label: 'Kilder',
                      value: String(sourceCount),
                      helper: 'Google Docs og møtenotater',
                      icon: <Description sx={{ fontSize: 18, color: '#7b5a2f' }} />,
                    },
                    {
                      label: 'Møter',
                      value: String(meetingNoteCount),
                      helper: 'Klar for oppsummering',
                      icon: <VideoCall sx={{ fontSize: 18, color: '#7b5a2f' }} />,
                    },
                    {
                      label: 'Siste synk',
                      value: formatDate(status?.workspace?.lastSyncedAt || null),
                      helper: status?.workspaceReady ? 'Arbeidsrom aktivt' : 'Venter på første synk',
                      icon: <AutoAwesome sx={{ fontSize: 18, color: '#7b5a2f' }} />,
                    },
                  ].map((item) => (
                    <Box
                      key={item.label}
                      sx={{
                        p: 1.5,
                        minHeight: dense ? 96 : 112,
                        borderRadius: 2.5,
                        border: '1px solid rgba(120, 96, 52, 0.12)',
                        bgcolor: 'rgba(255,255,255,0.04)',
                      }}
                    >
                      <Stack spacing={0.8}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                          <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, color: '#8b6b3f' }}>
                            {item.label}
                          </Typography>
                          {item.icon}
                        </Box>
                        <Typography
                          variant={item.label === 'Siste synk' ? 'body1' : 'h4'}
                          sx={{
                            fontWeight: 800,
                            color: '#1f1a14',
                            lineHeight: 1.05,
                            letterSpacing: item.label === 'Siste synk' ? 'normal' : '-0.03em',
                          }}
                        >
                          {item.value}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(52, 42, 26, 0.62)' }}>
                          {item.helper}
                        </Typography>
                      </Stack>
                    </Box>
                  ))}
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gap: 1.25,
                    gridTemplateColumns: dense ? '1fr' : { xs: '1fr', md: 'minmax(0, 1.2fr) minmax(0, 0.8fr)' },
                  }}
                >
                  <Box
                    sx={{
                      p: dense ? 1.75 : 2.1,
                      borderRadius: 3,
                      border: '1px solid rgba(120, 96, 52, 0.12)',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(251,246,238,0.88) 100%)',
                      backgroundImage: 'linear-gradient(to bottom, rgba(120, 96, 52, 0.06) 1px, transparent 1px)',
                      backgroundSize: '100% 34px',
                    }}
                  >
                    <Stack spacing={1.2}>
                      <Typography variant="overline" sx={{ color: '#8b6b3f', fontWeight: 800, letterSpacing: '0.12em' }}>
                        Workspace Notes
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 700, color: '#201913' }}>
                        {creatorHubModeDescription}
                      </Typography>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {status?.scope?.projectTitle ? (
                          <Chip size="small" label={`Prosjekt: ${status.scope.projectTitle}`} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                        ) : null}
                        {status?.scope?.clientName ? (
                          <Chip size="small" label={`Klient: ${status.scope.clientName}`} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                        ) : null}
                        <Chip
                          size="small"
                          label={status?.workspaceReady ? 'Research mode aktiv' : 'Klargjøring pågår'}
                          sx={{
                            bgcolor: status?.workspaceReady ? 'rgba(77, 124, 81, 0.14)' : 'rgba(173, 109, 41, 0.12)',
                            color: status?.workspaceReady ? '#2f5d38' : '#8a5316',
                          }}
                        />
                      </Stack>
                    </Stack>
                  </Box>

                  {!dense ? (
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        border: '1px solid rgba(120, 96, 52, 0.12)',
                        bgcolor: 'rgba(255,255,255,0.04)',
                      }}
                    >
                      <Stack spacing={1.25}>
                        <Typography variant="overline" sx={{ color: '#8b6b3f', fontWeight: 800, letterSpacing: '0.12em' }}>
                          Inside NotebookLM
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(52, 42, 26, 0.72)' }}>
                          Når arbeidsrommet er klargjort, bruker NotebookLM disse kildene til oppsummering, spørsmål, mønstre og neste steg.
                        </Typography>
                        <Stack spacing={0.8}>
                          {[
                            'Spørsmål og svar på tvers av møtenotater',
                            'Rask oppsummering av siste samtaler',
                            'Forslag til oppfølging basert på kildene',
                          ].map((line) => (
                            <Typography key={line} variant="body2" sx={{ color: '#3c3020' }}>
                              • {line}
                            </Typography>
                          ))}
                        </Stack>
                      </Stack>
                    </Box>
                  ) : null}
                </Box>

                {status?.reason ? (
                  <Alert
                    severity={status.connected ? 'info' : 'warning'}
                    sx={{
                      borderRadius: 2.5,
                      bgcolor: status.connected ? 'rgba(79, 109, 122, 0.08)' : 'rgba(173, 109, 41, 0.1)',
                    }}
                  >
                    {status.reason}
                  </Alert>
                ) : null}
              </Stack>
            </Box>

            {!dense ? (
              <Box
                sx={{
                  p: 2.1,
                  borderRadius: 3,
                  border: '1px solid rgba(120, 96, 52, 0.14)',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(248,243,235,0.92) 100%)',
                }}
              >
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="overline" sx={{ color: '#8b6b3f', fontWeight: 800, letterSpacing: '0.12em' }}>
                      Source Library
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#201913' }}>
                      Kilder klare for NotebookLM
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(52, 42, 26, 0.66)' }}>
                      Dette er dokumentene og møtenotatene som allerede lever i CreatorHub-rommet.
                    </Typography>
                  </Box>

                  <Stack spacing={1.1}>
                    {sourceDocuments.length > 0 ? sourceDocuments.map((source, index) => {
                      const meetingHref = buildMeetingNoteHref(status, source.meetingId, profession);
                      return (
                        <Box
                          key={`${source.meetingId || 'source'}-${source.googleDocId || 'doc'}`}
                          sx={{
                            p: 1.5,
                            borderRadius: 2.5,
                            border: '1px solid rgba(120, 96, 52, 0.1)',
                            bgcolor: 'rgba(255,255,255,0.04)',
                          }}
                        >
                          <Stack spacing={1}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                              <Box>
                                <Typography variant="caption" sx={{ color: '#8b6b3f', fontWeight: 800, letterSpacing: '0.1em' }}>
                                  KILDE {index + 1}
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 700, color: '#201913' }}>
                                  {source.meetingTitle || 'Møtenotat uten tittel'}
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'rgba(52, 42, 26, 0.62)' }}>
                                  {source.meetingType || 'meeting'} • {formatDate(source.meetingDate)}
                                </Typography>
                              </Box>
                              <Chip
                                size="small"
                                label={source.clientVisible ? 'Klientsynlig' : 'Intern'}
                                sx={{
                                  bgcolor: source.clientVisible ? 'rgba(77, 124, 81, 0.14)' : 'rgba(91, 79, 52, 0.08)',
                                  color: source.clientVisible ? '#2f5d38' : '#65533a',
                                }}
                              />
                            </Box>

                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                              {meetingHref ? (
                                <Button
                                  component="a"
                                  href={meetingHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  size="small"
                                  variant="text"
                                  startIcon={<OpenInNew />}
                                  sx={{ color: '#6b512a', px: 0.5 }}
                                >
                                  Åpne notat
                                </Button>
                              ) : null}
                              {source.googleDocUrl ? (
                                <Button
                                  component="a"
                                  href={source.googleDocUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  size="small"
                                  variant="text"
                                  startIcon={<InsertDriveFile />}
                                  sx={{ color: '#6b512a', px: 0.5 }}
                                >
                                  Åpne doc
                                </Button>
                              ) : null}
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    }) : (
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2.5,
                          border: '1px dashed rgba(120, 96, 52, 0.2)',
                          bgcolor: 'rgba(255,255,255,0.62)',
                        }}
                      >
                        <Typography variant="body2" sx={{ color: 'rgba(52, 42, 26, 0.66)' }}>
                          Ingen kilder er synket ennå. Lag et møtenotat eller kjør synk for å fylle dette biblioteket.
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </Stack>
              </Box>
            ) : null}
          </Box>

          <Divider sx={{ borderColor: 'rgba(120, 96, 52, 0.14)' }} />

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <Refresh />}
              onClick={onSync}
              disabled={!status?.syncEligible || syncing || typeof onSync !== 'function'}
              sx={{
                bgcolor: '#3d3122',
                color: '#fff8ef',
                '&:hover': { bgcolor: '#2f261b' },
              }}
            >
              {status?.workspaceReady ? 'Synk workspace' : 'Klargjør workspace'}
            </Button>

            <Button
              variant="outlined"
              startIcon={<OpenInNew />}
              onClick={() => notebookLmWorkspaceService.openNotebookLm(typeof notebookLmUrl === 'string' ? notebookLmUrl : status?.notebookLmUrl)}
              sx={{
                borderColor: 'rgba(120, 96, 52, 0.18)',
                color: '#5f4725',
                bgcolor: 'rgba(255,255,255,0.04)',
              }}
            >
              Åpne NotebookLM
            </Button>

            {workspaceDocumentUrl ? (
              <Button
                component="a"
                href={workspaceDocumentUrl}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                startIcon={<Description />}
                sx={{
                  borderColor: 'rgba(120, 96, 52, 0.18)',
                  color: '#5f4725',
                  bgcolor: 'rgba(255,255,255,0.04)',
                }}
              >
                Arbeidsdokument
              </Button>
            ) : null}

            {driveFolderUrl ? (
              <Button
                component="a"
                href={driveFolderUrl}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                startIcon={<FolderOpen />}
                sx={{
                  borderColor: 'rgba(120, 96, 52, 0.18)',
                  color: '#5f4725',
                  bgcolor: 'rgba(255,255,255,0.04)',
                }}
              >
                Kildemappe
              </Button>
            ) : null}

            {latestMeetingHref ? (
              <Button
                component="a"
                href={latestMeetingHref}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                startIcon={<OpenInNew />}
                sx={{
                  borderColor: 'rgba(120, 96, 52, 0.18)',
                  color: '#5f4725',
                  bgcolor: 'rgba(255,255,255,0.04)',
                }}
              >
                Siste møtenotat
              </Button>
            ) : null}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default NotebookLmWorkspaceCard;
