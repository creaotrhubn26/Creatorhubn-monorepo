/**
 * Kunde- og leverandørrisiko fra Enhetsregisteret. Bevisst INGEN ugjennomsiktig
 * risikoscore: hver observasjon vises som et eget signal med KILDE og forklaring,
 * så brukeren gjør den endelige vurderingen. En kategorisk «samlet vurdering»
 * (ok/oppmerksomhet/risiko) utledes av det alvorligste signalet — tydelig merket
 * som en oppsummering, ikke et tall.
 */
import type { CompanyProfile } from '../integrations/company-registry.js';

export type RiskSeverity = 'ok' | 'attention' | 'risk';

export interface RiskSignal {
  code: string;
  severity: RiskSeverity;
  title: string;
  detail: string;
  source: string;
}

export interface CompanyRisk {
  orgNumber: string;
  found: boolean;
  name: string | null;
  orgForm: string | null;
  overall: RiskSeverity;
  signals: RiskSignal[];
  profile: {
    registeredInVatRegister: boolean | null;
    foundedDate: string | null;
    address: { street?: string; postalCode?: string; city?: string } | null;
  };
  ehf: { status: 'unknown'; note: string };
  creditNote: string;
  checkedAt: string;
  disclaimer: string;
}

const SRC = 'Enhetsregisteret (data.brreg.no), åpne data';
const ORDER: Record<RiskSeverity, number> = { risk: 0, attention: 1, ok: 2 };

function monthsBetween(fromIso: string, toIso: string): number {
  const [fy, fm] = fromIso.split('-').map(Number) as [number, number];
  const [ty, tm] = toIso.split('-').map(Number) as [number, number];
  return (ty - fy) * 12 + (tm - fm);
}

export function assessCompanyRisk(
  orgNumber: string,
  profile: CompanyProfile,
  opts: { checkedAt: string; invoiceHasVat?: boolean } ,
): CompanyRisk {
  const signals: RiskSignal[] = [];

  if (!profile.found) {
    signals.push({
      code: 'ikke_funnet',
      severity: 'risk',
      title: 'Organisasjonsnummeret finnes ikke i Enhetsregisteret',
      detail: 'Kontroller nummeret. Fakturering til en enhet som ikke finnes kan bety feil juridisk enhet eller en skrivefeil.',
      source: SRC,
    });
  } else {
    if (profile.deletedDate) {
      signals.push({
        code: 'slettet',
        severity: 'risk',
        title: `Selskapet er slettet (${profile.deletedDate})`,
        detail: 'Enheten er avviklet og slettet fra registeret. Ikke fakturér eller inngå nye avtaler med denne enheten.',
        source: SRC,
      });
    }
    if (profile.bankrupt) {
      signals.push({
        code: 'konkurs',
        severity: 'risk',
        title: 'Selskapet er registrert konkurs',
        detail: 'Konkurs innebærer høy risiko for tap. Vurder forskuddsbetaling og kontakt bostyrer ved utestående.',
        source: SRC,
      });
    }
    if (profile.forcedLiquidation) {
      signals.push({
        code: 'tvangsavvikling',
        severity: 'risk',
        title: 'Under tvangsavvikling / tvangsoppløsning',
        detail: 'Selskapet er under tvangsavvikling. Høy risiko — vær forsiktig med kreditt.',
        source: SRC,
      });
    }
    if (profile.underLiquidation) {
      signals.push({
        code: 'under_avvikling',
        severity: 'attention',
        title: 'Under avvikling',
        detail: 'Selskapet er under frivillig avvikling. Følg opp utestående og unngå ny langsiktig kreditt.',
        source: SRC,
      });
    }
    if (opts.invoiceHasVat && profile.registeredInVatRegister === false) {
      signals.push({
        code: 'mva_avvik',
        severity: 'attention',
        title: 'Ikke i MVA-registeret',
        detail: 'Enheten står ikke i Merverdiavgiftsregisteret. Kontroller MVA-behandlingen på fakturaer til denne kunden.',
        source: SRC,
      });
    }
    if (profile.foundedDate && monthsBetween(profile.foundedDate, opts.checkedAt) < 6) {
      signals.push({
        code: 'nystiftet',
        severity: 'attention',
        title: `Nystiftet (${profile.foundedDate})`,
        detail: 'Selskapet er under seks måneder gammelt og har begrenset historikk. Vurder forsiktig kredittgrense.',
        source: SRC,
      });
    }
    if (signals.length === 0) {
      signals.push({
        code: 'aktiv',
        severity: 'ok',
        title: 'Aktiv og i orden',
        detail: 'Ingen konkurs, avvikling eller sletting registrert. Grunnleggende status ser bra ut.',
        source: SRC,
      });
    }
  }

  const overall = signals.reduce<RiskSeverity>((worst, s) => (ORDER[s.severity] < ORDER[worst] ? s.severity : worst), 'ok');

  return {
    orgNumber,
    found: profile.found,
    name: profile.name ?? null,
    orgForm: profile.orgForm ?? null,
    overall,
    signals,
    profile: {
      registeredInVatRegister: profile.registeredInVatRegister ?? null,
      foundedDate: profile.foundedDate ?? null,
      address: profile.address ?? null,
    },
    ehf: {
      status: 'unknown',
      note: 'Om kunden kan motta EHF må sjekkes i ELMA (Peppol-adresseregisteret). Det er ikke automatisert ennå.',
    },
    creditNote:
      'Vi foreslår ingen automatisk kredittgrense — det krever regnskapstall vi ikke har. Sett grensen manuelt ut fra historikk, betalingsatferd og signalene over.',
    checkedAt: opts.checkedAt,
    disclaimer:
      'Vurderingen bygger på åpne data fra Enhetsregisteret på oppslagstidspunktet. Hvert signal er vist med kilde — dette er ikke en automatisk risikoscore, og du gjør den endelige vurderingen.',
  };
}
