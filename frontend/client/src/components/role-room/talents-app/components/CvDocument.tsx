/**
 * CvDocument.tsx — CV-en slik den ser ut på papir.
 *
 * Én kilde til sannhet: det samme dokumentet vises i forhåndsvisningen og
 * sendes til utskrift. Et eget print-oppsett ved siden av et preview-oppsett
 * ville drevet fra hverandre, og da er forhåndsvisningen verre enn ingen —
 * den lover noe annet enn PDF-en byrået får.
 *
 * Bevisst lys: dette er et dokument, ikke en flate i appen. Kontrasten mot
 * det mørke grensesnittet er hele poenget — du ser at du holder på å lage
 * noe som skal ut av systemet.
 */

import { Box } from '@mui/material';
import { forwardRef } from 'react';

import type { RoleRoomTalent, TalentCredit } from '../../services/roleRoomTalentsService';

const CATEGORY_LABEL: Record<string, string> = {
  film_tv: 'Film & TV',
  theatre: 'Teater',
  commercial: 'Reklame',
  voice: 'Stemme',
  other: 'Annet',
};

const ROLE_TYPE_LABEL: Record<string, string> = {
  lead: 'Hovedrolle',
  supporting: 'Birolle',
  featured: 'Medvirkende',
  ensemble: 'Ensemble',
  voice: 'Stemme',
  extra: 'Statist',
};

const ORDER = ['film_tv', 'theatre', 'commercial', 'voice', 'other'];

export interface CvDocumentProps {
  talent: RoleRoomTalent | null;
  credits: TalentCredit[];
  /** Av som standard ved deling: en PDF havner hos folk du aldri ga den til. */
  includeContact: boolean;
}

/** Fysiske trekk som hører hjemme på en casting-CV, i den rekkefølgen de leses. */
function physicalLine(talent: RoleRoomTalent | null): string {
  if (!talent) return '';
  const parts: string[] = [];
  if (talent.height_cm) parts.push(`${talent.height_cm} cm`);
  if (talent.hair_color) parts.push(`${talent.hair_color.toLowerCase()} hår`);
  if (talent.eye_color) parts.push(`${talent.eye_color.toLowerCase()} øyne`);
  if (talent.playing_age_min && talent.playing_age_max) {
    parts.push(`spillealder ${talent.playing_age_min}–${talent.playing_age_max}`);
  }
  return parts.join(' · ');
}

