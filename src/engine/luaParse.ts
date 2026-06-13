import * as luaparse from 'luaparse';

export interface ParseResult {
  ast: luaparse.Chunk;
  comments: luaparse.Comment[];
  source: string;
  preprocessed: string;
  backtickRanges: BacktickRange[];
}

export interface BacktickRange {
  start: number;
  end: number;
  original: string;
  replacement: string;
}

/**
 * Replace backtick strings (`identifier`) with single-quoted equivalents ('identifier')
 * while preserving exact byte lengths by padding with spaces if needed.
 * Since backticks and single quotes are both 1 byte, lengths match perfectly.
 */
export function preprocessBackticks(source: string): {
  processed: string;
  ranges: BacktickRange[];
} {
  const ranges: BacktickRange[] = [];
  let result = '';
  let i = 0;

  while (i < source.length) {
    if (source[i] === '`') {
      const start = i;
      i++; // skip opening backtick
      let content = '';
      while (i < source.length && source[i] !== '`') {
        content += source[i];
        i++;
      }
      if (i < source.length) {
        i++; // skip closing backtick
      }
      const end = i;
      const original = source.substring(start, end);
      // Replace backtick with single quote - same length
      const replacement = "'" + content + "'";
      ranges.push({ start, end, original, replacement });
      result += replacement;
    } else {
      result += source[i];
      i++;
    }
  }

  return { processed: result, ranges };
}

export function parseLua(source: string): ParseResult {
  const { processed, ranges } = preprocessBackticks(source);
  const comments: luaparse.Comment[] = [];

  const ast = luaparse.parse(processed, {
    ranges: true,
    locations: true,
    comments: true,
    luaVersion: '5.3',
    onCreateNode: undefined,
    onCreateScope: undefined,
    onDestroyScope: undefined,
    onLocalDeclaration: undefined,
  });

  // Extract comments from AST
  if ((ast as any).comments) {
    comments.push(...(ast as any).comments);
  }

  return { ast, comments, source, preprocessed: processed, backtickRanges: ranges };
}
