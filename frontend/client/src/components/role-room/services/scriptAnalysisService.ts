/**
 * Script Analysis Service
 * 
 * Provides story consistency checks, character conflict detection,
 * and script quality analysis.
 */

// Scene purpose types for tagging
export type ScenePurpose = 
  | 'exposition'
  | 'conflict'
  | 'rising_action'
  | 'climax'
  | 'falling_action'
  | 'resolution'
  | 'transition'
  | 'character_development'
  | 'subplot';

// Act structure
export interface ActStructure {
  actNumber: number;
  name: string;
  startScene: number;
  endScene: number;
  sceneCount: number;
  percentage: number;
}

// Sequence within an act
export interface Sequence {
  id: string;
  name: string;
  actNumber: number;
  scenes: string[];
  purpose?: ScenePurpose;
  description: string;
}

// Enhanced scene info with numbering
export interface NumberedScene {
  number: string;           // Scene number (e.g., "1", "1A", "2")
  heading: string;
  lineNumber: number;
  endLineNumber: number;
  pageNumber: number;
  endPageNumber: number;
  location: string;
  timeOfDay: string;
  intExt: 'INT' | 'EXT' | 'INT/EXT' | 'EST';
  purpose?: ScenePurpose;
  beatMarker?: string;
  characters: string[];
  dialogueLines: number;
  actionLines: number;
  estimatedDuration: number; // in seconds
}

// Character arc tracking
export interface CharacterArc {
  character: string;
  appearances: {
    sceneNumber: string;
    lineNumber: number;
    dialogueCount: number;
    emotionalState?: 'positive' | 'negative' | 'neutral';
    isProtagonist?: boolean;
  }[];
  firstAppearance: number;
  lastAppearance: number;
  totalDialogueLines: number;
  totalDialogueWords: number;
  scenePresence: number; // percentage of scenes
  arcDescription?: string;
}

// Dialogue balance analysis
export interface DialogueBalance {
  character: string;
  totalLines: number;
  totalWords: number;
  averageLineLength: number;
  percentageOfTotal: number;
  longestSpeech: { words: number; lineNumber: number };
  sceneDistribution: { sceneNumber: string; lines: number }[];
}

// Pacing analysis
export interface PacingAnalysis {
  totalPages: number;
  estimatedRuntime: number; // in minutes (1 page ≈ 1 minute)
  dialogueRatio: number; // percentage dialogue vs action
  actionRatio: number;
  sceneLengthVariance: number;
  averageSceneLength: number; // in lines
  pacingIssues: {
    type: 'too_long' | 'too_short' | 'dialogue_heavy' | 'action_heavy';
    sceneNumber: string;
    description: string;
    lineNumber: number;
  }[];
  actPacing: {
    act: number;
    percentage: number;
    idealPercentage: number;
    status: 'short' | 'ideal' | 'long';
  }[];
}

// Script sharing
export interface ScriptShareConfig {
  id: string;
  scriptTitle: string;
  sharedBy: string;
  sharedAt: string;
  expiresAt?: string;
  accessType: 'read-only' | 'comment' | 'suggest';
  password?: string;
  allowDownload: boolean;
  watermark?: string;
  accessLog: { userId: string; accessedAt: string; action: string }[];
}

export interface CharacterMention {
  name: string;
  lineNumber: number;
  context: 'character' | 'dialogue' | 'action' | 'parenthetical';
  variations: string[]; // All name variations found
}

export interface CharacterConflict {
  type: 'name_similar' | 'name_case' | 'name_inconsistent' | 'unused';
  characters: string[];
  description: string;
  severity: 'error' | 'warning' | 'info';
  lineNumbers: number[];
  suggestion?: string;
  confidence?: 'high' | 'medium';
  evidence?: string;
}

export interface ConsistencyIssue {
  type: 'timeline' | 'location' | 'character' | 'prop' | 'continuity';
  description: string;
  lineNumber: number;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
  confidence?: 'high' | 'medium';
  evidence?: string;
}

export interface BeatCard {
  id: string;
  sceneNumber: string;
  heading: string;
  beat: string;
  emotion: 'positive' | 'negative' | 'neutral';
  characters: string[];
  lineNumber: number;
  pageNumber: number;
  color?: string;
  notes?: string;
}

