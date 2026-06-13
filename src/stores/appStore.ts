import { create } from 'zustand';
import type { FileModel } from '@/engine/fieldMap';
import {
  modelFromSource,
  applyFormEdits,
  addEntry,
  deleteEntry,
  replaceEntryTable,
  type FieldEdit,
} from '@/engine/editModel';
import {
  DATA_FILES,
  type DataFileName,
  type FsDirHandle,
  type LoadedImage,
  pickFolder,
  restoreFolder,
  readFolder,
  readUpload,
  readDrop,
  type DroppedRoots,
  promptFolderUpload,
  writeBack,
  forgetFolder,
  isSupported,
  type LoadedDataFile,
} from '@/services/fileSystem';
import { buildZip, downloadBlob, type ZipEntry } from '@/services/zipExport';
import { DEMO_FILES, buildDemoImages } from '@/data/demo';
import * as db from '@/services/db';

export interface FileState {
  name: DataFileName;
  original: string;
  current: string;
  model: FileModel;
  hash: string;
  dirty: boolean;
}

export interface ImageState extends LoadedImage {
  optimized?: Blob;
  optimizedUrl?: string;
  removed?: boolean;
  added?: boolean;
}

interface AppState {
  supported: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  handle: FsDirHandle | null;
  demo: boolean;

  files: Partial<Record<DataFileName, FileState>>;
  order: DataFileName[];
  images: ImageState[];
  activeFile: DataFileName | null;
  logs: db.LogEntry[];

  undo: Partial<Record<DataFileName, string[]>>;

  init: () => Promise<void>;
  chooseFolder: () => Promise<void>;
  chooseUpload: () => Promise<void>;
  chooseDrop: (roots: DroppedRoots) => Promise<void>;
  loadDemo: () => Promise<void>;
  closeFolder: () => Promise<void>;
  setActive: (name: DataFileName) => void;

  setRawSource: (file: DataFileName, source: string) => Promise<boolean>;
  editEntry: (file: DataFileName, entry: string, edits: FieldEdit[]) => Promise<boolean>;
  addEntry: (file: DataFileName, lua: string, label: string) => Promise<boolean>;
  removeEntry: (file: DataFileName, entry: string) => Promise<boolean>;
  removeEntries: (file: DataFileName, entries: string[]) => Promise<boolean>;
  duplicateEntry: (file: DataFileName, entry: string) => Promise<string | null>;
  bulkEdit: (file: DataFileName, entries: string[], field: string, value: any, type: any) => Promise<number>;
  replaceTable: (file: DataFileName, entry: string, newTable: string) => Promise<boolean>;
  revertFile: (file: DataFileName) => Promise<void>;
  canUndo: (file: DataFileName) => boolean;

  setOptimizedImage: (name: string, blob: Blob) => void;
  toggleRemoveImage: (name: string) => void;
  addImages: (files: File[]) => number;

  exportZip: (opts?: { onlyChanged?: boolean }) => Promise<void>;
  writeBackFile: (file: DataFileName) => Promise<void>;

  refreshLogs: () => Promise<void>;
  clearLogs: () => Promise<void>;
}

async function applyLoaded(
  loaded: { files: LoadedDataFile[]; images: { name: string; blob: Blob; url: string; size: number }[] },
  handle: FsDirHandle | null,
  set: any,
  get: any
) {
  set({ status: 'loading', error: null });
  try {
    const { files, images } = loaded;
    const fileMap: Partial<Record<DataFileName, FileState>> = {};
    const order: DataFileName[] = [];
    for (const f of files) {
      try {
        const { model, hash } = modelFromSource(f.source);
        fileMap[f.name] = {
          name: f.name,
          original: f.source,
          current: f.source,
          model,
          hash,
          dirty: false,
        };
        order.push(f.name);
      } catch (e) {
        // A file that fails to parse is still kept as raw (no model) — skip for now.
        console.warn(`Failed to parse ${f.name}.lua`, e);
      }
    }
    const imageStates: ImageState[] = images.map((i) => ({ ...i }));
    set({
      handle,
      demo: false,
      files: fileMap,
      order,
      images: imageStates,
      activeFile: order[0] ?? null,
      status: 'ready',
    });
    await db.addLog({
      ts: Date.now(),
      file: '-',
      entry: '-',
      action: 'open',
      detail: `Loaded ${order.length} data files, ${images.length} images`,
    });
    await get().refreshLogs();
  } catch (e: any) {
    set({ status: 'error', error: e?.message ?? String(e) });
  }
}

