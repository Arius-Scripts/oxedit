import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Check, Copy, CopyPlus, Eye, EyeOff, FileDown, GitCompare, ImageOff, Pencil, Search, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { EntryForm } from '@/components/EntryForm';
import { StructuredEntryEditor } from '@/components/StructuredEntryEditor';
import { RawFileEditor } from '@/components/RawFileEditor';
import { LivePreview } from '@/components/LivePreview';
import { DiffView } from '@/components/DiffView';
import { AddEntryDialog } from '@/components/AddEntryDialog';
import { BlipChip } from '@/components/BlipChip';
import { Hint } from '@/components/InfoHint';
import { ImagePickerModal } from '@/components/ImagePickerModal';
import { useApp } from '@/stores/appStore';
import { entryKeys, readField, duplicateKeys } from '@/engine/editModel';
import { SCHEMAS, FILE_LABELS, formFieldsFor, resolveImage } from '@/engine/schemaRegistry';
import type { SchemaField } from '@/engine/editModel';
import type { DataFileName } from '@/services/fileSystem';
import { cn } from '@/lib/utils';

function ImageThumb({ name, className, onClick }: { name?: string; className?: string; onClick?: () => void }) {
  const img = useApp((s) => (name ? s.images.find((i) => i.name === name) : undefined));
  const url = img?.optimizedUrl ?? img?.url;
  if (!name) return <div className={cn('icon-checker rounded border border-border/50', className)} />;
  if (!url) {
    const inner = (
      <div className={cn('grid place-items-center rounded border border-border/40 bg-muted/20', className)} title={onClick ? `No image, click to assign` : `No image: ${name}`}>
        <ImageOff className="h-3.5 w-3.5 text-muted-foreground/40" />
      </div>
    );
    return onClick
      ? <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} className="shrink-0 cursor-pointer">{inner}</button>
      : inner;
  }
  if (onClick) {
    return (
      <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} className="group relative shrink-0 cursor-pointer" title={`${name} (click to change)`}>
        <img src={url} alt={name} loading="lazy" className={cn('icon-checker rounded border border-border/50 object-contain', className)} />
        <div className="absolute inset-0 flex items-center justify-center rounded bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <Pencil className="h-3 w-3 text-white" />
        </div>
      </button>
    );
  }
  return (
    <img src={url} alt={name} title={name} loading="lazy" className={cn('icon-checker rounded border border-border/50 object-contain', className)} />
  );
}

