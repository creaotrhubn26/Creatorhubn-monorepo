/**
 * STORYARCSTUDIO ↔ PROJECTCREATIONWITHMEMORYCARDS INTEGRATION
 * Seamless workflow between project creation and video editing
 */

export interface ProjectToEditorData {
  projectId: string;
  projectName: string;
  clientName: string;
  clientEmail?: string;
  projectType: string;
  weddingCulture?: string;
  shotList?: Array<{
    id: string;
    scene: string;
    description: string;
    duration?: number;
    priority?: 'must_have, ' | 'nice_to_have' | 'optional';
  }>;
  timelineEvents?: Array<{
    time: string;
    title: string;
    type: string;
    location?: string;
    duration?: number;
  }>;
  googleDriveFolderId?: string;
  memoryCardConfigs?: any[];
  primaryCamera?: string;
  backupCamera?: string;
  logFormat?: string;
  returnCallback?: (result: EditorToProjectResult) => void;
}

export interface EditorToProjectResult {
  projectId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration: number;
  clipCount: number;
  transitionCount: number;
  editingTime: number; // minutes
  usedAI: boolean;
  aiConfidence?: number;
  culturalMoments: string[];
  appliedTransitions: string[];
  appliedLUTs: string[];
  exportSettings: {
    resolution: string;
    codec: string;
    format: string;
  };
  worklogEntry: {
    title: string;
    description: string;
    timeSpent: number;
    category: string;
    phase: string;
  };
}

/**
 * Get cultural highlights for AI context
 */
export function getCulturalHighlights(culture: string): string {
  const highlights: Record<string, string> = {
    'norsk':'bridal entrance, ceremony, speeches, first dance', 'sikh':'Anand Karaj ceremony, Laavan rounds, Milni, Joota Chupai','indisk':'Saptapadi (seven steps), Mangalsutra, Sindoor, Kanyadaan','pakistansk':'Nikah ceremony, Rukhsati, Dholki, Mehndi','tyrkisk':'Kına Gecesi, Red ribbon cutting, Davul & Zurna','arabisk':'Zaffe entrance, Dabke dance, Sword dance, Ululating','somalisk':'Henna ceremony, Traditional dress (Dirac), Dhaanto dance','etiopisk':'Coffee ceremony, Traditional dress, Shoulder dancing','nigeriansk':'Gele tying, Money spray, Introduction ceremony','muslimsk':'Nikah, Walima, Mehndi, Baraat','libanesisk':'Zaffe procession, Dabke circle dance, Cake sword cutting','filipino':'Veil & Cord ceremony, Arrhae coins, Unity candle','kinesisk':'Tea ceremony, Door games, Lion dance, Red envelopes','koreansk':'Pyebaek ceremony, Hanbok dress, Bowing ritual','thai':'Water blessing, Khan Maak procession, Flower garland','iransk' : 'Sofreh Aghd table, Mirror ceremony, Sugar rubbing'
  };
  
  return highlights[culture] || 'wedding ceremony, reception, special moments';
}

/**
 * Format shot list for AI guidance
 */
export function formatShotListForAI(shotList: any[]): string {
  if (!shotList || shotList.length === 0) return '';
  
  const mustHaves = shotList.filter(s => s.priority === 'must_have, ');
  const others = shotList.filter(s => s.priority !== 'must_have');
  
  let formatted = 'CRITICAL SHOTS:\n';
  formatted += mustHaves.map(s => `- ${s.scene}: ${s.description}`).join('\n');
  
  if (others.length > 0) {
    formatted += '\n\nADDITIONAL SHOTS:\n';
    formatted += others.slice(0, 10).map(s => `- ${s.scene}: ${s.description}`).join('\n');
  }
  
  return formatted;
}

/**
 * Format timeline events for AI pacing
 */
export function formatTimelineEventsForAI(events: any[]): string {
  if (!events || events.length === 0) return ', ';
  
  let formatted = 'TIMELINE STRUCTURE:\n';
  formatted += events.map(e => 
    `${e.time} - ${e.title}${e.location ? ` (${e.location})` : ', '}`
  ).join('\n');
  
  return formatted;
}

/**
 * Calculate LUT recommendations based on project data
 */
