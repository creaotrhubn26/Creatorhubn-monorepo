export type SplitSheetCompensationType = 'share' | 'hourly' | 'fixed';

export interface SplitSheetCompensationFields {
  roleLabel?: string;
  compensationType?: SplitSheetCompensationType;
  hourlyRate?: number | null;
  estimatedHours?: number | null;
  estimatedAmount?: number | null;
  currency?: string | null;
}

interface LegacyFeeFields {
  feeType?: unknown;
  feeAmount?: unknown;
  feeCurrency?: unknown;
}

export interface HourlyCompensationInput {
  hourlyRate?: unknown;
  estimatedHours?: unknown;
}

export interface HourlyCompensationLine<T> {
  participant: T;
  amount: number;
  percentage: number;
}

export function nonNegativeNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

const roundNonNegative = (value: unknown, fractionDigits: number): number => {
  const amount = nonNegativeNumber(value);
  const multiplier = 10 ** fractionDigits;
  return Math.round((amount + Number.EPSILON) * multiplier) / multiplier;
};

/** Monetary agreement terms are canonical to øre before display or signing. */
export function normalizeCurrencyAmount(value: unknown): number {
  return roundNonNegative(value, 2);
}

/** Hour estimates are canonical to hundredths of an hour. */
export function normalizeEstimatedHours(value: unknown): number {
  return roundNonNegative(value, 2);
}

export function calculateHourlyAmount(hourlyRate: unknown, estimatedHours: unknown): number {
  return normalizeCurrencyAmount(
    normalizeCurrencyAmount(hourlyRate) * normalizeEstimatedHours(estimatedHours),
  );
}

export function calculateHourlyDistribution<T extends HourlyCompensationInput>(
  participants: T[],
): { total: number; lines: Array<HourlyCompensationLine<T>> } {
  const amounts = participants.map((participant) => ({
    participant,
    amount: calculateHourlyAmount(participant.hourlyRate, participant.estimatedHours),
  }));
  const total = amounts.reduce((sum, line) => sum + line.amount, 0);

  return {
    total,
    lines: amounts.map((line) => ({
      ...line,
      percentage: total > 0 ? (line.amount / total) * 100 : 0,
    })),
  };
}

export function readSplitSheetCompensationFields(value: unknown): Required<
  Pick<SplitSheetCompensationFields, 'compensationType' | 'currency'>
> & Omit<SplitSheetCompensationFields, 'compensationType' | 'currency'> {
  const fields = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  const legacy = fields as LegacyFeeFields;
  const rawCompensationType = fields.compensationType ?? legacy.feeType;
  const compensationType: SplitSheetCompensationType =
    rawCompensationType === 'hourly' || rawCompensationType === 'fixed'
      ? rawCompensationType
      : 'share';
  const rawCurrency = fields.currency ?? legacy.feeCurrency;
  const currencyCandidate = typeof rawCurrency === 'string'
    ? rawCurrency.trim().toUpperCase()
    : '';
  const hourlyRate = normalizeCurrencyAmount(
    fields.hourlyRate ?? (compensationType === 'hourly' ? legacy.feeAmount : undefined),
  ) || null;
  const estimatedHours = normalizeEstimatedHours(fields.estimatedHours) || null;
  const explicitAmount = normalizeCurrencyAmount(
    fields.estimatedAmount ?? (compensationType === 'fixed' ? legacy.feeAmount : undefined),
  ) || null;

  return {
    roleLabel: typeof fields.roleLabel === 'string' ? fields.roleLabel : undefined,
    compensationType,
    hourlyRate,
    estimatedHours,
    estimatedAmount: explicitAmount
      ?? (compensationType === 'hourly' && hourlyRate && estimatedHours
        ? calculateHourlyAmount(hourlyRate, estimatedHours)
        : null),
    currency: /^[A-Z]{3}$/.test(currencyCandidate) ? currencyCandidate : 'NOK',
  };
}

export function splitSheetCompensationModel(
  contributors: Array<{ compensationType?: SplitSheetCompensationType | null }>,
): 'share' | 'hourly' | 'mixed' {
  if (contributors.length === 0) return 'share';
  const shareCount = contributors.filter((item) => !item.compensationType || item.compensationType === 'share').length;
  const feeCount = contributors.length - shareCount;
  const allFeesAreHourly = feeCount > 0 && contributors.every((item) => item.compensationType === 'hourly');
  if (shareCount === 0 && allFeesAreHourly) return 'hourly';
  return feeCount > 0 ? 'mixed' : 'share';
}

export function hasRequiredSplitSheetParticipantCount(
  compensationModel: 'share' | 'hourly' | 'mixed',
  participantCount: number,
): boolean {
  return compensationModel !== 'share' || participantCount >= 2;
}
