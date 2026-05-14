import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createVersionedStorage } from '../versionedStorage';

class MemoryStorage {
  store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

interface ShapeV3 {
  count: number;
  label: string;
  tags: string[];
}

const baseConfig = (storage: MemoryStorage) => ({
  key: 'test-state',
  version: 3,
  migrations: {
    1: (v: any) => ({ count: v?.count ?? 0 }),
    2: (v: any) => ({ ...v, label: v.label ?? 'default' }),
    3: (v: any) => ({ ...v, tags: v.tags ?? [] }),
  },
  defaultValue: { count: 0, label: 'default', tags: [] } as ShapeV3,
  storage,
});

describe('Sprint 6.10 — createVersionedStorage', () => {
  let storage: MemoryStorage;
  beforeEach(() => { storage = new MemoryStorage(); });

  it('returns defaultValue when storage is empty', () => {
    const vs = createVersionedStorage<ShapeV3>(baseConfig(storage));
    expect(vs.read()).toEqual({ count: 0, label: 'default', tags: [] });
  });

  it('round-trips a value wrapped in envelope', () => {
    const vs = createVersionedStorage<ShapeV3>(baseConfig(storage));
    vs.write({ count: 5, label: 'a', tags: ['x'] });
    expect(vs.read()).toEqual({ count: 5, label: 'a', tags: ['x'] });
    expect(vs.getStoredVersion()).toBe(3);
  });

  it('migrates legacy (unwrapped) data from version 0 through 3', () => {
    // Legacy data uten envelope — ser ut som det første schema
    storage.setItem('test-state', JSON.stringify({ count: 7 }));
    const vs = createVersionedStorage<ShapeV3>(baseConfig(storage));
    const result = vs.read();
    expect(result.count).toBe(7);
    expect(result.label).toBe('default');
    expect(result.tags).toEqual([]);
  });

  it('migrates from any envelope-version up to target', () => {
    storage.setItem('test-state', JSON.stringify({ __v: 1, data: { count: 9 } }));
    const vs = createVersionedStorage<ShapeV3>(baseConfig(storage));
    expect(vs.read()).toEqual({ count: 9, label: 'default', tags: [] });
  });

  it('persists migrated value back so neste read er gratis', () => {
    storage.setItem('test-state', JSON.stringify({ __v: 1, data: { count: 4 } }));
    const vs = createVersionedStorage<ShapeV3>(baseConfig(storage));
    vs.read();
    // Etter migrering skal lagret versjon være target
    expect(vs.getStoredVersion()).toBe(3);
  });

  it('returns defaultValue when JSON is corrupt', () => {
    storage.setItem('test-state', '{not json');
    const vs = createVersionedStorage<ShapeV3>(baseConfig(storage));
    expect(vs.read()).toEqual({ count: 0, label: 'default', tags: [] });
  });

  it('returns defaultValue when stored version is in the future', () => {
    storage.setItem('test-state', JSON.stringify({ __v: 99, data: { count: 1, label: 'x', tags: [] } }));
    const vs = createVersionedStorage<ShapeV3>(baseConfig(storage));
    expect(vs.read()).toEqual({ count: 0, label: 'default', tags: [] });
  });

  it('prunes corrupted values when pruneInvalid=true', () => {
    storage.setItem('test-state', '{not json');
    const vs = createVersionedStorage<ShapeV3>({ ...baseConfig(storage), pruneInvalid: true });
    vs.read();
    expect(storage.getItem('test-state')).toBeNull();
  });

  it('calls onMigrate callback when migration runs', () => {
    storage.setItem('test-state', JSON.stringify({ __v: 1, data: { count: 5 } }));
    const onMigrate = vi.fn();
    const vs = createVersionedStorage<ShapeV3>({ ...baseConfig(storage), onMigrate });
    vs.read();
    expect(onMigrate).toHaveBeenCalledWith({
      key: 'test-state',
      fromVersion: 1,
      toVersion: 3,
    });
  });

  it('does NOT call onMigrate when version matches target', () => {
    const onMigrate = vi.fn();
    const vs = createVersionedStorage<ShapeV3>({ ...baseConfig(storage), onMigrate });
    vs.write({ count: 1, label: 'a', tags: [] });
    onMigrate.mockClear();
    vs.read();
    expect(onMigrate).not.toHaveBeenCalled();
  });

  it('clear removes the stored value', () => {
    const vs = createVersionedStorage<ShapeV3>(baseConfig(storage));
    vs.write({ count: 1, label: 'a', tags: [] });
    vs.clear();
    expect(vs.getStoredVersion()).toBeNull();
    expect(vs.read()).toEqual({ count: 0, label: 'default', tags: [] });
  });

  it('throws on config-time when target version migration is missing', () => {
    expect(() =>
      createVersionedStorage({
        key: 'bad',
        version: 5,
        migrations: { 1: (v) => v },
        defaultValue: {},
        storage,
      }),
    ).toThrow(/mangler migrasjon/);
  });

  it('falls back to defaultValue if a required intermediate migration is missing', () => {
    storage.setItem('test-state', JSON.stringify({ __v: 0, data: { count: 1 } }));
    const vs = createVersionedStorage<ShapeV3>({
      ...baseConfig(storage),
      migrations: {
        // Mangler v1, men har v2 og v3
        2: (v: any) => ({ ...v, label: 'x' }),
        3: (v: any) => ({ ...v, tags: [] }),
      } as any,
    });
    expect(vs.read()).toEqual({ count: 0, label: 'default', tags: [] });
  });
});