export interface ScriptAnalysisResult {
  characterConflicts: CharacterConflict[];
  consistencyIssues: ConsistencyIssue[];
  beatCards: BeatCard[];
  stats: {
    totalCharacters: number;
    totalScenes: number;
    totalDialogueLines: number;
    avgDialoguePerScene: number;
    longestScene: { number: string; lines: number };
    shortestScene: { number: string; lines: number };
  };
}

// Extended analysis result with all new features
export interface ExtendedScriptAnalysis extends ScriptAnalysisResult {
  numberedScenes: NumberedScene[];
  actStructure: ActStructure[];
  sequences: Sequence[];
  characterArcs: CharacterArc[];
  dialogueBalance: DialogueBalance[];
  pacingAnalysis: PacingAnalysis;
}

// Levenshtein distance for name similarity
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Check if names are similar (potential typo)
function areNamesSimilar(name1: string, name2: string): boolean {
  if (name1 === name2) return false;
  
  const n1 = name1.toUpperCase().trim();
  const n2 = name2.toUpperCase().trim();
  
  // Exact match after normalization
  if (n1 === n2) return true;
  
  // Similar real names are common. Only surface a one-character deviation
  // in names long enough to provide a useful signal, and never infer aliases
  // from substring overlap (ANNA/ANN, ROBERT/ROBERTO, etc.).
  if (Math.min(n1.length, n2.length) < 4 || n1[0] !== n2[0]) return false;
  return levenshteinDistance(n1, n2) === 1;
}

const isTransitionLine = (line: string): boolean =>
  /:\s*$/.test(line) || /\b(CUT TO|FADE|DISSOLVE|SMASH CUT|MATCH CUT|JUMP CUT|KLIPP|TONER UT|OVERTONING|SVART)\b/i.test(line);

