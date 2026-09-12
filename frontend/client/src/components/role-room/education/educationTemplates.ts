/**
 * educationTemplates.ts — kuraterte maler for «Opprett fra mal».
 *
 * Bevisst konstanter (som SUGGESTED_RESOURCES) — ingen backend/migrasjon. En
 * produksjonsmal oppretter en produksjon + såer et sett startoppgaver; en
 * oppgavemal forhåndsutfyller opprett-oppgave-skjemaet. Alt gjenbruker de
 * eksisterende createProduction/createAssignment-endepunktene.
 */

export interface TemplateAssignment {
  title: string;
  brief: string;
  learningGoals: string;
  dueInDays: number;
}

export interface ProductionTemplate {
  id: string;
  name: string;
  description: string;
  assignments: TemplateAssignment[];
}

export interface AssignmentTemplate {
  id: string;
  name: string;
  description: string;
  brief: string;
  learningGoals: string;
}

/** Produksjonsmaler — hver såer et helt oppgaveløp langs produksjonsflyten. */
export const PRODUCTION_TEMPLATES: ProductionTemplate[] = [
  {
    id: 'kortfilm',
    name: 'Kortfilm (3 min)',
    description: 'Fiksjonskortfilm fra idé til ferdig leveranse — dekker manus, plan, opptak og klipp.',
    assignments: [
      { title: 'Logline & synopsis', brief: 'Kok konseptet ned til én setning + en kort synopsis.', learningGoals: 'Idéutvikling\nDramaturgi', dueInDays: 3 },
      { title: 'Storyboard', brief: 'Tegn nøkkelbildene scene for scene.', learningGoals: 'Visuell fortelling\nBildeutsnitt', dueInDays: 7 },
      { title: 'Opptaksplan & call sheet', brief: 'Scener, lokasjoner, dager og team — lag call sheet i Role Room.', learningGoals: 'Produksjonsledelse', dueInDays: 10 },
      { title: 'Grovklipp', brief: 'Sett sammen første klipp av materialet.', learningGoals: 'Klipp\nRytme', dueInDays: 21 },
      { title: 'Ferdig leveranse', brief: 'Fargekorriger, lyd og eksport i riktig format.', learningGoals: 'Etterarbeid\nLeveranseformater', dueInDays: 28 },
    ],
  },
  {
    id: 'dokumentar',
    name: 'Dokumentar',
    description: 'Kort dokumentar — research, intervju og klipp med journalistisk vinkling.',
    assignments: [
      { title: 'Research & vinkling', brief: 'Kartlegg tema, kilder og en tydelig vinkling.', learningGoals: 'Research\nKildekritikk', dueInDays: 4 },
      { title: 'Intervjuguide', brief: 'Forbered spørsmål og struktur for intervjuene.', learningGoals: 'Intervjuteknikk', dueInDays: 7 },
      { title: 'Opptak', brief: 'Gjennomfør intervju- og b-roll-opptak.', learningGoals: 'Lyd\nBilde', dueInDays: 14 },
      { title: 'Klipp & leveranse', brief: 'Bygg fortellingen i klippen og lever.', learningGoals: 'Fortellende klipp', dueInDays: 24 },
    ],
  },
  {
    id: 'kampanje',
    name: 'Reklame / kampanjefilm',
    description: 'Kort kampanjefilm for en oppdragsgiver — brief, konsept og leveranse.',
    assignments: [
      { title: 'Brief & konsept', brief: 'Tolk oppdraget og utvikle et konsept med tydelig budskap.', learningGoals: 'Konseptutvikling\nMålgruppe', dueInDays: 3 },
      { title: 'Moodboard & manus', brief: 'Visuell retning + kort manus/dreiebok.', learningGoals: 'Visuell identitet', dueInDays: 7 },
      { title: 'Opptak', brief: 'Gjennomfør opptak etter planen.', learningGoals: 'Produksjon', dueInDays: 14 },
      { title: 'Leveranse & formater', brief: 'Eksporter i formatene kanalene krever.', learningGoals: 'Distribusjon\nFormater', dueInDays: 21 },
    ],
  },
  {
    id: 'musikkvideo',
    name: 'Musikkvideo',
    description: 'Musikkvideo — konsept, storyboard og rytmisk klipp til musikk.',
    assignments: [
      { title: 'Konsept', brief: 'Knytt et visuelt konsept til låten.', learningGoals: 'Idéutvikling', dueInDays: 3 },
      { title: 'Storyboard', brief: 'Planlegg bildene mot musikkens struktur.', learningGoals: 'Visuell fortelling', dueInDays: 7 },
      { title: 'Opptak', brief: 'Film performance og konseptbilder.', learningGoals: 'Kamera\nLys', dueInDays: 14 },
      { title: 'Klipp til musikk', brief: 'Klipp rytmisk mot beat og lever.', learningGoals: 'Musikkklipp', dueInDays: 21 },
    ],
  },
];

/** Oppgavemaler — forhåndsutfyller opprett-oppgave-skjemaet. */
export const ASSIGNMENT_TEMPLATES: AssignmentTemplate[] = [
  { id: 'caseanalyse', name: 'Caseanalyse', description: 'Analyser en case og begrunn valg.', brief: 'Analyser den gitte casen: identifiser problem, vurder alternativer og begrunn din anbefaling.', learningGoals: 'Analyse\nBegrunnelse' },
  { id: 'refleksjon', name: 'Refleksjonsnotat', description: 'Reflekter over egen læring etter en økt.', brief: 'Skriv et kort refleksjonsnotat: hva lærte du, hva var utfordrende, hva tar du med videre?', learningGoals: 'Refleksjon\nSelvvurdering' },
  { id: 'pitch', name: 'Pitch', description: 'Pitch en idé på 2 minutter.', brief: 'Forbered og lever en 2-minutters pitch av idéen din — hook, kjerne og hvorfor.', learningGoals: 'Muntlig formidling\nIdéutvikling' },
  { id: 'storyboard', name: 'Storyboard-øvelse', description: 'Tegn et storyboard for en scene.', brief: 'Lag et storyboard for en valgt scene: bildeutsnitt, bevegelse og kontinuitet.', learningGoals: 'Visuell fortelling\nBildeutsnitt' },
];
