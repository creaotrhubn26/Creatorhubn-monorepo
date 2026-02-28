export interface AudioSyncClipInput {
  id: string;
  sourceUrl: string;
  file?: File;
  type: 'audio' | 'video';
  camera?: string;
  syncGroup?: string;
  timecode?: string;
}

export interface AudioSyncResult {
  offset_seconds: number;
  offset_frames: number;
  confidence: number;
  method: string;
  drift_ppm?: number;
  notes?: string;
}

export interface AudioSyncRunResult {
  referenceClipId: string;
  offsets: Record<string, AudioSyncResult>;
  averageConfidence: number;
}

export interface AudioSyncOptions {
  frameRate?: number;
  maxOffsetSeconds?: number;
  targetEnvelopeRate?: number;
  analysisWindowSeconds?: number;
  tryReallyHard?: boolean;
  enableDriftCorrection?: boolean;
  preferTimecode?: boolean;
}

interface DecodedEnvelope {
  clip: AudioSyncClipInput;
  envelope: Float32Array | null;
  error?: string;
}

interface LagScore {
  lagSamples: number;
  score: number;
  overlap: number;
}

interface AudioOffsetEstimate {
  lagSamples: number;
  confidence: number;
  method: string;
}

type AudioContextWithWebkit = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

const DEFAULT_FRAME_RATE = 30;
const DEFAULT_MAX_OFFSET_SECONDS = 30;
const DEFAULT_TARGET_RATE = 200;
const DEFAULT_ANALYSIS_WINDOW_SECONDS = 90;

function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.max(minValue, Math.min(maxValue, value));
}

function trimWindow(input: Float32Array, maxSamples: number): Float32Array {
  if (input.length <= maxSamples) {
    return input;
  }
  return input.slice(0, maxSamples);
}

function parseTimecodeToSeconds(timecode: string, frameRate: number): number | null {
  const normalized = timecode.trim();
  const match = normalized.match(/^(\d+):([0-5]\d):([0-5]\d)(?::([0-5]\d))?$/);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const frames = match[4] ? Number(match[4]) : 0;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds) || !Number.isFinite(frames)) {
    return null;
  }
  return hours * 3600 + minutes * 60 + seconds + frames / frameRate;
}

export class AudioSyncEngine {
  private audioContext: AudioContext | null = null;

  private getAudioContext(): AudioContext {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      return this.audioContext;
    }

    const contextFactory =
      window.AudioContext || (window as AudioContextWithWebkit).webkitAudioContext;
    if (!contextFactory) {
      throw new Error('WebAudio is not available in this browser.');
    }

