/**
 * Fiken Account Code Mapper
 * Maps CreatorHub professions to Norwegian account codes (kontoplan).
 */

export type BusinessType = 'ENK' | 'AS' | 'ANS' | 'DA' | 'NUF' | 'unknown';
export type Profession =
  | 'photographer'
  | 'videographer'
  | 'music_producer'
  | 'vendor'
  | 'unknown';

export interface AccountCodeMapping {
  code: string;
  description: string;
  category: string;
}

type AccountType = 'services' | 'products' | 'consulting';
type AccountCodeSet = Record<AccountType, AccountCodeMapping>;

const AS_LIKE_CODES: AccountCodeSet = {
  services: {
    code: '3000',
    description: 'Salgsinntekt tjenester',
    category: 'Tjenester',
  },
  products: {
    code: '3000',
    description: 'Salgsinntekt varer',
    category: 'Varesalg',
  },
  consulting: {
    code: '3200',
    description: 'Konsulenthonorar',
    category: 'Konsulent',
  },
};

const ENK_CODES: AccountCodeSet = {
  services: {
    code: '3100',
    description: 'Honorarinntekter',
    category: 'Tjenester',
  },
  products: {
    code: '3000',
    description: 'Salgsinntekt varer',
    category: 'Varesalg',
  },
  consulting: {
    code: '3100',
    description: 'Honorarinntekter / Konsulenthonorar',
    category: 'Konsulent',
  },
};

const ACCOUNT_CODES: Record<BusinessType, AccountCodeSet> = {
  ENK: ENK_CODES,
  AS: AS_LIKE_CODES,
  ANS: { ...AS_LIKE_CODES },
  DA: { ...AS_LIKE_CODES },
  NUF: { ...AS_LIKE_CODES },
  unknown: { ...AS_LIKE_CODES },
};

const PROFESSION_ACCOUNT_TYPE: Record<Profession, AccountType> = {
  photographer: 'services',
  videographer: 'services',
  music_producer: 'services',
  vendor: 'products',
  unknown: 'services',
};

export function getIncomeAccount(
  profession: Profession,
  businessType: BusinessType,
): AccountCodeMapping {
  const accountType = PROFESSION_ACCOUNT_TYPE[profession] ?? 'services';
  const accountSet = ACCOUNT_CODES[businessType] ?? ACCOUNT_CODES.unknown;
  return accountSet[accountType];
}

export function getAvailableAccounts(businessType: BusinessType): AccountCodeMapping[] {
  const accountSet = ACCOUNT_CODES[businessType] ?? ACCOUNT_CODES.unknown;
  return Object.values(accountSet);
}

export function parseBusinessType(organizationForm: string): BusinessType {
  const form = organizationForm.toUpperCase().trim();

  if (form === 'ENK' || form === 'ENKELTPERSONFORETAK') return 'ENK';
  if (form === 'AS' || form === 'AKSJESELSKAP') return 'AS';
  if (form === 'ANS' || form === 'ANSVARLIG SELSKAP') return 'ANS';
  if (form === 'DA' || form === 'DELT ANSVAR') return 'DA';
  if (form === 'NUF' || form === 'NORSKREGISTRERT UTENLANDSK FORETAK') return 'NUF';

  if (form.includes('ENK')) return 'ENK';
  if (form.includes('ANS')) return 'ANS';
  if (form.includes('NUF')) return 'NUF';
  if (form.includes(' DA')) return 'DA';
  if (form.includes('AS')) return 'AS';

  return 'unknown';
}

export function detectBusinessTypeFromOrgNumber(orgNumber: string): BusinessType {
  const digits = orgNumber.replace(/\D/g, '');

  if (digits.length === 11) {
    return 'ENK';
  }
  if (digits.length === 9) {
    return 'AS';
  }
  return 'unknown';
}

export function getAccountDescription(
  profession: Profession,
  businessType: BusinessType,
): string {
  const account = getIncomeAccount(profession, businessType);
  const professionName = getProfessionName(profession);
  return `${account.code} - ${account.description} (${professionName}, ${businessType})`;
}

function getProfessionName(profession: Profession): string {
  const names: Record<Profession, string> = {
    photographer: 'Fotograf',
    videographer: 'Videograf',
    music_producer: 'Musikkprodusent',
    vendor: 'Leverandor',
    unknown: 'Annet',
  };
  return names[profession];
}

export function getBusinessTypeName(businessType: BusinessType): string {
  const names: Record<BusinessType, string> = {
    ENK: 'Enkeltpersonforetak (ENK)',
    AS: 'Aksjeselskap (AS)',
    ANS: 'Ansvarlig selskap (ANS)',
    DA: 'Delt ansvar (DA)',
    NUF: 'Norskregistrert utenlandsk foretak (NUF)',
    unknown: 'Ukjent selskapsform',
  };
  return names[businessType];
}

export function isValidAccountCode(code: string): boolean {
  return /^\d{4}$/.test(code);
}

export function formatAccountCode(mapping: AccountCodeMapping): string {
  return `${mapping.code} - ${mapping.description}`;
}

