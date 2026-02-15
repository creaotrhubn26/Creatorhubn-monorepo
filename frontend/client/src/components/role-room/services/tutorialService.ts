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

const STORAGE_KEY = 'virtual-studio-tutorials';

const defaultCastingPlannerTutorial: Tutorial = {
  id: 'default-casting-planner',
  name: 'Casting Planner Veiledning',
  description: 'Lær alle funksjonene i Casting Planner',
  category: 'casting-planner',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  steps: [
    {
      id: 'welcome',
      title: 'Velkommen til Casting Planner!',
      description: 'Denne veiledningen tar deg gjennom alle funksjonene i Casting Planner. Du lærer hvordan du planlegger produksjoner, administrerer team, og organiserer opptak effektivt.',
      panel: -1,
      duration: 8000,
      tips: [
        'Du kan pause veiledningen når som helst',
        'Klikk på stegene i fremdriftslinjen for å hoppe til et spesifikt steg',
        'Trykk ESC for å lukke veiledningen',
      ],
    },
    {
      id: 'overview',
      title: '1. Oversikt - Ditt dashboard',
      description: 'Oversikten gir deg et fugleperspektiv av prosjektet ditt. Her ser du statistikk, fremdrift og viktige varsler.',
      panel: 0,
      targetSelector: '[role="tab"]:first-of-type',
      action: 'click',
      actionDescription: 'Klikk på "Oversikt"-fanen for å se dashboardet',
      tips: [
        'Dashboardet viser prosjektets totale fremdrift',
        'Du kan se antall roller, kandidater og planlagte opptak',
        'Kanban-visningen gir rask oversikt over oppgavestatus',
      ],
      duration: 10000,
    },
    {
      id: 'roles',
      title: '2. Roller - Definer karakterene',
      description: 'Her oppretter og administrerer du alle rollene i produksjonen din. Hver rolle kan ha detaljerte beskrivelser, krav og karaktertrekk.',
      panel: 1,
      targetSelector: '[role="tab"]:nth-of-type(2)',
      action: 'click',
      actionDescription: 'Klikk på "Roller"-fanen',
      tips: [
        'Klikk "Opprett rolle" for å legge til en ny rolle',
        'Du kan legge til aldersspenn, kjønn og spesielle ferdigheter',
        'Hver rolle kan knyttes til spesifikke scener',
        'Bruk prioritet for å markere hovedroller vs. biroller',
      ],
      duration: 10000,
    },
    {
      id: 'candidates',
      title: '3. Kandidater - Finn riktig person',
      description: 'Her administrerer du alle kandidater som har søkt eller blitt invitert til casting. Du kan se profiler, notater og castingstatus.',
      panel: 2,
      targetSelector: '[role="tab"]:nth-of-type(3)',
      action: 'click',
      actionDescription: 'Klikk på "Kandidater"-fanen',
      tips: [
        'Importer kandidater fra fil eller legg til manuelt',
        'Hver kandidat kan knyttes til én eller flere roller',
        'Bruk statusfilter for å se kun godkjente, avventende, eller avviste',
        'Last opp headshots og CV for hver kandidat',
      ],
      duration: 10000,
    },
    {
      id: 'team',
      title: '4. Team - Organiser crewet',
      description: 'Her administrerer du hele produksjonsteamet ditt. Legg til crew-medlemmer med roller, kontaktinfo og tilgjengelighet.',
      panel: 3,
      targetSelector: '[role="tab"]:nth-of-type(4)',
      action: 'click',
      actionDescription: 'Klikk på "Team"-fanen',
      tips: [
        'Legg til crew med navn, rolle og kontaktinfo',
        'Tildel ansvar for spesifikke oppgaver',
        'Se hvem som er tilgjengelig på hvilke dager',
        'Team-medlemmer kan tilordnes shots i Shot-list',
      ],
      duration: 10000,
    },
    {
      id: 'locations',
      title: '5. Steder - Finn locations',
      description: 'Her dokumenterer og organiserer du alle innspillingssteder. Legg til bilder, adresser, tillatelser og praktisk informasjon.',
      panel: 4,
      targetSelector: '[role="tab"]:nth-of-type(5)',
      action: 'click',
      actionDescription: 'Klikk på "Steder"-fanen',
      tips: [
        'Last opp bilder av hver location',
        'Legg til adresse og veibeskrivelse',
        'Dokumenter tillatelser og kontaktpersoner',
        'Merk hvilke scener som skal filmes hvor',
      ],
      duration: 10000,
    },
    {
      id: 'props',
      title: '6. Utstyr - Hold oversikt over rekvisitter',
      description: 'Administrer alle rekvisitter, kostymer og utstyr som trengs i produksjonen. Spor status og tilgjengelighet.',
      panel: 5,
      targetSelector: '[role="tab"]:nth-of-type(6)',
      action: 'click',
      actionDescription: 'Klikk på "Utstyr"-fanen',
      tips: [
        'Kategoriser utstyr (rekvisitter, kostymer, teknisk)',
        'Sett status: Tilgjengelig, Utlånt, Trenger innkjøp',
        'Knytt utstyr til spesifikke scener',
        'Legg til bilder for enkel identifisering',
      ],
      duration: 10000,
    },
    {
      id: 'calendar',
      title: '7. Kalender - Planlegg opptaksdager',
      description: 'Kalenderen gir deg full oversikt over hele produksjonsplanen. Se alle opptaksdager, møter og deadlines i én visning.',
      panel: 6,
      targetSelector: '[role="tab"]:nth-of-type(7)',
      action: 'click',
      actionDescription: 'Klikk på "Kalender"-fanen',
      tips: [
        'Dra for å opprette nye hendelser',
        'Klikk på en dag for å se alle aktiviteter',
        'Farger viser type aktivitet (opptak, møte, etc.)',
        'Hold oversikt over crew-tilgjengelighet',
      ],
      duration: 10000,
    },
    {
      id: 'shotlist',
      title: '8. Shot Lists - Planlegg hvert bilde',
      description: 'Shot-listen er hjertet av produksjonsplanleggingen. Her definerer du hvert enkelt shot med kameravinkel, bevegelse og beskrivelse.',
      panel: 7,
      targetSelector: '[role="tab"]:nth-of-type(8)',
      action: 'click',
      actionDescription: 'Klikk på "Shot Lists"-fanen',
      tips: [
        'Opprett shot lists for hver scene',
        'Angi kameravinkel, bevegelse og linse',
        'Legg til beskrivelse og referansebilder',
        'Estimer tid for hvert shot',
        'Generer AI-storyboard automatisk',
      ],
      duration: 12000,
    },
    {
      id: 'shotlist-ai',
      title: '8.1 AI Storyboard-generering',
      description: 'Bruk AI til å automatisk generere storyboard-bilder basert på shot-beskrivelsene dine. Velg visuell stil og klikk "Opprett storyboard".',
      panel: 7,
      action: 'click',
      actionDescription: 'Klikk på "Opprett storyboard"-knappen',
      tips: [
        'Velg blant 12 visuelle stiler (Cinematic, Documentary, etc.)',
        'AI genererer bilder basert på shot-beskrivelser',
        'Eksporter storyboard som PDF',
        'Regenerer enkeltbilder ved behov',
      ],
      duration: 10000,
    },
    {
      id: 'shotlist-team',
      title: '8.2 Team Dashboard',
      description: 'Åpne Team Dashboard for å se alle shots i Kanban-visning. Dra shots mellom kolonner, tilordne til teammedlemmer, og spor fremdrift.',
      panel: 7,
      action: 'click',
      actionDescription: 'Klikk på den rosa "Team"-knappen',
      tips: [
        'Kanban-visning: Dra shots mellom Venter, Pågår, Fullført',
        'Se arbeidsbelastning per teammedlem',
        'Filtrer på tilordnet person eller prioritet',
        'Aktivitetslogg viser alle endringer',
      ],
      duration: 10000,
    },
    {
      id: 'auditions',
      title: '9. Auditions - Planlegg castings',
      description: 'Her planlegger og administrerer du alle auditions og castings. Sett opp tider, inviter kandidater, og dokumenter resultater.',
      panel: 8,
      targetSelector: '[role="tab"]:nth-of-type(9)',
      action: 'click',
      actionDescription: 'Klikk på "Auditions"-fanen',
      tips: [
        'Opprett audition-økter med tid og sted',
        'Inviter kandidater til spesifikke tider',
        'Ta notater under auditionen',
        'Sammenlign kandidater side ved side',
      ],
      duration: 10000,
    },
    {
      id: 'sharing',
      title: '10. Deling - Samarbeid med andre',
      description: 'Del prosjektet med teammedlemmer eller klienter. Sett tilgangsnivåer og generer delbare lenker.',
      panel: 9,
      targetSelector: '[role="tab"]:nth-of-type(10)',
      action: 'click',
      actionDescription: 'Klikk på "Deling"-fanen',
      tips: [
        'Inviter teammedlemmer via e-post',
        'Velg tilgangsnivå: Kun visning, Rediger, Admin',
        'Generer offentlige lenker med begrenset tilgang',
        'Se hvem som har tilgang til prosjektet',
      ],
      duration: 10000,
    },
    {
      id: 'complete',
      title: 'Gratulerer! Du har fullført veiledningen',
      description: 'Du har nå lært alle hovedfunksjonene i Casting Planner. Klikk på "Nytt prosjekt"-knappen for å starte din første produksjon!',
      panel: -1,
      targetSelector: '[data-tutorial-target="create-project-button"]',
      action: 'click',
      actionDescription: 'Klikk på "Nytt prosjekt"-knappen for å opprette ditt første prosjekt',
      duration: 10000,
      tips: [
        'Klikk på den markerte knappen for å opprette et nytt prosjekt',
        'Velg prosjekttype og fyll ut detaljene',
        'Legg til roller og begynn å samle kandidater',
        'Team Dashboard holder alle synkronisert',
      ],
    },
  ],
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
      existingCastingTutorial.steps = defaultCastingPlannerTutorial.steps;
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
