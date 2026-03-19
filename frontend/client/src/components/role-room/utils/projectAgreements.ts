import type {
  Candidate,
  CastingProject,
  RoleRoomGoogleAgreementSignature,
  RoleRoomGoogleAgreementSignatureStatus,
} from '../models/casting';
import type {
  ProjectAgreement,
  ProjectAgreementCounterpartyType,
  ProjectAgreementSection,
  ProjectAgreementStatus,
  ProjectAgreementType,
} from '../services/castingApiService';

export type ClientAgreementType =
  | 'client_nda'
  | 'startup_collaboration'
  | 'smb_content_production'
  | 'internal_training_production'
  | 'agency_retainer'
  | 'campaign_production'
  | 'change_order'
  | 'client_approval';

export type ExtraAgreementType =
  | 'extra_nda'
  | 'extra_terms';

export interface AgreementTemplateConfig {
  type: ProjectAgreementType;
  counterpartyType: ProjectAgreementCounterpartyType;
  groupLabel: string;
  label: string;
  shortLabel: string;
  description: string;
  bestFor: string;
  coveragePoints: string[];
  purposeLabel: string;
  detailsLabel?: string;
  commercialTermsLabel?: string;
}

export interface AgreementTemplateGroup {
  label: string;
  options: AgreementTemplateConfig[];
}

const AGREEMENT_TEMPLATE_CONFIG: Record<ProjectAgreementType, AgreementTemplateConfig> = {
  client_nda: {
    type: 'client_nda',
    counterpartyType: 'client',
    groupLabel: 'Konfidensialitet',
    label: 'Taushetsavtale for klient',
    shortLabel: 'Klient-NDA',
    description: 'Brukes når klienten skal få innsyn i manus, budsjett, storyboard, råopptak eller annen sensitiv prosjektinformasjon.',
    bestFor: 'Prosjekter der klienten må få innsyn før avtalt leveranse er ferdig eller publisert.',
    coveragePoints: ['manus og storyboard', 'budsjett og kostlinjer', 'råopptak og interne notater'],
    purposeLabel: 'Formål',
  },
  startup_collaboration: {
    type: 'startup_collaboration',
    counterpartyType: 'client',
    groupLabel: 'Samarbeid og leveranse',
    label: 'Samarbeidsavtale for startup',
    shortLabel: 'Startup-avtale',
    description: 'Bygget for oppstartsselskaper og bedrifter som trenger en tydelig ramme for innhold, leveranser, godkjenning og betalingsmodell.',
    bestFor: 'Startup-selskaper som trenger fleksibel produksjon med tydelig ansvar, leveranser og milepæler.',
    coveragePoints: ['produksjonsramme og roller', 'godkjenningsflyt', 'pris og endringslogikk'],
    purposeLabel: 'Samarbeidsmål',
    detailsLabel: 'Leveranse og samarbeidsramme',
    commercialTermsLabel: 'Kommersielle vilkår',
  },
  smb_content_production: {
    type: 'smb_content_production',
    counterpartyType: 'client',
    groupLabel: 'Samarbeid og leveranse',
    label: 'Innholdsavtale for SMB',
    shortLabel: 'SMB-avtale',
    description: 'For små og mellomstore bedrifter som trenger en ryddig modell for kampanjer, produktinnhold, employer branding eller løpende markedsmateriell.',
    bestFor: 'Bedrifter med faste leveranser, flere kontaktpersoner og behov for tydelig scope-kontroll.',
    coveragePoints: ['leveransepakker', 'ansvar mellom klient og produsent', 'revisjoner og fakturering'],
    purposeLabel: 'Forretningsmål',
    detailsLabel: 'Leveransepakke og arbeidsform',
    commercialTermsLabel: 'Pris, revisjoner og betalingsplan',
  },
  internal_training_production: {
    type: 'internal_training_production',
    counterpartyType: 'client',
    groupLabel: 'Samarbeid og leveranse',
    label: 'Internopplæring / HMS-produksjon',
    shortLabel: 'Opplæringsavtale',
    description: 'For selskaper som produserer onboarding, sikkerhetsopplæring, prosedyrevideoer eller intern kunnskapsdeling.',
    bestFor: 'HMS, onboarding og internkommunikasjon der faginnhold, etterlevelse og godkjenning må være sporbar.',
    coveragePoints: ['faginnhold og ansvar', 'etterlevelse og godkjenning', 'versjonskontroll og oppdateringer'],
    purposeLabel: 'Opplæringsmål',
    detailsLabel: 'Innhold, faggrunnlag og godkjenning',
    commercialTermsLabel: 'Pris, oppdateringer og vedlikehold',
  },
  agency_retainer: {
    type: 'agency_retainer',
    counterpartyType: 'client',
    groupLabel: 'Samarbeid og leveranse',
    label: 'Retainer-avtale for byrå / innholdsprodusent',
    shortLabel: 'Retainer-avtale',
    description: 'For løpende produksjon over tid, med faste kapasitetspuljer, responstid og prioritering av leveranser.',
    bestFor: 'Klienter som trenger kontinuerlig produksjon måned for måned, ikke bare enkeltprosjekter.',
    coveragePoints: ['kapasitet og responstid', 'månedlig leveranseramme', 'overforbruk og prioritering'],
    purposeLabel: 'Retainer-mål',
    detailsLabel: 'Kapasitet, leveranser og styringsmodell',
    commercialTermsLabel: 'Retainer, ekstraarbeid og fakturering',
  },
  campaign_production: {
    type: 'campaign_production',
    counterpartyType: 'client',
    groupLabel: 'Samarbeid og leveranse',
    label: 'Kampanjeproduksjon',
    shortLabel: 'Kampanjeavtale',
    description: 'For tidsavgrensede kampanjer med klar lanseringsdato, flere leveranseformater og høy koordinering mellom budskap, media og produksjon.',
    bestFor: 'Produktlanseringer, kampanjer og employer-branding med tydelig publiseringsvindu.',
    coveragePoints: ['lanseringsdato og milepæler', 'kanaltilpassede leveranser', 'hasteregler og endringer'],
    purposeLabel: 'Kampanjemål',
    detailsLabel: 'Kampanjeramme og leveranser',
    commercialTermsLabel: 'Pris, hastearbeid og distribusjon',
  },
  change_order: {
    type: 'change_order',
    counterpartyType: 'client',
    groupLabel: 'Endringer og godkjenning',
    label: 'Endringsordre',
    shortLabel: 'Endringsordre',
    description: 'Brukes når omfang, pris, tidsplan eller leveranse skal endres etter at prosjektet er startet.',
    bestFor: 'Alle prosjekter der klienten ber om nye leveranser, større revisjoner eller flytting av fremdrift.',
    coveragePoints: ['scope-endringer', 'pris og tidskonsekvens', 'godkjent ikrafttredelse'],
    purposeLabel: 'Formål med endringen',
    detailsLabel: 'Endringsbeskrivelse',
    commercialTermsLabel: 'Pris og fremdrift',
  },
  client_approval: {
    type: 'client_approval',
    counterpartyType: 'client',
    groupLabel: 'Endringer og godkjenning',
    label: 'Klientgodkjenning / sign-off',
    shortLabel: 'Klientgodkjenning',
    description: 'Brukes når manus, storyboard, shotlist, budsjett eller ferdig leveranse skal godkjennes formelt før neste fase.',
    bestFor: 'Milepæler som må signeres før neste fase eller før fakturering og levering fortsetter.',
    coveragePoints: ['versjonsgodkjenning', 'responsfrist', 'håndtering av nye endringskrav'],
    purposeLabel: 'Hva skal godkjennes',
    detailsLabel: 'Godkjenningsgrunnlag',
    commercialTermsLabel: 'Frist og konsekvens',
  },
  extra_nda: {
    type: 'extra_nda',
    counterpartyType: 'extra',
    groupLabel: 'Medvirkende og statister',
    label: 'Taushetsavtale for statist/medvirkende',
    shortLabel: 'Statist-NDA',
    description: 'Brukes når statister eller medvirkende får tilgang til call sheets, lokasjon, manusutdrag eller annen fortrolig produksjonsinformasjon.',
    bestFor: 'Innspillinger der medvirkende får tilgang til fortrolig innhold eller sensitiv produksjonsinformasjon.',
    coveragePoints: ['taushetsplikt', 'deling av materiale', 'bruk av prosjektinformasjon'],
    purposeLabel: 'Formål',
  },
  extra_terms: {
    type: 'extra_terms',
    counterpartyType: 'extra',
    groupLabel: 'Medvirkende og statister',
    label: 'Medvirkendevilkår',
    shortLabel: 'Medvirkendevilkår',
    description: 'Regulerer oppmøte, opptreden, sikkerhet, bruk av opptak og eventuell honorering for statist eller medvirkende.',
    bestFor: 'Produksjoner der statister eller andre medvirkende trenger klare vilkår for oppmøte, bruk og godtgjørelse.',
    coveragePoints: ['oppmøte og sikkerhet', 'rettigheter til opptak', 'honorar og praktiske krav'],
    purposeLabel: 'Oppdrag og formål',
    detailsLabel: 'Arbeidsramme og oppmøte',
    commercialTermsLabel: 'Honorering og praktiske vilkår',
  },
};

