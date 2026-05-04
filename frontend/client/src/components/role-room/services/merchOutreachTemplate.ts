/**
 * Merch outreach email template — Slice 4.
 *
 * Builds a Norwegian tilbudsforespørsel from a supplier + customer
 * profile + chosen product. Pure string-template — no LLM, no
 * non-determinism. Producer can edit the result freely before sending.
 */

import type {
  RoleRoomAgentMerchProductCategory,
  RoleRoomAgentMerchSupplier,
  RoleRoomAgentMerchTechnique,
  RoleRoomAgentProducerBootstrapResult,
} from './roleRoomAgentService';

export interface OutreachDraft {
  /** mailto: anchor target — null when supplier has no email. */
  recipientEmail: string | null;
  subject: string;
  body: string;
}

const TECHNIQUE_LABEL: Record<RoleRoomAgentMerchTechnique, string> = {
  screen_print: 'silketrykk',
  dtg: 'DTG (direkte på plagg)',
  embroidery: 'broderi',
  sublimation: 'sublimering',
  vinyl: 'vinyl/transfer',
  promo_products: 'promo-produkter',
  unknown: 'merch-trykk',
};

const PRODUCT_LABEL: Record<RoleRoomAgentMerchProductCategory, string> = {
  apparel: 'klær (T-skjorter, hettegensere, polo)',
  headwear: 'caps og luer',
  bags: 'bags og totebags',
  drinkware: 'krus og flasker',
  stationery: 'notatbøker, penner, kalendere',
  sports_kits: 'sportsdrakter / klubbdrakter',
  promotional: 'profilprodukter',
  vehicle_wrap: 'bilfoliering',
  signage: 'skilt, banner, rollups',
  unknown: 'merch',
};

interface BuildOutreachInput {
  supplier: RoleRoomAgentMerchSupplier;
  bootstrap: RoleRoomAgentProducerBootstrapResult | null;
  /** Optional override — when null/empty, the template asks the
   *  supplier to suggest based on the customer's brand. */
  productCategory?: RoleRoomAgentMerchProductCategory | null;
  /** Optional run quantity — when null, template says "vi vurderer X stk". */
  estimatedQuantity?: number | null;
}

export function buildOutreachDraft(input: BuildOutreachInput): OutreachDraft {
  const { supplier, bootstrap, productCategory, estimatedQuantity } = input;
  const customerName = bootstrap?.companyProfile?.companyName?.trim() || 'vår kunde';
  const customerWebsite = bootstrap?.companyProfile?.websiteUrl?.trim() || null;
  const senderName = 'innholdsprodusent'; // generic — producer edits before sending

  // Pick the most-supported technique the supplier carries that's
  // sensible for the chosen product. Keep it short — one mention.
  const supplierTechniques = supplier.techniques.filter((t) => t !== 'unknown');
  const techniqueHint = supplierTechniques.length > 0
    ? TECHNIQUE_LABEL[supplierTechniques[0]]
    : 'trykk eller broderi';

  const productHint = productCategory && PRODUCT_LABEL[productCategory]
    ? PRODUCT_LABEL[productCategory]
    : supplier.productCategories.filter((c) => c !== 'unknown').length > 0
      ? PRODUCT_LABEL[supplier.productCategories.filter((c) => c !== 'unknown')[0]]
      : 'merch';

  const quantityLine = estimatedQuantity && estimatedQuantity > 0
    ? `Vi ser for oss et opplag på ca. ${estimatedQuantity} stk i første runde, fordelt på vanlige størrelser (S/M/L/XL).`
    : 'Vi vurderer fortsatt opplag og vil avklare med dere hva som gir best pris/kvalitet.';

  // Brand colours — surface the primary so supplier knows what to spec.
  const brandColors = bootstrap?.planningDraft?.brandGuide?.colors ?? [];
  const primaryColor = brandColors.find((c) => /primary|hoved/i.test(c.usage ?? ''))?.hex
    ?? brandColors[0]?.hex
    ?? null;
  const colorLine = primaryColor
    ? `Hovedfargen i merkevaren er ${primaryColor.toUpperCase()} — vi sender PMS / vektor-fil ved bekreftet tilbud.`
    : 'Vi sender PMS-kode og vektor-fil ved bekreftet tilbud.';

  const subject = `Tilbudsforespørsel: ${productHint} for ${customerName}`;

  const lines: string[] = [
    `Hei,`,
    ``,
    `Vi jobber for ${customerName}${customerWebsite ? ` (${customerWebsite})` : ''} og er på utkikk etter en leverandør for ${productHint}, fortrinnsvis med ${techniqueHint}. Dere kom opp som relevant kandidat basert på katalogen deres.`,
    ``,
    quantityLine,
    colorLine,
    ``,
    `For å gi oss et nøyaktig tilbud trenger vi å vite:`,
    `- Pris pr. plagg ved aktuelle volum (oppgi gjerne 25 / 50 / 100 / 250 stk)`,
    `- Set-up-kostnad pr. trykk-/broderi-flate`,
    `- Standard leveringstid og hva som kreves for hasteleveranse`,
    `- Krav til logo-fil (vektor-format, fargemodus)`,
    `- Om dere kan levere prøvetrykk på 1 plagg før hele kjøringen`,
    ``,
    `Setter pris på en kort tilbakemelding selv om dere ikke har kapasitet — så vi vet om vi skal regne dere inn i neste forespørsel.`,
    ``,
    `Med vennlig hilsen,`,
    `[ditt navn]`,
    `${senderName} for ${customerName}`,
  ];

  return {
    recipientEmail: supplier.contact?.email ?? null,
    subject,
    body: lines.join('\n'),
  };
}

/** Build a mailto: URL with subject + body URL-encoded. Use this in the
 *  "Åpne i e-post"-button so the user's email client opens with the
 *  draft pre-populated. Returns null when no recipient is known. */
export function buildMailtoUrl(draft: OutreachDraft): string | null {
  if (!draft.recipientEmail) return null;
  const params = new URLSearchParams();
  params.set('subject', draft.subject);
  params.set('body', draft.body);
  return `mailto:${encodeURIComponent(draft.recipientEmail)}?${params.toString()}`;
}
