import { Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { InfoHint } from './InfoHint';
import { BlipChip } from './BlipChip';
import { useApp } from '@/stores/appStore';
import {
  FIELD_DOCS,
  FIELD_PLACEHOLDERS,
  GROUP_TITLES,
  ADDABLE_FIELDS,
  ARRAY_ITEM_FIELDS,
  SCALAR_ARRAY_KINDS,
  type AddableField,
} from '@/engine/schemaRegistry';
import { blankVal, mapGet, type LuaVal, type MapField } from '@/engine/luaObject';
import type { DataFileName } from '@/services/fileSystem';
import { cn } from '@/lib/utils';

const title = (k: string) => GROUP_TITLES[k] ?? k.charAt(0).toUpperCase() + k.slice(1);
const isScalar = (v: LuaVal) => ['str', 'num', 'bool', 'vec3', 'raw'].includes(v.t);
const ITEM_ARRAY_KEYS = new Set(['inventory', 'items']);

function blankLike(v: LuaVal): LuaVal {
  switch (v.t) {
    case 'str':
      return { t: 'str', v: '' };
    case 'num':
      return { t: 'num', v: 0 };
    case 'bool':
      return { t: 'bool', v: false };
    case 'vec3':
      return { t: 'vec3', v: [0, 0, 0] };
    case 'raw':
      return { t: 'raw', v: '' };
    case 'arr':
      return { t: 'arr', v: [] };
    case 'map':
      return { t: 'map', v: v.v.map((f) => ({ ...f, val: blankLike(f.val) })) };
  }
}

/** Build a new item for an array, by the array's key, for this file. */
function newArrayItem(file: DataFileName, key: string, existingFirst?: LuaVal): LuaVal {
  if (existingFirst) return blankLike(existingFirst);
  const scalar = SCALAR_ARRAY_KINDS[key];
  if (scalar) return blankVal(scalar);
  const tmpl = ARRAY_ITEM_FIELDS[file]?.[key];
  if (tmpl) return { t: 'map', v: tmpl.map((f) => ({ key: f.key, bracket: false, val: blankVal(f.kind) })) };
  return { t: 'map', v: [] };
}

function fieldFor(f: AddableField): MapField {
  return { key: f.key, bracket: false, val: blankVal(f.kind) };
}

/* Top-level: renders a map's fields as grouped sections + an add-property control. */
export function LuaTreeEditor({
  value,
  onChange,
  file,
}: {
  value: LuaVal;
  onChange: (v: LuaVal) => void;
  file: DataFileName;
}) {
  if (value.t !== 'map') return <ValueEditor value={value} onChange={onChange} pathKey="" />;
  const present = new Set(value.v.map((f) => f.key));
  const addField = (f: AddableField) => onChange({ t: 'map', v: [...value.v, fieldFor(f)] });
  return (
    <div className="space-y-5">
      {value.v.map((f, i) => (
        <FieldBlock
          key={f.key + i}
          file={file}
          field={f}
          onChange={(nf) => onChange({ t: 'map', v: value.v.map((x, j) => (j === i ? nf : x)) })}
          onRemove={() => onChange({ t: 'map', v: value.v.filter((_, j) => j !== i) })}
        />
      ))}
      <AddProperty file={file} pathKey="" present={present} onAdd={addField} />
    </div>
  );
}

/** Dropdown listing optional fields that can still be added to a map. */
function AddProperty({
  file,
  pathKey,
  present,
  onAdd,
}: {
  file: DataFileName;
  pathKey: string;
  present: Set<string>;
  onAdd: (f: AddableField) => void;
}) {
  const options = (ADDABLE_FIELDS[file]?.[pathKey] ?? []).filter((f) => !present.has(f.key));
  if (options.length === 0) return null;
  return (
    <select
      value=""
      onChange={(e) => {
        const f = options.find((x) => x.key === e.target.value);
        if (f) onAdd(f);
        e.currentTarget.selectedIndex = 0;
      }}
      className="h-7 rounded-md border border-dashed border-primary/50 bg-primary/5 px-2 text-xs text-primary hover:bg-primary/10"
    >
      <option value="" disabled>
        + Add property…
      </option>
      {options.map((f) => (
        <option key={f.key} value={f.key} className="bg-background text-foreground">
          {f.key}
        </option>
      ))}
    </select>
  );
}

/* A top-level map field becomes a titled section. */
function FieldBlock({
  file,
  field,
  onChange,
  onRemove,
}: {
  file: DataFileName;
  field: MapField;
  onChange: (f: MapField) => void;
  onRemove: () => void;
}) {
  const set = (val: LuaVal) => onChange({ ...field, val });
  const v = field.val;

  if (v.t === 'arr') {
    return (
      <section>
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle text={title(field.key)} hint={FIELD_DOCS[field.key]} />
          <RemoveSection onRemove={onRemove} />
        </div>
        <ArrayEditor file={file} value={v} onChange={set} keyName={field.key} />
      </section>
    );
  }
  if (v.t === 'map') {
    return (
      <section>
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle text={title(field.key)} hint={FIELD_DOCS[field.key]} />
          <div className="flex items-center gap-2">
            {field.key === 'blip' && <BlipChipFromMap val={v} />}
            <RemoveSection onRemove={onRemove} />
          </div>
        </div>
        <div className="rounded-md border border-border p-3">
          <MapGrid file={file} value={v} onChange={set} parentKey={field.key} />
        </div>
      </section>
    );
  }
  // scalar top-level field
  return (
    <div className="flex items-end gap-2">
      <div className="max-w-md flex-1">
        <ScalarField label={field.key} parentKey="" value={v} onChange={set} />
      </div>
      <RemoveSection onRemove={onRemove} />
    </div>
  );
}

function RemoveSection({ onRemove }: { onRemove: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onRemove} title="Remove">
      <Trash2 className="h-3.5 w-3.5 text-destructive" />
    </Button>
  );
}

