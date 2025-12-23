/**
 * Fiken API Client
 * Methods for interacting with Fiken API v2
 */

import {
  FikenCompany,
  FikenContact,
  FikenCreateContactRequest,
  FikenProduct,
  FikenCreateProductRequest,
  FikenInvoice,
  FikenCreateInvoiceRequest,
  FikenInvoiceDraft,
  FikenSale,
  FikenPayment,
  FikenAccount,
  FikenErrorResponse,
} from '@/../../shared/types/fiken';

const FIKEN_API_BASE = 'https://api.fiken.no/api/v2';

/**
 * Base Fiken API client class
 */
export class FikenAPIClient {
  private accessToken: string;
  private companySlug: string;

  constructor(accessToken: string, companySlug: string) {
    this.accessToken = accessToken;
    this.companySlug = companySlug;
  }

  /**
   * Make authenticated API request to Fiken
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${FIKEN_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error: FikenErrorResponse = await response.json().catch(() => ({
        code: 'UNKNOWN_ERROR',
        message: `API request failed with status ${response.status}`,
      }));

      throw new Error(error.message || `Fiken API error: ${error.code}`);
    }

    return response.json();
  }

  // ============================================
  // COMPANIES
  // ============================================

  /**
   * Get all companies accessible to the user
   */
  async getCompanies(): Promise<FikenCompany[]> {
    return this.request<FikenCompany[]>('/companies');
  }

  /**
   * Get specific company details
   */
  async getCompany(): Promise<FikenCompany> {
    return this.request<FikenCompany>(`/companies/${this.companySlug}`);
  }

  // ============================================
  // CONTACTS (CUSTOMERS)
  // ============================================