export const useApp = create<AppState>((set, get) => ({
  supported: isSupported(),
  status: 'idle',
  error: null,
  handle: null,
  demo: false,
  files: {},
  order: [],
  images: [],
  activeFile: null,
  logs: [],
  undo: {},

  init: async () => {
    if (!isSupported()) {
      set({ supported: false });
      return;
    }
    const handle = await restoreFolder();
    if (handle) await applyLoaded(await readFolder(handle), handle, set, get);
  },

  chooseFolder: async () => {
    try {
      const handle = await pickFolder();
      await applyLoaded(await readFolder(handle), handle, set, get);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      set({ status: 'error', error: e?.message ?? String(e) });
    }
  },

  chooseUpload: async () => {
    try {
      const picked = await promptFolderUpload();
      if (picked.length === 0) return; // user cancelled
      await applyLoaded(await readUpload(picked), null, set, get);
    } catch (e: any) {
      set({ status: 'error', error: e?.message ?? String(e) });
    }
  },

  chooseDrop: async (roots) => {
    try {
      set({ status: 'loading', error: null });
      const { handle, files, images } = await readDrop(roots);
      if (files.length === 0) {
        set({ status: 'idle' });
        return;
      }
      await applyLoaded({ files, images }, handle, set, get);
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        set({ status: 'idle' });
        return;
      }
      set({ status: 'error', error: e?.message ?? String(e) });
    }
  },

  loadDemo: async () => {
    try {
      set({ status: 'loading', error: null });
      const images = await buildDemoImages();
      await applyLoaded({ files: DEMO_FILES, images }, null, set, get);
      set({ demo: true });
    } catch (e: any) {
      set({ status: 'error', error: e?.message ?? String(e) });
    }
  },

  closeFolder: async () => {
    await forgetFolder();
    get().images.forEach((i) => {
      URL.revokeObjectURL(i.url);
      if (i.optimizedUrl) URL.revokeObjectURL(i.optimizedUrl);
    });
    set({ handle: null, demo: false, files: {}, order: [], images: [], activeFile: null, status: 'idle', undo: {} });
  },

  setActive: (name) => set({ activeFile: name }),

  setRawSource: async (file, source) => {
    const fs = get().files[file];
    if (!fs) return false;
    if (source === fs.current) return true;
    try {
      const before = fs.current;
      const { model, hash } = modelFromSource(source); // validates parse
      const undoStack = [...(get().undo[file] ?? []), before];
      set({
        files: { ...get().files, [file]: { ...fs, current: source, model, hash, dirty: source !== fs.original } },
        undo: { ...get().undo, [file]: undoStack },
      });
      await db.pushSnapshot({ ts: Date.now(), file, source: before, label: 'raw edit' });
      await db.addLog({ ts: Date.now(), file, entry: '-', action: 'modify', detail: 'raw edit' });
      await get().refreshLogs();
      return true;
    } catch (e: any) {
      set({ error: `Parse error: ${e?.message ?? e}` });
      return false;
    }
  },

  editEntry: async (file, entry, edits) => {
    const fs = get().files[file];
    if (!fs || edits.length === 0) return true;
    try {
      const before = fs.current;
      const next = applyFormEdits(before, fs.model, entry, edits);
      if (next === before) return true;
      const { model, hash } = modelFromSource(next);
      const undoStack = [...(get().undo[file] ?? []), before];
      set({
        files: { ...get().files, [file]: { ...fs, current: next, model, hash, dirty: next !== fs.original } },
        undo: { ...get().undo, [file]: undoStack },
      });
      await db.pushSnapshot({ ts: Date.now(), file, source: before, label: `edit ${entry}` });
      await db.addLog({
        ts: Date.now(),
        file,
        entry,
        action: 'modify',
        detail: edits.map((e) => e.path.slice(entry.length + 1)).join(', '),
      });
      await get().refreshLogs();
      return true;
    } catch (e: any) {
      console.error(e);
      set({ error: `Edit failed: ${e?.message ?? e}` });
      return false;
    }
  },

  addEntry: async (file, lua, label) => {
    const fs = get().files[file];
    if (!fs) return false;
    try {
      const before = fs.current;
      const next = addEntry(before, fs.model, lua);
      const { model, hash } = modelFromSource(next); // validates parse
      const undoStack = [...(get().undo[file] ?? []), before];
      set({
        files: { ...get().files, [file]: { ...fs, current: next, model, hash, dirty: true } },
        undo: { ...get().undo, [file]: undoStack },
      });
      await db.pushSnapshot({ ts: Date.now(), file, source: before, label: `add ${label}` });
      await db.addLog({ ts: Date.now(), file, entry: label, action: 'add', detail: 'new entry' });
      await get().refreshLogs();
      return true;
    } catch (e: any) {
      set({ error: `Add failed: ${e?.message ?? e}` });
      return false;
    }
  },

  removeEntry: async (file, entry) => {
    const fs = get().files[file];
    if (!fs) return false;
    try {
      const before = fs.current;
      const next = deleteEntry(before, fs.model, entry);
      const { model, hash } = modelFromSource(next);
      const undoStack = [...(get().undo[file] ?? []), before];
      set({
        files: { ...get().files, [file]: { ...fs, current: next, model, hash, dirty: next !== fs.original } },
        undo: { ...get().undo, [file]: undoStack },
      });
      await db.pushSnapshot({ ts: Date.now(), file, source: before, label: `remove ${entry}` });
      await db.addLog({ ts: Date.now(), file, entry, action: 'remove', detail: 'deleted entry' });
      await get().refreshLogs();
      return true;
    } catch (e: any) {
      set({ error: `Remove failed: ${e?.message ?? e}` });
      return false;
    }
  },

  removeEntries: async (file, entries) => {
    const fs0 = get().files[file];
    if (!fs0 || entries.length === 0) return false;
    try {
      const before = fs0.current;
      let src = before;
      let model = fs0.model;
      for (const key of entries) {
        src = deleteEntry(src, model, key);
        model = modelFromSource(src).model;
      }
      const { model: finalModel, hash } = modelFromSource(src);
      set({
        files: { ...get().files, [file]: { ...fs0, current: src, model: finalModel, hash, dirty: src !== fs0.original } },
        undo: { ...get().undo, [file]: [...(get().undo[file] ?? []), before] },
      });
      await db.pushSnapshot({ ts: Date.now(), file, source: before, label: `remove ${entries.length}` });
      await db.addLog({ ts: Date.now(), file, entry: `${entries.length} entries`, action: 'remove', detail: 'bulk delete' });
      await get().refreshLogs();
      return true;
    } catch (e: any) {
      set({ error: `Bulk remove failed: ${e?.message ?? e}` });
      return false;
    }
  },

  duplicateEntry: async (file, entry) => {
    const fs = get().files[file];
    if (!fs) return null;
    const m = fs.model.entries.find((e) => e.key === entry);
    if (!m || m.tableStart == null || m.tableEnd == null) return null;
    if (fs.model.type === 'multi-section') {
      set({ error: 'Duplicating weapons is not supported yet.' });
      return null;
    }
    const body = fs.current.slice(m.tableStart, m.tableEnd);
    let snippet: string;
    let newKey: string;
    if (fs.model.type === 'indexed-array') {
      snippet = body; // appended as a new array item
      newKey = String(fs.model.entries.length);
    } else {
      const prefix = fs.current.slice(m.start, m.tableStart); // e.g. "['water'] = " or "General = "
      const existing = new Set(fs.model.entries.map((e) => e.key));
      const base = entry.includes('.') ? entry.split('.').pop()! : entry;
      let k = `${base}_copy`;
      let n = 2;
      while (existing.has(k)) k = `${base}_copy${n++}`;
      newKey = k;
      const bracket = /^\s*\[/.test(prefix);
      snippet = bracket ? `['${k}'] = ${body}` : `${k} = ${body}`;
    }
    const ok = await get().addEntry(file, snippet, `copy of ${entry}`);
    return ok ? newKey : null;
  },

  bulkEdit: async (file, entries, field, value, type) => {
    const fs0 = get().files[file];
    if (!fs0 || entries.length === 0) return 0;
    try {
      const before = fs0.current;
      let src = before;
      let model = fs0.model;
      let count = 0;
      for (const key of entries) {
        const path = `${key}.${field}`;
        const present = model.entries.find((e) => e.key === key)?.fields.some((f) => f.path === path) ?? false;
        const next = applyFormEdits(src, model, key, [{ path, value, type, present }]);
        if (next !== src) {
          count++;
          src = next;
          model = modelFromSource(next).model;
        }
      }
      if (count === 0) return 0;
      const { model: fm, hash } = modelFromSource(src);
      set({
        files: { ...get().files, [file]: { ...fs0, current: src, model: fm, hash, dirty: src !== fs0.original } },
        undo: { ...get().undo, [file]: [...(get().undo[file] ?? []), before] },
      });
      await db.pushSnapshot({ ts: Date.now(), file, source: before, label: `bulk ${field}` });
      await db.addLog({ ts: Date.now(), file, entry: `${count} entries`, action: 'modify', detail: `set ${field}` });
      await get().refreshLogs();
      return count;
    } catch (e: any) {
      set({ error: `Bulk edit failed: ${e?.message ?? e}` });
      return 0;
    }
  },

  replaceTable: async (file, entry, newTable) => {
    const fs = get().files[file];
    if (!fs) return false;
    try {
      const before = fs.current;
      const next = replaceEntryTable(before, fs.model, entry, newTable);
      if (next === before) return true;
      const { model, hash } = modelFromSource(next);
      set({
        files: { ...get().files, [file]: { ...fs, current: next, model, hash, dirty: next !== fs.original } },
        undo: { ...get().undo, [file]: [...(get().undo[file] ?? []), before] },
      });
      await db.pushSnapshot({ ts: Date.now(), file, source: before, label: `edit ${entry}` });
      await db.addLog({ ts: Date.now(), file, entry, action: 'modify', detail: 'structured edit' });
      await get().refreshLogs();
      return true;
    } catch (e: any) {
      set({ error: `Save failed: ${e?.message ?? e}` });
      return false;
    }
  },

  canUndo: (file) => (get().undo[file]?.length ?? 0) > 0,

  revertFile: async (file) => {
    const fs = get().files[file];
    const stack = get().undo[file];
    if (!fs || !stack || stack.length === 0) return;
    const prev = stack[stack.length - 1];
    const { model, hash } = modelFromSource(prev);
    set({
      files: { ...get().files, [file]: { ...fs, current: prev, model, hash, dirty: prev !== fs.original } },
      undo: { ...get().undo, [file]: stack.slice(0, -1) },
    });
    await db.addLog({ ts: Date.now(), file, entry: '-', action: 'revert', detail: 'reverted last change' });
    await get().refreshLogs();
  },

  setOptimizedImage: (name, blob) => {
    set({
      images: get().images.map((i) => {
        if (i.name !== name) return i;
        if (i.optimizedUrl) URL.revokeObjectURL(i.optimizedUrl);
        return { ...i, optimized: blob, optimizedUrl: URL.createObjectURL(blob) };
      }),
    });
  },

  toggleRemoveImage: (name) => {
    set({ images: get().images.map((i) => (i.name === name ? { ...i, removed: !i.removed } : i)) });
  },

  addImages: (files) => {
    const incoming: ImageState[] = [];
    for (const f of files) {
      if (!/\.(png|jpe?g|webp)$/i.test(f.name)) continue;
      incoming.push({ name: f.name, blob: f, url: URL.createObjectURL(f), size: f.size, added: true });
    }
    if (incoming.length === 0) return 0;
    const names = new Set(incoming.map((i) => i.name));
    const merged = [...get().images.filter((i) => !names.has(i.name)), ...incoming].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    set({ images: merged });
    return incoming.length;
  },

  exportZip: async (opts) => {
    const { files, order, images } = get();
    const entries: ZipEntry[] = [];
    for (const name of order) {
      const fs = files[name];
      if (!fs) continue;
      if (opts?.onlyChanged && !fs.dirty) continue;
      entries.push({ path: `data/${name}.lua`, data: fs.current });
    }
    for (const img of images) {
      if (img.removed) continue;
      entries.push({ path: `web/images/${img.name}`, data: img.optimized ?? img.blob });
    }
    const blob = await buildZip(entries);
    downloadBlob(blob, `ox_inventory_export_${Date.now()}.zip`);
    await db.addLog({
      ts: Date.now(),
      file: '-',
      entry: '-',
      action: 'export',
      detail: `${entries.length} files`,
    });
    await get().refreshLogs();
  },

  writeBackFile: async (file) => {
    const { handle, files } = get();
    const fs = files[file];
    if (!handle || !fs) throw new Error('Nothing to write');
    await writeBack(handle, file, fs.current);
    set({ files: { ...get().files, [file]: { ...fs, original: fs.current, dirty: false } } });
    await db.addLog({ ts: Date.now(), file, entry: '-', action: 'export', detail: 'wrote to disk' });
    await get().refreshLogs();
  },

  refreshLogs: async () => set({ logs: await db.getLogs() }),
  clearLogs: async () => {
    await db.clearLogs();
    set({ logs: [] });
  },
}));

export { DATA_FILES };