export const CLIENT_AGREEMENT_TEMPLATE_OPTIONS: AgreementTemplateConfig[] = [
  AGREEMENT_TEMPLATE_CONFIG.startup_collaboration,
  AGREEMENT_TEMPLATE_CONFIG.smb_content_production,
  AGREEMENT_TEMPLATE_CONFIG.internal_training_production,
  AGREEMENT_TEMPLATE_CONFIG.agency_retainer,
  AGREEMENT_TEMPLATE_CONFIG.campaign_production,
  AGREEMENT_TEMPLATE_CONFIG.client_nda,
  AGREEMENT_TEMPLATE_CONFIG.change_order,
  AGREEMENT_TEMPLATE_CONFIG.client_approval,
];

export const CLIENT_AGREEMENT_TEMPLATE_GROUPS: AgreementTemplateGroup[] = [
  {
    label: 'Samarbeid og leveranse',
    options: [
      AGREEMENT_TEMPLATE_CONFIG.startup_collaboration,
      AGREEMENT_TEMPLATE_CONFIG.smb_content_production,
      AGREEMENT_TEMPLATE_CONFIG.internal_training_production,
      AGREEMENT_TEMPLATE_CONFIG.agency_retainer,
      AGREEMENT_TEMPLATE_CONFIG.campaign_production,
    ],
  },
  {
    label: 'Konfidensialitet',
    options: [AGREEMENT_TEMPLATE_CONFIG.client_nda],
  },
  {
    label: 'Endringer og godkjenning',
    options: [
      AGREEMENT_TEMPLATE_CONFIG.change_order,
      AGREEMENT_TEMPLATE_CONFIG.client_approval,
    ],
  },
];

export const EXTRA_AGREEMENT_TEMPLATE_OPTIONS: AgreementTemplateConfig[] = [
  AGREEMENT_TEMPLATE_CONFIG.extra_terms,
  AGREEMENT_TEMPLATE_CONFIG.extra_nda,
];

export const PROJECT_AGREEMENT_TYPE_LABELS: Record<ProjectAgreementType, string> = {
  client_nda: AGREEMENT_TEMPLATE_CONFIG.client_nda.label,
  startup_collaboration: AGREEMENT_TEMPLATE_CONFIG.startup_collaboration.label,
  smb_content_production: AGREEMENT_TEMPLATE_CONFIG.smb_content_production.label,
  internal_training_production: AGREEMENT_TEMPLATE_CONFIG.internal_training_production.label,
  agency_retainer: AGREEMENT_TEMPLATE_CONFIG.agency_retainer.label,
  campaign_production: AGREEMENT_TEMPLATE_CONFIG.campaign_production.label,
  change_order: AGREEMENT_TEMPLATE_CONFIG.change_order.label,
  client_approval: AGREEMENT_TEMPLATE_CONFIG.client_approval.label,
  extra_nda: AGREEMENT_TEMPLATE_CONFIG.extra_nda.label,
  extra_terms: AGREEMENT_TEMPLATE_CONFIG.extra_terms.label,
};

export const PROJECT_AGREEMENT_COUNTERPARTY_LABELS: Record<ProjectAgreementCounterpartyType, string> = {
  client: 'Klient',
  extra: 'Statist / medvirkende',
};

export const PROJECT_AGREEMENT_STATUS_LABELS: Record<ProjectAgreementStatus, string> = {
  draft: 'Kladde',
  sent: 'Sendt',
  signed: 'Signert',
};

export const PROJECT_AGREEMENT_SIGNATURE_STATUS_LABELS: Record<RoleRoomGoogleAgreementSignatureStatus, string> = {
  not_started: 'Ikke startet',
  prepared: 'Klargjort i Google',
  sent: 'Sendt til signering',
  opened_in_google: 'Åpnet i Google',
  signed: 'Signert i Google',
  rejected: 'Avvist',
  changes_requested: 'Endringer ønsket',
  error: 'Feil i signaturflyt',
};

export function getAgreementSignatureTone(
  signature?: RoleRoomGoogleAgreementSignature | null,
): { background: string; color: string } {
  switch (signature?.status) {
    case 'signed':
      return { background: 'rgba(16,185,129,0.16)', color: '#86efac' };
    case 'sent':
    case 'opened_in_google':
      return { background: 'rgba(59,130,246,0.16)', color: '#bfdbfe' };
    case 'prepared':
      return { background: 'rgba(139,92,246,0.16)', color: '#ddd6fe' };
    case 'rejected':
    case 'changes_requested':
      return { background: 'rgba(251,191,36,0.16)', color: '#fde68a' };
    case 'error':
      return { background: 'rgba(239,68,68,0.16)', color: '#fca5a5' };
    default:
      return { background: 'rgba(148,163,184,0.16)', color: '#cbd5e1' };
  }
}

export function getAgreementSignatureLabel(
  signature?: RoleRoomGoogleAgreementSignature | null,
): string {
  if (!signature) {
    return 'Google-signatur ikke klargjort';
  }
  return PROJECT_AGREEMENT_SIGNATURE_STATUS_LABELS[signature.status] ?? signature.status;
}

const readFirstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const getCandidateEmail = (candidate?: Candidate): string => (
  readFirstNonEmptyString(
    candidate?.contactInfo?.email,
    candidate?.contact_info?.email,
    candidate?.email,
  ) ?? ''
);

export interface ProjectAgreementDraft {
  agreementType: ProjectAgreementType;
  title: string;
  purpose: string;
  details: string;
  commercialTerms: string;
  disclosingPartyName: string;
  disclosingPartyCompanyName: string;
  disclosingPartyOrganizationNumber: string;
  counterpartyName: string;
  counterpartyEmail: string;
  counterpartyCompanyName: string;
  counterpartyOrganizationNumber: string;
  counterpartyId?: string;
  startDate: string;
  endDate: string;
}

