import type { EmailTemplate } from '../EmailDesigner/EmailDesigner';

export interface AdminEmailDesignerPreset {
  id: string;
  title: string;
  category: string;
  description: string;
  summary: string;
  tone: string;
  accentColor: string;
  tags: string[];
  preview: string[];
  template: EmailTemplate;
}

type EmailComponent = EmailTemplate['components'][number];

const LOGO_SRC = '/creatorhub-logo-amber.svg';

const baseGlobalStyles: EmailTemplate['globalStyles'] = {
  backgroundColor: '#f6f1ea',
  fontFamily: "'Helvetica Neue', Arial, sans-serif",
  fontSize: 15,
  lineHeight: 1.65,
  textColor: '#2a241d',
  linkColor: '#ff8c00',
  containerWidth: 640,
};

function createImageComponent(id: string): EmailComponent {
  return {
    id,
    type: 'image',
    content: {
      src: LOGO_SRC,
      alt: 'CreatorHub',
    },
    styles: {
      width: '148px',
      textAlign: 'center',
      marginBottom: 20,
    },
  };
}

function createHeaderComponent(
  id: string,
  text: string,
  color: string,
  fontSize = 32,
): EmailComponent {
  return {
    id,
    type: 'header',
    content: { text },
    styles: {
      color,
      textAlign: 'center',
      fontSize,
      fontWeight: 'bold',
      marginBottom: 18,
    },
  };
}

function createTextComponent(
  id: string,
  text: string,
  textAlign: 'left' | 'center' = 'left',
  fontSize = 16,
  marginBottom = 16,
): EmailComponent {
  return {
    id,
    type: 'text',
    content: { text },
    styles: {
      color: '#40372d',
      textAlign,
      fontSize,
      marginBottom,
    },
  };
}

function createButtonComponent(
  id: string,
  text: string,
  url: string,
  backgroundColor: string,
): EmailComponent {
  return {
    id,
    type: 'button',
    content: { text, url },
    styles: {
      backgroundColor,
      color: '#ffffff',
      borderRadius: 999,
      paddingX: 28,
      paddingY: 13,
      fontSize: 15,
      fontWeight: 'bold',
      marginBottom: 24,
    },
  };
}

function createDividerComponent(id: string, color = '#eadfce'): EmailComponent {
  return {
    id,
    type: 'divider',
    content: {},
    styles: {
      color,
      height: 1,
      marginTop: 8,
      marginBottom: 22,
    },
  };
}

function createFooterComponent(id: string): EmailComponent {
  return {
    id,
    type: 'footer',
    content: {
      text: 'CreatorHub | creatorhubn.com | Kontakt: kontakt@creatorhubn.com',
    },
    styles: {
      color: '#75685a',
      textAlign: 'center',
      fontSize: 12,
      marginTop: 28,
    },
  };
}

function buildTemplate(
  id: string,
  name: string,
  subject: string,
  preheader: string,
  accentColor: string,
  components: EmailComponent[],
  backgroundColor = '#f6f1ea',
): EmailTemplate {
  return {
    id,
    name,
    category: 'general',
    subject,
    preheader,
    context: 'general',
    components,
    globalStyles: {
      ...baseGlobalStyles,
      backgroundColor,
      linkColor: accentColor,
    },
  };
}

