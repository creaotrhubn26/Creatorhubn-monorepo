type TripletexSessionToken = {
  token?: string | null;
  expirationDate?: string | null;
};

type TripletexResponseWrapper<T> = {
  value?: T | null;
};

type TripletexListResponse<T> = {
  values?: T[] | null;
};

type TripletexEmployee = {
  id?: number | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

type TripletexCompany = {
  id?: number | null;
  name?: string | null;
  organizationNumber?: string | null;
};

type TripletexWhoAmI = {
  employeeId?: number | null;
  employee?: TripletexEmployee | null;
  companyId?: number | null;
  company?: TripletexCompany | null;
};

type TripletexCustomer = {
  id?: number | null;
  name?: string | null;
  email?: string | null;
  invoiceEmail?: string | null;
  organizationNumber?: string | null;
  phoneNumber?: string | null;
  postalAddress?: {
    addressLine1?: string | null;
    postalCode?: string | null;
    city?: string | null;
  } | null;
};

type TripletexVatType = {
  id?: number | null;
  percentage?: number | null;
  name?: string | null;
  number?: string | null;
};

type TripletexOrderLine = {
  description?: string;
  count?: number;
  unitPriceExcludingVatCurrency?: number;
  currency?: {
    code: string;
  };
  vatType?: {
    id: number;
  };
};

type TripletexOrder = {
  customer?: {
    id: number;
  };
  orderDate?: string;
  deliveryDate?: string;
  isPrioritizeAmountsIncludingVat?: boolean;
  currency?: {
    code: string;
    factor?: number;
  };
  invoiceComment?: string;
  orderLines?: TripletexOrderLine[];
};

type TripletexInvoice = {
  id?: number | null;
  invoiceNumber?: number | null;
  voucher?: {
    id?: number | null;
  } | null;
  customer?: {
    id?: number | null;
    name?: string | null;
  } | null;
  amount?: number | null;
  currency?: {
    code?: string | null;
  } | null;
};

export type TripletexConnectionSummary = {
  configured: boolean;
  environment: "test";
  baseUrl: string;
  companyId: string | null;
  companyName: string | null;
  organizationNumber: string | null;
  employeeId: string | null;
  employeeName: string | null;
  employeeEmail: string | null;
  sessionExpiresAt: string | null;
};

export type TripletexEnsureCustomerInput = {
  customerName: string;
  organizationNumber?: string | null;
  email?: string | null;
  invoiceEmail?: string | null;
  phoneNumber?: string | null;
  addressLine1?: string | null;
  postalCode?: string | null;
  city?: string | null;
  website?: string | null;
};

export type TripletexEnsureCustomerResult = {
  id: string;
  name: string;
  organizationNumber: string | null;
  email: string | null;
};

export type TripletexCreateInvoiceInput = {
  customer: TripletexEnsureCustomerInput;
  title: string;
  description?: string | null;
  quoteNumber?: string | null;
  totalAmountNok: number;
  currency?: string | null;
  dueDate?: string | null;
  sendToCustomer?: boolean;
};

export type TripletexCreateInvoiceResult = {
  invoiceId: string;
  invoiceNumber: string | null;
  voucherId: string | null;
  invoicePdfPath: string;
  voucherPdfPath: string | null;
};

export class TripletexApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status = 500, details: unknown = null) {
    super(message);
    this.name = "TripletexApiError";
    this.status = status;
    this.details = details;
  }
}

let sessionCache:
  | {
      token: string;
      expiresAt: string | null;
    }
  | null = null;