const CHARACTER_CUE_PATTERN = /^@?[A-ZÆØÅ][A-ZÆØÅ0-9\s\-'.]*?(?:\s*\([^)]*\))?\s*\^?$/;
const SCENE_HEADING_PATTERN = /^(?:\.)?(?:INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]/i;

const characterCueAt = (lines: string[], index: number): string | null => {
  const line = lines[index]?.trim() ?? '';
  if (!line || !CHARACTER_CUE_PATTERN.test(line) || isTransitionLine(line)) return null;
  const normalized = line.replace(/^@/, '').replace(/\s*\^\s*$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (!normalized) return null;
  if (line.startsWith('@')) return normalized;
  const previousIsBlank = index === 0 || lines[index - 1]?.trim() === '';
  const next = lines[index + 1]?.trim() ?? '';
  if (!previousIsBlank || !next || isTransitionLine(next) || SCENE_HEADING_PATTERN.test(next)) return null;
  return normalized;
};

// Parse Fountain content and extract characters with line numbers
function extractCharacters(content: string): Map<string, CharacterMention[]> {
  const characters = new Map<string, CharacterMention[]>();
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (isTransitionLine(line)) continue;
    const charName = characterCueAt(lines, i);
    const context: 'character' | 'dialogue' | 'action' | 'parenthetical' = 'character';
    
    if (charName) {
      const normalized = charName.toUpperCase();
      if (!characters.has(normalized)) {
        characters.set(normalized, []);
      }
      characters.get(normalized)!.push({
        name: charName,
        lineNumber: i + 1,
        context,
        variations: [],
      });
    }
    
  }
  
  return characters;
}

// Detect character name conflicts
function detectCharacterConflicts(characters: Map<string, CharacterMention[]>): CharacterConflict[] {
  const conflicts: CharacterConflict[] = [];
  const charNames = Array.from(characters.keys());
  
  // Check for similar names (potential typos)
  for (let i = 0; i < charNames.length; i++) {
    for (let j = i + 1; j < charNames.length; j++) {
      if (areNamesSimilar(charNames[i], charNames[j])) {
        const mentions1 = characters.get(charNames[i])!;
        const mentions2 = characters.get(charNames[j])!;
        const cueCount1 = mentions1.filter((mention) => mention.context === 'character').length;
        const cueCount2 = mentions2.filter((mention) => mention.context === 'character').length;
        // A useful typo signal is asymmetric: an established cue and a single
        // one-character variant. Two recurring names may simply be two people.
        if (!((cueCount1 >= 2 && cueCount2 === 1) || (cueCount2 >= 2 && cueCount1 === 1))) {
          continue;
        }
        
        conflicts.push({
          type: 'name_similar',
          characters: [charNames[i], charNames[j]],
          description: `Mulig navnevariant: "${charNames[i]}" og "${charNames[j]}" skiller én bokstav.`,
          severity: 'info',
          lineNumbers: [...mentions1.map(m => m.lineNumber), ...mentions2.map(m => m.lineNumber)],
          suggestion: 'Kontroller mot rollelisten før du eventuelt endrer navnet.',
          confidence: 'medium',
          evidence: `${cueCount1} og ${cueCount2} registrerte karaktermarkører`,
        });
      }
    }
  }
  
  // Check for case inconsistencies
  characters.forEach((mentions, name) => {
    const variations = new Set(mentions.map(m => m.name));
    if (variations.size > 1) {
      conflicts.push({
        type: 'name_case',
        characters: Array.from(variations),
        description: `Karakteren "${name}" brukes med ulik formatering: ${Array.from(variations).join(', ')}`,
        severity: 'info',
        lineNumbers: mentions.map(m => m.lineNumber),
        suggestion: `Bruk konsekvent "${name.toUpperCase()}" for karakternavn`,
        confidence: 'high',
        evidence: 'Samme normaliserte karaktermarkør har flere skrivemåter',
      });
    }
  });
  
  return conflicts;
}

// Extract scenes and create beat cards
function extractBeatCards(content: string): BeatCard[] {
  const beatCards: BeatCard[] = [];
  const lines = content.split('\n');
  
  const SCENE_HEADING = /^(\.)?((INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]+)(.+?)(?:\s*-\s*(DAY|NIGHT|DAWN|DUSK|CONTINUOUS|LATER|MORNING|EVENING|SAME))?$/i;
  
  let currentScene: {
    number: string;
    heading: string;
    startLine: number;
    characters: Set<string>;
    dialogueLines: string[];
    actionLines: string[];
  } | null = null;
  
  let sceneCount = 0;
  let currentCharacter: string | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const sceneMatch = line.match(SCENE_HEADING);
    
    if (sceneMatch) {
      // Save previous scene as beat card
      if (currentScene) {
        beatCards.push(createBeatCard(currentScene, sceneCount));
      }
      
      sceneCount++;
      currentScene = {
        number: `${sceneCount}`,
        heading: line.replace(/^\./, ''),
        startLine: i + 1,
        characters: new Set(),
        dialogueLines: [],
        actionLines: [],
      };
      currentCharacter = null;
    } else if (currentScene) {
      const charName = characterCueAt(lines, i);
      if (charName) {
        currentCharacter = charName;
        currentScene.characters.add(charName);
      } else if (!line) {
        currentCharacter = null;
      } else if (line.startsWith('(') && currentCharacter) {
        // Parentheticals belong to the dialogue block but are not dialogue.
      } else if (currentCharacter) {
        currentScene.dialogueLines.push(line);
      } else if (!/^\[\[/.test(line)) {
        currentScene.actionLines.push(line);
      }
    }
  }
  
  // Don't forget the last scene
  if (currentScene) {
    beatCards.push(createBeatCard(currentScene, sceneCount));
  }
  
  return beatCards;
}

function createBeatCard(scene: {
  number: string;
  heading: string;
  startLine: number;
  characters: Set<string>;
  dialogueLines: string[];
  actionLines: string[];
}, _totalScenes: number): BeatCard {
  // Emotion is only reported when the writer explicitly annotates it. Keyword
  // sentiment cannot reliably describe dramatic intent.
  const emotion: 'positive' | 'negative' | 'neutral' = 'neutral';
  
  // Create a brief beat summary
  const beat = scene.actionLines.slice(0, 2).join(' ').substring(0, 100) || 
               scene.dialogueLines.slice(0, 1).join(' ').substring(0, 100) ||
               'Ingen handling beskrevet';
  
  return {
    id: `beat-${scene.number}`,
    sceneNumber: scene.number,
    heading: scene.heading,
    beat: beat + (beat.length >= 100 ? '...' : ''),
    emotion,
    characters: Array.from(scene.characters),
    lineNumber: scene.startLine,
    pageNumber: Math.ceil(scene.startLine / 55),
    color: '#a78bfa',
    notes: undefined,
  };
}

// Check story consistency
function checkConsistency(content: string): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const lines = content.split('\n');
  
  let lastSceneLine = 0;
  
  const SCENE_HEADING = /^(\.)?((INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]+)(.+?)(?:\s*-\s*(DAY|NIGHT|DAWN|DUSK|CONTINUOUS|LATER|MORNING|EVENING|SAME))?$/i;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const sceneMatch = line.match(SCENE_HEADING);
    
    if (sceneMatch) {
      lastSceneLine = i + 1;
    }
  }
  if (lastSceneLine === 0 && lines.some(line => line.trim().length > 0)) {
    issues.push({
      type: 'continuity',
      description: 'Ingen sceneoverskrifter funnet i manus',
      lineNumber: 1,
      severity: 'info',
      suggestion: 'Legg til INT./EXT.-overskrifter for hver scene',
      confidence: 'high',
      evidence: 'Fant tekst, men ingen gyldige Fountain-sceneoverskrifter',
    });
  }

  return issues;
}

