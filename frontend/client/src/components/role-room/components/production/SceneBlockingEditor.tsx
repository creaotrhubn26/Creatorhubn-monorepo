/**
 * SceneBlockingEditor — scenebyggeren.
 *
 * Du setter opp scenen én gang: plantegning, kamera, og hvem som står hvor.
 * Hver person blir et rollekort med sin egen lenke. Regissøren ser scenen
 * som helhet; personen ser sitt eget utsnitt.
 *
 * Tre valg som styrer utformingen:
 *
 *   Ett klikk plasserer. Ikke dra-og-slipp fra en palett, ikke et skjema
 *   med koordinater — du peker der personen står. Koordinatene lagres
 *   normalisert (0–1), så plantegningen kan byttes uten at prikkene flytter
 *   seg.
 *
 *   Handlingen er påkrevd, og det står i feltet før du skriver. Et kort uten
 *   handling er en callsheet, og callsheeten er nettopp det som ikke virker.
 *
 *   Lenken vises først når kortet er lagret. En lenke som ikke virker ennå
 *   er verre enn ingen lenke — den blir sendt.
 */

import {
  Alert, Box, Button, Chip, IconButton, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopyOutlined';
import ImageIcon from '@mui/icons-material/ImageOutlined';
import SendIcon from '@mui/icons-material/SendOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VideocamIcon from '@mui/icons-material/VideocamOutlined';
import PersonPinCircleIcon from '@mui/icons-material/PersonPinCircleOutlined';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import roleCardService, {
  type Kandidat, roleCardLink, type RoleCard, type SceneBlocking, type StoryboardFrame } from '../../services/roleCardService';
import { palette, radius } from '../../talents-app/theme';

interface Props {
  projectId: string;
  sceneId: string;
  sceneTitle?: string;
  /** Produksjonsdagen kortene lages for. Stedet henger på dagen, ikke på scenen. */
  productionDayId?: string;
}

type Modus = 'person' | 'kamera';

const kortSx = {
  bgcolor: palette.bgCard,
  border: `1px solid ${palette.border}`,
  borderRadius: radius.lg,
  p: 2,
};

const feltSx = {
  '& .MuiOutlinedInput-root': { color: palette.textPrimary, bgcolor: palette.bgCardElevated, '& fieldset': { borderColor: palette.border } },
  '& .MuiInputLabel-root': { color: palette.textMuted },
};

/**
 * Klokkeslett og dato, kort. «I dag 20:14» leser raskere enn en full dato når
 * det som regel er i dag det gjelder.
 */
function tidspunkt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const idag = new Date();
  const sammeDag = d.toDateString() === idag.toDateString();
  const klokke = d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  return sammeDag ? `i dag ${klokke}` : `${d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })} ${klokke}`;
}

