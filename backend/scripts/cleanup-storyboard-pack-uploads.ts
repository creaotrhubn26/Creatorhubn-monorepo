/* eslint-disable no-console */
import fs from 'fs/promises';
import path from 'path';

const rootDir = path.join(process.cwd(), 'backend', 'uploads', 'storyboard-packs');
const retentionDays = Number(process.env.STORYBOARD_PACK_RETENTION_DAYS || 30);
const maxPerSlot = Number(process.env.STORYBOARD_PACK_MAX_FILES_PER_SLOT || 25);
const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

const listDirs = async (dir: string) => {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(dir, entry.name));
  } catch {
    return [];
  }
};

const cleanupSlot = async (slotDir: string) => {
  const entries = await fs.readdir(slotDir, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const fullPath = path.join(slotDir, entry.name);
        const stats = await fs.stat(fullPath);
        return { fullPath, mtimeMs: stats.mtimeMs };
      }),
  );

  const sortedNewestFirst = files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  let deleted = 0;

  for (let index = 0; index < sortedNewestFirst.length; index += 1) {
    const file = sortedNewestFirst[index];
    const overLimit = index >= maxPerSlot;
    const expired = file.mtimeMs < cutoffMs;
    if (overLimit || expired) {
      await fs.unlink(file.fullPath);
      deleted += 1;
    }
  }

  return deleted;
};

const run = async () => {
  const packDirs = await listDirs(rootDir);
  let removedCount = 0;

  for (const packDir of packDirs) {
    const slotDirs = await listDirs(packDir);
    for (const slotDir of slotDirs) {
      removedCount += await cleanupSlot(slotDir);
    }
  }

  console.log(`Storyboard upload cleanup complete. Removed ${removedCount} file(s).`);
};

run().catch((error) => {
  console.error('Storyboard upload cleanup failed:', error);
  process.exit(1);
});
