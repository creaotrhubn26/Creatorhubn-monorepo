import { spawn } from "node:child_process";
import net from "node:net";
import type { Pool } from "pg";

export type VideoQcSeverity = "error" | "warning" | "info";

export interface VideoQcFinding {
  severity: VideoQcSeverity;
  code: string;
  message: string;
  startSec?: number;
  endSec?: number;
  durationSec?: number;
  value?: number;
  target?: number;
}

export interface VideoProbeSummary {
  durationSec: number | null;
  sizeBytes: number | null;
  format: string | null;
  bitRate: number | null;
  video: {
    codec: string | null;
    width: number | null;
    height: number | null;
    frameRate: number | null;
    pixelFormat: string | null;
    colorSpace: string | null;
    colorTransfer: string | null;
  } | null;
  audio: {
    codec: string | null;
    sampleRate: number | null;
    channels: number | null;
    channelLayout: string | null;
  } | null;
}

export interface ParsedVideoQcLog {
  blackSegments: Array<{ startSec: number; endSec: number; durationSec: number }>;
  freezeSegments: Array<{ startSec: number; endSec: number; durationSec: number }>;
  silenceSegments: Array<{ startSec: number; endSec: number; durationSec: number }>;
  integratedLufs: number | null;
  truePeakDbfs: number | null;
}

type CaptionTrackRow = {
  id: string;
  language: string;
  label: string;
  status: string;
  content: string;
};

type ProcessResult = { stdout: string; stderr: string };

const finite = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const ratio = (value: unknown): number | null => {
  if (typeof value !== "string" || !value) return finite(value);
  const [numerator, denominator] = value.split("/").map(Number);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
};

const round = (value: number, places = 3): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

function collectMatches(input: string, pattern: RegExp): number[] {
  const values: number[] = [];
  for (const match of input.matchAll(pattern)) {
    const value = Number(match[1]);
    if (Number.isFinite(value)) values.push(value);
  }
  return values;
}

function pairEvents(
  starts: number[],
  ends: Array<{ endSec: number; durationSec?: number | null }>,
  mediaDurationSec?: number | null,
): Array<{ startSec: number; endSec: number; durationSec: number }> {
  const result: Array<{ startSec: number; endSec: number; durationSec: number }> = [];
  const open = [...starts];
  for (const end of ends) {
    const start = open.shift();
    const duration = finite(end.durationSec);
    const calculatedStart = start ?? (duration != null ? Math.max(0, end.endSec - duration) : null);
    if (calculatedStart == null || end.endSec < calculatedStart) continue;
    result.push({
      startSec: round(calculatedStart),
      endSec: round(end.endSec),
      durationSec: round(duration ?? end.endSec - calculatedStart),
    });
  }
  if (mediaDurationSec != null) {
    for (const start of open) {
      if (mediaDurationSec > start) {
        result.push({ startSec: round(start), endSec: round(mediaDurationSec), durationSec: round(mediaDurationSec - start) });
      }
    }
  }
  return result;
}

export function parseVideoQcLog(stderr: string, mediaDurationSec?: number | null): ParsedVideoQcLog {
  const blackSegments = Array.from(stderr.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g))
    .map((match) => ({ startSec: round(Number(match[1])), endSec: round(Number(match[2])), durationSec: round(Number(match[3])) }))
    .filter((segment) => Object.values(segment).every(Number.isFinite));

  const freezeStarts = collectMatches(stderr, /(?:lavfi\.freezedetect\.)?freeze_start:\s*([\d.]+)/g);
  const freezeEnds = Array.from(stderr.matchAll(/(?:lavfi\.freezedetect\.)?freeze_end:\s*([\d.]+)(?:\s*\|\s*(?:lavfi\.freezedetect\.)?freeze_duration:\s*([\d.]+))?/g))
    .map((match) => ({ endSec: Number(match[1]), durationSec: finite(match[2]) }));
  const freezeDurations = collectMatches(stderr, /(?:lavfi\.freezedetect\.)?freeze_duration:\s*([\d.]+)/g);
  freezeEnds.forEach((event, index) => {
    if (event.durationSec == null && freezeDurations[index] != null) event.durationSec = freezeDurations[index];
  });

  const silenceStarts = collectMatches(stderr, /silence_start:\s*([\d.]+)/g);
  const silenceEnds = Array.from(stderr.matchAll(/silence_end:\s*([\d.]+)(?:\s*\|\s*silence_duration:\s*([\d.]+))?/g))
    .map((match) => ({ endSec: Number(match[1]), durationSec: finite(match[2]) }));

  const loudnessValues = collectMatches(stderr, /\bI:\s*(-?[\d.]+)\s+LUFS/g);
  const peakValues = collectMatches(stderr, /\bPeak:\s*(-?[\d.]+)\s+dBFS/g);

  return {
    blackSegments,
    freezeSegments: pairEvents(freezeStarts, freezeEnds, mediaDurationSec),
    silenceSegments: pairEvents(silenceStarts, silenceEnds, mediaDurationSec),
    integratedLufs: loudnessValues.at(-1) ?? null,
    truePeakDbfs: peakValues.at(-1) ?? null,
  };
}

