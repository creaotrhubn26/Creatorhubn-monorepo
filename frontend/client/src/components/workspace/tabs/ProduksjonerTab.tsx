// @ts-nocheck
/**
 * ProduksjonerTab — produksjonens fase, og hvem som får vite.
 *
 * Én flate for to lesere, fordi det er samme sak sett fra hver sin side:
 *
 *   produsenten   flytter prosjektet mellom fasene, og velger om det skal
 *                 annonseres. Annonsering er av som standard: mange
 *                 produksjoner er under NDA lenge etter at de er reelle.
 *   skuespilleren ser hva som er på vei, og velger om hen vil ha beskjed når
 *                 noe går fra utvikling til pre-produksjon.
 *
 * Den overgangen er hele poenget. I utvikling finnes prosjektet på papir; i
 * pre-produksjon begynner casting og opptaksplan å bli virkelige, og oppdager
 * du det tilfeldig er det som regel for sent.
 *
 * Kilde vises per rad fordi den blir flere enn plattformen: NFI-tildelinger og
 * forbundene er neste, og da skal ikke listen se annerledes ut.
 */
import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Button, Switch, FormControlLabel, CircularProgress, Link } from '@mui/material';
import CampaignIcon from '@mui/icons-material/CampaignOutlined';
import NotificationsIcon from '@mui/icons-material/NotificationsActiveOutlined';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsTag } from '../ui';

const FASER = [
  { key: 'utvikling', label: 'Utvikling', hjelp: 'Prosjektet finnes på papir.' },
  { key: 'pre_produksjon', label: 'Pre-produksjon', hjelp: 'Casting, opptaksplan, avtaler.' },
  { key: 'opptak', label: 'Opptak', hjelp: 'Kamera går.' },
  { key: 'etterarbeid', label: 'Etterarbeid', hjelp: 'Klipp, lyd, farge.' },
  { key: 'ferdig', label: 'Ferdig', hjelp: 'Levert.' },
];

const faseLabel = (k) => FASER.find((f) => f.key === k)?.label ?? 'Ikke satt';

