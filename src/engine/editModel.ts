import type { FileModel, FieldMapping, ValueType } from './fieldMap';
import { buildFileModel } from './fieldMap';
import {
  computeSpliceOps,
  applySplices,
  addEntry,
  deleteEntry,
  roundTrip,
  insertFields,
  type SpliceOp,
} from './spliceEngine';
import { serializeValue } from './serialize';
import { hashString } from '@/lib/utils';

/** A schema field descriptor (shape used across all schemas). */
export interface SchemaField {
  key: string;
  type: ValueType;
  required?: boolean;
}

export type DisplayValue = string | number | boolean;

export interface FormField {
  /** Full splice path, e.g. "bandage.label" or "bandage.client.image". */
  path: string;
  /** Display label, e.g. "label" or "client.image". */
  key: string;
  type: ValueType;
  present: boolean;
  required: boolean;
  rawValue: string;
  value: DisplayValue;
  readOnly: boolean;
}

const QUOTES = ["'", '"', '`'];

/** Strip surrounding quotes/backticks from a raw Lua string literal. */
export function unquote(raw: string): string {
  if (raw.length >= 2 && QUOTES.includes(raw[0]) && raw[raw.length - 1] === raw[0]) {
    return raw
      .slice(1, -1)
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
  }
  return raw;
}

function toDisplay(field: FieldMapping): DisplayValue {
  switch (field.valueType) {
    case 'string':
      return unquote(field.rawValue);
    case 'number':
      return Number(field.rawValue);
    case 'boolean':
      return field.rawValue === 'true';
    default:
      return field.rawValue;
  }
}

/** Build a fresh model + content hash from source text. */
export function modelFromSource(source: string): { model: FileModel; hash: string } {
  const hash = hashString(source);
  return { model: buildFileModel(source, hash), hash };
}

/** Find the field mapping for an exact splice path. */
function fieldByPath(model: FileModel, path: string): FieldMapping | undefined {
  return model.fieldIndex.get(path);
}

/**
 * Build the list of form fields for one entry, driven by a schema.
 * `schemaFields` are the top-level fields; `nested` maps a sub-table key
 * (e.g. "client") to its fields.
 */
export function buildEntryForm(
  model: FileModel,
  entryKey: string,
  schemaFields: SchemaField[],
  nested?: Record<string, SchemaField[]>
): FormField[] {
  const out: FormField[] = [];

  const push = (displayKey: string, sf: SchemaField) => {
    const path = `${entryKey}.${displayKey}`;
    const field = fieldByPath(model, path);
    if (field) {
      out.push({
        path,
        key: displayKey,
        type: field.valueType,
        present: true,
        required: !!sf.required,
        rawValue: field.rawValue,
        value: toDisplay(field),
        readOnly: field.isReadOnly,
      });
    } else {
      out.push({
        path,
        key: displayKey,
        type: sf.type,
        present: false,
        required: !!sf.required,
        rawValue: '',
        value: sf.type === 'boolean' ? false : sf.type === 'number' ? 0 : '',
        readOnly: false,
      });
    }
  };

  for (const sf of schemaFields) push(sf.key, sf);
  if (nested) {
    for (const [group, fields] of Object.entries(nested)) {
      for (const sf of fields) push(`${group}.${sf.key}`, sf);
    }
  }
  return out;
}

/** Get the entry keys for a file (item ids, weapon names, or array indices). */
export function entryKeys(model: FileModel): string[] {
  return model.entries.map((e) => e.key);
}

/** Keys that appear more than once (Lua keeps only the last; earlier ones are silently lost). */
export function duplicateKeys(model: FileModel): Set<string> {
  const counts = new Map<string, number>();
  for (const e of model.entries) counts.set(e.key, (counts.get(e.key) ?? 0) + 1);
  return new Set([...counts].filter(([, n]) => n > 1).map(([k]) => k));
}

/** Replace just the table body `{ ... }` of an entry, keeping its key prefix intact. */
export function replaceEntryTable(source: string, model: FileModel, entryKey: string, newTable: string): string {
  const entry = model.entries.find((e) => e.key === entryKey);
  if (!entry || entry.tableStart == null || entry.tableEnd == null) return source;
  return source.slice(0, entry.tableStart) + newTable + source.slice(entry.tableEnd);
}

