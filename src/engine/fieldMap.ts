import { parseLua } from './luaParse';

export type ValueType = 'string' | 'number' | 'boolean' | 'table' | 'function' | 'call' | 'member' | 'raw';

export interface FieldMapping {
  path: string;
  keyStart: number;
  keyEnd: number;
  valueStart: number;
  valueEnd: number;
  valueType: ValueType;
  rawValue: string;
  isReadOnly: boolean;
}

export interface EntryMapping {
  key: string;
  start: number;
  end: number;
  /** Byte range of the entry's inner table `{ ... }` (if the value is a table). */
  tableStart?: number;
  tableEnd?: number;
  fields: FieldMapping[];
}

export interface FileModel {
  type: 'keyed-map' | 'indexed-array' | 'multi-section';
  entries: EntryMapping[];
  fields: FieldMapping[];
  fieldIndex: Map<string, FieldMapping>;
  source: string;
  hash: string;
}

function getValueType(node: any): ValueType {
  switch (node.type) {
    case 'StringLiteral': return 'string';
    case 'NumericLiteral': return 'number';
    case 'BooleanLiteral': return 'boolean';
    case 'TableConstructorExpression': return 'table';
    case 'FunctionDeclaration': return 'function';
    case 'CallExpression':
    case 'StringCallExpression':
      return 'call';
    case 'MemberExpression': return 'member';
    case 'UnaryExpression':
    case 'BinaryExpression':
      return 'raw';
    default: return 'raw';
  }
}

function isReadOnly(node: any): boolean {
  const t = node.type;
  return t === 'MemberExpression' ||
    t === 'UnaryExpression' ||
    t === 'BinaryExpression' ||
    t === 'IndexExpression' ||
    t === 'LogicalExpression';
}

function extractStringValue(node: any): string {
  // luaparse may set .value to null; extract from .raw instead
  if (node.value != null) return String(node.value);
  if (node.raw) {
    const raw = node.raw;
    // Strip surrounding quotes (single, double, or brackets)
    if ((raw.startsWith("'") && raw.endsWith("'")) ||
        (raw.startsWith('"') && raw.endsWith('"'))) {
      return raw.slice(1, -1);
    }
  }
  return '';
}

function extractKey(node: any, preprocessed: string): string {
  if (node.type === 'TableKey') {
    const keyNode = node.key;
    if (keyNode.type === 'StringLiteral') return extractStringValue(keyNode);
    if (keyNode.type === 'NumericLiteral') return String(keyNode.value);
    return preprocessed.substring(keyNode.range[0], keyNode.range[1]);
  }
  if (node.type === 'TableKeyString') {
    return node.key.name;
  }
  if (node.type === 'TableValue') {
    return '';
  }
  return '';
}

/**
 * Walk a table node and extract field mappings.
 * `originalSource` is used for rawValue extraction (preserves backticks).
 * `preprocessed` is used for key extraction from the AST.
 */
function walkTable(
  node: any,
  originalSource: string,
  preprocessed: string,
  pathPrefix: string,
  fields: FieldMapping[],
  depth: number = 0
): void {
  if (!node || node.type !== 'TableConstructorExpression') return;

  for (let i = 0; i < node.fields.length; i++) {
    const field = node.fields[i];
    let key: string;
    let keyStart: number;
    let keyEnd: number;

    if (field.type === 'TableKey') {
      key = extractKey(field, preprocessed);
      keyStart = field.key.range[0];
      keyEnd = field.key.range[1];
    } else if (field.type === 'TableKeyString') {
      key = field.key.name;
      keyStart = field.key.range[0];
      keyEnd = field.key.range[1];
    } else if (field.type === 'TableValue') {
      key = String(i);
      keyStart = field.value.range[0];
      keyEnd = field.value.range[0];
    } else {
      continue;
    }

    const value = field.value;
    const path = pathPrefix ? `${pathPrefix}.${key}` : key;
    const valueType = getValueType(value);

    fields.push({
      path,
      keyStart,
      keyEnd,
      valueStart: value.range[0],
      valueEnd: value.range[1],
      valueType,
      // Use original source for rawValue to preserve backtick syntax
      rawValue: originalSource.substring(value.range[0], value.range[1]),
      isReadOnly: isReadOnly(value),
    });

    const MAX_TABLE_DEPTH = 4;
    if (value.type === 'TableConstructorExpression' && depth < MAX_TABLE_DEPTH) {
      walkTable(value, originalSource, preprocessed, path, fields, depth + 1);
    }
  }
}

