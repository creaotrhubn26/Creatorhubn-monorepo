/**
 * StoryLogic demo states — TROLL, default (tom), og Content Producer-demoen.
 *
 * Disse er pure-data initial-states som brukes for å:
 *   - TROLL_DEMO_STATE: fylle ut Story Logic-feltene i TROLL-demoprosjektet
 *     (referert via TROLL_DEMO_PROJECT_ID)
 *   - DEFAULT_STATE: starte-state for nye prosjekter (alle felter tomme)
 *   - CONTENT_PRODUCER_DEMO_STATE: fylle ut Content Producer-demoprosjektet
 *     (referert via CONTENT_PRODUCER_DEMO_PROJECT_ID)
 *
 * Ekstraktert fra StoryLogicPanel.tsx for å redusere panel-størrelsen.
 *
 * Merknad: TROLL og Content Producer demo-states har `lastSaved: new Date().
 * toISOString()` — dette er load-time-stempelet, ikke run-time. Samme oppførsel
 * som før ekstraktet (toppnivå-eksprimering).
 */

import type { StoryLogicState } from './types';
import { PRODUCER_DEMO_CLIENT_COMPANY } from '../../../constants/producerDemo';

export const TROLL_DEMO_STATE: StoryLogicState = {
  concept: {
    corePremise:
      'Et urgammelt troll våkner i moderne Norge og tvinger en paleontolog til å bygge bro mellom myte og virkelighet før militæret utsletter den siste resten av norrøn legende.',
    genre: 'Fantasy',
    subGenre: 'Mythological',
    tone: ['Intense', 'Suspenseful', 'Nostalgic'],
    targetAudience: 'Familier og fantasy-entusiaster som elsker nordisk mytologi',
    audienceAge: 'Teen (13-17)',
    whyNow:
      'Økt interesse for skandinavisk mytologi (Vikings, God of War), klimaangst som vekker sovende trusler, og et universelt tema om menneskets forhold til naturen og glemte tradisjoner.',
    uniqueAngle:
      'I motsetning til typiske monsterfilmer der skapningen bare er fienden, er trollet et sympatisk vesen som søker hjemmet sitt. Konflikten handler derfor om bevaring kontra ødeleggelse av kulturarv.',
    marketComparables:
      'Godzilla (2014) møter The Water Horse, med tematiske likheter til Princess Mononoke. Norsk kaiju med hjerte.',
  },
  logline: {
    protagonist: 'Nora Tidemann',
    protagonistTrait: 'briljant, men skeptisk',
    goal: 'må beskytte og lede det urgamle trollet tilbake til Dovre',
    antagonisticForce:
      'et militær som er fast bestemt på å ødelegge det, samt hennes egen vantro til folketro',
    stakes: 'miste den siste levende forbindelsen til Norges mytologiske fortid for alltid',
    fullLogline:
      'Når den briljante, men skeptiske paleontologen Nora Tidemann må beskytte og lede det urgamle trollet tilbake til Dovre, møter hun et militær som vil ødelegge det og sin egen vantro til folketro — ellers mister hun den siste levende forbindelsen til Norges mytologiske fortid for alltid.',
    loglineScore: 85,
  },
  theme: {
    centralTheme: 'Gjenforbindelse med kulturarv og troens kraft',
    themeStatement: 'Først når vi omfavner visdommen fra våre forfedre, kan vi finne veien hjem.',
    protagonistFlaw:
      'Rasjonell skepsis som gjør henne blind for undring, og et brutt forhold til faren som trodde på folketro',
    flawOrigin:
      'Nora avviste farens historier om troll som barn og valgte vitenskap over tradisjon, noe som skapte år med avstand mellom dem.',
    whatMustChange:
      'Hun må forene vitenskapelig rasjonalitet med folkelig visdom, og reparere forholdet til faren før det er for sent.',
    transformationArc:
      'Fra avvisende skeptiker som håner tradisjon → til nølende troende som er vitne til det umulige → til aktiv beskytter som bygger bro mellom fortid og nåtid',
    emotionalJourney: ['Skepticism', 'Fear', 'Wonder', 'Determination', 'Grief', 'Hope', 'Triumph'],
    moralArgument:
      'Filmen argumenterer for at fremskritt uten respekt for fortiden fører til ødeleggelse, mens omfavnelse av kulturarven gir oss visdommen til å møte fremtiden.',
  },
  currentPhase: 2,
  phaseStatus: { concept: 'ready', logline: 'ready', theme: 'ready' },
  lastSaved: new Date().toISOString(),
  locks: { concept: false, logline: false, theme: false },
  versions: [],
};

