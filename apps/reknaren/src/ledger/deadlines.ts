/**
 * Frister & forpliktelser — de lovbestemte fristene en virksomhet MÅ overholde,
 * med nedtelling og hverdagsspråk. En novises største angst er å bomme på MVA-,
 * skatte- eller årsoppgjørsfrister; dette er sjekklista (ikke en kontantstrøm-
 * prognose som «Framover»). Rent deterministisk fra org-form/mva-status/dato.
 */
export type OrgForm = 'ENK' | 'AS' | 'ANS' | 'DA' | 'SA' | 'NUF';

export interface Deadline {
  kind: 'mva' | 'forskuddsskatt' | 'skattemelding' | 'aarsregnskap' | 'aksjonaerregister';
  title: string;
  dueDate: string; // ISO
  daysUntil: number; // negativ = forfalt
  severity: 'overdue' | 'due_soon' | 'upcoming';
  explanation: string;
  /** Skjerm i appen som hjelper med fristen. */
  actionScreen?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400000);

/** MVA-terminens forfall: den 10. i (terminslutt-måned + 2). */
const MVA_TERMS: { name: string; endMonth: number }[] = [
  { name: 'januar–februar', endMonth: 2 },
  { name: 'mars–april', endMonth: 4 },
  { name: 'mai–juni', endMonth: 6 },
  { name: 'juli–august', endMonth: 8 },
  { name: 'september–oktober', endMonth: 10 },
  { name: 'november–desember', endMonth: 12 },
];

function isCompany(orgForm: OrgForm): boolean {
  return ['AS', 'NUF', 'SA'].includes(orgForm);
}

/**
 * Alle lovbestemte frister i vinduet [asOf − 45 dager, asOf + horizonDays].
 * Sortert stigende på dato. Status settes av avstand til i dag.
 */
export function computeDeadlines(params: { orgForm: OrgForm; vatRegistered: boolean; asOf: string; horizonDays?: number }): Deadline[] {
  const { asOf } = params;
  const horizon = params.horizonDays ?? 365;
  const startY = Number(asOf.slice(0, 4)) - 1;
  const endY = Number(asOf.slice(0, 4)) + 1;
  const raw: { kind: Deadline['kind']; title: string; dueDate: string; explanation: string; actionScreen?: string }[] = [];

  for (let y = startY; y <= endY; y++) {
    // MVA-melding (2-måneders terminer) — kun MVA-registrerte.
    if (params.vatRegistered) {
      for (const t of MVA_TERMS) {
        let dm = t.endMonth + 2, dy = y;
        if (dm > 12) { dm -= 12; dy += 1; }
        raw.push({ kind: 'mva', title: `MVA-melding ${t.name} ${y}`, dueDate: iso(dy, dm, 10), explanation: `Frist for å levere og betale MVA for terminen ${t.name} ${y}.`, actionScreen: 'vat' });
      }
    }
    // Forskuddsskatt.
    if (isCompany(params.orgForm)) {
      // AS: to terminer året ETTER inntektsåret (15.2 og 15.4).
      raw.push({ kind: 'forskuddsskatt', title: `Forskuddsskatt AS — 1. termin (inntektsår ${y - 1})`, dueDate: iso(y, 2, 15), explanation: 'Første av to terminer forskuddsskatt for aksjeselskap.', actionScreen: 'tax' });
      raw.push({ kind: 'forskuddsskatt', title: `Forskuddsskatt AS — 2. termin (inntektsår ${y - 1})`, dueDate: iso(y, 4, 15), explanation: 'Andre av to terminer forskuddsskatt for aksjeselskap.', actionScreen: 'tax' });
      // Aksjonærregisteroppgave (RF-1086) — frist 31.1.
      raw.push({ kind: 'aksjonaerregister', title: `Aksjonærregisteroppgave ${y - 1}`, dueDate: iso(y, 1, 31), explanation: 'Aksjeselskap må levere aksjonærregisteroppgave for foregående år.', actionScreen: 'year-end' });
      // Årsregnskap til Regnskapsregisteret — frist 31.7.
      raw.push({ kind: 'aarsregnskap', title: `Årsregnskap ${y - 1} til Regnskapsregisteret`, dueDate: iso(y, 7, 31), explanation: 'Regnskapspliktige (AS) må sende inn årsregnskapet.', actionScreen: 'year-end' });
    } else {
      // ENK m.fl.: fire terminer (15.3/6/9/12) samme år.
      for (const m of [3, 6, 9, 12]) raw.push({ kind: 'forskuddsskatt', title: `Forskuddsskatt ${['', '', '', '1.', '', '', '2.', '', '', '3.', '', '', '4.'][m]} termin ${y}`, dueDate: iso(y, m, 15), explanation: 'Termin forskuddsskatt for enkeltpersonforetak.', actionScreen: 'tax' });
    }
    // Skattemelding for næringsdrivende — frist 31.5 året etter.
    raw.push({ kind: 'skattemelding', title: `Skattemelding ${y - 1}`, dueDate: iso(y, 5, 31), explanation: 'Frist for å levere skattemelding med næringsspesifikasjon for foregående år.', actionScreen: 'year-end' });
  }

  const lo = daysBetween('1970-01-01', asOf) - 45; // 45 dager tilbake
  const hi = daysBetween('1970-01-01', asOf) + horizon;
  return raw
    .map((r) => {
      const daysUntil = daysBetween(asOf, r.dueDate);
      const severity: Deadline['severity'] = daysUntil < 0 ? 'overdue' : daysUntil <= 14 ? 'due_soon' : 'upcoming';
      return { ...r, daysUntil, severity } as Deadline;
    })
    .filter((d) => {
      const abs = daysBetween('1970-01-01', d.dueDate);
      return abs >= lo && abs <= hi;
    })
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
}