export function parseVideoProbeJson(raw: string): VideoProbeSummary {
  let value: any;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("video_qc_probe_invalid_json");
  }
  const streams = Array.isArray(value?.streams) ? value.streams : [];
  const video = streams.find((stream: any) => stream?.codec_type === "video");
  const audio = streams.find((stream: any) => stream?.codec_type === "audio");
  const durationSec = finite(value?.format?.duration) ?? finite(video?.duration) ?? finite(audio?.duration);
  return {
    durationSec,
    sizeBytes: finite(value?.format?.size),
    format: typeof value?.format?.format_name === "string" ? value.format.format_name.slice(0, 120) : null,
    bitRate: finite(value?.format?.bit_rate),
    video: video ? {
      codec: typeof video.codec_name === "string" ? video.codec_name.slice(0, 80) : null,
      width: finite(video.width),
      height: finite(video.height),
      frameRate: ratio(video.avg_frame_rate) ?? ratio(video.r_frame_rate),
      pixelFormat: typeof video.pix_fmt === "string" ? video.pix_fmt.slice(0, 80) : null,
      colorSpace: typeof video.color_space === "string" ? video.color_space.slice(0, 80) : null,
      colorTransfer: typeof video.color_transfer === "string" ? video.color_transfer.slice(0, 80) : null,
    } : null,
    audio: audio ? {
      codec: typeof audio.codec_name === "string" ? audio.codec_name.slice(0, 80) : null,
      sampleRate: finite(audio.sample_rate),
      channels: finite(audio.channels),
      channelLayout: typeof audio.channel_layout === "string" ? audio.channel_layout.slice(0, 80) : null,
    } : null,
  };
}

function parseVttTimestamp(raw: string): number | null {
  const values = raw.trim().replace(",", ".").split(":").map(Number);
  if (values.some((value) => !Number.isFinite(value))) return null;
  if (values.length === 3) return values[0] * 3600 + values[1] * 60 + values[2];
  if (values.length === 2) return values[0] * 60 + values[1];
  return null;
}

