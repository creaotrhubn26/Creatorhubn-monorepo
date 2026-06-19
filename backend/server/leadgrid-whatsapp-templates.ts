/**
 * leadgrid-whatsapp-templates.ts
 *
 * Maler for klient-portal-varsler via Meta WhatsApp Cloud API.
 *
 * Templates må registreres + godkjennes i Meta Business Suite (WABA Console)
 * FØR de kan brukes. Se docs/leadgrid/whatsapp-templates.md for kopier-klare
 * tekster + språk-varianter (no/en).
 *
 * Kategori for alle 5: UTILITY (transactional)
 * — IKKE marketing-kategori (ville krevd marketing-opt-in audit).
 *
 * Body-parametre er $1, $2 osv. og må matche definisjonen i Meta Console.
 */

export type LeadgridWaTemplate =
  | "leadgrid_deliverable_completed"
  | "leadgrid_focus_request_received"
  | "leadgrid_score_changed"
  | "leadgrid_new_finding"
  | "leadgrid_monthly_report";

export interface LeadgridWaTemplateMeta {
  name: LeadgridWaTemplate;
  category: "UTILITY";
  language: "nb" | "en";
  fullName: string; // template-name i Meta Console (= name + språk-suffix)
  bodyTemplate: string; // {{1}}-syntaks
  bodyParamCount: number;
  /** Hva $1..$N betyr i samme rekkefølge */
  paramLabels: string[];
  /** Eks header med fast tekst (optional) */
  headerText?: string;
  /** Hvis vi sender med URL-button på slutten */
  hasUrlButton?: boolean;
}

const NB: LeadgridWaTemplateMeta[] = [
  {
    name: "leadgrid_deliverable_completed",
    category: "UTILITY",
    language: "nb",
    fullName: "leadgrid_deliverable_completed_nb",
    headerText: "✓ Leveranse klar",
    bodyTemplate:
      "Hei {{1}}!\n\nLeveransen \"{{2}}\" er nå klar i klient-portalen din.\n\nDu kan se den, gi tilbakemelding eller be om fokus på neste steg når som helst.\n\nMvh {{3}}\nLeadgrid",
    bodyParamCount: 3,
    paramLabels: ["Kundens navn", "Leveransens tittel", "Avsenders fornavn"],
    hasUrlButton: true,
  },
  {
    name: "leadgrid_focus_request_received",
    category: "UTILITY",
    language: "nb",
    fullName: "leadgrid_focus_request_received_nb",
    headerText: "Vi har mottatt fokus-ønsket ditt",
    bodyTemplate:
      "Hei {{1}}!\n\nVi har mottatt fokus-ønsket ditt på {{2}}.\n\nRådgiveren din tar kontakt innen 1 virkedag for å sette i gang. Du kan følge fremdriften i portalen.\n\nMvh {{3}}\nLeadgrid",
    bodyParamCount: 3,
    paramLabels: ["Kundens navn", "Fokus-områder (komma-separert)", "Avsenders fornavn"],
    hasUrlButton: true,
  },
  {
    name: "leadgrid_score_changed",
    category: "UTILITY",
    language: "nb",
    fullName: "leadgrid_score_changed_nb",
    headerText: "Markeds-scoren din har endret seg",
    bodyTemplate:
      "Hei {{1}}!\n\nMarkeds-scoren din gikk fra {{2}} til {{3}}.\n\n{{4}}\n\nÅpne portalen for å se hvilke signaler som bidro.",
    bodyParamCount: 4,
    paramLabels: ["Kundens navn", "Gammel score", "Ny score", "Forklarings-setning"],
    hasUrlButton: true,
  },
  {
    name: "leadgrid_new_finding",
    category: "UTILITY",
    language: "nb",
    fullName: "leadgrid_new_finding_nb",
    headerText: "Nytt funn i markedsanalysen",
    bodyTemplate:
      "Hei {{1}}!\n\nVi har et nytt funn i markedsanalysen din:\n\n*{{2}}*\n\n{{3}}\n\nÅpne portalen for å se hele anbefalingen.",
    bodyParamCount: 3,
    paramLabels: ["Kundens navn", "Funn-tittel", "Kort forklarings-setning"],
    hasUrlButton: true,
  },
  {
    name: "leadgrid_monthly_report",
    category: "UTILITY",
    language: "nb",
    fullName: "leadgrid_monthly_report_nb",
    headerText: "Månedsrapporten din er klar",
    bodyTemplate:
      "Hei {{1}}!\n\nMånedsrapporten din for {{2}} er klar.\n\nDenne måneden: {{3}}\n\nÅpne portalen for å lese hele rapporten.",
    bodyParamCount: 3,
    paramLabels: ["Kundens navn", "Måneds-etikett (eks: 'mai 2026')", "Hovedoppsummering (1-2 setninger)"],
    hasUrlButton: true,
  },
];