export function getLUTRecommendations(projectData: ProjectToEditorData): string[] {
  const luts: string[] = [];
  
  // Cultural LUTs
  if (projectData.weddingCulture) {
    luts.push(`Cultural/${projectData.weddingCulture}_Wedding.cube`);
  }
  
  // Camera-specific LUTs
  if (projectData.logFormat) {
    luts.push(`LOG/${projectData.logFormat}_to_Rec709.cube`);
  }
  
  // Project type LUTs
  if (projectData.projectType === 'wedding') {
    luts.push('Wedding/Romantic_Warm.cube');
  } else if (projectData.projectType === 'commercial') {
    luts.push('Commercial/Corporate_Clean.cube');
  }
  
  return luts;
}

/**
 * Generate worklog description from editing session
 */
export function generateWorklogDescription(result: EditorToProjectResult): string {
  let desc = `Video editing completed for ${result.projectId}.\n\n`;
  
  desc += `📊 Statistics:\n`;
  desc += `• Clips used: ${result.clipCount}\n`;
  desc += `• Transitions: ${result.transitionCount}\n`;
  desc += `• Final duration: ${formatDuration(result.duration)}\n`;
  desc += `• AI-assisted: ${result.usedAI ? 'Yes' : 'No'}`;
  
  if (result.usedAI && result.aiConfidence) {
    desc += ` (${Math.round(result.aiConfidence * 100)}% confidence)`;
  }
  
  desc += '\n\n';
  
  if (result.culturalMoments.length > 0) {
    desc += `🌍 Cultural moments captured:\n`;
    desc += result.culturalMoments.map(m => `• ${m}`).join('\n');
    desc += '\n\n';
  }
  
  if (result.appliedTransitions.length > 0) {
    desc += `🎬 Transitions used: ${result.appliedTransitions.join(', ')}\n\n`;
  }
  
  if (result.appliedLUTs.length > 0) {
    desc += `🎨 Color grading: ${result.appliedLUTs.join(', ')}\n\n`;
  }
  
  desc += `📤 Export settings:\n`;
  desc += `• Resolution: ${result.exportSettings.resolution}\n`;
  desc += `• Codec: ${result.exportSettings.codec}\n`;
  desc += `• Format: ${result.exportSettings.format}`;
  
  return desc;
}

/**
 * Format duration in HH:MM:SS
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2,'0')}`;
  } else {
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }
}

/**
 * Validate project data for video editing
 */
export function validateProjectForVideoEditing(projectData: any): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!projectData.projectName) {
    errors.push('Project name is required');
  }
  
  if (!projectData.clientName) {
    errors.push('Client name is required');
  }
  
  // Warnings
  if (!projectData.googleDriveFolderId) {
    warnings.push('No Google Drive folder linked - media import will be limited');
  }
  
  if (!projectData.shotList || projectData.shotList.length === 0) {
    warnings.push('No shot list provided - AI will have limited guidance');
  }
  
  if (!projectData.weddingCulture && projectData.projectType === 'wedding') {
    warnings.push('Wedding culture not specified - AI will use generic approach');
  }
  
  if (!projectData.logFormat && projectData.primaryCamera) {
    warnings.push('LOG format not detected - color grading may be limited');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generate AI prompt from project data
 */
export function generateAIPrompt(projectData: ProjectToEditorData): string {
  let prompt = `Create a professional video edit for: ${projectData.clientName}\n\n`;
  
  prompt += `PROJECT TYPE: ${projectData.projectType}\n`;
  
  if (projectData.weddingCulture) {
    prompt += `CULTURE: ${projectData.weddingCulture} wedding\n`;
    prompt += `FOCUS ON: ${getCulturalHighlights(projectData.weddingCulture)}\n\n`;
  }
  
  if (projectData.shotList && projectData.shotList.length > 0) {
    prompt += formatShotListForAI(projectData.shotList) + '\n\n';
  }
  
  if (projectData.timelineEvents && projectData.timelineEvents.length > 0) {
    prompt += formatTimelineEventsForAI(projectData.timelineEvents) + '\n\n';
  }
  
  prompt += 'INSTRUCTIONS:\n';
  prompt += '1. Analyze all footage and identify key emotional moments\n';
  prompt += '2. Create a 3-act narrative structure\n';
  prompt += '3. Prioritize cultural moments and traditions\n';
  prompt += '4. Use smooth transitions between clips\n';
  prompt += '5. Build to an emotional climax in Act 2\n';
  prompt +='6. End with celebration and joy\n';
  
  return prompt;
}