/**
 * Analyze a screenplay for consistency and quality
 */
export function analyzeScript(content: string): ScriptAnalysisResult {
  const characters = extractCharacters(content);
  const characterConflicts = detectCharacterConflicts(characters);
  const consistencyIssues = checkConsistency(content);
  const beatCards = extractBeatCards(content);
  
  // Calculate stats
  const lines = content.split('\n');
  const sceneCount = beatCards.length;
  const totalDialogue = parseNumberedScenes(content)
    .reduce((sum, scene) => sum + scene.dialogueLines, 0);
  
  let longestScene = { number: '0', lines: 0 };
  let shortestScene = { number: '0', lines: Infinity };
  
  for (let i = 0; i < beatCards.length; i++) {
    const nextStart = i < beatCards.length - 1 ? beatCards[i + 1].lineNumber : lines.length;
    const sceneLines = nextStart - beatCards[i].lineNumber;
    
    if (sceneLines > longestScene.lines) {
      longestScene = { number: beatCards[i].sceneNumber, lines: sceneLines };
    }
    if (sceneLines < shortestScene.lines) {
      shortestScene = { number: beatCards[i].sceneNumber, lines: sceneLines };
    }
  }
  
  if (shortestScene.lines === Infinity) {
    shortestScene = { number: '0', lines: 0 };
  }
  
  return {
    characterConflicts,
    consistencyIssues,
    beatCards,
    stats: {
      totalCharacters: characters.size,
      totalScenes: sceneCount,
      totalDialogueLines: totalDialogue,
      avgDialoguePerScene: sceneCount > 0 ? Math.round(totalDialogue / sceneCount * 10) / 10 : 0,
      longestScene,
      shortestScene,
    },
  };
}

/**
 * Parse scenes with numbering
 */
export function parseNumberedScenes(content: string): NumberedScene[] {
  const lines = content.split('\n');
  const scenes: NumberedScene[] = [];
  
  const SCENE_HEADING = /^(\.)?((INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]+)(.+?)(?:\s*-\s*(DAY|NIGHT|DAWN|DUSK|CONTINUOUS|LATER|MORNING|EVENING|SAME))?$/i;
  
  let currentScene: Partial<NumberedScene> | null = null;
  let sceneCount = 0;
  let currentCharacter: string | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const sceneMatch = line.match(SCENE_HEADING);
    
    if (sceneMatch) {
      // Save previous scene
      if (currentScene) {
        currentScene.endLineNumber = i;
        currentScene.endPageNumber = Math.ceil(i / 55);
        scenes.push(currentScene as NumberedScene);
      }
      
      sceneCount++;
      const location = sceneMatch[4]?.trim() || '';
      const timeOfDay = sceneMatch[5]?.toUpperCase() || '';
      const rawIntExt = sceneMatch[3].toUpperCase().replace(/\./g, '');
      const intExt: NumberedScene['intExt'] = rawIntExt === 'I/E' || rawIntExt === 'INT/EXT'
        ? 'INT/EXT'
        : rawIntExt as NumberedScene['intExt'];
      
      currentScene = {
        number: `${sceneCount}`,
        heading: line.replace(/^\./, ''),
        lineNumber: i + 1,
        endLineNumber: i + 1,
        pageNumber: Math.ceil((i + 1) / 55),
        endPageNumber: Math.ceil((i + 1) / 55),
        location,
        timeOfDay,
        intExt,
        characters: [],
        dialogueLines: 0,
        actionLines: 0,
        estimatedDuration: 0,
      };
      currentCharacter = null;
    } else if (currentScene) {
      // Check for character cue
      const charName = characterCueAt(lines, i);
      if (charName) {
        currentCharacter = charName;
        if (!currentScene.characters!.includes(charName)) {
          currentScene.characters!.push(charName);
        }
      } else if (line && !line.startsWith('(') && currentCharacter) {
        currentScene.dialogueLines!++;
      } else if (line && !line.startsWith('(') && !currentCharacter) {
        currentScene.actionLines!++;
      } else if (line === '') {
        currentCharacter = null;
      }
    }
  }
  
  // Don't forget the last scene
  if (currentScene) {
    currentScene.endLineNumber = lines.length;
    currentScene.endPageNumber = Math.ceil(lines.length / 55);
    scenes.push(currentScene as NumberedScene);
  }
  
  // Calculate estimated duration (rough: 1 line ≈ 2 seconds for dialogue, 1 second for action)
  scenes.forEach(scene => {
    scene.estimatedDuration = (scene.dialogueLines * 2) + scene.actionLines;
  });
  
  return scenes;
}