interface AgreementSectionInput {
  projectName: string;
  agreementType: ProjectAgreementType;
  counterpartyType: ProjectAgreementCounterpartyType;
  disclosingPartyName: string;
  disclosingPartyCompanyName?: string;
  disclosingPartyOrganizationNumber?: string;
  counterpartyName: string;
  counterpartyEmail?: string;
  counterpartyCompanyName?: string;
  counterpartyOrganizationNumber?: string;
  purpose: string;
  details?: string;
  commercialTerms?: string;
  startDate?: string;
  endDate?: string;
}

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

const buildDefaultDisclosingPartyName = (project: CastingProject, currentUserLabel?: string): string => (
  readFirstNonEmptyString(currentUserLabel, `Prosjektledelse for ${project.name}`) ?? project.name
);

const buildDefaultDisclosingPartyCompany = (project: CastingProject): string => (
  readFirstNonEmptyString(
    String(project.productionCompanyName ?? ''),
    String(project.companyName ?? ''),
    String(project.organizationName ?? ''),
  ) ?? ''
);

const formatPartyLabel = (name: string, company?: string, orgNo?: string, email?: string): string => {
  const values = [
    company && company !== name ? `${name}, på vegne av ${company}` : name,
    orgNo ? `org.nr. ${orgNo}` : undefined,
    email ? `e-post ${email}` : undefined,
  ].filter((value): value is string => Boolean(value && value.trim()));

  return values.join(', ');
};

const buildDefaultAgreementValues = (
  project: CastingProject,
  agreementType: ProjectAgreementType,
  counterpartyType: ProjectAgreementCounterpartyType,
  counterpartyName: string,
): Pick<ProjectAgreementDraft, 'title' | 'purpose' | 'details' | 'commercialTerms'> => {
  switch (agreementType) {
    case 'startup_collaboration':
      return {
        title: `Samarbeidsavtale - ${project.name}`,
        purpose: `Partene skal planlegge, produsere og levere innhold for prosjektet «${project.name}».`,
        details: 'Leveranseomfang inkluderer strategi, manus, storyboard, produksjon, etterarbeid, revisjoner og publiseringsklare filer i avtalte formater.',
        commercialTerms: 'Kostnader følger godkjent budsjett. Endringer i omfang, tid eller leveranse skal håndteres gjennom skriftlig endringsordre før arbeid igangsettes.',
      };
    case 'smb_content_production':
      return {
        title: `Innholdsavtale - ${project.name}`,
        purpose: `Partene skal produsere innhold som støtter forretningsmålene for prosjektet «${project.name}».`,
        details: 'Leveransepakken omfatter planlegging, produksjon, tilpasning til aktuelle flater, revisjonsløp og publiseringsklare leveranser i avtalt kadens.',
        commercialTerms: 'Pris, revisjonsrammer, tilleggstimer og faktureringsplan følger av denne avtalen og prosjektets økonomioversikt.',
      };
    case 'internal_training_production':
      return {
        title: `Opplæringsavtale - ${project.name}`,
        purpose: `Partene skal utvikle og produsere opplærings- eller HMS-innhold for prosjektet «${project.name}».`,
        details: 'Leveransen skal bygge på godkjent faggrunnlag, versjonsstyring og tydelig sporbarhet mellom manus, opptak, revisjoner og publisert materiale.',
        commercialTerms: 'Avtalen regulerer pris, revisjoner, faglige godkjenningspunkter og eventuelle fremtidige oppdateringer av innholdet.',
      };
    case 'agency_retainer':
      return {
        title: `Retainer-avtale - ${project.name}`,
        purpose: `Partene etablerer en løpende produksjonsramme for innhold knyttet til prosjektet «${project.name}».`,
        details: 'Avtalen beskriver kapasitet, prioriteringsregler, responstid, leveransevindu og hvordan nye oppgaver settes inn i produksjonsplanen.',
        commercialTerms: 'Retainer-beløp, ekstraarbeid, hastearbeid og eventuell overforbrukshåndtering skal beskrives eksplisitt.',
      };
    case 'campaign_production':
      return {
        title: `Kampanjeavtale - ${project.name}`,
        purpose: `Partene skal produsere kampanjemateriell og tilhørende leveranser for prosjektet «${project.name}».`,
        details: 'Avtalen dekker lanseringsplan, formatliste, milepæler, versjoner, tilpasninger per kanal og ansvar for materiell som skal godkjennes.',
        commercialTerms: 'Pris, frister, hasteendringer, distribusjonsansvar og eventuelle kostnader ved forskjøvet lansering skal fremgå tydelig.',
      };
    case 'change_order':
      return {
        title: `Endringsordre - ${project.name}`,
        purpose: `Endringen gjelder omfang, leveranse, tidsplan eller budsjett i prosjektet «${project.name}».`,
        details: 'Beskriv hvilke leveranser eller beslutninger som endres, hva som legges til eller fjernes, og hvilke filer, opptak eller milepæler som påvirkes.',
        commercialTerms: 'Beskriv konsekvensen for pris, ressursbruk, frister og eventuelle nye godkjenningspunkter.',
      };
    case 'client_approval':
      return {
        title: `Klientgodkjenning - ${project.name}`,
        purpose: `Klienten skal godkjenne materiale eller milepæler før neste fase i prosjektet «${project.name}» starter.`,
        details: 'Beskriv hva som legges frem for godkjenning, hvilken versjon det gjelder, og hva klienten eksplisitt skal ta stilling til.',
        commercialTerms: 'Angi svarfrist, hvordan innsigelser leveres, og hva som skjer dersom fristen passeres uten tilbakemelding.',
      };
    case 'extra_nda':
      return {
        title: `Taushetsavtale - ${counterpartyName || 'medvirkende'} - ${project.name}`,
        purpose: `Motparten får tilgang til produksjonsinformasjon, call sheets, sceneoppsett og annet materiale knyttet til prosjektet «${project.name}» i den utstrekning det er nødvendig for å medvirke i produksjonen.`,
        details: '',
        commercialTerms: '',
      };
    case 'extra_terms':
      return {
        title: `Medvirkendevilkår - ${counterpartyName || 'medvirkende'} - ${project.name}`,
        purpose: `Avtalen regulerer oppmøte, opptreden, konfidensialitet og bruk av opptak for medvirkende i prosjektet «${project.name}».`,
        details: 'Medvirkende møter til avtalt tid, følger produksjonsledelsens instrukser, overholder sikkerhetsrutiner og deltar i beskrevne scener eller opptak.',
        commercialTerms: 'Angi honorar, utgiftsdekning, praktiske krav, avlysning og andre forhold som påvirker medvirkningen.',
      };
    case 'client_nda':
    default:
      return {
        title: `Taushetsavtale - ${project.name}`,
        purpose: `Motparten får tilgang til manus, storyboard, shotlister, scene-notater, budsjettlinjer, lokasjonsplaner, produksjonsnotater og råopptak knyttet til prosjektet «${project.name}» for planlegging, gjennomgang, godkjenning og gjennomføring av leveransen.`,
        details: '',
        commercialTerms: '',
      };
  }
};

export const getAgreementTemplateConfig = (agreementType: ProjectAgreementType | string): AgreementTemplateConfig => (
  AGREEMENT_TEMPLATE_CONFIG[agreementType as ProjectAgreementType] ?? AGREEMENT_TEMPLATE_CONFIG.client_nda
);