export const ADMIN_EMAIL_DESIGNER_PRESETS: AdminEmailDesignerPreset[] = [
  {
    id: 'access-approved',
    title: 'Tilgang godkjent',
    category: 'Onboarding',
    description: 'Brukes når en ny bruker er godkjent og klar for dashboardet.',
    summary: 'En trygg og profesjonell startmail med tydelig handling.',
    tone: 'Trygg og profesjonell',
    accentColor: '#ff8c00',
    tags: ['Logo', 'Godkjenning', 'CTA'],
    preview: [
      'Hei {{firstName}}, kontoen din er nå klar i CreatorHub.',
      'Gå rett til dashboardet og fortsett oppsettet uten friksjon.',
    ],
    template: buildTemplate(
      'access-approved-template',
      'Tilgang godkjent',
      'Tilgangen din i CreatorHub er klar',
      'Kontoen din er godkjent og klar til bruk',
      '#ff8c00',
      [
        createImageComponent('logo-1'),
        createHeaderComponent('header-1', 'Tilgangen din er klar', '#221d17'),
        createTextComponent(
          'text-1',
          'Hei {{firstName}}, vi har godkjent kontoen din i CreatorHub. Alt er klart for at du kan logge inn, fullføre profilen din og starte arbeidet.',
          'center',
        ),
        createButtonComponent('button-1', 'Gå til dashboard', '{{dashboardUrl}}', '#ff8c00'),
        createDividerComponent('divider-1'),
        createTextComponent(
          'text-2',
          'Rolle: {{profession}} | Bedrift: {{companyName}} | Innlogging: {{loginUrl}}',
          'center',
          14,
          10,
        ),
        createFooterComponent('footer-1'),
      ],
    ),
  },
  {
    id: 'welcome-sequence',
    title: 'Velkomst og neste steg',
    category: 'Onboarding',
    description: 'Brukes etter godkjenning når du vil guide brukeren videre.',
    summary: 'En ryddig velkomstmail som setter forventninger og tempo fra start.',
    tone: 'Vennlig og strukturert',
    accentColor: '#8b5cf6',
    tags: ['Velkomst', 'Oppstart', 'Stegvis'],
    preview: [
      'Velkommen inn, {{firstName}}. Her er de tre viktigste stegene.',
      'Malen kombinerer varm introduksjon med konkret operativ retning.',
    ],
    template: buildTemplate(
      'welcome-sequence-template',
      'Velkomst og neste steg',
      'Velkommen til CreatorHub',
      'Her er de viktigste stegene for å komme raskt i gang',
      '#8b5cf6',
      [
        createImageComponent('logo-2'),
        createHeaderComponent('header-2', 'Velkommen til CreatorHub', '#1f1a14'),
        createTextComponent(
          'text-3',
          'Hei {{firstName}}, så bra å ha deg med. For å komme raskt i gang anbefaler vi at du fullfører profilen, legger inn bedriftsinformasjon og åpner dashboardet ditt i dag.',
          'center',
        ),
        createDividerComponent('divider-2', '#e9ddf7'),
        createTextComponent(
          'text-4',
          '1. Fullfør profil | 2. Kontroller tilgang og rolle | 3. Start med de viktigste arbeidsflatene',
          'left',
          15,
          18,
        ),
        createButtonComponent('button-2', 'Start oppsettet', '{{dashboardUrl}}', '#8b5cf6'),
        createFooterComponent('footer-2'),
      ],
      '#f7f2ff',
    ),
  },
  {
    id: 'role-updated',
    title: 'Rolle oppdatert',
    category: 'Tilgang',
    description: 'Brukes når admin endrer rolle og vil varsle brukeren tydelig.',
    summary: 'En kortfattet statusmail for tilgangs- og rolleendringer.',
    tone: 'Presis og ansvarlig',
    accentColor: '#2563eb',
    tags: ['Rolle', 'Tilgang', 'Varsling'],
    preview: [
      'Tilgangen din er oppdatert med en ny rolle i CreatorHub.',
      'Passer når admin må kommunisere kontrollert og tydelig.',
    ],
    template: buildTemplate(
      'role-updated-template',
      'Rolle oppdatert',
      'Rollen din i CreatorHub er oppdatert',
      'Ny tilgang er registrert på kontoen din',
      '#2563eb',
      [
        createImageComponent('logo-3'),
        createHeaderComponent('header-3', 'Rollen din er oppdatert', '#172033'),
        createTextComponent(
          'text-5',
          'Hei {{firstName}}, vi har oppdatert tilgangen din i CreatorHub. Den nye rollen din gir deg riktig arbeidsflate og riktige tillatelser videre.',
          'center',
        ),
        createButtonComponent('button-3', 'Se oppdatert tilgang', '{{dashboardUrl}}', '#2563eb'),
        createDividerComponent('divider-3', '#dbe7ff'),
        createTextComponent(
          'text-6',
          'Hvis noe ser feil ut, kan du svare direkte på denne e-posten så justerer vi tilgangene raskt.',
          'center',
          14,
          12,
        ),
        createFooterComponent('footer-3'),
      ],
      '#f3f7ff',
    ),
  },
  {
    id: 'academy-access',
    title: 'Academy-tilgang aktiv',
    category: 'Academy',
    description: 'Brukes når en bruker har fått tilgang til kurs og opplæring.',
    summary: 'En premium kursmail med fokus på verdi og neste handling.',
    tone: 'Lærende og premium',
    accentColor: '#0f766e',
    tags: ['Academy', 'Læring', 'Medlemskap'],
    preview: [
      'Academy-tilgangen din er aktiv. Innholdet er klart for deg.',
      'Setter riktig forventning til opplæring og progresjon.',
    ],
    template: buildTemplate(
      'academy-access-template',
      'Academy-tilgang aktiv',
      'Academy-tilgangen din er nå aktiv',
      'Logg inn og fortsett med kursene dine i CreatorHub Academy',
      '#0f766e',
      [
        createImageComponent('logo-4'),
        createHeaderComponent('header-4', 'Academy-tilgangen din er aktiv', '#153532'),
        createTextComponent(
          'text-7',
          'Hei {{firstName}}, du har nå tilgang til CreatorHub Academy. Kurs, guider og oppdatert faginnhold ligger klart i arbeidsflaten din.',
          'center',
        ),
        createButtonComponent('button-4', 'Åpne Academy', '{{dashboardUrl}}', '#0f766e'),
        createDividerComponent('divider-4', '#cdece8'),
        createTextComponent(
          'text-8',
          'Tips: Start med introduksjonsmodulen og del gjerne Academy med teamet ditt dersom du har administratorrettigheter.',
          'center',
          14,
          12,
        ),
        createFooterComponent('footer-4'),
      ],
      '#eef9f7',
    ),
  },
  {
    id: 'payment-confirmed',
    title: 'Betaling bekreftet',
    category: 'Betaling',
    description: 'Brukes når plan eller aktivering er betalt og brukeren skal videre.',
    summary: 'En ryddig bekreftelse som knytter betaling til neste handling.',
    tone: 'Rolig og tillitsvekkende',
    accentColor: '#b45309',
    tags: ['Betaling', 'Aktivering', 'Plan'],
    preview: [
      'Vi har registrert betalingen din, og tilgangen er aktiv.',
      'Passer for planer, oppgraderinger og medlemskapsbekreftelser.',
    ],
    template: buildTemplate(
      'payment-confirmed-template',
      'Betaling bekreftet',
      'Betalingen din er registrert',
      'Planen din er aktiv og klar i CreatorHub',
      '#b45309',
      [
        createImageComponent('logo-5'),
        createHeaderComponent('header-5', 'Betalingen er registrert', '#2c1a07'),
        createTextComponent(
          'text-9',
          'Hei {{firstName}}, vi har registrert betalingen din og aktivert tilgangen din. Du kan fortsette direkte i CreatorHub uten flere steg.',
          'center',
        ),
        createButtonComponent('button-5', 'Fortsett i CreatorHub', '{{dashboardUrl}}', '#b45309'),
        createTextComponent(
          'text-10',
          'Har du flere brukere eller roller som skal aktiveres, kan admin fortsette oppsettet direkte fra brukerpanelet.',
          'center',
          14,
          12,
        ),
        createFooterComponent('footer-5'),
      ],
      '#fff7ed',
    ),
  },
  {
    id: 'enterprise-followup',
    title: 'Enterprise-oppfølging',
    category: 'Enterprise',
    description: 'Brukes i mer formell dialog med team og enterprise-kunder.',
    summary: 'En moden mal for status, avklaringer og videre oppfølging.',
    tone: 'Formell og konsis',
    accentColor: '#1f7a5a',
    tags: ['Enterprise', 'Oppfølging', 'Team'],
    preview: [
      'Oppsummering av status, tilgang og neste steg for teamet.',
      'Passer når admin vil kommunisere profesjonelt med flere interessenter.',
    ],
    template: buildTemplate(
      'enterprise-followup-template',
      'Enterprise-oppfølging',
      'Status og neste steg for CreatorHub-oppsettet',
      'Oppsummering av tilgang, avklaringer og neste handlinger',
      '#1f7a5a',
      [
        createImageComponent('logo-6'),
        createHeaderComponent('header-6', 'Status for CreatorHub-oppsettet', '#16382d'),
        createTextComponent(
          'text-11',
          'Hei {{firstName}}, her er en kort status på oppsettet for teamet deres i CreatorHub. Tilganger og roller er på plass, og vi anbefaler at dere går gjennom neste steg samlet.',
          'center',
        ),
        createButtonComponent('button-6', 'Åpne teamoversikt', '{{dashboardUrl}}', '#1f7a5a'),
        createDividerComponent('divider-6', '#d5eee4'),
        createTextComponent(
          'text-12',
          'Svar gjerne på denne e-posten dersom dere ønsker workshop, opplæring eller ytterligere tilpasninger i adminoppsettet.',
          'center',
          14,
          12,
        ),
        createFooterComponent('footer-6'),
      ],
      '#eff8f4',
    ),
  },
  {
    id: 'setup-reminder',
    title: 'Påminnelse om oppsett',
    category: 'Reaktivering',
    description: 'Brukes når brukeren er godkjent, men ikke har fullført oppsettet.',
    summary: 'En vennlig påminnelse som får brukeren tilbake til produktet.',
    tone: 'Vennlig og tydelig',
    accentColor: '#db2777',
    tags: ['Påminnelse', 'Aktivering', 'Retur'],
    preview: [
      'Du er nesten i mål. Fortsett oppsettet i CreatorHub.',
      'God for å hente brukere tilbake uten å virke masete.',
    ],
    template: buildTemplate(
      'setup-reminder-template',
      'Påminnelse om oppsett',
      'Du er nesten klar i CreatorHub',
      'Fortsett oppsettet ditt og kom i gang på noen minutter',
      '#db2777',
      [
        createImageComponent('logo-7'),
        createHeaderComponent('header-7', 'Du er nesten i mål', '#3f1127'),
        createTextComponent(
          'text-13',
          'Hei {{firstName}}, kontoen din er aktiv, men oppsettet ditt mangler fortsatt noen siste detaljer. Det tar bare et par minutter å fullføre.',
          'center',
        ),
        createButtonComponent('button-7', 'Fortsett oppsettet', '{{dashboardUrl}}', '#db2777'),
        createTextComponent(
          'text-14',
          'Når du er ferdig, har du full oversikt over tilgang, arbeidsflater og CreatorHub-funksjonene som er aktivert for deg.',
          'center',
          14,
          12,
        ),
        createFooterComponent('footer-7'),
      ],
      '#fff1f7',
    ),
  },
  {
    id: 'platform-update',
    title: 'Plattformoppdatering',
    category: 'Drift',
    description: 'Brukes til viktige meldinger om nye funksjoner eller endringer.',
    summary: 'En profesjonell mal for drift, forbedringer og lanseringer.',
    tone: 'Informativ og premium',
    accentColor: '#7c3aed',
    tags: ['Oppdatering', 'Produkt', 'Nyheter'],
    preview: [
      'Del nye funksjoner eller viktige endringer med et mer kuratert uttrykk.',
      'Passer når admin vil sende noe som ser gjennomarbeidet ut.',
    ],
    template: buildTemplate(
      'platform-update-template',
      'Plattformoppdatering',
      'Nytt i CreatorHub',
      'Se de viktigste oppdateringene vi har gjort for teamet ditt',
      '#7c3aed',
      [
        createImageComponent('logo-8'),
        createHeaderComponent('header-8', 'Nytt i CreatorHub', '#24124b'),
        createTextComponent(
          'text-15',
          'Hei {{firstName}}, vi har oppdatert CreatorHub med forbedringer som gjør adminarbeid, onboarding og tilgangsstyring enklere å holde ryddig over tid.',
          'center',
        ),
        createDividerComponent('divider-8', '#e5d8ff'),
        createTextComponent(
          'text-16',
          'Bruk denne malen til lanseringer, driftsinformasjon eller oppsummeringer etter endringer i plattformen.',
          'center',
        ),
        createButtonComponent('button-8', 'Se oppdateringene', '{{dashboardUrl}}', '#7c3aed'),
        createFooterComponent('footer-8'),
      ],
      '#f6f1ff',
    ),
  },
];
