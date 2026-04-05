import settingsService, { getCurrentUserId } from './settingsService';
export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  panel: number;
  targetSelector?: string;
  action?: 'click' | 'hover' | 'scroll' | 'drag' | 'type';
  actionDescription?: string;
  tips?: string[];
  duration?: number;
}

export interface Tutorial {
  id: string;
  name: string;
  description: string;
  category: 'casting-planner' | 'studio' | 'academy' | 'general';
  steps: TutorialStep[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

const STORAGE_KEY = 'role-room-tutorials';
const LEGACY_STORAGE_KEY = 'virtual-studio-tutorials';

const cloneTutorialStep = (step: TutorialStep): TutorialStep => ({
  ...step,
  tips: step.tips ? [...step.tips] : undefined,
});

const DEFAULT_CASTING_PLANNER_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Velkommen til The Role Room',
    description: 'Denne veiledningen viser dagens arbeidsflyt for produksjonsteam i The Role Room, fra oversikt og studio til casting, planlegging og live set.',
    panel: -1,
    duration: 8000,
    tips: [
      'Du kan pause veiledningen når som helst',
      'Klikk på stegene i fremdriftslinjen for å hoppe direkte',
      'Trykk ESC for å lukke veiledningen',
    ],
  },
  {
    id: 'overview',
    title: '1. Oversikt - få status på prosjektet',
    description: 'Oversikt samler prosjektstatus, neste steg og nøkkeltall på ett sted, slik at du raskt ser hva som må følges opp.',
    panel: 0,
    targetSelector: '#tab-oversikt',
    action: 'click',
    actionDescription: 'Åpne "Oversikt" for å se prosjektets nåsituasjon',
    tips: [
      'Bruk oversikten for å sjekke fremdrift før du går videre i flyten',
      'Her ser du snarveier til de viktigste arbeidsflatene',
      'Varsler og avvik bør normalt håndteres herfra først',
    ],
    duration: 9000,
  },
  {
    id: 'studio',
    title: '2. Role Room Studio - bygg den kreative planen',
    description: 'Role Room Studio samler idéarbeid, manusnære notater, shot-planlegging og øvrig kreativ struktur før produksjonen låses.',
    panel: 1,
    targetSelector: '#tab-story-arc-studio',
    action: 'click',
    actionDescription: 'Åpne "Role Room Studio" for å jobbe med grunnlaget for produksjonen',
    tips: [
      'Start her når du skal forme konsept, struktur og visuell retning',
      'Studio brukes før resten av teamet trenger en mer detaljert gjennomføringsplan',
      'Dette er riktig sted å samle kreative beslutninger tidlig',
    ],
    duration: 9500,
  },
  {
    id: 'roles',
    title: '3. Roller - definer hvem du caster til',
    description: 'I Roller setter du opp karakterer, funksjoner og krav, slik at casting og utvelgelse får en tydelig struktur.',
    panel: 2,
    targetSelector: '#tab-roller',
    action: 'click',
    actionDescription: 'Åpne "Roller" for å definere hvem produksjonen trenger',
    tips: [
      'Legg inn beskrivelse, alder, ferdigheter og prioritet per rolle',
      'Tydelige rollebeskrivelser gir bedre kandidatsøk og vurdering',
      'Hold hovedroller og biroller tydelig adskilt',
    ],
    duration: 9000,
  },
  {
    id: 'candidates',
    title: '4. Kandidater - samle og vurder riktige personer',
    description: 'Kandidater gir deg oversikt over søkere, inviterte og aktuelle profiler, med status og tilknytning til roller.',
    panel: 3,
    targetSelector: '#tab-kandidater',
    action: 'click',
    actionDescription: 'Åpne "Kandidater" for å se og følge opp talentbasen',
    tips: [
      'Bruk status og filtre for å holde oversikt gjennom castingløpet',
      'Knytt kandidater til én eller flere relevante roller',
      'Profiler, notater og kontaktpunkter bør holdes oppdatert her',
    ],
    duration: 9000,
  },
  {
    id: 'auditions',
    title: '5. Auditions - planlegg møter og prøver',
    description: 'Auditions brukes til å sette opp prøver, invitere kandidater og dokumentere vurderinger underveis.',
    panel: 4,
    targetSelector: '#tab-auditions',
    action: 'click',
    actionDescription: 'Åpne "Auditions" for å koordinere prøver og vurderinger',
    tips: [
      'Sett tidspunkt, sted og hvem som deltar i hver audition',
      'Bruk notater konsekvent, så sammenligning i neste steg blir enklere',
      'Kandidater bør flyttes videre først når audition-dataen er på plass',
    ],
    duration: 9000,
  },
  {
    id: 'selection',
    title: '6. Utvelgelse - ta beslutningene samlet',
    description: 'Utvelgelse er arbeidsflaten for å sammenligne kandidater og lande hvem som faktisk går videre eller bookes.',
    panel: 5,
    targetSelector: '#tab-utvelgelse',
    action: 'click',
    actionDescription: 'Åpne "Utvelgelse" for å beslutte hvem som går videre',
    tips: [
      'Bruk denne flaten når du skal velge, ikke bare registrere kandidater',
      'Samlet oversikt gir bedre beslutninger enn spredte notater',
      'Sørg for at roller og audition-status er oppdatert først',
    ],
    duration: 9000,
  },
  {
    id: 'locations',
    title: '7. Lokasjoner - samle steder og praktisk info',
    description: 'Lokasjoner brukes til å registrere opptakssteder, adresser, kontaktpunkter og praktiske forhold som påvirker planen.',
    panel: 6,
    targetSelector: '#tab-lokasjoner',
    action: 'click',
    actionDescription: 'Åpne "Lokasjoner" for å bygge opptaksgrunnlaget',
    tips: [
      'Legg inn bilder, beskrivelser og logistikk for hver lokasjon',
      'Dokumenter kontaktpersoner og eventuelle begrensninger',
      'Knytt lokasjoner til planlagte opptaksdager så tidlig som mulig',
    ],
    duration: 9000,
  },
  {
    id: 'production-plan',
    title: '8. Kalender og produksjonsplan - bind sammen dager, scener og milepæler',
    description: 'Produksjonsplanen samler kalender, opptaksdager og avhengigheter, slik at teamet jobber ut fra én felles plan.',
    panel: 7,
    targetSelector: '#tab-produksjonsplan',
    action: 'click',
    actionDescription: 'Åpne "Kalender" for å styre tid og gjennomføring',
    tips: [
      'Bruk planen til å koble lokasjoner, personer og utstyr til riktige dager',
      'Hold milepæler og kritiske datoer oppdatert',
      'Dette er flaten teamet bruker for å forstå rekkefølge og timing',
    ],
    duration: 9500,
  },
  {
    id: 'team',
    title: '9. Team - organiser ansvar og samarbeid',
    description: 'Team-flaten gir oversikt over crew, ansvar, roller og hvem som skal gjøre hva gjennom prosjektet.',
    panel: 8,
    targetSelector: '#tab-team',
    action: 'click',
    actionDescription: 'Åpne "Team" for å organisere crew og ansvar',
    tips: [
      'Hold roller og kontaktpunkter oppdatert for alle nøkkelpersoner',
      'Bruk team-flaten når du fordeler ansvar i gjennomføringen',
      'Sjekk tilgang og involvering før prosjektet går i opptak',
    ],
    duration: 9000,
  },
  {
    id: 'equipment',
    title: '10. Utstyr - hold kontroll på det som trengs i produksjonen',
    description: 'Utstyr samler rekvisitter, teknisk utstyr og annet som må være på plass før og under opptak.',
    panel: 9,
    targetSelector: '#tab-rekvisitter',
    action: 'click',
    actionDescription: 'Åpne "Utstyr" for å se hva produksjonen er avhengig av',
    tips: [
      'Registrer hva som er klart, mangler eller må skaffes',
      'Koble utstyr til riktig dag, scene eller leveranse',
      'Bruk denne flaten for å unngå siste-liten-feil på opptaksdag',
    ],
    duration: 9000,
  },
  {
    id: 'live-set',
    title: '11. Live Set - styr opptaksdagen i sanntid',
    description: 'Live Set brukes når produksjonen faktisk ruller, med status, fremdrift og oppfølging tett på opptaket.',
    panel: 10,
    targetSelector: '#tab-live-set',
    action: 'click',
    actionDescription: 'Åpne "Live Set" for å se den operative opptaksflaten',
    tips: [
      'Bruk Live Set når du trenger en sanntidsflate for settet',
      'Dette er stedet for tett operativ koordinering under opptak',
      'Sørg for at plan, team og utstyr er oppdatert før du går hit',
    ],
    duration: 9000,
  },
  {
    id: 'complete',
    title: 'Du er klar til å jobbe videre i The Role Room',
    description: 'Nå har du sett hovedflyten for produksjonsteam. Neste steg er å opprette et nytt prosjekt eller fortsette på et eksisterende prosjekt.',
    panel: -1,
    targetSelector: '[data-tutorial-target="create-project-button"]',
    action: 'click',
    actionDescription: 'Klikk på "Nytt prosjekt" når du vil starte en ny produksjon',
    duration: 8000,
    tips: [
      'Bruk "Nytt prosjekt" når du skal starte en ny produksjon fra bunnen av',
      'Hvis prosjektet allerede finnes, fortsetter du i de relevante fanene',
      'Økonomi kan ligge som egen arbeidsflate når det er aktivert for prosjektet',
    ],
  },
];

