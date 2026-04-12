import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDir, "..");
const modelDir = path.resolve(
  process.env.PHOTO_ENHANCER_FACE_API_MODELS_DIR || path.join(backendRoot, "models", "face-api"),
);
const sourceBaseUrl =
  process.env.PHOTO_ENHANCER_FACE_API_MODEL_BASE_URL ||
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";
const skipInstall =
  process.env.PHOTO_ENHANCER_SKIP_FACE_API_MODEL_INSTALL === "1" ||
  process.env.PHOTO_ENHANCER_SKIP_FACE_API_MODEL_INSTALL === "true";
const requireInstall =
  process.env.PHOTO_ENHANCER_FACE_API_MODEL_INSTALL_REQUIRED !== "0" &&
  process.env.PHOTO_ENHANCER_FACE_API_MODEL_INSTALL_REQUIRED !== "false";

const modelFiles = [
  {
    name: "tiny_face_detector_model-weights_manifest.json",
    minBytes: 500,
    type: "json",
  },
  {
    name: "tiny_face_detector_model-shard1",
    minBytes: 100_000,
    type: "binary",
  },
  {
    name: "face_landmark_68_tiny_model-weights_manifest.json",
    minBytes: 500,
    type: "json",
  },
  {
    name: "face_landmark_68_tiny_model-shard1",
    minBytes: 40_000,
    type: "binary",
  },
];

function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          download(new URL(response.headers.location, url).toString())
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`download failed with HTTP ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

async function validateModelFile(file) {
  const filePath = path.join(modelDir, file.name);
  if (!existsSync(filePath)) return false;
  const data = await readFile(filePath);
  if (data.byteLength < file.minBytes) return false;
  if (file.type === "json") {
    const parsed = JSON.parse(data.toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length === 0) return false;
  }
  return true;
}

async function downloadWithRetries(file) {
  const targetPath = path.join(modelDir, file.name);
  const url = `${sourceBaseUrl.replace(/\/$/u, "")}/${file.name}`;
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const data = await download(url);
      if (data.byteLength < file.minBytes) {
        throw new Error(`downloaded file is too small (${data.byteLength} bytes)`);
      }
      if (file.type === "json") JSON.parse(data.toString("utf8"));
      await writeFile(targetPath, data);
      if (!(await validateModelFile(file))) {
        throw new Error("downloaded file failed validation after write");
      }
      return;
    } catch (error) {
      lastError = error;
      await rm(targetPath, { force: true }).catch(() => undefined);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_500));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`failed to download ${file.name}`);
}

async function main() {
  if (skipInstall) {
    console.log("[face-api-models] install skipped by PHOTO_ENHANCER_SKIP_FACE_API_MODEL_INSTALL");
    return;
  }

  await mkdir(modelDir, { recursive: true });

  const missing = [];
  for (const file of modelFiles) {
    if (!(await validateModelFile(file).catch(() => false))) missing.push(file);
  }

  if (missing.length === 0) {
    console.log(`[face-api-models] models already installed in ${modelDir}`);
    return;
  }

  try {
    for (const file of missing) {
      console.log(`[face-api-models] downloading ${file.name}`);
      await downloadWithRetries(file);
    }
    console.log(`[face-api-models] installed ${modelFiles.length} files in ${modelDir}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (requireInstall) {
      throw new Error(`[face-api-models] required install failed: ${message}`);
    }
    console.warn(`[face-api-models] optional install failed: ${message}`);
  }
}

await main();
