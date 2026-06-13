import type { ValueType } from './fieldMap';

export function serializeValue(value: any, type: ValueType): string {
  switch (type) {
    case 'string':
      return serializeString(value);
    case 'number':
      return serializeNumber(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'function':
      // Functions are returned verbatim from Monaco
      return String(value);
    case 'call':
      // Call expressions (like vec3) are returned verbatim
      return String(value);
    case 'table':
      // Tables returned verbatim (edited in Monaco)
      return String(value);
    case 'raw':
      return String(value);
    default:
      return String(value);
  }
}

function serializeString(value: string): string {
  // Use single quotes to match ox_inventory convention
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `'${escaped}'`;
}

function serializeNumber(value: number | string): string {
  const num = Number(value);
  if (isNaN(num)) return '0';
  // Preserve decimal formatting
  if (Number.isInteger(num)) return String(num);
  return String(num);
}

export function serializeVec3(x: number, y: number, z: number): string {
  return `vec3(${serializeNumber(x)}, ${serializeNumber(y)}, ${serializeNumber(z)})`;
}

export function parseVec3(raw: string): { x: number; y: number; z: number } | null {
  const match = raw.match(/vec3\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/);
  if (!match) return null;
  return {
    x: parseFloat(match[1]),
    y: parseFloat(match[2]),
    z: parseFloat(match[3]),
  };
}

export function isBacktickString(raw: string): boolean {
  return raw.startsWith('`') && raw.endsWith('`');
}

export function serializeBacktickString(value: string): string {
  return '`' + value + '`';
}