export function DataFilePage({ file }: { file: DataFileName }) {
  const fs = useApp((s) => s.files[file]);
  const model = fs?.model;
  const schema = SCHEMAS[file];
  const revert = useApp((s) => s.revertFile);
  const canUndo = useApp((s) => s.canUndo(file));
  const writeBack = useApp((s) => s.writeBackFile);
  const canWriteBack = useApp((s) => !!s.handle);
  const removeEntries = useApp((s) => s.removeEntries);
  const duplicateEntry = useApp((s) => s.duplicateEntry);
  const canDuplicate = schema.type !== 'multi-section';

  const keys = useMemo(() => (model ? entryKeys(model) : []), [model]);
  const dups = useMemo(() => (model ? duplicateKeys(model) : new Set<string>()), [model]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(true);
  const [showFullDiff, setShowFullDiff] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [pickerFor, setPickerFor] = useState<{ entryKey: string; imageName: string } | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return keys.filter((k) => {
      if (!q) return true;
      const label = String(readField(model!, k, schema.labelKey) ?? '');
      return k.toLowerCase().includes(q) || label.toLowerCase().includes(q);
    });
  }, [keys, query, model, schema.labelKey]);

  const active = selected && keys.includes(selected) ? selected : filtered[0] ?? null;

  const grouped = useMemo(() => {
    if (schema.type !== 'multi-section') return { '': filtered };
    const g: Record<string, string[]> = {};
    for (const k of filtered) (g[k.split('.')[0]] ||= []).push(k);
    return g;
  }, [filtered, schema.type]);

  const formFields = useMemo(
    () => (model && active ? formFieldsFor(file, model, active) : []),
    [model, active, file]
  );

  if (!fs) return <div className="grid h-full place-items-center text-muted-foreground">Could not parse {file}.lua</div>;

  const toggleSel = (k: string) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const onWriteBack = async () => {
    try {
      await writeBack(file);
      toast.success(`Wrote ${file}.lua to disk`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Write failed');
    }
  };

  const deleteSelected = async () => {
    const n = sel.size;
    if (await removeEntries(file, [...sel])) {
      toast.success(`Removed ${n} entr${n === 1 ? 'y' : 'ies'}`);
      setSel(new Set());
    }
  };

  const onDuplicate = async (k: string) => {
    const nk = await duplicateEntry(file, k);
    if (nk) {
      toast.success(`Duplicated → ${nk}`);
      setSelected(schema.type === 'indexed-array' ? null : nk);
    } else {
      toast.error('Could not duplicate this entry');
    }
  };

  const onCopy = async (k: string) => {
    const e = model?.entries.find((x) => x.key === k);
    if (!e) return;
    try {
      await navigator.clipboard.writeText(fs.current.slice(e.start, e.end));
      toast.success('Copied Lua to clipboard');
    } catch {
      toast.error('Clipboard blocked by browser');
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{FILE_LABELS[file]}</h2>
          <Badge variant="secondary">{keys.length}</Badge>
          {fs.dirty && <Badge variant="warning">unsaved</Badge>}
          {dups.size > 0 && (
            <Hint text={`Duplicate keys: ${[...dups].join(', ')}. Lua keeps only the last, so remove the earlier ones.`}>
              <Badge variant="destructive">
                <AlertTriangle className="mr-1 h-3 w-3" /> {dups.size} duplicate
              </Badge>
            </Hint>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Hint text="Undo the last change to this file.">
            <Button variant="ghost" size="sm" disabled={!canUndo} onClick={() => revert(file)}>
              <Undo2 /> Revert
            </Button>
          </Hint>
          <Hint text="Show every line that changed vs. the original you opened.">
            <Button variant="ghost" size="sm" disabled={!fs.dirty} onClick={() => setShowFullDiff(true)}>
              <GitCompare /> Diff
            </Button>
          </Hint>
          {canWriteBack && (
            <Hint text="Write this file back to the folder on disk.">
              <Button variant="ghost" size="sm" onClick={onWriteBack} disabled={!fs.dirty}>
                <FileDown /> Save to disk
              </Button>
            </Hint>
          )}
          <Hint text="Toggle the live Lua preview.">
            <Button variant="ghost" size="icon" onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? <EyeOff /> : <Eye />}
            </Button>
          </Hint>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Entry list */}
        <div className="flex w-72 shrink-0 flex-col border-r border-border">
          <div className="flex items-center gap-2 border-b border-border p-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 pl-7 text-xs" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <AddEntryDialog file={file} schema={schema} />
          </div>

          {sel.size > 0 && (
            <div className="flex items-center justify-between gap-2 border-b border-border bg-primary/5 px-2 py-1.5 text-xs">
              <span className="text-muted-foreground">{sel.size} selected</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7" onClick={() => setBulkEditOpen(true)}>
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
                <Button variant="ghost" size="sm" className="h-7" onClick={deleteSelected}>
                  <Trash2 className="h-3 w-3 text-destructive" /> Delete
                </Button>
                <Button variant="ghost" size="sm" className="h-7" onClick={() => setSel(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto py-1">
            {Object.entries(grouped).map(([section, items]) => (
              <div key={section}>
                {section && (
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{section}</div>
                )}
                {items.map((k) => {
                  const label = String(readField(model!, k, schema.labelKey) ?? '');
                  const img = resolveImage(file, model!, k);
                  const display = schema.type === 'multi-section' ? k.split('.').slice(1).join('.') : k;
                  const subtitle = schema.subtitleKey ? String(readField(model!, k, schema.subtitleKey) ?? display) : display;
                  const checked = sel.has(k);
                  return (
                    <div
                      key={k}
                      className={cn(
                        'group flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                        active === k && 'bg-accent ring-1 ring-inset ring-primary/30'
                      )}
                    >
                      <button
                        onClick={() => toggleSel(k)}
                        title="Select"
                        className={cn(
                          'grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors',
                          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 hover:border-primary'
                        )}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </button>
                      <button onClick={() => setSelected(k)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                        {schema.images && (
                          <ImageThumb
                            name={img}
                            className="h-8 w-8 shrink-0"
                            onClick={img ? () => setPickerFor({ entryKey: k, imageName: img }) : undefined}
                          />
                        )}
                        <div className="flex min-w-0 flex-1 flex-col justify-center leading-tight">
                          <div className="flex items-center gap-1">
                            <span className="truncate text-xs font-medium">{label || display}</span>
                            {dups.has(k) && (
                              <Badge variant="destructive" className="shrink-0 px-1 py-0 text-[9px]">dup</Badge>
                            )}
                          </div>
                          {label && <span className="truncate font-mono text-[10px] text-muted-foreground">{subtitle}</span>}
                        </div>
                      </button>
                      {file === 'shops' && (
                        <BlipChip
                          compact
                          id={Number(readField(model!, k, 'blip.id')) || undefined}
                          colour={Number(readField(model!, k, 'blip.colour')) || undefined}
                        />
                      )}
                      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                        <button onClick={() => onCopy(k)} title="Copy Lua" className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        {canDuplicate && (
                          <button onClick={() => onDuplicate(k)} title="Duplicate" className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground">
                            <CopyPlus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {filtered.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">No entries</div>}
          </div>
        </div>

        {/* Editor */}
        <div className="flex min-w-0 flex-1">
          <div className={cn('min-w-0 flex-1', showPreview && schema.formSupported && 'border-r border-border')}>
            {!schema.formSupported ? (
              <RawFileEditor file={file} />
            ) : !active ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">Select or add an entry</div>
            ) : schema.editor === 'structured' ? (
              <StructuredEntryEditor key={active} file={file} entryKey={active} onRemoved={() => setSelected(null)} />
            ) : (
              <EntryForm key={active} file={file} entryKey={active} fields={formFields} onRemoved={() => setSelected(null)} />
            )}
          </div>
          {showPreview && schema.formSupported && (
            <div className="hidden w-[42%] min-w-0 shrink-0 lg:block">
              <LivePreview source={fs.current} />
            </div>
          )}
        </div>
      </div>

      <Dialog open={showFullDiff} onOpenChange={setShowFullDiff}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>All changes: {file}.lua (original → current)</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <DiffView before={fs.original} after={fs.current} />
          </div>
        </DialogContent>
      </Dialog>

      <BulkEditDialog
        file={file}
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        keys={[...sel]}
        onDone={() => setSel(new Set())}
      />

      {pickerFor && (
        <ImagePickerModal
          file={file}
          entryKey={pickerFor.entryKey}
          imageName={pickerFor.imageName}
          onClose={() => setPickerFor(null)}
        />
      )}
    </div>
  );
}

/* Apply one field value across many selected entries. */
function BulkEditDialog({
  file,
  open,
  onOpenChange,
  keys,
  onDone,
}: {
  file: DataFileName;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  keys: string[];
  onDone: () => void;
}) {
  const bulkEdit = useApp((s) => s.bulkEdit);
  const schema = SCHEMAS[file];
  const fields: SchemaField[] = useMemo(() => {
    if (schema.type === 'multi-section') {
      const seen = new Map<string, SchemaField>();
      for (const arr of Object.values(schema.sectionFields ?? {})) for (const f of arr) seen.set(f.key, f);
      return [...seen.values()];
    }
    return schema.fields ?? [];
  }, [schema]);

  const [fieldKey, setFieldKey] = useState(fields[0]?.key ?? '');
  const field = fields.find((f) => f.key === fieldKey) ?? fields[0];
  const [str, setStr] = useState('');
  const [num, setNum] = useState(0);
  const [bool, setBool] = useState(false);

  const apply = async () => {
    if (!field) return;
    const value = field.type === 'boolean' ? bool : field.type === 'number' ? num : str;
    const n = await bulkEdit(file, keys, field.key, value, field.type);
    n > 0 ? toast.success(`Updated ${n} entr${n === 1 ? 'y' : 'ies'}`) : toast('Nothing changed');
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {keys.length} entries</DialogTitle>
          <DialogDescription>Set one field to the same value across all selected entries.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Field</Label>
            <select
              value={fieldKey}
              onChange={(e) => setFieldKey(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background/40 px-2 text-sm"
            >
              {fields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.key}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Value</Label>
            {field?.type === 'boolean' ? (
              <Switch checked={bool} onCheckedChange={setBool} />
            ) : field?.type === 'number' ? (
              <Input type="number" value={num} onChange={(e) => setNum(Number(e.target.value))} />
            ) : (
              <Input value={str} onChange={(e) => setStr(e.target.value)} />
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={apply}>Apply to {keys.length}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
