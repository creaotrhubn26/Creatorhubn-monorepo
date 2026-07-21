/**
 * Validering av dokumentuttrekk. Ved avvik går dokumentet til avvikskø
 * (status needs_review) i stedet for videre til forslag/bokføring.
 */
import type { RuleRegister } from '../rules/register.js';
import type { ExtractedData, ValidationIssue } from './types.js';

export function validateExtraction(
  rules: RuleRegister,
  data: ExtractedData,
  suggestedVatCode?: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (data.currency === undefined) {
    issues.push({ code: 'missing_currency', message: 'Valuta mangler i dokumentet.', severity: 'error' });
  }
  if (data.grossMinor === undefined) {
    issues.push({ code: 'missing_total', message: 'Totalbeløp mangler.', severity: 'error' });
  }

  // Netto + mva skal bli brutto.
  if (data.netMinor !== undefined && data.vatMinor !== undefined && data.grossMinor !== undefined) {
    if (data.netMinor + data.vatMinor !== data.grossMinor) {
      issues.push({
        code: 'sum_mismatch',
        message: `Netto (${data.netMinor}) + mva (${data.vatMinor}) stemmer ikke med totalbeløpet (${data.grossMinor}).`,
        severity: 'error',
      });
    }
  }

  // Linjesummer skal stemme med netto (om linjer finnes).
  if (data.lineItems?.length && data.netMinor !== undefined) {
    const lineSum = data.lineItems.reduce((acc, l) => acc + l.amountMinor, 0n);
    if (lineSum !== data.netMinor && lineSum !== data.grossMinor) {
      issues.push({
        code: 'line_sum_mismatch',
        message: `Linjesummen (${lineSum}) stemmer verken med netto eller brutto.`,
        severity: 'error',
      });
    }
  }

  // MVA-spesifikasjon skal summere til mva-beløpet.
  if (data.vatBreakdown?.length && data.vatMinor !== undefined) {
    const vatSum = data.vatBreakdown.reduce((acc, l) => acc + l.vatMinor, 0n);
    if (vatSum !== data.vatMinor) {
      issues.push({
        code: 'vat_breakdown_mismatch',
        message: `MVA-spesifikasjonen (${vatSum}) stemmer ikke med mva-beløpet (${data.vatMinor}).`,
        severity: 'error',
      });
    }
  }

  // Norsk leverandør skal ha gyldig org.nummer om oppgitt.
  if (data.vendorOrgNumber !== undefined && !/^\d{9}$/.test(data.vendorOrgNumber)) {
    issues.push({
      code: 'implausible_org_number',
      message: `Organisasjonsnummeret "${data.vendorOrgNumber}" ser ikke gyldig ut.`,
      severity: 'warning',
    });
  }

  // Utenlandsk tjeneste med norsk mva er et rødt flagg.
  if (data.foreignService && data.vatMinor !== undefined && data.vatMinor > 0n && data.currency !== 'NOK') {
    issues.push({
      code: 'foreign_vat',
      message:
        'Dokumentet ser ut som en utenlandsk tjeneste, men inneholder mva. Utenlandsk mva er normalt ikke fradragsberettiget i Norge — kontroller behandlingen.',
      severity: 'warning',
    });
  }

  if (data.documentType === 'supplier_invoice' && !data.invoiceNumber) {
    issues.push({
      code: 'missing_invoice_number',
      message: 'Fakturanummer mangler — dokumentet oppfyller ikke kravene til salgsdokument.',
      severity: 'error',
    });
  }

  void suggestedVatCode;
  return issues;
}

export function hasBlockingIssues(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}
