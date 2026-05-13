/**
 * StoryLogic validation functions — pure functions, no React/MUI deps.
 *
 * Ekstraktert fra StoryLogicPanel.tsx for å:
 *   1. Gjenvinne type-sikkerhet og isolere logikken fra UI
 *   2. Muliggjøre unit-testing via Vitest
 *   3. Tillate gjenbruk i fase-komponenter (ConceptPhase, LoglinePhase, ThemePhase)
 *
 * Hver validator returnerer en ValidationResult med score (0-100), warnings
 * (vekt etter pointsLost), suggestions, coaching-tips, og en nextBestAction
 * basert på det warningen med høyest pointsLost.
 *
 * Industri-validators (Save the Cat, Hero's Journey, 3-akts) ligger i
 * ./validators/ — disse er complement to the canonical concept/logline/theme
 * validators som lever her.
 */

import type {
  ConceptData,
  LoglineData,
  ThemeData,
  ValidationResult,
  ValidationWarning,
  CoachingTip,
} from './types';
import { getFieldLabelNb } from './constants';

/**
 * Sjekker for narrative kontradiksjoner mellom concept og theme.
 * Returnerer liste av kontradiksjon-meldinger; tom liste = ingen funnet.
 */
export function detectContradictions(concept: ConceptData, theme: ThemeData): string[] {
  const contradictions: string[] = [];
  const audience = concept.targetAudience.toLowerCase() + ' ' + concept.audienceAge.toLowerCase();
  const isChildren = audience.includes('child') || audience.includes('under 12');
  const tones = concept.tone.map((t) => t.toLowerCase());
  const genre = concept.genre.toLowerCase();

  if (isChildren && (genre === 'horror' || tones.includes('gritty') || tones.includes('dark'))) {
    contradictions.push(
      'Målgruppen "Barn" kolliderer med mørk/rå tone eller horrorsjanger — vurder målgruppe eller tone på nytt.',
    );
  }
  if (isChildren && tones.includes('cynical')) {
    contradictions.push(
      'Kynisk tone er uvanlig for innhold rettet mot barn — bevisst brudd eller mismatch?',
    );
  }
  if (concept.whyNow.length > 20 && concept.uniqueAngle.length > 10) {
    const whyGeneric =
      /relevant|important|timely/i.test(concept.whyNow) &&
      !/because|specifically|unlike/i.test(concept.whyNow);
    const angleGeneric =
      /unique|different|special|new/i.test(concept.uniqueAngle) && concept.uniqueAngle.length < 40;
    if (whyGeneric && angleGeneric) {
      contradictions.push(
        '"Hvorfor nå" og "Unik vinkel" er begge for generiske — gjør minst én av dem mer konkret.',
      );
    }
  }
  if (theme.themeStatement.length > 20 && theme.moralArgument.length > 20) {
    const themeWords = new Set(theme.themeStatement.toLowerCase().split(/\s+/));
    const moralWords = new Set(theme.moralArgument.toLowerCase().split(/\s+/));
    const overlap = [...themeWords].filter((w) => moralWords.has(w) && w.length > 4).length;
    if (overlap < 2) {
      contradictions.push(
        'Temapåstand og moralsk argument virker frakoblet — de bør forsterke hverandre.',
      );
    }
  }
  return contradictions;
}

