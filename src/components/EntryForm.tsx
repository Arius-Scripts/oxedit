import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { GitCompare, Save, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { DiffView } from './DiffView';
import { InfoHint } from './InfoHint';
import { StatusEditor, AnimEditor, DisableEditor, RawTable } from './fieldEditors';
import { useApp } from '@/stores/appStore';
import { applyFormEdits, type FormField, type FieldEdit, type DisplayValue } from '@/engine/editModel';
import { FIELD_DOCS, FIELD_PLACEHOLDERS, GROUP_TITLES, SCHEMAS, resolveImage } from '@/engine/schemaRegistry';
import type { DataFileName } from '@/services/fileSystem';
import { cn } from '@/lib/utils';

const TABLE_TYPES = new Set(['raw', 'call', 'table', 'function', 'member']);
const SPECIAL = new Set(['status', 'anim', 'disable', 'prop']);
const leafName = (f: FormField) => f.key.split('.').pop()!;
const isSpecial = (f: FormField) => SPECIAL.has(leafName(f));
const prettify = (k: string) => (k ? k.charAt(0).toUpperCase() + k.slice(1) : 'General');
const defaultFor = (f: FormField): DisplayValue =>
  f.type === 'boolean' ? false : f.type === 'number' ? 0 : '';

export function EntryForm({
  file,
  entryKey,
  fields,
  onRemoved,
}: {
  file: DataFileName;
  entryKey: string;
  fields: FormField[];
  onRemoved?: () => void;
}) {
  const editEntry = useApp((s) => s.editEntry);
  const removeEntry = useApp((s) => s.removeEntry);
  const current = useApp((s) => s.files[file]?.current ?? '');
  const model = useApp((s) => s.files[file]?.model);
  const imageName = model && SCHEMAS[file].images ? resolveImage(file, model, entryKey) : undefined;
  const imageUrl = useApp((s) => {
    const i = imageName ? s.images.find((x) => x.name === imageName) : undefined;
    return i?.optimizedUrl ?? i?.url;
  });

  // All editable fields (present + unset). Read-only expressions are excluded.
  const editable = useMemo(() => fields.filter((f) => !f.readOnly), [fields]);
  const initial = useMemo(
    () => Object.fromEntries(editable.map((f) => [f.path, f.present ? f.value : defaultFor(f)])),
    [editable]
  );

  const [draft, setDraft] = useState<Record<string, DisplayValue>>(initial);

  // Reset the draft when switching entries.
  const formKey = entryKey + '|' + editable.map((f) => f.path).join(',');
  const [seenKey, setSeenKey] = useState(formKey);
  if (seenKey !== formKey) {
    setSeenKey(formKey);
    setDraft(initial);
  }

  const [showDiff, setShowDiff] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const edits: FieldEdit[] = useMemo(() => {
    const out: FieldEdit[] = [];
    for (const f of editable) {
      const v = draft[f.path];
      if (v === initial[f.path]) continue;
      out.push({ path: f.path, value: v, type: f.type, present: f.present });
    }
    return out;
  }, [draft, editable, initial]);

  const dirty = edits.length > 0;

  const preview = useMemo(() => {
    if (!dirty || !model) return current;
    try {
      return applyFormEdits(current, model, entryKey, edits);
    } catch {
      return current;
    }
  }, [current, model, entryKey, edits, dirty]);

  const set = (path: string, v: DisplayValue) => setDraft((d) => ({ ...d, [path]: v }));

  const save = async () => {
    const ok = await editEntry(file, entryKey, edits);
    if (ok) {
      toast.success(`Saved ${edits.length} change${edits.length === 1 ? '' : 's'}`);
      setShowDiff(false);
    } else {
      toast.error('Save failed — check the values are valid');
    }
  };

  const doRemove = async () => {
    if (await removeEntry(file, entryKey)) {
      toast.success(`Removed ${entryKey}`);
      setConfirmDelete(false);
      onRemoved?.();
    }
  };

  // Group fields by their parent segment, e.g. "client", "target", "" (top-level).
  const parentOf = (f: FormField) => (f.key.includes('.') ? f.key.slice(0, f.key.lastIndexOf('.')) : '');
  const groups = useMemo(() => {
    const m = new Map<string, FormField[]>();
    for (const f of editable) {
      const p = parentOf(f);
      (m.get(p) ?? m.set(p, []).get(p)!).push(f);
    }
    // Order: General first, then known groups, then the rest.
    const order = ['', 'client', 'server', 'blip', 'target', 'inventory'];
    return [...m.entries()].sort((a, b) => {
      const ia = order.indexOf(a[0]);
      const ib = order.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a[0].localeCompare(b[0]);
    });
  }, [editable]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {SCHEMAS[file].images && (
            <div className="icon-checker grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md border border-border/50">
              {imageUrl ? (
                <img src={imageUrl} alt={imageName} title={imageName} className="h-full w-full object-contain" />
              ) : (
                <span className="text-[9px] text-muted-foreground">no icon</span>
              )}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate font-mono text-sm font-semibold">{entryKey}</div>
            <div className="text-xs text-muted-foreground">
              {editable.length} fields{imageName && <span className="ml-1 font-mono">· {imageName}</span>}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="text-destructive" /> Remove
        </Button>
      </div>

      <div className="flex-1 space-y-6 overflow-auto px-5 py-4">
        {groups.map(([parent, groupFields]) => {
          const scalars = groupFields.filter((f) => !isSpecial(f) && !TABLE_TYPES.has(f.type));
          const specials = groupFields.filter((f) => isSpecial(f));
          const raws = groupFields.filter((f) => !isSpecial(f) && TABLE_TYPES.has(f.type));
          return (
            <Section key={parent || 'general'} title={GROUP_TITLES[parent] ?? prettify(parent)}>
              {scalars.length > 0 && (
                <Grid>
                  {scalars.map((f) => (
                    <FieldRow key={f.path} field={f} value={draft[f.path]} onChange={(v) => set(f.path, v)} />
                  ))}
                </Grid>
              )}
              {(specials.length > 0 || raws.length > 0) && (
                <div className={cn('space-y-4', scalars.length > 0 && 'mt-4')}>
                  {[...specials, ...raws].map((f) => (
                    <div key={f.path} className="space-y-1.5">
                      <Label className="flex items-center gap-1.5">
                        {leafName(f)}
                        <InfoHint text={FIELD_DOCS[f.key]} />
                        {!f.present && <span className="text-[10px] text-muted-foreground">(not set)</span>}
                      </Label>
                      {isSpecial(f) ? (
                        <SpecialEditor field={f} value={String(draft[f.path] ?? '')} onChange={(v) => set(f.path, v)} />
                      ) : (
                        <RawTable value={String(draft[f.path] ?? '')} onChange={(v) => set(f.path, v)} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border bg-card/60 px-5 py-3">
        <div className="text-xs text-muted-foreground">
          {dirty ? (
            <span className="text-amber-400">
              {edits.length} unsaved change{edits.length === 1 ? '' : 's'}
            </span>
          ) : (
            'No changes'
          )}
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
            <DialogTitle>Review changes — {file}.lua</DialogTitle>
            <DialogDescription>
              Only the highlighted lines change. Everything else stays byte-for-byte identical.
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">{children}</div>;
}

function SpecialEditor({ field, value, onChange }: { field: FormField; value: string; onChange: (v: string) => void }) {
  const leaf = field.key.split('.').pop();
  if (leaf === 'status') return <StatusEditor value={value} onChange={onChange} />;
  if (leaf === 'anim') return <AnimEditor value={value} onChange={onChange} />;
  if (leaf === 'disable') return <DisableEditor value={value} onChange={onChange} />;
  return <RawTable value={value} onChange={onChange} />;
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: DisplayValue;
  onChange: (v: DisplayValue) => void;
}) {
  const name = field.key.split('.').pop()!;
  const ph = FIELD_PLACEHOLDERS[field.key] ?? FIELD_PLACEHOLDERS[name];
  return (
    <div className={cn('space-y-1', field.type === 'boolean' && 'flex items-center justify-between space-y-0')}>
      <Label className="flex items-center gap-1.5">
        {name}
        {field.required && <span className="text-destructive">*</span>}
        <InfoHint text={FIELD_DOCS[field.key]} />
        {!field.present && <span className="text-[10px] text-muted-foreground/70">(not set)</span>}
      </Label>
      {field.type === 'boolean' ? (
        <Switch checked={!!value} onCheckedChange={(c) => onChange(c)} />
      ) : field.type === 'number' ? (
        <Input
          type="number"
          placeholder={ph}
          value={value as number}
          onChange={(e) => { const n = Number(e.target.value); if (e.target.value === '' || !isNaN(n)) onChange(e.target.value === '' ? 0 : n); }}
        />
      ) : (
        <Input placeholder={ph} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