/**
 * Determine act structure (3-act by default)
 */
export function analyzeActStructure(scenes: NumberedScene[], actCount: number = 3): ActStructure[] {
  const totalScenes = scenes.length;
  if (totalScenes === 0) return [];
  
  // Standard 3-act structure: 25% / 50% / 25%
  const actBreaks = actCount === 3 
    ? [0.25, 0.75, 1.0]
    : actCount === 5
    ? [0.12, 0.25, 0.50, 0.75, 1.0]
    : Array.from({ length: actCount }, (_, i) => (i + 1) / actCount);
  
  const actNames = actCount === 3
    ? ['Oppsett', 'Konfrontasjon', 'Løsning']
    : actCount === 5
    ? ['Eksposisjon', 'Stigende handling', 'Klimaks', 'Fallende handling', 'Løsning']
    : Array.from({ length: actCount }, (_, i) => `Akt ${i + 1}`);
  
  const acts: ActStructure[] = [];
  let prevEnd = 0;
  
  for (let i = 0; i < actCount; i++) {
    const endScene = Math.round(actBreaks[i] * totalScenes);
    const startScene = prevEnd + 1;
    const sceneCount = endScene - prevEnd;
    
    acts.push({
      actNumber: i + 1,
      name: actNames[i],
      startScene,
      endScene,
      sceneCount,
      percentage: Math.round((sceneCount / totalScenes) * 100),
    });
    
    prevEnd = endScene;
  }
  
  return acts;
}

/**
 * Auto-detect scene purpose based on content analysis
 * Uses the comprehensive word bank with learning capabilities
 */
export function detectScenePurpose(
  scene: NumberedScene,
  _sceneIndex: number,
  _totalScenes: number,
  content: string,
): ScenePurpose | undefined {
  const lines = content.split('\n').slice(scene.lineNumber - 1, scene.endLineNumber);
  const marker = lines.join('\n').match(
    /\[\[(?:scene\s*purpose|purpose|sceneformål|formål)\s*:\s*([^\]]+)\]\]/i,
  );
  if (!marker) return undefined;
  const normalized = marker[1].trim().toLowerCase().replace(/[ -]+/g, '_');
  const aliases: Record<string, ScenePurpose> = {
    exposition: 'exposition', eksposisjon: 'exposition',
    conflict: 'conflict', konflikt: 'conflict',
    rising_action: 'rising_action', stigende_handling: 'rising_action',
    climax: 'climax', klimaks: 'climax',
    falling_action: 'falling_action', fallende_handling: 'falling_action',
    resolution: 'resolution', løsning: 'resolution', losning: 'resolution',
    transition: 'transition', overgang: 'transition',
    character_development: 'character_development', karakterutvikling: 'character_development',
    subplot: 'subplot', subplott: 'subplot',
  };
  return aliases[normalized];
}

/**
 * Analyze character arcs throughout the script
 */