export default function ProduksjonerTab({ projectId, readOnly = false }) {
  const [fase, setFase] = useState(null);
  const [annonsert, setAnnonsert] = useState(false);
  const [lagrer, setLagrer] = useState(null);
  const [kvittering, setKvittering] = useState(null);
  const [feil, setFeil] = useState(null);

  const [påVei, setPåVei] = useState([]);
  const [interesserte, setInteresserte] = useState([]);
  const [melderId, setMelderId] = useState(null);
  const [varsel, setVarsel] = useState({ aktiv: false, prosjekttyper: [] });
  const [laster, setLaster] = useState(true);

  useEffect(() => {
    let avbrutt = false;
    (async () => {
      try {
        const [liste, mitt, meldt] = await Promise.all([
          apiRequest('/api/role-room/produksjoner/pa-vei').catch(() => ({ produksjoner: [] })),
          apiRequest('/api/role-room/talents/me/produksjonsvarsel').catch(() => null),
          // Produsentsiden: hvem har meldt seg på nettopp dette prosjektet.
          apiRequest(`/api/role-room/projects/${projectId}/interesse`).catch(() => ({ interesserte: [] })),
        ]);
        if (avbrutt) return;
        setPåVei(liste?.produksjoner ?? []);
        setInteresserte(meldt?.interesserte ?? []);
        if (mitt) setVarsel(mitt);
        // Fasen til DETTE prosjektet leses fra listen når den er annonsert;
        // ellers står den som «ikke satt» til produsenten velger.
        const eget = (liste?.produksjoner ?? []).find((p) => p.id === projectId);
        if (eget) { setFase(eget.phase); setAnnonsert(Boolean(eget.announced_at)); }
      } finally {
        if (!avbrutt) setLaster(false);
      }
    })();
    return () => { avbrutt = true; };
  }, [projectId]);

  const settFase = async (nyFase, annonserNå = annonsert) => {
    setLagrer(nyFase);
    setFeil(null);
    setKvittering(null);
    try {
      const r = await apiRequest(`/api/role-room/projects/${projectId}/fase`, {
        method: 'PUT',
        body: JSON.stringify({ fase: nyFase, annonser: annonserNå }),
      });
      setFase(r?.prosjekt?.phase ?? nyFase);
      setAnnonsert(Boolean(r?.prosjekt?.announced_at));
      // Si hva som FAKTISK skjedde. «Lagret» sier ikke om noen fikk beskjed.
      if (r?.varsel) {
        setKvittering(
          r.varsel.sendt === 0 && r.varsel.hoppet === 0
            ? 'Ingen hadde bedt om varsel ennå.'
            : `${r.varsel.sendt} skuespiller${r.varsel.sendt === 1 ? '' : 'e'} varslet${r.varsel.hoppet ? ` · ${r.varsel.hoppet} feilet` : ''}.`,
        );
      }
    } catch (e) {
      setFeil(e?.message || 'Klarte ikke å lagre fasen');
    } finally {
      setLagrer(null);
    }
  };

  const settVarsel = async (aktiv) => {
    setVarsel((v) => ({ ...v, aktiv }));
    try {
      const r = await apiRequest('/api/role-room/talents/me/produksjonsvarsel', {
        method: 'PUT',
        body: JSON.stringify({ aktiv, prosjekttyper: varsel.prosjekttyper ?? [] }),
      });
      setVarsel(r);
    } catch {
      // Tilbake til det som faktisk gjelder: en bryter som lyver er verre enn
      // en som ikke virker.
      setVarsel((v) => ({ ...v, aktiv: !aktiv }));
      setFeil('Klarte ikke å lagre varselvalget. Prøv igjen.');
    }
  };

  const meldInteresse = async (p, meld) => {
    setMelderId(p.id);
    setFeil(null);
    try {
      const sti = `/api/role-room/produksjoner/${p.id}/interesse`;
      if (meld) await apiRequest(sti, { method: 'POST', body: JSON.stringify({}) });
      else await apiRequest(sti, { method: 'DELETE' });
      // Oppdater raden i listen framfor å hente alt på nytt: svaret skal komme
      // med en gang, ikke etter en ny runde mot serveren.
      setPåVei((rader) => rader.map((r) => (r.id === p.id
        ? { ...r, interesse_meldt: meld ? new Date().toISOString() : null,
            interesserte: Math.max(0, (r.interesserte ?? 0) + (meld ? 1 : -1)) }
        : r)));
    } catch (e) {
      setFeil(e?.message || 'Klarte ikke å lagre interessen');
    } finally {
      setMelderId(null);
    }
  };

  if (laster) {
    return (
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 3 }}>
        <CircularProgress size={18} sx={{ color: ws.accent }} />
        <Typography sx={{ color: ws.textDim }}>Henter produksjonene …</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={2.4} sx={{ maxWidth: 900 }}>
      {!readOnly && (
        <WsCard>
          <Typography sx={{ color: ws.text, fontWeight: 800, fontSize: '1.02rem' }}>Hvor er produksjonen?</Typography>
          <Typography sx={{ color: ws.textDim, fontSize: '0.9rem', mt: 0.4, maxWidth: '62ch' }}>
            Fasen styrer hva som vises for andre. Skuespillere som har bedt om det, får beskjed når en
            <strong> annonsert </strong> produksjon går inn i pre-produksjon — én gang, ikke hver gang du lagrer.
          </Typography>

          <Stack direction="row" spacing={1} sx={{ mt: 1.6, flexWrap: 'wrap', gap: 1 }}>
            {FASER.map((f) => (
              <Button
                key={f.key}
                disabled={lagrer !== null}
                onClick={() => void settFase(f.key)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: 2,
                  px: 1.8,
                  border: `1px solid ${fase === f.key ? ws.accent : ws.border}`,
                  bgcolor: fase === f.key ? 'rgba(75,61,143,0.18)' : 'transparent',
                  color: fase === f.key ? ws.text : ws.textDim,
                }}
              >
                {f.label}
              </Button>
            ))}
          </Stack>
          <Typography sx={{ color: ws.textDim, fontSize: '0.82rem', mt: 0.8 }}>
            {FASER.find((f) => f.key === fase)?.hjelp ?? 'Velg fasen produksjonen er i nå.'}
          </Typography>

          <FormControlLabel
            sx={{ mt: 1.4, color: ws.textDim }}
            control={
              <Switch
                checked={annonsert}
                disabled={lagrer !== null}
                onChange={(e) => { setAnnonsert(e.target.checked); void settFase(fase ?? 'utvikling', e.target.checked); }}
              />
            }
            label={
              <Stack direction="row" spacing={0.8} alignItems="center">
                <CampaignIcon sx={{ fontSize: 18, color: annonsert ? ws.accent : ws.textDim }} />
                <Typography sx={{ fontSize: '0.92rem' }}>
                  {annonsert ? 'Annonsert — synlig for skuespillere' : 'Ikke annonsert — bare teamet ser den'}
                </Typography>
              </Stack>
            }
          />

          {kvittering && (
            <Typography sx={{ color: ws.accent, fontSize: '0.88rem', mt: 1 }}>{kvittering}</Typography>
          )}
          {feil && (
            <Typography sx={{ color: '#ef4444', fontSize: '0.88rem', mt: 1 }}>{feil}</Typography>
          )}
        </WsCard>
      )}

      {!readOnly && interesserte.length > 0 && (
        <WsCard>
          <Typography sx={{ color: ws.text, fontWeight: 800, fontSize: '1.02rem' }}>
            Meldt interesse for denne produksjonen
          </Typography>
          <Typography sx={{ color: ws.textDim, fontSize: '0.9rem', mt: 0.4, maxWidth: '58ch' }}>
            Skuespillere som selv har sagt fra at de vil være med. De som har trukket seg står nederst —
            at noen meldte seg og ombestemte seg er også informasjon.
          </Typography>
          <Stack spacing={1.2} sx={{ mt: 1.6 }}>
            {interesserte.map((i) => (
              <Box
                key={i.id}
                sx={{
                  border: `1px solid ${ws.border}`,
                  borderRadius: 2,
                  p: 1.4,
                  opacity: i.withdrawn_at ? 0.55 : 1,
                }}
              >
                <Stack direction="row" spacing={1.4} alignItems="center">
                  {i.headshot_url && (
                    <Box
                      component="img"
                      src={i.headshot_url}
                      alt=""
                      sx={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  )}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ color: ws.text, fontWeight: 700 }}>
                      {i.display_name}
                      {i.withdrawn_at ? ' — trakk seg' : ''}
                    </Typography>
                    <Typography sx={{ color: ws.textDim, fontSize: '0.84rem' }}>
                      {[i.city, i.playing_age_min && i.playing_age_max ? `spiller ${i.playing_age_min}–${i.playing_age_max}` : null]
                        .filter(Boolean)
                        .join(' · ') || 'Ingen detaljer i profilen ennå'}
                    </Typography>
                    {i.melding && (
                      <Typography sx={{ color: ws.textDim, fontSize: '0.84rem', mt: 0.4 }}>
                        «{i.melding}»
                      </Typography>
                    )}
                  </Box>
                  {i.showreel_url && (
                    <Link href={i.showreel_url} target="_blank" rel="noopener noreferrer" sx={{ color: ws.accent, fontSize: '0.84rem' }}>
                      Showreel
                    </Link>
                  )}
                </Stack>
              </Box>
            ))}
          </Stack>
        </WsCard>
      )}

      <WsCard>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box>
            <Typography sx={{ color: ws.text, fontWeight: 800, fontSize: '1.02rem' }}>Produksjoner på vei</Typography>
            <Typography sx={{ color: ws.textDim, fontSize: '0.9rem', mt: 0.4, maxWidth: '58ch' }}>
              Annonserte produksjoner i pre-produksjon eller opptak. Uannonserte står ikke her, uansett fase.
            </Typography>
          </Box>
          <FormControlLabel
            sx={{ color: ws.textDim, m: 0 }}
            control={<Switch checked={Boolean(varsel.aktiv)} onChange={(e) => void settVarsel(e.target.checked)} />}
            label={
              <Stack direction="row" spacing={0.6} alignItems="center">
                <NotificationsIcon sx={{ fontSize: 18, color: varsel.aktiv ? ws.accent : ws.textDim }} />
                <Typography sx={{ fontSize: '0.88rem' }}>Varsle meg</Typography>
              </Stack>
            }
          />
        </Stack>

        {påVei.length === 0 ? (
          // Tom liste er den vanlige tilstanden i starten. Si hva som skal til
          // for at noe dukker opp, i stedet for å vise en tom ramme.
          <Typography sx={{ color: ws.textDim, fontSize: '0.92rem', mt: 2 }}>
            Ingen annonserte produksjoner ennå. De dukker opp her når en produsent setter fasen til
            pre-produksjon og velger å annonsere.
          </Typography>
        ) : (
          <Stack spacing={1.2} sx={{ mt: 2 }}>
            {påVei.map((p) => (
              <Box key={p.id} sx={{ border: `1px solid ${ws.border}`, borderRadius: 2, p: 1.6 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Typography sx={{ color: ws.text, fontWeight: 700 }}>{p.name}</Typography>
                  <WsTag tone={p.phase === 'pre_produksjon' ? 'green' : 'neutral'} label={p.fase_navn ?? faseLabel(p.phase)} />
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  {/* Veien videre fra varselet. Uten den fikk skuespilleren bare
                      vite at noe skjer. */}
                  <Button
                    size="small"
                    disabled={melderId === p.id}
                    onClick={() => void meldInteresse(p, !p.interesse_meldt)}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 2,
                      px: 1.6,
                      border: `1px solid ${p.interesse_meldt ? ws.green : ws.border}`,
                      bgcolor: p.interesse_meldt ? 'rgba(52,211,153,0.14)' : 'transparent',
                      color: p.interesse_meldt ? ws.green : ws.textDim,
                    }}
                  >
                    {p.interesse_meldt ? 'Du har meldt interesse' : 'Jeg er interessert'}
                  </Button>
                  {p.interesse_meldt && (
                    <Typography sx={{ color: ws.textDim, fontSize: '0.82rem' }}>
                      Trykk igjen for å trekke deg
                    </Typography>
                  )}
                  {(p.interesserte ?? 0) > 0 && !p.interesse_meldt && (
                    <Typography sx={{ color: ws.textDim, fontSize: '0.82rem' }}>
                      {p.interesserte} har meldt seg
                    </Typography>
                  )}
                </Stack>
                <Stack direction="row" spacing={1.2} sx={{ mt: 0.6, flexWrap: 'wrap' }}>
                  {p.project_type && (
                    <Typography sx={{ color: ws.textDim, fontSize: '0.84rem' }}>{p.project_type}</Typography>
                  )}
                  {p.phase_changed_at && (
                    <Typography sx={{ color: ws.textDim, fontSize: '0.84rem' }}>
                      Siden {new Date(p.phase_changed_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                    </Typography>
                  )}
                  {/* Kilden blir flere enn plattformen. Å vise den nå betyr at
                      listen ikke må bygges om når NFI og forbundene kobles på. */}
                  <Typography sx={{ color: ws.textDim, fontSize: '0.84rem' }}>
                    {p.kilde === 'nfi' ? 'NFI-tildeling' : p.kilde === 'forbund' ? 'Forbund' : 'The Role Room'}
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </WsCard>
    </Stack>
  );
}
