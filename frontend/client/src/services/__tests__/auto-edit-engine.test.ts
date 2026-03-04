import { describe, expect, it } from 'vitest';
import type { BeatClip, Track } from '../storyArcDataIntegration';
import {
  createAutoEditAlternatives,
  createAutoEditProposal,
  createStoryValidationReport,
  getDefaultAutoEditOptions,
} from '../auto-edit-engine';

function makeClip(overrides: Partial<BeatClip> & Pick<BeatClip, 'id' | 'trackId'>): BeatClip {
  return {
    id: overrides.id,
    name: overrides.name || overrides.id,
    beatName: overrides.beatName || overrides.name || overrides.id,
    start: overrides.start ?? 0,
    duration: overrides.duration ?? 3,
    ev: overrides.ev ?? 0,
    synopsis: overrides.synopsis || 'test',
    trackId: overrides.trackId,
    color: overrides.color || '#3b82f6',
    tags: overrides.tags,
    metadata: overrides.metadata,
    sourceFile: overrides.sourceFile,
  };
}

const baseTracks: Track[] = [
  { id: 'video-1', name: 'Video 1', type: 'video', height: 56 },
  { id: 'audio-1', name: 'Audio 1', type: 'audio', height: 42 },
];

describe('auto-edit-engine', () => {
  it('builds a polished timeline with transitions and markers', () => {
    const clips: BeatClip[] = [
      makeClip({ id: 'v1', trackId: 'video-1', duration: 4.5, tags: ['highlight'] }),
      makeClip({ id: 'v2', trackId: 'video-1', duration: 5.2 }),
      makeClip({ id: 'v3', trackId: 'video-1', duration: 3.1 }),
      makeClip({ id: 'v4', trackId: 'video-1', duration: 6.3 }),
      makeClip({ id: 'a1', trackId: 'audio-1', duration: 40 }),
    ];
    const options = getDefaultAutoEditOptions('story-60');
    const proposal = createAutoEditProposal(
      {
        clips,
        tracks: baseTracks,
        frameRate: 25,
      },
      options
    );

    expect(proposal.clips.length).toBeGreaterThan(0);
    expect(proposal.selectedClipIds.length).toBeGreaterThan(0);
    expect(proposal.transitions.length).toBeGreaterThan(0);
    expect(proposal.markers.some((marker) => marker.label === 'Auto Edit Start')).toBe(true);
    expect(proposal.confidence).toBeGreaterThan(0);
    expect(proposal.storyValidationReport.summary.length).toBeGreaterThan(0);
  });

  it('keeps source transitions in assemble-only mode', () => {
    const clips: BeatClip[] = [
      makeClip({ id: 'v1', trackId: 'video-1', duration: 4 }),
      makeClip({ id: 'v2', trackId: 'video-1', duration: 4 }),
    ];
    const options = {
      ...getDefaultAutoEditOptions('reel-30'),
      includePolish: false,
    };
    const proposal = createAutoEditProposal(
      {
        clips,
        tracks: baseTracks,
        transitions: [
          {
            id: 'existing-transition',
            time: 4,
            trackId: 'video-1',
            type: 'crossfade',
            duration: 0.25,
          },
        ],
        frameRate: 25,
      },
      options
    );

    expect(proposal.transitions).toHaveLength(1);
    expect(proposal.transitions[0]?.id).toBe('existing-transition');
  });

  it('adds an audio bed when audio tracks are available and option is enabled', () => {
    const clips: BeatClip[] = [
      makeClip({ id: 'v1', trackId: 'video-1', duration: 4 }),
      makeClip({ id: 'v2', trackId: 'video-1', duration: 4 }),
      makeClip({ id: 'music', trackId: 'audio-1', duration: 90 }),
    ];
    const proposal = createAutoEditProposal(
      {
        clips,
        tracks: baseTracks,
        frameRate: 25,
      },
      getDefaultAutoEditOptions('reel-30')
    );

    const audioBed = proposal.clips.find((clip) => clip.id === 'music-auto-bed');
    expect(audioBed).toBeTruthy();
    expect(audioBed?.trackId).toBe('audio-1');
    expect((audioBed?.metadata as Record<string, unknown>)?.autoEditAudioBed).toBe(true);
  });

  it('uses server ranking signals when provided', () => {
    const clips: BeatClip[] = [
      makeClip({ id: 'v1', trackId: 'video-1', start: 0, duration: 4 }),
      makeClip({ id: 'v2', trackId: 'video-1', start: 12, duration: 4 }),
    ];
    const proposal = createAutoEditProposal(
      {
        clips,
        tracks: baseTracks,
        frameRate: 25,
        serverRanking: {
          clipScores: { v1: 0.2, v2: 0.98 },
          confidence: 0.9,
          summary: ['Server prefers v2 as hero shot.'],
          modelUsed: 'story-arc-analyzer',
          analyzerAvailable: true,
        },
      },
      getDefaultAutoEditOptions('reel-30')
    );

    expect(proposal.selectedClipIds[0]).toBe('v2');
    expect(proposal.confidence).toBeGreaterThan(0.3);
    expect(
      proposal.summary.some((line) => line.includes('Server ranking assisted'))
    ).toBe(true);
  });

  it('orders assembled clips by narrative beat phases when provided', () => {
    const clips: BeatClip[] = [
      makeClip({ id: 'build-1', trackId: 'video-1', start: 10, duration: 4, tags: ['build'] }),
      makeClip({ id: 'climax-1', trackId: 'video-1', start: 20, duration: 4, tags: ['climax'] }),
      makeClip({ id: 'hook-1', trackId: 'video-1', start: 0, duration: 3, tags: ['hook'] }),
      makeClip({ id: 'resolution-1', trackId: 'video-1', start: 30, duration: 3, tags: ['resolution'] }),
    ];

    const proposal = createAutoEditProposal(
      {
        clips,
        tracks: baseTracks,
        frameRate: 25,
        serverRanking: {
          clipScores: {
            'build-1': 0.82,
            'climax-1': 0.84,
            'hook-1': 0.75,
            'resolution-1': 0.8,
          },
          rankedClipIds: ['climax-1', 'build-1', 'resolution-1', 'hook-1'],
          beatByClipId: {
            'hook-1': { beat: 'hook', confidence: 0.9, source: 'llm' },
            'build-1': { beat: 'build', confidence: 0.88, source: 'llm' },
            'climax-1': { beat: 'climax', confidence: 0.92, source: 'llm' },
            'resolution-1': { beat: 'resolution', confidence: 0.9, source: 'llm' },
          },
          confidence: 0.9,
          summary: ['semantic ordering enabled'],
          modelUsed: 'story-arc-analyzer',
          analyzerAvailable: true,
          llmBeatClassificationUsed: true,
        },
      },
      getDefaultAutoEditOptions('reel-30')
    );

    const orderedVideoIds = proposal.clips
      .filter((clip) => clip.trackId === 'video-1')
      .sort((left, right) => left.start - right.start)
      .map((clip) => clip.id);

    expect(orderedVideoIds[0]).toBe('hook-1');
    expect(orderedVideoIds[orderedVideoIds.length - 1]).toBe('resolution-1');
    expect(
      proposal.summary.some((line) => line.includes('Narrative phase placement'))
    ).toBe(true);
  });

  it('generates safe/balanced/bold alternatives in one pass', () => {
    const clips: BeatClip[] = [
      makeClip({ id: 'v1', trackId: 'video-1', duration: 4.5, tags: ['highlight'] }),
      makeClip({ id: 'v2', trackId: 'video-1', duration: 4.1, tags: ['emotion'] }),
      makeClip({ id: 'v3', trackId: 'video-1', duration: 3.3 }),
      makeClip({ id: 'a1', trackId: 'audio-1', duration: 40 }),
    ];

    const alternatives = createAutoEditAlternatives(
      {
        clips,
        tracks: baseTracks,
        frameRate: 25,
      },
      getDefaultAutoEditOptions('reel-30')
    );

    expect(alternatives.alternatives.safe.variant).toBe('safe');
    expect(alternatives.alternatives.balanced.variant).toBe('balanced');
    expect(alternatives.alternatives.bold.variant).toBe('bold');
    expect(alternatives.comparisonSummary.length).toBe(3);
  });

  it('applies human feedback bias and explainability output', () => {
    const clips: BeatClip[] = [
      makeClip({
        id: 'hero',
        trackId: 'video-1',
        start: 0,
        duration: 4,
        metadata: {
          autoEditContext: {
            transcriptText: 'And then we realized this was the moment everything changed for us.',
          },
        } as Record<string, unknown>,
      }),
      makeClip({ id: 'other', trackId: 'video-1', start: 6, duration: 4 }),
    ];

    const proposal = createAutoEditProposal(
      {
        clips,
        tracks: baseTracks,
        frameRate: 25,
        humanFeedbackByClipId: { hero: 'approved', other: 'rejected' },
        serverRanking: {
          clipScores: { hero: 0.8, other: 0.8 },
          clipSignalsById: {
            hero: {
              transcriptCoverage: 0.92,
              narrativeConnectorHits: 2,
              impactPhraseHits: 1,
              fillerHits: 0,
            },
          },
          confidence: 0.8,
          summary: [],
          modelUsed: 'story-arc-analyzer',
          analyzerAvailable: true,
        },
      },
      getDefaultAutoEditOptions('reel-30')
    );

    expect(proposal.clipExplainabilityById.hero).toBeTruthy();
    expect(proposal.clipExplainabilityById.hero?.feedback).toBe('approved');
    expect(proposal.clipExplainabilityById.hero?.narrative.transcriptCoverage).toBeGreaterThan(0.8);
    expect(proposal.clipExplainabilityById.hero?.narrative.connectorHits).toBe(2);
    expect(proposal.clipExplainabilityById.hero?.narrative.impactPhraseHits).toBe(1);
    expect(proposal.clipExplainabilityById.hero?.narrative.transcriptExcerpt).toContain('moment everything changed');
    expect(proposal.summary.some((line) => line.includes('Hard constraints'))).toBe(true);
    expect(proposal.storyValidationReport.metrics.explainabilityCoverageRatio).toBeGreaterThan(0);
  });

  it('detects overlap and invalid track in validation report', () => {
    const clips: BeatClip[] = [
      makeClip({ id: 'v1', trackId: 'video-1', start: 0, duration: 2.8, tags: ['hook'] }),
      makeClip({ id: 'v2', trackId: 'video-1', start: 2.9, duration: 2.8, tags: ['climax'] }),
      makeClip({ id: 'v3', trackId: 'video-1', start: 6.2, duration: 2.6, tags: ['resolution'] }),
    ];
    const baseProposal = createAutoEditProposal(
      {
        clips,
        tracks: baseTracks,
        frameRate: 25,
      },
      getDefaultAutoEditOptions('reel-30')
    );

    const brokenClips = baseProposal.clips
      .filter((clip) => clip.trackId === 'video-1')
      .slice(0, 3)
      .map((clip) => ({ ...clip }));
    brokenClips[0].trackId = 'video-1';
    brokenClips[1].trackId = 'video-1';
    brokenClips[1].start = brokenClips[0].start + 0.1;
    if (brokenClips[2]) {
      brokenClips[2].trackId = 'missing-track';
    }

    const brokenProposal = {
      ...baseProposal,
      clips: brokenClips,
      selectedClipIds: brokenClips.map((clip) => clip.id),
    };

    const report = createStoryValidationReport(
      {
        clips,
        tracks: baseTracks,
        frameRate: 25,
      },
      brokenProposal
    );

    expect(report.hardConstraintPass).toBe(false);
    expect(report.metrics.trackBoundsIssueCount).toBeGreaterThan(0);
    expect(report.metrics.overlapCount).toBeGreaterThan(0);
  });
});