export function analyzeCharacterArcs(content: string, scenes: NumberedScene[]): CharacterArc[] {
  const characterData = new Map<string, CharacterArc>();
  const lines = content.split('\n');
  
  scenes.forEach((scene) => {
    const sceneLines = lines.slice(scene.lineNumber - 1, scene.endLineNumber);
    let currentCharacter: string | null = null;
    let dialogueCount = 0;
    
    sceneLines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      
      // Check for character cue
      const globalIndex = scene.lineNumber - 1 + lineIdx;
      const charName = characterCueAt(lines, globalIndex);
      if (charName) {
          // Save previous character's dialogue count
          if (currentCharacter && dialogueCount > 0) {
            updateCharacterArc(characterData, currentCharacter, scene, dialogueCount);
          }
          currentCharacter = charName;
          dialogueCount = 0;
      } else if (trimmed && !trimmed.startsWith('(') && currentCharacter) {
        dialogueCount++;
      } else if (trimmed === '') {
        if (currentCharacter && dialogueCount > 0) {
          updateCharacterArc(characterData, currentCharacter, scene, dialogueCount);
        }
        currentCharacter = null;
        dialogueCount = 0;
      }
    });
    
    // Don't forget last character in scene
    if (currentCharacter && dialogueCount > 0) {
      updateCharacterArc(characterData, currentCharacter, scene, dialogueCount);
    }
  });
  
  // Calculate final statistics
  const arcs = Array.from(characterData.values());
  const totalScenes = scenes.length;
  
  arcs.forEach(arc => {
    arc.scenePresence = Math.round((arc.appearances.length / totalScenes) * 100);
    arc.firstAppearance = arc.appearances[0]?.lineNumber || 0;
    arc.lastAppearance = arc.appearances[arc.appearances.length - 1]?.lineNumber || 0;
  });
  
  return arcs.sort((a, b) => b.totalDialogueLines - a.totalDialogueLines);
}

function updateCharacterArc(
  characterData: Map<string, CharacterArc>,
  charName: string,
  scene: NumberedScene,
  dialogueCount: number,
) {
  if (!characterData.has(charName)) {
    characterData.set(charName, {
      character: charName,
      appearances: [],
      firstAppearance: 0,
      lastAppearance: 0,
      totalDialogueLines: 0,
      totalDialogueWords: 0,
      scenePresence: 0,
    });
  }
  
  const arc = characterData.get(charName)!;
  arc.appearances.push({
    sceneNumber: scene.number,
    lineNumber: scene.lineNumber,
    dialogueCount,
  });
  arc.totalDialogueLines += dialogueCount;
}

/**
 * Analyze dialogue balance between characters
 */
export function analyzeDialogueBalance(content: string, scenes: NumberedScene[]): DialogueBalance[] {
  const characterDialogue = new Map<string, {
    lines: number;
    words: number;
    lineLengths: number[];
    longestSpeech: { words: number; lineNumber: number };
    sceneDistribution: Map<string, number>;
  }>();
  
  const lines = content.split('\n');
  let currentCharacter: string | null = null;
  let currentSpeechWords = 0;
  let currentSpeechStart = 0;
  let currentScene = '1';
  
  scenes.forEach(scene => {
    currentScene = scene.number;
    const sceneLines = lines.slice(scene.lineNumber - 1, scene.endLineNumber);
    
    sceneLines.forEach((line, idx) => {
      const trimmed = line.trim();
      const globalLineNum = scene.lineNumber + idx;
      
      // Check for character cue
      const globalIndex = scene.lineNumber - 1 + idx;
      const charName = characterCueAt(lines, globalIndex);
      if (charName) {
          // Save previous character's speech
          if (currentCharacter && currentSpeechWords > 0) {
            saveSpeech(characterDialogue, currentCharacter, currentSpeechWords, currentSpeechStart, currentScene);
          }
          currentCharacter = charName;
          currentSpeechWords = 0;
          currentSpeechStart = globalLineNum;
          
          if (!characterDialogue.has(charName)) {
            characterDialogue.set(charName, {
              lines: 0,
              words: 0,
              lineLengths: [],
              longestSpeech: { words: 0, lineNumber: 0 },
              sceneDistribution: new Map(),
            });
          }
      } else if (trimmed && !trimmed.startsWith('(') && currentCharacter) {
        const data = characterDialogue.get(currentCharacter)!;
        const wordCount = trimmed.split(/\s+/).length;
        data.lines++;
        data.words += wordCount;
        data.lineLengths.push(wordCount);
        currentSpeechWords += wordCount;
        
        // Update scene distribution
        const sceneCount = data.sceneDistribution.get(currentScene) || 0;
        data.sceneDistribution.set(currentScene, sceneCount + 1);
      } else if (trimmed === '') {
        if (currentCharacter && currentSpeechWords > 0) {
          saveSpeech(characterDialogue, currentCharacter, currentSpeechWords, currentSpeechStart, currentScene);
        }
        currentCharacter = null;
        currentSpeechWords = 0;
      }
    });
  });
  
  // Calculate final balance
  const totalLines = Array.from(characterDialogue.values()).reduce((sum, d) => sum + d.lines, 0);
  
  return Array.from(characterDialogue.entries()).map(([char, data]) => ({
    character: char,
    totalLines: data.lines,
    totalWords: data.words,
    averageLineLength: data.lineLengths.length > 0 
      ? Math.round(data.words / data.lineLengths.length * 10) / 10 
      : 0,
    percentageOfTotal: totalLines > 0 ? Math.round((data.lines / totalLines) * 100) : 0,
    longestSpeech: data.longestSpeech,
    sceneDistribution: Array.from(data.sceneDistribution.entries()).map(([sn, lines]) => ({
      sceneNumber: sn,
      lines,
    })),
  })).sort((a, b) => b.totalLines - a.totalLines);
}