export function validateConcept(concept: ConceptData): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];
  const coaching: CoachingTip[] = [];
  let score = 0;
  const maxScore = 9;

  // Core premise — signal check: look for character + conflict indicators
  if (concept.corePremise.length > 20) {
    score += 1;
    const hasCharacter = /\b(a|an|the)\s+\w+/i.test(concept.corePremise);
    const hasConflict = /\b(must|forces?|against|between|struggle|threat|discover|secrets?|hidden)\b/i.test(concept.corePremise);
    if (concept.corePremise.length < 50 || (!hasCharacter && !hasConflict)) {
      suggestions.push('Utvid kjernepremisset så det inkluderer en karakter og en tydelig hovedkonflikt.');
    }
  } else {
    warnings.push({ message: 'Kjernepremisset er for kort eller mangler.', fieldId: 'corePremise', impact: 'Uten premiss har du ingen historie å utvikle.', pointsLost: 1 });
  }

  if (concept.genre) {
    score += 1;
  } else {
    warnings.push({ message: 'Velg en hovedsjanger.', fieldId: 'genre', impact: 'Sjanger styrer publikumsforventning og markedsposisjonering.', pointsLost: 1 });
  }

  if (concept.tone.length > 0) {
    score += 1;
    if (concept.tone.length > 3) {
      suggestions.push('Vurder å snevre inn tonevalget til 2-3 for en mer fokusert historie.');
    }
  } else {
    warnings.push({ message: 'Velg minst én tone for historien.', fieldId: 'tone', impact: 'Tone styrer alle kreative valg: dialog, visuelt uttrykk og tempo.', pointsLost: 1 });
  }

  if (concept.targetAudience.length > 10) {
    score += 1;
    const isGeneric = /everyone|all people|general audience/i.test(concept.targetAudience);
    if (isGeneric) suggestions.push('"Alle" er ikke en målgruppe. Vær konkret: hvem kommer til å heie frem denne historien?');
  } else {
    warnings.push({ message: 'Definer målgruppen mer presist.', fieldId: 'targetAudience', impact: 'Utydelig målgruppe gir ufokusert markedsføring og lav effekt.', pointsLost: 1 });
  }

  if (concept.whyNow.length > 20) {
    score += 2;
    const hasConcreteRef = /\b(20\d{2}|pandemic|AI|climate|social media|movement|generation|trend|technology|law|election)\b/i.test(concept.whyNow);
    if (concept.whyNow.length < 50 || !hasConcreteRef) {
      suggestions.push('"Hvorfor nå" bør vise til konkrete kulturelle øyeblikk, trender eller hendelser.');
    }
  } else {
    warnings.push({ message: '"Hvorfor denne historien nå?" trenger mer presisjon.', fieldId: 'whyNow', impact: 'Uten tidsrelevans spør beslutningstakere: "hvorfor skal jeg bry meg?"', pointsLost: 2 });
    coaching.push({ example: 'Klimaangst + Gen Z-aktivisme gir økothriller høy relevans.', template: 'På grunn av [AKTUELL HENDELSE/TREND] er publikum ekstra åpne for historier om [DITT TEMA].', avoid: 'Unngå "det har alltid vært relevant" — det svarer ikke på spørsmålet.' });
  }

  if (concept.uniqueAngle.length > 20) {
    score += 2;
    const isGenericAngle = /^(it'?s )?(?:unique|different|special|new|fresh|original)\b/i.test(concept.uniqueAngle.trim());
    if (isGenericAngle) {
      suggestions.push('Unik vinkel starter for generisk. Vis HVORDAN den er annerledes, ikke bare si at den er det.');
    }
  } else {
    warnings.push({ message: 'Hva gjør DIN versjon unik? Dette er avgjørende.', fieldId: 'uniqueAngle', impact: 'Uten en tydelig differensiator drukner historien blant lignende prosjekter.', pointsLost: 2 });
    coaching.push({ example: 'I motsetning til klassiske kuppfilmer består teamet av pensjonister uten noe å tape.', template: 'I motsetning til [KONVENSJONELL TILNÆRMING] gjør denne historien [SPESIFIKK FORSKJELL], som skaper [UNIKT RESULTAT].', avoid: 'Unngå "det er en unik take" — det sier ingenting konkret.' });
  }

  if (concept.marketComparables.length > 10) {
    score += 1;
    const hasPattern = /\b(meets?|cross|like|but|with|plus|×|x)\b/i.test(concept.marketComparables);
    if (!hasPattern) suggestions.push('Bruk "X møter Y"-formelen for sammenligninger (f.eks. "Inception møter The Office").');
  } else {
    warnings.push({ message: 'Legg til markedssammenligninger for å posisjonere historien.', fieldId: 'marketComparables', impact: 'Sammenligninger hjelper produsenter å forstå pitchen umiddelbart.', pointsLost: 1 });
  }

  const pct = Math.round((score / maxScore) * 100);
  const isValid = score >= 6;
  const affirmations: string[] = [];
  if (isValid) {
    if (concept.marketComparables.length > 10) affirmations.push('Sammenligninger posisjonerer historien godt i markedet.');
    if (concept.whyNow.length >= 50) affirmations.push('"Hvorfor nå" er tydelig formulert med sterk relevansvinkel.');
    if (concept.uniqueAngle.length >= 50) affirmations.push('Den unike vinkelen er tydelig definert og skiller seg godt ut.');
  }

  const sorted = [...warnings].sort((a, b) => b.pointsLost - a.pointsLost);
  const nextBestAction = sorted.length > 0 ? `Forsterk: ${getFieldLabelNb(sorted[0].fieldId)}` : null;

  return { isValid, score: pct, warnings, suggestions, affirmations, coaching, contradictions: [], nextBestAction };
}