export const getAgreementTypeLabel = (agreementType: ProjectAgreementType | string): string => (
  getAgreementTemplateConfig(agreementType).label
);

export const buildDefaultClientAgreementDraft = (
  project: CastingProject,
  currentUserLabel?: string,
  agreementType: ClientAgreementType = 'startup_collaboration',
): ProjectAgreementDraft => {
  const defaults = buildDefaultAgreementValues(project, agreementType, 'client', project.clientName ?? '');
  return {
    agreementType,
    ...defaults,
    disclosingPartyName: buildDefaultDisclosingPartyName(project, currentUserLabel),
    disclosingPartyCompanyName: buildDefaultDisclosingPartyCompany(project),
    disclosingPartyOrganizationNumber: '',
    counterpartyName: project.clientName ?? '',
    counterpartyEmail: project.clientEmail ?? '',
    counterpartyCompanyName: project.clientCompanyName ?? '',
    counterpartyOrganizationNumber: project.clientOrganizationNumber ?? '',
    startDate: todayIsoDate(),
    endDate: '',
  };
};

export const buildDefaultExtraAgreementDraft = (
  project: CastingProject,
  candidate: Candidate | undefined,
  currentUserLabel?: string,
  agreementType: ExtraAgreementType = 'extra_terms',
): ProjectAgreementDraft => {
  const defaults = buildDefaultAgreementValues(project, agreementType, 'extra', candidate?.name ?? '');
  return {
    agreementType,
    ...defaults,
    disclosingPartyName: buildDefaultDisclosingPartyName(project, currentUserLabel),
    disclosingPartyCompanyName: buildDefaultDisclosingPartyCompany(project),
    disclosingPartyOrganizationNumber: '',
    counterpartyName: candidate?.name ?? '',
    counterpartyEmail: getCandidateEmail(candidate),
    counterpartyCompanyName: '',
    counterpartyOrganizationNumber: '',
    counterpartyId: candidate?.id,
    startDate: todayIsoDate(),
    endDate: '',
  };
};

const buildNdaSections = (input: AgreementSectionInput): ProjectAgreementSection[] => {
  const disclosingParty = formatPartyLabel(
    input.disclosingPartyName,
    input.disclosingPartyCompanyName,
    input.disclosingPartyOrganizationNumber,
  );
  const receivingParty = formatPartyLabel(
    input.counterpartyName,
    input.counterpartyCompanyName,
    input.counterpartyOrganizationNumber,
    input.counterpartyEmail,
  );
  const accessLabel = input.counterpartyType === 'client' ? 'klientgjennomgang og beslutningsstøtte' : 'medvirkning i produksjonen';

  return [
    {
      id: 'nda-1',
      heading: '§ 1 Parter og bakgrunn',
      body: [
        `1.1 Denne taushetsavtalen («Avtalen») inngås mellom ${disclosingParty} («Utleverende part») og ${receivingParty} («Mottakende part»).`,
        `1.2 Avtalen gjelder all fortrolig informasjon som deles i forbindelse med prosjektet «${input.projectName}».`,
        `1.3 Partene er enige om at informasjonen bare skal brukes til ${accessLabel}.`,
      ].join('\n\n'),
    },
    {
      id: 'nda-2',
      heading: '§ 2 Formål',
      body: [
        `2.1 Formålet med utleveringen er følgende: ${input.purpose}`,
        '2.2 Informasjonen skal ikke brukes til egne kommersielle formål, konkurrerende virksomhet eller annen bruk som går utover det uttrykkelige formålet i denne avtalen.',
      ].join('\n\n'),
    },
    {
      id: 'nda-3',
      heading: '§ 3 Hva som regnes som fortrolig informasjon',
      body: [
        '3.1 Fortrolig informasjon omfatter blant annet manus, storyboard, shotlister, sceneplaner, budsjett, kostlinjer, kontraktsvilkår, produksjonsnotater, råopptak, klippeutkast, kundeinformasjon, interne vurderinger, tekniske oppsett, lokasjoner, logistikk, call sheets, kontaktlister og annen informasjon som ikke er offentlig tilgjengelig.',
        '3.2 Også muntlige opplysninger, demonstrasjoner, skjermbilder, filer, databaser og informasjon utledet av fortrolig materiale omfattes av avtalen.',
        '3.3 Dersom informasjonen utgjør en forretningshemmelighet etter forretningshemmelighetsloven, gjelder denne avtalen i tillegg til det vernet loven allerede gir.',
      ].join('\n\n'),
    },
    {
      id: 'nda-4',
      heading: '§ 4 Bruk, tilgang og sikring',
      body: [
        '4.1 Mottakende part skal begrense tilgangen til personer som har et dokumentert behov for informasjonen for å utføre oppdraget.',
        '4.2 Mottakende part skal sikre informasjonen forsvarlig mot innsyn, kopiering, deling, lagring og publisering som ikke er godkjent av utleverende part.',
        '4.3 Informasjonen skal ikke lastes opp til åpne tjenester, brukes i opplæring av modeller eller deles med tredjepart uten skriftlig forhåndssamtykke fra utleverende part.',
      ].join('\n\n'),
    },
    {
      id: 'nda-5',
      heading: '§ 5 Taushetsplikt',
      body: [
        '5.1 Mottakende part forplikter seg til å bevare full taushet om fortrolig informasjon og ikke gjøre den kjent for uvedkommende.',
        '5.2 Taushetsplikten gjelder både under samarbeidet og etter at samarbeidet er avsluttet.',
        '5.3 Mottakende part skal straks varsle utleverende part dersom det oppstår mistanke om brudd, tap av materiale eller uautorisert tilgang.',
      ].join('\n\n'),
    },
    {
      id: 'nda-6',
      heading: '§ 6 Unntak',
      body: [
        '6.1 Taushetsplikten gjelder ikke for informasjon som mottakende part kan dokumentere at allerede var lovlig kjent før utlevering, eller som senere blir offentlig kjent uten brudd på denne avtalen.',
        '6.2 Taushetsplikten gjelder heller ikke når mottakende part er rettslig forpliktet til å utlevere informasjon, forutsatt at utleverende part varsles så langt loven tillater det.',
      ].join('\n\n'),
    },
    {
      id: 'nda-7',
      heading: '§ 7 Personopplysninger og informasjonskontroll',
      body: [
        '7.1 Dersom fortrolig informasjon inneholder personopplysninger, skal disse behandles konfidensielt og i samsvar med gjeldende personvernregelverk.',
        '7.2 Denne avtalen erstatter ikke en eventuell databehandleravtale. Dersom behandlingen krever særskilt regulering av roller eller instruks, skal partene inngå tilleggsavtale om dette.',
      ].join('\n\n'),
    },
    {
      id: 'nda-8',
      heading: '§ 8 Eierskap og immaterielle rettigheter',
      body: [
        '8.1 All fortrolig informasjon, samt immaterielle rettigheter knyttet til denne, forblir utleverende parts eiendom med mindre annet er uttrykkelig avtalt skriftlig.',
        '8.2 Denne avtalen gir ikke mottakende part lisens, publiseringsrett eller annen bruksrett utover det som følger direkte av formålet.',
      ].join('\n\n'),
    },
    {
      id: 'nda-9',
      heading: '§ 9 Varighet',
      body: [
        `9.1 Avtalen trer i kraft ${input.startDate || 'ved signering'}.`,
        input.endDate
          ? `9.2 Avtalens operative periode løper til ${input.endDate}, men taushetsplikten består også etter denne datoen for informasjon som fortsatt er fortrolig.`
          : '9.2 Taushetsplikten gjelder så lenge informasjonen ikke er lovlig offentlig kjent eller partene skriftlig avtaler noe annet.',
      ].join('\n\n'),
    },
    {
      id: 'nda-10',
      heading: '§ 10 Tilbakelevering og sletting',
      body: [
        '10.1 På forespørsel fra utleverende part, eller når formålet er oppfylt, skal mottakende part uten ugrunnet opphold returnere eller slette fortrolig informasjon og eventuelle kopier.',
        '10.2 Mottakende part skal bekrefte skriftlig når retur eller sletting er gjennomført, med mindre lagring kreves etter lov.',
      ].join('\n\n'),
    },
    {
      id: 'nda-11',
      heading: '§ 11 Mislighold og virkninger',
      body: [
        '11.1 Brudd på avtalen anses som vesentlig mislighold.',
        '11.2 Utleverende part kan kreve at ulovlig bruk eller videreformidling opphører umiddelbart, og kan i tillegg kreve erstatning etter alminnelige erstatningsrettslige regler.',
      ].join('\n\n'),
    },
    {
      id: 'nda-12',
      heading: '§ 12 Lovvalg og verneting',
      body: [
        '12.1 Avtalen reguleres av norsk rett.',
        '12.2 Tvister som ikke løses i minnelighet, skal søkes avgjort ved ordinære norske domstoler med utleverende parts verneting som avtalt verneting, med mindre ufravikelige regler bestemmer noe annet.',
      ].join('\n\n'),
    },
  ];
};

