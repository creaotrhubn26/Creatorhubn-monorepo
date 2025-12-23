/**
 * Fiken API Types and Interfaces
 * Based on Fiken API v2 documentation: https://api.fiken.no/api/v2/docs/
 */

// ============================================
// OAUTH & AUTHENTICATION
// ============================================

export interface FikenOAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
  scope: string;
}

export interface FikenAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  error: string | null;
  companySlug: string | null;
}

export interface FikenIntegrationConfig {
  userId: string;
  businessId?: string;

  // OAuth tokens
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;

  // Fiken company info
  fikenCompanySlug: string;
  fikenCompanyName: string;
  fikenOrganizationNumber: string;

  // Sync settings
  autoSyncInvoices: boolean;
  autoSyncCustomers: boolean;
  autoSyncProducts: boolean;

  // Metadata
  connectedAt: Date;
  lastSyncAt: Date | null;
  isActive: boolean;
}

// ============================================
// FIKEN COMPANY
// ============================================

export interface FikenCompany {
  name: string;
  slug: string;
  organizationNumber: string;
  vatType: 'registered' | 'exempted' | 'abroad';
  address?: {
    streetAddress?: string;
    city?: string;
    postCode?: string;
    country?: string;
  };
  phoneNumber?: string;
  email?: string;
  hasApiAccess: boolean;
  testCompany: boolean;
  accountingStartDate: string; // YYYY-MM-DD
  createdDate: string; // ISO 8601
}

// ============================================
// FIKEN CONTACT (CUSTOMER)
// ============================================

export interface FikenContact {
  contactId: number;
  name: string;
  email?: string;
  organizationNumber?: string;
  customerNumber?: number;
  customer: boolean;
  supplier: boolean;
  contactPerson?: {
    name?: string;
    email?: string;
    phoneNumber?: string;
  };
  phoneNumber?: string;
  memberNumber?: string;
  address?: {
    streetAddress?: string;
    city?: string;
    postCode?: string;
    country?: string;
  };
  groups?: string[];
  inactive: boolean;
  createdDate: string; // ISO 8601
  lastModifiedDate: string; // ISO 8601
}

export interface FikenCreateContactRequest {
  name: string;
  email?: string;
  organizationNumber?: string;
  customerNumber?: number;
  customer?: boolean;
  supplier?: boolean;
  phoneNumber?: string;
  address?: {
    streetAddress?: string;
    city?: string;
    postCode?: string;
    country?: string;
  };
}

// ============================================
// FIKEN PRODUCT
// ============================================

export interface FikenProduct {
  productId: number;
  name: string;
  unitPrice: number;
  incomeAccount: string;
  vatType: 'HIGH' | 'MEDIUM' | 'LOW' | 'EXEMPT' | 'OUTSIDE' | 'NONE';
  active: boolean;
  productNumber?: string;
  note?: string;
  createdDate: string;
  lastModifiedDate: string;
}

export interface FikenCreateProductRequest {
  name: string;
  unitPrice: number;
  incomeAccount: string;
  vatType: 'HIGH' | 'MEDIUM' | 'LOW' | 'EXEMPT' | 'OUTSIDE' | 'NONE';
  productNumber?: string;
  note?: string;
  active?: boolean;
}

// ============================================
// FIKEN INVOICE
// ============================================

export interface FikenInvoice {
  invoiceId: number;
  invoiceNumber: string;
  kid?: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  customerId: number;
  contactPerson?: {
    name?: string;
    email?: string;
    phoneNumber?: string;
  };
  lines: FikenInvoiceLine[];
  currency: string;
  totalPaid: number;
  totalPaidInCurrency: number;
  net: number;
  vat: number;
  gross: number;
  settled: boolean;
  creditNoteIssued: boolean;
  invoiceText?: string;
  yourReference?: string;
  ourReference?: string;
  orderReference?: string;
  projectId?: number;
  cash: boolean;
  createdDate: string;
  lastModifiedDate: string;
}

export interface FikenInvoiceLine {
  net: number;
  vat: number;
  gross: number;
  vatType: 'HIGH' | 'MEDIUM' | 'LOW' | 'EXEMPT' | 'OUTSIDE' | 'NONE';
  description?: string;
  comment?: string;
  productId?: number;
  productName?: string;
  incomeAccount?: string;
}

export interface FikenCreateInvoiceRequest {
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  customerId: number;
  lines: Array<{
    description?: string;
    net: number;
    vatType: 'HIGH' | 'MEDIUM' | 'LOW' | 'EXEMPT' | 'OUTSIDE' | 'NONE';
    productId?: number;
    incomeAccount?: string;
  }>;
  currency?: string;
  invoiceText?: string;
  yourReference?: string;
  ourReference?: string;
  orderReference?: string;
  bankAccountCode?: string;
  iban?: string;
  bic?: string;
  paymentAccount?: string;
  cash?: boolean;
  contactPerson?: {
    name?: string;
    email?: string;
    phoneNumber?: string;
  };
}

export interface FikenInvoiceDraft extends FikenCreateInvoiceRequest {
  draftId: number;
  uuid: string;
  createdDate: string;
  lastModifiedDate: string;
}

// ============================================
// FIKEN SALE (COMPLETED INVOICE)
// ============================================

export interface FikenSale {
  saleId: number;
  saleNumber: string;
  date: string; // YYYY-MM-DD
  kind: 'CASH_SALE' | 'INVOICE';
  totalPaid: number;
  totalPaidInCurrency: number;
  currency: string;
  settled: boolean;
  customerId?: number;
  lines: Array<{
    net: number;
    vat: number;
    gross: number;
    vatType: string;
    description?: string;
    productId?: number;
  }>;
  createdDate: string;
  lastModifiedDate: string;
}

// ============================================
// FIKEN PAYMENT
// ============================================

export interface FikenPayment {
  paymentId: number;
  date: string; // YYYY-MM-DD
  account: string;
  amount: number;
  currency: string;
  kid?: string;
  saleId?: number;
  invoiceId?: number;
  createdDate: string;
  lastModifiedDate: string;
}

// ============================================
// FIKEN ACCOUNTS
// ============================================

export interface FikenAccount {
  code: string;
  name: string;
  vatCode?: number;
  fromDate: string;
  toDate?: string;
  active: boolean;
}

// ============================================
// FIKEN VAT TYPES
// ============================================

export type FikenVatType = 'HIGH' | 'MEDIUM' | 'LOW' | 'EXEMPT' | 'OUTSIDE' | 'NONE';

export const FIKEN_VAT_RATES: Record<FikenVatType, number> = {
  HIGH: 0.25, // 25% - Standard VAT in Norway
  MEDIUM: 0.15, // 15% - Food products
  LOW: 0.12, // 12% - Transportation, hotels, etc.
  EXEMPT: 0, // 0% - Exempt from VAT
  OUTSIDE: 0, // 0% - Outside VAT system
  NONE: 0, // 0% - No VAT
};

// ============================================
// FIKEN SYNC STATUS
// ============================================

export interface FikenSyncStatus {
  lastSync: Date | null;
  isSyncing: boolean;
  error: string | null;
  stats: {
    invoicesSynced: number;
    customersSynced: number;
    productsSynced: number;
    errorCount: number;
  };
}

// ============================================
// FIKEN ERROR RESPONSES
// ============================================

export interface FikenErrorResponse {
  code: string;
  message: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

// ============================================
// HELPER TYPES
// ============================================

export interface FikenPaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FikenApiConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}