function saveSpeech(
  characterDialogue: Map<string, any>,
  charName: string,
  speechWords: number,
  lineNumber: number,
  currentScene: string
) {
  const data = characterDialogue.get(charName);
  if (data && speechWords > data.longestSpeech.words) {
    data.longestSpeech = { words: speechWords, lineNumber };
  }
  if (data && !data.sceneDistribution.has(currentScene)) {
    data.sceneDistribution.set(currentScene, 0);
  }
}

/**
 * Analyze pacing and runtime
 */
export function analyzePacing(content: string, scenes: NumberedScene[]): PacingAnalysis {
  const lines = content.split('\n');
  const totalLines = lines.length;
  const totalPages = Math.ceil(totalLines / 55);
  const estimatedRuntime = totalPages; // 1 page ≈ 1 minute
  
  let totalDialogueLines = 0;
  let totalActionLines = 0;
  const sceneLengths: number[] = [];
  // Length and dialogue ratios are measurements, not defects. A short silent
  // scene or a dialogue-heavy scene can be entirely intentional, so this
  // deterministic pass does not label them as pacing problems.
  const pacingIssues: PacingAnalysis['pacingIssues'] = [];
  
  scenes.forEach(scene => {
    totalDialogueLines += scene.dialogueLines;
    totalActionLines += scene.actionLines;
    const sceneLength = scene.endLineNumber - scene.lineNumber;
    sceneLengths.push(sceneLength);
    
  });
  
  const totalContentLines = totalDialogueLines + totalActionLines;
  const dialogueRatio = totalContentLines > 0 ? Math.round((totalDialogueLines / totalContentLines) * 100) : 0;
  
  // Calculate variance
  const avgLength = sceneLengths.length > 0 
    ? sceneLengths.reduce((a, b) => a + b, 0) / sceneLengths.length 
    : 0;
  const variance = sceneLengths.length > 0
    ? Math.sqrt(sceneLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / sceneLengths.length)
    : 0;
  
  // Do not invent a three-act model. The structure panel only shows acts when
  // the writer has explicitly marked them in the Fountain source.
  const actPacing: PacingAnalysis['actPacing'] = [];
  
  return {
    totalPages,
    estimatedRuntime,
    dialogueRatio,
    actionRatio: 100 - dialogueRatio,
    sceneLengthVariance: Math.round(variance),
    averageSceneLength: Math.round(avgLength),
    pacingIssues,
    actPacing,
  };
}