const buildStartupCollaborationSections = (input: AgreementSectionInput): ProjectAgreementSection[] => {
  const disclosingParty = formatPartyLabel(
    input.disclosingPartyName,
    input.disclosingPartyCompanyName,
    input.disclosingPartyOrganizationNumber,
  );
  const clientParty = formatPartyLabel(
    input.counterpartyName,
    input.counterpartyCompanyName,
    input.counterpartyOrganizationNumber,
    input.counterpartyEmail,
  );

  return [
    {
      id: 'collab-1',
      heading: '§ 1 Parter og bakgrunn',
      body: [
        `1.1 Samarbeidsavtalen inngås mellom ${disclosingParty} («Produsent») og ${clientParty} («Klient»).`,
        `1.2 Avtalen regulerer samarbeid om utvikling og produksjon av innhold for prosjektet «${input.projectName}».`,
      ].join('\n\n'),
    },
    {
      id: 'collab-2',
      heading: '§ 2 Samarbeidsmål og leveranse',
      body: [
        `2.1 Partenes mål med samarbeidet er følgende: ${input.purpose}`,
        `2.2 Leveranse og samarbeidsramme beskrives slik: ${input.details || 'Partene konkretiserer leveranser, versjoner, publiseringsflater og milepæler i produksjonsplanen.'}`,
      ].join('\n\n'),
    },
    {
      id: 'collab-3',
      heading: '§ 3 Roller, ansvar og beslutningslinjer',
      body: [
        '3.1 Produsenten leder den operative planleggingen, produksjonen, koordineringen av team, kvalitetssikring og dokumentasjon av leveransen.',
        '3.2 Klienten skal gi nødvendig innsikt, beslutninger, tilbakemeldinger og godkjenninger innen avtalte frister.',
        '3.3 Ingen part kan legge til nytt omfang eller nye krav uten at dette dokumenteres skriftlig og aksepteres av begge parter.',
      ].join('\n\n'),
    },
    {
      id: 'collab-4',
      heading: '§ 4 Arbeidsform og godkjenningsflyt',
      body: [
        '4.1 Manus, storyboard, shotlist, budsjett, råutkast og ferdige leveranser skal behandles i prosjektets godkjenningsflyt.',
        '4.2 Klienten skal samle sine kommentarer per milepæl så langt det er praktisk mulig, for å redusere unødvendig rework og fremdriftsstans.',
      ].join('\n\n'),
    },
    {
      id: 'collab-5',
      heading: '§ 5 Pris, kostnader og endringer',
      body: [
        `5.1 Kommersielle vilkår og økonomisk modell er som følger: ${input.commercialTerms || 'Pris, budsjett og faktureringsplan fastsettes i prosjektets økonomimodul og eventuelle tilbudsdokumenter.'}`,
        '5.2 Endringer i omfang, hastegrad, leveranseformat eller beslutningsgrunnlag skal håndteres gjennom skriftlig endringsordre før det nye arbeidet påbegynnes.',
      ].join('\n\n'),
    },
    {
      id: 'collab-6',
      heading: '§ 6 Rettigheter og bruk',
      body: [
        '6.1 Rettigheter til prosjektmateriale, råfiler, ferdige leveranser og eventuelle tilpasninger følger det som er skriftlig avtalt mellom partene.',
        '6.2 Inntil full oppgjør og endelig overlevering foreligger, kan produsenten beholde nødvendig kontroll over arbeidsfiler og produksjonsgrunnlag.',
      ].join('\n\n'),
    },
    {
      id: 'collab-7',
      heading: '§ 7 Konfidensialitet og personvern',
      body: [
        '7.1 Partene skal behandle all ikke-offentlig prosjektinformasjon, kundeinformasjon, forretningsplaner, kampanjemateriell og interne vurderinger konfidensielt.',
        '7.2 Dersom samarbeidet innebærer behandling av personopplysninger, skal partene i tillegg etablere nødvendig personvernregulering der dette kreves.',
      ].join('\n\n'),
    },
    {
      id: 'collab-8',
      heading: '§ 8 Varighet, oppsigelse og lovvalg',
      body: [
        `8.1 Avtalen gjelder fra ${input.startDate || 'signering'}${input.endDate ? ` til ${input.endDate}` : ' og til prosjektet er levert eller avsluttet.'}`,
        '8.2 Vesentlig mislighold, manglende betaling eller vedvarende brudd på godkjenningsflyten kan gi grunnlag for stans eller heving etter alminnelige kontraktsrettslige prinsipper.',
        '8.3 Avtalen reguleres av norsk rett med ordinære norske domstoler som tvisteløsningsforum.',
      ].join('\n\n'),
    },
  ];
};

