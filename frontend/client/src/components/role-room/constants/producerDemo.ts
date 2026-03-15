export const CONTENT_PRODUCER_DEMO_PROJECT_ID = 'content-producer-demo-2026';

export const PRODUCER_DEMO_PROJECT_NAME = 'Northwind Drilling - Sikker start';
export const PRODUCER_DEMO_PROJECT_DESCRIPTION =
  'Fiktivt bedriftsprosjekt for Northwind Drilling AS: en serie med HMS-, onboarding- og rekrutteringsfilmer for offshore-personell, nye skiftledere og innleide teknikere.';
export const PRODUCER_DEMO_CLIENT_NAME = 'Helene Nygard';
export const PRODUCER_DEMO_CLIENT_EMAIL = 'helene.nygard@northwinddrilling.no';
export const PRODUCER_DEMO_CLIENT_COMPANY = 'Northwind Drilling AS';
export const PRODUCER_DEMO_CLIENT_ORGANIZATION_NUMBER = '912345678';
export const PRODUCER_DEMO_CLIENT_ADDRESS = 'Kaiveien 18, 4033 Stavanger';
export const PRODUCER_DEMO_PRIMARY_LOCATION = 'Northwind Training Center';
export const PRODUCER_DEMO_COLLABORATOR_NAME = 'Mina Haugen';
export const PRODUCER_DEMO_COLLABORATOR_EMAIL = 'mina.haugen@northwindstudio.no';

const LEGACY_PRODUCER_DEMO_MARKERS = [
  'innholdsprodusent demo',
  'innholdsprodusent demo-prosjekt',
  'demo-prosjekt for innholdsprodusent',
  'innholdsprodusent team',
  'innholdsprodusent-team',
  'innholdsprodusenten',
  'innholdsprodusent lead',
  'fra brief til godkjent leveranse',
  'produktlansering - studio demo',
  'prøv demo-prosjektet for innholdsprodusent-flyt',
  'demo-klient',
];

export function containsLegacyProducerDemoMarker(
  ...values: Array<string | null | undefined>
): boolean {
  const haystack = values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();

  if (!haystack) {
    return false;
  }

  return LEGACY_PRODUCER_DEMO_MARKERS.some((marker) => haystack.includes(marker));
}
