import type {
  Manuscript,
  SceneBreakdown,
  DialogueLine,
  ScriptRevision,
  Act,
  ManuscriptExport} from '../models/casting';
import {
  ShotCamera,
  ShotLighting,
  ShotAudio,
  ShotNote,
  StoryboardFrame,
} from '../models/casting';
import { settingsService } from './settingsService';

// Database availability cache
let dbAvailable: boolean | null = null;
let dbCheckPromise: Promise<boolean> | null = null;

/**
 * Check if database is available
 */
async function checkDatabaseAvailability(): Promise<boolean> {
  if (dbAvailable !== null) {
    return dbAvailable;
  }
  
  if (dbCheckPromise) {
    return dbCheckPromise;
  }
  
  dbCheckPromise = (async () => {
    try {
      const response = await fetch('/api/casting/health');
      const result = await response.json();
      dbAvailable = result.status === 'healthy';
      return dbAvailable;
    } catch (error) {
      console.error('Database not available:', error);
      dbAvailable = false;
      return false;
    } finally {
      dbCheckPromise = null;
    }
  })();
  
  return dbCheckPromise;
}

const SETTINGS_NAMESPACES = {
  MANUSCRIPTS: 'virtualStudio_manuscripts',
  SCENES: 'virtualStudio_manuscriptScenes',
  DIALOGUE: 'virtualStudio_manuscriptDialogue',
  REVISIONS: 'virtualStudio_manuscriptRevisions',
  ACTS: 'virtualStudio_manuscriptActs',
  DEMO_INIT: 'virtualStudio_manuscriptDemoInit',
};

async function getManuscriptsFromStorage(projectId: string): Promise<Manuscript[]> {
  const cached = await settingsService.getSetting<Manuscript[]>(SETTINGS_NAMESPACES.MANUSCRIPTS, { projectId });
  if (cached) return cached;
  return [];
}

async function saveManuscriptToStorage(manuscript: Manuscript): Promise<void> {
  const projectId = manuscript.projectId;
  const cached = (await settingsService.getSetting<Manuscript[]>(SETTINGS_NAMESPACES.MANUSCRIPTS, { projectId })) || [];
  const index = cached.findIndex(m => m.id === manuscript.id);
  if (index >= 0) {
    cached[index] = manuscript;
  } else {
    cached.push(manuscript);
  }
  await settingsService.setSetting(SETTINGS_NAMESPACES.MANUSCRIPTS, cached, { projectId });
}

async function deleteManuscriptFromStorage(id: string): Promise<void> {
  const entries = await settingsService.listSettings(SETTINGS_NAMESPACES.MANUSCRIPTS);
  for (const entry of entries) {
    const manuscripts = Array.isArray(entry.data) ? (entry.data as Manuscript[]) : [];
    const filtered = manuscripts.filter(m => m.id !== id);
    if (filtered.length !== manuscripts.length) {
      await settingsService.setSetting(SETTINGS_NAMESPACES.MANUSCRIPTS, filtered, {
        projectId: entry.projectId,
      });
    }
  }
}

async function getScenesFromStorage(manuscriptId: string): Promise<SceneBreakdown[]> {
  const cached = await settingsService.getSetting<SceneBreakdown[]>(SETTINGS_NAMESPACES.SCENES, {
    projectId: manuscriptId,
  });
  if (cached) return cached;
  return [];
}

async function saveSceneToStorage(scene: SceneBreakdown): Promise<void> {
  const manuscriptId = scene.manuscriptId;
  const cached = (await settingsService.getSetting<SceneBreakdown[]>(SETTINGS_NAMESPACES.SCENES, {
    projectId: manuscriptId,
  })) || [];
  const index = cached.findIndex(s => s.id === scene.id);
  if (index >= 0) {
    cached[index] = scene;
  } else {
    cached.push(scene);
  }
  await settingsService.setSetting(SETTINGS_NAMESPACES.SCENES, cached, { projectId: manuscriptId });
}

async function getDialogueFromStorage(manuscriptId: string): Promise<DialogueLine[]> {
  const cached = await settingsService.getSetting<DialogueLine[]>(SETTINGS_NAMESPACES.DIALOGUE, {
    projectId: manuscriptId,
  });
  if (cached) return cached;
  return [];
}

async function saveDialogueToStorage(dialogue: DialogueLine): Promise<void> {
  const manuscriptId = dialogue.manuscriptId;
  const cached = (await settingsService.getSetting<DialogueLine[]>(SETTINGS_NAMESPACES.DIALOGUE, {
    projectId: manuscriptId,
  })) || [];
  const existingIndex = cached.findIndex(d => d.id === dialogue.id);
  if (existingIndex >= 0) {
    cached[existingIndex] = dialogue;
  } else {
    cached.push(dialogue);
  }
  await settingsService.setSetting(SETTINGS_NAMESPACES.DIALOGUE, cached, { projectId: manuscriptId });
}

async function deleteDialogueFromStorage(dialogueId: string): Promise<void> {
  const entries = await settingsService.listSettings(SETTINGS_NAMESPACES.DIALOGUE);
  for (const entry of entries) {
    const dialogue = Array.isArray(entry.data) ? (entry.data as DialogueLine[]) : [];
    const filtered = dialogue.filter(d => d.id !== dialogueId);
    if (filtered.length !== dialogue.length) {
      await settingsService.setSetting(SETTINGS_NAMESPACES.DIALOGUE, filtered, {
        projectId: entry.projectId,
      });
    }
  }
}

async function getRevisionsFromStorage(manuscriptId: string): Promise<ScriptRevision[]> {
  const cached = await settingsService.getSetting<ScriptRevision[]>(SETTINGS_NAMESPACES.REVISIONS, {
    projectId: manuscriptId,
  });
  if (cached) return cached;
  return [];
}

async function saveRevisionToStorage(revision: ScriptRevision): Promise<void> {
  const manuscriptId = revision.manuscriptId;
  const cached = (await settingsService.getSetting<ScriptRevision[]>(SETTINGS_NAMESPACES.REVISIONS, {
    projectId: manuscriptId,
  })) || [];
  cached.push(revision);
  await settingsService.setSetting(SETTINGS_NAMESPACES.REVISIONS, cached, { projectId: manuscriptId });
}

async function getActsFromStorage(manuscriptId: string): Promise<Act[]> {
  const cached = await settingsService.getSetting<Act[]>(SETTINGS_NAMESPACES.ACTS, { projectId: manuscriptId });
  if (cached) return cached;
  return [];
}

async function saveActsToStorage(manuscriptId: string, acts: Act[]): Promise<void> {
  await settingsService.setSetting(SETTINGS_NAMESPACES.ACTS, acts, { projectId: manuscriptId });
}

async function hasDemoInit(projectId: string): Promise<boolean> {
  const cached = await settingsService.getSetting<boolean>(SETTINGS_NAMESPACES.DEMO_INIT, { projectId });
  if (cached) return true;
  return false;
}

async function markDemoInit(projectId: string): Promise<void> {
  await settingsService.setSetting(SETTINGS_NAMESPACES.DEMO_INIT, true, { projectId });
}

/**
 * Generate demo data for "TROLL" - Norwegian film by Roar Uthaug (2022)
 * This provides realistic mock data for testing the Production Manuscript View
 */
