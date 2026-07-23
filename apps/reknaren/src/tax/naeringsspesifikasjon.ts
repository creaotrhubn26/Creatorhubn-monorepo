/**
 * Næringsspesifikasjon-utkast — grunnlaget for skattemeldingen for
 * næringsdrivende. Mapper hovedbokens kontoer til standard resultat- og
 * balanseposter (NS4102-baserte intervaller) og kontrollerer at balansen går opp.
 *
 * Dette er et UTKAST/grunnlag som viser tallene og hvordan de er satt sammen —
 * ren lesing. Selve innsendingen til Skatteetaten (via Maskinporten/Altinn)
 * kommer når tilgangen er på plass; her bygger vi tallgrunnlaget så det er klart.
 */
import type { Db } from '../db/pool.js';
import { balanceSheet, incomeStatement, type TrialBalanceRow } from '../ledger/reports.js';

export interface SpecPost {
  accountNumber: string;
  accountName: string;
  amountMinor: bigint;
}

export interface SpecSection {
  name: string;
  poster: SpecPost[];
  sumMinor: bigint;
}

export interface Naeringsspesifikasjon {
  year: number;
  fromDate: string;
  toDate: string;
  resultat: {
    driftsinntekter: SpecSection;
    driftskostnader: SpecSection;
    driftsresultatMinor: bigint;
    finansinntekter: SpecSection;
    finanskostnader: SpecSection;
    ordinaertResultatForSkattMinor: bigint;
    skattekostnadMinor: bigint;
    aarsresultatMinor: bigint;
  };
  balanse: {
    anleggsmidler: SpecSection;
    omlopsmidler: SpecSection;
    sumEiendelerMinor: bigint;
    egenkapital: SpecSection;
    aarsresultatTilEgenkapitalMinor: bigint;
    langsiktigGjeld: SpecSection;
    kortsiktigGjeld: SpecSection;
    sumEgenkapitalOgGjeldMinor: bigint;
    balanserer: boolean;
    differanseMinor: bigint;
  };
  warnings: string[];
}

const num = (n: string): number => parseInt(n, 10);

/** Magnitude i postens naturlige retning (inntekt/EK/gjeld = kredit-positiv). */
function magnitude(row: TrialBalanceRow): bigint {
  switch (row.accountType) {
    case 'revenue':
    case 'liability':
    case 'equity':
      return -row.balanceMinor; // kreditsaldo → positivt
    default:
      return row.balanceMinor; // asset/expense: debetsaldo → positivt
  }
}

function section(name: string, rows: TrialBalanceRow[]): SpecSection {
  const poster = rows.map((r) => ({
    accountNumber: r.accountNumber,
    accountName: r.accountName,
    amountMinor: magnitude(r),
  }));
  return { name, poster, sumMinor: poster.reduce((a, p) => a + p.amountMinor, 0n) };
}

export async function buildNaeringsspesifikasjon(
  db: Db,
  params: { organizationId: string; year: number },
): Promise<Naeringsspesifikasjon> {
  const { organizationId: org, year } = params;
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const warnings: string[] = [];

  // Resultat: periodens inntekter/kostnader.
  const inc = await incomeStatement(db, { organizationId: org, fromDate: from, toDate: to });
  const rev = inc.byAccount.filter((r) => r.accountType === 'revenue');
  const exp = inc.byAccount.filter((r) => r.accountType === 'expense');
  const inRange = (r: TrialBalanceRow, lo: number, hi: number) => num(r.accountNumber) >= lo && num(r.accountNumber) <= hi;

  const driftsinntekter = section(
    'Driftsinntekter',
    rev.filter((r) => inRange(r, 3000, 3999)),
  );
  const finansinntekter = section(
    'Finansinntekter',
    rev.filter((r) => inRange(r, 8000, 8099)),
  );
  const varekostnad = exp.filter((r) => inRange(r, 4000, 4999));
  const lonn = exp.filter((r) => inRange(r, 5000, 5999));
  const avskrivning = exp.filter((r) => inRange(r, 6000, 6099));
  const annenDrift = exp.filter((r) => inRange(r, 6100, 7999));
  const driftskostnader = section('Driftskostnader', [...varekostnad, ...lonn, ...avskrivning, ...annenDrift]);
  const finanskostnader = section(
    'Finanskostnader',
    exp.filter((r) => inRange(r, 8100, 8199)),
  );
  const skattekostnadMinor = exp
    .filter((r) => inRange(r, 8300, 8399))
    .reduce((a, r) => a + magnitude(r), 0n);

  const driftsresultatMinor = driftsinntekter.sumMinor - driftskostnader.sumMinor;
  const ordinaertResultatForSkattMinor =
    driftsresultatMinor + finansinntekter.sumMinor - finanskostnader.sumMinor;
  const aarsresultatMinor = ordinaertResultatForSkattMinor - skattekostnadMinor;

  // Balanse: kumulativt fram til 31.12.
  const bs = await balanceSheet(db, { organizationId: org, toDate: to });
  const assets = bs.balances.filter((r) => r.accountType === 'asset');
  const equity = bs.balances.filter((r) => r.accountType === 'equity');
  const liabilities = bs.balances.filter((r) => r.accountType === 'liability');

  const anleggsmidler = section('Anleggsmidler', assets.filter((r) => inRange(r, 1000, 1399)));
  const omlopsmidler = section('Omløpsmidler', assets.filter((r) => !inRange(r, 1000, 1399)));
  const sumEiendelerMinor = anleggsmidler.sumMinor + omlopsmidler.sumMinor;

  const egenkapital = section('Egenkapital (innskutt/opptjent)', equity);
  const langsiktigGjeld = section('Langsiktig gjeld', liabilities.filter((r) => inRange(r, 2200, 2399)));
  const kortsiktigGjeld = section('Kortsiktig gjeld', liabilities.filter((r) => !inRange(r, 2200, 2399)));

  // Årets resultat inngår i egenkapitalen (er ennå ikke disponert som egen postering).
  const aarsresultatTilEgenkapitalMinor = inc.resultMinor;
  const sumEgenkapitalOgGjeldMinor =
    egenkapital.sumMinor + aarsresultatTilEgenkapitalMinor + langsiktigGjeld.sumMinor + kortsiktigGjeld.sumMinor;

  const differanseMinor = sumEiendelerMinor - sumEgenkapitalOgGjeldMinor;
  const balanserer = differanseMinor === 0n;
  if (!balanserer) {
    warnings.push(
      'Balansen går ikke helt opp. Det skyldes som regel manglende åpningsbalanse (inngående balanse fra i fjor) eller udisponert resultat. Sjekk at fjorårets tall er importert.',
    );
  }
  warnings.push(
    'Dette er et utkast/grunnlag for næringsspesifikasjonen. Innsending til Skatteetaten kommer når tilgangen (Maskinporten/Altinn) er på plass.',
  );

  return {
    year,
    fromDate: from,
    toDate: to,
    resultat: {
      driftsinntekter,
      driftskostnader,
      driftsresultatMinor,
      finansinntekter,
      finanskostnader,
      ordinaertResultatForSkattMinor,
      skattekostnadMinor,
      aarsresultatMinor,
    },
    balanse: {
      anleggsmidler,
      omlopsmidler,
      sumEiendelerMinor,
      egenkapital,
      aarsresultatTilEgenkapitalMinor,
      langsiktigGjeld,
      kortsiktigGjeld,
      sumEgenkapitalOgGjeldMinor,
      balanserer,
      differanseMinor,
    },
    warnings,
  };
}
