// src/market/engine.ts
import type { MarketSignal } from './signal-store.js';
import type { OrgExposure } from './exposure.js';

export interface GeneratedCard {
  kind: string;
  severity: 'signal' | 'opportunity' | 'watch';
  title: string;
  body: string;
  impactMinor: bigint | null;
  direction: 'cost' | 'benefit' | 'neutral';
  signalRefs: { kind: string; signalKey: string; period: string }[];
  sources: { label: string; url?: string }[];
}

export interface FxInput {
  currency: string;
  latestRate: string;   // NOK per 1 enhet, dagens
  medianRate: string;   // NOK per 1 enhet, 90-dagers median
  period: string;       // dato latestRate gjelder
  medianMonthlySpendMinor: bigint | null; // median månedlig NOK-innkjøp i valutaen (null = ukjent)
  // Retrospektiv (dine faktiske kjøp siste 90 dager), null hvis ingen kjøp / manglende original-beløp:
  retro: { purchaseCount: number; actualNokMinor: bigint; medianNokMinor: bigint } | null;
}

/** '4.50' - '4.25' = 25 (basispunkt-styrke i hundredeler prosentpoeng, heltall). */
function deltaHundredths(a: string, b: string): bigint {
  const toH = (s: string): bigint => {
    const [i, f = ''] = s.split('.');
    const frac = (f + '00').slice(0, 2);
    return BigInt(i!) * 100n + BigInt(frac || '0');
  };
  return toH(a) - toH(b);
}

/** Valutakurs-streng → ti-tusendeler som bigint (eksakt, ingen flyttall i kronetallet). '11.62' → 116200n. Eksportert: refresh gjenbruker den til retro-median. */
export function rateTenThousandths(s: string): bigint {
  const neg = s.startsWith('-');
  const [i, f = ''] = (neg ? s.slice(1) : s).split('.');
  const frac = (f + '0000').slice(0, 4);
  const v = BigInt(i || '0') * 10000n + BigInt(frac || '0');
  return neg ? -v : v;
}

