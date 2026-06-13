import { parseLua } from './luaParse';

/**
 * A typed, editable representation of a Lua value. Round-trips through
 * parseLuaValue / serializeLuaValue. Unsupported constructs (function bodies,
 * unusual calls, expressions) are preserved verbatim as `raw`.
 */
export type LuaVal =
  | { t: 'str'; v: string }
  | { t: 'num'; v: number }
  | { t: 'bool'; v: boolean }
  | { t: 'vec3'; v: [number, number, number] }
  | { t: 'raw'; v: string }
  | { t: 'arr'; v: LuaVal[] }
  | { t: 'map'; v: MapField[] };

export interface MapField {
  key: string;
  /** true when the original used bracket syntax e.g. ['key'] */
  bracket: boolean;
  val: LuaVal;
}

const VEC_FNS = new Set(['vec3', 'vector3', 'vec', 'vector']);

function numFromNode(node: any): number | null {
  if (node.type === 'NumericLiteral') return node.value;
  if (node.type === 'UnaryExpression' && node.operator === '-') {
    const inner = numFromNode(node.argument);
    return inner == null ? null : -inner;
  }
  return null;
}

function strValue(node: any): string {
  if (node.value != null) return String(node.value);
  const raw = node.raw ?? '';
  if (raw.length >= 2 && /^['"]/.test(raw)) return raw.slice(1, -1);
  return raw;
}

function convert(node: any, src: string): LuaVal {
  switch (node.type) {
    case 'StringLiteral':
      return { t: 'str', v: strValue(node) };
    case 'NumericLiteral':
      return { t: 'num', v: node.value };
    case 'BooleanLiteral':
      return { t: 'bool', v: node.value };
    case 'UnaryExpression': {
      const n = numFromNode(node);
      if (n != null) return { t: 'num', v: n };
      return { t: 'raw', v: src.slice(node.range[0], node.range[1]) };
    }
    case 'CallExpression': {
      if (node.base?.type === 'Identifier' && VEC_FNS.has(node.base.name)) {
        const nums = node.arguments.map(numFromNode);
        if (nums.length === 3 && nums.every((x: any) => x != null)) {
          return { t: 'vec3', v: nums as [number, number, number] };
        }
      }
      return { t: 'raw', v: src.slice(node.range[0], node.range[1]) };
    }
    case 'TableConstructorExpression': {
      const fields = node.fields ?? [];
      const allValues = fields.length > 0 && fields.every((f: any) => f.type === 'TableValue');
      if (allValues || fields.length === 0) {
        return { t: 'arr', v: fields.map((f: any) => convert(f.value, src)) };
      }
      const out: MapField[] = [];
      for (const f of fields) {
        if (f.type === 'TableKeyString') out.push({ key: f.key.name, bracket: false, val: convert(f.value, src) });
        else if (f.type === 'TableKey') out.push({ key: strValue(f.key), bracket: true, val: convert(f.value, src) });
        else if (f.type === 'TableValue') out.push({ key: '', bracket: false, val: convert(f.value, src) }); // mixed; rare
      }
      return { t: 'map', v: out };
    }
    default:
      return { t: 'raw', v: src.slice(node.range[0], node.range[1]) };
  }
}

/** Parse a single Lua value (e.g. a table body `{ ... }`) into a LuaVal tree. */
export function parseLuaValue(text: string): LuaVal {
  const wrapped = 'return ' + text;
  const { ast } = parseLua(wrapped);
  const ret: any = (ast as any).body.find((s: any) => s.type === 'ReturnStatement');
  if (!ret || !ret.arguments?.length) return { t: 'raw', v: text.trim() };
  // Use the original wrapped text for raw slicing (backticks preserved, same byte length).
  return convert(ret.arguments[0], wrapped);
}

/* ---------------- serialize ---------------- */

const IDENT = /^[A-Za-z_]\w*$/;
const escStr = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');

function isScalar(v: LuaVal): boolean {
  return v.t === 'str' || v.t === 'num' || v.t === 'bool' || v.t === 'vec3' || (v.t === 'raw' && !v.v.includes('\n'));
}
function isSimpleMap(v: LuaVal): boolean {
  return v.t === 'map' && v.v.length <= 4 && v.v.every((f) => isScalar(f.val));
}

function scalarStr(v: LuaVal): string {
  switch (v.t) {
    case 'str':
      return `'${escStr(v.v)}'`;
    case 'num':
      return String(v.v);
    case 'bool':
      return v.v ? 'true' : 'false';
    case 'vec3':
      return `vec3(${v.v.join(', ')})`;
    case 'raw':
      return v.v;
    default:
      return '';
  }
}

export function serializeLuaValue(val: LuaVal, indent = ''): string {
  if (val.t !== 'arr' && val.t !== 'map') return scalarStr(val);
  const inner = indent + '\t';

  if (val.t === 'arr') {
    if (val.v.length === 0) return '{}';
    const items = val.v.map((el) => `${inner}${serializeLuaValue(el, inner)}`);
    return `{\n${items.join(',\n')},\n${indent}}`;
  }

  // map
  if (val.v.length === 0) return '{}';
  const renderField = (f: MapField) => {
    const keyText = f.bracket || !IDENT.test(f.key) ? `['${escStr(f.key)}']` : f.key;
    return `${keyText} = ${serializeLuaValue(f.val, inner)}`;
  };
  if (isSimpleMap(val)) {
    return `{ ${val.v.map(renderField).join(', ')} }`;
  }
  const items = val.v.map((f) => `${inner}${renderField(f)}`);
  return `{\n${items.join(',\n')},\n${indent}}`;
}

/* ---------------- small tree helpers for the editor ---------------- */

/** Build an empty value of a given kind (for "add property" / new array items). */
export type ValKind = 'str' | 'num' | 'bool' | 'vec3' | 'arr' | 'map' | 'raw';
export function blankVal(kind: ValKind): LuaVal {
  switch (kind) {
    case 'str':
      return { t: 'str', v: '' };
    case 'num':
      return { t: 'num', v: 0 };
    case 'bool':
      return { t: 'bool', v: false };
    case 'vec3':
      return { t: 'vec3', v: [0, 0, 0] };
    case 'arr':
      return { t: 'arr', v: [] };
    case 'map':
      return { t: 'map', v: [] };
    case 'raw':
      return { t: 'raw', v: '' };
  }
}

export function mapGet(val: LuaVal, key: string): LuaVal | undefined {
  if (val.t !== 'map') return undefined;
  return val.v.find((f) => f.key === key)?.val;
}
export function mapSet(val: LuaVal, key: string, newVal: LuaVal): LuaVal {
  if (val.t !== 'map') return val;
  const idx = val.v.findIndex((f) => f.key === key);
  const fields = [...val.v];
  if (idx === -1) fields.push({ key, bracket: false, val: newVal });
  else fields[idx] = { ...fields[idx], val: newVal };
  return { t: 'map', v: fields };
}
export function mapDelete(val: LuaVal, key: string): LuaVal {
  if (val.t !== 'map') return val;
  return { t: 'map', v: val.v.filter((f) => f.key !== key) };
}
