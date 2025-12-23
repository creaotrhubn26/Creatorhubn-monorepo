export type UserLibraryAsset = {
  id: string;
  type: 'light' | 'model' | 'prop';
  title: string;
  tags?: string[];
  thumbDataUrl?: string;
  modelUrl?: string; // blob URL if uploaded model
  data?: any;
};

const DB_NAME = 'ch_user_library';
const STORE = 'assets';

function openDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function saveUserAsset(asset: UserLibraryAsset): Promise<void> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE , 'readwrite');
    tx.objectStore(STORE).put(asset);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function listUserAssets(): Promise<UserLibraryAsset[]> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => res(req.result as UserLibraryAsset[]);
    req.onerror = () => rej(req.error);
  });
}

export async function deleteUserAsset(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function renameUserAsset(id: string, title: string): Promise<void> {
  const items = await listUserAssets();
  const item = items.find((i) => i.id === id);
  if (!item) return;
  item.title = title;
  await saveUserAsset(item);
}