export function buildInsights(input: {
  policyRate?: MarketSignal | null;
  policyRatePrev?: MarketSignal | null;
  kpi?: MarketSignal | null;
  fx?: FxInput[];
  exposure: OrgExposure;
}): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  const NB_URL = 'https://www.norges-bank.no/tema/pengepolitikk/Styringsrenten/';

  // Regel 1: rate_debt
  const { policyRate, policyRatePrev, exposure } = input;
  if (policyRate && policyRatePrev && exposure.interestBearingDebtMinor > 0n) {
    const dH = deltaHundredths(policyRate.value, policyRatePrev.value); // prosentpoeng * 100
    if (dH !== 0n) {
      // årlig kroner-effekt = |Δ| (i prosentpoeng/100/100) * gjeld
      // impact_øre = |dH| * gjeld_øre / 10000  (dH er prosentpoeng*100 ⇒ del på 100 for %, del på 100 for desimal)
      const impact = (dH < 0n ? -dH : dH) * exposure.interestBearingDebtMinor / 10000n;
      const opp = dH < 0n;
      const retning = opp ? 'lavere' : 'høyere';
      const pp = (Number(dH) / 100).toLocaleString('nb-NO', { minimumFractionDigits: 2 });
      cards.push({
        kind: 'rate_debt',
        severity: opp ? 'opportunity' : 'watch',
        direction: opp ? 'benefit' : 'cost',
        title: `Styringsrenta ${opp ? 'ned' : 'opp'} ${pp} prosentpoeng`,
        body: `Med rentebærende gjeld i bøkene betyr det anslagsvis ${retning} rentekostnad. Legg det inn i likviditetsplanen.`,
        impactMinor: impact,
        signalRefs: [{ kind: policyRate.kind, signalKey: policyRate.signalKey, period: policyRate.period }],
        sources: [{ label: 'Norges Bank', url: NB_URL }],
      });
    }
  }

  // Regel 2: kpi_cost (rent signal)
  if (input.kpi) {
    const pct = Number(input.kpi.value).toLocaleString('nb-NO', { minimumFractionDigits: 1 });
    cards.push({
      kind: 'kpi_cost',
      severity: 'signal',
      direction: 'neutral',
      title: `Prisvekst (KPI) ${pct} %`,
      body: `Konsumprisene har steget ${pct} % siste 12 måneder. Vurder om egne priser og marginer henger med.`,
      impactMinor: null,
      signalRefs: [{ kind: input.kpi.kind, signalKey: input.kpi.signalKey, period: input.kpi.period }],
      sources: [{ label: input.kpi.source, url: 'https://www.ssb.no/kpi' }],
    });
  }

  // Regel 3 + 4: fx_timing (framover) + fx_retro (retrospektiv) per importvaluta
  const FX_URL = 'https://www.norges-bank.no/tema/Statistikk/valutakurser/';
  for (const f of input.fx ?? []) {
    const latestTT = rateTenThousandths(f.latestRate);
    const medianTT = rateTenThousandths(f.medianRate);
    if (medianTT > 0n) {
      const diffTT = latestTT - medianTT;              // + = kronen svak (valutaen dyrere)
      const absDiffTT = diffTT < 0n ? -diffTT : diffTT;
      const deviationPct = (Number(absDiffTT) / Number(medianTT)) * 100;
      if (deviationPct >= 3) {
        const weak = diffTT > 0n;                       // kronen svakere enn snittet
        const pct = deviationPct.toLocaleString('nb-NO', { maximumFractionDigits: 1 });
        const impact = f.medianMonthlySpendMinor === null ? null : (f.medianMonthlySpendMinor * absDiffTT) / medianTT;
        cards.push({
          kind: `fx_timing:${f.currency}`,
          severity: weak ? 'watch' : 'opportunity',
          direction: weak ? 'cost' : 'benefit',
          title: `Kronen ${weak ? 'svakere' : 'sterkere'} mot ${f.currency}`,
          body: weak
            ? `Kronen er ~${pct} % svakere mot ${f.currency} enn snittet siste 90 dager. Utenlandskjøp i ${f.currency} er dyrere nå enn normalt — ikke-hastende innkjøp kan lønne seg å vente.`
            : `Kronen er ~${pct} % sterkere mot ${f.currency} enn snittet siste 90 dager. Utenlandskjøp i ${f.currency} er rimeligere nå enn normalt.`,
          impactMinor: impact,
          signalRefs: [{ kind: 'fx_rate', signalKey: f.currency, period: f.period }],
          sources: [{ label: `Norges Bank (${f.period})`, url: FX_URL }],
        });
      }
    }
    // Regel 4: fx_retro — dine faktiske kjøp mot snittkursen (informativ, ikke bebreidende)
    if (f.retro && f.retro.purchaseCount > 0) {
      const delta = f.retro.actualNokMinor - f.retro.medianNokMinor; // + = betalte mer enn snittkursen
      const absDelta = delta < 0n ? -delta : delta;
      if (absDelta >= 100000n) { // ≥ 1 000 kr — unngå støy
        const paidMore = delta > 0n;
        cards.push({
          kind: `fx_retro:${f.currency}`,
          severity: 'signal',
          direction: 'neutral',
          title: `Dine ${f.currency}-kjøp mot snittkursen`,
          body: paidMore
            ? `På ${f.retro.purchaseCount} ${f.currency}-kjøp siste 90 dager betalte du mer enn Norges Banks snittkurs. Ingen kan time kursen perfekt — men det er verdt å følge kursen ved neste kjøp.`
            : `På ${f.retro.purchaseCount} ${f.currency}-kjøp siste 90 dager kom du bedre ut enn snittkursen. God timing.`,
          impactMinor: delta, // fortegn: + = betalte mer, − = spart mot snittet
          signalRefs: [{ kind: 'fx_rate', signalKey: f.currency, period: f.period }],
          sources: [{ label: `Norges Bank (${f.period})`, url: FX_URL }],
        });
      }
    }
  }

  return cards;
}
