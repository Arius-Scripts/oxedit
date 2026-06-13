import type { FileModel, FieldMapping, EntryMapping } from './fieldMap';
import { buildFileModel } from './fieldMap';
import { serializeValue } from './serialize';

export interface SpliceOp {
  start: number;
  end: number;
  replacement: string;
}

/**
 * Apply splice operations to source text.
 * Operations are sorted descending by start offset so earlier offsets remain valid.
 */
export function applySplices(source: string, ops: SpliceOp[]): string {
  // Sort descending by start offset
  const sorted = [...ops].sort((a, b) => b.start - a.start);

  let result = source;
  for (const op of sorted) {
    result = result.substring(0, op.start) + op.replacement + result.substring(op.end);
  }

  return result;
}

/**
 * Compute splice operations from a set of field changes.
 * Each change maps a field path to a new value.
 */
export function computeSpliceOps(
  model: FileModel,
  changes: Map<string, any>
): SpliceOp[] {
  const ops: SpliceOp[] = [];

  for (const [path, newValue] of changes) {
    // Find the field in the model
    const field = findField(model, path);
    if (!field) continue;
    if (field.isReadOnly) continue;

    const serialized = serializeValue(newValue, field.valueType);
    if (serialized === field.rawValue) continue;

    ops.push({
      start: field.valueStart,
      end: field.valueEnd,
      replacement: serialized,
    });
  }

  return ops;
}

/**
 * Find a field mapping by path, searching all entries.
 */
function findField(model: FileModel, path: string): FieldMapping | undefined {
  // Search in all entry fields
  for (const entry of model.entries) {
    const field = entry.fields.find((f) => f.path === path);
    if (field) return field;
  }
  // Search in top-level fields
  return model.fields.find((f) => f.path === path);
}

/**
 * Add a new entry to the source file.
 * Inserts before the closing `}` of the return table.
 */
export function addEntry(source: string, model: FileModel, newEntryLua: string): string {
  // Find the last `}` that closes the return table
  // We need to find the return statement's table end
  const lastBrace = source.lastIndexOf('}');
  if (lastBrace === -1) return source;

  // Find the position just before the closing brace
  // Check if there's a comma/newline situation
  const beforeBrace = source.substring(0, lastBrace);
  const trimmed = beforeBrace.trimEnd();

  // Add appropriate separator
  let separator = '\n\n\t';
  if (trimmed.endsWith(',')) {
    separator = '\n\n\t';
  } else if (trimmed.endsWith('{')) {
    separator = '\n\t';
  } else {
    // Add trailing comma to previous entry
    separator = ',\n\n\t';
  }

  const insertPos = lastBrace;
  return source.substring(0, insertPos) + separator + newEntryLua + '\n' + source.substring(insertPos);
}

/**
 * Delete an entry from the source file.
 * Removes the entry and cleans up trailing comma/newline.
 */
export function deleteEntry(source: string, model: FileModel, entryKey: string): string {
  const entry = model.entries.find((e) => e.key === entryKey);
  if (!entry) return source;

  let start = entry.start;
  let end = entry.end;

  // Consume the trailing comma, any inline whitespace, and a single newline
  // so the entry's line(s) disappear cleanly.
  const afterEntry = source.substring(end);
  const trailingMatch = afterEntry.match(/^[ \t]*,?[ \t]*\r?\n?/);
  if (trailingMatch) {
    end += trailingMatch[0].length;
  }

  // Consume the entry's leading indentation only (NOT the preceding newline) —
  // pulling back across the newline would merge the next entry onto a preceding
  // comment line and break the file.
  const beforeEntry = source.substring(0, start);
  const leadingIndent = beforeEntry.match(/[ \t]+$/);
  if (leadingIndent) {
    start -= leadingIndent[0].length;
  }

  const left = source.substring(0, start);
  let right = source.substring(end);
  // Collapse a blank line created exactly at the deletion seam (local only —
  // never touches blank lines elsewhere in the file).
  if (left.endsWith('\n')) {
    right = right.replace(/^[ \t]*\r?\n/, '');
  }
  return left + right;
}

/**
 * Build a splice op that inserts one or more `key = value` items into an existing
 * table `{ ... }` (byte range [tableStart, tableEnd]), matching the table's existing
 * indentation/inline style. Touches only the bytes around the insertion point.
 */
export function insertFields(
  source: string,
  tableStart: number,
  tableEnd: number,
  items: string[]
): SpliceOp | null {
  if (items.length === 0) return null;
  const closeBrace = tableEnd - 1; // index of '}'
  if (source[closeBrace] !== '}') return null;

  const tableText = source.slice(tableStart, tableEnd);
  const inline = !tableText.includes('\n');
  const innerRaw = source.slice(tableStart + 1, closeBrace);
  const empty = innerRaw.trim() === '';

  // Indentation of the closing brace's line.
  const lineStart = source.lastIndexOf('\n', closeBrace - 1) + 1;
  const braceIndent = source.slice(lineStart, closeBrace).match(/^[ \t]*/)?.[0] ?? '';
  const fieldIndent = braceIndent + '\t';

  if (inline) {
    // Keep it on one line: `{ a = 1, NEW, NEW }`
    const before = source.slice(0, closeBrace);
    const trimmed = before.replace(/\s+$/, '');
    const last = trimmed[trimmed.length - 1];
    const sep = empty ? ' ' : last === ',' ? ' ' : ', ';
    const body = items.join(', ');
    const tail = empty ? ' ' : ' ';
    return { start: trimmed.length, end: closeBrace, replacement: `${sep}${body}${tail}` };
  }

  if (empty) {
    return {
      start: tableStart + 1,
      end: closeBrace,
      replacement: `\n${fieldIndent}${items.join(`,\n${fieldIndent}`)},\n${braceIndent}`,
    };
  }

  // Multi-line, non-empty: insert after the last field, before the brace's whitespace.
  const before = source.slice(0, closeBrace);
  const trimmed = before.replace(/\s+$/, '');
  const last = trimmed[trimmed.length - 1];
  const lead = last === ',' ? '' : ',';
  const body = items.join(`,\n${fieldIndent}`);
  return { start: trimmed.length, end: trimmed.length, replacement: `${lead}\n${fieldIndent}${body},` };
}

/**
 * Full round-trip: parse → model → splice → re-parse for validation.
 * Returns the new source or throws on error.
 */
export function roundTrip(
  source: string,
  hash: string,
  changes: Map<string, any>
): { newSource: string; newModel: FileModel } {
  const model = buildFileModel(source, hash);
  const ops = computeSpliceOps(model, changes);
  const newSource = applySplices(source, ops);

  // Re-parse to validate
  const newModel = buildFileModel(newSource, hash);

  return { newSource, newModel };
}