function analyzeExplicitActStructure(content: string, scenes: NumberedScene[]): ActStructure[] {
  if (scenes.length === 0) return [];
  const markers = content.split('\n').flatMap((rawLine, index) => {
    const match = rawLine.trim().match(/^#+\s*(?:AKT|ACT)\s+([^\s:#-]+)(?:\s*[-:]\s*(.+))?$/i);
    return match ? [{ lineNumber: index + 1, label: match[2]?.trim() || '' }] : [];
  });
  return markers.flatMap((marker, markerIndex) => {
    const startIndex = scenes.findIndex((scene) => scene.lineNumber > marker.lineNumber);
    if (startIndex < 0) return [];
    const nextMarker = markers[markerIndex + 1];
    const nextStart = nextMarker
      ? scenes.findIndex((scene) => scene.lineNumber > nextMarker.lineNumber)
      : scenes.length;
    const endExclusive = nextStart < 0 ? scenes.length : nextStart;
    const sceneCount = Math.max(0, endExclusive - startIndex);
    if (sceneCount === 0) return [];
    return [{
      actNumber: markerIndex + 1,
      name: marker.label || `Akt ${markerIndex + 1}`,
      startScene: startIndex + 1,
      endScene: endExclusive,
      sceneCount,
      percentage: Math.round((sceneCount / scenes.length) * 100),
    }];
  });
}

function analyzeExplicitSequences(
  content: string,
  scenes: NumberedScene[],
  acts: ActStructure[],
): Sequence[] {
  const markers = content.split('\n').flatMap((rawLine, index) => {
    const match = rawLine.trim().match(/^#{2,}\s*(?:SEKVENS|SEQUENCE)\s*[:#-]?\s*(.*)$/i);
    return match ? [{ lineNumber: index + 1, label: match[1]?.trim() || '' }] : [];
  });
  return markers.flatMap((marker, markerIndex) => {
    const startIndex = scenes.findIndex((scene) => scene.lineNumber > marker.lineNumber);
    if (startIndex < 0) return [];
    const nextMarker = markers[markerIndex + 1];
    const nextStart = nextMarker
      ? scenes.findIndex((scene) => scene.lineNumber > nextMarker.lineNumber)
      : scenes.length;
    const endExclusive = nextStart < 0 ? scenes.length : nextStart;
    const sequenceScenes = scenes.slice(startIndex, endExclusive);
    if (sequenceScenes.length === 0) return [];
    const firstSceneNumber = startIndex + 1;
    const act = acts.find((candidate) =>
      firstSceneNumber >= candidate.startScene && firstSceneNumber <= candidate.endScene,
    );
    return [{
      id: `sequence-${markerIndex + 1}`,
      name: marker.label || `Sekvens ${markerIndex + 1}`,
      actNumber: act?.actNumber ?? 0,
      scenes: sequenceScenes.map((scene) => scene.number),
      purpose: sequenceScenes[0]?.purpose,
      description: '',
    }];
  });
}

/**
 * Generate share configuration for script
 */
export function createShareConfig(
  scriptTitle: string,
  sharedBy: string,
  options: Partial<ScriptShareConfig> = {}
): ScriptShareConfig {
  return {
    id: `share-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    scriptTitle,
    sharedBy,
    sharedAt: new Date().toISOString(),
    expiresAt: options.expiresAt,
    accessType: options.accessType || 'read-only',
    password: options.password,
    allowDownload: options.allowDownload ?? false,
    watermark: options.watermark,
    accessLog: [],
  };
}

/**
 * Extended analysis with all new features
 */
export function analyzeScriptExtended(content: string): ExtendedScriptAnalysis {
  const baseAnalysis = analyzeScript(content);
  const numberedScenes = parseNumberedScenes(content);
  
  // Add purpose detection to scenes
  numberedScenes.forEach((scene, idx) => {
    scene.purpose = detectScenePurpose(scene, idx, numberedScenes.length, content);
  });
  const actStructure = analyzeExplicitActStructure(content, numberedScenes);
  const sequences = analyzeExplicitSequences(content, numberedScenes, actStructure);
  
  return {
    ...baseAnalysis,
    numberedScenes,
    actStructure,
    sequences,
    characterArcs: analyzeCharacterArcs(content, numberedScenes),
    dialogueBalance: analyzeDialogueBalance(content, numberedScenes),
    pacingAnalysis: analyzePacing(content, numberedScenes),
  };
}

/**
 * Get text-to-speech voice for a character
 */
export function getCharacterVoice(characterName: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  
  const voices = window.speechSynthesis.getVoices();
  
  // Try to get Norwegian voices first
  const norwegianVoices = voices.filter(v => v.lang.startsWith('nb') || v.lang.startsWith('no'));
  const englishVoices = voices.filter(v => v.lang.startsWith('en'));
  
  // Simple hash to consistently assign voices to characters
  const hash = characterName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  if (norwegianVoices.length > 0) {
    return norwegianVoices[hash % norwegianVoices.length];
  }
  if (englishVoices.length > 0) {
    return englishVoices[hash % englishVoices.length];
  }
  
  return voices[hash % voices.length] || null;
}

/**
 * Speak text using TTS
 */
export function speakText(
  text: string, 
  voice?: SpeechSynthesisVoice | null,
  rate: number = 1,
  pitch: number = 1
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      reject(new Error('Text-to-speech not supported'));
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) utterance.voice = voice;
    utterance.rate = rate;
    utterance.pitch = pitch;
    
    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(e);
    
    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Stop all TTS
 */
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export const scriptAnalysisService = {
  analyzeScript,
  analyzeScriptExtended,
  parseNumberedScenes,
  analyzeActStructure,
  detectScenePurpose,
  analyzeCharacterArcs,
  analyzeDialogueBalance,
  analyzePacing,
  createShareConfig,
  getCharacterVoice,
  speakText,
  stopSpeaking,
};

export default scriptAnalysisService;