function generateTrollDemoData(projectId: string): {
  manuscript: Manuscript;
  acts: Act[];
  scenes: SceneBreakdown[];
  dialogue: DialogueLine[];
} {
  const manuscriptId = `troll-demo-${projectId}`;
  const now = new Date().toISOString();

  // Full Fountain screenplay content for TROLL
  const trollScreenplayContent = `Title: TROLL
Credit: Skrevet av
Author: Espen Aukan
Source: Basert på norsk folketro
Draft date: ${new Date().toLocaleDateString('nb-NO')}
Contact:
    Netflix / Motion Blur
    Oslo, Norge

= AKT 1 - OPPVÅKNINGEN =

EXT. DOVRE FJELL - TUNNEL - NIGHT

Vinden hyler over fjellet. Tungt maskineri arbeider i tunnelåpningen. Lys fra arbeidsbrakker kaster lange skygger.

SUPER: "DOVRE, NORGE - NÅ"

Inne i tunnelen: ARBEIDER 1 (50) og ARBEIDER 2 (35) betjener en boremaskin. Vibrasjonene er intense.

ARBEIDER 1
(roper over støyen)
Vi er snart gjennom! Bare noen meter til!

Plutselig - STILLHET. Boret går gjennom i tomrom.

ARBEIDER 2
Hva faen?

De lyser inn med lommelyktene. Et enormt hulrom åpenbarer seg.

FORMANN (40) kommer løpende.

FORMANN
Hva skjedde? Hvorfor stoppet dere?

ARBEIDER 1
Det er noe der inne, sjef. En slags... hule.

De stirrer inn i mørket. Noe BEVEGER seg. Dypt inne i fjellet.

INT. HULEN - INNE I FJELLET - NIGHT

Arbeiderne går forsiktig inn. Lommelyktene avslører merkelige formasjoner. Ikke stein. Noe organisk.

ARBEIDER 2
(hvisker)
Ser du det? Det ser ut som... bein.

Et lavt DRØNN. Bakken rister. Steinene over dem begynner å falle.

ARBEIDER 1
UT! NÅ!

De løper. Bak dem: to enorme ØYNE åpner seg i mørket.

SMASH TO:

INT. NORAS LEILIGHET - OSLO - DAY

NORA TIDEMANN (35) - skarp, uredd, med et blikk som ser mer enn de fleste. Hun våkner til TV-nyhetene.

NYHETSANKER (V.O.)
...jordskjelv i Dovre-området. Flere tunnelarbeidere er savnet...

Nora setter seg opp. Fossiler og fagbøker fyller leiligheten hennes.

NORA
(til seg selv)
Det er ikke jordskjelv-aktivitet i Dovre...

Telefonen ringer. Ukjent nummer.

INT. UNIVERSITETET - KONTOR - DAY

Nora sitter i et møterom. Foran henne: ANDREAS ISAKSEN (40), statlig rådgiver, nervøs. GENERAL LUND (55), militær, skeptisk.

ANDREAS
Dr. Tidemann, det du ser nå er klassifisert.

Han viser bilder på en laptop. Enorme fotspor. Knuste trær.

NORA
Det der er... det er umulig.

GENERAL LUND
Vi trenger ikke noen som forteller oss hva som er umulig. Vi trenger noen som kan fortelle oss hva det ER.

NORA
(studerer bildene)
Hvis jeg ikke visste bedre... ville jeg si det er et troll.

Stillhet i rommet.

ANDREAS
Nettopp.

EXT. DOVRE - RUINENE - DAY

Helikopteret lander. Nora går ut, vindblaffen river i håret hennes.

Foran henne: total ødeleggelse. Tunnelen er kollapset. Trær er knekt som fyrstikker i en linje mot skogen.

NORA
Fotspor...
(måler med blikket)
Tjue meter mellom hvert steg.

ANDREAS
Dr. Tidemann?

NORA
Dere vekket noe. Noe som har sovet i tusen år.

= AKT 2 - JAKTEN =

EXT. SKOG - ØSTERDALEN - NIGHT

Månelys over trærne. Stillhet.

Så: BRAK. Trær faller. Fugler flykter.

En BONDE (60) står ved traktoren sin, lamslått.

BONDENS KONE (58) roper fra huset.

BONDENS KONE
JOHAN! Kom inn! NÅ!

Han kan ikke bevege seg. Foran ham, i månelyset: en silhuett høyere enn trærne. Et TROLL.

Det stopper. Snur hodet. Ser rett på ham.

Så går det videre. Mot sør. Mot Oslo.

INT. KOMMANDOSENTRALEN - OSLO - DAY

Kart på skjermene. Røde prikker markerer siktinger.

GENERAL LUND
Det beveger seg mot hovedstaden. Vi må slå til nå.

NORA
Nei! Vi vet ikke nok om det ennå.

GENERAL LUND
Det har drept folk, Dr. Tidemann.

NORA
Har det? Eller har folk bare vært i veien?

Generalen ser på henne med forakt.

ANDREAS
Hva foreslår du?

NORA
La meg prøve å kommunisere med det.

Latter fra generalene.

GENERAL LUND
Kommunisere? Med et monster?

NORA
Det er ikke et monster. Det er noe vi har glemt. Noe vi SKULLE husket.

EXT. MOTORVEI E6 - NIGHT

Kaos. Biler står strandet. Folk løper.

TROLLET krysser veien. Enorme føtter knuser asfalten.

En POLITIMANN skyter. Kulene preller av.

Trollet ser ned. Trist. Forvirret.

Det går videre.

= AKT 3 - DET ENDELIGE VALGET =

EXT. SLOTTSPLASSEN - OSLO - SUNRISE

Trollet står foran Slottet. Solen er i ferd med å stå opp over Oslofjorden.

Militære kjøretøy omringer det. Soldater sikter.

Nora løper mot det.

ANDREAS
NORA! Ikke!

Hun stopper foran trollet. Det ser ned på henne.

NORA
(på gammelnorsk)
Du er langt hjemmefra.

Trollet bøyer seg ned. Øynene - fulle av sorg, ikke raseri.

NORA (CONT'D)
Jeg vet hva du leter etter.

Bak henne: TOBIAS (70), Noras far. Han har et urgammelt steinamulett.

TOBIAS
Han leter etter familien sin. De forsteinet ham for tusen år siden.

Trollet strekker ut en hånd. Forsiktig.

GENERAL LUND (V.O.)
(på radio)
Skyt.

Nora snur seg.

NORA
NEI!

Hun stiller seg mellom trollet og soldatene.

NORA (CONT'D)
Hvis dere dreper ham, dreper dere det siste av det vi en gang trodde på.

Solen stiger høyere. Trollets hud begynner å sprekke.

TROLLET
(på gammelnorsk, sakte)
...hjem...

Nora tar farens hånd. De går mot trollet.

NORA
La oss ta deg hjem.

Trollet løfter dem forsiktig opp. Det snur seg mot fjellet.

Bak dem synker solen igjen bak skyene. De har tid.

SMASH TO BLACK.

SUPER: "Trollet ble ført tilbake til Dovre."

SUPER: "Det sover fortsatt."

SUPER: "Men noen passer på."

EXT. DOVRE - UTSIKTSPUNKT - DAY

Nora står på et fjell. Ser utover dalen.

Bak henne, delvis skjult av fjellet: omrisset av et sovende troll.

FADE OUT.

THE END
`;

  const manuscript: Manuscript = {
    id: manuscriptId,
    projectId,
    title: 'TROLL',
    subtitle: 'En norsk eventyrfilm',
    author: 'Espen Aukan',
    format: 'fountain',
    content: trollScreenplayContent,
    createdAt: now,
    updatedAt: now,
    version: '1.0',
    status: 'shooting',
    pageCount: 98,
    wordCount: 15000,
  };

  const acts: Act[] = [
    {
      id: `${manuscriptId}-act-1`,
      manuscriptId,
      projectId,
      actNumber: 1,
      title: 'OPPVÅKNINGEN',
      description: 'Trollet våkner i Dovre etter tusen år. Nora oppdager sannheten.',
      pageStart: 1,
      pageEnd: 32,
      estimatedRuntime: 30,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${manuscriptId}-act-2`,
      manuscriptId,
      projectId,
      actNumber: 2,
      title: 'JAKTEN',
      description: 'Militæret jakter trollet. Nora prøver å forstå hvordan de kan stoppe det.',
      pageStart: 33,
      pageEnd: 68,
      estimatedRuntime: 35,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${manuscriptId}-act-3`,
      manuscriptId,
      projectId,
      actNumber: 3,
      title: 'KONFRONTASJONEN',
      description: 'Det endelige oppgjøret i Oslo. Nora må velge mellom å drepe eller redde trollet.',
      pageStart: 69,
      pageEnd: 98,
      estimatedRuntime: 30,
      sortOrder: 3,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const scenes: SceneBreakdown[] = [
    // AKT 1 - Oppvåkningen
    {
      id: `${manuscriptId}-scene-1`,
      manuscriptId,
      projectId,
      actId: acts[0].id,
      sceneNumber: '1',
      sceneHeading: 'EXT. DOVRE FJELL - TUNNEL - NIGHT',
      intExt: 'EXT',
      locationName: 'DOVRE FJELL - TUNNEL',
      timeOfDay: 'NIGHT',
      description: 'Sprengningsarbeid i fjellet. Arbeidere borer seg inn i en ukjent hule.',
      pageLength: 3,
      estimatedDuration: 180,
      characters: ['ARBEIDER 1', 'ARBEIDER 2', 'FORMANN'],
      propsNeeded: ['Boremaskin', 'Hjelmer', 'Lommelykter', 'Dynamitt'],
      status: 'completed',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${manuscriptId}-scene-2`,
      manuscriptId,
      projectId,
      actId: acts[0].id,
      sceneNumber: '2',
      sceneHeading: 'INT. HULEN - INNE I FJELLET - NIGHT',
      intExt: 'INT',
      locationName: 'HULEN - INNE I FJELLET',
      timeOfDay: 'NIGHT',
      description: 'Arbeiderne oppdager en enorm hule med merkelige bergformasjoner. Noe beveger seg i mørket.',
      pageLength: 2.5,
      estimatedDuration: 120,
      characters: ['ARBEIDER 1', 'ARBEIDER 2'],
      propsNeeded: ['Lommelykter', 'Radioutstyr'],
      status: 'completed',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${manuscriptId}-scene-3`,
      manuscriptId,
      projectId,
      actId: acts[0].id,
      sceneNumber: '3',
      sceneHeading: 'INT. NORAS LEILIGHET - OSLO - DAY',
      intExt: 'INT',
      locationName: 'NORAS LEILIGHET - OSLO',
      timeOfDay: 'DAY',
      description: 'Paleontolog Nora Tidemann våkner til nyheter om jordskjelv i Dovre.',
      pageLength: 2,
      estimatedDuration: 120,
      characters: ['NORA TIDEMANN'],
      propsNeeded: ['TV', 'Kaffe', 'Fossiler', 'Bøker'],
      status: 'scheduled',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${manuscriptId}-scene-4`,
      manuscriptId,
      projectId,
      actId: acts[0].id,
      sceneNumber: '4',
      sceneHeading: 'INT. UNIVERSITETET - KONTOR - DAY',
      intExt: 'INT',
      locationName: 'UNIVERSITETET - KONTOR',
      timeOfDay: 'DAY',
      description: 'Nora blir kontaktet av myndighetene. De viser henne bilder fra tunnelen.',
      pageLength: 4,
      estimatedDuration: 240,
      characters: ['NORA TIDEMANN', 'ANDREAS ISAKSEN', 'GENERAL LUND'],
      propsNeeded: ['Laptop', 'Bilder', 'Dokumenter'],
      status: 'scheduled',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${manuscriptId}-scene-5`,
      manuscriptId,
      projectId,
      actId: acts[0].id,
      sceneNumber: '5',
      sceneHeading: 'EXT. DOVRE - RUINENE - DAY',
      intExt: 'EXT',
      locationName: 'DOVRE - RUINENE',
      timeOfDay: 'DAY',
      description: 'Nora ankommer åstedet. Hun ser ødeleggelsene og forstår at dette ikke er naturlig.',
      pageLength: 3,
      estimatedDuration: 180,
      characters: ['NORA TIDEMANN', 'ANDREAS ISAKSEN', 'SOLDATER'],
      propsNeeded: ['Helikopter', 'Militærutstyr', 'Kamera'],
      status: 'not-scheduled',
      createdAt: now,
      updatedAt: now,
    },
    // AKT 2 - Jakten
    {
      id: `${manuscriptId}-scene-6`,
      manuscriptId,
      projectId,
      actId: acts[1].id,
      sceneNumber: '6',
      sceneHeading: 'EXT. SKOG - ØSTERDALEN - NIGHT',
      intExt: 'EXT',
      locationName: 'SKOG - ØSTERDALEN',
      timeOfDay: 'NIGHT',
      description: 'Trollet beveger seg gjennom skogen. Lokale ser det i måneskinn.',
      pageLength: 3,
      estimatedDuration: 180,
      characters: ['TROLLET', 'BONDE', 'BONDENS KONE'],
      propsNeeded: ['Traktor', 'Fjøslykt'],
      status: 'not-scheduled',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${manuscriptId}-scene-7`,
      manuscriptId,
      projectId,
      actId: acts[1].id,
      sceneNumber: '7',
      sceneHeading: 'INT. KOMMANDOSENTRALEN - OSLO - DAY',
      intExt: 'INT',
      locationName: 'KOMMANDOSENTRALEN - OSLO',
      timeOfDay: 'DAY',
      description: 'Militæret planlegger angrep. Nora advarer mot bruk av vold.',
      pageLength: 5,
      estimatedDuration: 300,
      characters: ['NORA TIDEMANN', 'GENERAL LUND', 'STATSMINISTER', 'RÅDGIVERE'],
      propsNeeded: ['Storskjermer', 'Kart', 'Radiosystemer'],
      status: 'scheduled',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${manuscriptId}-scene-8`,
      manuscriptId,
      projectId,
      actId: acts[1].id,
      sceneNumber: '8',
      sceneHeading: 'EXT. MOTORVEI E6 - NIGHT',
      intExt: 'EXT',
      locationName: 'MOTORVEI E6',
      timeOfDay: 'NIGHT',
      description: 'Trollet krysser E6. Biler krasjer. Kaos utfolder seg.',
      pageLength: 5,
      estimatedDuration: 300,
      characters: ['TROLLET', 'BILISTER', 'POLITIMANN'],
      propsNeeded: ['Biler', 'Politibil', 'Veisperring'],
      specialEffects: 'VFX: Trollet, bilkrasj',
      status: 'not-scheduled',
      createdAt: now,
      updatedAt: now,
    },
    // AKT 3 - Konfrontasjonen
    {
      id: `${manuscriptId}-scene-9`,
      manuscriptId,
      projectId,
      actId: acts[2].id,
      sceneNumber: '9',
      sceneHeading: 'EXT. SLOTTSPLASSEN - OSLO - DAWN',
      intExt: 'EXT',
      locationName: 'SLOTTSPLASSEN - OSLO',
      timeOfDay: 'DAWN',
      description: 'Trollet nærmer seg Slottet. Solen er i ferd med å stå opp.',
      pageLength: 6,
      estimatedDuration: 360,
      characters: ['TROLLET', 'NORA TIDEMANN', 'ANDREAS ISAKSEN', 'SOLDATER'],
      propsNeeded: ['Militærkjøretøy', 'UV-lys', 'Megafon'],
      specialEffects: 'VFX: Trollet, sollys-effekt',
      status: 'not-scheduled',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${manuscriptId}-scene-10`,
      manuscriptId,
      projectId,
      actId: acts[2].id,
      sceneNumber: '10',
      sceneHeading: 'EXT. KARL JOHANS GATE - OSLO - DAWN',
      intExt: 'EXT',
      locationName: 'KARL JOHANS GATE - OSLO',
      timeOfDay: 'DAWN',
      description: 'Klimaks. Nora må ta det endelige valget. Sollyset treffer trollet.',
      pageLength: 9,
      estimatedDuration: 540,
      characters: ['TROLLET', 'NORA TIDEMANN', 'ANDREAS ISAKSEN', 'TOBIAS (FAR)'],
      propsNeeded: ['Kirkeklokker', 'Speiler', 'UV-lamper'],
      specialEffects: 'VFX: Trollet forsteines',
      status: 'not-scheduled',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const dialogue: DialogueLine[] = [
    // Scene 3 - Noras leilighet
    {
      id: `${manuscriptId}-dial-1`,
      manuscriptId,
      sceneId: scenes[2].id,
      characterName: 'TV-REPORTER',
      dialogueText: 'Et kraftig jordskjelv har rammet Dovre-regionen i natt. Flere tunnelarbeidere er savnet.',
      dialogueType: 'voice-over',
      lineNumber: 1,
      parenthetical: 'V.O.',
      createdAt: now,
      updatedAt: now,
    },
    // Scene 4 - Universitetet
    {
      id: `${manuscriptId}-dial-2`,
      manuscriptId,
      sceneId: scenes[3].id,
      characterName: 'ANDREAS ISAKSEN',
      dialogueText: 'Vi trenger din ekspertise, Nora. Du er den fremste på norrøn geologi i landet.',
      dialogueType: 'dialogue',
      lineNumber: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${manuscriptId}-dial-3`,
      manuscriptId,
      sceneId: scenes[3].id,
      characterName: 'NORA TIDEMANN',
      dialogueText: 'Hva er det dere egentlig har funnet der inne?',
      dialogueType: 'dialogue',
      lineNumber: 3,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${manuscriptId}-dial-4`,
      manuscriptId,
      sceneId: scenes[3].id,
      characterName: 'GENERAL LUND',
      dialogueText: 'Noe som ikke burde eksistere.',
      dialogueType: 'dialogue',
      lineNumber: 4,
      parenthetical: 'alvorlig',
      createdAt: now,
      updatedAt: now,
    },
    // Scene 7 - Kommandosentralen
    {
      id: `${manuscriptId}-dial-5`,
      manuscriptId,
      sceneId: scenes[6].id,
      characterName: 'NORA TIDEMANN',
      dialogueText: 'Dere kan ikke drepe det! Dette er en levende skapning som har eksistert i tusenvis av år!',
      dialogueType: 'dialogue',
      lineNumber: 5,
      parenthetical: 'desperat',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${manuscriptId}-dial-6`,
      manuscriptId,
      sceneId: scenes[6].id,
      characterName: 'GENERAL LUND',
      dialogueText: 'Det har drept syv mennesker på to dager. Vi har ikke noe valg.',
      dialogueType: 'dialogue',
      lineNumber: 6,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${manuscriptId}-dial-7`,
      manuscriptId,
      sceneId: scenes[6].id,
      characterName: 'STATSMINISTER',
      dialogueText: 'Hva foreslår du, Tidemann? At vi bare lar det vandre inn i hovedstaden?',
      dialogueType: 'dialogue',
      lineNumber: 7,
      createdAt: now,
      updatedAt: now,
    },
    // Scene 10 - Karl Johan
    {
      id: `${manuscriptId}-dial-8`,
      manuscriptId,
      sceneId: scenes[9].id,
      characterName: 'NORA TIDEMANN',
      dialogueText: 'Det leter etter noe. Det leter etter... hjemmet sitt.',
      dialogueType: 'dialogue',
      lineNumber: 8,
      parenthetical: 'forstår',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${manuscriptId}-dial-9`,
      manuscriptId,
      sceneId: scenes[9].id,
      characterName: 'TOBIAS',
      dialogueText: 'Nora... Jeg skulle ønske jeg hadde fortalt deg sannheten. Om alt.',
      dialogueType: 'dialogue',
      lineNumber: 9,
      parenthetical: 'svak stemme',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${manuscriptId}-dial-10`,
      manuscriptId,
      sceneId: scenes[9].id,
      characterName: 'NORA TIDEMANN',
      dialogueText: 'Jeg vet, pappa. Jeg vet.',
      dialogueType: 'dialogue',
      lineNumber: 10,
      parenthetical: 'gråtkvalt',
      createdAt: now,
      updatedAt: now,
    },
  ];

  return { manuscript, acts, scenes, dialogue };
}

/**
 * Initialize demo data for a project if no manuscripts exist
 */
async function initializeDemoDataIfNeeded(projectId: string): Promise<void> {
  if (await hasDemoInit(projectId)) return;

  const manuscripts = await getManuscriptsFromStorage(projectId);
  if (manuscripts.length === 0) {
    console.log('🎬 Initializing TROLL demo data for project:', projectId);
    const demoData = generateTrollDemoData(projectId);
    
    // Cache demo data for offline access
    await saveManuscriptToStorage(demoData.manuscript);
    console.log('📝 Saved manuscript:', demoData.manuscript.title);
    
    // Save acts
    await saveActsToStorage(demoData.manuscript.id, demoData.acts);
    console.log('🎭 Saved', demoData.acts.length, 'acts');
    
    // Save scenes
    for (const scene of demoData.scenes) {
      await saveSceneToStorage(scene);
    }
    console.log('🎬 Saved', demoData.scenes.length, 'scenes');
    
    // Save dialogue
    await settingsService.setSetting(SETTINGS_NAMESPACES.DIALOGUE, demoData.dialogue, {
      projectId: demoData.manuscript.id,
    });
    console.log('💬 Saved', demoData.dialogue.length, 'dialogue lines');
    
    // Also sync to database if available
    const isDbAvailable = await checkDatabaseAvailability();
    if (isDbAvailable) {
      try {
        console.log('🔄 Syncing TROLL demo data to database...');
        
        // Create manuscript in DB
        const manuscriptResponse = await fetch('/api/casting/manuscripts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(demoData.manuscript),
        });
        
        if (manuscriptResponse.ok) {
          console.log('✅ Manuscript synced to database');
          
          // Create acts in DB
          for (const act of demoData.acts) {
            await fetch('/api/casting/acts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(act),
            });
          }
          console.log('✅ Acts synced to database');
          
          // Create scenes in DB
          for (const scene of demoData.scenes) {
            await fetch('/api/casting/scenes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(scene),
            });
          }
          console.log('✅ Scenes synced to database');
          
          // Create dialogue in DB
          for (const line of demoData.dialogue) {
            await fetch('/api/casting/dialogue', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(line),
            });
          }
          console.log('✅ Dialogue synced to database');
        }
      } catch (error) {
        console.error('⚠️ Error syncing demo data to database:', error);
        // Continue anyway - settings cache has the data
      }
    }
    
    // Mark as initialized
    await markDemoInit(projectId);
    
    console.log('✅ Demo data for "TROLL" initialized successfully');
  } else {
    console.log('📚 Found', manuscripts.length, 'existing manuscripts for project:', projectId);
  }
}

/**
 * Manuscript Service
 */
class ManuscriptService {
  /**
   * Get all manuscripts for a project
   */
  async getManuscripts(projectId: string): Promise<Manuscript[]> {
    // Initialize demo data if needed
    await initializeDemoDataIfNeeded(projectId);
    
    const isDbAvailable = await checkDatabaseAvailability();
    
    if (isDbAvailable) {
      try {
        const response = await fetch(`/api/casting/manuscripts?projectId=${projectId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch manuscripts: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Error fetching manuscripts from database:', error);
        return await getManuscriptsFromStorage(projectId);
      }
    }
    
    return await getManuscriptsFromStorage(projectId);
  }

  /**
   * Get a single manuscript by ID
   */
  async getManuscript(id: string): Promise<Manuscript | null> {
    const isDbAvailable = await checkDatabaseAvailability();
    
    if (isDbAvailable) {
      try {
        const response = await fetch(`/api/casting/manuscripts/${id}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch manuscript: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Error fetching manuscript from database:', error);
      }
    }
    
    const entries = await settingsService.listSettings(SETTINGS_NAMESPACES.MANUSCRIPTS);
    for (const entry of entries) {
      const manuscripts = Array.isArray(entry.data) ? (entry.data as Manuscript[]) : [];
      const found = manuscripts.find(m => m.id === id);
      if (found) return found;
    }
    return null;
  }

  /**
   * Create a new manuscript
   */
  async createManuscript(manuscript: Manuscript): Promise<Manuscript> {
    const isDbAvailable = await checkDatabaseAvailability();
    
    if (isDbAvailable) {
      try {
        const response = await fetch('/api/casting/manuscripts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(manuscript),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create manuscript: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error creating manuscript in database:', error);
      }
    }
    
    // Fallback to settings cache
    await saveManuscriptToStorage(manuscript);
    return manuscript;
  }

  /**
   * Update a manuscript
   */
  async updateManuscript(manuscript: Manuscript): Promise<Manuscript> {
    manuscript.updatedAt = new Date().toISOString();
    
    const isDbAvailable = await checkDatabaseAvailability();
    
    if (isDbAvailable) {
      try {
        const response = await fetch(`/api/casting/manuscripts/${manuscript.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(manuscript),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to update manuscript: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error updating manuscript in database:', error);
      }
    }
    
    // Fallback to settings cache
    await saveManuscriptToStorage(manuscript);
    return manuscript;
  }

  /**
   * Delete a manuscript
   */
  async deleteManuscript(id: string): Promise<void> {
    const isDbAvailable = await checkDatabaseAvailability();
    
    if (isDbAvailable) {
      try {
        const response = await fetch(`/api/casting/manuscripts/${id}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          throw new Error(`Failed to delete manuscript: ${response.statusText}`);
        }
        
        return;
      } catch (error) {
        console.error('Error deleting manuscript from database:', error);
      }
    }
    
    // Fallback to settings cache
    await deleteManuscriptFromStorage(id);
  }

  /**
   * Get scenes for a manuscript
   */
  async getScenes(manuscriptId: string): Promise<SceneBreakdown[]> {
    const isDbAvailable = await checkDatabaseAvailability();
    
    if (isDbAvailable) {
      try {
        const response = await fetch(`/api/casting/manuscripts/${manuscriptId}/scenes`);
        if (!response.ok) {
          throw new Error(`Failed to fetch scenes: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Error fetching scenes from database:', error);
      }
    }
    
    return await getScenesFromStorage(manuscriptId);
  }

  /**
   * Create or update a scene
   */
  async saveScene(scene: SceneBreakdown): Promise<SceneBreakdown> {
    scene.updatedAt = new Date().toISOString();
    
    const isDbAvailable = await checkDatabaseAvailability();
    
    if (isDbAvailable) {
      try {
        const response = await fetch('/api/casting/scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scene),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to save scene: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error saving scene to database:', error);
      }
    }
    
    // Fallback to settings cache
    await saveSceneToStorage(scene);
    return scene;
  }

  /**
   * Get dialogue for a manuscript
   */
  async getDialogue(manuscriptId: string): Promise<DialogueLine[]> {
    const isDbAvailable = await checkDatabaseAvailability();
    
    if (isDbAvailable) {
      try {
        const response = await fetch(`/api/casting/manuscripts/${manuscriptId}/dialogue`);
        if (!response.ok) {
          throw new Error(`Failed to fetch dialogue: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Error fetching dialogue from database:', error);
      }
    }
    
    return await getDialogueFromStorage(manuscriptId);
  }

  /**
   * Save a dialogue line to database
   */
  async saveDialogue(dialogue: DialogueLine): Promise<DialogueLine> {
    const isDbAvailable = await checkDatabaseAvailability();
    
    if (isDbAvailable) {
      try {
        const response = await fetch('/api/casting/dialogue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dialogue),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to save dialogue: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error saving dialogue to database:', error);
      }
    }
    
    // Fallback to settings cache
    await saveDialogueToStorage(dialogue);
    return dialogue;
  }

  /**
   * Delete a dialogue line from database
   */
  async deleteDialogue(dialogueId: string): Promise<boolean> {
    const isDbAvailable = await checkDatabaseAvailability();
    
    if (isDbAvailable) {
      try {
        const response = await fetch(`/api/casting/dialogue/${dialogueId}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          throw new Error(`Failed to delete dialogue: ${response.statusText}`);
        }
        
        return true;
      } catch (error) {
        console.error('Error deleting dialogue from database:', error);
      }
    }
    
    // Fallback to settings cache
    await deleteDialogueFromStorage(dialogueId);
    return true;
  }

  /**
   * Get revisions for a manuscript
   */
  async getRevisions(manuscriptId: string): Promise<ScriptRevision[]> {
    const isDbAvailable = await checkDatabaseAvailability();
    
    if (isDbAvailable) {
      try {
        const response = await fetch(`/api/casting/manuscripts/${manuscriptId}/revisions`);
        if (!response.ok) {
          throw new Error(`Failed to fetch revisions: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Error fetching revisions from database:', error);
      }
    }
    
    return await getRevisionsFromStorage(manuscriptId);
  }

  /**
   * Create a new revision
   */
  async createRevision(revision: ScriptRevision): Promise<ScriptRevision> {
    const isDbAvailable = await checkDatabaseAvailability();
    
    if (isDbAvailable) {
      try {
        const response = await fetch('/api/casting/revisions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(revision),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create revision: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error creating revision in database:', error);
      }
    }
    
    // Fallback to settings cache
    await saveRevisionToStorage(revision);
    return revision;
  }

  /**
   * Parse screenplay and generate scene breakdown
   * Supports Fountain format
   */
  async parseScript(content: string, format: 'fountain' | 'markdown' | 'final-draft'): Promise<{
    scenes: SceneBreakdown[];
    dialogue: DialogueLine[];
    characters: Set<string>;
  }> {
    const scenes: SceneBreakdown[] = [];
    const dialogue: DialogueLine[] = [];
    const characters = new Set<string>();
    
    if (format === 'fountain') {
      return this.parseFountain(content);
    } else if (format === 'markdown') {
      return this.parseMarkdown(content);
    }
    
    return { scenes, dialogue, characters };
  }

  /**
   * Parse Fountain format screenplay
   * Fountain is a plain text markup language for screenwriting
   * Enhanced version with full Fountain spec support
   */
  private parseFountain(content: string): {
    scenes: SceneBreakdown[];
    dialogue: DialogueLine[];
    characters: Set<string>;
  } {
    const scenes: SceneBreakdown[] = [];
    const dialogue: DialogueLine[] = [];
    const characters = new Set<string>();
    
    // Parse title page first (key: value pairs at start)
    const titlePageEnd = this.parseTitlePage(content);
    const scriptContent = content.substring(titlePageEnd);
    
    const lines = scriptContent.split('\n');
    let currentScene: Partial<SceneBreakdown> | null = null;
    let sceneNumber = 1;
    let lineNumber = 1;
    let currentCharacter: string | null = null;
    let inDualDialogue = false;
    let pageNumber = 1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments (/* */ or [[notes]])
      if (!trimmedLine || trimmedLine.startsWith('/*') || trimmedLine.startsWith('[[')) {
        if (trimmedLine.startsWith('/*') || trimmedLine.startsWith('[[')) {
          // Skip multi-line comments
          while (i < lines.length && !lines[i].includes('*/') && !lines[i].includes(']]')) {
            i++;
          }
        }
        continue;
      }
      
      // Boneyard (omitted sections) - starts with /*
      if (trimmedLine.startsWith('/*')) {
        while (i < lines.length && !lines[i].includes('*/')) {
          i++;
        }
        continue;
      }
      
      // Section headers (# heading)
      if (trimmedLine.startsWith('#') && !trimmedLine.match(/^#+\d+#$/)) {
        // Skip section headers for now
        continue;
      }
      
      // Scene heading with optional scene number (#1# or #1)
      const sceneNumberMatch = trimmedLine.match(/^#(\d+)#?\s*/);
      let sceneHeading = trimmedLine;
      let explicitSceneNumber: string | null = null;
      
      if (sceneNumberMatch) {
        explicitSceneNumber = sceneNumberMatch[1];
        sceneHeading = trimmedLine.replace(sceneNumberMatch[0], '').trim();
      }
      
      // Scene heading: INT., EXT., INT/EXT, I/E or forced scene heading with .
      const isSceneHeading = 
        sceneHeading.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i) ||
        (sceneHeading.startsWith('.') && !sceneHeading.startsWith('..'));
      
      if (isSceneHeading) {
        // Save previous scene if exists
        if (currentScene) {
          scenes.push(currentScene as SceneBreakdown);
        }
        
        // Remove forced scene heading marker
        if (sceneHeading.startsWith('.')) {
          sceneHeading = sceneHeading.substring(1).trim();
        }
        
        // Parse scene heading
        const intExtMatch = sceneHeading.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i);
        const intExt = intExtMatch ? intExtMatch[1].replace(/\./g, '').replace(/\//g, '/').toUpperCase() : 'INT';
        
        // Extract location and time of day
        const remainder = sceneHeading.replace(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s*/i, '');
        const parts = remainder.split(/\s+-\s+/);
        const locationName = parts[0]?.trim() || 'UNKNOWN';
        const timeOfDay = parts[1]?.trim().toUpperCase() || 'DAY';
        
        currentScene = {
          id: `scene-${Date.now()}-${sceneNumber}`,
          manuscriptId: '',
          projectId: '',
          sceneNumber: explicitSceneNumber || sceneNumber.toString(),
          sceneHeading,
          intExt: intExt as 'INT' | 'EXT' | 'INT/EXT',
          locationName,
          timeOfDay: timeOfDay as SceneBreakdown['timeOfDay'],
          description: '',
          characters: [],
          status: 'not-scheduled',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        sceneNumber++;
        currentCharacter = null;
        continue;
      }
      
      // Transition: FADE TO:, CUT TO:, etc. (all caps ending with TO:)
      if (trimmedLine.match(/^[A-Z\s]+TO:$/) || trimmedLine.startsWith('>') && trimmedLine.endsWith('<')) {
        // Transitions don't create scene elements but could be tracked
        currentCharacter = null;
        continue;
      }
      
      // Centered text (>text<)
      if (trimmedLine.startsWith('>') && trimmedLine.endsWith('<')) {
        // Centered text for montages, etc - skip for now
        continue;
      }
      
      // Page break (===)
      if (trimmedLine === '===' || trimmedLine.match(/^={3,}$/)) {
        pageNumber++;
        continue;
      }
      
      // Lyrics/singing (~lyrics)
      if (trimmedLine.startsWith('~')) {
        // Could be treated as special dialogue
        continue;
      }
      
      // Character name with character extension
      // ALL CAPS possibly followed by (V.O.) or (O.S.) or (CONT'D)
      const characterMatch = trimmedLine.match(/^(@?)([A-Z][A-Z\s0-9'.]+?)(\s*\([^)]+\))?$/);
      
      if (characterMatch && trimmedLine.length > 1 && trimmedLine.length < 50) {
        const forcedCharacter = characterMatch[1] === '@';
        const characterName = characterMatch[2].trim();
        const extension = characterMatch[3]?.trim() || '';
        
        // Check if it's likely a character name (not a transition)
        if (!characterName.match(/^(FADE|CUT|DISSOLVE|SMASH|MATCH|IRIS|WIPE)/)) {
          currentCharacter = characterName;
          characters.add(characterName);
          
          // Check for dual dialogue (^ prefix)
          if (i + 1 < lines.length && lines[i + 1].trim().startsWith('^')) {
            inDualDialogue = true;
            i++; // Skip the ^ line
          }
          
          // Add to current scene's character list
          if (currentScene && !currentScene.characters?.includes(characterName)) {
            currentScene.characters = [...(currentScene.characters || []), characterName];
          }
          
          continue;
        }
      }
      
      // Dialogue (follows character name)
      if (currentCharacter && trimmedLine.length > 0) {
        // Check if it's a parenthetical
        if (trimmedLine.startsWith('(') && trimmedLine.endsWith(')')) {
          // Parenthetical - add to previous dialogue if exists
          if (dialogue.length > 0 && dialogue[dialogue.length - 1].characterName === currentCharacter) {
            dialogue[dialogue.length - 1].parenthetical = trimmedLine;
          }
          continue;
        }
        
        // It's dialogue
        const dialogueLine: DialogueLine = {
          id: `dialogue-${Date.now()}-${lineNumber}`,
          sceneId: currentScene?.id || '',
          manuscriptId: '',
          characterName: currentCharacter,
          dialogueText: trimmedLine,
          dialogueType: 'dialogue', // Note: dual dialogue detected but not distinguished in type
          lineNumber: lineNumber++,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        dialogue.push(dialogueLine);
        
        inDualDialogue = false; // Reset dual dialogue flag
        continue;
      }
      
      // Action/description (forced action starts with !)
      if (trimmedLine.length > 0 && currentScene) {
        let actionText = trimmedLine;
        
        // Remove forced action marker
        if (actionText.startsWith('!')) {
          actionText = actionText.substring(1);
        }
        
        currentScene.description = (currentScene.description || '') + actionText + '\n';
        currentCharacter = null; // Reset character on action line
      }
    }
    
    // Save last scene
    if (currentScene) {
      scenes.push(currentScene as SceneBreakdown);
    }
    
    return { scenes, dialogue, characters };
  }

  /**
   * Parse Fountain title page
   * Returns the character position where the title page ends
   */
  private parseTitlePage(content: string): number {
    const lines = content.split('\n');
    let titlePageEnd = 0;
    let inTitlePage = true;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Title page ends at first empty line followed by non-title-page content
      if (!line) {
        // Check if next non-empty line is title page format
        let nextNonEmpty = i + 1;
        while (nextNonEmpty < lines.length && !lines[nextNonEmpty].trim()) {
          nextNonEmpty++;
        }
        
        if (nextNonEmpty < lines.length) {
          const nextLine = lines[nextNonEmpty].trim();
          // If next line doesn't look like title page (key: value), end title page
          if (!nextLine.match(/^[A-Za-z\s]+:/)) {
            inTitlePage = false;
            titlePageEnd = content.indexOf(lines[i]);
            break;
          }
        }
      }
      
      // Title page format: "Key: Value"
      if (!line.match(/^[A-Za-z\s]+:/) && line.length > 0) {
        inTitlePage = false;
        titlePageEnd = content.indexOf(lines[i]);
        break;
      }
    }
    
    return titlePageEnd;
  }

  /**
   * Parse Markdown format screenplay
   */
  private parseMarkdown(content: string): {
    scenes: SceneBreakdown[];
    dialogue: DialogueLine[];
    characters: Set<string>;
  } {
    // Simplified markdown parser
    // Assumes ## for scene headings, **NAME** for characters
    const scenes: SceneBreakdown[] = [];
    const dialogue: DialogueLine[] = [];
    const characters = new Set<string>();
    
    const lines = content.split('\n');
    let currentScene: Partial<SceneBreakdown> | null = null;
    let sceneNumber = 1;
    
    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (currentScene) {
          scenes.push(currentScene as SceneBreakdown);
        }
        
        const heading = line.replace('## ', '').trim();
        currentScene = {
          id: `scene-${Date.now()}-${sceneNumber}`,
          manuscriptId: '',
          projectId: '',
          sceneNumber: sceneNumber.toString(),
          sceneHeading: heading,
          locationName: heading,
          description: '',
          characters: [],
          status: 'not-scheduled',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        sceneNumber++;
      } else if (line.match(/^\*\*[A-Z\s]+\*\*:/)) {
        const match = line.match(/^\*\*([A-Z\s]+)\*\*:\s*(.+)/);
        if (match) {
          const characterName = match[1].trim();
          const dialogueText = match[2].trim();
          
          characters.add(characterName);
          
          if (currentScene && !currentScene.characters?.includes(characterName)) {
            currentScene.characters = [...(currentScene.characters || []), characterName];
          }
          
          dialogue.push({
            id: `dialogue-${Date.now()}-${dialogue.length}`,
            sceneId: currentScene?.id || '',
            manuscriptId: '',
            characterName,
            dialogueText,
            dialogueType: 'dialogue',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } else if (currentScene && line.trim().length > 0) {
        currentScene.description = (currentScene.description || '') + line + '\n';
      }
    }
    
    if (currentScene) {
      scenes.push(currentScene as SceneBreakdown);
    }
    
    return { scenes, dialogue, characters };
  }

  /**
   * Get acts for a manuscript
   */
  async getActs(manuscriptId: string): Promise<Act[]> {
    const isDbAvailable = await checkDatabaseAvailability();
    
    if (isDbAvailable) {
      try {
        const response = await fetch(`/api/casting/manuscripts/${manuscriptId}/acts`);
        if (!response.ok) {
          throw new Error(`Failed to fetch acts: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Error fetching acts from database:', error);
      }
    }
    
    return await getActsFromStorage(manuscriptId);
  }

  /**
   * Get a single act by ID
   */
  async getAct(actId: string): Promise<Act | null> {
    const isDbAvailable = await checkDatabaseAvailability();
    
    if (isDbAvailable) {
      try {
        const response = await fetch(`/api/casting/acts/${actId}`);
        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error(`Failed to fetch act: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Error fetching act from database:', error);
      }
    }
    
    return null;
  }

  /**
   * Create a new act
   */
  async createAct(act: Act): Promise<Act> {
    const isDbAvailable = await checkDatabaseAvailability();
    
    if (isDbAvailable) {
      try {
        const response = await fetch('/api/casting/acts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(act),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create act: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error creating act in database:', error);
      }
    }
    
    const acts = await getActsFromStorage(act.manuscriptId);
    acts.push(act);
    await saveActsToStorage(act.manuscriptId, acts);
    
    return act;
  }

  /**
   * Update an existing act
   */
  async updateAct(act: Act): Promise<Act> {
    const isDbAvailable = await checkDatabaseAvailability();
    
    if (isDbAvailable) {
      try {
        const response = await fetch(`/api/casting/acts/${act.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(act),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to update act: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error updating act in database:', error);
      }
    }
    
    const acts = await getActsFromStorage(act.manuscriptId);
    const index = acts.findIndex(a => a.id === act.id);
    if (index >= 0) {
      acts[index] = act;
      await saveActsToStorage(act.manuscriptId, acts);
    }
    
    return act;
  }

  /**
   * Delete an act
   */
  async deleteAct(actId: string, manuscriptId: string): Promise<void> {
    const isDbAvailable = await checkDatabaseAvailability();
    
    if (isDbAvailable) {
      try {
        const response = await fetch(`/api/casting/acts/${actId}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          throw new Error(`Failed to delete act: ${response.statusText}`);
        }
        
        return;
      } catch (error) {
        console.error('Error deleting act from database:', error);
      }
    }
    
    const acts = await getActsFromStorage(manuscriptId);
    const filtered = acts.filter(a => a.id !== actId);
    await saveActsToStorage(manuscriptId, filtered);
  }

  /**
   * Calculate script statistics
   */
  calculateStats(manuscript: Manuscript): {
    pageCount: number;
    wordCount: number;
    estimatedRuntime: number;
  } {
    const content = manuscript.content;
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    
    // Industry standard: ~250 words per page, 1 page ≈ 1 minute
    const pageCount = Math.ceil(wordCount / 250);
    const estimatedRuntime = pageCount;
    
    return { pageCount, wordCount, estimatedRuntime };
  }

  /**
   * Auto-link characters from manuscript to existing roles
   * Uses fuzzy matching to find role matches
   */
  async linkCharactersToRoles(
    projectId: string,
    characters: Set<string>
  ): Promise<Map<string, string>> {
    const characterToRoleMap = new Map<string, string>();
    
    const isDbAvailable = await checkDatabaseAvailability();
    if (!isDbAvailable) {
      return characterToRoleMap;
    }
    
    try {
      // Fetch all roles for the project
      const response = await fetch(`/api/casting/projects/${projectId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch project data');
      }
      
      const project = await response.json();
      const roles = project.roles || [];
      
      // Match characters to roles using fuzzy matching
      for (const character of characters) {
        const matchedRole = this.findBestRoleMatch(character, roles);
        if (matchedRole) {
          characterToRoleMap.set(character, matchedRole.id);
        }
      }
      
      return characterToRoleMap;
    } catch (error) {
      console.error('Error linking characters to roles:', error);
      return characterToRoleMap;
    }
  }

  /**
   * Find best matching role for a character name using fuzzy matching
   */
  private findBestRoleMatch(characterName: string, roles: any[]): any | null {
    const cleanCharacter = characterName.toLowerCase().trim();
    
    // Direct match first
    for (const role of roles) {
      const roleName = role.characterName?.toLowerCase().trim() || '';
      if (roleName === cleanCharacter) {
        return role;
      }
    }
    
    // Fuzzy match: check if character name contains role name or vice versa
    for (const role of roles) {
      const roleName = role.characterName?.toLowerCase().trim() || '';
      if (cleanCharacter.includes(roleName) || roleName.includes(cleanCharacter)) {
        return role;
      }
    }
    
    // Check common variations (removing V.O., O.S., CONT'D, etc.)
    const strippedCharacter = cleanCharacter
      .replace(/\s*\(v\.o\.\)\s*/gi, '')
      .replace(/\s*\(o\.s\.\)\s*/gi, '')
      .replace(/\s*\(cont'd\)\s*/gi, '')
      .replace(/\s*\(continuing\)\s*/gi, '')
      .trim();
    
    for (const role of roles) {
      const roleName = role.characterName?.toLowerCase().trim() || '';
      if (roleName === strippedCharacter || strippedCharacter.includes(roleName)) {
        return role;
      }
    }
    
    return null;
  }

  /**
   * Auto-link scene locations to existing locations in database
   */
  async linkLocationsToDatabase(
    projectId: string,
    scenes: SceneBreakdown[]
  ): Promise<Map<string, string>> {
    const sceneToLocationMap = new Map<string, string>();
    
    const isDbAvailable = await checkDatabaseAvailability();
    if (!isDbAvailable) {
      return sceneToLocationMap;
    }
    
    try {
      // Fetch all locations for the project
      const response = await fetch(`/api/casting/projects/${projectId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch project data');
      }
      
      const project = await response.json();
      const locations = project.locations || [];
      
      // Match scene locations to database locations
      for (const scene of scenes) {
        if (!scene.locationName) continue;
        
        const matchedLocation = this.findBestLocationMatch(scene.locationName, locations);
        if (matchedLocation) {
          sceneToLocationMap.set(scene.id, matchedLocation.id);
        }
      }
      
      return sceneToLocationMap;
    } catch (error) {
      console.error('Error linking locations:', error);
      return sceneToLocationMap;
    }
  }

  /**
   * Find best matching location using fuzzy matching
   */
  private findBestLocationMatch(locationName: string, locations: any[]): any | null {
    const cleanLocation = locationName.toLowerCase().trim();
    
    // Direct match first
    for (const location of locations) {
      const dbLocationName = location.locationName?.toLowerCase().trim() || '';
      if (dbLocationName === cleanLocation) {
        return location;
      }
    }
    
    // Fuzzy match
    for (const location of locations) {
      const dbLocationName = location.locationName?.toLowerCase().trim() || '';
      if (cleanLocation.includes(dbLocationName) || dbLocationName.includes(cleanLocation)) {
        return location;
      }
    }
    
    return null;
  }

  /**
   * Extract props mentioned in scene descriptions
   * Returns list of potential props that could be added to database
   */
  extractPropsFromScenes(scenes: SceneBreakdown[]): Set<string> {
    const props = new Set<string>();
    
    // Common prop keywords to look for
    const propKeywords = [
      'gun', 'knife', 'phone', 'laptop', 'car', 'keys', 'wallet', 'bag',
      'camera', 'book', 'letter', 'document', 'briefcase', 'suitcase',
      'bottle', 'glass', 'cup', 'plate', 'food', 'drink',
      'watch', 'ring', 'necklace', 'bracelet', 'jewelry',
      'hat', 'coat', 'jacket', 'sunglasses', 'umbrella',
      'newspaper', 'magazine', 'pen', 'pencil', 'notebook',
      'weapon', 'sword', 'shield', 'bow', 'arrow'
    ];
    
    for (const scene of scenes) {
      const description = scene.description?.toLowerCase() || '';
      
      for (const keyword of propKeywords) {
        if (description.includes(keyword)) {
          props.add(keyword);
        }
      }
    }
    
    return props;
  }

  /**
   * Apply auto-linking results to scenes and dialogue
   */
  async applyAutoLinking(
    projectId: string,
    scenes: SceneBreakdown[],
    dialogue: DialogueLine[],
    characters: Set<string>
  ): Promise<{
    scenes: SceneBreakdown[];
    dialogue: DialogueLine[];
    stats: {
      rolesLinked: number;
      locationsLinked: number;
      propsFound: number;
    };
  }> {
    // Link characters to roles
    const characterToRoleMap = await this.linkCharactersToRoles(projectId, characters);
    
    // Link locations
    const sceneToLocationMap = await this.linkLocationsToDatabase(projectId, scenes);
    
    // Extract props
    const extractedProps = this.extractPropsFromScenes(scenes);
    
    // Apply role linking to dialogue
    const updatedDialogue = dialogue.map(line => ({
      ...line,
      roleId: characterToRoleMap.get(line.characterName) || line.roleId,
    }));
    
    // Apply location linking to scenes
    const updatedScenes = scenes.map(scene => ({
      ...scene,
      locationId: sceneToLocationMap.get(scene.id) || scene.locationId,
      propsNeeded: scene.propsNeeded || Array.from(extractedProps),
    }));
    
    return {
      scenes: updatedScenes,
      dialogue: updatedDialogue,
      stats: {
        rolesLinked: characterToRoleMap.size,
        locationsLinked: sceneToLocationMap.size,
        propsFound: extractedProps.size,
      },
    };
  }

  /**
   * Export complete manuscript with all production data as JSON
   */
  async exportManuscriptAsJSON(
    manuscript: Manuscript,
    acts: Act[],
    scenes: SceneBreakdown[],
    characters: string[],
    dialogueLines: DialogueLine[],
    revisions: ScriptRevision[],
    shotData?: any
  ): Promise<ManuscriptExport> {
    const totalRuntime = scenes.reduce((sum, scene) => sum + (scene.estimatedDuration || 0), 0);

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: 'Manual Export',

      metadata: {
        title: manuscript.title,
        subtitle: manuscript.subtitle || '',
        author: manuscript.author || '',
        format: manuscript.format,
        projectId: manuscript.projectId,
        manuscriptId: manuscript.id,
        createdAt: manuscript.createdAt,
        updatedAt: manuscript.updatedAt,
      },

      manuscript,
      acts,
      scenes,
      characters,
      dialogueLines,

      production: {
        shotDetails: {
          cameras: shotData?.cameras || {},
          lighting: shotData?.lighting || {},
          audio: shotData?.audio || {},
          notes: shotData?.notes || {},
        },
        storyboards: shotData?.storyboards || [],
      },

      revisions,

      statistics: {
        sceneCount: scenes.length,
        characterCount: characters.length,
        estimatedRuntime: totalRuntime,
        shotCount: scenes.reduce((sum, s) => sum + (s.description ? 1 : 0), 0),
      },
    };
  }

  /**
   * Download export as JSON file
   */
  downloadExportAsFile(exportData: ManuscriptExport, filename?: string): void {
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `${exportData.metadata.title.replace(/\s+/g, '_')}_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Validate imported JSON structure
   */
  validateImportData(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required top-level properties
    if (!data.version) errors.push('Missing version field');
    if (!data.metadata) errors.push('Missing metadata');
    if (!data.manuscript) errors.push('Missing manuscript data');
    if (!Array.isArray(data.scenes)) errors.push('Scenes must be an array');
    if (!Array.isArray(data.acts)) errors.push('Acts must be an array');

    // Check metadata structure
    if (data.metadata) {
      if (!data.metadata.title) errors.push('Metadata missing title');
      if (!data.metadata.manuscriptId) errors.push('Metadata missing manuscriptId');
    }

    // Check manuscript structure
    if (data.manuscript) {
      if (!data.manuscript.id) errors.push('Manuscript missing id');
      if (!data.manuscript.title) errors.push('Manuscript missing title');
      if (!data.manuscript.projectId) errors.push('Manuscript missing projectId');
    }

    // Check scenes have required fields
    if (Array.isArray(data.scenes)) {
      data.scenes.forEach((scene: any, index: number) => {
        if (!scene.id) errors.push(`Scene ${index} missing id`);
        if (!scene.sceneNumber) errors.push(`Scene ${index} missing sceneNumber`);
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Import manuscript from JSON file
   */
  async importManuscriptFromJSON(file: File): Promise<{ success: boolean; data?: ManuscriptExport; error?: string }> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate structure
      const validation = this.validateImportData(data);
      if (!validation.valid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse JSON file',
      };
    }
  }

  /**
   * Restore manuscript from exported JSON (creates/updates in state)
   */
  async restoreFromExport(exportData: ManuscriptExport): Promise<{
    manuscript: Manuscript;
    acts: Act[];
    scenes: SceneBreakdown[];
    characters: string[];
    dialogueLines: DialogueLine[];
    revisions: ScriptRevision[];
  }> {
    // Generate new IDs for imported data to avoid conflicts
    const idMap = new Map<string, string>();

    // Map old IDs to new ones
    const newManuscriptId = `ms_${Date.now()}`;
    idMap.set(exportData.manuscript.id, newManuscriptId);

    // Update manuscript with new ID
    const updatedManuscript: Manuscript = {
      ...exportData.manuscript,
      id: newManuscriptId,
      updatedAt: new Date().toISOString(),
    };

    // Update acts with new IDs
    const updatedActs = exportData.acts.map((act) => {
      const newActId = `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      idMap.set(act.id, newActId);
      return {
        ...act,
        id: newActId,
        manuscriptId: newManuscriptId,
      };
    });

    // Update scenes with new IDs
    const updatedScenes = exportData.scenes.map((scene) => {
      const newSceneId = `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      idMap.set(scene.id, newSceneId);
      return {
        ...scene,
        id: newSceneId,
        manuscriptId: newManuscriptId,
        actId: scene.actId ? idMap.get(scene.actId) : undefined,
      };
    });

    // Update dialogue lines with new IDs
    const updatedDialogueLines = exportData.dialogueLines.map((line) => {
      const newLineId = `dialog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return {
        ...line,
        id: newLineId,
        sceneId: idMap.get(line.sceneId) || line.sceneId,
      };
    });

    // Update revisions with new IDs
    const updatedRevisions = exportData.revisions.map((rev) => {
      const newRevId = `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return {
        ...rev,
        id: newRevId,
        manuscriptId: newManuscriptId,
      };
    });

    return {
      manuscript: updatedManuscript,
      acts: updatedActs,
      scenes: updatedScenes,
      characters: exportData.characters,
      dialogueLines: updatedDialogueLines,
      revisions: updatedRevisions,
    };
  }
}

export const manuscriptService = new ManuscriptService();
