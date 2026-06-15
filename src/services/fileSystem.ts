import { saveHandle, loadHandle, clearHandle } from './db';

/**
 * Minimal typings for the File System Access API (not yet in TS DOM lib in all versions).
 */
export interface FsFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{
    write(data: BufferSource | Blob | string): Promise<void>;
    close(): Promise<void>;
  }>;
}
export interface FsDirHandle {
  kind: 'directory';
  name: string;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FsFileHandle>;
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FsDirHandle>;
  values(): AsyncIterable<FsFileHandle | FsDirHandle>;
  queryPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(opts: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}

/** The ox_inventory data files we manage, in display order. */
export const DATA_FILES = ['items', 'weapons', 'shops', 'crafting', 'stashes'] as const;
export type DataFileName = (typeof DATA_FILES)[number];

export interface LoadedDataFile {
  name: DataFileName;
  source: string;
}
export interface LoadedImage {
  name: string;
  blob: Blob;
  url: string;
  size: number;
}
export interface LoadedFolder {
  handle: FsDirHandle;
  files: LoadedDataFile[];
  images: LoadedImage[];
}

export function isSupported(): boolean {
  return typeof (window as any).showDirectoryPicker === 'function';
}

async function ensurePermission(handle: FsDirHandle, mode: 'read' | 'readwrite'): Promise<boolean> {
  if (!handle.queryPermission) return true;
  if ((await handle.queryPermission({ mode })) === 'granted') return true;
  if (!handle.requestPermission) return false;
  return (await handle.requestPermission({ mode })) === 'granted';
}

/** Prompt the user to pick the ox_inventory folder. */
export async function pickFolder(): Promise<FsDirHandle> {
  const handle: FsDirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
  await saveHandle(handle);
  return handle;
}

/** Try to silently restore a previously-picked folder. */
export async function restoreFolder(): Promise<FsDirHandle | null> {
  const handle = (await loadHandle()) as FsDirHandle | undefined;
  if (!handle) return null;
  if (!(await ensurePermission(handle, 'read'))) return null;
  return handle;
}

export async function forgetFolder(): Promise<void> {
  await clearHandle();
}

async function findDir(root: FsDirHandle, parts: string[]): Promise<FsDirHandle | null> {
  let cur = root;
  for (const part of parts) {
    try {
      cur = await cur.getDirectoryHandle(part);
    } catch {
      return null;
    }
  }
  return cur;
}

/**
 * Read all data/*.lua files and web/images/*.png from the picked folder.
 * Accepts either the ox_inventory root, or a folder that directly contains data/.
 */
export async function readFolder(handle: FsDirHandle): Promise<LoadedFolder> {
  await ensurePermission(handle, 'read');

  // Locate the data directory (root/data or root itself if it IS data).
  let dataDir = await findDir(handle, ['data']);
  if (!dataDir) {
    // Maybe the user picked the data folder directly.
    try {
      await handle.getFileHandle('items.lua');
      dataDir = handle;
    } catch {
      throw new Error('Could not find a "data" folder. Pick your ox_inventory folder.');
    }
  }

  const files: LoadedDataFile[] = [];
  for (const name of DATA_FILES) {
    try {
      const fh = await dataDir.getFileHandle(`${name}.lua`);
      const file = await fh.getFile();
      files.push({ name, source: await file.text() });
    } catch {
      /* file optional, skip if missing */
    }
  }
  if (files.length === 0) {
    throw new Error('No ox_inventory data files found in data/.');
  }

  // Images: web/images (relative to root). If user picked data/, go up isn't possible,
  // so also try ../web/images implicitly by checking sibling layouts.
  const images: LoadedImage[] = [];
  const imagesDir =
    (await findDir(handle, ['web', 'images'])) || (await findDir(handle, ['images']));
  if (imagesDir) {
    for await (const entry of imagesDir.values()) {
      if (entry.kind !== 'file') continue;
      if (!/\.(png|jpe?g|webp)$/i.test(entry.name)) continue;
      const file = await (entry as FsFileHandle).getFile();
      images.push({
        name: entry.name,
        blob: file,
        url: URL.createObjectURL(file),
        size: file.size,
      });
    }
    images.sort((a, b) => a.name.localeCompare(b.name));
  }

  return { handle, files, images };
}

/**
 * Fallback for browsers without the File System Access API (Brave private windows,
 * Firefox, Safari): open a directory <input> and read the selected folder into memory.
 */
export function promptFolderUpload(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.style.display = 'none';
    input.onchange = () => {
      const files = input.files ? Array.from(input.files) : [];
      input.remove();
      resolve(files);
    };
    document.body.appendChild(input);
    input.click();
  });
}