const buildSmbContentProductionSections = (input: AgreementSectionInput): ProjectAgreementSection[] => {
  const producer = formatPartyLabel(
    input.disclosingPartyName,
    input.disclosingPartyCompanyName,
    input.disclosingPartyOrganizationNumber,
  );
  const client = formatPartyLabel(
    input.counterpartyName,
    input.counterpartyCompanyName,
    input.counterpartyOrganizationNumber,
    input.counterpartyEmail,
  );

  return [
    {
      id: 'smb-1',
      heading: '§ 1 Parter og bakgrunn',
      body: [
        `1.1 Avtalen inngås mellom ${producer} («Produsent») og ${client} («Klient»).`,
        `1.2 Avtalen regulerer planlegging, produksjon og levering av innhold for prosjektet «${input.projectName}».`,
      ].join('\n\n'),
    },
    {
      id: 'smb-2',
      heading: '§ 2 Forretningsmål og leveranser',
      body: [
        `2.1 Samarbeidet skal støtte følgende forretningsmål: ${input.purpose}`,
        `2.2 Leveransepakke og arbeidsform beskrives slik: ${input.details || 'Partene fastsetter leveransepakker, versjoner, kanaler og milepæler i prosjektets plan- og godkjenningsflyt.'}`,
      ].join('\n\n'),
    },
    {
      id: 'smb-3',
      heading: '§ 3 Roller, underlag og revisjoner',
      body: [
        '3.1 Produsenten ansvarer for produksjonsgjennomføring, koordinering av ressurser, kvalitetssikring og dokumentasjon av leveransene.',
        '3.2 Klienten skal levere korrekt underlag, avklare beslutningstagere og samle revisjoner innen avtalte frister.',
        '3.3 Revisjoner utover avtalte runder eller endringer som påvirker omfang og fremdrift, skal håndteres som endringsordre.',
      ].join('\n\n'),
    },
    {
      id: 'smb-4',
      heading: '§ 4 Pris og betalingsplan',
      body: [
        `4.1 Pris, revisjonsrammer og betalingsplan er som følger: ${input.commercialTerms || 'Pris og betalingsplan følger godkjent tilbud, budsjett og eventuelle kostnadsoppdateringer i prosjektets økonomiområde.'}`,
        '4.2 Eventuelt tilleggsarbeid, hastearbeid eller nytt omfang faktureres separat etter skriftlig godkjenning.',
      ].join('\n\n'),
    },
    {
      id: 'smb-5',
      heading: '§ 5 Rettigheter, bruk og lovvalg',
      body: [
        '5.1 Bruksrett til ferdige leveranser og arbeidsfiler følger det som er uttrykkelig avtalt skriftlig.',
        '5.2 Avtalen reguleres av norsk rett. Tvister avgjøres ved ordinære norske domstoler.',
      ].join('\n\n'),
    },
  ];
};

const buildInternalTrainingProductionSections = (input: AgreementSectionInput): ProjectAgreementSection[] => {
  const producer = formatPartyLabel(
    input.disclosingPartyName,
    input.disclosingPartyCompanyName,
    input.disclosingPartyOrganizationNumber,
  );
  const client = formatPartyLabel(
    input.counterpartyName,
    input.counterpartyCompanyName,
    input.counterpartyOrganizationNumber,
    input.counterpartyEmail,
  );

  return [
    {
      id: 'training-1',
      heading: '§ 1 Parter og formål',
      body: [
        `1.1 Avtalen inngås mellom ${producer} («Produsent») og ${client} («Klient»).`,
        `1.2 Avtalen gjelder utvikling og produksjon av opplærings- eller HMS-innhold for prosjektet «${input.projectName}».`,
      ].join('\n\n'),
    },
    {
      id: 'training-2',
      heading: '§ 2 Opplæringsmål og faggrunnlag',
      body: [
        `2.1 Opplæringsmålet er følgende: ${input.purpose}`,
        `2.2 Faglig grunnlag, godkjenningsløp og innholdsramme beskrives slik: ${input.details || 'Klienten stiller fagressurser til disposisjon og godkjenner manus, prosedyrer og sikkerhetsinnhold før opptak og publisering.'}`,
      ].join('\n\n'),
    },
    {
      id: 'training-3',
      heading: '§ 3 Etterlevelse, versjonsstyring og dokumentasjon',
      body: [
        '3.1 Klienten skal utpeke fagansvarlig som kan validere innholdets korrekthet og etterlevelse av interne rutiner.',
        '3.2 Produsenten skal holde versjonskontroll på manus, opptak og ferdige leveranser slik at klienten kan spore hva som er godkjent og publisert.',
      ].join('\n\n'),
    },
    {
      id: 'training-4',
      heading: '§ 4 Pris, revisjoner og oppdateringer',
      body: [
        `4.1 Pris, revisjonsrammer og eventuelle fremtidige oppdateringer håndteres slik: ${input.commercialTerms || 'Pris og oppdateringer følger av godkjent budsjett og eventuelle senere endringsordrer eller vedlikeholdsavtaler.'}`,
        '4.2 Når faginnhold eller prosedyrer endres etter signert godkjenning, skal oppdatering håndteres som ny bestilling eller avtalt vedlikehold.',
      ].join('\n\n'),
    },
    {
      id: 'training-5',
      heading: '§ 5 Rettigheter, personvern og lovvalg',
      body: [
        '5.1 Klienten kan bruke leveransen internt i egen organisasjon i tråd med avtalt formål, med mindre annet er skriftlig avtalt.',
        '5.2 Avtalen reguleres av norsk rett. Tvister avgjøres ved ordinære norske domstoler.',
      ].join('\n\n'),
    },
  ];
};

const buildAgencyRetainerSections = (input: AgreementSectionInput): ProjectAgreementSection[] => {
  const producer = formatPartyLabel(
    input.disclosingPartyName,
    input.disclosingPartyCompanyName,
    input.disclosingPartyOrganizationNumber,
  );
  const client = formatPartyLabel(
    input.counterpartyName,
    input.counterpartyCompanyName,
    input.counterpartyOrganizationNumber,
    input.counterpartyEmail,
  );

  return [
    {
      id: 'retainer-1',
      heading: '§ 1 Parter og retainerforhold',
      body: [
        `1.1 Avtalen inngås mellom ${producer} («Produsent») og ${client} («Klient»).`,
        `1.2 Avtalen etablerer en løpende retainer for produksjon og leveranse i prosjektet «${input.projectName}».`,
      ].join('\n\n'),
    },
    {
      id: 'retainer-2',
      heading: '§ 2 Kapasitet og leveranseramme',
      body: [
        `2.1 Retainerforholdet skal dekke følgende mål og prioriteringer: ${input.purpose}`,
        `2.2 Kapasitet, leveranser og styringsmodell beskrives slik: ${input.details || 'Partene fastsetter antall leveranser, responstid, månedlig kapasitet og hvordan nye behov prioriteres i produksjonskøen.'}`,
      ].join('\n\n'),
    },
    {
      id: 'retainer-3',
      heading: '§ 3 Arbeidsflyt og prioritering',
      body: [
        '3.1 Klienten sender oppgaver, brief og prioritet gjennom prosjektets arbeidsflyt. Produsenten planlegger gjennomføring innen avtalt kapasitet og responstid.',
        '3.2 Arbeid som overstiger avtalt kapasitet eller krever hasteprioritet skal godkjennes særskilt før gjennomføring.',
      ].join('\n\n'),
    },
    {
      id: 'retainer-4',
      heading: '§ 4 Pris, overforbruk og fakturering',
      body: [
        `4.1 Retainer, ekstraarbeid og fakturering håndteres slik: ${input.commercialTerms || 'Månedlig retainerbeløp, eventuell timepris for ekstraarbeid og fakturaintervall skal fremgå av denne avtalen og budsjettet.'}`,
        '4.2 Ubrukt kapasitet kan bare overføres dersom dette er uttrykkelig avtalt skriftlig.',
      ].join('\n\n'),
    },
    {
      id: 'retainer-5',
      heading: '§ 5 Varighet, oppsigelse og lovvalg',
      body: [
        `5.1 Avtalen gjelder fra ${input.startDate || 'signering'}${input.endDate ? ` til ${input.endDate}` : ' og løper videre til den sies opp i tråd med avtalte oppsigelsesfrister.'}`,
        '5.2 Avtalen reguleres av norsk rett. Tvister avgjøres ved ordinære norske domstoler.',
      ].join('\n\n'),
    },
  ];
};

