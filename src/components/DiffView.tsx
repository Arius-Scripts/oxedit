import { useMemo } from 'react';
import { diffLines } from 'diff';
import { cn } from '@/lib/utils';

interface Row {
  type: 'add' | 'del' | 'ctx';
  oldNo: number | null;
  newNo: number | null;
  text: string;
}

/** GitHub-style unified line diff. Collapses long runs of unchanged context. */
export function DiffView({ before, after, context = 3 }: { before: string; after: string; context?: number }) {
  const rows = useMemo(() => {
    const parts = diffLines(before, after);
    const all: Row[] = [];
    let oldNo = 1;
    let newNo = 1;
    for (const part of parts) {
      const lines = part.value.replace(/\n$/, '').split('\n');
      for (const line of lines) {
        if (part.added) all.push({ type: 'add', oldNo: null, newNo: newNo++, text: line });
        else if (part.removed) all.push({ type: 'del', oldNo: oldNo++, newNo: null, text: line });
        else all.push({ type: 'ctx', oldNo: oldNo++, newNo: newNo++, text: line });
      }
    }
    // Collapse context runs longer than 2*context.
    const keep = new Array(all.length).fill(false);
    all.forEach((r, i) => {
      if (r.type !== 'ctx') {
        for (let j = Math.max(0, i - context); j <= Math.min(all.length - 1, i + context); j++) keep[j] = true;
      }
    });
    const out: (Row | 'gap')[] = [];
    let gapped = false;
    all.forEach((r, i) => {
      if (keep[i]) {
        out.push(r);
        gapped = false;
      } else if (!gapped) {
        out.push('gap');
        gapped = true;
      }
    });
    return out;
  }, [before, after, context]);

  const changed = before !== after;

  return (
    <div className="overflow-auto rounded-md border border-border bg-[hsl(222_22%_7%)] font-mono text-xs leading-relaxed">
      {!changed && (
        <div className="px-4 py-6 text-center text-muted-foreground">No changes</div>
      )}
      {rows.map((r, i) =>
        r === 'gap' ? (
          <div key={i} className="select-none bg-muted/30 px-4 py-0.5 text-center text-muted-foreground">⋯</div>
        ) : (
          <div
            key={i}
            className={cn(
              'flex',
              r.type === 'add' && 'diff-add',
              r.type === 'del' && 'diff-del'
            )}
          >
            <span className="w-10 shrink-0 select-none px-2 text-right text-muted-foreground/50">{r.oldNo ?? ''}</span>
            <span className="w-10 shrink-0 select-none px-2 text-right text-muted-foreground/50">{r.newNo ?? ''}</span>
            <span
              className={cn(
                'w-4 shrink-0 select-none text-center',
                r.type === 'add' && 'text-emerald-400',
                r.type === 'del' && 'text-red-400'
              )}
            >
              {r.type === 'add' ? '+' : r.type === 'del' ? '-' : ''}
            </span>
            <span className="whitespace-pre-wrap break-all pr-4">{r.text || ' '}</span>
          </div>
        )
      )}
    </div>
  );
}