function detectFileType(returnTable: any): 'keyed-map' | 'indexed-array' | 'multi-section' {
  if (!returnTable || returnTable.type !== 'TableConstructorExpression') return 'keyed-map';

  const fields = returnTable.fields || [];
  if (fields.length === 0) return 'keyed-map';

  // If all top-level entries are TableValue, it's an indexed array
  const allValues = fields.every((f: any) => f.type === 'TableValue');
  if (allValues) return 'indexed-array';

  // Check if it has named top-level sections whose values are tables-of-tables
  const namedSections = fields.filter(
    (f: any) => (f.type === 'TableKeyString' || f.type === 'TableKey') &&
      f.value?.type === 'TableConstructorExpression'
  );

  // Multi-section: top-level keys are categories containing sub-entries that use
  // bracket keys ['key'] and have table values.
  // E.g., Weapons = { ['WEAPON_X'] = { label=... }, ['WEAPON_Y'] = { ... } }
  // vs keyed-map: General = { name = 'Shop', inventory = {...} } where sub-fields
  // use bare identifier keys (TableKeyString)
  if (namedSections.length > 1) {
    const allSectionsUseBracketKeys = namedSections.every((s: any) => {
      const subFields = s.value.fields || [];
      if (subFields.length === 0) return false;
      // Check if sub-entries primarily use bracket keys (TableKey) with table values
      const bracketKeyCount = subFields.filter(
        (sf: any) => sf.type === 'TableKey' && sf.value?.type === 'TableConstructorExpression'
      ).length;
      // Must have majority bracket-key table entries
      return bracketKeyCount >= subFields.length * 0.5;
    });
    if (allSectionsUseBracketKeys) return 'multi-section';
  }

  return 'keyed-map';
}

export function buildFileModel(source: string, hash: string): FileModel {
  const { ast, preprocessed } = parseLua(source);

  // Find the return statement
  const returnStatement: any = ast.body.find((s: any) => s.type === 'ReturnStatement');
  if (!returnStatement || !returnStatement.arguments || returnStatement.arguments.length === 0) {
    return { type: 'keyed-map', entries: [], fields: [], fieldIndex: new Map(), source, hash };
  }

  const returnTable = returnStatement.arguments[0];
  if (returnTable.type !== 'TableConstructorExpression') {
    return { type: 'keyed-map', entries: [], fields: [], fieldIndex: new Map(), source, hash };
  }

  const fileType = detectFileType(returnTable);
  const entries: EntryMapping[] = [];
  const allFields: FieldMapping[] = [];

  if (fileType === 'multi-section') {
    for (const sectionField of returnTable.fields) {
      if (sectionField.type !== 'TableKeyString' && sectionField.type !== 'TableKey') continue;
      const sectionName = sectionField.type === 'TableKeyString'
        ? sectionField.key.name
        : extractKey(sectionField, preprocessed);
      const sectionTable = sectionField.value;
      if (sectionTable.type !== 'TableConstructorExpression') continue;

      for (let i = 0; i < sectionTable.fields.length; i++) {
        const entryField = sectionTable.fields[i];
        let entryKey: string;

        if (entryField.type === 'TableKey') {
          entryKey = extractKey(entryField, preprocessed);
        } else if (entryField.type === 'TableKeyString') {
          entryKey = entryField.key.name;
        } else if (entryField.type === 'TableValue') {
          entryKey = String(i);
        } else continue;

        const fullKey = `${sectionName}.${entryKey}`;
        const entryFields: FieldMapping[] = [];
        const value = entryField.value;

        if (value.type === 'TableConstructorExpression') {
          walkTable(value, source, preprocessed, fullKey, entryFields);
        }

        entries.push({
          key: fullKey,
          start: entryField.range[0],
          end: entryField.range[1],
          tableStart: value.type === 'TableConstructorExpression' ? value.range[0] : undefined,
          tableEnd: value.type === 'TableConstructorExpression' ? value.range[1] : undefined,
          fields: entryFields,
        });

        allFields.push(...entryFields);
      }
    }
  } else {
    for (let i = 0; i < returnTable.fields.length; i++) {
      const entryField = returnTable.fields[i];
      let entryKey: string;

      if (entryField.type === 'TableKey') {
        entryKey = extractKey(entryField, preprocessed);
      } else if (entryField.type === 'TableKeyString') {
        entryKey = entryField.key.name;
      } else if (entryField.type === 'TableValue') {
        entryKey = String(i);
      } else continue;

      const entryFields: FieldMapping[] = [];
      const value = entryField.value;

      if (value.type === 'TableConstructorExpression') {
        walkTable(value, source, preprocessed, entryKey, entryFields);
      }

      entries.push({
        key: entryKey,
        start: entryField.range[0],
        end: entryField.range[1],
        tableStart: value.type === 'TableConstructorExpression' ? value.range[0] : undefined,
        tableEnd: value.type === 'TableConstructorExpression' ? value.range[1] : undefined,
        fields: entryFields,
      });

      allFields.push(...entryFields);
    }
  }

  const fieldIndex = new Map<string, FieldMapping>();
  for (const f of allFields) fieldIndex.set(f.path, f);

  return { type: fileType, entries, fields: allFields, fieldIndex, source, hash };
}