const buildCampaignProductionSections = (input: AgreementSectionInput): ProjectAgreementSection[] => {
  const producer = formatPartyLabel(
    input.disclosingPartyName,
    input.disclosingPartyCompanyName,
    input.disclosingPartyOrganizationNumber,
  );
  const client = formatPartyLabel(
    input.counterpartyName,
    input.counterpartyCompanyName,
    input.counterpartyOrganizationNumber,
    input.counterpartyEmail,
  );

  return [
    {
      id: 'campaign-1',
      heading: '§ 1 Parter og kampanjegrunnlag',
      body: [
        `1.1 Avtalen inngås mellom ${producer} («Produsent») og ${client} («Klient»).`,
        `1.2 Avtalen gjelder produksjon av kampanjemateriell for prosjektet «${input.projectName}».`,
      ].join('\n\n'),
    },
    {
      id: 'campaign-2',
      heading: '§ 2 Kampanjemål og leveranser',
      body: [
        `2.1 Kampanjemålet er følgende: ${input.purpose}`,
        `2.2 Kampanjeramme og leveranser beskrives slik: ${input.details || 'Partene fastsetter budskap, leveranseformater, kanaler, milepæler og lanseringsdato i prosjektets produksjonsplan.'}`,
      ].join('\n\n'),
    },
    {
      id: 'campaign-3',
      heading: '§ 3 Milepæler og godkjenning',
      body: [
        '3.1 Manus, storyboard, shoot plan, klipp og endelige leveranser skal godkjennes i tråd med prosjektets milepælsplan.',
        '3.2 Klienten skal samle kommentarer per milepæl slik at lanseringsvindu og distribusjonsplan kan holdes.',
      ].join('\n\n'),
    },
    {
      id: 'campaign-4',
      heading: '§ 4 Pris, hastearbeid og endringer',
      body: [
        `4.1 Pris, hastearbeid og distribusjonsansvar håndteres slik: ${input.commercialTerms || 'Pris, kanaltilpasninger, hastearbeid og endringer etter godkjent milepæl håndteres i budsjett og endringsordre.'}`,
        '4.2 Dersom klienten endrer brief, budskap, målgruppe eller lanseringsdato etter godkjent plan, skal dette vurderes som endring i omfang eller fremdrift.',
      ].join('\n\n'),
    },
    {
      id: 'campaign-5',
      heading: '§ 5 Rettigheter og lovvalg',
      body: [
        '5.1 Bruksrett til kampanjemateriale, råfiler og tilpasninger følger det som uttrykkelig er avtalt skriftlig.',
        '5.2 Avtalen reguleres av norsk rett. Tvister avgjøres ved ordinære norske domstoler.',
      ].join('\n\n'),
    },
  ];
};

const buildChangeOrderSections = (input: AgreementSectionInput): ProjectAgreementSection[] => {
  const producer = formatPartyLabel(
    input.disclosingPartyName,
    input.disclosingPartyCompanyName,
    input.disclosingPartyOrganizationNumber,
  );
  const client = formatPartyLabel(
    input.counterpartyName,
    input.counterpartyCompanyName,
    input.counterpartyOrganizationNumber,
    input.counterpartyEmail,
  );

  return [
    {
      id: 'change-1',
      heading: '§ 1 Referanse og bakgrunn',
      body: [
        `1.1 Endringsordren inngås mellom ${producer} og ${client}.`,
        `1.2 Endringsordren gjelder prosjektet «${input.projectName}» og supplerer eksisterende avtaleverk for prosjektet.`,
      ].join('\n\n'),
    },
    {
      id: 'change-2',
      heading: '§ 2 Endringen',
      body: [
        `2.1 Endringen har følgende formål: ${input.purpose}`,
        `2.2 Endringen beskrives slik: ${input.details || 'Partene dokumenterer nærmere hvilke leveranser, opptak, versjoner, revisjoner eller godkjenningspunkter som påvirkes.'}`,
      ].join('\n\n'),
    },
    {
      id: 'change-3',
      heading: '§ 3 Konsekvens for pris, ressurser og fremdrift',
      body: [
        `3.1 Endringens økonomiske og tidsmessige konsekvenser er følgende: ${input.commercialTerms || 'Pris, ressursbruk og fremdrift oppdateres i budsjettet og produksjonsplanen ved godkjenning av endringsordren.'}`,
        '3.2 Ingen part kan kreve at endringen gjennomføres før konsekvensene for pris, leveringsdato, team eller øvrige avhengigheter er vurdert og akseptert.',
      ].join('\n\n'),
    },
    {
      id: 'change-4',
      heading: '§ 4 Avhengigheter og forutsetninger',
      body: [
        '4.1 Endringen kan være betinget av nye beslutninger, nytt underlag, tilgang til lokasjon, nye opptaksdager eller annen medvirkning fra klient eller tredjepart.',
        '4.2 Dersom slike forutsetninger ikke oppfylles, kan produsenten justere fremdriften tilsvarende.',
      ].join('\n\n'),
    },
    {
      id: 'change-5',
      heading: '§ 5 Godkjenning og ikrafttredelse',
      body: [
        `5.1 Endringsordren gjelder fra ${input.startDate || 'godkjenning'}${input.endDate ? ` og skal være gjennomført innen ${input.endDate}` : ''}.`,
        '5.2 Når begge parter har godkjent denne endringsordren, blir den en integrert del av prosjektets avtalebilde.',
      ].join('\n\n'),
    },
    {
      id: 'change-6',
      heading: '§ 6 Øvrige vilkår og lovvalg',
      body: [
        '6.1 Øvrige vilkår i hovedavtalen gjelder uendret så langt de passer.',
        '6.2 Endringsordren reguleres av norsk rett og tvister avgjøres ved ordinære norske domstoler.',
      ].join('\n\n'),
    },
  ];
};

const buildClientApprovalSections = (input: AgreementSectionInput): ProjectAgreementSection[] => {
  const producer = formatPartyLabel(
    input.disclosingPartyName,
    input.disclosingPartyCompanyName,
    input.disclosingPartyOrganizationNumber,
  );
  const client = formatPartyLabel(
    input.counterpartyName,
    input.counterpartyCompanyName,
    input.counterpartyOrganizationNumber,
    input.counterpartyEmail,
  );

  return [
    {
      id: 'approval-1',
      heading: '§ 1 Partene og godkjenningsgrunnlaget',
      body: [
        `1.1 Godkjenningsprotokollen inngås mellom ${producer} og ${client}.`,
        `1.2 Protokollen gjelder materiale eller milepæl knyttet til prosjektet «${input.projectName}».`,
      ].join('\n\n'),
    },
    {
      id: 'approval-2',
      heading: '§ 2 Hva som skal godkjennes',
      body: [
        `2.1 Følgende skal godkjennes: ${input.purpose}`,
        `2.2 Godkjenningsgrunnlaget er: ${input.details || 'Angitt versjon, leveranse, budsjettpakke eller annet beslutningsgrunnlag som er delt med klienten.'}`,
      ].join('\n\n'),
    },
    {
      id: 'approval-3',
      heading: '§ 3 Frist, respons og beslutning',
      body: [
        `3.1 Svarfrist og beslutningsbetingelser er som følger: ${input.commercialTerms || 'Klienten skal gi samlet tilbakemelding innen avtalt frist, slik at produksjonsplan og budsjett kan oppdateres uten forsinkelse.'}`,
        input.endDate
          ? `3.2 Dersom klienten ikke har gitt skriftlig respons innen ${input.endDate}, skal partene umiddelbart avklare om fristen skal forlenges eller om arbeidet skal fryses.`
          : '3.2 Dersom klienten ikke gir skriftlig respons innen avtalt frist, skal partene umiddelbart avklare om arbeidet skal fryses eller flyttes til neste tilgjengelige leveransevindu.',
      ].join('\n\n'),
    },
    {
      id: 'approval-4',
      heading: '§ 4 Virkning av godkjenning eller innsigelser',
      body: [
        '4.1 Når klienten godkjenner materialet, anses den aktuelle milepælen som godkjent for videre produksjon, levering eller fakturering i henhold til prosjektets avtalte flyt.',
        '4.2 Dersom klienten fremmer innsigelser som innebærer nytt omfang, ny retning eller nytt arbeid utover avtalt revisjonsrunde, skal dette håndteres som endringsordre.',
      ].join('\n\n'),
    },
    {
      id: 'approval-5',
      heading: '§ 5 Dokumentasjon og lovvalg',
      body: [
        '5.1 Godkjenning, avslag eller krav om endringer skal dokumenteres skriftlig gjennom prosjektets godkjenningsflyt eller annet sporbarhetsverktøy.',
        '5.2 Protokollen reguleres av norsk rett og tvister avgjøres ved ordinære norske domstoler.',
      ].join('\n\n'),
    },
  ];
};

