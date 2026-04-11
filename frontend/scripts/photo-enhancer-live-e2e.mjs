import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { request } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, "..", "..", "output", "playwright");

const args = new Map(
  process.argv.slice(2).map((arg, index, all) => {
    if (!arg.startsWith("--")) return [arg, "true"];
    const [key, inlineValue] = arg.split("=");
    return [key, inlineValue ?? all[index + 1] ?? "true"];
  }),
);

const baseUrl = String(
  args.get("--base-url") ||
    process.env.PHOTO_ENHANCER_BASE_URL ||
    "https://creatorhub-backend-rtbl.onrender.com",
).replace(/\/$/u, "");
const passes = Math.max(1, Number(args.get("--passes") || 60));

const sourceImages = [
  {
    id: "wikimedia-landscape",
    provider: "Wikimedia Commons",
    mode: "download",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Fronalpstock_big.jpg/1280px-Fronalpstock_big.jpg",
    name: "wikimedia-fronalpstock.jpg",
    mimeType: "image/jpeg",
  },
  {
    id: "unsplash-portrait",
    provider: "Unsplash",
    mode: "download",
    url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=1280&q=85",
    name: "unsplash-portrait.jpg",
    mimeType: "image/jpeg",
  },
  {
    id: "unsplash-product",
    provider: "Unsplash",
    mode: "download",
    url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1280&q=85",
    name: "unsplash-product.jpg",
    mimeType: "image/jpeg",
  },
  {
    id: "picsum-editorial",
    provider: "Lorem Picsum",
    mode: "download",
    url: "https://picsum.photos/id/1025/1280/853",
    name: "picsum-editorial.jpg",
    mimeType: "image/jpeg",
  },
  {
    id: "pixabay-tree",
    provider: "Pixabay",
    mode: "download",
    url: "https://cdn.pixabay.com/photo/2015/04/23/22/00/tree-736885_1280.jpg",
    name: "pixabay-tree-sunset.jpg",
    mimeType: "image/jpeg",
  },
  {
    id: "pixabay-model",
    provider: "Pixabay",
    mode: "download",
    url: "https://cdn.pixabay.com/photo/2017/11/02/14/26/model-2911330_1280.jpg",
    name: "pixabay-model.jpg",
    mimeType: "image/jpeg",
  },
];

const presets = [
  { preset: "auto", settings: { brightness: 2, contrast: 8, saturation: 5, sharpness: 14, denoising: 35, faceEnhancement: 0 } },
  { preset: "portrait", settings: { brightness: 4, contrast: 6, saturation: 4, sharpness: 12, denoising: 45, faceEnhancement: 85 } },
  { preset: "landscape", settings: { brightness: 1, contrast: 12, saturation: 16, sharpness: 18, denoising: 25, faceEnhancement: 0 } },
  { preset: "product", settings: { brightness: 8, contrast: 10, saturation: 6, sharpness: 20, denoising: 20, faceEnhancement: 0 } },
  { preset: "studio", settings: { brightness: 3, contrast: 9, saturation: 4, sharpness: 16, denoising: 40, faceEnhancement: 70 } },
];

async function downloadWithRequest(api, source) {
  const response = await api.get(source.url, {
    headers: {
      "user-agent": "CreatorHub Photo Enhancer E2E",
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    },
    timeout: 30_000,
  });
  if (!response.ok()) {
    throw new Error(`${source.provider} download failed with HTTP ${response.status()}`);
  }
  return Buffer.from(await response.body());
}

async function loadSources(api) {
  const loaded = [];
  for (const source of sourceImages) {
    try {
      const buffer = await downloadWithRequest(api, source);
      if (buffer.byteLength < 10_000) {
        throw new Error("image buffer too small");
      }
      loaded.push({ ...source, buffer });
    } catch (error) {
      loaded.push({
        ...source,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return loaded;
}

async function postImage(api, endpoint, source, preset) {
  return api.post(`${baseUrl}${endpoint}`, {
    multipart: {
      image: {
        name: source.name,
        mimeType: source.mimeType,
        buffer: source.buffer,
      },
      preset: preset.preset,
      settings: JSON.stringify(preset.settings),
    },
    timeout: 60_000,
  });
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const api = await request.newContext({ ignoreHTTPSErrors: true });

  try {
    const statusResponse = await api.get(`${baseUrl}/api/photo-enhancer/status`, { timeout: 30_000 });
    if (!statusResponse.ok()) {
      throw new Error(`status failed with HTTP ${statusResponse.status()}`);
    }
    const status = await statusResponse.json();
    const sources = await loadSources(api);
    const usableSources = sources.filter((source) => source.buffer);
    if (usableSources.length < 3) {
      throw new Error(`not enough external images loaded: ${JSON.stringify(sources, null, 2)}`);
    }

    const results = [];
    for (let index = 0; index < passes; index += 1) {
      const source = usableSources[index % usableSources.length];
      const preset = presets[index % presets.length];
      const analyzeStarted = Date.now();
      const analyzeResponse = await postImage(api, "/api/photo-enhancer/analyze", source, preset);
      const analyzeBody = await analyzeResponse.json().catch(() => ({}));
      if (!analyzeResponse.ok() || !analyzeBody.success) {
        throw new Error(`analyze pass ${index + 1} failed: HTTP ${analyzeResponse.status()} ${JSON.stringify(analyzeBody)}`);
      }

      const enhanceStarted = Date.now();
      const enhanceResponse = await postImage(api, "/api/photo-enhancer/enhance", source, preset);
      const enhanceBody = await enhanceResponse.json().catch(() => ({}));
      if (!enhanceResponse.ok() || !enhanceBody.success || !enhanceBody.enhancedImageUrl) {
        throw new Error(`enhance pass ${index + 1} failed: HTTP ${enhanceResponse.status()} ${JSON.stringify(enhanceBody).slice(0, 500)}`);
      }

      results.push({
        pass: index + 1,
        source: source.id,
        provider: source.provider,
        preset: preset.preset,
        analyzeMs: Date.now() - analyzeStarted,
        enhanceMs: Date.now() - enhanceStarted,
        modelUsed: enhanceBody.modelUsed,
        inferenceMode: enhanceBody.inferenceMode,
        outputMimeType: enhanceBody.output?.mimeType || null,
        perceptualHash: analyzeBody.analysis?.perceptualHash || null,
      });
    }

    const report = {
      success: true,
      baseUrl,
      requestedPasses: passes,
      completedPasses: results.length,
      generatedAt: new Date().toISOString(),
      status: {
        gfpganAvailable: Boolean(status.models?.gfpgan?.available),
        modelCount: status.models?.registry?.length || 0,
        availableModelCount: (status.models?.registry || []).filter((model) => model.available).length,
        rawAvailable: Boolean(status.rawSupport?.available),
        driveFolderCount: status.googleDrive?.folderStructure?.length || 0,
        improvementCount: status.improvements?.total || 0,
      },
      sources: sources.map((source) => ({
        id: source.id,
        provider: source.provider,
        mode: source.mode,
        ok: Boolean(source.buffer),
        bytes: source.buffer?.byteLength || 0,
        error: source.error || null,
      })),
      results,
    };

    const reportPath = path.join(outputDir, "photo-enhancer-live-e2e-report.json");
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await api.dispose();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
