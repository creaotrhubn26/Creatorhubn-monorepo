import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { ValidationError } from '../shared/errors.js';
import type { ObjectStorage, StoredObject } from './port.js';

/**
 * Lokal disk-adapter. Nøkler hashes til en fast katalogstruktur, så
 * brukerstyrte nøkler kan aldri gi path traversal. MIME-typen lagres i en
 * sidecar-fil. Ikke ment for produksjon (ingen redundans) — se port.ts.
 */
export class LocalObjectStorage implements ObjectStorage {
  readonly name = 'local-disk';
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = resolve(baseDir);
  }

  private pathFor(key: string): string {
    if (!key || key.includes('\0')) throw new ValidationError('Ugyldig lagringsnøkkel.');
    const digest = createHash('sha256').update(key).digest('hex');
    const path = join(this.baseDir, digest.slice(0, 2), digest.slice(2, 4), digest);
    // Forsvar i dybden: resultatet skal alltid ligge under baseDir.
    if (!path.startsWith(this.baseDir + sep)) {
      throw new ValidationError('Ugyldig lagringsnøkkel.');
    }
    return path;
  }

  async put(key: string, content: Buffer, mimeType: string): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
    await writeFile(`${path}.mime`, mimeType, 'utf8');
  }

  async get(key: string): Promise<StoredObject | null> {
    const path = this.pathFor(key);
    try {
      const [content, mimeType] = await Promise.all([
        readFile(path),
        readFile(`${path}.mime`, 'utf8').catch(() => 'application/octet-stream'),
      ]);
      return { content, mimeType };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }
}
