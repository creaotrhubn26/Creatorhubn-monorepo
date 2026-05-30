#!/usr/bin/env node
/**
 * @theroleroom/dit-helper — Native DIT-backup CLI
 *
 * Watcher kamera-kort-mounts på DIT-station, kopierer hver klipp-
 * fil parallelt til N konfigurerte destinasjoner, verifiserer
 * sjekksum (xxHash64), og rapporterer status real-time til The
 * Role Room backend.
 *
 * Bruk:
 *   $ dit-helper init       # interaktiv config
 *   $ dit-helper watch      # start watcher
 *   $ dit-helper status     # vis pågående jobs
 *   $ dit-helper test       # verify token + backend-connection
 *
 * Config-fil: ~/.dit-helper/config.json
 *   {
 *     "api_base":  "https://creatorhub-backend-rtbl.onrender.com",
 *     "token":     "trr_dit_xxxxxxxxxxxxxx",
 *     "project_id": "proj_xxxxx",
 *     "watch_paths": ["/Volumes"],
 *     "file_patterns": [".mxf", ".braw", ".ari", ".r3d", ".mov", ".mp4", ".wav"],
 *     "concurrency": 2
 *   }
 *
 * Compliance:
 *   - Lagrer aldri filmmateriale lokalt utenfor de konfigurerte
 *     destinasjonene
 *   - All audit-data går til vår egen backend (eier-data)
 *   - Sjekksum-algoritme: xxHash64 (industri-standard via Pomfort)
 */

import { Command } from 'commander';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

interface Config {
  api_base: string;
  token: string;
  project_id: string;
  watch_paths: string[];
  file_patterns: string[];
  concurrency: number;
}

interface Destination {
  id: string;
  destination_type: string;
  label: string;
  path: string;
  status: string;
}

interface BackupJob {
  id: string;
  destination_id: string;
  source_path: string;
  status: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.dit-helper');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const HELPER_VERSION = '0.1.0';
const HOSTNAME = os.hostname();

// ── Config-håndtering ─────────────────────────────────────────────

async function loadConfig(): Promise<Config | null> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as Config;
  } catch {
    return null;
  }
}

async function saveConfig(config: Config): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

// ── Backend-kommunikasjon ─────────────────────────────────────────

