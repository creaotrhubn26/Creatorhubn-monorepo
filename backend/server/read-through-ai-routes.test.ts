import { describe, expect, it } from 'vitest';
import {
  sanitiseAnalysis,
  type ReadThroughAnalyzeInput,
} from './read-through-ai-routes.js';

const baseInput: ReadThroughAnalyzeInput = {
  projectId: '00000000-0000-0000-0000-000000000001',
  sceneId: 'scene-1',
  scene: { sceneNumber: 3, heading: 'INT. KITCHEN — DAY' },
  dialogueLines: [
    { id: 'line-1', characterName: 'ANNA', dialogueText: 'I can explain.' },
    { id: 'line-2', characterName: 'LUKAS', dialogueText: 'No you cannot.' },
  ],
  characters: [
    { name: 'ANNA', description: 'late 30s, exhausted' },
    { name: 'LUKAS', description: 'early 40s, skeptical' },
  ],
};

describe('sanitiseAnalysis', () => {
  it('aligns lines to input dialogue ids even when Claude returns partial coverage', () => {
    const raw = {
      sceneBrief: {
        logline: 'A confrontation in the kitchen.',
        emotionalArc: 'Wary → hostile',
        conflict: 'Trust vs. betrayal',
        beats: ['setup', 'turn', 'break'],
      },
      lines: [
        {
          lineId: 'line-1',
          subtext: 'buying time',
          emphasis: 'high',
          pauseBefore: 400,
          delivery: 'nervous, hurried',
        },
      ],
      voiceCasting: [
        { characterName: 'ANNA', suggestedVoice: 'nova', reasoning: 'warm, distressed' },
        { characterName: 'LUKAS', suggestedVoice: 'onyx', reasoning: 'skeptical male' },
      ],
    };
    const out = sanitiseAnalysis(raw, baseInput);
    expect(out.lines).toHaveLength(2);
    expect(out.lines[0].delivery).toBe('nervous, hurried');
    expect(out.lines[1].delivery).toBe('');
    expect(out.lines[1].emphasis).toBe('normal');
  });

  it('clamps emphasis + pause + voice to known values', () => {
    const raw = {
      lines: [
        {
          lineId: 'line-1',
          subtext: 'x',
          emphasis: 'SCREAMING',
          pauseBefore: 999999,
          delivery: 'x',
        },
        {
          lineId: 'line-2',
          subtext: 'y',
          emphasis: 'low',
          pauseBefore: -5,
          delivery: 'y',
        },
      ],
      voiceCasting: [
        { characterName: 'ANNA', suggestedVoice: 'robot-voice-9000', reasoning: 'x' },
      ],
    };
    const out = sanitiseAnalysis(raw, baseInput);
    expect(out.lines[0].emphasis).toBe('normal');
    expect(out.lines[0].pauseBefore).toBe(5000);
    expect(out.lines[1].pauseBefore).toBe(0);
    expect(out.voiceCasting[0].suggestedVoice).toBe('alloy');
  });

  it('drops voice casting for unknown characters', () => {
    const raw = {
      voiceCasting: [
        { characterName: 'ANNA', suggestedVoice: 'nova', reasoning: 'x' },
        { characterName: 'GHOST', suggestedVoice: 'echo', reasoning: 'not in scene' },
      ],
    };
    const out = sanitiseAnalysis(raw, baseInput);
    expect(out.voiceCasting.map((v) => v.characterName)).toEqual(['ANNA']);
  });

  it('de-duplicates voice casting entries by character', () => {
    const raw = {
      voiceCasting: [
        { characterName: 'ANNA', suggestedVoice: 'nova', reasoning: 'first' },
        { characterName: 'ANNA', suggestedVoice: 'shimmer', reasoning: 'second' },
      ],
    };
    const out = sanitiseAnalysis(raw, baseInput);
    expect(out.voiceCasting).toHaveLength(1);
    expect(out.voiceCasting[0].reasoning).toBe('first');
  });

  it('returns stable empty shape when Claude returns nothing useful', () => {
    const out = sanitiseAnalysis({}, baseInput);
    expect(out.sceneBrief.logline).toBe('');
    expect(out.sceneBrief.beats).toEqual([]);
    expect(out.lines).toHaveLength(2);
    expect(out.voiceCasting).toEqual([]);
  });
});