export default function SceneBlockingEditor({ projectId, sceneId, sceneTitle, productionDayId }: Props) {
  const [blocking, setBlocking] = useState<SceneBlocking>({ planUrl: null, camera: null });
  const [kort, setKort] = useState<RoleCard[]>([]);
  const [modus, setModus] = useState<Modus>('person');
  const [utkast, setUtkast] = useState<{ x: number; y: number } | null>(null);
  const [navn, setNavn] = useState('');
  const [handling, setHandling] = useState('');
  const [signal, setSignal] = useState('');
  const [rolle, setRolle] = useState<RoleCard['person_kind']>('extra');
  const [planFelt, setPlanFelt] = useState('');
  const [feil, setFeil] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState<string | null>(null);
  const [rammer, setRammer] = useState<StoryboardFrame[]>([]);
  // Hvilket kort velger ramme akkurat nå. Null = ingen.
  const [velgerRamme, setVelgerRamme] = useState<string | null>(null);
  const [epost, setEpost] = useState('');
  // Folkene som alt er i produksjonen. Uten dette skrev produsenten navn og
  // e-post på nytt for hvert kort — og kortet ble aldri koblet til
  // talent-profilen, så personen kunne ikke se det innlogget.
  const [kandidater, setKandidater] = useState<Kandidat[]>([]);
  const [valgtTalentId, setValgtTalentId] = useState<string | null>(null);
  const [sender, setSender] = useState(false);
  const [sendtMelding, setSendtMelding] = useState<string | null>(null);
  const planRef = useRef<HTMLDivElement>(null);

  const last = useCallback(async () => {
    const [b, c, f] = await Promise.all([
      roleCardService.getBlocking(projectId, sceneId),
      roleCardService.list(projectId, sceneId),
      roleCardService.listFrames(projectId, sceneId),
    ]);
    if (b) { setBlocking(b); setPlanFelt(b.planUrl ?? ''); }
    setKort(c);
    setRammer(f);
  }, [projectId, sceneId]);

  useEffect(() => { void last(); }, [last]);

  // Kandidatlista er kort og endrer seg sjelden — hentes én gang per prosjekt.
  useEffect(() => {
    let avbrutt = false;
    void roleCardService.kandidater(projectId).then((k) => { if (!avbrutt) setKandidater(k); });
    return () => { avbrutt = true; };
  }, [projectId]);

  /** Klikk på plantegningen → normalisert punkt. */
  const punktFra = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = planRef.current?.getBoundingClientRect();
    if (!r) return null;
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  const klikkPlan = async (e: React.MouseEvent<HTMLDivElement>) => {
    const p = punktFra(e);
    if (!p) return;
    if (modus === 'kamera') {
      const neste = { ...blocking, camera: p };
      setBlocking(neste);
      const r = await roleCardService.saveBlocking(projectId, sceneId, neste);
      if ('error' in r) setFeil(r.error);
      return;
    }
    // Person: vi plasserer først, skriver etterpå. Motsatt rekkefølge ville
    // tvunget deg til å huske hvor du skulle peke mens du fyller ut et skjema.
    setUtkast(p);
  };

  const lagrePlan = async () => {
    const neste = { ...blocking, planUrl: planFelt.trim() || null };
    const r = await roleCardService.saveBlocking(projectId, sceneId, neste);
    if ('error' in r) { setFeil(r.error); return; }
    setBlocking(r);
    setFeil(null);
  };

  const lagrePerson = async () => {
    if (!navn.trim() || !handling.trim() || !utkast) return;
    const r = await roleCardService.create(projectId, {
      person_name: navn.trim(),
      action: handling.trim(),
      cue: signal.trim() || null,
      person_kind: rolle,
      contact_email: epost.trim() || null,
      talent_id: valgtTalentId,
      position: utkast,
      scene_id: sceneId,
      production_day_id: productionDayId ?? null,
      sort_order: kort.length,
    });
    if ('error' in r) { setFeil(r.error); return; }
    setKort((prev) => [...prev, r]);
    setUtkast(null); setNavn(''); setHandling(''); setSignal(''); setEpost(''); setFeil(null);
    setValgtTalentId(null);
  };

  const slett = async (id: string) => {
    setKort((prev) => prev.filter((k) => k.id !== id));
    const r = await roleCardService.remove(projectId, id);
    if (!r.ok) { setFeil(r.error ?? 'Klarte ikke å slette'); void last(); }
  };

  const kopierLenke = async (token: string) => {
    const lenke = roleCardLink(token);
    try {
      await navigator.clipboard.writeText(lenke);
      setKopiert(token);
      window.setTimeout(() => setKopiert(null), 2000);
    } catch {
      // Utklippstavlen kan være sperret. Da er lenken fortsatt synlig i
      // feltet ved siden av, så dette er en beskjed, ikke en blindvei.
      setFeil('Kunne ikke kopiere automatisk — merk lenken og kopier den selv.');
    }
  };

  /**
   * Knytt en storyboard-ramme til personen.
   *
   * Bildet hentes FØRST her, ikke når listen tegnes: rammene ligger som
   * data-URL-er, og en scene med tjue rammer ville lastet tjue
   * fullstørrelses bilder for å vise en meny.
   */
  const velgRamme = async (kortId: string, ramme: StoryboardFrame) => {
    setVelgerRamme(null);
    const bilde = await roleCardService.frameImage(projectId, ramme.id);
    if (!bilde) { setFeil('Rammen har ikke bilde ennå.'); return; }
    const r = await roleCardService.update(projectId, kortId, { frame_image_url: bilde });
    if ('error' in r) { setFeil(r.error); return; }
    setKort((prev) => prev.map((k) => (k.id === kortId ? r : k)));
  };

  /**
   * Send lenkene. Uten adresse blir folk hoppet over, og det SKAL stå i
   * kvitteringen — ellers tror avsenderen at alle fikk beskjed.
   */
  const sendLenker = async (resend = false) => {
    setSender(true);
    setSendtMelding(null);
    const r = await roleCardService.send(projectId, sceneId, resend);
    setSender(false);
    if ('error' in r) { setFeil(r.error); return; }

    const uten = r.skipped.filter((s) => s.grunn === 'mangler_epost').length;
    const alt = r.skipped.filter((s) => s.grunn === 'alt_sendt').length;
    const deler = [`${r.sent} sendt`];
    if (alt) deler.push(`${alt} hadde fått den før`);
    if (uten) deler.push(`${uten} mangler e-post`);
    setSendtMelding(deler.join(' · '));
    void last();
  };

  const plassert = useMemo(() => kort.filter((k) => k.position), [kort]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" useFlexGap spacing={1.5}>
        <Box>
          <Typography sx={{ color: palette.textPrimary, fontWeight: 800, fontSize: '1.2rem' }}>
            Scenebygger{sceneTitle ? ` — ${sceneTitle}` : ''}
          </Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.9rem', mt: 0.3, maxWidth: '54ch' }}>
            Plasser kamera og folk. Hver person får et kort med sin egen lenke — de ser bare sitt eget.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.2} alignItems="center">
          <Chip
            label={`${kort.length} kort`}
            sx={{ bgcolor: 'rgba(75, 61, 143, 0.18)', color: palette.accentBright, fontWeight: 700 }}
          />
          <Button
            size="small"
            startIcon={<SendIcon />}
            disabled={sender || kort.length === 0}
            onClick={() => void sendLenker()}
            sx={{ textTransform: 'none', fontWeight: 700, px: 1.8, borderRadius: radius.sm, background: palette.accentGradient, color: '#fff' }}
          >
            {sender ? 'Sender…' : 'Send lenkene'}
          </Button>
        </Stack>
      </Stack>

      {feil && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setFeil(null)}>{feil}</Alert>}
      {sendtMelding && (
        <Alert
          severity="info"
          sx={{ mt: 2, bgcolor: 'rgba(75, 61, 143, 0.14)', color: palette.textSecondary, border: `1px solid ${palette.border}` }}
          onClose={() => setSendtMelding(null)}
          action={
            <Button size="small" onClick={() => void sendLenker(true)} sx={{ textTransform: 'none', color: palette.accentBright }}>
              Send på nytt til alle
            </Button>
          }
        >
          {sendtMelding}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 2.4, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 360px' }, mt: 2.4, alignItems: 'start' }}>
        <Box sx={kortSx}>
          {blocking.planUrl ? (
            <>
              <Stack direction="row" spacing={1} sx={{ mb: 1.6 }} flexWrap="wrap" useFlexGap>
                <Button
                  size="small"
                  startIcon={<PersonPinCircleIcon />}
                  onClick={() => setModus('person')}
                  sx={{
                    textTransform: 'none', fontWeight: 700, borderRadius: radius.sm, px: 1.6,
                    bgcolor: modus === 'person' ? palette.accent : 'transparent',
                    color: modus === 'person' ? '#fff' : palette.textSecondary,
                    border: `1px solid ${modus === 'person' ? palette.accent : palette.border}`,
                  }}
                >
                  Plasser person
                </Button>
                <Button
                  size="small"
                  startIcon={<VideocamIcon />}
                  onClick={() => setModus('kamera')}
                  sx={{
                    textTransform: 'none', fontWeight: 700, borderRadius: radius.sm, px: 1.6,
                    bgcolor: modus === 'kamera' ? palette.secondary : 'transparent',
                    color: modus === 'kamera' ? '#fff' : palette.textSecondary,
                    border: `1px solid ${modus === 'kamera' ? palette.secondary : palette.border}`,
                  }}
                >
                  Plasser kamera
                </Button>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', alignSelf: 'center' }}>
                  Klikk i planen der {modus === 'kamera' ? 'kameraet' : 'personen'} står.
                </Typography>
              </Stack>

              <Box
                ref={planRef}
                onClick={klikkPlan}
                data-testid="plantegning"
                sx={{ position: 'relative', cursor: 'crosshair', borderRadius: radius.md, overflow: 'hidden', border: `1px solid ${palette.border}` }}
              >
                <Box component="img" src={blocking.planUrl} alt="Plantegning" sx={{ width: '100%', display: 'block' }} />

                {blocking.camera && (
                  <Box
                    sx={{
                      position: 'absolute', left: `${blocking.camera.x * 100}%`, top: `${blocking.camera.y * 100}%`,
                      transform: 'translate(-50%, -50%)', px: 0.9, py: 0.35,
                      bgcolor: palette.secondary, borderRadius: radius.xs, color: '#fff',
                      fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em',
                    }}
                  >
                    KAMERA
                  </Box>
                )}

                {plassert.map((k) => (
                  <Box
                    key={k.id}
                    sx={{
                      position: 'absolute', left: `${k.position!.x * 100}%`, top: `${k.position!.y * 100}%`,
                      transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.3,
                    }}
                  >
                    <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: palette.accentBright, border: '2px solid #fff' }} />
                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#fff', textShadow: '0 1px 4px #000', whiteSpace: 'nowrap' }}>
                      {k.person_name}
                    </Typography>
                  </Box>
                ))}

                {utkast && (
                  <Box
                    sx={{
                      position: 'absolute', left: `${utkast.x * 100}%`, top: `${utkast.y * 100}%`,
                      transform: 'translate(-50%, -50%)', width: 16, height: 16, borderRadius: '50%',
                      border: `2px dashed ${palette.accentBright}`,
                    }}
                  />
                )}
              </Box>
            </>
          ) : (
            /* Uten plantegning er det ingenting å peke på. Da er det ene
               feltet som mangler det eneste som skal stå her. */
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography sx={{ color: palette.textPrimary, fontWeight: 700 }}>Legg inn plantegningen først</Typography>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.9rem', mt: 0.6, mb: 2, mx: 'auto', maxWidth: '40ch' }}>
                Et bilde av lokalet sett ovenfra. En skisse på servietten duger — poenget er at folk kjenner igjen rommet.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} justifyContent="center">
                <TextField
                  size="small"
                  label="Adresse til bildet"
                  value={planFelt}
                  onChange={(e) => setPlanFelt(e.target.value)}
                  sx={{ ...feltSx, minWidth: 280 }}
                />
                <Button
                  onClick={() => void lagrePlan()}
                  disabled={!planFelt.trim()}
                  sx={{ textTransform: 'none', fontWeight: 700, px: 2.4, borderRadius: radius.sm, background: palette.accentGradient, color: '#fff' }}
                >
                  Legg inn
                </Button>
              </Stack>
            </Box>
          )}
        </Box>

        <Box>
          {utkast && (
            <Box sx={{ ...kortSx, mb: 2, borderColor: palette.accent }}>
              <Typography sx={{ color: palette.accentBright, fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Ny person her
              </Typography>
              <Stack spacing={1.6} sx={{ mt: 1.4 }}>
                {kandidater.length > 0 && (
                  <TextField
                    size="small"
                    select
                    label="Hent fra produksjonen"
                    value=""
                    onChange={(e) => {
                      const k = kandidater.find((x) => x.id === e.target.value);
                      if (!k) return;
                      setNavn(k.name);
                      if (k.email) setEpost(k.email);
                      // Koblingen er hele poenget: med talent_id ser personen
                      // kortet når hen logger inn, uten å lete etter lenken.
                      setValgtTalentId(k.talent_id);
                    }}
                    sx={feltSx}
                    fullWidth
                    helperText="Fyller navn og e-post, og knytter kortet til profilen når personen har en."
                  >
                    {kandidater.map((k) => (
                      <MenuItem key={k.id} value={k.id}>
                        {k.name}{k.talent_id ? ' · har profil' : ''}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                <TextField size="small" label="Navn" value={navn} onChange={(e) => setNavn(e.target.value)} sx={feltSx} fullWidth />
                <TextField
                  size="small" select label="Rolle" value={rolle}
                  onChange={(e) => setRolle(e.target.value as RoleCard['person_kind'])} sx={feltSx} fullWidth
                >
                  <MenuItem value="extra">Statist</MenuItem>
                  <MenuItem value="actor">Skuespiller</MenuItem>
                  <MenuItem value="crew">Crew</MenuItem>
                </TextField>
                <TextField
                  size="small" label="Dette gjør du" value={handling} multiline minRows={2}
                  onChange={(e) => setHandling(e.target.value)} sx={feltSx} fullWidth
                  placeholder="Du sitter ved bord 3. Når servitøren går forbi, ser du opp og smiler — ikke mot kamera."
                  helperText="Én setning, i imperativ. Uten denne er kortet bare en callsheet."
                />
                <TextField
                  size="small" label="Signalet" value={signal} onChange={(e) => setSignal(e.target.value)} sx={feltSx} fullWidth
                  placeholder="Etter at hovedrollen tar første bit."
                />
                <TextField
                  size="small" label="E-post (valgfritt)" value={epost} onChange={(e) => setEpost(e.target.value)}
                  sx={feltSx} fullWidth type="email"
                  helperText="Uten adresse må lenken deles manuelt."
                />
                <Stack direction="row" spacing={1.2}>
                  <Button
                    onClick={() => void lagrePerson()}
                    disabled={!navn.trim() || !handling.trim()}
                    startIcon={<AddIcon />}
                    sx={{ textTransform: 'none', fontWeight: 700, px: 2.2, borderRadius: radius.sm, background: palette.accentGradient, color: '#fff' }}
                  >
                    Lag kort
                  </Button>
                  <Button onClick={() => setUtkast(null)} sx={{ textTransform: 'none', color: palette.textMuted }}>
                    Avbryt
                  </Button>
                </Stack>
              </Stack>
            </Box>
          )}

          {kort.length === 0 && !utkast ? (
            <Box sx={{ ...kortSx, textAlign: 'center', py: 3 }}>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.92rem', lineHeight: 1.6 }}>
                Ingen kort ennå. Klikk i plantegningen der første person står.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.4}>
              {kort.map((k) => (
                <Box key={k.id} sx={kortSx}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ color: palette.textPrimary, fontWeight: 700 }}>{k.person_name}</Typography>
                      <Typography sx={{ color: palette.textSecondary, fontSize: '0.86rem', mt: 0.3, lineHeight: 1.5 }}>
                        {k.action}
                      </Typography>
                      {k.cue && (
                        <Typography sx={{ color: palette.textMuted, fontSize: '0.8rem', mt: 0.4 }}>
                          Signal: {k.cue}
                        </Typography>
                      )}
                    </Box>
                    <Stack direction="row" spacing={0.6} sx={{ flexShrink: 0 }}>
                      <Tooltip title={k.frame_image_url ? 'Bytt ramme' : 'Velg ramme fra storyboard'}>
                        <IconButton
                          size="small"
                          onClick={() => setVelgerRamme(velgerRamme === k.id ? null : k.id)}
                          aria-label={`Velg ramme for ${k.person_name}`}
                          sx={{ color: k.frame_image_url ? palette.accentBright : palette.textMuted }}
                        >
                          <ImageIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={kopiert === k.token ? 'Kopiert' : 'Kopier lenken'}>
                        <IconButton size="small" onClick={() => void kopierLenke(k.token)} sx={{ color: kopiert === k.token ? palette.success : palette.textMuted }}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <IconButton size="small" onClick={() => void slett(k.id)} sx={{ color: palette.textMuted, '&:hover': { color: palette.danger } }}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                  {velgerRamme === k.id && (
                    <Box sx={{ mt: 1.4, pt: 1.4, borderTop: `1px solid ${palette.borderSubtle}` }}>
                      {rammer.length === 0 ? (
                        // Scenen har ingen storyboard-rammer ennå. Si det —
                        // en tom meny ser ut som en feil.
                        <Typography sx={{ color: palette.textMuted, fontSize: '0.84rem' }}>
                          Ingen storyboard-rammer i denne scenen ennå.
                        </Typography>
                      ) : (
                        <Stack spacing={0.6}>
                          {rammer.map((ramme) => (
                            <Button
                              key={ramme.id}
                              size="small"
                              disabled={!ramme.hasImage}
                              onClick={() => void velgRamme(k.id, ramme)}
                              sx={{
                                justifyContent: 'flex-start',
                                textTransform: 'none',
                                color: ramme.hasImage ? palette.textSecondary : palette.textMuted,
                              }}
                            >
                              {ramme.title || 'Uten tittel'}
                              {!ramme.hasImage && ' — ikke tegnet ennå'}
                            </Button>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  )}

                  {k.frame_image_url && (
                    <Box
                      component="img"
                      src={k.frame_image_url}
                      alt={`Rammen ${k.person_name} er med i`}
                      sx={{ width: '100%', mt: 1.2, borderRadius: radius.md, border: `1px solid ${palette.border}`, display: 'block' }}
                    />
                  )}

                  {!k.position && (
                    // Et kort uten posisjon virker, men mangler halve poenget.
                    <Typography sx={{ color: palette.warning, fontSize: '0.78rem', mt: 0.8 }}>
                      Ikke plassert i planen ennå.
                    </Typography>
                  )}

                  {/* Svaret er det innspillingslederen ringer rundt for å få.
                      Det står derfor over «åpnet»: at kortet er lest sier ikke
                      om personen kommer. */}
                  {k.response ? (
                    <Box sx={{ mt: 0.8 }}>
                      <Typography sx={{ color: k.response === 'kommer' ? palette.success : palette.warning, fontSize: '0.78rem', fontWeight: 700 }}>
                        {k.response === 'kommer' ? 'Kommer' : 'Kan ikke'}
                        {k.responded_at ? ` · ${tidspunkt(k.responded_at)}` : ''}
                      </Typography>
                      {k.response_note && (
                        <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mt: 0.2 }}>
                          «{k.response_note}»
                        </Typography>
                      )}
                    </Box>
                  ) : k.opened_at ? (
                    <Typography sx={{ color: palette.success, fontSize: '0.78rem', mt: 0.8 }}>
                      Åpnet {tidspunkt(k.opened_at)}
                    </Typography>
                  ) : k.sent_at ? (
                    <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mt: 0.8 }}>
                      Sendt {tidspunkt(k.sent_at)} · ikke åpnet ennå
                    </Typography>
                  ) : null}
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
}
