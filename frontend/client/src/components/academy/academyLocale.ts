import { useCallback } from 'react';
import { useLanguage, type AppLanguage } from '@/components/language-provider';

type LocaleEntry = {
  no: string;
  en: string;
};

const COMMON_TRANSLATIONS: LocaleEntry[] = [
  { en: 'Overview', no: 'Oversikt' },
  { en: 'Curriculum', no: 'Læreplan' },
  { en: 'Lessons', no: 'Ferdigheter' },
  { en: 'Skills', no: 'Ferdigheter' },
  { en: 'Competencies', no: 'Kompetanser' },
  { en: 'Course Foundation', no: 'Kompetansegrunnlag' },
  { en: 'Course Architecture', no: 'Kursarkitektur' },
  { en: 'Media', no: 'Media' },
  { en: 'Assignments', no: 'Oppgaver' },
  { en: 'Enrollment', no: 'Påmelding' },
  { en: 'Cohort Settings', no: 'Kohortinnstillinger' },
  { en: 'Analytics', no: 'Analyser' },
  { en: 'Instructors', no: 'Instruktører' },
  { en: 'Monetization', no: 'Monetisering' },
  { en: 'Settings', no: 'Innstillinger' },
  { en: 'CTA Studio', no: 'CTA-Studio' },
  { en: 'Lower Thirds Studio', no: 'Supring Studio' },
  { en: 'Lower Thirds', no: 'Supring' },
  { en: 'Animated Lower Thirds', no: 'Supring Studio' },
  { en: 'Presentation Overlay', no: 'Presentasjonsstudio' },
  { en: 'Presentation Studio', no: 'Presentasjonsstudio' },
  { en: 'Create New Course', no: 'Opprett nytt kurs' },
  { en: 'Preview', no: 'Forhåndsvis' },
  { en: 'Save', no: 'Lagre' },
  { en: 'Publish', no: 'Publiser' },
  { en: 'All Courses', no: 'Alle kurs' },
  { en: 'All Modules', no: 'Alle kompetanser' },
  { en: 'Continue Learning', no: 'Fortsett læring' },
  { en: 'My Tracks', no: 'Mine spor' },
  { en: 'Upcoming Sessions', no: 'Kommende sesjoner' },
  { en: 'Performance Analytics', no: 'Ytelsesanalyse' },
  { en: 'Course Completion', no: 'Kursfullføring' },
  { en: 'Skill Level', no: 'Ferdighetsnivå' },
  { en: 'Day Streak', no: 'Dagsrekke' },
  { en: 'All', no: 'Alle' },
  { en: 'Join', no: 'Bli med' },
  { en: 'Search courses, mentors, modules...', no: 'Søk kurs, mentorer, kompetanser...' },
  { en: 'Search courses, mentors, modules…', no: 'Søk kurs, mentorer, kompetanser…' },
  { en: 'Search courses, features, modules...', no: 'Søk kurs, funksjoner, kompetanser...' },
  { en: 'Search modules...', no: 'Søk kompetanser...' },
  { en: 'Search Modules...', no: 'Søk kompetanser...' },
  { en: 'Module Manager', no: 'Kursarkitektur' },
  { en: 'Lesson Editor', no: 'Ferdighetsredigering' },
  { en: 'Annotation Studio', no: 'Annoteringsstudio' },
  { en: 'Annotation', no: 'Annotering' },
  { en: 'Quiz', no: 'Quiz' },
  { en: 'Quiz Studio', no: 'Quiz Studio' },
  { en: 'CTA', no: 'CTA' },
  { en: 'LowerThirds', no: 'Supring Studio' },
  { en: 'Player', no: 'Spiller' },
  { en: 'Monetize', no: 'Monetiser' },
  { en: 'Back', no: 'Tilbake' },
  { en: 'New Module', no: 'Ny kompetanse' },
  { en: 'New Lesson', no: 'Ny ferdighet' },
  { en: 'Add Module', no: 'Legg til kompetanse' },
  { en: 'Add Lesson', no: 'Legg til ferdighet' },
  { en: 'Draft', no: 'Utkast' },
  { en: 'Published', no: 'Publisert' },
  { en: 'Save Draft', no: 'Lagre utkast' },
  { en: 'Category', no: 'Kategori' },
  { en: 'Skill Level', no: 'Nivå' },
  { en: 'Price (NOK)', no: 'Pris (NOK)' },
  { en: 'Add Tag', no: 'Legg til tagg' },
  { en: 'Unpublish', no: 'Avpubliser' },
  { en: 'Duplicate', no: 'Dupliser' },
  { en: 'Delete', no: 'Slett' },
  { en: 'Learners', no: 'Deltakere' },
  { en: 'Completion', no: 'Fullføring' },
  { en: 'Total Learners', no: 'Totalt antall deltakere' },
  { en: 'Avg Watch Time', no: 'Gj.sn. seertid' },
  { en: 'Completion Rate', no: 'Fullføringsrate' },
  { en: 'Revenue', no: 'Inntekt' },
  { en: 'Release Date', no: 'Publiseringsdato' },
  { en: 'Manually Enable Release', no: 'Aktiver publisering manuelt' },
  { en: 'Schedule Release', no: 'Planlegg publisering' },
  { en: 'Release Scheduled', no: 'Planlagt publisering' },
  { en: 'Manual Release', no: 'Manuell publisering' },
  { en: 'Not published', no: 'Ikke publisert' },
  { en: 'Active', no: 'Aktiv' },
  { en: 'Early Access', no: 'Tidlig tilgang' },
  { en: 'Invitation Only', no: 'Kun invitasjon' },
  { en: 'Closed', no: 'Lukket' },
  { en: 'Drip Release', no: 'Dryppslipp' },
  { en: 'Top Performer', no: 'Toppytelse' },
  { en: 'Needs Follow-up', no: 'Trenger oppfølging' },
  { en: 'Core', no: 'Kjerne' },
  { en: 'completed Chapter 3', no: 'fullførte kapittel 3' },
  { en: 'joined Students room', no: 'ble med i studentrommet' },
  { en: 'submitted assignment', no: 'leverte oppgave' },
  { en: 'Cancel', no: 'Avbryt' },
  { en: 'Description', no: 'Beskrivelse' },
  { en: 'Module Title', no: 'Kompetansetittel' },
  { en: 'Modules', no: 'Kompetanser' },
  { en: 'Localization', no: 'Lokalisering' },
  { en: 'Prerequisites', no: 'Forutsetninger' },
  { en: 'Schedule', no: 'Planlegging' },
  { en: 'PLACEHOLDER PREVIEW', no: 'PLACEHOLDER FORHÅNDSVISNING' },
];

