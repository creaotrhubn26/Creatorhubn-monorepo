/**
 * CandidateManagementGuide.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * In-app walkthrough guide for the Candidate Management Panel.
 *
 * Renders as a full-screen Dialog with a two-column layout:
 *   Left  — sticky step navigator (clickable)
 *   Right — scrollable content with screenshot placeholders
 *
 * 10 steps covering: overview, adding candidates, grid/table views,
 * AI match scoring, detail sidebar, favorites, 3D preview,
 * pool & import, workflow status, and keyboard shortcuts.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useRef, useCallback } from 'react';
import { useVisualEditor } from './admin/visual-editor/VisualEditorContext';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Divider,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Paper,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Image as ImageIcon,
  HelpOutline as HelpIcon,
  Videocam as VideoIcon,
  PersonAdd as PersonAddIcon,
  ViewModule as GridIcon,
  TableChart as TableIcon,
  EmojiEvents as ScoreIcon,
  Info as DetailIcon,
  Star as FavIcon,
  ViewInAr as PreviewIcon,
  Upload as PoolIcon,
  AutoFixHigh as IntelligenceIcon,
  Keyboard as KeyboardIcon,
  Search as SearchIcon,
  People as PeopleIcon,
} from '@mui/icons-material';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step {
  id: string;
  label: string;
  icon: React.ReactNode;
  sections: StepSection[];
}

interface StepSection {
  heading: string;
  body: React.ReactNode;
  screenshot?: string;
  screenshotLabel: string;
}

// ─── Screenshot Placeholder ───────────────────────────────────────────────────

function ScreenshotPlaceholder({ label }: { label: string }) {
  return (
    <Box
      sx={{
        width: '100%',
        minHeight: 200,
        border: '2px dashed rgba(255,255,255,0.12)',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        bgcolor: 'rgba(255,255,255,0.02)',
        my: 2,
        py: 3,
        cursor: 'default',
      }}
    >
      <ImageIcon sx={{ fontSize: 36, color: 'rgba(255,255,255,0.15)' }} />
      <Typography
        variant="caption"
        sx={{
          color: 'rgba(255,255,255,0.3)',
          fontSize: '0.72rem',
          fontStyle: 'italic',
          textAlign: 'center',
          px: 2,
        }}
      >
        📸 Screenshot placeholder — {label}
      </Typography>
    </Box>
  );
}

// ─── Video Placeholder ───────────────────────────────────────────────────────

function VideoPlaceholder({ label }: { label: string }) {
  return (
    <Box
      sx={{
        width: '100%',
        minHeight: 130,
        border: '2px dashed rgba(255,255,255,0.09)',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        bgcolor: 'rgba(255,255,255,0.01)',
        my: 1,
        py: 2.5,
        cursor: 'default',
      }}
    >
      <VideoIcon sx={{ fontSize: 30, color: 'rgba(255,255,255,0.12)' }} />
      <Typography
        variant="caption"
        sx={{
          color: 'rgba(255,255,255,0.25)',
          fontSize: '0.72rem',
          fontStyle: 'italic',
          textAlign: 'center',
          px: 2,
        }}
      >
        🎬 Video placeholder — {label}
      </Typography>
    </Box>
  );
}

// ─── Callout Box ─────────────────────────────────────────────────────────────

function Callout({
  color = '#10b981',
  children,
}: {
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        borderLeft: `3px solid ${color}`,
        bgcolor: `${color}12`,
        borderRadius: '0 8px 8px 0',
        px: 2,
        py: 1.25,
        my: 1.5,
      }}
    >
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', lineHeight: 1.6 }}>
        {children}
      </Typography>
    </Box>
  );
}

// ─── Inline Key ──────────────────────────────────────────────────────────────

function Key({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="kbd"
      sx={{
        display: 'inline-block',
        px: 0.75,
        py: 0.125,
        bgcolor: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: 0.75,
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        color: 'rgba(255,255,255,0.7)',
        lineHeight: 1.6,
        mx: 0.25,
      }}
    >
      {children}
    </Box>
  );
}

// ─── CTA Button ──────────────────────────────────────────────────────────────

function CtaButton({
  label,
  action,
  onAction,
  icon,
}: {
  label: string;
  action: string;
  onAction?: (action: string) => void;
  icon?: React.ReactNode;
}) {
  if (!onAction) return null;
  return (
    <Button
      size="small"
      variant="outlined"
      onClick={() => onAction(action)}
      startIcon={icon}
      sx={{
        mt: 1.5,
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.78rem',
        color: '#10b981',
        borderColor: 'rgba(16,185,129,0.4)',
        bgcolor: 'rgba(16,185,129,0.06)',
        '&:hover': {
          borderColor: '#10b981',
          bgcolor: 'rgba(16,185,129,0.14)',
        },
        borderRadius: 1.5,
        px: 2,
        py: 0.5,
      }}
    >
      {label}
    </Button>
  );
}

// ─── Accent colour ───────────────────────────────────────────────────────────

const ACCENT = '#10b981';

// ─── Step content ─────────────────────────────────────────────────────────────

function buildSteps(onAction?: (action: string) => void): Step[] {
return [
  // ── 1 · Overview ──────────────────────────────────────────────────────────
  {
    id: 'overview',
    label: 'Oversikt',
    icon: <HelpIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Hva er Kandidathåndtering?',
        screenshotLabel: 'Fullt panel — header, statistikk, kandidatkort',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              <strong>Kandidathåndtering</strong> er det sentrale stedet for å administrere
              alle kandidater i prosjektet ditt. Her kan du legge til, evaluere, score
              og organisere kandidater mot roller i produksjonen.
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
              Panelet tilbyr <strong>rutenett</strong> og <strong>tabell</strong>-visninger,
              <strong> AI-basert matching</strong> med Role Room Intelligence,
              en <strong>detaljsidebar</strong> med kandidatinnsikt og risikofaktorer,
              <strong> 3D-forhåndsvisning</strong>, <strong>kandidatpool</strong> for
              gjenbruk på tvers av prosjekter, og <strong>bulk-operasjoner</strong>.
            </Typography>
            <CtaButton label="Vis statistikkpanelet" action="toggle-stats" onAction={onAction} icon={<ScoreIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
      {
        heading: 'Paneloppsett',
        screenshotLabel: 'Header med tittel, visningsmod, og legg til-knapp',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1 }}>
              Panelet er organisert fra topp til bunn:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Headerrad</strong> — tittel, statistikk-toggle, visningsmod (rutenett/tabell), «Legg til kandidat»-knapp</li>
              <li><strong>Søk og filtre</strong> — tekstsøk, statusfilter, sortering</li>
              <li><strong>Statistikkpanel</strong> — kollapserbart panel med KPI-kort</li>
              <li><strong>Hovedinnhold</strong> — rutenett eller tabell av kandidatkort</li>
              <li><strong>Detaljsidebar</strong> — åpnes ved klikk, viser score, innsikt og arbeidsflyt</li>
              <li><strong>Bulk-handlingsbar</strong> — sticky bunn-bar ved merkede kandidater</li>
            </Box>
          </>
        ),
      },
    ],
  },

  // ── 2 · Adding candidates ─────────────────────────────────────────────────
  {
    id: 'adding-candidates',
    label: 'Legge til kandidater',
    icon: <PersonAddIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Opprette en ny kandidat',
        screenshotLabel: 'Opprett kandidat-dialog — skjemafelt',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Klikk den grønne <strong>«Legg til kandidat»</strong>-knappen for å åpne
              opprettelsesdialogen. Fyll inn:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Navn</strong> (påkrevd) — kandidatens fulle navn</li>
              <li><strong>E-post</strong> — kontakt-e-post</li>
              <li><strong>Telefon</strong> — mobilnummer</li>
              <li><strong>Bilder</strong> — last opp headshot-bilder</li>
              <li><strong>Videoer</strong> — audition-opptak</li>
              <li><strong>3D-modell</strong> — GLB-fil for virtuelt studio</li>
              <li><strong>Samtykke</strong> — GDPR-samtykke for bildebruk</li>
              <li><strong>Nødkontakt</strong> — kontaktperson for nødsituasjoner</li>
              <li><strong>Audition-notater</strong> — fri tekst for vurdering</li>
            </Box>
            <CtaButton label="Legg til en kandidat nå" action="open-add-dialog" onAction={onAction} icon={<PersonAddIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
      {
        heading: 'Redigering og duplisering',
        screenshotLabel: 'Redigerdialog med forhåndsutfylte felt, dupliser-knapp på kort',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Klikk <strong>redigeringsikonet</strong> på et kort eller en tabellrad for å
              gjenåpne dialogen med forhåndsutfylte data. Endringer lagres optimistisk —
              kortet oppdateres umiddelbart uten full sideoppdatering.
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
              <strong>Dupliser</strong>-knappen kloner en kandidat med ny ID og legger til
              «(kopi)» etter navnet.
            </Typography>
            <Callout>
              Samtykkefeltet markeres med en badge på kandidatkortet. Manglende samtykke
              vises som risikofaktor i detaljsidebaren.
            </Callout>
          </>
        ),
      },
    ],
  },

  // ── 3 · Grid & Table views ────────────────────────────────────────────────
  {
    id: 'views',
    label: 'Visninger',
    icon: <GridIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Rutenettvisning',
        screenshotLabel: 'Rutenett med kandidatkort — bilde, status, score-badge',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              <strong>Rutenettvisningen</strong> viser hver kandidat som et rikt kort med:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li>Headshot-bilde eller 3D-forhåndsvisning</li>
              <li>Status-badge (fargekoded)</li>
              <li>AI match-score percentage badge</li>
              <li>Samtykke-status badge</li>
              <li>Tildelte roller som chips</li>
              <li>Handlingsknapper: rediger, dupliser, slett, lagre til pool</li>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mt: 1.5 }}>
              Klikk på bildeområdet for å åpne <strong>detaljsidebaren</strong> med
              dypere innsikt om kandidaten.
            </Typography>
            <CtaButton label="Bytt til rutenettvisning" action="switch-grid" onAction={onAction} icon={<GridIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
      {
        heading: 'Tabellvisning',
        screenshotLabel: 'Tabell med kolonner — navn, status, kontakt, roller, AI score',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              <strong>Tabellvisningen</strong> gir en kompakt oversikt med sorterbare kolonner:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Fav</strong> — favorittmerking med stjerne</li>
              <li><strong>Bilde</strong> — avatar/headshot</li>
              <li><strong>Navn</strong> — sorterbart</li>
              <li><strong>Status</strong> — sorterbart, med fargekodet chip</li>
              <li><strong>Kontakt</strong> — e-post og telefon</li>
              <li><strong>Roller</strong> — sorterbart, viser tildelte roller</li>
              <li><strong>AI Score</strong> — match-prosentbadge</li>
              <li><strong>Handlinger</strong> — rediger, slett, pool, dupliser</li>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mt: 1.5 }}>
              Klikk på en rad for å åpne detaljsidebaren for den kandidaten.
            </Typography>
            <CtaButton label="Bytt til tabellvisning" action="switch-table" onAction={onAction} icon={<TableIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 4 · AI Match Scoring ──────────────────────────────────────────────────
  {
    id: 'ai-scoring',
    label: 'AI Match Score',
    icon: <ScoreIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Hvordan fungerer AI-scoren?',
        screenshotLabel: 'Score-badge på kort med 94% — fargekodet grønn',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Hver kandidat scorer automatisk mot sin tildelte rolle basert på seks faktorer:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Aldersfaktor</strong> (20%) — passer kandidaten rollens alderskrav?</li>
              <li><strong>Kjønnsfaktor</strong> (10%) — matcher kjønnspreferansene?</li>
              <li><strong>Ferdigheter</strong> (30%) — overlapper kandidatens ferdigheter med rollekravene?</li>
              <li><strong>Språk</strong> (15%) — dekker kandidaten nødvendige språk?</li>
              <li><strong>Lokasjon</strong> (10%) — er kandidaten i riktig område?</li>
              <li><strong>Erfaring</strong> (15%) — tidligere prestasjoner og audition-vurdering</li>
            </Box>
            <Callout>
              Scoren vises som en prosentbadge: <strong style={{ color: '#10b981' }}>85%+</strong> = grønn,
              <strong style={{ color: '#f59e0b' }}> 70–84%</strong> = gul,
              <strong style={{ color: '#f97316' }}> 50–69%</strong> = oransje,
              <strong style={{ color: '#ef4444' }}> under 50%</strong> = rød.
            </Callout>
            <CtaButton label="Sorter etter AI-score" action="sort-by-score" onAction={onAction} icon={<ScoreIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
      {
        heading: 'Intelligence-forsterket scoring',
        screenshotLabel: 'Detaljsidebar med lilla Intelligence-chip og boostgrunner',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Scoren kan <strong>forsterkes av Role Room Intelligence</strong> — en feedback-loop
              som lærer fra dine preferanser og beslutninger over tid.
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Intelligence-signaler som kan påvirke scoren (±20 poeng):
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Lærte preferanser</strong> — ferdigheter og egenskaper du foretrekker</li>
              <li><strong>Sjanger-affinitet</strong> — roller som matcher sjangrene du graviterer mot</li>
              <li><strong>Visuelle signaturer</strong> — kandidater som passer din visuelle stil</li>
              <li><strong>Crew-synergi</strong> — kandidater du har hatt godt samarbeid med før</li>
              <li><strong>Negative signaler</strong> — egenskaper du har lært å unngå</li>
            </Box>
            <Callout color="#a78bfa">
              Intelligence-boost vises som en lilla chip i detaljsidebaren med begrunnelse
              for hver justering. Denne funksjonen blir smartere jo mer du bruker systemet.
            </Callout>
            <CtaButton label="Vis Intelligence-detaljer" action="open-detail-first" onAction={onAction} icon={<IntelligenceIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 5 · Detail Sidebar ────────────────────────────────────────────────────
  {
    id: 'detail-sidebar',
    label: 'Detaljsidebar',
    icon: <DetailIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Åpne detaljsidebaren',
        screenshotLabel: 'Detaljsidebar — avatar, score, roller, status',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Klikk på et kandidatbilde (rutenett) eller en tabellrad for å åpne
              <strong> detaljsidebaren</strong> på høyre side. Sidebaren viser:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Avatar og navn</strong> med favoritt-toggle</li>
              <li><strong>AI Match Score</strong> med prosentgrad og matchnivå</li>
              <li><strong>Intelligence-boost</strong> med detaljer (når tilgjengelig)</li>
              <li><strong>Tildelte roller</strong> som fargekodede chips</li>
              <li><strong>Gjeldende status</strong></li>
              <li><strong>Kandidatinnsikt</strong> — positive observasjoner med stjerneikoner</li>
              <li><strong>Risikofaktorer</strong> — advarsler med varselmerke</li>
              <li><strong>Arbeidsflyt-sjekkliste</strong> — visuell pipeline-status</li>
              <li><strong>Hurtighandlinger</strong> — rediger og lagre til pool</li>
            </Box>
            <CtaButton label="Åpne detaljsidebaren" action="open-detail-first" onAction={onAction} icon={<DetailIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
      {
        heading: 'Kandidatinnsikt og risikofaktorer',
        screenshotLabel: 'Innsikt-liste med stjerneikoner og risikofaktorer med advarselmerke',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Systemet genererer automatisk <strong>innsikt</strong> basert på kandidatens data:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li>Sterk AI-match (≥85%)</li>
              <li>Tilgjengelige audition-notater, videoer, fotogalleri</li>
              <li>3D-modell klar for virtuelt studio</li>
              <li>Samtykke innhentet</li>
              <li>Intelligence-forsterket scoring</li>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mt: 1.5, mb: 1 }}>
              <strong>Risikofaktorer</strong> markeres automatisk:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li>Samtykke mangler</li>
              <li>E-post eller telefonnummer mangler</li>
              <li>Nødkontakt ikke registrert</li>
              <li>Lav AI-match score (&lt;50%)</li>
              <li>Ingen bilder lastet opp</li>
            </Box>
          </>
        ),
      },
    ],
  },

  // ── 6 · Search & Filters ──────────────────────────────────────────────────
  {
    id: 'search-filters',
    label: 'Søk og filtre',
    icon: <SearchIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Tekstsøk',
        screenshotLabel: 'Søkefelt med filterresultat — "3 av 12 kandidater"',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Bruk <strong>søkefeltet</strong> øverst for å finne kandidater etter:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li>Navn</li>
              <li>E-post</li>
              <li>Telefonnummer</li>
              <li>Audition-notater</li>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mt: 1.5 }}>
              Søket oppdateres i sanntid mens du skriver. En info-banner viser
              antall resultater vs. totalt antall kandidater.
            </Typography>
            <CtaButton label="Fokuser søkefeltet" action="focus-search" onAction={onAction} icon={<SearchIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
      {
        heading: 'Statusfilter og sortering',
        screenshotLabel: 'Dropdown-meny med statuser og sorteringsknapper',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Filtrer kandidater etter <strong>status</strong>:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li>Alle, Ny, Invitert, Evaluering, Callback, Kjemitesting, Valgt, På vent, Avvist</li>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mt: 1.5 }}>
              <strong>Sorter</strong> etter navn, status, eller roller — klikk tabellheaderne
              for å bytte mellom stigende/synkende.
            </Typography>
            <CtaButton label="Filtrer etter 'Evaluering'" action="filter-evaluating" onAction={onAction} icon={<SearchIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 7 · Favorites ─────────────────────────────────────────────────────────
  {
    id: 'favorites',
    label: 'Favoritter',
    icon: <FavIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Favorittmerking',
        screenshotLabel: 'Favorittstjerne på kort — gul vs. grå',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Merk kandidater som <strong>favoritter</strong> ved å klikke stjernen på
              kortet eller i tabellvisningen. Favoritter lagres per prosjekt og
              synkroniseres mellom enheter.
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
              Favoritt-status vises også i detaljsidebaren, der du kan toggle den
              med stjernen ved siden av kandidatnavnet.
            </Typography>
            <Callout>
              Favoritter lagres først i databasen via API. Hvis API-et er utilgjengelig,
              brukes en lokal cache via settingsService som synkroniseres senere.
            </Callout>
            <CtaButton label="Merk din første favoritt" action="toggle-favorite" onAction={onAction} icon={<FavIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 8 · 3D Preview & Scene ────────────────────────────────────────────────
  {
    id: '3d-preview',
    label: '3D-forhåndsvisning',
    icon: <PreviewIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Virtuelt studio med GLB-modeller',
        screenshotLabel: '3D-forhåndsvisning av kandidat med lyoppsett',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Kandidater med en <strong>3D-modell</strong> (GLB-fil) vises i en interaktiv
              forhåndsvisning direkte på kortet. Modellen roterer automatisk og kan
              tilpasses med lyoppsett.
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              <strong>Lyoppsett</strong> inkluderer forhåndsinnstillinger:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Rembrandt</strong> — klassisk portrettlys</li>
              <li><strong>Butterfly</strong> — beauty-belysning</li>
              <li><strong>Split</strong> — dramatisk halvsidelys</li>
              <li><strong>Loop</strong> — myk portrettbelysning</li>
              <li><strong>Clamshell</strong> — jevn beauty</li>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mt: 1.5 }}>
              Bruk dialogen <strong>«Forhåndsvis i scene»</strong> for å plassere
              flere kandidater i en virtuell scene og teste dem sammen — nyttig
              for kjemitesting.
            </Typography>
            <CtaButton label="Åpne scene-forhåndsvisning" action="open-preview-dialog" onAction={onAction} icon={<PreviewIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 9 · Pool & Import ─────────────────────────────────────────────────────
  {
    id: 'pool-import',
    label: 'Pool og import',
    icon: <PoolIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Kandidatpool',
        screenshotLabel: 'Pool-visning med kandidater fra andre prosjekter',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              <strong>Kandidatpoolen</strong> er en global samling av kandidater som kan
              gjenbrukes på tvers av prosjekter. Bytt mellom «Prosjekt»- og «Pool»-modus
              ved hjelp av toggle-knappene.
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1 }}>
              Poolhandlinger:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Lagre til pool</strong> — lagrer en prosjektkandidat globalt</li>
              <li><strong>Kopier til prosjekt</strong> — importer en poolkandidat til prosjektet</li>
              <li><strong>Importer CSV/JSON</strong> — massimport fra fil</li>
              <li><strong>Legg til manuelt</strong> — opprett nye poolkandidater direkte</li>
            </Box>
            <CtaButton label="Vis kandidatpoolen" action="switch-pool" onAction={onAction} icon={<PoolIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
      {
        heading: 'CSV/JSON-import',
        screenshotLabel: 'Import-dialog med filopplasting',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Importer kandidater i bulk via <strong>CSV</strong> eller <strong>JSON</strong>.
              Formatet forventer kolonner/felter for:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>name</strong> (påkrevd) — kandidatnavn</li>
              <li><strong>email</strong> — e-postadresse</li>
              <li><strong>phone</strong> — telefonnummer</li>
            </Box>
            <Callout>
              CSV-filer parses automatisk med semikolon eller komma som skilletegn.
              JSON-filer forventer en array av objekter.
            </Callout>
          </>
        ),
      },
    ],
  },

  // ── 10 · Workflow & Shortcuts ─────────────────────────────────────────────
  {
    id: 'workflow-shortcuts',
    label: 'Arbeidsflyt',
    icon: <KeyboardIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Arbeidsflytstatus',
        screenshotLabel: 'Arbeidsflyt-sjekkliste i sidebaren — visuell pipeline',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Hver kandidat følger en <strong>åttetrinns arbeidsflyt</strong>:
            </Typography>
            <Box component="ol" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Ny</strong> — kandidat opprettet</li>
              <li><strong>Invitert</strong> — invitasjon sendt</li>
              <li><strong>Evaluering</strong> — under vurdering</li>
              <li><strong>Callback</strong> — innkalt til ny audition</li>
              <li><strong>Kjemitesting</strong> — testes med andre kandidater</li>
              <li><strong>Valgt</strong> — godkjent for rollen</li>
              <li><strong>På vent</strong> — midlertidig parkert</li>
              <li><strong>Avvist</strong> — ikke aktuell</li>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mt: 1.5 }}>
              Arbeidsflyten visualiseres som en sjekkliste i detaljsidebaren med
              sirkler: <strong>✓</strong> = gjennomført, <strong>●</strong> = aktiv, <strong>○</strong> = kommende.
              Statusoverganger valideres av workflowEngine — ugyldige overganger
              blokkeres med forklaring.
            </Typography>
            <CtaButton label="Eksporter kandidater" action="export-csv" onAction={onAction} icon={<PoolIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
      {
        heading: 'Tastatursnarveier',
        screenshotLabel: 'Tastatursnarvei-referanse',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Effektive snarveier for rask navigering:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><Key>Ctrl</Key>+<Key>A</Key> — velg/avvelg alle kandidater</li>
              <li><Key>Delete</Key> — slett merkede kandidater</li>
              <li><Key>Escape</Key> — lukk aktiv dialog eller sidebar</li>
            </Box>
            <CtaButton label="Velg alle kandidater" action="select-all" onAction={onAction} icon={<PeopleIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },
];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface CandidateManagementGuideProps {
  open: boolean;
  onClose: () => void;
  /** If provided, the guide opens directly to this step. */
  initialStepId?: string;
  /** Called when the user clicks a "Try it now" CTA button inside a step. */
  onAction?: (action: string) => void;
}

