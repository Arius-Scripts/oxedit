import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface LogEntry {
  id?: number;
  ts: number;
  file: string;
  entry: string;
  action: 'modify' | 'add' | 'remove' | 'revert' | 'export' | 'open';
  detail: string;
}

export interface Snapshot {
  id?: number;
  ts: number;
  file: string;
  /** Source text BEFORE the change that this snapshot lets you revert to. */
  source: string;
  label: string;
}

interface OxDB extends DBSchema {
  handles: {
    key: string;
    value: any;
  };
  logs: {
    key: number;
    value: LogEntry;
    indexes: { 'by-ts': number };
  };
  snapshots: {
    key: number;
    value: Snapshot;
    indexes: { 'by-file': string };
  };
  draftImages: {
    key: string;
    value: Blob;
  };
}

let dbPromise: Promise<IDBPDatabase<OxDB>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<OxDB>('ox-item-manager', 2, {
      upgrade(d, oldVersion) {
        if (oldVersion < 1) {
          d.createObjectStore('handles');
          const logs = d.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
          logs.createIndex('by-ts', 'ts');
          const snaps = d.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true });
          snaps.createIndex('by-file', 'file');
        }
        if (oldVersion < 2) {
          d.createObjectStore('draftImages');
        }
      },
    });
  }
  return dbPromise;
}

export interface Draft {
  folderName: string;
  ts: number;
  mode: 'handle' | 'upload';
  files: Record<string, string>;
  originals?: Record<string, string>;
}

// --- Folder handle persistence ---
export async function saveHandle(handle: any): Promise<void> {
  await (await db()).put('handles', handle, 'root');
}
export async function loadHandle(): Promise<any | undefined> {
  return (await db()).get('handles', 'root');
}
export async function clearHandle(): Promise<void> {
  await (await db()).delete('handles', 'root');
}
export async function saveDraft(draft: Draft): Promise<void> {
  await (await db()).put('handles', draft, 'draft');
}
export async function loadDraft(): Promise<Draft | undefined> {
  return (await db()).get('handles', 'draft');
}
export async function clearDraft(): Promise<void> {
  await (await db()).delete('handles', 'draft');
  await clearDraftImages();
}

export async function saveDraftImage(name: string, blob: Blob): Promise<void> {
  await (await db()).put('draftImages', blob, name);
}

export async function loadDraftImages(): Promise<{ name: string; blob: Blob }[]> {
  const d = await db();
  const keys = await d.getAllKeys('draftImages');
  const values = await d.getAll('draftImages');
  return keys.map((k, i) => ({ name: String(k), blob: values[i] }));
}

export async function clearDraftImages(): Promise<void> {
  await (await db()).clear('draftImages');
}

// --- Activity log ---
export async function addLog(entry: Omit<LogEntry, 'id'>): Promise<void> {
  await (await db()).add('logs', entry as LogEntry);
}
export async function getLogs(limit = 500): Promise<LogEntry[]> {
  const all = await (await db()).getAllFromIndex('logs', 'by-ts');
  return all.reverse().slice(0, limit);
}
export async function clearLogs(): Promise<void> {
  await (await db()).clear('logs');
}

// --- Revert snapshots ---
export async function pushSnapshot(snap: Omit<Snapshot, 'id'>): Promise<void> {
  const d = await db();
  await d.add('snapshots', snap as Snapshot);
  // Cap history at 50 per file.
  const forFile = await d.getAllFromIndex('snapshots', 'by-file', snap.file);
  if (forFile.length > 50) {
    const excess = forFile.slice(0, forFile.length - 50);
    for (const s of excess) if (s.id != null) await d.delete('snapshots', s.id);
  }
}
export async function getSnapshots(file: string): Promise<Snapshot[]> {
  const all = await (await db()).getAllFromIndex('snapshots', 'by-file', file);
  return all.reverse();
}
export async function clearSnapshots(file?: string): Promise<void> {
  const d = await db();
  if (!file) return void (await d.clear('snapshots'));
  const forFile = await d.getAllFromIndex('snapshots', 'by-file', file);
  for (const s of forFile) if (s.id != null) await d.delete('snapshots', s.id);
}
