export interface AudioLoudnessMetrics {
  integratedLufs: number | null;
  samplePeakDbfs: number | null;
  durationSeconds: number;
  channelCount: number;
}

export interface LevelMatchPlan {
  targetLufs: number | null;
  currentGainDb: number;
  previousGainDb: number;
  available: boolean;
}

type BiquadCoefficients = {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
};

const LOUDNESS_OFFSET = -0.691;
const ABSOLUTE_GATE_LUFS = -70;
const RELATIVE_GATE_LU = 10;

const finiteDb = (value: number | null): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const energyToLufs = (energy: number): number =>
  energy > 0 ? LOUDNESS_OFFSET + (10 * Math.log10(energy)) : Number.NEGATIVE_INFINITY;

const mean = (values: number[]): number =>
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

/** ITU-R BS.1770 K-weighting pre-filter, calculated for the source sample rate. */
function kWeightingShelf(sampleRate: number): BiquadCoefficients {
  const frequency = 1681.974450955533;
  const gainDb = 3.999843853973347;
  const q = 0.7071752369554196;
  const k = Math.tan(Math.PI * frequency / sampleRate);
  const vh = 10 ** (gainDb / 20);
  const vb = vh ** 0.4996667741545416;
  const denominator = 1 + (k / q) + (k * k);
  return {
    b0: (vh + (vb * k / q) + (k * k)) / denominator,
    b1: (2 * ((k * k) - vh)) / denominator,
    b2: (vh - (vb * k / q) + (k * k)) / denominator,
    a1: (2 * ((k * k) - 1)) / denominator,
    a2: (1 - (k / q) + (k * k)) / denominator,
  };
}

/** ITU-R BS.1770 RLB high-pass stage, calculated for the source sample rate. */
function kWeightingHighPass(sampleRate: number): BiquadCoefficients {
  const frequency = 38.13547087602444;
  const q = 0.5003270373238773;
  const k = Math.tan(Math.PI * frequency / sampleRate);
  const denominator = 1 + (k / q) + (k * k);
  return {
    b0: 1 / denominator,
    b1: -2 / denominator,
    b2: 1 / denominator,
    a1: (2 * ((k * k) - 1)) / denominator,
    a2: (1 - (k / q) + (k * k)) / denominator,
  };
}

function createBiquad(coefficients: BiquadCoefficients): (sample: number) => number {
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  return (sample: number) => {
    const output = (coefficients.b0 * sample)
      + (coefficients.b1 * x1)
      + (coefficients.b2 * x2)
      - (coefficients.a1 * y1)
      - (coefficients.a2 * y2);
    x2 = x1;
    x1 = sample;
    y2 = y1;
    y1 = output;
    return output;
  };
}

function channelWeight(channel: number, channelCount: number): number {
  if (channelCount === 6) {
    // Web Audio 5.1 order: L, R, C, LFE, SL, SR. BS.1770 excludes LFE and
    // applies +1.5 dB to surround channels.
    return [1, 1, 1, 0, 1.41, 1.41][channel] ?? 1;
  }
  return 1;
}

/**
 * Measure integrated loudness without changing the source audio.
 *
 * The implementation follows the BS.1770 K-weighting and two-stage gating
 * model. It deliberately reports sample peak, not true peak; true-peak QC is a
 * separate oversampled measurement and must not be implied by this result.
 */
