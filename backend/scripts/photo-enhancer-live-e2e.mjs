#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import sharp from "sharp";

const DEFAULT_BASE_URL = "https://creatorhub-backend-rtbl.onrender.com";
const DEFAULT_RAW_URL =
  "https://raw.pixls.us/getfile.php/129/nice/Canon%20-%20EOS%207D%20-%20sRAW2%20%28sRAW%29%20%283%3A2%29.CR2";
const DEFAULT_HEIC_URL = "https://raw.githubusercontent.com/strukturag/libheif/master/examples/example.heic";
const DEFAULT_JPEG_URL = "https://picsum.photos/seed/creatorhub-photo-enhancer-e2e/1280/853.jpg";

const baseUrl = (process.env.PHOTO_ENHANCER_E2E_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/u, "");
const passes = Math.max(1, Number(process.env.PHOTO_ENHANCER_E2E_PASSES || 15));
const timeoutMs = Math.max(10_000, Number(process.env.PHOTO_ENHANCER_E2E_TIMEOUT_MS || 180_000));
const gfpganEvery = Math.max(0, Number(process.env.PHOTO_ENHANCER_E2E_GFPGAN_EVERY || 5));

async function fetchBuffer(url, label) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`${label} download failed with HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function postImage(route, sample, settings) {
  const form = new FormData();
  form.append(
    "image",
    new File([sample.buffer], sample.filename, { type: sample.mimeType }),
  );
  form.append("preset", settings.preset);
  form.append("settings", JSON.stringify(settings.settings));

  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 500) };
  }

  return {
    ok: response.ok,
    status: response.status,
    durationMs: Date.now() - startedAt,
    body,
  };
}

function summarizeAnalyze(body) {
  return {
    processedMimeType: body?.analysis?.processedMimeType ?? null,
    format: body?.analysis?.format ?? null,
    width: body?.analysis?.width ?? null,
    height: body?.analysis?.height ?? null,
    raw: body?.analysis?.raw ?? null,
    hash: Boolean(body?.analysis?.perceptualHash),
    gfpganInferenceAvailable: Boolean(body?.models?.gfpgan?.inferenceAvailable),
  };
}

function summarizeEnhance(body) {
  return {
    modelUsed: body?.modelUsed ?? null,
    inferenceMode: body?.inferenceMode ?? null,
    processingMs: body?.processingMs ?? null,
    raw: body?.raw ?? null,
    outputMimeType: body?.output?.mimeType ?? null,
    hasOutput: Boolean(body?.enhancedImageUrl || body?.imageUrl || body?.outputUrl),
  };
}

async function buildSamples(tempDir) {
  const jpegBuffer = await fetchBuffer(process.env.PHOTO_ENHANCER_E2E_JPEG_URL || DEFAULT_JPEG_URL, "JPEG sample");
  const jpegPath = path.join(tempDir, "sample.jpg");
  await writeFile(jpegPath, jpegBuffer);

  const pngBuffer = await sharp(jpegBuffer).png({ compressionLevel: 8 }).toBuffer();
  const pngPath = path.join(tempDir, "sample.png");
  await writeFile(pngPath, pngBuffer);

  const heicBuffer = await fetchBuffer(process.env.PHOTO_ENHANCER_E2E_HEIC_URL || DEFAULT_HEIC_URL, "HEIC sample");
  const heicPath = path.join(tempDir, "sample.heic");
  await writeFile(heicPath, heicBuffer);

  const rawBuffer = await fetchBuffer(process.env.PHOTO_ENHANCER_E2E_RAW_URL || DEFAULT_RAW_URL, "RAW sample");
  const rawPath = path.join(tempDir, "sample.CR2");
  await writeFile(rawPath, rawBuffer);

  return [
    { kind: "jpeg", filename: "photo-enhancer-e2e.jpg", mimeType: "image/jpeg", buffer: await readFile(jpegPath) },
    { kind: "png", filename: "photo-enhancer-e2e.png", mimeType: "image/png", buffer: await readFile(pngPath) },
    { kind: "heic", filename: "photo-enhancer-e2e.heic", mimeType: "image/heic", buffer: await readFile(heicPath) },
    { kind: "raw", filename: "photo-enhancer-e2e.CR2", mimeType: "image/x-canon-cr2", buffer: await readFile(rawPath) },
  ];
}

async function main() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "creatorhub-photo-enhancer-e2e-"));
  const startedAt = new Date().toISOString();
  const results = [];

  try {
    const samples = await buildSamples(tempDir);

    for (let index = 0; index < passes; index += 1) {
      const sample = samples[index % samples.length];
      const useGfpgan = gfpganEvery > 0 && (index + 1) % gfpganEvery === 0 && sample.kind === "jpeg";
      const settings = useGfpgan
        ? {
            preset: "portrait",
            settings: { brightness: 4, contrast: 6, saturation: 4, sharpness: 12, denoising: 45, faceEnhancement: 85 },
          }
        : {
            preset: "product",
            settings: { brightness: 4, contrast: 8, saturation: 6, sharpness: 15, denoising: 35, faceEnhancement: 0 },
          };

      const analyze = await postImage("/api/photo-enhancer/analyze", sample, settings);
      const enhance = analyze.ok
        ? await postImage("/api/photo-enhancer/enhance", sample, settings)
        : {
            ok: false,
            status: 0,
            durationMs: 0,
            body: { skipped: "analyze_failed" },
          };

      results.push({
        pass: index + 1,
        sample: sample.kind,
        filename: sample.filename,
        bytes: sample.buffer.byteLength,
        gfpganRequested: useGfpgan,
        analyze: {
          ok: analyze.ok,
          status: analyze.status,
          durationMs: analyze.durationMs,
          summary: summarizeAnalyze(analyze.body),
          error: analyze.ok ? null : analyze.body,
        },
        enhance: {
          ok: enhance.ok,
          status: enhance.status,
          durationMs: enhance.durationMs,
          summary: summarizeEnhance(enhance.body),
          error: enhance.ok ? null : enhance.body,
        },
      });
    }

    const failed = results.filter((result) => !result.analyze.ok || !result.enhance.ok);
    const byFormat = results.reduce((acc, result) => {
      acc[result.sample] ||= { total: 0, passed: 0, failed: 0 };
      acc[result.sample].total += 1;
      if (result.analyze.ok && result.enhance.ok) acc[result.sample].passed += 1;
      else acc[result.sample].failed += 1;
      return acc;
    }, {});

    const summary = {
      success: failed.length === 0,
      baseUrl,
      startedAt,
      completedAt: new Date().toISOString(),
      passes,
      passed: passes - failed.length,
      failed: failed.length,
      byFormat,
      sources: {
        jpeg: process.env.PHOTO_ENHANCER_E2E_JPEG_URL || DEFAULT_JPEG_URL,
        png: "generated from jpeg sample through sharp",
        heic: process.env.PHOTO_ENHANCER_E2E_HEIC_URL || DEFAULT_HEIC_URL,
        raw: process.env.PHOTO_ENHANCER_E2E_RAW_URL || DEFAULT_RAW_URL,
      },
      results,
    };

    console.log(JSON.stringify(summary, null, 2));
    if (!summary.success) process.exitCode = 1;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