/** Read uploaded folder Files into the same shape as readFolder (no write-back possible). */
export async function readUpload(
  fileList: File[]
): Promise<{ files: LoadedDataFile[]; images: LoadedImage[] }> {
  const rel = (f: File) => (f as any).webkitRelativePath || f.name;
  const files: LoadedDataFile[] = [];

  for (const name of DATA_FILES) {
    const match = fileList.find((f) => new RegExp(`(^|/)data/${name}\\.lua$`).test(rel(f)));
    if (match) files.push({ name, source: await match.text() });
  }
  if (files.length === 0) {
    // Maybe the user selected the data folder itself (files at root).
    for (const name of DATA_FILES) {
      const match = fileList.find((f) => rel(f) === `${name}.lua` || rel(f).endsWith(`/${name}.lua`));
      if (match) files.push({ name, source: await match.text() });
    }
  }
  if (files.length === 0) {
    throw new Error('No ox_inventory data files found. Select your ox_inventory folder.');
  }

  const images: LoadedImage[] = [];
  for (const f of fileList) {
    const path = rel(f);
    if (!/(^|\/)(web\/images|images)\/[^/]+\.(png|jpe?g|webp)$/i.test(path)) continue;
    images.push({
      name: f.name,
      blob: f,
      url: URL.createObjectURL(f),
      size: f.size,
    });
  }
  images.sort((a, b) => a.name.localeCompare(b.name));

  return { files, images };
}

/* ---------------- drag-and-drop folder traversal ----------------
 * Dropping a folder lets us walk the tree ourselves and descend ONLY into
 * data/ and web/images/, instead of forcing the browser to enumerate the whole
 * resource (as <input webkitdirectory> does). On Chromium we can also pull a real
 * directory handle for write-back; elsewhere we traverse read-only. */

interface FsEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?(ok: (f: File) => void, err: (e: any) => void): void;
  createReader?(): { readEntries(ok: (entries: FsEntry[]) => void, err: (e: any) => void): void };
  getDirectory?(path: string, opts: any, ok: (d: FsEntry) => void, err: (e: any) => void): void;
  getFile?(path: string, opts: any, ok: (f: FsEntry) => void, err: (e: any) => void): void;
}

function entryGetDir(dir: FsEntry, name: string): Promise<FsEntry | null> {
  return new Promise((resolve) => {
    if (!dir.getDirectory) return resolve(null);
    dir.getDirectory(name, {}, (d) => resolve(d), () => resolve(null));
  });
}
function fileFromEntry(fe: FsEntry): Promise<File | null> {
  return new Promise((resolve) => {
    if (!fe.file) return resolve(null);
    fe.file((f) => resolve(f), () => resolve(null));
  });
}
function entryGetFile(dir: FsEntry, name: string): Promise<File | null> {
  return new Promise((resolve) => {
    if (!dir.getFile) return resolve(null);
    dir.getFile(name, {}, (fe) => resolve(fileFromEntry(fe)), () => resolve(null));
  });
}
function entryReadAll(dir: FsEntry): Promise<FsEntry[]> {
  return new Promise((resolve) => {
    if (!dir.createReader) return resolve([]);
    const reader = dir.createReader();
    const all: FsEntry[] = [];
    const step = () =>
      reader.readEntries((batch) => {
        if (!batch.length) return resolve(all);
        all.push(...batch);
        step(); // readEntries returns in batches; keep going until empty
      }, () => resolve(all));
    step();
  });
}