export function CandidateManagementGuide({ open, onClose, initialStepId, onAction }: CandidateManagementGuideProps) {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));

  // ── Admin guide config ──────────────────────────────────────────────
  const { getGuideConfig, getStepOverride, getActiveStepIds } = useVisualEditor();
  const steps = buildSteps(onAction);
  const guideConfig  = getGuideConfig('candidate-management');
  const activeIds    = getActiveStepIds('candidate-management');
  const visibleSteps = activeIds.length > 0
    ? (activeIds.map(id => steps.find(s => s.id === id)).filter(Boolean) as Step[])
    : steps;

  const [activeStepId, setActiveStepId] = useState(initialStepId ?? visibleSteps[0].id);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const activeStep = visibleSteps.find((s) => s.id === activeStepId) ?? visibleSteps[0];
  const activeIdx  = visibleSteps.findIndex((s) => s.id === activeStepId);
  const stepOverride = getStepOverride('candidate-management', activeStep.id);

  const goPrev = useCallback(() => {
    if (activeIdx > 0) setActiveStepId(visibleSteps[activeIdx - 1].id);
  }, [activeIdx, visibleSteps]);

  const goNext = useCallback(() => {
    if (activeIdx < visibleSteps.length - 1) setActiveStepId(visibleSteps[activeIdx + 1].id);
  }, [activeIdx, visibleSteps]);

  const handleStepSelect = useCallback((id: string) => {
    setActiveStepId(id);
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const accentColor = guideConfig.accentColorOverride ?? ACCENT;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isNarrow}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#12121e',
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: isNarrow ? 0 : 2,
          height: isNarrow ? '100dvh' : '88vh',
          maxHeight: '88vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* ── Header ── */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 3,
          py: 1.5,
          flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          gap: 1.5,
        }}
      >
        <PeopleIcon sx={{ color: accentColor, fontSize: 20 }} />
        <Typography variant="h6" sx={{ flex: 1, fontWeight: 700, fontSize: '1rem', color: 'rgba(255,255,255,0.92)' }}>
          Guide — Kandidathåndtering
        </Typography>
        <Chip
          label={`${activeIdx + 1} / ${visibleSteps.length}`}
          size="small"
          sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: '0.7rem', height: 22 }}
        />
        <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff' } }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      {/* ── Body (sidebar + content) ── */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar nav (hidden on mobile) */}
        {!isNarrow && (
          <Box
            sx={{
              width: 210,
              flexShrink: 0,
              borderRight: '1px solid rgba(255,255,255,0.07)',
              overflowY: 'auto',
              py: 1.5,
              '&::-webkit-scrollbar': { width: 3 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 },
            }}
          >
            <List dense disablePadding>
              {visibleSteps.map((step, i) => {
                const ov = getStepOverride('candidate-management', step.id);
                const isActive = step.id === activeStepId;
                return (
                  <ListItemButton
                    key={step.id}
                    selected={isActive}
                    onClick={() => handleStepSelect(step.id)}
                    sx={{
                      px: 2,
                      py: 0.75,
                      gap: 1,
                      bgcolor: isActive ? `${accentColor}12` : 'transparent',
                      borderLeft: isActive ? `3px solid ${accentColor}` : '3px solid transparent',
                      '&:hover': { bgcolor: `${accentColor}08` },
                    }}
                  >
                    <Box
                      sx={{
                        width: 22,
                        height: 22,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        bgcolor: isActive ? `${accentColor}22` : i < activeIdx ? '#22c55e14' : 'rgba(255,255,255,0.04)',
                        color: isActive ? accentColor : i < activeIdx ? '#22c55e' : 'rgba(255,255,255,0.3)',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {step.icon}
                    </Box>
                    <ListItemText
                      primary={ov.labelOverride ?? step.label}
                      primaryTypographyProps={{
                        sx: {
                          fontSize: '0.78rem',
                          fontWeight: isActive ? 700 : 400,
                          color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)',
                          lineHeight: 1.3,
                        },
                      }}
                    />
                    {ov.badge && (
                      <Box component="span" sx={{ ml: 0.5, px: 0.5, py: 0.125, bgcolor: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44`, borderRadius: 0.5, fontSize: '0.55rem', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {ov.badge}
                      </Box>
                    )}
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        )}

        {/* Content */}
        <DialogContent
          ref={contentRef}
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: { xs: 2.5, md: 4 },
            py: 3,
            '&.MuiDialogContent-root': { p: 0 },
          }}
        >
          {/* Step heading */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, pt: 3, px: { xs: 2.5, md: 4 } }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: `${accentColor}22`,
                border: `1px solid ${accentColor}44`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accentColor,
                flexShrink: 0,
              }}
            >
              {activeStep.icon}
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem', color: 'rgba(255,255,255,0.92)' }}>
              {activeStep.label}
            </Typography>
          </Box>

          {/* Sections */}
          <Box sx={{ px: { xs: 2.5, md: 4 }, pb: 3 }}>
            {activeStep.sections.map((section, sIdx) => (
              <Box key={sIdx} sx={{ mb: 4 }}>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    color: 'rgba(255,255,255,0.85)',
                    mb: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Box component="span" sx={{ display: 'inline-block', width: 4, height: 14, bgcolor: accentColor, borderRadius: 1, flexShrink: 0 }} />
                  {section.heading}
                </Typography>

                {section.body}

                {stepOverride.videoUrl ? (
                  <Box component="video" src={stepOverride.videoUrl} controls
                    sx={{ width: '100%', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', mt: 1.5, display: 'block' }} />
                ) : stepOverride.screenshotUrl ? (
                  <Box
                    component="img"
                    src={stepOverride.screenshotUrl}
                    alt={section.screenshotLabel}
                    sx={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', mt: 1.5 }}
                  />
                ) : (
                  <>
                    <ScreenshotPlaceholder label={section.screenshotLabel} />
                    <VideoPlaceholder label={section.screenshotLabel} />
                  </>
                )}

                {sIdx < activeStep.sections.length - 1 && (
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mt: 3 }} />
                )}
              </Box>
            ))}
          </Box>

          {/* Admin note from Guide Editor */}
          {stepOverride.adminNote && (
            <Box sx={{ mx: { xs: 2.5, md: 4 }, mt: 1.5, mb: 2, p: 1.5, borderLeft: `3px solid ${stepOverride.adminNoteColor ?? '#f59e0b'}`, bgcolor: `${stepOverride.adminNoteColor ?? '#f59e0b'}14`, borderRadius: '0 8px 8px 0' }}>
              <Typography variant="caption" sx={{ color: stepOverride.adminNoteColor ?? '#f59e0b', fontWeight: 700, display: 'block', fontSize: '0.7rem', mb: 0.5 }}>Merknad</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {stepOverride.adminNote}
              </Typography>
            </Box>
          )}

          {/* Mobile step nav */}
          {isNarrow && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 2, px: 2.5 }}>
              {visibleSteps.map((s, i) => {
                const ov = getStepOverride('candidate-management', s.id);
                return (
                  <Chip
                    key={s.id}
                    label={ov.labelOverride ?? s.label}
                    size="small"
                    clickable
                    onClick={() => handleStepSelect(s.id)}
                    sx={{
                      height: 24,
                      fontSize: '0.68rem',
                      ...(s.id === activeStepId
                        ? { bgcolor: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44` }
                        : i < activeIdx
                        ? { bgcolor: '#22c55e14', color: '#22c55e' }
                        : { bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)' }),
                    }}
                  />
                );
              })}
            </Box>
          )}
        </DialogContent>
      </Box>

      {/* ── Footer nav ── */}
      <DialogActions
        sx={{
          flexShrink: 0,
          px: 3,
          py: 1.5,
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          justifyContent: 'flex-start',
        }}
      >
        {/* Step dots */}
        <Box sx={{ flex: 1, display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {visibleSteps.map((s, i) => (
            <Tooltip key={s.id} title={s.label}>
              <Box
                onClick={() => handleStepSelect(s.id)}
                sx={{
                  width: i === activeIdx ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  bgcolor: i === activeIdx ? accentColor : i < activeIdx ? '#22c55e' : 'rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  transition: 'width 0.2s, background-color 0.2s',
                  '&:hover': { bgcolor: i === activeIdx ? accentColor : 'rgba(255,255,255,0.35)' },
                }}
              />
            </Tooltip>
          ))}
        </Box>

        <Paper elevation={0} sx={{ display: 'flex', gap: 1, bgcolor: 'transparent' }}>
          <Button
            size="small"
            disabled={activeIdx === 0}
            onClick={goPrev}
            sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}
          >
            ← Forrige
          </Button>

          {activeIdx < visibleSteps.length - 1 ? (
            <Button
              size="small"
              variant="contained"
              onClick={goNext}
              sx={{
                bgcolor: accentColor,
                '&:hover': { bgcolor: '#059669' },
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.78rem',
                px: 2,
              }}
            >
              Neste →
            </Button>
          ) : (
            <Button
              size="small"
              variant="contained"
              onClick={onClose}
              sx={{
                bgcolor: '#22c55e',
                '&:hover': { bgcolor: '#16a34a' },
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.78rem',
                px: 2,
              }}
            >
              Ferdig ✓
            </Button>
          )}
        </Paper>
      </DialogActions>
    </Dialog>
  );
}
