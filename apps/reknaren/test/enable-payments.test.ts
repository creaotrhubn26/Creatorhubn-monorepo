import { describe, expect, it } from 'vitest';
import { EnableBankingPaymentInitiation, buildPaymentRequest, minorToAmountString } from '../src/integrations/enable-payments.js';

describe('minorToAmountString — øre → beløpsstreng (ingen flyttall)', () => {
  it('formaterer med to desimaler', () => {
    expect(minorToAmountString(123450n, 'NOK')).toBe('1234.50');
    expect(minorToAmountString(5n, 'NOK')).toBe('0.05');
    expect(minorToAmountString(100n, 'NOK')).toBe('1.00');
  });
});

describe('buildPaymentRequest', () => {
  it('bygger PIS-body med KID-referanse + IBAN når KID finnes', () => {
    const body = buildPaymentRequest({
      aspspName: 'SpareBank 1 Østlandet', creditorName: 'Adobe AS', creditorIban: 'NO6418024501155',
      amountMinor: 124900n, currency: 'NOK', kid: '1234567890', redirectUrl: 'https://x/cb', state: 'pay:doc1',
    }) as Record<string, any>;
    const tx = body.payment_request.credit_transfer_transaction[0];
    expect(tx.instructed_amount).toEqual({ amount: '1249.00', currency: 'NOK' });
    expect(tx.creditor_account).toEqual({ iban: 'NO6418024501155' });
    expect(tx.remittance_information_structured.creditor_reference.reference).toBe('1234567890');
    expect(body.aspsp).toEqual({ name: 'SpareBank 1 Østlandet', country: 'NO' });
    expect(body.state).toBe('pay:doc1');
  });

  it('bruker BBAN + fri melding når IBAN/KID mangler', () => {
    const body = buildPaymentRequest({
      aspspName: 'DNB', creditorName: 'Ola', creditorBban: '1234 56 78903',
      amountMinor: 5000n, currency: 'NOK', message: 'Faktura 42', redirectUrl: 'https://x/cb', state: 's',
    }) as Record<string, any>;
    const tx = body.payment_request.credit_transfer_transaction[0];
    expect(tx.creditor_account).toEqual({ other: { identification: '12345678903', scheme_name: 'BBAN' } });
    expect(tx.remittance_information).toEqual(['Faktura 42']);
  });
});

describe('EnableBankingPaymentInitiation — inaktiv uten creds', () => {
  it('configured=false og initiatePayment kaster ærlig', async () => {
    const c = new EnableBankingPaymentInitiation(undefined);
    expect(c.configured).toBe(false);
    await expect(c.initiatePayment({ aspspName: 'x', creditorName: 'y', amountMinor: 1n, currency: 'NOK', redirectUrl: 'z', state: 's' }))
      .rejects.toThrow();
  });
});
