/**
 * talent-physical-vocabulary.ts
 *
 * Kontrollerte lister for de fysiske trekkene casting-byråer spør om.
 * Delt mellom frontend (nedtrekk) og backend (validering) — ett sted, så
 * lagret verdi og gyldig verdi ikke kan skli fra hverandre.
 *
 * Hver verdi har en stabil `id` som lagres i databasen, og etiketter på
 * begge språk. Da kan et byrå filtrere på «blond» uansett om skuespilleren
 * fylte ut skjemaet på norsk eller engelsk, og en ny språkversjon krever
 * ingen datamigrasjon.
 *
 * 🔑 Etnisitet ligger bevisst IKKE her sammen med resten. Opplysninger om
 * etnisk opprinnelse er en særlig kategori etter GDPR art. 9 og er skilt ut
 * i sitt eget samtykke-scope — se ETHNICITY_OPTIONS nederst.
 */

export type VocabularyLocale = 'no' | 'en';

export interface VocabularyOption {
  id: string;
  no: string;
  en: string;
}

export const HAIR_COLOR_OPTIONS: VocabularyOption[] = [
  { id: 'light_blonde', no: 'Lys blond', en: 'Light blonde' },
  { id: 'middle_blonde', no: 'Middels blond', en: 'Middle blonde' },
  { id: 'dark_blonde', no: 'Mørk blond', en: 'Dark blonde' },
  { id: 'light_brown', no: 'Lysebrun', en: 'Light brown' },
  { id: 'middle_brown', no: 'Middels brun', en: 'Middle brown' },
  { id: 'dark_brown', no: 'Mørkebrun', en: 'Dark brown' },
  { id: 'red', no: 'Rød', en: 'Red' },
  { id: 'red_blonde', no: 'Rødblond', en: 'Red blonde' },
  { id: 'red_brown', no: 'Rødbrun', en: 'Red brown' },
  { id: 'black', no: 'Svart', en: 'Black' },
  { id: 'black_brown', no: 'Svartbrun', en: 'Black brown' },
  { id: 'grey', no: 'Grå', en: 'Grey' },
  { id: 'salt_and_pepper', no: 'Gråsprengt', en: 'Salt and pepper' },
  { id: 'white', no: 'Hvit', en: 'White' },
];

export const EYE_COLOR_OPTIONS: VocabularyOption[] = [
  { id: 'blue', no: 'Blå', en: 'Blue' },
  { id: 'green', no: 'Grønn', en: 'Green' },
  { id: 'brown', no: 'Brun', en: 'Brown' },
  { id: 'grey', no: 'Grå', en: 'Grey' },
  { id: 'blue_green', no: 'Blågrønn', en: 'Blue-green' },
  { id: 'blue_grey', no: 'Blågrå', en: 'Blue-grey' },
  { id: 'green_brown', no: 'Grønnbrun', en: 'Green-brown' },
  { id: 'green_grey', no: 'Grønngrå', en: 'Green-grey' },
  { id: 'green_blue', no: 'Grønnblå', en: 'Green-blue' },
];

export const FIGURE_OPTIONS: VocabularyOption[] = [
  { id: 'slim', no: 'Slank', en: 'Slim' },
  { id: 'normal', no: 'Normal', en: 'Normal' },
  { id: 'sporty', no: 'Sporty', en: 'Sporty' },
  { id: 'muscular', no: 'Muskuløs', en: 'Muscular' },
  { id: 'sturdy', no: 'Kraftig', en: 'Sturdy' },
  { id: 'full', no: 'Fyldig', en: 'Full' },
];

/**
 * Etnisk opprinnelse — særlig kategori (GDPR art. 9).
 *
 * Listen er byråenes egen, med to bevisste endringer: «Gypsy» er erstattet
 * av «Roma», som er selvbetegnelsen, og «Caucasian» er gjengitt som
 * «Europeisk/kaukasisk» siden «kaukasisk» alene er uklart på norsk.
 */