  /**
   * Get all contacts
   */
  async getContacts(params?: {
    page?: number;
    pageSize?: number;
    customerNumber?: number;
    name?: string;
  }): Promise<FikenContact[]> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString());
    if (params?.customerNumber) query.append('customerNumber', params.customerNumber.toString());
    if (params?.name) query.append('name', params.name);

    const endpoint = `/companies/${this.companySlug}/contacts${query.toString() ? `?${query}` : ', '}`;
    return this.request<FikenContact[]>(endpoint);
  }

  /**
   * Get specific contact by ID
   */
  async getContact(contactId: number): Promise<FikenContact> {
    return this.request<FikenContact>(`/companies/${this.companySlug}/contacts/${contactId}`);
  }

  /**
   * Create new contact (customer)
   */
  async createContact(data: FikenCreateContactRequest): Promise<void> {
    return this.request<void>(`/companies/${this.companySlug}/contacts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update existing contact
   */
  async updateContact(contactId: number, data: Partial<FikenCreateContactRequest>): Promise<void> {
    return this.request<void>(`/companies/${this.companySlug}/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ============================================
  // PRODUCTS
  // ============================================

  /**
   * Get all products
   */
  async getProducts(params?: {
    page?: number;
    pageSize?: number;
    productNumber?: string;
    name?: string;
    active?: boolean;
  }): Promise<FikenProduct[]> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString());
    if (params?.productNumber) query.append('productNumber', params.productNumber);
    if (params?.name) query.append('name', params.name);
    if (params?.active !== undefined) query.append('active', params.active.toString());

    const endpoint = `/companies/${this.companySlug}/products${query.toString() ? `?${query}` : ', '}`;
    return this.request<FikenProduct[]>(endpoint);
  }

  /**
   * Get specific product by ID
   */
  async getProduct(productId: number): Promise<FikenProduct> {
    return this.request<FikenProduct>(`/companies/${this.companySlug}/products/${productId}`);
  }

  /**
   * Create new product
   */
  async createProduct(data: FikenCreateProductRequest): Promise<void> {
    return this.request<void>(`/companies/${this.companySlug}/products`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update existing product
   */
  async updateProduct(productId: number, data: Partial<FikenCreateProductRequest>): Promise<void> {
    return this.request<void>(`/companies/${this.companySlug}/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ============================================
  // INVOICE DRAFTS
  // ============================================

  /**
   * Get all invoice drafts
   */
  async getInvoiceDrafts(params?: {
    page?: number;
    pageSize?: number;
  }): Promise<FikenInvoiceDraft[]> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString());

    const endpoint = `/companies/${this.companySlug}/invoices/drafts${query.toString() ? `?${query}` : ', '}`;
    return this.request<FikenInvoiceDraft[]>(endpoint);
  }

  /**
   * Create invoice draft
   */
  async createInvoiceDraft(data: FikenCreateInvoiceRequest): Promise<{ draftId: number }> {
    return this.request<{ draftId: number }>(`/companies/${this.companySlug}/invoices/drafts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get specific invoice draft
   */
  async getInvoiceDraft(draftId: number): Promise<FikenInvoiceDraft> {
    return this.request<FikenInvoiceDraft>(
      `/companies/${this.companySlug}/invoices/drafts/${draftId}`,
    );
  }

  /**
   * Update invoice draft
   */
  async updateInvoiceDraft(draftId: number, data: FikenCreateInvoiceRequest): Promise<void> {
    return this.request<void>(`/companies/${this.companySlug}/invoices/drafts/${draftId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete invoice draft
   */
  async deleteInvoiceDraft(draftId: number): Promise<void> {
    return this.request<void>(`/companies/${this.companySlug}/invoices/drafts/${draftId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Create invoice from draft (finalizes the invoice)
   */
  async createInvoiceFromDraft(draftId: number): Promise<{ invoiceId: number }> {
    return this.request<{ invoiceId: number }>(
      `/companies/${this.companySlug}/invoices/drafts/${draftId}/createInvoice`,
      {
        method: 'POST',
      },
    );
  }

  // ============================================
  // INVOICES
  // ============================================

  /**
   * Get all invoices
   */
  async getInvoices(params?: {
    page?: number;
    pageSize?: number;
    issueDate?: string;
    issueDateFrom?: string;
    issueDateTo?: string;
    settled?: boolean;
  }): Promise<FikenInvoice[]> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString());
    if (params?.issueDate) query.append('issueDate', params.issueDate);
    if (params?.issueDateFrom) query.append('issueDateFrom', params.issueDateFrom);
    if (params?.issueDateTo) query.append('issueDateTo', params.issueDateTo);
    if (params?.settled !== undefined) query.append('settled', params.settled.toString());

    const endpoint = `/companies/${this.companySlug}/invoices${query.toString() ? `?${query}` : ', '}`;
    return this.request<FikenInvoice[]>(endpoint);
  }

  /**
   * Get specific invoice by ID
   */
  async getInvoice(invoiceId: number): Promise<FikenInvoice> {
    return this.request<FikenInvoice>(`/companies/${this.companySlug}/invoices/${invoiceId}`);
  }

  /**
   * Send invoice via email
   */
  async sendInvoice(
    invoiceId: number,
    params?: {
      includeDocumentAttachments?: boolean;
      message?: string;
      recipientEmail?: string;
      recipientName?: string;
    },
  ): Promise<void> {
    const query = new URLSearchParams();
    if (params?.includeDocumentAttachments) query.append('includeDocumentAttachments', 'true');
    if (params?.message) query.append('message', params.message);
    if (params?.recipientEmail) query.append('recipientEmail', params.recipientEmail);
    if (params?.recipientName) query.append('recipientName', params.recipientName);

    return this.request<void>(
      `/companies/${this.companySlug}/invoices/${invoiceId}/send${query.toString() ? `?${query}` : ''}`,
      {
        method: 'POST',
      },
    );
  }

  // ============================================
  // SALES
  // ============================================

  /**
   * Get all sales
   */
  async getSales(params?: {
    page?: number;
    pageSize?: number;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<FikenSale[]> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString());
    if (params?.date) query.append('date', params.date);
    if (params?.dateFrom) query.append('dateFrom', params.dateFrom);
    if (params?.dateTo) query.append('dateTo', params.dateTo);

    const endpoint = `/companies/${this.companySlug}/sales${query.toString() ? `?${query}` : ', '}`;
    return this.request<FikenSale[]>(endpoint);
  }

  /**
   * Get specific sale by ID
   */
  async getSale(saleId: number): Promise<FikenSale> {
    return this.request<FikenSale>(`/companies/${this.companySlug}/sales/${saleId}`);
  }

  // ============================================
  // PAYMENTS
  // ============================================

  /**
   * Get payments for an invoice
   */
  async getInvoicePayments(invoiceId: number): Promise<FikenPayment[]> {
    return this.request<FikenPayment[]>(
      `/companies/${this.companySlug}/invoices/${invoiceId}/payments`,
    );
  }

  // ============================================
  // ACCOUNTS
  // ============================================

  /**
   * Get chart of accounts
   */
  async getAccounts(params?: {
    page?: number;
    pageSize?: number;
    fromDate?: string;
    toDate?: string;
  }): Promise<FikenAccount[]> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.pageSize) query.append('pageSize', params.pageSize.toString());
    if (params?.fromDate) query.append('fromDate', params.fromDate);
    if (params?.toDate) query.append('toDate', params.toDate);

    const endpoint = `/companies/${this.companySlug}/accounts${query.toString() ? `?${query}` :''}`;
    return this.request<FikenAccount[]>(endpoint);
  }
}

/**
 * Create Fiken API client instance
 */
export function createFikenClient(accessToken: string, companySlug: string): FikenAPIClient {
  return new FikenAPIClient(accessToken, companySlug);
}