export function validateLogline(logline: LoglineData): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];
  const coaching: CoachingTip[] = [];
  let score = 0;
  const maxScore = 6;

  if (logline.protagonist.length > 5) {
    score += 1;
  } else {
    warnings.push({ message: 'Definer protagonisten.', fieldId: 'protagonist', impact: 'Ingen protagonist betyr ingen å heie på.', pointsLost: 1 });
  }

  if (logline.goal.length > 10) {
    score += 1;
    const hasActionVerb = /\b(stop|save|escape|expose|find|destroy|protect|prevent|recover|solve|uncover|survive|win|defeat|rescue|build|prove|convince)\b/i.test(logline.goal);
    if (!hasActionVerb) suggestions.push('Målet bør starte med et handlingsverb (stoppe, redde, rømme, avsløre, beskytte …).');
  } else {
    warnings.push({ message: 'Hva vil protagonisten oppnå?', fieldId: 'goal', impact: 'Uten et tydelig mål mangler historien fremdriftsmotor.', pointsLost: 1 });
    coaching.push({ example: '"må avsløre korrupsjonen før valget"', template: 'må [HANDLINGSVERB] [KONKRET MÅL] før [DEADLINE]', avoid: 'Unngå vage mål som "finne seg selv" eller "finne ut av ting".' });
  }

  if (logline.antagonisticForce.length > 5) {
    score += 1;
  } else {
    warnings.push({ message: 'Definer den antagonistiske kraften.', fieldId: 'antagonisticForce', impact: 'Ingen motstand gir ingen spenning.', pointsLost: 1 });
  }

  if (logline.stakes.length > 10) {
    score += 1.5;
    const hasConcrete = /\b(die|death|lose|destroy|war|prison|homeless|alone|fired|betray|forgotten|extinct|collapse)\b/i.test(logline.stakes);
    if (!hasConcrete) suggestions.push('Konsekvensene oppleves abstrakte. Navngi konkret tap: liv, kjærlighet, frihet eller identitet.');
  } else {
    warnings.push({ message: 'Hva skjer hvis protagonisten feiler?', fieldId: 'stakes', impact: 'Uten stakes kollapser spenningsmotoren.', pointsLost: 1.5 });
    coaching.push({ example: '"ellers blir hele landsbyen utslettet"', template: 'ellers vil [KONKRET PERSON/OBJEKT] [IRREVERSIBEL KONSEKVENS]', avoid: 'Unngå "det skjer noe dårlig" — navngi konsekvensen.' });
  }

  if (logline.fullLogline.length > 30) {
    score += 1.5;
    const hasWhen = /when|after|before/i.test(logline.fullLogline);
    const hasMust = /must|needs to|has to|tries to/i.test(logline.fullLogline);
    const hasOr = /or else|otherwise|before|unless/i.test(logline.fullLogline);
    if (!hasWhen) suggestions.push('Start med "Når …" for å etablere utløsende hendelse.');
    if (!hasMust) suggestions.push('Inkluder hva protagonisten "må" gjøre.');
    if (!hasOr) suggestions.push('Legg inn stakes: "ellers …" / "før …" for å øke spenningen.');
  } else {
    warnings.push({ message: 'Skriv komplett logline (25-50 ord).', fieldId: 'fullLogline', impact: 'Loglinen ER pitchen din. Uten logline blir det ingen greenlight.', pointsLost: 1.5 });
  }

  const pct = Math.round((score / maxScore) * 100);
  const isValid = score >= 4.5;
  const affirmations: string[] = [];
  if (isValid && logline.fullLogline.length > 30) {
    const allBeats =
      /when|after|before/i.test(logline.fullLogline) &&
      /must|needs to|has to|tries to/i.test(logline.fullLogline) &&
      /or else|otherwise|before|unless/i.test(logline.fullLogline);
    if (allBeats) affirmations.push('Loglinen treffer alle strukturelle beats og gir et sterkt grunnlag.');
  }

  const sorted = [...warnings].sort((a, b) => b.pointsLost - a.pointsLost);
  const nextBestAction = sorted.length > 0 ? `Legg til: ${getFieldLabelNb(sorted[0].fieldId)}` : null;

  return { isValid, score: pct, warnings, suggestions, affirmations, coaching, contradictions: [], nextBestAction };
}

