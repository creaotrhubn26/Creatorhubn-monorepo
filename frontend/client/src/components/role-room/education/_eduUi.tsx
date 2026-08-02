/**
 * _eduUi.tsx — delte, CMS-vennlige UI-primitiver for utdannings-fanene.
 *
 * `T` = data-edit-id-tagget Typography (så visual-editoren kan redigere teksten
 * drift-sikkert). `Panel`, `QuickAction`, `RailTips` gjenbrukes på tvers av fanene
 * for konsistent stil (sidemeny-shell + lilla aksent).
 */

import { Box, Stack, Typography, Card, type TypographyProps } from '@mui/material';
import { ChevronRight as ChevronIcon } from '@mui/icons-material';

export const ACCENT = '#8B5CF6';
export const CARD = 'rgba(255,255,255,0.035)';
export const BORDER = '1px solid rgba(255,255,255,0.08)';

/** data-edit-id-tagget Typography — CMS-redigerbar tekst. Videresender alle
 *  Typography-props (variant/component/onClick/sx …) uendret. */
export function T({ eid, children, ...rest }: { eid: string; children: React.ReactNode } & Omit<TypographyProps, 'children'>) {
  return <Typography data-edit-id={eid} {...rest}>{children}</Typography>;
}

export function Panel({ children, sx }: { children: React.ReactNode; sx?: object }) {
  return <Card sx={{ bgcolor: CARD, border: BORDER, borderRadius: 3, p: 2.5, ...sx }}>{children}</Card>;
}

export function QuickAction({ eid, icon, label, onClick }: { eid: string; icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.25} onClick={onClick} sx={{ py: 1.1, cursor: 'pointer', color: 'rgba(255,255,255,0.85)', '&:hover': { color: '#fff' } }}>
      <Box sx={{ width: 30, height: 30, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'rgba(139,92,246,0.16)', color: '#c4b5fd', flexShrink: 0, '& svg': { fontSize: 16 } }}>{icon}</Box>
      <T eid={eid} sx={{ fontSize: 13, flex: 1 }}>{label}</T>
      <ChevronIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} />
    </Stack>
  );
}

/** Standard tips-boks i høyre skinne. `link`/`onLink` er valgfritt — utelates
 *  når det ikke finnes et ekte mål (unngår døde lenker). */
export function RailTips({ idPrefix, title, body, link, onLink }: { idPrefix: string; title: string; body: string; link?: string; onLink?: () => void }) {
  return (
    <Panel sx={{ bgcolor: 'rgba(139,92,246,0.09)', border: '1px solid rgba(139,92,246,0.26)' }}>
      <T eid={`${idPrefix}-tips-title`} sx={{ fontWeight: 700, fontSize: 13.5, mb: 0.75 }}>{title}</T>
      <T eid={`${idPrefix}-tips-body`} sx={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', lineHeight: 1.5, mb: link ? 1 : 0 }}>{body}</T>
      {link && <T eid={`${idPrefix}-tips-link`} sx={{ color: ACCENT, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}><span onClick={onLink} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onLink?.(); }}>{link}</span></T>}
    </Panel>
  );
}
