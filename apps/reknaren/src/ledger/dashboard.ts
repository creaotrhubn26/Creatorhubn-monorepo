/**
 * Oversikt-cockpit. Én aggregert forside som trekker de viktigste signalene fra
 * alle motorene sammen — drevet av de SAMME motorene som detalj-fanene, så tallene
 * alltid stemmer overens. Kjøres parallelt for fart. REN LESING.
 */
import type { Db } from '../db/pool.js';
import type { OrganizationForm } from '../rules/types.js';
import type { RuleRegister } from '../rules/register.js';
import { detectBookkeepingErrors } from './anomalies.js';
import { detectFraudSignals, type FraudSeverity } from './fraud-detection.js';
import { runHealthCheck } from './health-check.js';
import { assessPeriodClose } from './period-close.js';
import { buildForecast } from './planning.js';
import { buildTaxAdvisories } from './tax-advisor.js';
import { huntDocuments } from '../ingestion/document-hunt.js';

export interface FollowUpItem {
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  detail: string;
  actionScreen?: string;
  documentId?: string;
}

export interface Dashboard {
  asOf: string;
  monthClose: { monthName: string; readinessPct: number; ready: boolean; summary: string; blockerCount: number };
  liquidity: { cashNowMinor: bigint; endBalanceMinor: bigint; lowestBalanceMinor: bigint; goesNegative: boolean };
  vat: { netPayableMinor: bigint; dueDate: string };
  taxReserveMinor: bigint;
  advisories: { risiko: number; mulighet: number; kontrollpunkt: number; total: number };
  documentHunt: { paymentsMissingDoc: number; gapsWithCandidates: number };
  fraud: { active: number; critical: number; high: number; dismissed: number };
  counts: { documentsWaiting: number; bankUnmatched: number };
  followUp: FollowUpItem[];
}

const SEV: Record<string, number> = { error: 0, warning: 1, info: 2 };

export async function buildDashboard(
  db: Db,
  rules: RuleRegister,
  params: { organizationId: string; orgForm: OrganizationForm; asOf: string },
): Promise<Dashboard> {
  const { organizationId: org, orgForm, asOf } = params;
  const year = Number(asOf.slice(0, 4));
  const month = Number(asOf.slice(5, 7));
  const yearStart = `${year}-01-01`;

  // Alle motorene kjøres parallelt — de leser samme hovedbok.
  const [close, forecast, advisories, hunt, health, errors, fraud] = await Promise.all([
    assessPeriodClose(db, rules, { organizationId: org, year, month }),
    buildForecast(db, rules, { organizationId: org, orgForm, asOf }),
    buildTaxAdvisories(db, rules, { organizationId: org, orgForm, asOf }),
    huntDocuments(db, { organizationId: org, asOf }),
    runHealthCheck(db, { organizationId: org, asOf }),
    detectBookkeepingErrors(db, rules, { organizationId: org, fromDate: yearStart, toDate: asOf }),
    detectFraudSignals(db, rules, { organizationId: org, fromDate: yearStart, toDate: asOf }),
  ]);
  const fraudSev = (s: FraudSeverity) => fraud.bySeverity[s];

  // Handlingsliste: regnskapshelse + reelle bokføringsfeil, alvorssortert.
  const followUp: FollowUpItem[] = [
    ...health.issues.map((i) => ({
      id: i.id,
      severity: i.severity,
      title: i.title,
      detail: i.detail,
      ...(i.actionScreen ? { actionScreen: i.actionScreen } : {}),
    })),
    ...errors.errors.map((e) => ({
      id: e.code + (e.entryNumber ?? ''),
      severity: e.severity,
      title: e.title,
      detail: e.detail,
      actionScreen: 'period-close',
      ...(e.documentId ? { documentId: e.documentId } : {}),
    })),
    // De alvorligste svindelvarslene (ikke avfeid) løftes til handlingslisten.
    ...fraud.signals
      .filter((s) => s.reviewed?.verdict !== 'false_alarm' && (s.severity === 'critical' || s.severity === 'high'))
      .map((s) => ({
        id: s.fingerprint,
        severity: (s.severity === 'critical' ? 'error' : 'warning') as FollowUpItem['severity'],
        title: s.title,
        detail: s.detail,
        actionScreen: 'fraud',
        ...(s.evidence.find((e) => e.documentId)?.documentId
          ? { documentId: s.evidence.find((e) => e.documentId)!.documentId }
          : {}),
      })),
  ]
    .sort((a, b) => (SEV[a.severity] ?? 3) - (SEV[b.severity] ?? 3))
    .slice(0, 6);

  return {
    asOf,
    monthClose: {
      monthName: close.monthName,
      readinessPct: close.readinessPct,
      ready: close.ready,
      summary: close.summary,
      blockerCount: close.items.filter((i) => i.severity === 'blocker').length,
    },
    liquidity: {
      cashNowMinor: forecast.cashNowMinor,
      endBalanceMinor: forecast.likviditet.endBalanceMinor,
      lowestBalanceMinor: forecast.likviditet.lowestBalanceMinor,
      goesNegative: forecast.likviditet.goesNegative,
    },
    vat: { netPayableMinor: forecast.forventetMva.netPayableMinor, dueDate: forecast.forventetMva.dueDate },
    taxReserveMinor: forecast.skatt.recommendedReserveMinor,
    advisories: {
      risiko: advisories.advisories.filter((a) => a.kind === 'risiko').length,
      mulighet: advisories.advisories.filter((a) => a.kind === 'mulighet').length,
      kontrollpunkt: advisories.advisories.filter((a) => a.kind === 'kontrollpunkt').length,
      total: advisories.advisories.length,
    },
    documentHunt: { paymentsMissingDoc: hunt.paymentsMissingDoc, gapsWithCandidates: hunt.gapsWithCandidates },
    fraud: { active: fraud.activeCount, critical: fraudSev('critical'), high: fraudSev('high'), dismissed: fraud.dismissedCount },
    counts: { documentsWaiting: forecast.mangler.bilagTilBehandling, bankUnmatched: forecast.mangler.uavstemteBanktransaksjoner },
    followUp,
  };
}