/** Read an entry's table body text (for the structured editor). */
export function entryTableText(source: string, model: FileModel, entryKey: string): string | null {
  const entry = model.entries.find((e) => e.key === entryKey);
  if (!entry || entry.tableStart == null || entry.tableEnd == null) return null;
  return source.slice(entry.tableStart, entry.tableEnd);
}

/** Read a single field's display value for an entry (used for list summaries). */
export function readField(model: FileModel, entryKey: string, key: string): DisplayValue | undefined {
  const f = fieldByPath(model, `${entryKey}.${key}`);
  return f ? toDisplay(f) : undefined;
}

/**
 * Apply a set of edits to source text, preserving every untouched byte.
 * `changes` maps splice path -> new display value. Returns new source.
 * Throws if the result fails to re-parse.
 */
export function applyEdits(
  source: string,
  changes: Map<string, DisplayValue>
): string {
  if (changes.size === 0) return source;
  const hash = hashString(source);
  // roundTrip parses, splices, and re-parses to validate.
  const { newSource } = roundTrip(source, hash, changes as Map<string, any>);
  return newSource;
}

/** Lower-level splice (no re-parse), used when we have a prebuilt model. */
export function spliceEdits(model: FileModel, source: string, changes: Map<string, DisplayValue>): string {
  const ops = computeSpliceOps(model, changes as Map<string, any>);
  return applySplices(source, ops);
}

export interface FieldEdit {
  /** Full splice path, e.g. "water.client.image". */
  path: string;
  value: DisplayValue;
  type: ValueType;
  /** Whether the field already exists in the source (replace) or must be inserted. */
  present: boolean;
}

const leafKey = (path: string) => path.split('.').pop() as string;

/**
 * Apply form edits to one entry: present fields are replaced in place, absent
 * fields are inserted (creating a one-level parent table like `client` if needed).
 * Untouched fields and all other entries stay byte-for-byte identical.
 * Re-parses the result to validate; throws on failure.
 */
export function applyFormEdits(
  source: string,
  model: FileModel,
  entryKey: string,
  edits: FieldEdit[]
): string {
  if (edits.length === 0) return source;
  const entry = model.entries.find((e) => e.key === entryKey);
  if (!entry) return source;

  const ops: SpliceOp[] = [];

  // 1. Replace existing fields.
  for (const e of edits.filter((x) => x.present)) {
    const f = entry.fields.find((x) => x.path === e.path);
    if (!f || f.isReadOnly) continue;
    const serialized = serializeValue(e.value, e.type);
    if (serialized === f.rawValue) continue;
    ops.push({ start: f.valueStart, end: f.valueEnd, replacement: serialized });
  }

  // 2. Insert absent fields, grouped by their parent table.
  const relOf = (p: string) => p.slice(entryKey.length + 1);
  const entryTableItems: string[] = [];
  const byParent = new Map<FieldMapping, string[]>();

  for (const e of edits.filter((x) => !x.present)) {
    const rel = relOf(e.path);
    const dot = rel.lastIndexOf('.');
    const parentRel = dot === -1 ? '' : rel.slice(0, dot);
    const item = `${leafKey(e.path)} = ${serializeValue(e.value, e.type)}`;

    if (parentRel === '') {
      entryTableItems.push(item);
      continue;
    }
    const parentField = entry.fields.find(
      (x) => x.path === `${entryKey}.${parentRel}` && x.valueType === 'table'
    );
    if (parentField) {
      const arr = byParent.get(parentField) ?? [];
      arr.push(item);
      byParent.set(parentField, arr);
    } else if (!parentRel.includes('.')) {
      // Parent table is missing, so create it inline inside the entry table.
      entryTableItems.push(`${parentRel} = { ${item} }`);
    }
  }

  for (const [parentField, items] of byParent) {
    const op = insertFields(source, parentField.valueStart, parentField.valueEnd, items);
    if (op) ops.push(op);
  }
  if (entryTableItems.length && entry.tableStart != null && entry.tableEnd != null) {
    const op = insertFields(source, entry.tableStart, entry.tableEnd, entryTableItems);
    if (op) ops.push(op);
  }

  const newSource = applySplices(source, ops);
  buildFileModel(newSource, hashString(newSource)); // validate (throws on parse error)
  return newSource;
}

export { addEntry, deleteEntry };
