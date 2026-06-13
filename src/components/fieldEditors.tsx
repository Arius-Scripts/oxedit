import { Plus, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';

/* ---------- tiny Lua flat-table parse / serialize helpers ---------- */

function stripBraces(raw: string): string | null {
  const m = raw.trim().match(/^\{([\s\S]*)\}$/);
  return m ? m[1] : null;
}
function splitTop(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of inner) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}
export function parseKV(raw: string): { key: string; raw: string }[] | null {
  if (!raw || !raw.trim()) return [];
  const inner = stripBraces(raw);
  if (inner === null) return null;
  if (!inner.trim()) return [];
  const out: { key: string; raw: string }[] = [];
  for (const p of splitTop(inner)) {
    const m = p.trim().match(/^(\w+)\s*=\s*([\s\S]+)$/);
    if (!m) return null;
    out.push({ key: m[1], raw: m[2].trim() });
  }
  return out;
}
const unquote = (s: string) => s.replace(/^['"`]|['"`]$/g, '');
const quote = (s: string) => `'${s.replace(/'/g, "\\'")}'`;

/* ---------- status: rows of stat = number ---------- */

const STATUS_PRESETS = ['hunger', 'thirst', 'stress', 'health', 'armour', 'stamina'];

export function StatusEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = parseKV(value);
  // Fall back to raw editing if it isn't a simple numeric table.
  if (parsed === null) return <RawTable value={value} onChange={onChange} />;
  const rows = parsed.map((r) => ({ key: r.key, val: r.raw }));

  const serialize = (rs: { key: string; val: string }[]) => {
    const clean = rs.filter((r) => r.key.trim());
    if (clean.length === 0) return '';
    return `{ ${clean.map((r) => `${r.key} = ${r.val === '' ? 0 : r.val}`).join(', ')} }`;
  };
  const update = (rs: { key: string; val: string }[]) => onChange(serialize(rs));

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            className="h-8 flex-1 text-xs"
            placeholder="stat"
            value={r.key}
            onChange={(e) => update(rows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
          />
          <Input
            type="number"
            className="h-8 w-28 text-xs"
            placeholder="amount"
            value={r.val}
            onChange={(e) => update(rows.map((x, j) => (j === i ? { ...x, val: e.target.value } : x)))}
          />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => update(rows.filter((_, j) => j !== i))}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="outline" size="sm" className="h-7" onClick={() => update([...rows, { key: '', val: '0' }])}>
          <Plus className="h-3 w-3" /> Add stat
        </Button>
        {STATUS_PRESETS.filter((p) => !rows.some((r) => r.key === p)).map((p) => (
          <button
            key={p}
            onClick={() => update([...rows, { key: p, val: '100000' }])}
            className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
          >
            + {p}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- anim: dict + clip ---------- */

export function AnimEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = parseKV(value);
  if (parsed === null || parsed.some((p) => !['dict', 'clip', 'flag'].includes(p.key))) {
    return <RawTable value={value} onChange={onChange} />;
  }
  const get = (k: string) => parsed.find((p) => p.key === k)?.raw ?? '';
  const dict = unquote(get('dict'));
  const clip = unquote(get('clip'));

  const serialize = (d: string, c: string) => {
    if (!d && !c) return '';
    return `{ dict = ${quote(d)}, clip = ${quote(c)} }`;
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <Input className="h-8 text-xs" placeholder="dictionary" value={dict} onChange={(e) => onChange(serialize(e.target.value, clip))} />
      <Input className="h-8 text-xs" placeholder="clip" value={clip} onChange={(e) => onChange(serialize(dict, e.target.value))} />
    </div>
  );
}

/* ---------- disable: boolean toggle chips ---------- */

const DISABLE_KEYS = ['move', 'car', 'combat', 'sprint', 'mouse'];

export function DisableEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = parseKV(value);
  if (parsed === null || parsed.some((p) => !DISABLE_KEYS.includes(p.key))) {
    return <RawTable value={value} onChange={onChange} />;
  }
  const on = new Set(parsed.filter((p) => p.raw === 'true').map((p) => p.key));

  const toggle = (k: string) => {
    const next = new Set(on);
    next.has(k) ? next.delete(k) : next.add(k);
    const keys = DISABLE_KEYS.filter((x) => next.has(x));
    onChange(keys.length ? `{ ${keys.map((x) => `${x} = true`).join(', ')} }` : '');
  };

  return (
    <div className="flex flex-wrap gap-3">
      {DISABLE_KEYS.map((k) => (
        <label key={k} className="flex items-center gap-1.5 text-xs">
          <Switch checked={on.has(k)} onCheckedChange={() => toggle(k)} />
          {k}
        </label>
      ))}
    </div>
  );
}

/* ---------- fallback raw table input ---------- */

export function RawTable({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      className="font-mono text-xs"
      placeholder="{ ... }"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