export const getDefaultCastingPlannerTutorialSteps = (): TutorialStep[] =>
  DEFAULT_CASTING_PLANNER_TUTORIAL_STEPS.map(cloneTutorialStep);

const defaultCastingPlannerTutorial: Tutorial = {
  id: 'default-casting-planner',
  name: 'The Role Room Veiledning',
  description: 'Lær hovedflyten i The Role Room',
  category: 'casting-planner',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  steps: getDefaultCastingPlannerTutorialSteps(),
};

class TutorialService {
  private tutorials: Tutorial[] = [];

  constructor() {
    this.tutorials = [defaultCastingPlannerTutorial];
    void this.loadFromStorage();
  }

  private applyDefaultTutorialUpdates(tutorials: Tutorial[]): Tutorial[] {
    const updated = [...tutorials];
    const existingCastingTutorial = updated.find(
      (t: Tutorial) => t.id === 'default-casting-planner'
    );
    if (existingCastingTutorial) {
      existingCastingTutorial.steps = getDefaultCastingPlannerTutorialSteps();
      existingCastingTutorial.updatedAt = new Date().toISOString();
    } else {
      updated.push(defaultCastingPlannerTutorial);
    }
    return updated;
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const userId = getCurrentUserId();
      const remote = await settingsService.getSetting<Tutorial[]>(STORAGE_KEY, { userId });
      if (remote) {
        this.tutorials = this.applyDefaultTutorialUpdates(remote);
        return;
      }

      const legacy = await settingsService.getSetting<Tutorial[]>(LEGACY_STORAGE_KEY, { userId });
      if (legacy) {
        this.tutorials = this.applyDefaultTutorialUpdates(legacy);
        await settingsService.setSetting(STORAGE_KEY, this.tutorials, { userId });
        await settingsService.deleteSetting(LEGACY_STORAGE_KEY, { userId });
        return;
      }

      this.tutorials = [defaultCastingPlannerTutorial];
      await settingsService.setSetting(STORAGE_KEY, this.tutorials, { userId });
    } catch (error) {
      console.error('Failed to load tutorials from storage:', error);
      this.tutorials = [defaultCastingPlannerTutorial];
    }
  }

  private saveToStorage(): void {
    try {
      void settingsService.setSetting(STORAGE_KEY, this.tutorials, { userId: getCurrentUserId() });
    } catch (error) {
      console.error('Failed to save tutorials to storage:', error);
    }
  }

  getAllTutorials(): Tutorial[] {
    return [...this.tutorials];
  }

  getTutorialsByCategory(category: Tutorial['category']): Tutorial[] {
    return this.tutorials.filter(t => t.category === category);
  }

  getTutorialById(id: string): Tutorial | undefined {
    return this.tutorials.find(t => t.id === id);
  }

  getActiveTutorialByCategory(category: Tutorial['category']): Tutorial | undefined {
    return this.tutorials.find(t => t.category === category && t.isActive);
  }

  createTutorial(tutorial: Omit<Tutorial, 'id' | 'createdAt' | 'updatedAt'>): Tutorial {
    const newTutorial: Tutorial = {
      ...tutorial,
      id: `tutorial-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.tutorials.push(newTutorial);
    this.saveToStorage();
    return newTutorial;
  }

  updateTutorial(id: string, updates: Partial<Omit<Tutorial, 'id' | 'createdAt'>>): Tutorial | null {
    const index = this.tutorials.findIndex(t => t.id === id);
    if (index === -1) return null;

    this.tutorials[index] = {
      ...this.tutorials[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveToStorage();
    return this.tutorials[index];
  }

  deleteTutorial(id: string): boolean {
    const index = this.tutorials.findIndex(t => t.id === id);
    if (index === -1) return false;

    this.tutorials.splice(index, 1);
    this.saveToStorage();
    return true;
  }

  setActiveTutorial(id: string, category: Tutorial['category']): void {
    this.tutorials.forEach(t => {
      if (t.category === category) {
        t.isActive = t.id === id;
      }
    });
    this.saveToStorage();
  }

  duplicateTutorial(id: string): Tutorial | null {
    const original = this.getTutorialById(id);
    if (!original) return null;

    const duplicate: Tutorial = {
      ...original,
      id: `tutorial-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${original.name} (kopi)`,
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: original.steps.map(step => ({
        ...step,
        id: `${step.id}-copy-${Math.random().toString(36).substr(2, 5)}`,
      })),
    };

    this.tutorials.push(duplicate);
    this.saveToStorage();
    return duplicate;
  }

  addStep(tutorialId: string, step: Omit<TutorialStep, 'id'>): TutorialStep | null {
    const tutorial = this.getTutorialById(tutorialId);
    if (!tutorial) return null;

    const newStep: TutorialStep = {
      ...step,
      id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    };

    tutorial.steps.push(newStep);
    tutorial.updatedAt = new Date().toISOString();
    this.saveToStorage();
    return newStep;
  }

  updateStep(tutorialId: string, stepId: string, updates: Partial<TutorialStep>): boolean {
    const tutorial = this.getTutorialById(tutorialId);
    if (!tutorial) return false;

    const stepIndex = tutorial.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return false;

    tutorial.steps[stepIndex] = {
      ...tutorial.steps[stepIndex],
      ...updates,
    };
    tutorial.updatedAt = new Date().toISOString();
    this.saveToStorage();
    return true;
  }

  deleteStep(tutorialId: string, stepId: string): boolean {
    const tutorial = this.getTutorialById(tutorialId);
    if (!tutorial) return false;

    const stepIndex = tutorial.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return false;

    tutorial.steps.splice(stepIndex, 1);
    tutorial.updatedAt = new Date().toISOString();
    this.saveToStorage();
    return true;
  }

  reorderSteps(tutorialId: string, fromIndex: number, toIndex: number): boolean {
    const tutorial = this.getTutorialById(tutorialId);
    if (!tutorial) return false;

    if (fromIndex < 0 || fromIndex >= tutorial.steps.length) return false;
    if (toIndex < 0 || toIndex >= tutorial.steps.length) return false;

    const [movedStep] = tutorial.steps.splice(fromIndex, 1);
    tutorial.steps.splice(toIndex, 0, movedStep);
    tutorial.updatedAt = new Date().toISOString();
    this.saveToStorage();
    return true;
  }
}

export const tutorialService = new TutorialService();
