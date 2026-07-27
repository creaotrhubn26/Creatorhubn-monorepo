/**
 * educationStudyPlanPacks.ts — program-mal-pakker forankret i norske studieplaner.
 *
 * Hver pakke er et sett EMNER (studiepoeng + K/F/GK-læringsutbytte + vurderingsform)
 * med tilhørende OPPGAVER/ARBEIDSKRAV — modellert etter strukturen i norske
 * film/scenekunst-studieplaner (arbeidskrav må godkjennes for endelig karakter;
 * obligatorisk oppmøte; praktiske demonstrasjoner; refleksjon; mappevurdering).
 *
 * 🔑 BEVISST GENERISKE start-strukturer faglærer redigerer — IKKE verbatim-kopier
 * av en bestemt skoles studieplan. Læringsutbyttet er formulert i NKR-kategoriene.
 */

import type { LearningOutcomes } from './educationCoursesService';

export interface PackAssignment {
  title: string;
  brief: string;
  learningGoals: string;
  isArbeidskrav: boolean;
}

export interface PackCourse {
  code?: string;
  title: string;
  credits: number;
  term: string;
  vurderingsform: string; // 'bestatt' | 'bokstav' | 'mappe'
  learningOutcomes: LearningOutcomes;
  assignments: PackAssignment[];
}

export interface StudyPlanPack {
  id: string;
  program: string;
  exampleInstitutions: string;
  description: string;
  courses: PackCourse[];
}