const CvDocument = forwardRef<HTMLDivElement, CvDocumentProps>(function CvDocument(
  { talent, credits, includeContact },
  ref,
) {
  const grouped = ORDER
    .map((id) => ({ id, rows: credits.filter((c) => c.category === id) }))
    .filter((g) => g.rows.length > 0);

  const physical = physicalLine(talent);
  const languages = (talent?.languages ?? []).map((l) => l.label).join(', ');
  const dialects = (talent?.dialects ?? []).join(', ');
  const skills = (talent?.skills ?? []).map((s) => s.label).join(', ');

  return (
    <Box
      ref={ref}
      className="cv-document"
      sx={{
        bgcolor: '#f7f4ee',
        color: '#17141b',
        p: { xs: 2.6, sm: 3.2 },
        borderRadius: '4px',
        fontFamily: 'Georgia, "Times New Roman", serif',
        boxShadow: '0 18px 44px rgba(0,0,0,0.42)',
        lineHeight: 1.5,
        '& h1': {
          margin: 0,
          fontSize: '1.42rem',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          fontWeight: 600,
        },
        '& .subtitle': {
          margin: '3px 0 0',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '0.62rem',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: '#55505c',
        },
        '& .facts': {
          margin: '10px 0 0',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '0.72rem',
          color: '#55505c',
          lineHeight: 1.75,
        },
        '& h2': {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '0.6rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#55505c',
          borderBottom: '1px solid #ddd7cc',
          paddingBottom: '5px',
          margin: '18px 0 9px',
          fontWeight: 600,
        },
        '& .row': {
          display: 'grid',
          gridTemplateColumns: '46px 1fr',
          gap: '10px',
          fontSize: '0.82rem',
          padding: '3px 0',
        },
        '& .year': {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '0.68rem',
          color: '#55505c',
          paddingTop: '2px',
          fontVariantNumeric: 'tabular-nums',
        },
        '& .dim': { color: '#55505c' },
        '& .bio': { fontSize: '0.82rem', margin: 0 },
      }}
    >
      <h1>{talent?.display_name || 'Navn mangler'}</h1>
      <p className="subtitle">Skuespiller</p>

      <p className="facts">
        {[talent?.city, talent?.country].filter(Boolean).join(', ') || 'Sted ikke satt'}
        {includeContact && talent?.email ? ` · ${talent.email}` : ''}
        {includeContact && talent?.phone ? ` · ${talent.phone}` : ''}
        {!includeContact ? ' · kontakt via The Role Room' : ''}
        {physical ? <><br />{physical}</> : null}
        {talent?.identity_verified ? <><br />Identitet verifisert med BankID</> : null}
      </p>

      {grouped.length === 0 && (
        <>
          <h2>Erfaring</h2>
          <p className="bio dim">Legg til din første rolle, så fylles arket ut her.</p>
        </>
      )}

      {grouped.map((group) => (
        <div key={group.id}>
          <h2>{CATEGORY_LABEL[group.id] ?? group.id}</h2>
          {group.rows.map((credit) => {
            const role = [credit.role_name, credit.role_type ? ROLE_TYPE_LABEL[credit.role_type] : null]
              .filter(Boolean)
              .join(' — ');
            const where = [credit.production_company, credit.director ? `regi ${credit.director}` : null]
              .filter(Boolean)
              .join(' · ');
            return (
              <div className="row" key={credit.id}>
                <span className="year">{credit.year ?? ''}</span>
                <span>
                  {role || credit.title}
                  {role ? <span className="dim"> · {credit.title}</span> : null}
                  {where ? <span className="dim"> · {where}</span> : null}
                </span>
              </div>
            );
          })}
        </div>
      ))}

      {(languages || dialects || skills) && (
        <>
          <h2>Ferdigheter</h2>
          {languages && <div className="row"><span className="year dim">Språk</span><span>{languages}</span></div>}
          {dialects && <div className="row"><span className="year dim">Dialekt</span><span>{dialects}</span></div>}
          {skills && <div className="row"><span className="year dim">Annet</span><span>{skills}</span></div>}
        </>
      )}

      {talent?.drama_school && (
        <>
          <h2>Utdanning</h2>
          <div className="row"><span className="year" /><span>{talent.drama_school}</span></div>
        </>
      )}

      {talent?.bio && (
        <>
          <h2>Om meg</h2>
          <p className="bio">{talent.bio}</p>
        </>
      )}
    </Box>
  );
});

export default CvDocument;

/**
 * Skriver ut dokumentet slik det står.
 *
 * Et eget vindu i stedet for print-CSS på appen: da slipper vi å kjempe mot
 * kaskaden i hele Talents-skallet for å skjule navigasjon, dialoger og
 * bakgrunner — og det som skrives ut er nøyaktig de nodene brukeren ser i
 * forhåndsvisningen.
 *
 * Nettleserens utskriftsdialog gir «Lagre som PDF» på alle plattformer, så
 * dette er PDF-eksporten uten et eneste nytt bibliotek.
 */
export function printCvDocument(node: HTMLElement | null, name: string): boolean {
  if (!node) return false;
  const win = window.open('', '_blank', 'width=900,height=1200');
  // Popup-blokkering er den eneste realistiske feilen her, og den må sies
  // fra om — ikke svelges, ellers ser det ut som knappen er død.
  if (!win) return false;

  win.document.write(`<!doctype html>
<html lang="nb"><head><meta charset="utf-8">
<title>${name.replace(/[<>&]/g, '')} — CV</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { margin: 0; background: #fff; }
  .cv-document {
    box-shadow: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }
  /* Ingen seksjon skal brekke midt i en overskrift. */
  h2 { break-after: avoid; page-break-after: avoid; }
  .row { break-inside: avoid; page-break-inside: avoid; }
</style></head><body>${node.outerHTML}</body></html>`);
  win.document.close();
  win.focus();
  // Vent til layouten er ferdig før dialogen åpnes, ellers skriver Safari ut
  // et tomt ark.
  win.setTimeout(() => {
    win.print();
    win.close();
  }, 250);
  return true;
}
