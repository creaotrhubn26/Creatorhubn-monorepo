export interface StoryIntentProfile {
  id: string;
  name: string;
  description: string;
  pacing: 'slow' | 'balanced' | 'fast';
  goalKeywords: string[];
  avoidKeywords: string[];
  forbiddenPatterns: string[];
  transitionDensityBias: number;
  targetDurationBias: number;
  maxConsecutiveByCamera: number;
  maxConsecutiveBySpeaker: number;
}

const DEFAULT_PROFILE: StoryIntentProfile = {
  id: 'balanced-story',
  name: 'Balanced Story',
  description: 'Narrative-first cut with stable pacing and emotional progression.',
  pacing: 'balanced',
  goalKeywords: ['story', 'emotion', 'reaction', 'detail', 'progression'],
  avoidKeywords: ['repetitive', 'filler'],
  forbiddenPatterns: ['long_silence', 'mic_handling_noise'],
  transitionDensityBias: 0,
  targetDurationBias: 0,
  maxConsecutiveByCamera: 2,
  maxConsecutiveBySpeaker: 2,
};

export const STORY_INTENT_PROFILES: StoryIntentProfile[] = [
  DEFAULT_PROFILE,
  {
    id: 'cinematic-emotional',
    name: 'Cinematic Emotional',
    description: 'Faces, reactions and emotional moments prioritized.',
    pacing: 'slow',
    goalKeywords: ['emotion', 'closeup', 'reaction', 'vows', 'story', 'romance'],
    avoidKeywords: ['wide_static', 'flat_light', 'filler'],
    forbiddenPatterns: ['harsh_jumpcut', 'abrupt_audio_spike'],
    transitionDensityBias: -0.15,
    targetDurationBias: 0.05,
    maxConsecutiveByCamera: 2,
    maxConsecutiveBySpeaker: 2,
  },
  {
    id: 'fast-social',
    name: 'Fast Social',
    description: 'High-energy rhythm for short-form social outputs.',
    pacing: 'fast',
    goalKeywords: ['hook', 'impact', 'energy', 'highlight', 'cheer', 'climax'],
    avoidKeywords: ['slow', 'intro_long', 'repetitive'],
    forbiddenPatterns: ['dead_air', 'long_static_shot'],
    transitionDensityBias: 0.25,
    targetDurationBias: -0.2,
    maxConsecutiveByCamera: 1,
    maxConsecutiveBySpeaker: 1,
  },
  {
    id: 'interview-clarity',
    name: 'Interview Clarity',
    description: 'Dialogue clarity and speaker continuity prioritized.',
    pacing: 'balanced',
    goalKeywords: ['dialogue', 'speaker', 'clarity', 'story', 'context'],
    avoidKeywords: ['noise', 'cross_talk', 'filler'],
    forbiddenPatterns: ['overlapping_dialogue', 'distorted_voice'],
    transitionDensityBias: -0.08,
    targetDurationBias: 0.08,
    maxConsecutiveByCamera: 3,
    maxConsecutiveBySpeaker: 3,
  },
];

export function getStoryIntentProfiles(): StoryIntentProfile[] {
  return STORY_INTENT_PROFILES;
}

export function getStoryIntentProfile(profileId: string | null | undefined): StoryIntentProfile {
  if (!profileId) {
    return DEFAULT_PROFILE;
  }
  return STORY_INTENT_PROFILES.find((profile) => profile.id === profileId) || DEFAULT_PROFILE;
}
