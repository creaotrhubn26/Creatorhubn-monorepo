/**
 * Script Analysis Service
 * 
 * Provides story consistency checks, character conflict detection,
 * and script quality analysis.
 */

// Import word bank service for scene purpose detection
import { scriptWordBank } from './scriptWordBank';

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
  purpose: ScenePurpose;
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
}

export interface ConsistencyIssue {
  type: 'timeline' | 'location' | 'character' | 'prop' | 'continuity';
  description: string;
  lineNumber: number;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
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
  
  // One is substring of other
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  // Levenshtein distance <= 2 for short names, <= 3 for longer
  const maxDist = Math.min(n1.length, n2.length) <= 5 ? 2 : 3;
  return levenshteinDistance(n1, n2) <= maxDist;
}

// Parse Fountain content and extract characters with line numbers
function extractCharacters(content: string): Map<string, CharacterMention[]> {
  const characters = new Map<string, CharacterMention[]>();
  const lines = content.split('\n');
  
  const CHARACTER_PATTERN = /^[A-ZÆØÅ][A-ZÆØÅ0-9\s\-'\.]*(\s*\(.*\))?$/;
  const FORCED_CHARACTER = /^@(.+)$/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check for character cue
    let charName: string | null = null;
    let context: 'character' | 'dialogue' | 'action' | 'parenthetical' = 'character';
    
    const forcedMatch = line.match(FORCED_CHARACTER);
    if (forcedMatch) {
      charName = forcedMatch[1].replace(/\s*\(.*\)$/, '').trim();
    } else if (CHARACTER_PATTERN.test(line) && line.length > 0) {
      // Check if previous line is blank (character cue follows blank line)
      if (i === 0 || lines[i - 1].trim() === '') {
        charName = line.replace(/\s*\(.*\)$/, '').trim();
      }
    }
    
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
    
    // Also check for character mentions in action lines
    // (Names in ALL CAPS within action text)
    if (!charName && line.length > 0 && !line.startsWith('INT') && !line.startsWith('EXT')) {
      const capsMatches = line.match(/\b[A-ZÆØÅ][A-ZÆØÅ]+\b/g);
      if (capsMatches) {
        capsMatches.forEach(match => {
          if (match.length > 2 && !['INT', 'EXT', 'DAY', 'NIGHT', 'DAWN', 'DUSK', 'THE', 'AND', 'BUT', 'FOR'].includes(match)) {
            const normalized = match.toUpperCase();
            if (!characters.has(normalized)) {
              characters.set(normalized, []);
            }
            characters.get(normalized)!.push({
              name: match,
              lineNumber: i + 1,
              context: 'action',
              variations: [],
            });
          }
        });
      }
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
        
        conflicts.push({
          type: 'name_similar',
          characters: [charNames[i], charNames[j]],
          description: `"${charNames[i]}" og "${charNames[j]}" er svært like - er dette samme person?`,
          severity: 'warning',
          lineNumbers: [...mentions1.map(m => m.lineNumber), ...mentions2.map(m => m.lineNumber)],
          suggestion: `Vurder å bruke konsekvent "${charNames[i]}" eller "${charNames[j]}"`,
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
      });
    }
  });
  
  // Check for characters only mentioned once (potential typo or unused)
  characters.forEach((mentions, name) => {
    const characterCues = mentions.filter(m => m.context === 'character');
    if (characterCues.length === 1 && mentions.length <= 2) {
      conflicts.push({
        type: 'unused',
        characters: [name],
        description: `Karakteren "${name}" nevnes kun ${mentions.length} gang(er) - er dette tilsiktet?`,
        severity: 'info',
        lineNumbers: mentions.map(m => m.lineNumber),
        suggestion: 'Vurder om dette er en skrivefeil eller fjern karakteren',
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
    } else if (currentScene) {
      // Check for character cue
      if (/^[A-ZÆØÅ][A-ZÆØÅ0-9\s\-'\.]*(\s*\(.*\))?$/.test(line) && line.length > 0) {
        const charName = line.replace(/\s*\(.*\)$/, '').trim();
        if (charName && (i === 0 || lines[i - 1].trim() === '')) {
          currentScene.characters.add(charName);
        }
      } else if (line && !line.startsWith('(')) {
        // Dialogue or action
        if (currentScene.characters.size > 0 && lines[i - 1]?.trim() !== '') {
          currentScene.dialogueLines.push(line);
        } else {
          currentScene.actionLines.push(line);
        }
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
}, totalScenes: number): BeatCard {
  // Determine emotion based on keywords in dialogue/action
  const allText = [...scene.dialogueLines, ...scene.actionLines].join(' ').toLowerCase();
  let emotion: 'positive' | 'negative' | 'neutral' = 'neutral';
  
  const positiveWords = ['happy', 'joy', 'love', 'laugh', 'smile', 'hope', 'glad', 'glede', 'kjærlighet', 'håp'];
  const negativeWords = ['angry', 'sad', 'fear', 'death', 'kill', 'hate', 'cry', 'sint', 'trist', 'frykt', 'død', 'drep', 'hat', 'gråt'];
  
  const positiveCount = positiveWords.filter(w => allText.includes(w)).length;
  const negativeCount = negativeWords.filter(w => allText.includes(w)).length;
  
  if (positiveCount > negativeCount) emotion = 'positive';
  else if (negativeCount > positiveCount) emotion = 'negative';
  
  // Create a brief beat summary
  const beat = scene.actionLines.slice(0, 2).join(' ').substring(0, 100) || 
               scene.dialogueLines.slice(0, 1).join(' ').substring(0, 100) ||
               'Ingen handling beskrevet';
  
  const positionNote = totalScenes > 0
    ? `Scene ${scene.number} av ${totalScenes}`
    : undefined;

  return {
    id: `beat-${scene.number}`,
    sceneNumber: scene.number,
    heading: scene.heading,
    beat: beat + (beat.length >= 100 ? '...' : ''),
    emotion,
    characters: Array.from(scene.characters),
    lineNumber: scene.startLine,
    pageNumber: Math.ceil(scene.startLine / 55),
    color: emotion === 'positive' ? '#4ade80' : emotion === 'negative' ? '#f87171' : '#a78bfa',
    notes: positionNote,
  };
}

// Check story consistency
function checkConsistency(content: string): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const lines = content.split('\n');
  
  // Track timeline mentions
  let lastTimeOfDay: string | null = null;
  let lastSceneLine = 0;
  
  const SCENE_HEADING = /^(\.)?((INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]+)(.+?)(?:\s*-\s*(DAY|NIGHT|DAWN|DUSK|CONTINUOUS|LATER|MORNING|EVENING|SAME))?$/i;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const sceneMatch = line.match(SCENE_HEADING);
    
    if (sceneMatch) {
      const timeOfDay = sceneMatch[5]?.toUpperCase();
      
      // Check for suspicious timeline jumps
      if (lastTimeOfDay && timeOfDay) {
        const timeDiffs: { [key: string]: number } = {
          'DAWN': 0, 'MORNING': 1, 'DAY': 2, 'DUSK': 3, 'EVENING': 4, 'NIGHT': 5
        };
        
        const lastTime = timeDiffs[lastTimeOfDay] ?? -1;
        const currentTime = timeDiffs[timeOfDay] ?? -1;
        
        if (lastTime !== -1 && currentTime !== -1) {
          // Big jump backwards without CONTINUOUS or LATER
          if (currentTime < lastTime - 1 && !['CONTINUOUS', 'LATER', 'SAME'].includes(timeOfDay)) {
            issues.push({
              type: 'timeline',
              description: `Tidslinje-hopp fra ${lastTimeOfDay} til ${timeOfDay} uten overgang`,
              lineNumber: i + 1,
              severity: 'warning',
              suggestion: 'Vurder å legge til en overgangscene eller bruk "CONTINUOUS" / "LATER"',
            });
          }
        }
      }
      
      lastTimeOfDay = timeOfDay || lastTimeOfDay;
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
  const totalDialogue = beatCards.reduce((sum, b) => sum + b.characters.length, 0);
  
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
      const intExt = sceneMatch[3].toUpperCase().replace('.', '').replace('/', '') as 'INT' | 'EXT' | 'INT/EXT' | 'EST';
      const location = sceneMatch[4]?.trim() || '';
      const timeOfDay = sceneMatch[5]?.toUpperCase() || 'DAY';
      
      currentScene = {
        number: `${sceneCount}`,
        heading: line.replace(/^\./, ''),
        lineNumber: i + 1,
        endLineNumber: i + 1,
        pageNumber: Math.ceil((i + 1) / 55),
        endPageNumber: Math.ceil((i + 1) / 55),
        location,
        timeOfDay,
        intExt: intExt.includes('/') ? 'INT/EXT' : intExt as NumberedScene['intExt'],
        characters: [],
        dialogueLines: 0,
        actionLines: 0,
        estimatedDuration: 0,
      };
      currentCharacter = null;
    } else if (currentScene) {
      // Check for character cue
      if (/^@?[A-ZÆØÅ][A-ZÆØÅ0-9\s\-'\.]*(\s*\(.*\))?$/.test(line) && line.length > 0) {
        const charName = line.replace(/^@/, '').replace(/\s*\(.*\)$/, '').trim();
        if (charName && (i === 0 || lines[i - 1].trim() === '')) {
          currentCharacter = charName;
          if (!currentScene.characters!.includes(charName)) {
            currentScene.characters!.push(charName);
          }
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
export function detectScenePurpose(scene: NumberedScene, sceneIndex: number, totalScenes: number, content: string): ScenePurpose {
  const position = sceneIndex / totalScenes;
  const lines = content.split('\n').slice(scene.lineNumber - 1, scene.endLineNumber);
  const text = lines.join(' ');
  
  // Use the word bank service for intelligent detection
  try {
    const analysis = scriptWordBank.detectScenePurpose(text);
    
    // If confidence is high enough, use word bank detection
    if (analysis.confidence > 0.3 && analysis.matches.length >= 2) {
      // Validate the purpose is a valid ScenePurpose type
      const validPurposes: ScenePurpose[] = [
        'exposition', 'conflict', 'rising_action', 'climax',
        'falling_action', 'resolution', 'transition',
        'character_development', 'subplot'
      ];
      
      if (validPurposes.includes(analysis.purpose as ScenePurpose)) {
        return analysis.purpose as ScenePurpose;
      }
    }
  } catch (e) {
    // Fall back to simple detection if word bank not available
    console.warn('Word bank not available, using fallback detection');
  }
  
  // Fallback: Simple keyword analysis for when word bank isn't loaded
  const lowerText = text.toLowerCase();
  const conflictWords = ['fight', 'argue', 'angry', 'attack', 'confront', 'slår', 'kamp', 'sint', 'angriper', 'krangler', 'trussel'];
  const climaxWords = ['final', 'showdown', 'reveal', 'truth', 'avsløring', 'sannhet', 'endelig', 'oppgjør', 'vendepunkt', 'confession'];
  const expositionWords = ['introduce', 'meet', 'first', 'begin', 'start', 'møter', 'først', 'begynner', 'establishing', 'voiceover'];
  const resolutionWords = ['peace', 'resolve', 'end', 'together', 'happy', 'fred', 'løsning', 'slutt', 'sammen', 'epilogue', 'reconcile'];
  const risingWords = ['tension', 'escalate', 'complication', 'obstacle', 'urgent', 'deadline', 'danger', 'risk', 'spenning', 'fare'];
  const fallingWords = ['aftermath', 'consequence', 'reflect', 'calm', 'settle', 'etterspill', 'konsekvens', 'roer seg'];
  const transitionWords = ['later', 'meanwhile', 'cut to', 'fade', 'montage', 'senere', 'i mellomtiden', 'kontinuerlig'];
  
  const hasConflict = conflictWords.some(w => lowerText.includes(w));
  const hasClimax = climaxWords.some(w => lowerText.includes(w));
  const hasExposition = expositionWords.some(w => lowerText.includes(w));
  const hasResolution = resolutionWords.some(w => lowerText.includes(w));
  const hasRising = risingWords.some(w => lowerText.includes(w));
  const hasFalling = fallingWords.some(w => lowerText.includes(w));
  const hasTransition = transitionWords.some(w => lowerText.includes(w));
  
  // Priority-based detection with position context
  if (hasTransition) return 'transition';
  if (hasClimax && position > 0.4 && position < 0.7) return 'climax';
  if (hasConflict) return 'conflict';
  if (hasExposition && position < 0.25) return 'exposition';
  if (hasResolution && position > 0.8) return 'resolution';
  if (hasFalling && position > 0.6) return 'falling_action';
  if (hasRising && position > 0.15 && position < 0.7) return 'rising_action';
  
  // Position-based defaults when no keywords match
  if (position < 0.1) return 'exposition';
  if (position > 0.9) return 'resolution';
  if (position > 0.75 && position <= 0.9) return 'falling_action';
  if (position > 0.45 && position < 0.55) return 'climax';
  if (position > 0.25 && position <= 0.75) return 'rising_action';
  
  return 'character_development';
}

/**
 * Analyze character arcs throughout the script
 */
export function analyzeCharacterArcs(content: string, scenes: NumberedScene[]): CharacterArc[] {
  const characterData = new Map<string, CharacterArc>();
  const lines = content.split('\n');
  
  scenes.forEach((scene, sceneIdx) => {
    const sceneLines = lines.slice(scene.lineNumber - 1, scene.endLineNumber);
    const isEarlyScene = sceneIdx < Math.max(1, Math.round(scenes.length * 0.2));
    let currentCharacter: string | null = null;
    let dialogueCount = 0;
    
    sceneLines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      
      // Check for character cue
      if (/^@?[A-ZÆØÅ][A-ZÆØÅ0-9\s\-'\.]*(\s*\(.*\))?$/.test(trimmed) && trimmed.length > 0) {
        const charName = trimmed.replace(/^@/, '').replace(/\s*\(.*\)$/, '').trim();
        if (charName && (lineIdx === 0 || sceneLines[lineIdx - 1]?.trim() === '')) {
          // Save previous character's dialogue count
          if (currentCharacter && dialogueCount > 0) {
            updateCharacterArc(characterData, currentCharacter, scene, dialogueCount, isEarlyScene);
          }
          currentCharacter = charName;
          dialogueCount = 0;
        }
      } else if (trimmed && !trimmed.startsWith('(') && currentCharacter) {
        dialogueCount++;
      } else if (trimmed === '') {
        if (currentCharacter && dialogueCount > 0) {
          updateCharacterArc(characterData, currentCharacter, scene, dialogueCount, isEarlyScene);
        }
        currentCharacter = null;
        dialogueCount = 0;
      }
    });
    
    // Don't forget last character in scene
    if (currentCharacter && dialogueCount > 0) {
      updateCharacterArc(characterData, currentCharacter, scene, dialogueCount, isEarlyScene);
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
  isProtagonist: boolean
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
    isProtagonist,
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
      if (/^@?[A-ZÆØÅ][A-ZÆØÅ0-9\s\-'\.]*(\s*\(.*\))?$/.test(trimmed) && trimmed.length > 0) {
        const charName = trimmed.replace(/^@/, '').replace(/\s*\(.*\)$/, '').trim();
        if (charName && (idx === 0 || sceneLines[idx - 1]?.trim() === '')) {
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
  const pacingIssues: PacingAnalysis['pacingIssues'] = [];
  
  scenes.forEach(scene => {
    totalDialogueLines += scene.dialogueLines;
    totalActionLines += scene.actionLines;
    const sceneLength = scene.endLineNumber - scene.lineNumber;
    sceneLengths.push(sceneLength);
    
    // Detect pacing issues
    if (sceneLength > 100) {
      pacingIssues.push({
        type: 'too_long',
        sceneNumber: scene.number,
        description: `Scene ${scene.number} er over 100 linjer (${sceneLength} linjer)`,
        lineNumber: scene.lineNumber,
      });
    }
    if (sceneLength < 5 && scene.dialogueLines === 0) {
      pacingIssues.push({
        type: 'too_short',
        sceneNumber: scene.number,
        description: `Scene ${scene.number} er veldig kort (${sceneLength} linjer)`,
        lineNumber: scene.lineNumber,
      });
    }
    
    const dialogueRatio = scene.dialogueLines / (scene.dialogueLines + scene.actionLines || 1);
    if (dialogueRatio > 0.85) {
      pacingIssues.push({
        type: 'dialogue_heavy',
        sceneNumber: scene.number,
        description: `Scene ${scene.number} har mye dialog (${Math.round(dialogueRatio * 100)}%)`,
        lineNumber: scene.lineNumber,
      });
    }
    if (dialogueRatio < 0.15 && scene.actionLines > 10) {
      pacingIssues.push({
        type: 'action_heavy',
        sceneNumber: scene.number,
        description: `Scene ${scene.number} har lite dialog (${Math.round(dialogueRatio * 100)}%)`,
        lineNumber: scene.lineNumber,
      });
    }
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
  
  // Act pacing (3-act structure)
  const actPacing: PacingAnalysis['actPacing'] = [];
  const idealPercentages = [25, 50, 25]; // Act 1, 2, 3
  const actBreaks = [0.25, 0.75, 1.0];
  let prevEnd = 0;
  
  for (let i = 0; i < 3; i++) {
    const endIdx = Math.round(actBreaks[i] * scenes.length);
    const actScenes = scenes.slice(prevEnd, endIdx);
    const actLines = actScenes.reduce((sum, s) => sum + (s.endLineNumber - s.lineNumber), 0);
    const percentage = totalLines > 0 ? Math.round((actLines / totalLines) * 100) : 0;
    
    actPacing.push({
      act: i + 1,
      percentage,
      idealPercentage: idealPercentages[i],
      status: percentage < idealPercentages[i] - 10 ? 'short' : 
              percentage > idealPercentages[i] + 10 ? 'long' : 'ideal',
    });
    
    prevEnd = endIdx;
  }
  
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
  const actStructure = analyzeActStructure(numberedScenes);
  
  // Add purpose detection to scenes
  numberedScenes.forEach((scene, idx) => {
    scene.purpose = detectScenePurpose(scene, idx, numberedScenes.length, content);
  });
  
  // Generate sequences (group of related scenes)
  const sequences: Sequence[] = [];
  let currentSeq: Sequence | null = null;
  let seqCount = 0;
  
  numberedScenes.forEach((scene, idx) => {
    if (!currentSeq || scene.purpose !== currentSeq.purpose) {
      if (currentSeq) sequences.push(currentSeq);
      seqCount++;
      currentSeq = {
        id: `seq-${seqCount}`,
        name: `Sekvens ${seqCount}`,
        actNumber: Math.ceil((idx / numberedScenes.length) * 3),
        scenes: [scene.number],
        purpose: scene.purpose || 'character_development',
        description: '',
      };
    } else {
      currentSeq.scenes.push(scene.number);
    }
  });
  if (currentSeq) sequences.push(currentSeq);
  
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