export const STUDY_PLAN_PACKS: StudyPlanPack[] = [
  {
    id: 'skuespill_ar1',
    program: 'Skuespillerfag — år 1',
    exampleInstitutions: 'jf. KHiO Teaterhøgskolen / Nord universitet',
    description: 'Grunnleggende skuespillerteknikk, sceneteknikk/stemme og skuespill for kamera. Praktiske demonstrasjoner + refleksjon; arbeidskrav må godkjennes.',
    courses: [
      {
        code: 'SKU101', title: 'Skuespillerteknikk 1', credits: 30, term: 'Høst', vurderingsform: 'mappe',
        learningOutcomes: {
          knowledge: ['Kjenner sentrale skuespillermetoder og deres historiske bakgrunn', 'Forstår samspillet mellom tekst, kropp og impuls'],
          skills: ['Kan bruke dramatisk tekst som utgangspunkt for eget skapende arbeid', 'Kan anvende grunnleggende skuespillerteknikk i sceniske situasjoner'],
          generalCompetence: ['Kan samarbeide i ensemble og gi/motta tilbakemelding', 'Kan reflektere over egen kunstnerisk utvikling'],
        },
        assignments: [
          { title: 'Oppmøte og aktiv deltakelse', brief: 'Obligatorisk oppmøte (min. 80 %) og aktiv deltakelse i undervisning og øvelser.', learningGoals: 'Generell kompetanse: ensemble, tilstedeværelse', isArbeidskrav: true },
          { title: 'Praktisk demonstrasjon — monolog', brief: 'Fremfør en bearbeidet monolog for intern gruppe med påfølgende veiledning.', learningGoals: 'Ferdigheter: tekstarbeid, scenisk nærvær', isArbeidskrav: true },
          { title: 'Refleksjonsnotat', brief: 'Skriv et refleksjonsnotat om egen utvikling gjennom semesteret.', learningGoals: 'Generell kompetanse: selvrefleksjon', isArbeidskrav: true },
        ],
      },
      {
        code: 'SKU110', title: 'Sceneteknikk og stemme', credits: 15, term: 'Høst', vurderingsform: 'bestatt',
        learningOutcomes: {
          knowledge: ['Forstår stemmens og kroppens virkemåte i scenisk arbeid'],
          skills: ['Kan bruke pust, stemme og bevegelse bevisst på scenen'],
          generalCompetence: ['Kan ivareta egen helse og stemmebruk i praktisk arbeid'],
        },
        assignments: [
          { title: 'Deltakelse i stemme- og bevegelsestrening', brief: 'Obligatorisk deltakelse i ukentlig trening.', learningGoals: 'Ferdigheter: stemme, bevegelse', isArbeidskrav: true },
        ],
      },
      {
        code: 'SKU120', title: 'Skuespill for kamera', credits: 15, term: 'Vår', vurderingsform: 'mappe',
        learningOutcomes: {
          knowledge: ['Forstår forskjellen mellom scenisk og filmatisk spill', 'Kjenner filmens produksjonsprosess på et grunnleggende nivå'],
          skills: ['Kan tilpasse spill til kamera og filmatisk kontekst'],
          generalCompetence: ['Kan samarbeide med et filmteam under opptak'],
        },
        assignments: [
          { title: 'Kamera-scene (praktisk produksjon)', brief: 'Delta i en kort kamera-scene og lever bearbeidet materiale.', learningGoals: 'Ferdigheter: spill for kamera', isArbeidskrav: true },
          { title: 'Selvvalgt selvtape', brief: 'Spill inn og lever en selvtape av en valgt scene.', learningGoals: 'Ferdigheter: selvstendig kamera-arbeid', isArbeidskrav: false },
        ],
      },
    ],
  },
  {
    id: 'filmtv_ar1',
    program: 'Film & TV-produksjon — år 1',
    exampleInstitutions: 'jf. Høyskolen Kristiania / Den norske filmskolen',
    description: 'Filmfortelling, praktisk kortfilmproduksjon og produksjonsledelse. Prosessorientert mappevurdering; arbeidskrav knyttet til de praktiske produksjonene.',
    courses: [
      {
        code: 'FTV101', title: 'Filmfortelling og dramaturgi', credits: 15, term: 'Høst', vurderingsform: 'bokstav',
        learningOutcomes: {
          knowledge: ['Kjenner grunnleggende dramaturgiske modeller og fortellergrep', 'Forstår forholdet mellom idé, manus og visuell fortelling'],
          skills: ['Kan utvikle en idé til en strukturert historie', 'Kan bygge en story-arc for en kort film'],
          generalCompetence: ['Kan begrunne kreative valg faglig'],
        },
        assignments: [
          { title: 'Logline og synopsis', brief: 'Lever logline + kort synopsis for eget prosjekt.', learningGoals: 'Ferdigheter: idéutvikling, dramaturgi', isArbeidskrav: true },
          { title: 'Story arc (i produksjonen)', brief: 'Bygg en story-arc i Story Arc Studio for kortfilmen.', learningGoals: 'Ferdigheter: struktur, vendepunkter', isArbeidskrav: true },
        ],
      },
      {
        code: 'FTV110', title: 'Produksjon 1: Kortfilm', credits: 30, term: 'Høst/Vår', vurderingsform: 'mappe',
        learningOutcomes: {
          knowledge: ['Forstår filmens produksjonsflyt fra pre- til postproduksjon', 'Kjenner rollene på et filmsett'],
          skills: ['Kan planlegge og gjennomføre et opptak i team', 'Kan bidra til klipp og ferdigstilling'],
          generalCompetence: ['Kan samarbeide og ta ansvar i en produksjon', 'Kan overholde frister og leveransekrav'],
        },
        assignments: [
          { title: 'Storyboard', brief: 'Lever storyboard for nøkkelscenene.', learningGoals: 'Ferdigheter: visuell planlegging', isArbeidskrav: true },
          { title: 'Opptaksplan og call sheet', brief: 'Lag opptaksplan + call sheet i Role Room.', learningGoals: 'Ferdigheter: produksjonsledelse', isArbeidskrav: true },
          { title: 'Deltakelse på opptak', brief: 'Obligatorisk deltakelse på teamets opptaksdager.', learningGoals: 'Generell kompetanse: samarbeid, ansvar', isArbeidskrav: true },
          { title: 'Ferdig leveranse', brief: 'Lever ferdig kortfilm i riktig format.', learningGoals: 'Ferdigheter: etterarbeid, leveranse', isArbeidskrav: false },
        ],
      },
      {
        code: 'FTV120', title: 'Produksjonsledelse', credits: 15, term: 'Vår', vurderingsform: 'bestatt',
        learningOutcomes: {
          knowledge: ['Forstår budsjett, plan og logistikk i en produksjon'],
          skills: ['Kan sette opp en realistisk produksjonsplan'],
          generalCompetence: ['Kan koordinere team og ressurser'],
        },
        assignments: [
          { title: 'Produksjonsplan', brief: 'Lever en fullstendig produksjonsplan for en gitt case.', learningGoals: 'Ferdigheter: planlegging, logistikk', isArbeidskrav: true },
        ],
      },
    ],
  },
];
