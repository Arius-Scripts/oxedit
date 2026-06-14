import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from './ui/dialog';
import { useApp } from '@/stores/appStore';
import { entryKeys } from '@/engine/editModel';
import type { DataFileName } from '@/services/fileSystem';
import type { NormalizedSchema } from '@/engine/schemaRegistry';
import { PRESETS } from '@/data/presets';

/** Replace the key and label placeholders inside a schema template. */
function applyTemplate(template: string, key: string, label: string): string {
  let lua = template;
  if (key) {
    if (/\['[^']*'\]/.test(lua)) lua = lua.replace(/\['[^']*'\]/, () => `['${key}']`);
    else lua = lua.replace(/^\s*\w+\s*=/, () => `${key} =`);
  }
  if (label) {
    const escaped = label.replace(/'/g, "\\'");
    lua = lua.replace(/(label|name)(\s*=\s*)'[^']*'/, (_m, k, eq) => `${k}${eq}'${escaped}'`);
  }
  return lua;
}

function needsKey(schema: NormalizedSchema): boolean {
  return schema.type === 'keyed-map' || schema.type === 'multi-section';
}

/** Ensure a preset's key doesn't collide with an existing entry; rename + rewrite the snippet. */
function withUniqueKey(lua: string, key: string, existing: string[]): { lua: string; key: string } {
  const existingSet = new Set(existing);
  let k = key;
  let n = 2;
  while (existingSet.has(k)) k = `${key}_${n++}`;
  if (k === key) return { lua, key };
  let out = lua;
  if (/^\s*\['/.test(lua)) out = lua.replace(/\['[^']*'\]/, () => `['${k}']`);
  else if (/^\s*\w+\s*=/.test(lua)) out = lua.replace(/^(\s*)\w+(\s*=)/, (_m, sp, eq) => `${sp}${k}${eq}`);
  return { lua: out, key: k };
}

export function AddEntryDialog({ file, schema }: { file: DataFileName; schema: NormalizedSchema }) {
  const add = useApp((s) => s.addEntry);
  const model = useApp((s) => s.files[file]?.model);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [section, setSection] = useState(schema.sections?.[0] ?? '');

  const presets = PRESETS[file] ?? [];
  const existing = model ? entryKeys(model).map((k) => k.split('.').pop()!) : [];

  const addPreset = async (lua: string, key: string, label: string) => {
    const fixed = withUniqueKey(lua, key, existing);
    if (await add(file, fixed.lua, label)) {
      toast.success(`Added ${label}`);
      setOpen(false);
    }
  };

  const template =
    schema.template ?? (schema.templates && section ? schema.templates[section] : undefined);

  const reset = () => {
    setKey('');
    setLabel('');
  };

  const submit = async () => {
    if (!template) {
      toast.error('No template available for this file');
      return;
    }
    if (needsKey(schema) && !key.trim()) {
      toast.error('Enter an id / key');
      return;
    }
    const lua = applyTemplate(template, key.trim(), label.trim());
    const ok = await add(file, lua, label || key || 'entry');
    if (ok) {
      toast.success('Entry added');
      setOpen(false);
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={!template}>
          <Plus /> Add
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="text-primary" /> Add to {file}.lua
          </DialogTitle>
          <DialogDescription>
            Pick a ready-made preset to add in one click, or create your own below. New entries are appended,
            preserving the rest of the file.
          </DialogDescription>
        </DialogHeader>

        {presets.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quick presets
            </div>
            <div className="grid max-h-52 grid-cols-2 gap-2 overflow-auto pr-1">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addPreset(p.lua, p.key, p.label)}
                  className="group rounded-md border border-border bg-card/50 px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-accent"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{p.label}</span>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">{p.hint}</div>
                </button>
              ))}
            </div>
            <div className="my-3 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or custom <span className="h-px flex-1 bg-border" />
            </div>
          </div>
        )}

        <div className="space-y-3">
          {schema.sections && schema.templates && (
            <div className="space-y-1">
              <Label>Section</Label>
              <div className="flex flex-wrap gap-1.5">
                {schema.sections
                  .filter((s) => schema.templates![s])
                  .map((s) => (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      variant={section === s ? 'default' : 'outline'}
                      onClick={() => setSection(s)}
                    >
                      {s}
                    </Button>
                  ))}
              </div>
            </div>
          )}
          {needsKey(schema) && (
            <div className="space-y-1">
              <Label>Id / key</Label>
              <Input
                placeholder="e.g. water_bottle"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoFocus
              />
            </div>
          )}
          <div className="space-y-1">
            <Label>Label</Label>
            <Input placeholder="Display name" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>
            <Plus /> Add entry
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