const EN_TO_NO = new Map(COMMON_TRANSLATIONS.map((entry) => [entry.en, entry.no]));
const NO_TO_EN = new Map(COMMON_TRANSLATIONS.map((entry) => [entry.no, entry.en]));
const EN_TO_NO_LOWER = new Map(COMMON_TRANSLATIONS.map((entry) => [entry.en.toLowerCase(), entry.no]));
const NO_TO_EN_LOWER = new Map(COMMON_TRANSLATIONS.map((entry) => [entry.no.toLowerCase(), entry.en]));

export const translateAcademyLabel = (label: string, language: AppLanguage): string => {
  const trimmed = label.trim();
  if (!trimmed) return label;
  const lower = trimmed.toLowerCase();

  if (language === 'no') {
    return EN_TO_NO.get(trimmed) ?? EN_TO_NO_LOWER.get(lower) ?? label;
  }

  return NO_TO_EN.get(trimmed) ?? NO_TO_EN_LOWER.get(lower) ?? label;
};

export const useAcademyLocale = () => {
  const { language, setLanguage } = useLanguage();

  const tt = useCallback(
    (no: string, en: string) => (language === 'no' ? no : en),
    [language],
  );

  const navLabel = useCallback(
    (label: string) => translateAcademyLabel(label, language),
    [language],
  );

  return {
    language,
    setLanguage,
    tt,
    navLabel,
    isNorwegian: language === 'no',
  };
};