export function inspectCaptionTracks(tracks: CaptionTrackRow[], profile: string): {
  metrics: Record<string, unknown>;
  findings: VideoQcFinding[];
} {
  const findings: VideoQcFinding[] = [];
  const readyTracks = tracks.filter((track) => track.status === "ready" && track.content.trim());
  const captionRequired = ["client_delivery", "broadcast", "social"].includes(profile);
  if (captionRequired && tracks.length === 0) {
    findings.push({ severity: "warning", code: "captions_missing", message: "Leveransen har ingen caption-spor." });
  }
  const failedTracks = tracks.filter((track) => ["error", "failed"].includes(track.status));
  if (failedTracks.length) {
    findings.push({ severity: "error", code: "captions_failed", message: `${failedTracks.length} caption-spor har feilet.` });
  }

  let cueCount = 0;
  let invalidCueCount = 0;
  let overlapCount = 0;
  let fastCueCount = 0;
  let longLineCount = 0;
  for (const track of readyTracks) {
    const cues: Array<{ startSec: number; endSec: number; text: string }> = [];
    const blocks = track.content.replace(/^\uFEFF/, "").split(/\r?\n\r?\n+/);
    for (const block of blocks) {
      const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const timingIndex = lines.findIndex((line) => line.includes("-->"));
      if (timingIndex < 0) continue;
      const [startRaw, endRawWithSettings] = lines[timingIndex].split("-->");
      const startSec = parseVttTimestamp(startRaw || "");
      const endSec = parseVttTimestamp(endRawWithSettings?.trim().split(/\s+/)[0] || "");
      const cueText = lines.slice(timingIndex + 1).join(" ").replace(/<[^>]+>/g, "").trim();
      if (startSec == null || endSec == null || endSec <= startSec || !cueText) {
        invalidCueCount += 1;
        continue;
      }
      cues.push({ startSec, endSec, text: cueText });
      const duration = endSec - startSec;
      if (cueText.replace(/\s/g, "").length / duration > 20) fastCueCount += 1;
      if (lines.slice(timingIndex + 1).some((line) => line.replace(/<[^>]+>/g, "").length > 42)) longLineCount += 1;
    }
    cues.sort((a, b) => a.startSec - b.startSec);
    cueCount += cues.length;
    for (let index = 1; index < cues.length; index += 1) {
      if (cues[index].startSec < cues[index - 1].endSec - 0.05) overlapCount += 1;
    }
  }

  if (invalidCueCount) findings.push({ severity: "error", code: "captions_invalid_cues", message: `${invalidCueCount} captions har ugyldig timing eller tom tekst.` });
  if (overlapCount) findings.push({ severity: "warning", code: "captions_overlap", message: `${overlapCount} captions overlapper hverandre.` });
  if (fastCueCount) findings.push({ severity: "warning", code: "captions_too_fast", message: `${fastCueCount} captions går raskere enn 20 tegn per sekund.` });
  if (longLineCount) findings.push({ severity: "warning", code: "captions_long_lines", message: `${longLineCount} caption-linjer er lengre enn 42 tegn.` });

  return {
    metrics: { trackCount: tracks.length, readyTrackCount: readyTracks.length, cueCount, invalidCueCount, overlapCount, fastCueCount, longLineCount },
    findings,
  };
}

function runProcess(binary: string, args: string[], timeoutMs: number, maxOutputBytes: number): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const append = (current: string, chunk: Buffer): string => {
      const next = current + chunk.toString("utf8");
      return next.length > maxOutputBytes ? next.slice(next.length - maxOutputBytes) : next;
    };
    child.stdout.on("data", (chunk: Buffer) => { stdout = append(stdout, chunk); });
    child.stderr.on("data", (chunk: Buffer) => { stderr = append(stderr, chunk); });
    child.once("error", (error: NodeJS.ErrnoException) => reject(new Error(error.code === "ENOENT" ? "video_qc_binary_missing" : "video_qc_process_start_failed")));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    timer.unref?.();
    child.once("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return reject(new Error("video_qc_process_timeout"));
      if (code !== 0) return reject(new Error(`video_qc_process_exit_${code ?? "unknown"}`));
      resolve({ stdout, stderr });
    });
  });
}

function allowedLegacyHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (!normalized || normalized === "localhost" || net.isIP(normalized)) return false;
  const configured = String(process.env.VIDEO_QC_ALLOWED_MEDIA_HOSTS || "")
    .split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  const defaults = ["creatorhubn.com", "theroleroom.com", "cloudflarestream.com", "backblazeb2.com", "amazonaws.com"];
  return [...defaults, ...configured].some((host) => normalized === host || normalized.endsWith(`.${host}`));
}

export function isTrustedLegacyVideoUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") && allowedLegacyHost(url.hostname);
  } catch {
    return false;
  }
}

async function resolveSource(version: any): Promise<{ url: string; kind: "stream" | "object" | "legacy" }> {
  if (version.stream_uid) {
    const { signStreamPlaybackUrl } = await import("./cloudflare-stream-service.js");
    const url = await signStreamPlaybackUrl(version.stream_uid, 4 * 60 * 60);
    if (url) return { url, kind: "stream" };
  }
  if (version.b2_key) {
    const { presignRoleRoomB2Download } = await import("./b2-archive-helper.js");
    const signed = await presignRoleRoomB2Download(version.b2_key, undefined, 4 * 60 * 60);
    if (signed?.startsWith("/")) {
      const localBase = `http://127.0.0.1:${process.env.PORT || "5000"}`;
      return { url: new URL(signed, localBase).toString(), kind: "object" };
    }
    if (signed) return { url: signed, kind: "object" };
  }
  if (typeof version.file_url === "string" && isTrustedLegacyVideoUrl(version.file_url)) {
    return { url: version.file_url, kind: "legacy" };
  }
  throw new Error(version.file_url ? "video_qc_legacy_source_not_allowlisted" : "video_qc_source_missing");
}

