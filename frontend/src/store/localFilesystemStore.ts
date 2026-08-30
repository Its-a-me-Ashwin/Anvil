import { create } from 'zustand';

const DB_NAME = 'anvil-filesystem';
const STORE_NAME = 'handles';
const ROOT_KEY = 'rootHandle';
const ROOT_PATH_KEY = 'anvil-project-root-path';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandle(handle: FileSystemDirectoryHandle | null) {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  if (handle) {
    store.put(handle, ROOT_KEY);
  } else {
    store.delete(ROOT_KEY);
  }
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(ROOT_KEY);
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

function saveRootPath(path: string | null) {
  if (path) localStorage.setItem(ROOT_PATH_KEY, path);
  else localStorage.removeItem(ROOT_PATH_KEY);
}

function loadRootPath(): string | null {
  return localStorage.getItem(ROOT_PATH_KEY);
}

interface LocalFilesystemState {
  rootHandle: FileSystemDirectoryHandle | null;
  rootName: string | null;
  rootPath: string | null;
  isReady: boolean;
  pickRoot: () => Promise<void>;
  setRoot: (handle: FileSystemDirectoryHandle, path?: string) => void;
  setRootPath: (path: string) => void;
  clearRoot: () => void;
}

export const useLocalFilesystemStore = create<LocalFilesystemState>((set) => ({
  rootHandle: null,
  rootName: null,
  rootPath: loadRootPath(),
  isReady: false,

  pickRoot: async () => {
    // @ts-ignore — File System Access API may not be in all DOM lib versions
    const handle = await window.showDirectoryPicker();
    set({ rootHandle: handle, rootName: handle.name, isReady: true });
    await saveHandle(handle);
  },

  setRoot: (handle, path) => {
    set({ rootHandle: handle, rootName: handle.name, isReady: true });
    if (path) {
      set({ rootPath: path });
      saveRootPath(path);
    }
    saveHandle(handle);
  },

  setRootPath: (path) => {
    set({ rootPath: path });
    saveRootPath(path);
  },

  clearRoot: () => {
    set({ rootHandle: null, rootName: null, rootPath: null, isReady: false });
    saveHandle(null);
    saveRootPath(null);
  },
}));

// Hydrate the stored handle on app start.
loadHandle().then((handle) => {
  if (handle) {
    useLocalFilesystemStore.getState().setRoot(handle);
  } else {
    useLocalFilesystemStore.setState({ isReady: true });
  }
});
