/**
 * Fiken Account Code Mapper
 * Maps CreatorHub professions to correct Norwegian account codes (kontoplan)
 * Based on: https://kontohjelp.fiken.no/enk/medMva and https://kontohjelp.fiken.no/as/medMva
 */

export type BusinessType = 'ENK' | 'AS' | 'ANS' | 'DA' | 'NUF' | 'unknown';
export type Profession = 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'unknown';

export interface AccountCodeMapping {
  code: string;
  description: string;
  category: string;
}

/**
 * Norwegian account code mapping for creative professionals
 * ENK = Enkeltpersonforetak (Sole proprietorship)
 * AS = Aksjeselskap (Limited company)
 */
const ACCOUNT_CODES: Record<BusinessType, Record<string, AccountCodeMapping>> = {
  ENK: {
    // Services (Photography, Video, Music Production)
    services: {
      code: '3100',
      description: 'Honorarinntekter',
      category: 'Tjenester',
    },
    // Products (Prints, Albums, Equipment Sales)
    products: {
      code: '3000',
      description: 'Salgsinntekt varer',
      category: 'Varesalg',
    },
    // Consulting
    consulting: {
      code: '3100',
      description: 'Honorarinntekter / Konsulenthonorar',
      category: 'Konsulent',
    },
  },
  AS: {
    // Services (Photography, Video, Music Production)
    services: {
      code: '3000',
      description: 'Salgsinntekt tjenester',
      category: 'Tjenester',
    },
    // Products (Prints, Albums, Equipment Sales)
    products: {
      code: '3000',
      description: 'Salgsinntekt varer',
      category: 'Varesalg',
    },
    // Consulting
    consulting: {
      code: '3200',
      description: 'Konsulenthonorar',
      category: 'Konsulent',
    },
  },
  // ANS/DA/NUF use same as AS
  ANS: {} as any, // Will be filled from AS
  DA: {} as any,
  NUF: {} as any,
  unknown: {} as any,
};

// Copy AS codes to ANS, DA, NUF
ACCOUNT_CODES.ANS = { ...ACCOUNT_CODES.AS };
ACCOUNT_CODES.DA = { ...ACCOUNT_CODES.AS };
ACCOUNT_CODES.NUF = { ...ACCOUNT_CODES.AS };
ACCOUNT_CODES.unknown = { ...ACCOUNT_CODES.AS }; // Default to AS structure

/**
 * Profession to account type mapping
 */
const PROFESSION_ACCOUNT_TYPE: Record<Profession 'services' | 'products' | 'consulting'> = {
  photographer: 'services',
  videographer: 'services',
  music_producer: 'services',
  vendor: 'products',
  unknown: 'services',
};

/**
 * Get the correct income account code for a profession and business type
 */
export function getIncomeAccount(
  profession: Profession,
  businessType: BusinessType,
): AccountCodeMapping {
  const accountType = PROFESSION_ACCOUNT_TYPE[profession] || 'services';
  const mapping = ACCOUNT_CODES[businessType]?.[accountType] || ACCOUNT_CODES.AS.services;

  return mapping;
}

/**
 * Get all available account codes for a business type
 */
export function getAvailableAccounts(businessType: BusinessType): AccountCodeMapping[] {
  const accounts = ACCOUNT_CODES[businessType] || ACCOUNT_CODES.AS;
  return Object.values(accounts);
}

/**
 * Parse organization form from Brreg to business type
 */
export function parseBusinessType(organizationForm: string): BusinessType {
  const form = organizationForm.toUpperCase().trim();

  // Check for exact matches
  if (form === 'ENK' || form === 'ENKELTPERSONFORETAK') return 'ENK';
  if (form === 'AS' || form === 'AKSJESELSKAP') return 'AS';
  if (form === 'ANS' || form === 'ANSVARLIG SELSKAP') return 'ANS';
  if (form === 'DA' || form === 'DELT ANSVAR') return 'DA';
  if (form === 'NUF' || form === 'NORSKREGISTRERT UTENLANDSK FORETAK') return 'NUF';

  // Fallback: check if it contains the abbreviation
  if (form.includes('ENK')) return 'ENK';
  if (form.includes('AS')) return 'AS';
  if (form.includes('ANS')) return 'ANS';
  if (form.includes('DA')) return 'DA';
  if (form.includes('NUF')) return 'NUF';

  return 'unknown';
}

/**
 * Get business type from organization number
 * ENK uses 11 digits (personal number), AS uses 9 digits
 */
export function detectBusinessTypeFromOrgNumber(orgNumber: string): BusinessType {
  const digits = orgNumber.replace(/\D/g, ', ');

  if (digits.length === 11) {
    return 'ENK'; // Personal ID = sole proprietorship
  } else if (digits.length === 9) {
    return 'AS'; // Organization number = likely company (could be AS, ANS, DA, etc.)
  }

  return 'unknown';
}

/**
 * Get user-friendly description of account code
 */
export function getAccountDescription(profession: Profession, businessType: BusinessType): string {
  const account = getIncomeAccount(profession, businessType);
  const professionName = getProfessionName(profession);

  return `${account.code} - ${account.description} (${professionName}, ${businessType})`;
}

/**
 * Get Norwegian profession name
 */
function getProfessionName(profession: Profession): string {
  const names: Record<Profession, string> = {
    photographer: 'Fotograf',
    videographer: 'Videograf',
    music_producer: 'Musikkprodusent',
    vendor: 'Leverandør',
    unknown: 'Annet',
  };

  return names[profession] || 'Annet';
}

/**
 * Get business type display name
 */
export function getBusinessTypeName(businessType: BusinessType): string {
  const names: Record<BusinessType, string> = {
    ENK: 'Enkeltpersonforetak (ENK)',
    AS: 'Aksjeselskap (AS)',
    ANS: 'Ansvarlig selskap (ANS)',
    DA: 'Delt ansvar (DA)',
    NUF: 'Norskregistrert utenlandsk foretak (NUF)',
    unknown: 'Ukjent selskapsform',
  };

  return names[businessType] ||'Ukjent';
}

/**
 * Validate account code format (Norwegian standard)
 */
export function isValidAccountCode(code: string): boolean {
  // Norwegian account codes are 4 digits
  return /^\d{4}$/.test(code);
}

/**
 * Get account code with description for display
 */
export function formatAccountCode(mapping: AccountCodeMapping): string {
  return `${mapping.code} - ${mapping.description}`;
}
