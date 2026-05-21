/**
 * briefQuickPicks — kontekstuelle chips per brief-felt som klienten kan
 * trykke for å fylle inn vanlige svar. Klienten slipper å stirre på et
 * tomt tekstfelt og lurer på hva som forventes — chipsene fungerer som
 * "starter-replikker".
 *
 * Kvinnelist:
 *   • Chips legger til tekst (semikolon-separert hvis feltet allerede har
 *     innhold), de erstatter ikke.
 *   • Lista er bevisst kort (3-6 per felt) — alt for mange chips gjør
 *     skjermen overveldende, og klienten skal fortsatt skrive sin egen
 *     formulering.
 *   • Ordbruk skal stemme med vårt norske vokabular ("hovedbudskap",
 *     "målgruppe") — ingen engelske marketing-floskler.
 */

import type { ProducerClientIntake } from '../../models/casting';

export interface BriefQuickPick {
  /** Tekst som vises i chipen */
  label: string;
  /** Tekst som limes inn i feltet når brukeren trykker. Default = label. */
  insert?: string;
  /** Valgfri ledetekst, vises som tooltip på desktop */
  hint?: string;
}

export const BRIEF_QUICK_PICKS: Partial<Record<keyof ProducerClientIntake, BriefQuickPick[]>> = {
  projectGoal: [
    { label: 'Øke kjennskap til ny tjeneste' },
    { label: 'Drive trafikk til kampanjeside' },
    { label: 'Rekruttere nye kunder/medlemmer' },
    { label: 'Bygge merkevare i ny målgruppe' },
    { label: 'Lansere produkt eller funksjon' },
  ],
  keyMessage: [
    { label: 'Spar tid', insert: 'Vi sparer kunden tid.' },
    { label: 'Spar penger', insert: 'Vi gir mer for pengene.' },
    { label: 'Trygghet', insert: 'Trygt og pålitelig valg.' },
    { label: 'Lokalt', insert: 'Norsk og lokalt.' },
    { label: 'Nytt og bedre', insert: 'En ny og bedre måte å løse problemet på.' },
  ],
  targetAudience: [
    { label: 'Unge voksne 18-25' },
    { label: 'Småbarnsforeldre 28-40' },
    { label: 'Etablerte profesjonelle 35-55' },
    { label: 'Seniorer 60+' },
    { label: 'Bedriftsbeslutningstakere' },
    { label: 'Studenter' },
  ],
  deliverables: [
    { label: 'Hovedfilm 30 s' },
    { label: 'Kortversjon 15 s for sosialt' },
    { label: 'Vertikal 9:16 (TikTok/Reels)' },
    { label: 'Stillbilder fra opptaket' },
    { label: 'Behind-the-scenes-klipp' },
    { label: 'Norske undertekster' },
  ],
  timingConstraints: [
    { label: 'Kampanjestart om 4-6 uker' },
    { label: 'Klar før sommerferien' },
    { label: 'Klar før julehandelen' },
    { label: 'Fleksibel — kvalitet over tempo' },
  ],
  brandNotes: [
    { label: 'Bruk merkevarens primærfarger' },
    { label: 'Logo må alltid være synlig' },
    { label: 'Profesjonell og varm tone' },
    { label: 'Ungdommelig og leken tone' },
    { label: 'Unngå sammenligning med konkurrenter' },
  ],
  referenceLinks: [
    { label: 'Vår forrige kampanje', insert: '(lim inn lenke til forrige kampanje)' },
    { label: 'Konkurrent vi liker', insert: '(lim inn lenke til konkurrenten)' },
    { label: 'Stil-referanse', insert: '(lim inn lenke til film/bilde med stilen vi vil ha)' },
  ],
};

/** Append text to existing field-content, separert med semikolon hvis ikke tomt. */
export function appendQuickPick(existing: string, pick: BriefQuickPick): string {
  const insertion = (pick.insert ?? pick.label).trim();
  if (!insertion) return existing;
  const current = (existing ?? '').trimEnd();
  if (!current) return insertion;
  const sep = /[.;\n]\s*$/.test(current) ? '\n' : '; ';
  return `${current}${sep}${insertion}`;
}