function readEnvString(key: string): string | null {
  const value = process.env[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value: unknown): string | null {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function addDaysIso(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function ensurePositiveNumber(value: unknown, fallback = 0): number {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function buildBasicAuth(sessionToken: string) {
  return `Basic ${Buffer.from(`0:${sessionToken}`).toString("base64")}`;
}

function unwrapValue<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "value" in payload) {
    return (payload as TripletexResponseWrapper<T>).value as T;
  }
  return payload as T;
}

function unwrapValues<T>(payload: unknown): T[] {
  if (payload && typeof payload === "object" && "values" in payload) {
    return ((payload as TripletexListResponse<T>).values ?? []) as T[];
  }
  return Array.isArray(payload) ? (payload as T[]) : [];
}

function createTripletexError(
  status: number,
  details: unknown,
  fallbackMessage: string,
) {
  let message = fallbackMessage;
  if (details && typeof details === "object") {
    const candidate = details as { message?: unknown; error?: unknown };
    if (typeof candidate.message === "string" && candidate.message.trim()) {
      message = candidate.message;
    } else if (typeof candidate.error === "string" && candidate.error.trim()) {
      message = candidate.error;
    }
  } else if (typeof details === "string" && details.trim()) {
    message = details;
  }

  return new TripletexApiError(message, status, details);
}

async function parseTripletexResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function isTripletexConfigured() {
  return Boolean(
    readEnvString("TRIPLETEX_TEST_CONSUMER_TOKEN") &&
      readEnvString("TRIPLETEX_TEST_EMPLOYEE_TOKEN"),
  );
}

export class TripletexApiClient {
  private readonly baseUrl: string;
  private readonly consumerToken: string | null;
  private readonly employeeToken: string | null;

  constructor() {
    this.baseUrl =
      readEnvString("TRIPLETEX_TEST_BASE_URL") || "https://api-test.tripletex.tech/v2";
    this.consumerToken = readEnvString("TRIPLETEX_TEST_CONSUMER_TOKEN");
    this.employeeToken = readEnvString("TRIPLETEX_TEST_EMPLOYEE_TOKEN");
  }

  private ensureConfigured() {
    if (!this.consumerToken || !this.employeeToken) {
      throw new TripletexApiError(
        "Tripletex testmiljø er ikke konfigurert i backend. Legg inn TRIPLETEX_TEST_CONSUMER_TOKEN og TRIPLETEX_TEST_EMPLOYEE_TOKEN.",
        503,
      );
    }
  }

  private async createSessionToken(forceRefresh = false) {
    this.ensureConfigured();

    if (!forceRefresh && sessionCache?.token) {
      const expiresAt = sessionCache.expiresAt ? new Date(sessionCache.expiresAt).getTime() : null;
      if (!expiresAt || expiresAt - Date.now() > 5 * 60 * 1000) {
        return sessionCache;
      }
    }

    const expirationDate =
      readEnvString("TRIPLETEX_TEST_SESSION_EXPIRATION_DATE") || addDaysIso(7);
    const url = new URL(`${this.baseUrl}/token/session/:create`);
    url.searchParams.set("consumerToken", this.consumerToken as string);
    url.searchParams.set("employeeToken", this.employeeToken as string);
    url.searchParams.set("expirationDate", expirationDate);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await parseTripletexResponse(response);
    if (!response.ok) {
      throw createTripletexError(
        response.status,
        payload,
        "Kunne ikke opprette Tripletex session-token.",
      );
    }

    const session = unwrapValue<TripletexSessionToken>(payload);
    const token = normalizeOptionalString(session?.token);
    if (!token) {
      throw new TripletexApiError(
        "Tripletex svarte uten session-token.",
        502,
        payload,
      );
    }

    sessionCache = {
      token,
      expiresAt: normalizeOptionalString(session?.expirationDate),
    };

    return sessionCache;
  }

  private async request<T>(
    path: string,
    input?: {
      method?: string;
      query?: Record<string, string | number | boolean | null | undefined>;
      body?: unknown;
      accept?: string;
    },
  ): Promise<T> {
    const session = await this.createSessionToken();
    const url = new URL(`${this.baseUrl}${path}`);

    for (const [key, value] of Object.entries(input?.query || {})) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }

    const isBinary = input?.accept === "application/pdf";
    const response = await fetch(url.toString(), {
      method: input?.method || (input?.body ? "POST" : "GET"),
      headers: {
        Accept: input?.accept || "application/json",
        Authorization: buildBasicAuth(session.token),
        ...(input?.body ? { "Content-Type": "application/json; charset=utf-8" } : {}),
      },
      body: input?.body ? JSON.stringify(input.body) : undefined,
    });

    if (isBinary) {
      if (!response.ok) {
        const payload = await parseTripletexResponse(response);
        throw createTripletexError(
          response.status,
          payload,
          "Kunne ikke hente PDF fra Tripletex.",
        );
      }
      return (await response.arrayBuffer()) as T;
    }

    const payload = await parseTripletexResponse(response);
    if (!response.ok) {
      throw createTripletexError(
        response.status,
        payload,
        "Tripletex-kallet feilet.",
      );
    }

    return payload as T;
  }

  async getConnectionSummary(): Promise<TripletexConnectionSummary> {
    this.ensureConfigured();
    const whoAmIResponse = await this.request<TripletexResponseWrapper<TripletexWhoAmI>>(
      "/token/session/>whoAmI",
    );
    const whoAmI = unwrapValue<TripletexWhoAmI>(whoAmIResponse);
    const companyId = whoAmI?.companyId ? String(whoAmI.companyId) : null;

    let companyName = normalizeOptionalString(whoAmI?.company?.name);
    let organizationNumber = normalizeOptionalString(
      whoAmI?.company?.organizationNumber,
    );

    if (companyId) {
      try {
        const companyResponse = await this.request<TripletexResponseWrapper<TripletexCompany>>(
          `/company/${encodeURIComponent(companyId)}`,
        );
        const company = unwrapValue<TripletexCompany>(companyResponse);
        companyName = normalizeOptionalString(company?.name) || companyName;
        organizationNumber =
          normalizeOptionalString(company?.organizationNumber) || organizationNumber;
      } catch (error) {
        // Allow the connection summary to succeed even if company lookup fails.
      }
    }

    const firstName = normalizeOptionalString(whoAmI?.employee?.firstName);
    const lastName = normalizeOptionalString(whoAmI?.employee?.lastName);
    const employeeName = [firstName, lastName].filter(Boolean).join(" ") || null;

    return {
      configured: true,
      environment: "test",
      baseUrl: this.baseUrl,
      companyId,
      companyName,
      organizationNumber,
      employeeId: whoAmI?.employeeId ? String(whoAmI.employeeId) : null,
      employeeName,
      employeeEmail: normalizeEmail(whoAmI?.employee?.email),
      sessionExpiresAt: sessionCache?.expiresAt || null,
    };
  }

  async ensureCustomer(
    input: TripletexEnsureCustomerInput,
  ): Promise<TripletexEnsureCustomerResult> {
    const organizationNumber = normalizeOptionalString(input.organizationNumber);
    const invoiceEmail = normalizeEmail(input.invoiceEmail || input.email);
    const directEmail = normalizeEmail(input.email);
    const customerName =
      normalizeOptionalString(input.customerName) || "CreatorHub-kunde";

    const queryCandidates = [
      organizationNumber ? { organizationNumber, count: 20 } : null,
      invoiceEmail ? { invoiceEmail, count: 20 } : null,
      directEmail ? { email: directEmail, count: 20 } : null,
    ].filter(Boolean) as Array<Record<string, string | number>>;

    for (const query of queryCandidates) {
      const response = await this.request<TripletexListResponse<TripletexCustomer>>(
        "/customer",
        { query },
      );
      const match = unwrapValues<TripletexCustomer>(response)[0];
      if (match?.id) {
        return {
          id: String(match.id),
          name: normalizeOptionalString(match.name) || customerName,
          organizationNumber:
            normalizeOptionalString(match.organizationNumber) || organizationNumber,
          email:
            normalizeEmail(match.invoiceEmail) ||
            normalizeEmail(match.email) ||
            invoiceEmail ||
            null,
        };
      }
    }

    const createBody: Record<string, unknown> = {
      name: customerName,
      email: directEmail,
      invoiceEmail,
      organizationNumber,
      phoneNumber: normalizeOptionalString(input.phoneNumber),
      language: "NO",
      invoiceSendMethod: invoiceEmail ? "EMAIL" : "MANUAL",
      emailAttachmentType: "ATTACHMENT",
      isSupplier: false,
      website: normalizeOptionalString(input.website),
      postalAddress:
        normalizeOptionalString(input.addressLine1) ||
        normalizeOptionalString(input.postalCode) ||
        normalizeOptionalString(input.city)
          ? {
              addressLine1: normalizeOptionalString(input.addressLine1),
              postalCode: normalizeOptionalString(input.postalCode),
              city: normalizeOptionalString(input.city),
            }
          : undefined,
    };

    const createdResponse = await this.request<TripletexResponseWrapper<TripletexCustomer>>(
      "/customer",
      {
        method: "POST",
        body: createBody,
      },
    );
    const created = unwrapValue<TripletexCustomer>(createdResponse);
    if (!created?.id) {
      throw new TripletexApiError(
        "Tripletex opprettet ikke kunde som forventet.",
        502,
        createdResponse,
      );
    }

    return {
      id: String(created.id),
      name: normalizeOptionalString(created.name) || customerName,
      organizationNumber:
        normalizeOptionalString(created.organizationNumber) || organizationNumber,
      email:
        normalizeEmail(created.invoiceEmail) ||
        normalizeEmail(created.email) ||
        invoiceEmail ||
        null,
    };
  }

  private async resolveHighVatTypeId() {
    const vatTypesResponse = await this.request<TripletexListResponse<TripletexVatType>>(
      "/ledger/vatType",
      {
        query: {
          count: 50,
        },
      },
    );

    const vatTypes = unwrapValues<TripletexVatType>(vatTypesResponse);
    const exactHighVat =
      vatTypes.find((entry) => ensurePositiveNumber(entry.percentage, -1) === 25) ||
      vatTypes.find((entry) =>
        String(entry.name || "")
          .toLowerCase()
          .includes("25"),
      ) ||
      null;

    if (!exactHighVat?.id) {
      throw new TripletexApiError(
        "Fant ikke en 25 % MVA-type i Tripletex testmiljøet.",
        500,
      );
    }

    return exactHighVat.id;
  }

  async createInvoiceFromQuote(
    input: TripletexCreateInvoiceInput,
  ): Promise<TripletexCreateInvoiceResult> {
    const customer = await this.ensureCustomer(input.customer);
    const vatTypeId = await this.resolveHighVatTypeId();
    const totalAmountNok = ensurePositiveNumber(input.totalAmountNok, 0);
    const netAmount = Number((totalAmountNok / 1.25).toFixed(2));
    const invoiceDate = new Date().toISOString().slice(0, 10);
    const dueDate =
      normalizeOptionalString(input.dueDate) || addDaysIso(14);

    const invoicePayload = {
      invoiceNumber: 0,
      invoiceDate,
      invoiceDueDate: dueDate,
      customer: {
        id: Number(customer.id),
      },
      comment: normalizeOptionalString(input.description),
      currency: {
        code: normalizeOptionalString(input.currency) || "NOK",
        factor: 1,
      },
      orders: [
        {
          customer: {
            id: Number(customer.id),
          },
          orderDate: invoiceDate,
          deliveryDate: invoiceDate,
          isPrioritizeAmountsIncludingVat: false,
          currency: {
            code: normalizeOptionalString(input.currency) || "NOK",
            factor: 1,
          },
          invoiceComment: normalizeOptionalString(input.description),
          orderLines: [
            {
              description:
                normalizeOptionalString(input.title) || "CreatorHub-leveranse",
              count: 1,
              unitPriceExcludingVatCurrency: netAmount,
              currency: {
                code: normalizeOptionalString(input.currency) || "NOK",
                factor: 1,
              },
              vatType: {
                id: vatTypeId,
              },
            },
          ] as TripletexOrderLine[],
        } as TripletexOrder,
      ],
    };

    const createdInvoiceResponse = await this.request<TripletexResponseWrapper<TripletexInvoice>>(
      "/invoice",
      {
        method: "POST",
        query: {
          sendToCustomer: Boolean(input.sendToCustomer),
        },
        body: invoicePayload,
      },
    );
    const createdInvoice = unwrapValue<TripletexInvoice>(createdInvoiceResponse);
    const invoiceId = createdInvoice?.id ? String(createdInvoice.id) : null;
    if (!invoiceId) {
      throw new TripletexApiError(
        "Tripletex opprettet ikke faktura som forventet.",
        502,
        createdInvoiceResponse,
      );
    }

    return {
      invoiceId,
      invoiceNumber:
        createdInvoice?.invoiceNumber !== undefined &&
        createdInvoice?.invoiceNumber !== null
          ? String(createdInvoice.invoiceNumber)
          : null,
      voucherId:
        createdInvoice?.voucher?.id !== undefined &&
        createdInvoice?.voucher?.id !== null
          ? String(createdInvoice.voucher.id)
          : null,
      invoicePdfPath: `/api/tripletex/invoices/${encodeURIComponent(invoiceId)}/pdf`,
      voucherPdfPath:
        createdInvoice?.voucher?.id !== undefined &&
        createdInvoice?.voucher?.id !== null
          ? `/api/tripletex/vouchers/${encodeURIComponent(String(createdInvoice.voucher.id))}/pdf`
          : null,
    };
  }

  async getInvoicePdf(invoiceId: string) {
    return this.request<ArrayBuffer>(`/invoice/${encodeURIComponent(invoiceId)}/pdf`, {
      accept: "application/pdf",
    });
  }

  async getVoucherPdf(voucherId: string) {
    return this.request<ArrayBuffer>(
      `/ledger/voucher/${encodeURIComponent(voucherId)}/pdf`,
      {
        accept: "application/pdf",
      },
    );
  }
}