    this.audioContext = new contextFactory();
    return this.audioContext;
  }

  private async resolveAudioBuffer(clip: AudioSyncClipInput): Promise<AudioBuffer | null> {
    try {
      const context = this.getAudioContext();
      const arrayBuffer = clip.file
        ? await clip.file.arrayBuffer()
        : await fetch(clip.sourceUrl).then((response) => {
            if (!response.ok) {
              throw new Error(`Failed to fetch media (${response.status})`);
            }
            return response.arrayBuffer();
          });

      return await context.decodeAudioData(arrayBuffer.slice(0));
    } catch (error) {
      console.warn(`[AudioSyncEngine] Failed to decode clip ${clip.id}`, error);
      return null;
    }
  }

  private extractEnvelope(audioBuffer: AudioBuffer, targetRate: number): Float32Array {
    const channelCount = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const sampleStep = Math.max(1, Math.floor(sampleRate / targetRate));
    const sampleCount = Math.max(1, Math.ceil(audioBuffer.length / sampleStep));
    const envelope = new Float32Array(sampleCount);

    for (let index = 0; index < sampleCount; index += 1) {
      const startSample = index * sampleStep;
      const endSample = Math.min(audioBuffer.length, startSample + sampleStep);
      let powerSum = 0;
      let sampleTotal = 0;

      for (let channel = 0; channel < channelCount; channel += 1) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let sampleIndex = startSample; sampleIndex < endSample; sampleIndex += 1) {
          const sample = channelData[sampleIndex];
          powerSum += sample * sample;
          sampleTotal += 1;
        }
      }

      envelope[index] = sampleTotal > 0 ? Math.sqrt(powerSum / sampleTotal) : 0;
    }

    let maxValue = 0;
    for (let index = 0; index < envelope.length; index += 1) {
      if (envelope[index] > maxValue) {
        maxValue = envelope[index];
      }
    }
    if (maxValue > 0) {
      for (let index = 0; index < envelope.length; index += 1) {
        envelope[index] /= maxValue;
      }
    }

    return envelope;
  }

  private createOnsetEnvelope(envelope: Float32Array): Float32Array {
    if (envelope.length === 0) {
      return envelope;
    }
    const onset = new Float32Array(envelope.length);
    onset[0] = 0;
    for (let index = 1; index < envelope.length; index += 1) {
      onset[index] = Math.max(0, envelope[index] - envelope[index - 1]);
    }
    return onset;
  }

  private scoreLag(
    reference: Float32Array,
    candidate: Float32Array,
    lagSamples: number
  ): LagScore | null {
    const referenceStart = lagSamples < 0 ? -lagSamples : 0;
    const candidateStart = lagSamples > 0 ? lagSamples : 0;
    const overlap = Math.min(
      reference.length - referenceStart,
      candidate.length - candidateStart
    );

    if (overlap < 40) {
      return null;
    }

    let dot = 0;
    let referenceEnergy = 0;
    let candidateEnergy = 0;

    for (let index = 0; index < overlap; index += 1) {
      const referenceSample = reference[referenceStart + index];
      const candidateSample = candidate[candidateStart + index];
      dot += referenceSample * candidateSample;
      referenceEnergy += referenceSample * referenceSample;
      candidateEnergy += candidateSample * candidateSample;
    }

    const denominator = Math.sqrt(referenceEnergy * candidateEnergy);
    if (denominator <= Number.EPSILON) {
      return null;
    }

    const score = dot / denominator;
    return {
      lagSamples,
      score,
      overlap,
    };
  }

  private findBestLag(
    reference: Float32Array,
    candidate: Float32Array,
    maxLagSamples: number,
    coarseStep: number
  ): { best: LagScore; secondBest: number } | null {
    let best: LagScore | null = null;
    let secondBestScore = Number.NEGATIVE_INFINITY;

    for (let lag = -maxLagSamples; lag <= maxLagSamples; lag += coarseStep) {
      const scored = this.scoreLag(reference, candidate, lag);
      if (!scored) {
        continue;
      }
      if (!best || scored.score > best.score) {
        secondBestScore = best ? best.score : secondBestScore;
        best = scored;
      } else if (scored.score > secondBestScore) {
        secondBestScore = scored.score;
      }
    }

    if (!best) {
      return null;
    }

    const refineStart = Math.max(-maxLagSamples, best.lagSamples - coarseStep);
    const refineEnd = Math.min(maxLagSamples, best.lagSamples + coarseStep);

    for (let lag = refineStart; lag <= refineEnd; lag += 1) {
      const scored = this.scoreLag(reference, candidate, lag);
      if (!scored) {
        continue;
      }
      if (scored.score > best.score) {
        secondBestScore = best.score;
        best = scored;
      } else if (scored.score > secondBestScore && scored.lagSamples !== best.lagSamples) {
        secondBestScore = scored.score;
      }
    }

    return {
      best,
      secondBest: Number.isFinite(secondBestScore) ? secondBestScore : best.score,
    };
  }

  private toConfidence(bestScore: number, secondBestScore: number, overlapRatio: number): number {
    const normalizedScore = clamp(bestScore, -1, 1);
    const positiveScore = Math.max(0, normalizedScore);
    const separation = Math.max(0, normalizedScore - secondBestScore);
    const confidence =
      positiveScore * 0.72 +
      clamp(separation * 2.2, 0, 0.22) +
      clamp(overlapRatio, 0, 1) * 0.06;
    return clamp(confidence, 0, 1);
  }

  private estimateLagFromAudio(
    reference: Float32Array,
    candidate: Float32Array,
    maxLagSamples: number,
    tryReallyHard: boolean
  ): AudioOffsetEstimate | null {
    const coarseStep = Math.max(1, Math.floor(maxLagSamples / 1200));
    const baseRun = this.findBestLag(reference, candidate, maxLagSamples, coarseStep);
    if (!baseRun) {
      return null;
    }

    const overlapRatio = baseRun.best.overlap / Math.max(1, Math.min(reference.length, candidate.length));
    const baseConfidence = this.toConfidence(baseRun.best.score, baseRun.secondBest, overlapRatio);

    if (!tryReallyHard || baseConfidence >= 0.65) {
      return {
        lagSamples: baseRun.best.lagSamples,
        confidence: baseConfidence,
        method: 'audio_waveform',
      };
    }

    const referenceOnset = this.createOnsetEnvelope(reference);
    const candidateOnset = this.createOnsetEnvelope(candidate);
    const onsetRun = this.findBestLag(referenceOnset, candidateOnset, maxLagSamples, coarseStep);
    if (!onsetRun) {
      return {
        lagSamples: baseRun.best.lagSamples,
        confidence: baseConfidence,
        method: 'audio_waveform',
      };
    }

    const onsetOverlapRatio = onsetRun.best.overlap / Math.max(1, Math.min(referenceOnset.length, candidateOnset.length));
    const onsetConfidence = this.toConfidence(onsetRun.best.score, onsetRun.secondBest, onsetOverlapRatio);

    if (onsetConfidence > baseConfidence) {
      return {
        lagSamples: onsetRun.best.lagSamples,
        confidence: onsetConfidence,
        method: 'audio_onset',
      };
    }

    return {
      lagSamples: baseRun.best.lagSamples,
      confidence: baseConfidence,
      method: 'audio_waveform',
    };
  }

  private estimateDriftPpm(
    reference: Float32Array,
    candidate: Float32Array,
    anchorLagSamples: number,
    targetRate: number
  ): number | undefined {
    const windowSamples = Math.max(200, Math.floor(targetRate * 8));
    if (reference.length < windowSamples * 3 || candidate.length < windowSamples * 3) {
      return undefined;
    }

    const quarter = Math.floor(reference.length * 0.25);
    const threeQuarter = Math.floor(reference.length * 0.75);
    const localLagRange = Math.max(10, Math.floor(targetRate * 0.8));

    const lagAtQuarter = this.findLagNearAnchor(
      reference,
      candidate,
      quarter,
      windowSamples,
      anchorLagSamples,
      localLagRange
    );
    const lagAtThreeQuarter = this.findLagNearAnchor(
      reference,
      candidate,
      threeQuarter,
      windowSamples,
      anchorLagSamples,
      localLagRange
    );

    if (lagAtQuarter === null || lagAtThreeQuarter === null) {
      return undefined;
    }

    const deltaLagSeconds = (lagAtThreeQuarter - lagAtQuarter) / targetRate;
    const deltaTimeSeconds = (threeQuarter - quarter) / targetRate;
    if (Math.abs(deltaTimeSeconds) < Number.EPSILON) {
      return undefined;
    }

    const driftRatio = deltaLagSeconds / deltaTimeSeconds;
    return driftRatio * 1_000_000;
  }

  private findLagNearAnchor(
    reference: Float32Array,
    candidate: Float32Array,
    anchorIndex: number,
    windowSamples: number,
    expectedLag: number,
    searchRadius: number
  ): number | null {
    const halfWindow = Math.floor(windowSamples / 2);
    const referenceStart = anchorIndex - halfWindow;
    if (referenceStart < 0 || referenceStart + windowSamples > reference.length) {
      return null;
    }

    let bestLag: number | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let lagDelta = -searchRadius; lagDelta <= searchRadius; lagDelta += 1) {
      const lag = expectedLag + lagDelta;
      const candidateStart = referenceStart + lag;
      if (candidateStart < 0 || candidateStart + windowSamples > candidate.length) {
        continue;
      }

      let dot = 0;
      let referenceEnergy = 0;
      let candidateEnergy = 0;

      for (let index = 0; index < windowSamples; index += 1) {
        const referenceSample = reference[referenceStart + index];
        const candidateSample = candidate[candidateStart + index];
        dot += referenceSample * candidateSample;
        referenceEnergy += referenceSample * referenceSample;
        candidateEnergy += candidateSample * candidateSample;
      }

      const denominator = Math.sqrt(referenceEnergy * candidateEnergy);
      if (denominator <= Number.EPSILON) {
        continue;
      }

      const score = dot / denominator;
      if (score > bestScore) {
        bestScore = score;
        bestLag = lag;
      }
    }

    return bestLag;
  }

  private async decodeClips(
    clips: AudioSyncClipInput[],
    targetRate: number,
    analysisWindowSeconds: number
  ): Promise<Record<string, DecodedEnvelope>> {
    const maxSamples = Math.max(1, Math.floor(targetRate * analysisWindowSeconds));
    const decodedList = await Promise.all(
      clips.map(async (clip): Promise<DecodedEnvelope> => {
        const buffer = await this.resolveAudioBuffer(clip);
        if (!buffer) {
          return {
            clip,
            envelope: null,
            error: 'Audio stream unavailable',
          };
        }
        const envelope = trimWindow(this.extractEnvelope(buffer, targetRate), maxSamples);
        if (envelope.length < 80) {
          return {
            clip,
            envelope: null,
            error: 'Audio segment too short for reliable sync',
          };
        }
        return {
          clip,
          envelope,
        };
      })
    );

    return decodedList.reduce<Record<string, DecodedEnvelope>>((accumulator, decoded) => {
      accumulator[decoded.clip.id] = decoded;
      return accumulator;
    }, {});
  }

  public async synchronizeClips(
    clips: AudioSyncClipInput[],
    options: AudioSyncOptions
  ): Promise<AudioSyncRunResult> {
    if (clips.length < 2) {
      throw new Error('At least 2 clips are required for audio synchronization.');
    }

    const frameRate = options.frameRate ?? DEFAULT_FRAME_RATE;
    const maxOffsetSeconds = options.maxOffsetSeconds ?? DEFAULT_MAX_OFFSET_SECONDS;
    const targetRate = options.targetEnvelopeRate ?? DEFAULT_TARGET_RATE;
    const analysisWindowSeconds = options.analysisWindowSeconds ?? DEFAULT_ANALYSIS_WINDOW_SECONDS;
    const tryReallyHard = Boolean(options.tryReallyHard);
    const enableDriftCorrection = Boolean(options.enableDriftCorrection);
    const preferTimecode = Boolean(options.preferTimecode);

    const referenceClip = clips.find((clip) => clip.id === options.referenceClipId) ?? clips[0];
    const decodedById = await this.decodeClips(clips, targetRate, analysisWindowSeconds);
    const referenceDecoded = decodedById[referenceClip.id];

    const offsets: Record<string, AudioSyncResult> = {};
    const referenceTimecodeSeconds =
      referenceClip.timecode ? parseTimecodeToSeconds(referenceClip.timecode, frameRate) : null;

    for (const clip of clips) {
      if (clip.id === referenceClip.id) {
        offsets[clip.id] = {
          offset_seconds: 0,
          offset_frames: 0,
          confidence: 1,
          method: 'reference',
        };
        continue;
      }

      const clipDecoded = decodedById[clip.id];
      const maxLagSamples = Math.max(1, Math.floor(maxOffsetSeconds * targetRate));
      const clipTimecodeSeconds =
        clip.timecode ? parseTimecodeToSeconds(clip.timecode, frameRate) : null;

      if (
        preferTimecode &&
        referenceTimecodeSeconds !== null &&
        clipTimecodeSeconds !== null
      ) {
        const offsetSeconds = referenceTimecodeSeconds - clipTimecodeSeconds;
        offsets[clip.id] = {
          offset_seconds: offsetSeconds,
          offset_frames: Math.round(offsetSeconds * frameRate),
          confidence: 0.92,
          method: 'timecode',
        };
        continue;
      }

      if (referenceDecoded?.envelope && clipDecoded?.envelope) {
        const estimate = this.estimateLagFromAudio(
          referenceDecoded.envelope,
          clipDecoded.envelope,
          maxLagSamples,
          tryReallyHard
        );
        if (estimate) {
          const offsetSeconds = -estimate.lagSamples / targetRate;
          const driftPpm =
            enableDriftCorrection
              ? this.estimateDriftPpm(
                  referenceDecoded.envelope,
                  clipDecoded.envelope,
                  estimate.lagSamples,
                  targetRate
                )
              : undefined;

          offsets[clip.id] = {
            offset_seconds: offsetSeconds,
            offset_frames: Math.round(offsetSeconds * frameRate),
            confidence: estimate.confidence,
            method: estimate.method,
            drift_ppm:
              typeof driftPpm === 'number' && Number.isFinite(driftPpm)
                ? Math.round(driftPpm * 100) / 100
                : undefined,
            notes:
              clipDecoded.error ||
              (typeof driftPpm === 'number' && Math.abs(driftPpm) > 80
                ? 'Detected clock drift between clips'
                : undefined),
          };
          continue;
        }
      }

      if (referenceTimecodeSeconds !== null && clipTimecodeSeconds !== null) {
        const offsetSeconds = referenceTimecodeSeconds - clipTimecodeSeconds;
        offsets[clip.id] = {
          offset_seconds: offsetSeconds,
          offset_frames: Math.round(offsetSeconds * frameRate),
          confidence: 0.65,
          method: 'timecode_fallback',
          notes: 'Audio analysis unavailable, used timecode',
        };
        continue;
      }

      if (referenceClip.syncGroup && clip.syncGroup && referenceClip.syncGroup === clip.syncGroup) {
        offsets[clip.id] = {
          offset_seconds: 0,
          offset_frames: 0,
          confidence: 0.55,
          method: 'sync_group_fallback',
          notes: 'Matched by sync group',
        };
        continue;
      }

      offsets[clip.id] = {
        offset_seconds: 0,
        offset_frames: 0,
        confidence: 0.2,
        method: 'fallback_zero',
        notes: clipDecoded?.error || 'No reliable sync signal found',
      };
    }

    const confidenceValues = Object.values(offsets).map((value) => value.confidence);
    const averageConfidence =
      confidenceValues.length > 0
        ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
        : 0;

    return {
      referenceClipId: referenceClip.id,
      offsets,
      averageConfidence,
    };
  }
}

export const audioSyncEngine = new AudioSyncEngine();