export interface DroppedRoots {
  handles: Array<Promise<any> | undefined>;
  entries: Array<FsEntry | null>;
}

/**
 * Capture drop targets synchronously inside the `drop` handler. The DataTransfer
 * (and its items) become invalid once the event handler returns, so this MUST run
 * before any await. `getAsFileSystemHandle()` returns a promise we keep; `webkitGetAsEntry()`
 * returns the entry immediately.
 */
export function captureDrop(items: DataTransferItem[]): DroppedRoots {
  return {
    handles: items.map((it: any) =>
      typeof it.getAsFileSystemHandle === 'function' ? it.getAsFileSystemHandle() : undefined
    ),
    entries: items.map((it: any) =>
      typeof it.webkitGetAsEntry === 'function' ? (it.webkitGetAsEntry() as FsEntry | null) : null
    ),
  };
}

/**
 * Read a dropped folder from roots captured by `captureDrop`. Descends only into
 * data/ and web/images/. Returns a real handle (Chromium → write-back) or null
 * (read-only traversal).
 */
export async function readDrop(
  roots: DroppedRoots
): Promise<{ handle: FsDirHandle | null; files: LoadedDataFile[]; images: LoadedImage[] }> {
  // 1. Prefer a FileSystemDirectoryHandle (Chromium) so write-back keeps working.
  for (const hp of roots.handles) {
    if (!hp) continue;
    try {
      const h = await hp;
      if (h && h.kind === 'directory') {
        const loaded = await readFolder(h as FsDirHandle);
        try { await saveHandle(h); } catch { /* non-fatal */ }
        return { handle: loaded.handle, files: loaded.files, images: loaded.images };
      }
    } catch { /* fall through to read-only traversal */ }
  }

  // 2. webkitGetAsEntry traversal (Firefox/Safari + Chromium fallback), read-only.
  const rootDirs = roots.entries.filter((e): e is FsEntry => !!e && e.isDirectory);
  if (rootDirs.length === 0) throw new Error('Drop your ox_inventory folder (or its data folder).');

  let dataDir: FsEntry | null = null;
  let imagesDir: FsEntry | null = null;
  for (const root of rootDirs) {
    if (!dataDir && (root.name === 'data' || (await entryGetFile(root, 'items.lua')))) dataDir = root;
    if (!imagesDir && root.name === 'images') imagesDir = root;
    if (!dataDir) dataDir = await entryGetDir(root, 'data');
    if (!imagesDir) {
      const web = await entryGetDir(root, 'web');
      imagesDir = web ? await entryGetDir(web, 'images') : await entryGetDir(root, 'images');
    }
  }
  if (!dataDir) throw new Error('Could not find a "data" folder in what you dropped.');

  const files: LoadedDataFile[] = [];
  for (const name of DATA_FILES) {
    const f = await entryGetFile(dataDir, `${name}.lua`);
    if (f) files.push({ name, source: await f.text() });
  }
  if (files.length === 0) throw new Error('No ox_inventory data files found in data/.');

  const images: LoadedImage[] = [];
  if (imagesDir) {
    for (const e of await entryReadAll(imagesDir)) {
      if (!e.isFile || !/\.(png|jpe?g|webp)$/i.test(e.name)) continue;
      const f = await fileFromEntry(e);
      if (f) images.push({ name: e.name, blob: f, url: URL.createObjectURL(f), size: f.size });
    }
    images.sort((a, b) => a.name.localeCompare(b.name));
  }

  return { handle: null, files, images };
}

/** Write a single data file back to disk in place (requires readwrite permission). */
export async function writeBack(
  handle: FsDirHandle,
  fileName: DataFileName,
  content: string
): Promise<void> {
  if (!(await ensurePermission(handle, 'readwrite'))) {
    throw new Error('Write permission denied.');
  }
  let dataDir = await findDir(handle, ['data']);
  if (!dataDir) dataDir = handle;
  const fh = await dataDir.getFileHandle(`${fileName}.lua`, { create: true });
  const writable = await fh.createWritable();
  await writable.write(content);
  await writable.close();
}
