import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { GitCompare, Save, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { DiffView } from './DiffView';
import { LuaTreeEditor } from './LuaTreeEditor';
import { useApp } from '@/stores/appStore';
import { entryTableText, replaceEntryTable } from '@/engine/editModel';
import { parseLuaValue, serializeLuaValue, type LuaVal } from '@/engine/luaObject';
import type { DataFileName } from '@/services/fileSystem';

export function StructuredEntryEditor({
  file,
  entryKey,
  onRemoved,
}: {
  file: DataFileName;
  entryKey: string;
  onRemoved?: () => void;
}) {
  const current = useApp((s) => s.files[file]?.current ?? '');
  const model = useApp((s) => s.files[file]?.model);
  const replaceTable = useApp((s) => s.replaceTable);
  const removeEntry = useApp((s) => s.removeEntry);

  const originalTable = useMemo(
    () => (model ? entryTableText(current, model, entryKey) : null),
    [current, model, entryKey]
  );

  const initial = useMemo<LuaVal | null>(() => {
    if (originalTable == null) return null;
    try {
      return parseLuaValue(originalTable);
    } catch {
      return null;
    }
  }, [originalTable]);

  const [draft, setDraft] = useState<LuaVal | null>(initial);
  const [seen, setSeen] = useState(entryKey + (originalTable ?? ''));
  const stamp = entryKey + (originalTable ?? '');
  if (seen !== stamp) {
    setSeen(stamp);
    setDraft(initial);
  }

  const [showDiff, setShowDiff] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const newTable = useMemo(() => (draft ? serializeLuaValue(draft) : originalTable ?? ''), [draft, originalTable]);
  const dirty = !!originalTable && newTable.trim() !== originalTable.trim();
  const preview = useMemo(
    () => (model && dirty ? replaceEntryTable(current, model, entryKey, newTable) : current),
    [current, model, entryKey, newTable, dirty]
  );

  if (!draft || originalTable == null) {
    return (
      <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
        This entry has a shape the visual editor can’t parse. Use Diff / raw export instead.
      </div>
    );
  }

  const save = async () => {
    if (await replaceTable(file, entryKey, newTable)) {
      toast.success('Saved');
      setShowDiff(false);
    } else toast.error('Save failed: check the values');
  };
  const doRemove = async () => {
    if (await removeEntry(file, entryKey)) {
      toast.success(`Removed ${entryKey}`);
      setConfirmDelete(false);
      onRemoved?.();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="min-w-0">
          <div className="truncate font-mono text-sm font-semibold">{entryKey}</div>
          <div className="text-xs text-muted-foreground">Visual editor</div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="text-destructive" /> Remove
        </Button>
      </div>

      <div className="flex-1 overflow-auto px-5 py-4">
        <LuaTreeEditor value={draft} onChange={setDraft} file={file} />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border bg-card/60 px-5 py-3">
        <div className="text-xs text-muted-foreground">
          {dirty ? <span className="text-amber-400">Unsaved changes</span> : 'No changes'}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!dirty} onClick={() => setShowDiff(true)}>
            <GitCompare /> Review diff
          </Button>
          <Button size="sm" disabled={!dirty} onClick={save}>
            <Save /> Save
          </Button>
        </div>
      </div>

      <Dialog open={showDiff} onOpenChange={setShowDiff}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review changes: {file}.lua</DialogTitle>
            <DialogDescription>
              Only this entry is rewritten; every other entry in the file stays byte-for-byte identical.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-auto">
            <DiffView before={current} after={preview} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDiff(false)}>
              Cancel
            </Button>
            <Button onClick={save}>
              <Save /> Apply changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove entry?</DialogTitle>
            <DialogDescription>
              <span className="font-mono">{entryKey}</span> will be removed from {file}.lua. You can undo with Revert.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={doRemove}>
              <Trash2 /> Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
