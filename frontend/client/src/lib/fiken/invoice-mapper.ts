/**
 * Fiken Invoice Mapping Utilities
 * Maps CreatorHub quotes and contracts to Fiken invoice format
 */

import { FikenCreateInvoiceRequest } from '@/../../shared/types/fiken';

/**
 * Map Quote data to Fiken invoice request
 */
export function mapQuoteToFikenInvoice(
  quote: {
    totalAmount: string;
    clientName: string;
    clientEmail: string;
    title: string;
    description?: string;
    validUntil?: string;
    projectCreationData?: any;
  },
  fikenCustomerId: number,
): FikenCreateInvoiceRequest {
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 14); // 14 days payment term

  const totalNet = parseFloat(quote.totalAmount);
  const vatAmount = totalNet * 0.25; // 25% Norwegian VAT
  const totalGross = totalNet + vatAmount;

  return {
    issueDate: formatDateForFiken(today),
    dueDate: formatDateForFiken(dueDate),
    customerId: fikenCustomerId,
    lines: [
      {
        description: quote.title || 'Photography services',
        net: totalNet,
        vatType: 'HIGH', // 25% VAT
        incomeAccount: '3000', // Default income account (adjust as needed)
      },
    ],
    currency: 'NOK',
    invoiceText: quote.description || `Invoice for ${quote.title}`,
    yourReference: quote.clientName,
    ourReference: 'CreatorHub Norge',
    orderReference: `QUOTE-${Date.now()}`,
  };
}

/**
 * Map Contract data to Fiken invoice request
 */
export function mapContractToFikenInvoice(
  contract: {
    totalAmount: string;
    clientName: string;
    clientEmail: string;
    projectDescription: string;
    contractNumber?: string;
    eventDate?: string;
  },
  fikenCustomerId: number,
): FikenCreateInvoiceRequest {
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 14); // 14 days payment term

  const totalNet = parseFloat(contract.totalAmount);
  const vatAmount = totalNet * 0.25; // 25% Norwegian VAT
  const totalGross = totalNet + vatAmount;

  return {
    issueDate: formatDateForFiken(today),
    dueDate: formatDateForFiken(dueDate),
    customerId: fikenCustomerId,
    lines: [
      {
        description: contract.projectDescription || 'Professional services',
        net: totalNet,
        vatType: 'HIGH', // 25% VAT
        incomeAccount: '3000', // Default income account
      },
    ],
    currency: 'NOK',
    invoiceText: `Contract services: ${contract.projectDescription}`,
    yourReference: contract.clientName,
    ourReference: 'CreatorHub Norge',
    orderReference: contract.contractNumber || `CONTRACT-${Date.now()}`,
  };
}

/**
 * Format date to Fiken's YYYY-MM-DD format
 */
function formatDateForFiken(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Create or find Fiken customer ID from CreatorHub client data
 * This should call a backend endpoint that checks if customer exists in Fiken,
 * and creates one if not
 */
export async function ensureFikenCustomer(
  clientName: string,
  clientEmail: string,
  clientPhone?: string,
): Promise<number> {
  const response = await fetch('/api/fiken/customers/ensure', {
    method: 'POST',
    headers: {
      'Content-Type' : 'application/json',
    },
    body: JSON.stringify({
      name: clientName,
      email: clientEmail,
      phoneNumber: clientPhone,
      customer: true,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to ensure Fiken customer exists');
  }

  const data = await response.json();
  return data.contactId;
}
