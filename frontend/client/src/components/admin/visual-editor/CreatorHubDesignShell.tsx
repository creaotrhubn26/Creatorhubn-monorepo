/**
 * CreatorHubDesignShell — workspace-shell for CreatorHub Design, montert som en fane i
 * den visuelle editoren (/visual-editor-enhanced).
 *
 * Én workspace-kontekst på toppen (CreatorHub / The Role Room / Leadgrid / Global) → alt
 * under re-scopes: maler, design-tokens, konnektorer. Verktøyene er prop-drevne av shell-
 * en (dropper egne velgere). Første fundament-brikke mot full Claude Design-paritet.
 */
import React from 'react';
import { Box, Paper, Stack, Tab, Tabs, Typography, ToggleButton, ToggleButtonGroup, Chip, Link } from '@mui/material';
import InfographicTemplatesTab from '../InfographicTemplatesTab';
import DesignTokensTab from '../DesignTokensTab';

const WORKSPACES = [
  { value: 'creatorhub', label: 'CreatorHub' },
  { value: 'theroleroom', label: 'The Role Room' },
  { value: 'leadgrid', label: 'Leadgrid' },
  { value: 'global', label: 'Global (delt)' },
];

const SUBTABS = [
  { value: 'templates', label: 'Maler' },
  { value: 'tokens', label: 'Design-tokens' },
  { value: 'connectors', label: 'Konnektorer' },
];

// Konnektorer per workspace (live data → auto-infografikk). Utvides etter hvert.
const CONNECTORS: Record<string, { path: string; desc: string }[]> = {
  leadgrid: [
    { path: '/api/infographics/leadgrid/momentum.png?view=score|activity|breakdown|goal', desc: 'Salgs-momentum (donut/stat-bar)' },
    { path: '/api/infographics/leadgrid/leaderboard.png?metric=leads|prizes|value', desc: 'Team-podium' },
    { path: '/api/infographics/leadgrid/commission.png?period=month&view=total|byseller', desc: 'Provisjon' },
  ],
};

function ConnectorsPanel({ ws }: { ws: string }) {
  const conns = CONNECTORS[ws] || [];
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        Live data-konnektorer for <b>{ws}</b> — henter ferske tall og rendrer auto-valgt infografikk (RBAC-gated, kun egen org).
        Dette er noe Claude Design <b>ikke</b> har: data-bundne, alltid-ferske flater.
      </Typography>
      {conns.length === 0 ? (
        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>Ingen konnektorer for dette workspacet enda.</Typography>
      ) : conns.map((c) => (
        <Paper key={c.path} variant="outlined" sx={{ p: 1.2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{c.desc}</Typography>
          <Link variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{c.path}</Link>
        </Paper>
      ))}
    </Stack>
  );
}

export default function CreatorHubDesignShell() {
  const [ws, setWs] = React.useState('creatorhub');
  const [sub, setSub] = React.useState('templates');

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>CreatorHub Design</Typography>
          <Typography variant="body2" color="text.secondary">Administrer flatene per produkt — maler, merkevare, live-data. Alt scopet, atskilt.</Typography>
        </Box>
        <ToggleButtonGroup exclusive size="small" value={ws} onChange={(_e, v) => v && setWs(v)}>
          {WORKSPACES.map((w) => <ToggleButton key={w.value} value={w.value} sx={{ textTransform: 'none' }}>{w.label}</ToggleButton>)}
        </ToggleButtonGroup>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Chip size="small" color="primary" label={`Workspace: ${WORKSPACES.find((w) => w.value === ws)?.label}`} />
      </Stack>

      <Tabs value={sub} onChange={(_e, v) => setSub(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        {SUBTABS.map((t) => <Tab key={t.value} value={t.value} label={t.label} sx={{ textTransform: 'none' }} />)}
      </Tabs>

      {/* key={ws} remonterer verktøyet ved workspace-bytte → rene re-fetch/scope */}
      {sub === 'templates' && <InfographicTemplatesTab key={ws} workspace={ws} />}
      {sub === 'tokens' && <DesignTokensTab key={ws} workspace={ws === 'global' ? 'global' : ws} />}
      {sub === 'connectors' && <ConnectorsPanel ws={ws} />}
    </Box>
  );
}
