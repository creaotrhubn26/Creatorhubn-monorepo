import { useCallback } from 'react';
import { useLanguage, type AppLanguage } from '@/components/language-provider';

/**
 * communityLocale — no/en for Community-flatene, modellert etter academyLocale.
 * Community hadde ingen i18n; utenlandske vendors møtte kun norsk. `tt(no, en)`
 * er hovedverktøyet for inline-strenger; `label()` gjør oppslag i en felles
 * ordbok for gjenbrukte etiketter (nav/CTA/status).
 */
type LocaleEntry = { no: string; en: string };

const COMMON_TRANSLATIONS: LocaleEntry[] = [
  { en: 'Community', no: 'Fellesskap' },
  { en: 'Feed', no: 'Feed' },
  { en: 'Home', no: 'Hjem' },
  { en: 'Explore', no: 'Utforsk' },
  { en: 'Members', no: 'Medlemmer' },
  { en: 'Groups', no: 'Grupper' },
  { en: 'Events', no: 'Arrangementer' },
  { en: 'Mentors', no: 'Mentorer' },
  { en: 'Academy', no: 'Academy' },
  { en: 'Academy overview', no: 'Academy-oversikt' },
  { en: 'Notifications', no: 'Varsler' },
  { en: 'Messages', no: 'Meldinger' },
  { en: 'Settings', no: 'Innstillinger' },
  { en: 'Search', no: 'Søk' },
  { en: 'Search the community…', no: 'Søk i fellesskapet…' },
  { en: 'Create post', no: 'Lag innlegg' },
  { en: 'New post', no: 'Nytt innlegg' },
  { en: 'Post', no: 'Publiser' },
  { en: 'Comment', no: 'Kommenter' },
  { en: 'Comments', no: 'Kommentarer' },
  { en: 'Reply', no: 'Svar' },
  { en: 'Like', no: 'Lik' },
  { en: 'Likes', no: 'Liker' },
  { en: 'Share', no: 'Del' },
  { en: 'Follow', no: 'Følg' },
  { en: 'Following', no: 'Følger' },
  { en: 'Join', no: 'Bli med' },
  { en: 'Joined', no: 'Medlem' },
  { en: 'Leave', no: 'Forlat' },
  { en: 'Save', no: 'Lagre' },
  { en: 'Cancel', no: 'Avbryt' },
  { en: 'Delete', no: 'Slett' },
  { en: 'Edit', no: 'Rediger' },
  { en: 'Report', no: 'Rapporter' },
  { en: 'Back', no: 'Tilbake' },
  { en: 'Load more', no: 'Last mer' },
  { en: 'See all', no: 'Se alle' },
  { en: 'Trending', no: 'Populært' },
  { en: 'Popular', no: 'Populært' },
  { en: 'Latest', no: 'Nyeste' },
  { en: 'Top', no: 'Topp' },
  { en: 'All', no: 'Alle' },
  { en: 'Become a mentor', no: 'Bli mentor' },
  { en: 'Welcome to the community', no: 'Velkommen til fellesskapet' },
  { en: 'Members online', no: 'Medlemmer på nett' },
  { en: 'What is on your mind?', no: 'Hva tenker du på?' },
];

const EN_TO_NO = new Map(COMMON_TRANSLATIONS.map((e) => [e.en, e.no]));
const NO_TO_EN = new Map(COMMON_TRANSLATIONS.map((e) => [e.no, e.en]));
const EN_TO_NO_LOWER = new Map(COMMON_TRANSLATIONS.map((e) => [e.en.toLowerCase(), e.no]));
const NO_TO_EN_LOWER = new Map(COMMON_TRANSLATIONS.map((e) => [e.no.toLowerCase(), e.en]));

export const translateCommunityLabel = (label: string, language: AppLanguage): string => {
  const trimmed = label.trim();
  if (!trimmed) return label;
  const lower = trimmed.toLowerCase();
  if (language === 'no') {
    return EN_TO_NO.get(trimmed) ?? EN_TO_NO_LOWER.get(lower) ?? label;
  }
  return NO_TO_EN.get(trimmed) ?? NO_TO_EN_LOWER.get(lower) ?? label;
};

export const useCommunityLocale = () => {
  const { language, setLanguage } = useLanguage();

  const tt = useCallback(
    (no: string, en: string) => (language === 'no' ? no : en),
    [language],
  );

  const label = useCallback(
    (l: string) => translateCommunityLabel(l, language),
    [language],
  );

  return {
    language,
    setLanguage,
    tt,
    label,
    isNorwegian: language === 'no',
  };
};