async function apiCall<T = unknown>(
  config: Config,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${config.api_base.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      'User-Agent': `dit-helper/${HELPER_VERSION} (${HOSTNAME})`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

// ── xxHash64-streamer ─────────────────────────────────────────────
// Lazy-loader xxhash-wasm. Fallback til SHA-256 hvis modulen ikke
// finnes (gjør CLI-en mer robust under utvikling).

let xxhashModule: { create64: () => unknown } | null = null;
async function loadXxhash(): Promise<{ create64: () => { update: (b: Uint8Array) => unknown; digest: () => bigint } } | null> {
  if (xxhashModule) return xxhashModule as never;
  try {
    const mod = await import('xxhash-wasm');
    xxhashModule = (await (mod as { default: () => Promise<unknown> }).default()) as never;
    return xxhashModule as never;
  } catch {
    return null;
  }
}

async function fileHashXxh64(filepath: string): Promise<string> {
  const xx = await loadXxhash();
  if (!xx) {
    // Fallback: bruk crypto SHA-256 (treg men deterministisk)
    const { createHash } = await import('node:crypto');
    const hasher = createHash('sha256');
    await pipeline(createReadStream(filepath), async function* (source) {
      for await (const chunk of source) {
        hasher.update(chunk as Buffer);
        yield chunk;
      }
    }, fsSync.createWriteStream('/dev/null'));
    return hasher.digest('hex');
  }
  const h = xx.create64();
  await pipeline(createReadStream(filepath), async function* (source) {
    for await (const chunk of source) {
      h.update(chunk as Uint8Array);
      yield chunk;
    }
  }, fsSync.createWriteStream('/dev/null'));
  return h.digest().toString(16).padStart(16, '0');
}

// ── Copy med progress ────────────────────────────────────────────

async function copyWithProgress(
  source: string,
  dest: string,
  onProgress: (bytesCopied: number) => void,
): Promise<void> {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const stats = await fs.stat(source);
  let copied = 0;
  await pipeline(
    createReadStream(source),
    async function* (src) {
      for await (const chunk of src) {
        copied += (chunk as Buffer).length;
        onProgress(copied);
        yield chunk;
      }
    },
    fsSync.createWriteStream(dest),
  );
  const destStats = await fs.stat(dest);
  if (destStats.size !== stats.size) {
    throw new Error(`Størrelse-mismatch: source=${stats.size}, dest=${destStats.size}`);
  }
}

// ── Hovedflyt: process én fil til alle destinasjoner ───────────────

async function processFile(
  config: Config,
  destinations: Destination[],
  filepath: string,
): Promise<void> {
  console.log(`\n📁 ${filepath}`);

  // 1. Hash kilde
  console.log(`   🔢 Hasher kilde...`);
  const sourceHash = await fileHashXxh64(filepath);
  const sourceSize = (await fs.stat(filepath)).size;
  console.log(`   ✓ xxh64: ${sourceHash}  (${(sourceSize / 1024 / 1024).toFixed(1)} MB)`);

  // 2. Opprett jobs for hver destinasjon
  for (const dest of destinations) {
    if (dest.status !== 'configured' && dest.status !== 'active') continue;
    if (dest.destination_type === 'original') {
      // Original = kilde-kortet selv. Vi markerer bare verified hvis hash matcher seg selv.
      const job = await apiCall<{ job: BackupJob }>(config, 'POST', '/api/dit/jobs', {
        destination_id: dest.id,
        source_path: filepath,
        source_size_bytes: sourceSize,
        source_hash: sourceHash,
        hash_algorithm: 'xxh64',
        status: 'verified',
        helper_hostname: HOSTNAME,
        helper_version: HELPER_VERSION,
      });
      await apiCall(config, 'PATCH', `/api/dit/jobs/${job.job.id}`, {
        status: 'verified',
        dest_path: filepath,
        dest_size_bytes: sourceSize,
        dest_hash: sourceHash,
        completed_at: new Date().toISOString(),
        bytes_copied: sourceSize,
      });
      console.log(`   ✓ ${dest.label} (original, in-place)`);
      continue;
    }

    if (!dest.path) {
      console.log(`   ⚠ ${dest.label} mangler path — hoppes over`);
      continue;
    }

    // Bygg destinasjons-sti: <dest.path>/<basename>
    const destPath = path.join(dest.path, path.basename(filepath));

    // Opprett job
    const { job } = await apiCall<{ job: BackupJob }>(config, 'POST', '/api/dit/jobs', {
      destination_id: dest.id,
      source_path: filepath,
      source_size_bytes: sourceSize,
      source_hash: sourceHash,
      hash_algorithm: 'xxh64',
      status: 'copying',
      helper_hostname: HOSTNAME,
      helper_version: HELPER_VERSION,
    });

    console.log(`   ⟳ ${dest.label}: kopierer...`);
    try {
      let lastReport = 0;
      await copyWithProgress(filepath, destPath, (bytes) => {
        const now = Date.now();
        if (now - lastReport > 2000) {
          lastReport = now;
          // Fire-and-forget progress-update
          apiCall(config, 'PATCH', `/api/dit/jobs/${job.id}`, {
            bytes_copied: bytes,
          }).catch(() => {});
        }
      });

      console.log(`   🔢 ${dest.label}: verifiserer hash...`);
      const destHash = await fileHashXxh64(destPath);
      const verified = destHash === sourceHash;

      await apiCall(config, 'PATCH', `/api/dit/jobs/${job.id}`, {
        status: verified ? 'verified' : 'failed',
        dest_path: destPath,
        dest_size_bytes: sourceSize,
        dest_hash: destHash,
        bytes_copied: sourceSize,
        completed_at: new Date().toISOString(),
        error_code: verified ? null : 'HASH_MISMATCH',
        error_message: verified ? null : `Source ${sourceHash} != dest ${destHash}`,
      });

      console.log(verified
        ? `   ✓ ${dest.label}: verifisert`
        : `   ✗ ${dest.label}: HASH MISMATCH — ${destHash} ≠ ${sourceHash}`);
    } catch (err) {
      await apiCall(config, 'PATCH', `/api/dit/jobs/${job.id}`, {
        status: 'failed',
        error_code: 'COPY_FAILED',
        error_message: (err as Error).message,
        completed_at: new Date().toISOString(),
      });
      console.log(`   ✗ ${dest.label}: feilet — ${(err as Error).message}`);
    }
  }
}

// ── CLI-kommandoer ────────────────────────────────────────────────

const program = new Command();
program
  .name('dit-helper')
  .description('Native DIT-backup-helper for The Role Room')
  .version(HELPER_VERSION);

program
  .command('init')
  .description('Interaktiv konfigurasjon')
  .action(async () => {
    const readline = await import('node:readline/promises');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  THE ROLE ROOM — DIT HELPER CONFIG');
    console.log('═══════════════════════════════════════════════════════════\n');
    const apiBase = (await rl.question('Backend URL [https://creatorhub-backend-rtbl.onrender.com]: ')).trim() || 'https://creatorhub-backend-rtbl.onrender.com';
    const projectId = (await rl.question('Project ID: ')).trim();
    const token = (await rl.question('Helper token (fra LiveSetMode → DIT-tab): ')).trim();
    const watchPaths = (await rl.question('Watch-stier (komma-separert) [/Volumes]: ')).trim() || '/Volumes';
    const patterns = (await rl.question('Fil-mønstre [.mxf,.braw,.ari,.r3d,.mov,.mp4,.wav]: ')).trim() || '.mxf,.braw,.ari,.r3d,.mov,.mp4,.wav';
    rl.close();

    const config: Config = {
      api_base: apiBase,
      token,
      project_id: projectId,
      watch_paths: watchPaths.split(',').map((s) => s.trim()).filter(Boolean),
      file_patterns: patterns.split(',').map((s) => s.trim()).filter(Boolean),
      concurrency: 2,
    };
    await saveConfig(config);
    console.log(`\n✓ Konfig lagret til ${CONFIG_PATH}`);
    console.log('  Kjør: dit-helper test  (for å verifisere)');
    console.log('  Kjør: dit-helper watch (for å starte)');
  });

program
  .command('test')
  .description('Verifisér token + backend-tilgang')
  .action(async () => {
    const config = await loadConfig();
    if (!config) {
      console.error('✗ Ingen config — kjør først: dit-helper init');
      process.exit(1);
    }
    console.log(`Tester mot ${config.api_base} med token ${config.token.slice(0, 12)}...`);
    try {
      // /info-endepunktet er helper-token-gated (det gamle /destinations
      // krever admin-session). /info returnerer destinasjoner + prosjekt-
      // metadata i én call.
      const result = await apiCall<{
        project: { id: string; name: string };
        destinations: Destination[];
      }>(config, 'GET', `/api/dit/projects/${config.project_id}/info`);
      console.log(`✓ Token gyldig for prosjekt "${result.project.name}".`);
      console.log(`✓ ${result.destinations.length} destinasjoner konfigurert:`);
      for (const d of result.destinations) {
        console.log(`   - [${d.destination_type}] ${d.label} → ${d.path ?? '(in-place)'}`);
      }
    } catch (err) {
      console.error(`✗ Feil: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('watch')
  .description('Start filewatcher og kopier ved nye filer')
  .action(async () => {
    const config = await loadConfig();
    if (!config) {
      console.error('✗ Ingen config — kjør først: dit-helper init');
      process.exit(1);
    }
    console.log(`👁  Watcher: ${config.watch_paths.join(', ')}`);
    console.log(`📂 Patterns: ${config.file_patterns.join(', ')}`);
    console.log(`🌐 Backend:  ${config.api_base}\n`);

    // Last destinasjoner via /info (helper-token-gated, mottar både
    // prosjekt-metadata og destinasjoner i én call)
    const { destinations } = await apiCall<{ destinations: Destination[] }>(
      config, 'GET', `/api/dit/projects/${config.project_id}/info`,
    );
    console.log(`📍 ${destinations.length} destinasjoner aktive:`);
    for (const d of destinations) {
      console.log(`   - [${d.destination_type}] ${d.label}`);
    }
    console.log('');

    // Enkel fs.watch (chokidar ville vært bedre, men holder dep-listen kort)
    const matchPattern = (filename: string): boolean => {
      const lower = filename.toLowerCase();
      return config.file_patterns.some((p) => lower.endsWith(p.toLowerCase()));
    };

    const seen = new Set<string>();
    const watchPath = async (rootPath: string) => {
      try {
        const watcher = fsSync.watch(rootPath, { recursive: true });
        for await (const event of watcher) {
          if (event.eventType !== 'rename' && event.eventType !== 'change') continue;
          if (!event.filename) continue;
          const full = path.join(rootPath, event.filename);
          if (seen.has(full)) continue;
          try {
            const stat = await fs.stat(full);
            if (!stat.isFile()) continue;
            if (!matchPattern(event.filename)) continue;
            seen.add(full);
            // Defensiv: vent 1s slik at filen er ferdig-skrevet
            await new Promise((r) => setTimeout(r, 1000));
            void processFile(config, destinations, full).catch((err) => {
              console.error(`✗ Kunne ikke prosessere ${full}: ${(err as Error).message}`);
            });
          } catch {
            // Filen kan ha forsvunnet
          }
        }
      } catch (err) {
        console.error(`✗ Watcher for ${rootPath} stoppet: ${(err as Error).message}`);
      }
    };

    for (const p of config.watch_paths) {
      void watchPath(p);
    }

    console.log('▶ Watcher startet. Ctrl+C for å stoppe.');
    // Hold prosessen i live
    await new Promise(() => {});
  });

program.parse();
