// @ts-nocheck
/**
 * WorkspaceSplitSheet — dashboardets split-sheet-modal, brakt inn i workspacet i
 * ws-design og scopet til prosjektet. Gjenbruker de SAMME komponentene som
 * UniversalDashboard: SplitSheetEarningsOverview (Statistikk), TeamMembersDirectory
 * (Team) og SplitSheetRoleWizard (rolle-basert opprettelse). Profesjons-bevisst —
 * musikkprodusent får royalty/master/komposisjon-roller, foto/video sine.
 *
 * Data: kanoniske /api/split-sheets, scopet med project_id. localStorage er kun
 * en rask cache og reserve for avtaler som ikke rakk å synkroniseres.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Stack, Typography, Button, Dialog, DialogContent, IconButton, Tabs as MuiTabs, Tab, Avatar } from '@mui/material';
import AccountBalance from '@mui/icons-material/AccountBalance';
import Add from '@mui/icons-material/Add';
import Close from '@mui/icons-material/Close';
import { apiRequest } from '@/lib/queryClient';
import SplitSheetEarningsOverview from '../universal/split-sheets/SplitSheetEarningsOverview';
import TeamMembersDirectory from '../universal/split-sheets/TeamMembersDirectory';
import SplitSheetRoleWizard from '../universal/split-sheets/SplitSheetRoleWizard';
import { ws, isMusicProfession } from './workspaceTheme';
import { wsIcon } from './crewIcons';
import { WsCard, WsTag } from './ui';
import { calculateHourlyAmount, normalizeCurrencyAmount, normalizeEstimatedHours, readSplitSheetCompensationFields, splitSheetCompensationModel } from '@shared/split-sheet-compensation';
import { isWorkspaceParticipantCompensationMetadata } from '@shared/workspace-participant-compensation';
import { initializeWorkspaceSplitSheetCache, persistWorkspaceSplitSheetCache, workspaceSplitSheetCacheKey } from './workspaceSplitSheetCachePolicy';

// Delt normalisering (samme som sidenavet bruker) i stedet for en egen, ufullstendig
// profesjons-liste — den gamle lista manglet 'musicproducer' (den faktiske verdien
// workspaceTheme.ts normaliserer musikkprodusenter til).
const isMusic = (p?: string) => isMusicProfession(p);
// split_sheet_contributors.role har CHECK-constraint (kun disse slug-ene). Wizardens
// roleId (f.eks. 'photo', 'second-shooter') og norske labels bryter den → map til
// gyldig slug (ellers 'collaborator'); den lesbare rollen lagres i custom_fields.
const ROLE_SLUGS = new Set(['producer', 'artist', 'songwriter', 'composer', 'lyricist', 'vocalist', 'instrumentalist', 'mix_engineer', 'mastering_engineer', 'arranger', 'featured_artist', 'backing_vocalist', 'session_musician', 'collaborator', 'publisher', 'label', 'other']);
const toRoleSlug = (roleId?: string) => (roleId && ROLE_SLUGS.has(roleId) ? roleId : 'collaborator');

const asObject = (value: unknown): Record<string, any> => {
  if (value && typeof value === 'object') return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const amountFromDescription = (description?: string | null) => {
  const match = String(description || '').match(/Beløp:\s*([\d\s.,]+)\s*kr/i);
  if (!match) return 0;
  return Number(match[1].replace(/\s/g, '').replace(',', '.')) || 0;
};

const sheetToEntry = (sheet: any) => {
  const metadata = asObject(sheet?.metadata);
  const projectAmount = Number(metadata.projectAmount) || amountFromDescription(sheet?.description);
  const contributors = Array.isArray(sheet?.contributors) ? sheet.contributors : [];
  const participants = contributors.map((contributor: any) => {
    const terms = readSplitSheetCompensationFields(asObject(contributor.custom_fields));
    const percentage = Number(contributor.percentage) || 0;
    const estimatedAmount = terms.compensationType === 'share' ? (projectAmount > 0 ? (percentage / 100) * projectAmount : 0) : Number(terms.estimatedAmount) || 0;
    return {
      id: contributor.id,
      name: contributor.name || 'Uten navn',
      email: contributor.email || '',
      roleId: contributor.role || 'collaborator',
      roleLabel: terms.roleLabel || contributor.role || 'Bidragsyter',
      sharePct: percentage,
      shareKr: estimatedAmount,
      compensationType: terms.compensationType,
      hourlyRate: terms.hourlyRate,
      estimatedHours: terms.estimatedHours,
      estimatedAmount,
      currency: terms.currency
    };
  });
  const managedParticipantCompensation = isWorkspaceParticipantCompensationMetadata(metadata);
  // Managed participant sheets are private internal accounting records. Legal
  // acceptance belongs in the dedicated contract portal, never /signer links.
  const accessCode = managedParticipantCompensation ? null : sheet?.access_code || sheet?.accessCode;

  return {
    id: sheet?.id,
    sheetId: sheet?.id,
    projectName: sheet?.title || 'Uten navn',
    projectAmount: projectAmount || participants.reduce((sum: number, p: any) => sum + p.shareKr, 0),
    createdAt: sheet?.created_at || sheet?.createdAt || new Date().toISOString(),
    model: metadata.distributionModel,
    compensationModel: metadata.compensationModel || splitSheetCompensationModel(participants),
    source: metadata.source,
    visibility: metadata.visibility,
    sheetStatus: sheet?.status || null,
    participants,
    accessCode,
    shareUrl: accessCode && typeof window !== 'undefined' ? `${window.location.origin}/signer/${accessCode}` : undefined
  };
};

const WorkspaceSplitSheet: React.FC<{
  projectId: string;
  profession?: string;
  userId?: string;
  projectName?: string;
}> = ({ projectId, profession, userId, projectName }) => {
  const music = isMusic(profession);
  const storeKey = useMemo(() => workspaceSplitSheetCacheKey({ projectId, userId }), [projectId, userId]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'stats' | 'team'>('stats');
  const [wizard, setWizard] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let active = true;
    let cached: any[] = [];
    try {
      cached = initializeWorkspaceSplitSheetCache<any>(localStorage, {
        projectId,
        userId
      }).entries;
      if (active) setEntries(cached);
    } catch {
      if (active) setEntries([]);
    }
    const loadCanonical = async () => {
      try {
        const response: any = await apiRequest(`/api/split-sheets?project_id=${encodeURIComponent(projectId)}`);
        const sheets = Array.isArray(response?.data) ? response.data : [];
        const details = await Promise.all(
          sheets.map(async (sheet: any) => {
            try {
              const detail: any = await apiRequest(`/api/split-sheets/${encodeURIComponent(sheet.id)}`);
              return detail?.data || null;
            } catch {
              return null;
            }
          })
        );
        if (!active) return;
        // The list endpoint does not include contributors. If a detail request
        // fails temporarily, keep the complete cached entry instead of
        // replacing it with an empty participant list.
        const remote = details.filter(Boolean).map(sheetToEntry);
        setEntries((current) => {
          // `current` may contain an agreement created while the canonical
          // requests were in flight. Merge that live state, not only the cache
          // captured when the effect started.
          const merged = [...remote];
          current.forEach((local) => {
            const index = merged.findIndex((item) => item.sheetId && item.sheetId === local.sheetId);
            if (index >= 0)
              merged[index] = {
                ...local,
                ...merged[index],
                shareUrl: merged[index].shareUrl || local.shareUrl
              };
            else merged.push(local);
          });
          try {
            persistWorkspaceSplitSheetCache(localStorage, storeKey, merged);
          } catch {
            /* cache er valgfri */
          }
          return merged;
        });
      } catch {
        /* behold lokal cache når nett/API ikke er tilgjengelig */
      }
    };
    loadCanonical();
    return () => {
      active = false;
    };
  }, [projectId, storeKey, userId]);

  const persistEntry = (entry: any) => {
    setEntries((current) => {
      const next = [entry, ...current.filter((item) => item.id !== entry.id)];
      try {
        persistWorkspaceSplitSheetCache(localStorage, storeKey, next);
      } catch {
        /* cache er valgfri */
      }
      return next;
    });
  };

  const [share, setShare] = useState<any | null>(null); // { shareUrl, accessCode, sheetId }
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<any | null>(null); // signeringsstatus + audit-logg

  const loadStatus = async (sheetId: string) => {
    if (!sheetId) return;
    try {
      const r: any = await apiRequest(`/api/split-sheets/${sheetId}/signing-status`);
      setStatus(r);
    } catch {
      setStatus(null);
    }
  };
  const evLabel = (t: string) =>
    (
      ({
        signing_enabled: 'Signering aktivert',
        viewed: 'Åpnet avtalen',
        signed: 'Signerte',
        completed: 'Alle signert ✓'
      }) as any
    )[t] || t;
  const evTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('nb-NO', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  const onWizardSave = async (data: any) => {
    setSaveError('');
    const entry: any = {
      id: `local-${Date.now()}`,
      projectName: data.projectName,
      projectAmount: data.projectAmount,
      createdAt: new Date().toISOString(),
      model: data.model,
      compensationModel: data.compensationModel,
      participants: data.participants
    };
    // Varig lagring på prosjektet + slå på signering → delingslenke til teamet.
    try {
      const resp: any = await apiRequest('/api/split-sheets', {
        method: 'POST',
        body: {
          project_id: projectId,
          title: data.projectName || 'Split sheet',
          description: data.projectAmount ? `Beløp: ${data.projectAmount} kr\nAvtaletype: ${data.compensationModel === 'share' ? 'andelsfordeling' : data.compensationModel === 'hourly' ? 'timebasert honorar' : 'kombinert timepris og andel'}` : null,
          metadata: {
            agreementVersion: 1,
            compensationModel: data.compensationModel,
            distributionModel: data.model,
            projectAmount: data.projectAmount,
            currency: 'NOK'
          },
          contributors: (data.participants || []).map((p: any) => {
            const compensationType = p.compensationType || 'share';
            const hourlyRate = compensationType === 'hourly' ? normalizeCurrencyAmount(p.hourlyRate) : null;
            const estimatedHours = compensationType === 'hourly' ? normalizeEstimatedHours(p.estimatedHours) : null;
            const estimatedAmount = compensationType === 'hourly' ? calculateHourlyAmount(hourlyRate, estimatedHours) : compensationType === 'fixed' ? normalizeCurrencyAmount(p.shareKr) : null;
            return {
              name: p.name,
              email: p.email,
              role: toRoleSlug(p.roleId),
              percentage: p.sharePct,
              custom_fields: {
                roleLabel: p.roleLabel || p.role || '',
                compensationType,
                hourlyRate,
                estimatedHours,
                estimatedAmount,
                currency: 'NOK',
                // Bakoverkompatibelt med Audio Showcase sitt etablerte feltskjema.
                feeType: compensationType === 'share' ? 'percentage' : compensationType,
                feeAmount: compensationType === 'hourly' ? hourlyRate : compensationType === 'fixed' ? estimatedAmount : null,
                feeCurrency: 'NOK'
              }
            };
          })
        }
      });
      const sheetId = resp?.data?.id;
      if (sheetId) {
        entry.sheetId = sheetId;
        try {
          const en: any = await apiRequest(`/api/split-sheets/${sheetId}/enable-signing`, { method: 'POST', body: {} });
          entry.accessCode = en?.accessCode;
          entry.shareUrl = en?.shareUrl;
          setShare({
            shareUrl: en?.shareUrl,
            accessCode: en?.accessCode,
            sheetId
          });
        } catch {
          entry.signingPending = true;
          setSaveError('Avtalen ble lagret, men signering kunne ikke aktiveres. Åpne avtalen og prøv igjen før du sender den til teamet.');
        }
      }
    } catch {
      entry.syncPending = true;
      setSaveError('Avtalen ble lagret lokalt, men kunne ikke synkroniseres eller sendes til signering. Prøv igjen når forbindelsen er tilbake.');
    }
    persistEntry(entry);
    setWizard(false);
    setTab('stats');
  };

  const copyLink = (url: string) => {
    try {
      navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* */
    }
  };
  const [sending, setSending] = useState(false);
  const sendInvites = async (sheetId: string) => {
    if (!sheetId || sending) return;
    setSending(true);
    try {
      const r: any = await apiRequest(`/api/split-sheets/${encodeURIComponent(sheetId)}/send-invites`, { method: 'POST', body: {} });
      window.alert(`Signeringslenken er sendt til ${r?.sent || 0} av ${r?.total || 0} bidragsytere med e-post.`);
      loadStatus(sheetId);
    } catch (e: any) {
      window.alert(e?.message || 'Kunne ikke sende. Sjekk at bidragsyterne har e-post.');
    } finally {
      setSending(false);
    }
  };

  const totalKr = useMemo(() => entries.reduce((s, e) => s + (Number(e.projectAmount) || 0), 0), [entries]);
  const shareEntry = share || entries.find((entry: any) => entry.shareUrl);
  const closeOverview = () => setOpen(false);
  return (
    <WsCard>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 1.5,
            bgcolor: ws.accentSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <AccountBalance sx={{ color: ws.accent, fontSize: 21 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{music ? 'Split sheet — royalty-fordeling' : 'Honoraravtaler — andel eller timepris'}</Typography>
          <Typography sx={{ fontSize: 12, color: ws.textDim }}>{entries.length ? `${entries.length} avtale${entries.length === 1 ? '' : 'r'}${totalKr ? ` · ${Math.round(totalKr).toLocaleString('nb-NO')} kr estimert` : ''}` : music ? 'Royalty/master/komposisjon per bidragsyter.' : 'Avtal prosentandel eller timesats per person i oppdraget.'}</Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => setOpen(true)}
          sx={{
            bgcolor: ws.accent,
            color: ws.accentContrast,
            textTransform: 'none',
            fontWeight: 700,
            flexShrink: 0,
            '&:hover': { bgcolor: ws.accentHover }
          }}
        >
          Åpne {music ? 'split sheet' : 'honorar'}
        </Button>
      </Stack>

      <Dialog
        open={open}
        onClose={closeOverview}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: `${ws.radius}px`,
            bgcolor: ws.bg,
            backgroundImage: 'none',
            color: ws.text,
            border: `1px solid ${ws.border}`,
            maxHeight: '92vh'
          }
        }}
      >
        {/* Header — ws-tema */}
        <Box
          sx={{
            px: 3,
            pt: 3,
            pb: 2,
            background: `linear-gradient(135deg, ${ws.accentSoft}, transparent)`,
            borderBottom: `1px solid ${ws.borderSoft}`,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            justifyContent: 'space-between'
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: ws.accentSoft, color: ws.accent }}>
              <AccountBalance />
            </Avatar>
            <Box>
              <Typography variant="overline" sx={{ color: ws.accent, letterSpacing: '0.18em' }}>
                {music ? 'Split Sheets' : 'Honorar'}
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{music ? 'Royalty-fordeling i team' : 'Honoraravtaler i team'}</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              startIcon={<Add />}
              onClick={() => setWizard(true)}
              sx={{
                borderRadius: '999px',
                px: 2.5,
                py: 1,
                bgcolor: ws.accent,
                color: ws.accentContrast,
                fontWeight: 700,
                textTransform: 'none',
                '&:hover': { bgcolor: ws.accentHover }
              }}
            >
              {music ? 'Nytt split sheet' : 'Ny avtale'}
            </Button>
            <IconButton onClick={closeOverview} sx={{ color: ws.textDim }}>
              <Close />
            </IconButton>
          </Stack>
        </Box>

        <Box sx={{ px: 3, pt: 2, borderBottom: `1px solid ${ws.borderSoft}` }}>
          <MuiTabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              minHeight: 40,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                color: ws.textDim,
                minHeight: 40,
                py: 0.5,
                '&.Mui-selected': { color: ws.accent }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: ws.accent,
                height: 3,
                borderRadius: 2
              }
            }}
          >
            <Tab value="stats" label="Statistikk & honorar" />
            <Tab value="team" label="Team-direktorat" />
          </MuiTabs>
        </Box>

        <DialogContent dividers sx={{ p: { xs: 2, md: 3 }, borderColor: ws.borderSoft }}>
          {saveError && (
            <Alert severity="warning" onClose={() => setSaveError('')} sx={{ mb: 2 }}>
              {saveError}
            </Alert>
          )}
          <Alert severity="info" sx={{ mb: 2 }}>
            Første personlige signatur låser timesats, timeestimat, beløp, andeler og deltakere permanent. Senere endringer gjøres i en ny avtale; den signerte avtalen kan arkiveres.
          </Alert>
          {/* Delingslenke til bandet — de åpner den, ser fordelingen og signerer godkjennelse */}
          {tab === 'stats' &&
            shareEntry?.shareUrl &&
            (() => {
              const link = shareEntry.shareUrl;
              const shareSheetId = shareEntry.sheetId;
              return (
                <Box
                  sx={{
                    mb: 2,
                    p: 1.75,
                    borderRadius: `${ws.radiusSm}px`,
                    bgcolor: ws.accentSoft,
                    border: `1px solid ${ws.accentBorder}`
                  }}
                >
                  <Typography
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.4,
                      fontSize: 13,
                      fontWeight: 700,
                      mb: 0.5
                    }}
                  >
                    {wsIcon('Link', { fontSize: 14 })}Del til signering
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: ws.textDim, mb: 1 }}>Send personlige signeringslenker til {music ? 'bandet/bidragsyterne' : 'teamet'}. Den synlige felleslenken er kun for visning; hver deltaker må bruke sin egen e-postlenke for å signere. Har de CreatorHub-konto med samme e-post, finner de avtalen igjen under «Mine avtaler».</Typography>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
                    <Box
                      sx={{
                        flex: 1,
                        px: 1.25,
                        py: 0.9,
                        borderRadius: 1,
                        bgcolor: ws.panel,
                        border: `1px solid ${ws.borderSoft}`,
                        fontSize: 12,
                        color: ws.textDim,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {link}
                    </Box>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={sending}
                      onClick={() => sendInvites(shareSheetId)}
                      sx={{
                        bgcolor: ws.accent,
                        color: ws.accentContrast,
                        textTransform: 'none',
                        fontWeight: 700,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        '&:hover': { bgcolor: ws.accentHover }
                      }}
                    >
                      {sending ? 'Sender…' : `Send til ${music ? 'bandet' : 'teamet'}`}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => copyLink(link)}
                      sx={{
                        color: copied ? ws.green : ws.accent,
                        textTransform: 'none',
                        fontWeight: 700,
                        flexShrink: 0
                      }}
                    >
                      {copied ? 'Kopiert ✓' : 'Kopier visningslenke'}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => loadStatus(shareSheetId)}
                      sx={{
                        color: ws.textDim,
                        textTransform: 'none',
                        fontWeight: 600,
                        flexShrink: 0
                      }}
                    >
                      Status & logg
                    </Button>
                  </Stack>

                  {status && (
                    <Box
                      sx={{
                        mt: 1.5,
                        pt: 1.5,
                        borderTop: `1px solid ${ws.borderSoft}`
                      }}
                    >
                      <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.75 }}>
                        Signeringsstatus — {status.signedCount}/{status.total} signert
                      </Typography>
                      <Stack spacing={0.4} sx={{ mb: 1 }}>
                        {(status.contributors || []).map((c: any) => (
                          <Stack key={c.id} direction="row" alignItems="center" spacing={1}>
                            <Typography sx={{ fontSize: 12, flex: 1 }} noWrap>
                              {c.name}
                              {c.role ? ` · ${c.role}` : ''} · {c.compensationType === 'hourly' ? `${Number(c.hourlyRate || 0).toLocaleString('nb-NO')} kr/t · ${Number(c.estimatedHours || 0).toLocaleString('nb-NO')} t estimert` : c.compensationType === 'fixed' ? `${Number(c.estimatedAmount || 0).toLocaleString('nb-NO')} kr fast` : `${Number(c.percentage || 0).toLocaleString('nb-NO')}%`}
                            </Typography>
                            {c.signed ? <WsTag label="Signert" tone="green" /> : <WsTag label="Venter" tone="amber" />}
                          </Stack>
                        ))}
                      </Stack>
                      <Typography
                        sx={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: ws.textFaint,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          mb: 0.5
                        }}
                      >
                        Audit-logg
                      </Typography>
                      <Stack spacing={0.25}>
                        {(status.events || []).length === 0 ? (
                          <Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>Ingen hendelser ennå.</Typography>
                        ) : (
                          (status.events || []).slice(0, 20).map((e: any, i: number) => (
                            <Typography key={i} sx={{ fontSize: 11, color: ws.textDim }}>
                              <b style={{ color: ws.textFaint }}>{evTime(e.at)}</b> · {evLabel(e.type)}
                              {e.actor ? ` — ${e.actor}` : ''}
                              {e.method ? ` (${e.method === 'drawn' ? 'tegnet' : 'skrevet'})` : ''}
                              {e.ip ? ` · ${e.ip}` : ''}
                            </Typography>
                          ))
                        )}
                      </Stack>
                    </Box>
                  )}
                </Box>
              );
            })()}
          {tab === 'stats' &&
            (entries.length === 0 ? (
              <Stack alignItems="center" spacing={1.5} sx={{ py: 6 }}>
                <AccountBalance sx={{ fontSize: 40, color: ws.textFaint }} />
                <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Ingen avtale ennå</Typography>
                <Typography
                  sx={{
                    fontSize: 12.5,
                    color: ws.textDim,
                    textAlign: 'center',
                    maxWidth: 420
                  }}
                >
                  Lag den første {music ? 'royalty-fordelingen' : 'honoraravtalen med prosentandel eller timepris'} for prosjektet.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setWizard(true)}
                  sx={{
                    mt: 1,
                    bgcolor: ws.accent,
                    color: ws.accentContrast,
                    textTransform: 'none',
                    fontWeight: 700,
                    '&:hover': { bgcolor: ws.accentHover }
                  }}
                >
                  {music ? 'Nytt split sheet' : 'Ny avtale'}
                </Button>
              </Stack>
            ) : (
              <SplitSheetEarningsOverview sheets={entries} />
            ))}
          {tab === 'team' && <TeamMembersDirectory profession={profession} />}
        </DialogContent>
      </Dialog>

      {/* Rolle-veiviser — samme som dashboardet, profesjons-bevisst */}
      <SplitSheetRoleWizard open={wizard} onClose={() => setWizard(false)} allowHourly profession={profession} projectName={projectName || ''} onSave={onWizardSave} />
    </WsCard>
  );
};

export default WorkspaceSplitSheet;