function profileLoudness(profile: string): { target: number; tolerance: number; maxPeak: number } {
  if (profile === "broadcast") return { target: -23, tolerance: 1, maxPeak: -1 };
  if (profile === "client_delivery") return { target: -16, tolerance: 2, maxPeak: -1 };
  return { target: -14, tolerance: 2, maxPeak: -1 };
}

function mediaFindings(probe: VideoProbeSummary, analysis: ParsedVideoQcLog, profile: string): VideoQcFinding[] {
  const findings: VideoQcFinding[] = [];
  if (!probe.video) findings.push({ severity: "error", code: "video_stream_missing", message: "Filen inneholder ingen videostrøm." });
  if (!probe.audio) findings.push({ severity: "warning", code: "audio_stream_missing", message: "Filen inneholder ingen lydstrøm." });
  if (probe.video?.width && probe.video?.height && (probe.video.width < 1280 || probe.video.height < 720)) {
    findings.push({ severity: "warning", code: "resolution_below_hd", message: `Leveransen er ${probe.video.width}×${probe.video.height}, under HD.` });
  }
  if (probe.video?.width && probe.video?.height && probe.video.width < probe.video.height && profile !== "social") {
    findings.push({ severity: "warning", code: "portrait_delivery", message: `Leveransen er stående (${probe.video.width}×${probe.video.height}); bekreft leveranseformatet.` });
  }
  for (const segment of analysis.blackSegments.slice(0, 100)) {
    findings.push({ severity: "warning", code: "black_segment", message: `Svart bilde i ${segment.durationSec.toFixed(1)} sekunder.`, ...segment });
  }
  for (const segment of analysis.freezeSegments.slice(0, 100)) {
    findings.push({ severity: "warning", code: "freeze_segment", message: `Mulig frosset bilde i ${segment.durationSec.toFixed(1)} sekunder.`, ...segment });
  }
  for (const segment of analysis.silenceSegments.slice(0, 100)) {
    findings.push({ severity: "warning", code: "silence_segment", message: `Stillhet i ${segment.durationSec.toFixed(1)} sekunder.`, ...segment });
  }
  const loudness = profileLoudness(profile);
  if (probe.audio && analysis.integratedLufs == null) {
    findings.push({ severity: "warning", code: "loudness_unavailable", message: "Integrert loudness kunne ikke måles." });
  } else if (analysis.integratedLufs != null && Math.abs(analysis.integratedLufs - loudness.target) > loudness.tolerance) {
    findings.push({ severity: "warning", code: "loudness_outside_target", message: `Integrert loudness er ${analysis.integratedLufs.toFixed(1)} LUFS; mål for profilen er ${loudness.target} LUFS.`, value: analysis.integratedLufs, target: loudness.target });
  }
  if (analysis.truePeakDbfs != null && analysis.truePeakDbfs > loudness.maxPeak) {
    findings.push({ severity: "warning", code: "true_peak_too_high", message: `True peak er ${analysis.truePeakDbfs.toFixed(1)} dBFS; maksimum er ${loudness.maxPeak} dBFS.`, value: analysis.truePeakDbfs, target: loudness.maxPeak });
  }
  return findings;
}