export const DEFAULT_STATE: StoryLogicState = {
  concept: {
    corePremise: '',
    genre: '',
    subGenre: '',
    tone: [],
    targetAudience: '',
    audienceAge: '',
    whyNow: '',
    uniqueAngle: '',
    marketComparables: '',
  },
  logline: {
    protagonist: '',
    protagonistTrait: '',
    goal: '',
    antagonisticForce: '',
    stakes: '',
    fullLogline: '',
    loglineScore: 0,
  },
  theme: {
    centralTheme: '',
    themeStatement: '',
    protagonistFlaw: '',
    flawOrigin: '',
    whatMustChange: '',
    transformationArc: '',
    emotionalJourney: [],
    moralArgument: '',
  },
  currentPhase: 0,
  phaseStatus: { concept: 'incomplete', logline: 'incomplete', theme: 'incomplete' },
  lastSaved: null,
  locks: { concept: false, logline: false, theme: false },
  versions: [],
};

export const CONTENT_PRODUCER_DEMO_STATE: StoryLogicState = {
  concept: {
    corePremise: `Et produksjonsteam utvikler en filmserie for ${PRODUCER_DEMO_CLIENT_COMPANY} og må gjøre kompliserte HMS-rutiner konkrete, menneskelige og godkjennbare uten å miste tempoet i leveransen.`,
    genre: 'Corporate',
    subGenre: 'Industrial Training Drama',
    tone: ['Confident', 'Grounded', 'Professional'],
    targetAudience:
      'Nye teknikere, skiftledere og HR-/HMS-ansvarlige som trenger tydelig opplæring med høy troverdighet.',
    audienceAge: 'Adult (25-44)',
    whyNow:
      'Industri- og energibedrifter må kombinere rask onboarding, sikkerhetskultur og rekruttering i samme innholdspakke.',
    uniqueAngle:
      'Prosjektet forteller en konkret første arbeidsdag og gjør prosedyrene filmatiske uten å miste faglig presisjon.',
    marketComparables:
      'Moderne onboarding-filmer, HMS-kampanjer og employer-branding med dokumentarisk troverdighet.',
  },
  logline: {
    protagonist: 'En ny tekniker',
    protagonistTrait: 'fokusert, men uerfaren offshore-ansatt',
    goal: 'må forstå sikker oppstart, kommunikasjon og avvikshåndtering før første skift',
    antagonisticForce:
      'tidspress, ukjente rutiner og et miljø der små feil kan få store konsekvenser',
    stakes:
      'skape utrygghet i teamet, bryte kritiske rutiner og miste tillit på første arbeidsdag',
    fullLogline:
      'Når en fokusert, men uerfaren tekniker skal gjennom sin første oppstart hos Northwind Drilling, må hun mestre sikker oppstart, kommunikasjon og avvikshåndtering før første skift, mens tidspress, ukjente rutiner og et risikofylt miljø truer med å gjøre små feil kostbare.',
    loglineScore: 86,
  },
  theme: {
    centralTheme: 'Tydelige rutiner skaper trygg handling',
    themeStatement:
      'Når komplekse prosedyrer oversettes til konkrete valg, blir sikkerhetskultur noe folk faktisk kan leve ut i arbeidshverdagen.',
    protagonistFlaw: 'Hun tror fart er viktigere enn å stoppe opp og dobbeltsjekke.',
    flawOrigin:
      'Tidligere har hun blitt premiert for rask levering og antar at samme logikk gjelder i et høy-risiko-miljø.',
    whatMustChange:
      'Hun må forstå at profesjonell trygghet handler om presisjon, kommunikasjon og å be om bekreftelse i tide.',
    transformationArc:
      'Fra å ville bevise at hun er rask nok → til å forstå at hun blir verdifull når hun arbeider sikkert og tydelig sammen med andre.',
    emotionalJourney: ['Anticipation', 'Pressure', 'Uncertainty', 'Clarity', 'Trust', 'Readiness'],
    moralArgument:
      'God opplæring handler ikke om å informere mest mulig, men om å gjøre riktige valg enkle å forstå og huske.',
  },
  currentPhase: 2,
  phaseStatus: { concept: 'ready', logline: 'ready', theme: 'ready' },
  lastSaved: new Date().toISOString(),
  locks: { concept: false, logline: false, theme: false },
  versions: [],
};