function SectionTitle({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {text}
      <InfoHint text={hint} />
    </div>
  );
}

/* Grid of scalar fields for a (sub)map; nested maps/arrays render as blocks. */
function MapGrid({
  file,
  value,
  onChange,
  parentKey,
}: {
  file: DataFileName;
  value: LuaVal & { t: 'map' };
  onChange: (v: LuaVal) => void;
  parentKey: string;
}) {
  const setField = (i: number, val: LuaVal) =>
    onChange({ t: 'map', v: value.v.map((x, j) => (j === i ? { ...x, val } : x)) });
  const removeField = (i: number) => onChange({ t: 'map', v: value.v.filter((_, j) => j !== i) });
  const addField = (f: AddableField) => onChange({ t: 'map', v: [...value.v, fieldFor(f)] });

  const scalars = value.v.map((f, i) => ({ f, i })).filter(({ f }) => isScalar(f.val));
  const complex = value.v.map((f, i) => ({ f, i })).filter(({ f }) => !isScalar(f.val));
  const present = new Set(value.v.map((f) => f.key));

  // Show the item icon for shop/crafting inventory rows.
  const itemName = ITEM_ARRAY_KEYS.has(parentKey)
    ? (value.v.find((f) => f.key === 'name')?.val as LuaVal | undefined)
    : undefined;

  return (
    <div className="space-y-3">
      {itemName?.t === 'str' && (
        <div className="flex items-center gap-2">
          <ItemImage name={itemName.v} />
          <span className="font-mono text-xs text-muted-foreground">{itemName.v || '(no item)'}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {scalars.map(({ f, i }) => (
          <ScalarField
            key={f.key + i}
            label={f.key}
            parentKey={parentKey}
            value={f.val}
            onChange={(val) => setField(i, val)}
            onRemove={() => removeField(i)}
          />
        ))}
      </div>
      {complex.map(({ f, i }) =>
        f.val.t === 'arr' ? (
          <div key={f.key + i}>
            <div className="mb-1 text-xs font-medium text-muted-foreground">{title(f.key)}</div>
            <ArrayEditor file={file} value={f.val} onChange={(val) => setField(i, val)} keyName={f.key} />
          </div>
        ) : (
          <div key={f.key + i}>
            <div className="mb-1 text-xs font-medium text-muted-foreground">{title(f.key)}</div>
            <div className="rounded-md border border-border p-3">
              <MapGrid file={file} value={f.val as any} onChange={(val) => setField(i, val)} parentKey={f.key} />
            </div>
          </div>
        )
      )}
      <AddProperty file={file} pathKey={parentKey} present={present} onAdd={addField} />
    </div>
  );
}

/* Array editor: rows of items with add/remove. Simple maps render as inline rows. */
function ArrayEditor({
  file,
  value,
  onChange,
  keyName,
}: {
  file: DataFileName;
  value: LuaVal & { t: 'arr' };
  onChange: (v: LuaVal) => void;
  keyName: string;
}) {
  const setItem = (i: number, val: LuaVal) => onChange({ t: 'arr', v: value.v.map((x, j) => (j === i ? val : x)) });
  const removeItem = (i: number) => onChange({ t: 'arr', v: value.v.filter((_, j) => j !== i) });
  const duplicateItem = (i: number) =>
    onChange({
      t: 'arr',
      v: [...value.v.slice(0, i + 1), JSON.parse(JSON.stringify(value.v[i])) as LuaVal, ...value.v.slice(i + 1)],
    });
  const add = () => onChange({ t: 'arr', v: [...value.v, newArrayItem(file, keyName, value.v[0])] });

  return (
    <div className="space-y-2">
      {value.v.length === 0 && <div className="text-xs text-muted-foreground">None yet.</div>}
      {value.v.map((item, i) => (
        <div key={i} className="flex items-start gap-2 rounded-md border border-border bg-card/40 p-2">
          <div className="flex-1">
            {item.t === 'map' ? (
              <MapGrid file={file} value={item} onChange={(v) => setItem(i, v)} parentKey={keyName} />
            ) : (
              <ValueEditor value={item} onChange={(v) => setItem(i, v)} pathKey={keyName} />
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateItem(i)} title="Duplicate">
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(i)} title="Remove">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7" onClick={add}>
        <Plus className="h-3 w-3" /> Add {singular(keyName)}
      </Button>
    </div>
  );
}

const singular = (k: string) => (k.endsWith('s') ? k.slice(0, -1) : k) || 'item';

/* Item icon resolved from web/images by `<name>.png`. */
function ItemImage({ name }: { name: string }) {
  const img = useApp((s) => (name ? s.images.find((i) => i.name === `${name}.png`) : undefined));
  const url = img?.optimizedUrl ?? img?.url;
  return (
    <div className="icon-checker grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded border border-border/50">
      {url ? (
        <img src={url} alt={name} title={`${name}.png`} className="h-full w-full object-contain" />
      ) : (
        <span className="text-[8px] text-muted-foreground">no img</span>
      )}
    </div>
  );
}

function BlipChipFromMap({ val }: { val: LuaVal }) {
  const idV = mapGet(val, 'id');
  const colV = mapGet(val, 'colour');
  return <BlipChip id={idV?.t === 'num' ? idV.v : undefined} colour={colV?.t === 'num' ? colV.v : undefined} />;
}

/* A single scalar field with a label. */
function ScalarField({
  label,
  parentKey,
  value,
  onChange,
  onRemove,
}: {
  label: string;
  parentKey: string;
  value: LuaVal;
  onChange: (v: LuaVal) => void;
  onRemove?: () => void;
}) {
  const docKey = parentKey ? `${parentKey}.${label}` : label;
  return (
    <div className={cn('space-y-1', value.t === 'bool' && 'flex items-center justify-between space-y-0')}>
      <Label className="flex items-center gap-1.5">
        {label}
        <InfoHint text={FIELD_DOCS[docKey] ?? FIELD_DOCS[label]} />
        {onRemove && (
          <button onClick={onRemove} title="Remove field" className="text-muted-foreground/50 hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </Label>
      <ValueEditor value={value} onChange={onChange} pathKey={docKey} />
    </div>
  );
}

/* Dispatch an editor by value type. */
function ValueEditor({ value, onChange, pathKey }: { value: LuaVal; onChange: (v: LuaVal) => void; pathKey: string }) {
  const ph = FIELD_PLACEHOLDERS[pathKey] ?? FIELD_PLACEHOLDERS[pathKey.split('.').pop() ?? ''];
  switch (value.t) {
    case 'bool':
      return <Switch checked={value.v} onCheckedChange={(c) => onChange({ t: 'bool', v: c })} />;
    case 'num':
      return (
        <Input
          type="number"
          placeholder={ph}
          value={value.v}
          onChange={(e) => onChange({ t: 'num', v: e.target.value === '' ? 0 : Number(e.target.value) })}
        />
      );
    case 'str':
      return <Input placeholder={ph} value={value.v} onChange={(e) => onChange({ t: 'str', v: e.target.value })} />;
    case 'vec3':
      // Edit coordinates as a single Lua expression (vec3/vector3/vec4…), easier
      // to paste from the game than separate X/Y/Z boxes.
      return (
        <Input
          className="font-mono"
          placeholder="vec3(x, y, z)"
          value={`vec3(${value.v.join(', ')})`}
          onChange={(e) => onChange({ t: 'raw', v: e.target.value })}
        />
      );
    case 'raw':
      return (
        <Input className="font-mono" placeholder={ph ?? '{ ... }'} value={value.v} onChange={(e) => onChange({ t: 'raw', v: e.target.value })} />
      );
    default:
      return <span className="text-xs text-muted-foreground">unsupported</span>;
  }
}