export function analyzePcmLoudness(
  channels: readonly Float32Array[],
  sampleRate: number,
): AudioLoudnessMetrics {
  const channelCount = channels.length;
  const sampleCount = channels.reduce((shortest, channel) => Math.min(shortest, channel.length), Number.POSITIVE_INFINITY);
  const usableSamples = Number.isFinite(sampleCount) ? Math.max(0, Math.floor(sampleCount)) : 0;
  if (channelCount === 0 || usableSamples === 0 || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return { integratedLufs: null, samplePeakDbfs: null, durationSeconds: 0, channelCount };
  }

  const blockSize = Math.min(usableSamples, Math.max(1, Math.round(sampleRate * 0.4)));
  const stepSize = Math.max(1, Math.round(sampleRate * 0.1));
  const blockCount = usableSamples <= blockSize
    ? 1
    : 1 + Math.floor((usableSamples - blockSize) / stepSize);
  const blockEnergies = new Float64Array(blockCount);
  let samplePeak = 0;

  channels.forEach((channel, channelIndex) => {
    const shelf = createBiquad(kWeightingShelf(sampleRate));
    const highPass = createBiquad(kWeightingHighPass(sampleRate));
    const ring = new Float64Array(blockSize);
    let ringIndex = 0;
    let rollingEnergy = 0;
    let blockIndex = 0;
    const weight = channelWeight(channelIndex, channelCount);

    for (let index = 0; index < usableSamples; index += 1) {
      const source = Number.isFinite(channel[index]) ? channel[index] : 0;
      samplePeak = Math.max(samplePeak, Math.abs(source));
      const filtered = highPass(shelf(source));
      const squared = filtered * filtered;
      rollingEnergy += squared - ring[ringIndex];
      ring[ringIndex] = squared;
      ringIndex = (ringIndex + 1) % blockSize;

      const windowFilled = index + 1 >= blockSize;
      const onBlockBoundary = windowFilled && ((index + 1 - blockSize) % stepSize === 0);
      if (onBlockBoundary && blockIndex < blockCount) {
        blockEnergies[blockIndex] += (rollingEnergy / blockSize) * weight;
        blockIndex += 1;
      }
    }
  });

  const absoluteGated = Array.from(blockEnergies).filter((energy) => energyToLufs(energy) >= ABSOLUTE_GATE_LUFS);
  let integratedLufs: number | null = null;
  if (absoluteGated.length > 0) {
    const relativeThreshold = energyToLufs(mean(absoluteGated)) - RELATIVE_GATE_LU;
    const threshold = Math.max(ABSOLUTE_GATE_LUFS, relativeThreshold);
    const relativeGated = absoluteGated.filter((energy) => energyToLufs(energy) >= threshold);
    const measured = energyToLufs(mean(relativeGated));
    integratedLufs = Number.isFinite(measured) ? measured : null;
  }

  return {
    integratedLufs,
    samplePeakDbfs: samplePeak > 0 ? 20 * Math.log10(samplePeak) : null,
    durationSeconds: usableSamples / sampleRate,
    channelCount,
  };
}

export function levelMatchPlan(
  current: AudioLoudnessMetrics | null,
  previous: AudioLoudnessMetrics | null,
): LevelMatchPlan {
  const currentLufs = current?.integratedLufs ?? null;
  const previousLufs = previous?.integratedLufs ?? null;
  if (!finiteDb(currentLufs) || !finiteDb(previousLufs)) {
    return { targetLufs: null, currentGainDb: 0, previousGainDb: 0, available: false };
  }
  // Match down to the quieter revision. We never add gain, so the comparison
  // cannot introduce clipping merely by enabling level matching.
  const targetLufs = Math.min(currentLufs, previousLufs);
  return {
    targetLufs,
    currentGainDb: Math.min(0, targetLufs - currentLufs),
    previousGainDb: Math.min(0, targetLufs - previousLufs),
    available: true,
  };
}

export const dbToLinearGain = (db: number): number =>
  Number.isFinite(db) ? 10 ** (db / 20) : 1;

export async function analyzeAudioUrl(
  url: string,
  requestInit: RequestInit = {},
): Promise<AudioLoudnessMetrics> {
  const response = await fetch(url, requestInit);
  if (!response.ok) throw new Error(`Audio analysis failed (${response.status})`);
  const bytes = await response.arrayBuffer();
  const AudioContextConstructor = window.AudioContext
    || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) throw new Error('Web Audio is unavailable');
  const context = new AudioContextConstructor();
  try {
    const decoded = await context.decodeAudioData(bytes.slice(0));
    const channels = Array.from(
      { length: decoded.numberOfChannels },
      (_, channel) => decoded.getChannelData(channel),
    );
    return analyzePcmLoudness(channels, decoded.sampleRate);
  } finally {
    if (context.state !== 'closed') await context.close().catch(() => undefined);
  }
}