export async function processProjectVideoQc(pool: Pool, qcResultId: string): Promise<Record<string, unknown>> {
  const row = await pool.query(
    `SELECT qc.id,qc.project_id,qc.version_id,qc.profile,version.file_url,version.b2_key,version.stream_uid,
            version.duration,version.size_bytes,version.content_type
       FROM project_video_qc_results qc
       JOIN project_video_versions version ON version.id=qc.version_id AND version.project_id=qc.project_id
      WHERE qc.id=$1 LIMIT 1`,
    [qcResultId],
  );
  const job = row.rows[0];
  if (!job) throw new Error("video_qc_result_not_found");

  const existing = await pool.query(`SELECT status FROM project_video_qc_results WHERE id=$1`, [qcResultId]);
  if (["passed", "warning", "failed"].includes(existing.rows[0]?.status)) return { qcResultId, alreadyCompleted: true };

  const source = await resolveSource(job);
  const ffprobe = process.env.FFPROBE_PATH || "ffprobe";
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  const probeOutput = await runProcess(ffprobe, [
    "-v", "error", "-print_format", "json", "-show_format", "-show_streams", source.url,
  ], 90_000, 2 * 1024 * 1024);
  const probe = parseVideoProbeJson(probeOutput.stdout);

  let analysis: ParsedVideoQcLog = { blackSegments: [], freezeSegments: [], silenceSegments: [], integratedLufs: null, truePeakDbfs: null };
  if (probe.video || probe.audio) {
    const args = ["-nostdin", "-hide_banner", "-nostats", "-loglevel", "info", "-i", source.url];
    if (probe.video) args.push("-map", "0:v:0", "-vf", "blackdetect=d=2:pix_th=0.02,freezedetect=n=0.003:d=3");
    else args.push("-vn");
    if (probe.audio) args.push("-map", "0:a:0", "-af", "silencedetect=n=-50dB:d=3,ebur128=peak=true:framelog=quiet");
    else args.push("-an");
    args.push("-f", "null", "-");
    const maxMinutes = Math.max(10, Math.min(240, Number(process.env.VIDEO_QC_TIMEOUT_MINUTES) || 120));
    const output = await runProcess(ffmpeg, args, maxMinutes * 60_000, 16 * 1024 * 1024);
    analysis = parseVideoQcLog(output.stderr, probe.durationSec);
  }

  const captionRows = await pool.query<CaptionTrackRow>(
    `SELECT id,language,label,status,content FROM project_video_caption_tracks WHERE version_id=$1 ORDER BY language`,
    [job.version_id],
  ).catch(() => ({ rows: [] as CaptionTrackRow[] }));
  const captions = inspectCaptionTracks(captionRows.rows, job.profile);
  const cloudflare = job.stream_uid
    ? await import("./cloudflare-stream-service.js").then(({ getStreamVideoStatus }) => getStreamVideoStatus(job.stream_uid)).catch(() => null)
    : null;
  const findings = [...mediaFindings(probe, analysis, job.profile), ...captions.findings].slice(0, 500);
  const errorCount = findings.filter((finding) => finding.severity === "error").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;
  const status = errorCount ? "failed" : warningCount ? "warning" : "passed";
  const summary = {
    findingCount: findings.length,
    errorCount,
    warningCount,
    duration: probe.durationSec,
    width: probe.video?.width ?? null,
    height: probe.video?.height ?? null,
    integratedLufs: analysis.integratedLufs,
    truePeakDbfs: analysis.truePeakDbfs,
    blackSegmentCount: analysis.blackSegments.length,
    freezeSegmentCount: analysis.freezeSegments.length,
    silenceSegmentCount: analysis.silenceSegments.length,
    captionCueCount: captions.metrics.cueCount,
  };
  const safeProbe = {
    sourceKind: source.kind,
    media: probe,
    analysis: {
      blackSegments: analysis.blackSegments.slice(0, 200),
      freezeSegments: analysis.freezeSegments.slice(0, 200),
      silenceSegments: analysis.silenceSegments.slice(0, 200),
      integratedLufs: analysis.integratedLufs,
      truePeakDbfs: analysis.truePeakDbfs,
    },
    captions: captions.metrics,
    cloudflare: cloudflare ? {
      ready: cloudflare.ready,
      state: cloudflare.state,
      duration: cloudflare.duration,
      width: cloudflare.width,
      height: cloudflare.height,
      inputSizeBytes: cloudflare.inputSizeBytes,
    } : null,
  };
  await pool.query(
    `UPDATE project_video_qc_results
        SET status=$2,summary=$3::jsonb,findings=$4::jsonb,probe=$5::jsonb,completed_at=NOW()
      WHERE id=$1`,
    [qcResultId, status, JSON.stringify(summary), JSON.stringify(findings), JSON.stringify(safeProbe)],
  );
  return { qcResultId, status, ...summary };
}
