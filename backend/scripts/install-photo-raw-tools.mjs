import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDir, "..");
const binDir = path.join(backendRoot, ".render-bin");
const dcrawPath = path.join(binDir, "dcraw");
const sourcePath = path.join(binDir, "dcraw.c");
const dcrawSourceUrl =
  process.env.PHOTO_ENHANCER_DCRAW_SOURCE_URL ||
  "https://dechifro.org/dcraw/dcraw.c";
const forceLocalDcraw =
  process.env.PHOTO_ENHANCER_FORCE_LOCAL_DCRAW === "1" ||
  process.env.PHOTO_ENHANCER_FORCE_LOCAL_DCRAW === "true";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.stdio || "pipe",
      cwd: options.cwd || backendRoot,
    });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${command} exited with ${code}`));
    });
  });
}

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

async function existingSystemDcraw() {
  for (const binary of ["dcraw", "dcraw_emu"]) {
    try {
      await run("which", [binary]);
      return binary;
    } catch {
      // Try the next compatible binary.
    }
  }
  return null;
}

async function main() {
  await mkdir(binDir, { recursive: true });

  if (existsSync(dcrawPath)) {
    await chmod(dcrawPath, 0o755);
    console.log("[photo-raw-tools] dcraw already installed");
    return;
  }

  const systemDcraw = forceLocalDcraw ? null : await existingSystemDcraw();
  if (systemDcraw) {
    console.log(`[photo-raw-tools] system ${systemDcraw} available`);
    return;
  }

  try {
    await run("cc", ["--version"]);
  } catch {
    console.warn("[photo-raw-tools] C compiler not available; RAW conversion will stay disabled");
    return;
  }

  try {
    console.log("[photo-raw-tools] downloading dcraw source");
    const source = await download(dcrawSourceUrl);
    await writeFile(sourcePath, source);

    const downloaded = await readFile(sourcePath, "utf8");
    if (!downloaded.includes("Dave Coffin's raw photo decoder")) {
      throw new Error("downloaded dcraw source did not pass sanity check");
    }

    console.log("[photo-raw-tools] compiling dcraw");
    await run("cc", [
      "-O3",
      "-DNO_JASPER",
      "-DNO_LCMS",
      "-DNO_JPEG",
      "-o",
      dcrawPath,
      sourcePath,
      "-lm",
    ]);
    await chmod(dcrawPath, 0o755);
    await run(dcrawPath, ["-i"]).catch(() => undefined);
    console.log(`[photo-raw-tools] installed ${dcrawPath}`);
  } catch (error) {
    await rm(dcrawPath, { force: true }).catch(() => undefined);
    console.warn(
      `[photo-raw-tools] failed to install dcraw: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

await main();