export const ETHNICITY_OPTIONS: VocabularyOption[] = [
  { id: 'european', no: 'Europeisk/kaukasisk', en: 'Caucasian / European' },
  { id: 'northern_european', no: 'Nordeuropeisk', en: 'Northern European' },
  { id: 'middle_european', no: 'Midteuropeisk', en: 'Middle Europe' },
  { id: 'eastern_european', no: 'Østeuropeisk', en: 'East Europe' },
  { id: 'southern_european', no: 'Søreuropeisk', en: 'South Europe' },
  { id: 'latin_american_fair', no: 'Latinamerikansk (lys)', en: 'Latin American (fair)' },
  { id: 'latin_american_dark', no: 'Latinamerikansk (mørk)', en: 'Latin American (dark)' },
  { id: 'south_american', no: 'Søramerikansk', en: 'South America' },
  { id: 'african_descent', no: 'Afrikansk opphav', en: 'African descent' },
  { id: 'middle_east', no: 'Midtøsten', en: 'Middle East' },
  { id: 'asian', no: 'Asiatisk', en: 'Asian' },
  { id: 'south_asian', no: 'Sørasiatisk', en: 'South Asian' },
  { id: 'india', no: 'India', en: 'India' },
  { id: 'pakistan', no: 'Pakistan', en: 'Pakistan' },
  { id: 'japan', no: 'Japan', en: 'Japan' },
  { id: 'native_american', no: 'Urfolk i Amerika', en: 'Native American' },
  { id: 'aborigine', no: 'Aboriginsk', en: 'Aborigine' },
  { id: 'roma', no: 'Rom', en: 'Roma' },
];

/** Jeans-bredde og -lengde slik byråene lister dem (tommer). */
export const JEANS_WIDTHS = [
  24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 38, 40, 42, 44, 46, 48,
];
export const JEANS_LENGTHS = [24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 36, 38, 40];

/** Målene som oppgis i centimeter. */
export const BODY_MEASUREMENT_FIELDS = [
  { id: 'head_cm', no: 'Hodemål', en: 'Head size' },
  { id: 'neck_cm', no: 'Halsmål', en: 'Neck size' },
  { id: 'chest_cm', no: 'Brystmål', en: 'Chest size' },
  { id: 'waist_cm', no: 'Livmål', en: 'Waist size' },
  { id: 'hip_cm', no: 'Hoftemål', en: 'Hip size' },
] as const;

/** De tre bildene byråene krever, i tillegg til headshot. */
export const REQUIRED_PHOTO_KINDS = [
  { id: 'face_front', no: 'Ansikt nært forfra', en: 'Face close-up, front' },
  { id: 'face_profile', no: 'Ansikt fra siden', en: 'Face, profile' },
  { id: 'full_body_front', no: 'Helfigur forfra', en: 'Full figure, front' },
] as const;

export type RequiredPhotoKind = (typeof REQUIRED_PHOTO_KINDS)[number]['id'];

/** Alle nøklene physical_attributes kan inneholde. Ukjente forkastes. */
export const PHYSICAL_ATTRIBUTE_KEYS = [
  'figure',
  'jeans_width',
  'jeans_length',
  'clothing_size',
  'shoe_size',
  'head_cm',
  'neck_cm',
  'chest_cm',
  'waist_cm',
  'hip_cm',
  'tattoos',
  'own_equipment',
  'measured_at',
] as const;

export type PhysicalAttributeKey = (typeof PHYSICAL_ATTRIBUTE_KEYS)[number];

export function vocabularyLabel(
  options: VocabularyOption[],
  id: string | null | undefined,
  locale: VocabularyLocale = 'no',
): string | null {
  if (!id) return null;
  const match = options.find((o) => o.id === id);
  return match ? match[locale] : id;
}

export function isValidVocabularyId(options: VocabularyOption[], id: unknown): boolean {
  return typeof id === 'string' && options.some((o) => o.id === id);
}