export function validateTheme(theme: ThemeData): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];
  const coaching: CoachingTip[] = [];
  let score = 0;
  const maxScore = 8;

  if (theme.centralTheme.length > 5) {
    score += 1;
  } else {
    warnings.push({ message: 'Definer sentralt tema.', fieldId: 'centralTheme', impact: 'Tema er historiens sjel — uten det føles scener tilfeldige.', pointsLost: 1 });
  }

  if (theme.themeStatement.length > 20) {
    score += 1.5;
    if (!theme.themeStatement.includes('...') && !/argues? that/i.test(theme.themeStatement)) {
      suggestions.push('Formuler som: "Denne historien argumenterer for at …" for å gjøre den aktiv og diskuterbar.');
    }
  } else {
    warnings.push({ message: 'Skriv en temapåstand.', fieldId: 'themeStatement', impact: 'Uten en tydelig tese mangler historien argument.', pointsLost: 1.5 });
    coaching.push({ example: 'Denne historien argumenterer for at ekte mot er å vise sårbarhet, ikke skjule den.', template: 'Denne historien argumenterer for at [TRO] er/krever [INNSIKT], ikke [VANLIG ANTAGELSE].', avoid: 'Unngå klisjeer som "kjærlighet overvinner alt" — gjør påstanden diskuterbar.' });
  }

  if (theme.protagonistFlaw.length > 10) {
    score += 1.5;
  } else {
    warnings.push({ message: 'Definer protagonistens kjernefeil.', fieldId: 'protagonistFlaw', impact: 'Ingen feil gir ingen vekst og en flat karakter.', pointsLost: 1.5 });
  }

  if (theme.whatMustChange.length > 15) {
    score += 1.5;
  } else {
    warnings.push({ message: 'Presiser hva som må endres.', fieldId: 'whatMustChange', impact: 'Transformasjon er utbetalingen — publikum må se skiftet.', pointsLost: 1.5 });
    coaching.push({ example: 'Hun må slutte å skylde på andre og ta ansvar for egne valg.', template: 'Protagonisten må forlate [GAMMEL TRO] og omfavne [NY SANNHET].', avoid: 'Unngå "de må vokse" — spesifiser HVA som endres.' });
  }

  if (theme.transformationArc.length > 20) {
    score += 1.5;
    const hasProgression = /→|to|from|becomes|evolves|realizes|learns/i.test(theme.transformationArc);
    if (!hasProgression) suggestions.push('Vis buen som "Fra [X] → til [Y]" for å gjøre transformasjonen konkret.');
  } else {
    warnings.push({ message: 'Beskriv transformasjonsbuen.', fieldId: 'transformationArc', impact: 'Uten en tydelig bue føles slutten ufortjent.', pointsLost: 1.5 });
  }

  if (theme.emotionalJourney.length >= 3) {
    score += 1;
  } else {
    suggestions.push('Kartlegg minst 3-5 sentrale emosjonelle beats i historien.');
  }

  const pct = Math.round((score / maxScore) * 100);
  const isValid = score >= 6;
  const affirmations: string[] = [];
  if (isValid) {
    if (theme.transformationArc.length > 50) affirmations.push('Transformasjonsbuen er detaljert og karakterreisen tydelig.');
    if (theme.emotionalJourney.length >= 4) affirmations.push('Den emosjonelle reisen er godt kartlagt og gir dyp resonans.');
  }

  const sorted = [...warnings].sort((a, b) => b.pointsLost - a.pointsLost);
  const nextBestAction = sorted.length > 0 ? `Avklar: ${getFieldLabelNb(sorted[0].fieldId)}` : null;

  return { isValid, score: pct, warnings, suggestions, affirmations, coaching, contradictions: [], nextBestAction };
}