const EN: LeadgridWaTemplateMeta[] = [
  {
    name: "leadgrid_deliverable_completed",
    category: "UTILITY",
    language: "en",
    fullName: "leadgrid_deliverable_completed_en",
    headerText: "✓ Delivery ready",
    bodyTemplate:
      "Hi {{1}}!\n\nYour delivery \"{{2}}\" is now ready in your client portal.\n\nYou can view it, leave feedback or request focus on next steps anytime.\n\nRegards {{3}}\nLeadgrid",
    bodyParamCount: 3,
    paramLabels: ["Customer name", "Delivery title", "Sender first name"],
    hasUrlButton: true,
  },
  {
    name: "leadgrid_focus_request_received",
    category: "UTILITY",
    language: "en",
    fullName: "leadgrid_focus_request_received_en",
    headerText: "We have received your focus request",
    bodyTemplate:
      "Hi {{1}}!\n\nWe've received your focus request on {{2}}.\n\nYour advisor will be in touch within 1 business day. You can track progress in the portal.\n\nRegards {{3}}\nLeadgrid",
    bodyParamCount: 3,
    paramLabels: ["Customer name", "Focus areas (comma-separated)", "Sender first name"],
    hasUrlButton: true,
  },
  {
    name: "leadgrid_score_changed",
    category: "UTILITY",
    language: "en",
    fullName: "leadgrid_score_changed_en",
    headerText: "Your market score has changed",
    bodyTemplate:
      "Hi {{1}}!\n\nYour market score went from {{2}} to {{3}}.\n\n{{4}}\n\nOpen the portal to see which signals contributed.",
    bodyParamCount: 4,
    paramLabels: ["Customer name", "Old score", "New score", "Explanation sentence"],
    hasUrlButton: true,
  },
  {
    name: "leadgrid_new_finding",
    category: "UTILITY",
    language: "en",
    fullName: "leadgrid_new_finding_en",
    headerText: "New finding in your market analysis",
    bodyTemplate:
      "Hi {{1}}!\n\nWe have a new finding in your market analysis:\n\n*{{2}}*\n\n{{3}}\n\nOpen the portal to see the full recommendation.",
    bodyParamCount: 3,
    paramLabels: ["Customer name", "Finding title", "Short explanation"],
    hasUrlButton: true,
  },
  {
    name: "leadgrid_monthly_report",
    category: "UTILITY",
    language: "en",
    fullName: "leadgrid_monthly_report_en",
    headerText: "Your monthly report is ready",
    bodyTemplate:
      "Hi {{1}}!\n\nYour monthly report for {{2}} is ready.\n\nThis month: {{3}}\n\nOpen the portal to read the full report.",
    bodyParamCount: 3,
    paramLabels: ["Customer name", "Month label (e.g. 'May 2026')", "Headline summary (1-2 sentences)"],
    hasUrlButton: true,
  },
];

export const LEADGRID_WA_TEMPLATES: LeadgridWaTemplateMeta[] = [...NB, ...EN];

export function getLeadgridWaTemplate(
  event: LeadgridWaTemplate,
  language: "nb" | "en" = "nb",
): LeadgridWaTemplateMeta {
  return (
    LEADGRID_WA_TEMPLATES.find((t) => t.name === event && t.language === language)
    ?? LEADGRID_WA_TEMPLATES.find((t) => t.name === event && t.language === "nb")!
  );
}