const buildExtraTermsSections = (input: AgreementSectionInput): ProjectAgreementSection[] => {
  const producer = formatPartyLabel(
    input.disclosingPartyName,
    input.disclosingPartyCompanyName,
    input.disclosingPartyOrganizationNumber,
  );
  const participant = formatPartyLabel(
    input.counterpartyName,
    input.counterpartyCompanyName,
    input.counterpartyOrganizationNumber,
    input.counterpartyEmail,
  );

  return [
    {
      id: 'extra-1',
      heading: '§ 1 Parter og engasjement',
      body: [
        `1.1 Avtalen inngås mellom ${producer} («Produksjonen») og ${participant} («Medvirkende»).`,
        `1.2 Avtalen gjelder medvirkning i prosjektet «${input.projectName}».`,
      ].join('\n\n'),
    },
    {
      id: 'extra-2',
      heading: '§ 2 Oppdrag og formål',
      body: [
        `2.1 Formålet med engasjementet er følgende: ${input.purpose}`,
        `2.2 Arbeidsramme og oppmøte beskrives slik: ${input.details || 'Produksjonen angir tidspunkt, lokasjon, scene, kostyme, sikkerhetsrutiner og annen praktisk informasjon i call sheet eller produksjonsplan.'}`,
      ].join('\n\n'),
    },
    {
      id: 'extra-3',
      heading: '§ 3 Instruks, opptreden og sikkerhet',
      body: [
        '3.1 Medvirkende skal følge instrukser fra produksjonsleder, regi, sikkerhetsansvarlig og annet autorisert produksjonspersonell.',
        '3.2 Medvirkende skal opptre profesjonelt, ivareta sikkerhet på sett og melde fra om forhold som kan påvirke gjennomføringen.',
      ].join('\n\n'),
    },
    {
      id: 'extra-4',
      heading: '§ 4 Konfidensialitet',
      body: [
        '4.1 Medvirkende skal ikke dele manus, sceneinformasjon, call sheets, lokasjon, bilder, video eller annen ikke-offentlig prosjektinformasjon uten skriftlig samtykke fra produksjonen.',
        '4.2 Taushetsplikten gjelder også etter at opptakene er avsluttet.',
      ].join('\n\n'),
    },
    {
      id: 'extra-5',
      heading: '§ 5 Opptak, bruk og rettigheter',
      body: [
        '5.1 Produksjonen kan gjøre opptak av medvirkende innenfor prosjektets formål og bruke materialet i avtalt leveranse, markedsføring, dokumentasjon eller øvrig avtalte distribusjonsflater.',
        '5.2 Medvirkende får ingen selvstendig rett til å publisere produksjonsmateriale uten særskilt skriftlig avtale.',
      ].join('\n\n'),
    },
    {
      id: 'extra-6',
      heading: '§ 6 Honorering og praktiske vilkår',
      body: [
        `6.1 Honorering og praktiske vilkår er som følger: ${input.commercialTerms || 'Eventuell godtgjørelse, refusjon av utlegg, mat, transport, kostymekrav og avlysning følger det som er skriftlig bekreftet av produksjonen.'}`,
        '6.2 Dersom produksjonsdagen flyttes eller avlyses, skal produksjonen varsle uten ugrunnet opphold og oppdatere praktisk informasjon i prosjektverktøyet eller skriftlig melding.',
      ].join('\n\n'),
    },
    {
      id: 'extra-7',
      heading: '§ 7 Personopplysninger, varighet og lovvalg',
      body: [
        '7.1 Produksjonen kan behandle nødvendige personopplysninger for å administrere engasjementet, sikkerhet, logistikk, dokumentasjon og rettighetsforvaltning.',
        `7.2 Avtalen gjelder fra ${input.startDate || 'signering'}${input.endDate ? ` til ${input.endDate}` : ' og så lenge rettigheter og taushetsplikt har betydning for prosjektet.'}`,
        '7.3 Avtalen reguleres av norsk rett og tvister avgjøres ved ordinære norske domstoler.',
      ].join('\n\n'),
    },
  ];
};

export const buildAgreementSections = (input: AgreementSectionInput): ProjectAgreementSection[] => {
  switch (input.agreementType) {
    case 'startup_collaboration':
      return buildStartupCollaborationSections(input);
    case 'smb_content_production':
      return buildSmbContentProductionSections(input);
    case 'internal_training_production':
      return buildInternalTrainingProductionSections(input);
    case 'agency_retainer':
      return buildAgencyRetainerSections(input);
    case 'campaign_production':
      return buildCampaignProductionSections(input);
    case 'change_order':
      return buildChangeOrderSections(input);
    case 'client_approval':
      return buildClientApprovalSections(input);
    case 'extra_terms':
      return buildExtraTermsSections(input);
    case 'client_nda':
    case 'extra_nda':
    default:
      return buildNdaSections(input);
  }
};

export const buildAgreementSummary = (agreement: ProjectAgreement): string => {
  const purpose = readFirstNonEmptyString(agreement.purpose);
  if (purpose) {
    return purpose;
  }

  const projectName = readFirstNonEmptyString(agreement.metadata?.projectName);
  const template = agreement.metadata?.template;
  if (typeof template === 'string') {
    const templateLabel = getAgreementTypeLabel(template);
    return `${templateLabel} for prosjektet «${projectName ?? agreement.project_id}».`;
  }

  return `${getAgreementTypeLabel(agreement.agreement_type)} for prosjektet «${projectName ?? agreement.project_id}».`;
};

export const getAgreementWorkspaceArtifactId = (
  agreement?: Pick<ProjectAgreement, 'id' | 'google_signature'> | null,
  options?: {
    preferAudit?: boolean;
  },
): string | undefined => {
  if (!agreement) {
    return undefined;
  }

  if (options?.preferAudit && agreement.google_signature?.auditArtifactId) {
    return agreement.google_signature.auditArtifactId;
  }

  return agreement.google_signature?.signedPdfArtifactId
    ?? agreement.google_signature?.pdfSnapshotArtifactId
    ?? agreement.google_signature?.sourceArtifactId
    ?? (!options?.preferAudit ? agreement.google_signature?.auditArtifactId : undefined)
    ?? `agreement:${agreement.id}`;
};
