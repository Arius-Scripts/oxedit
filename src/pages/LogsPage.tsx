import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/stores/appStore';
import type { LogEntry } from '@/services/db';

const VARIANT: Record<LogEntry['action'], any> = {
  modify: 'default',
  add: 'success',
  remove: 'destructive',
  revert: 'warning',
  export: 'secondary',
  open: 'outline',
};

export function LogsPage() {
  const logs = useApp((s) => s.logs);
  const clear = useApp((s) => s.clearLogs);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Activity log</h2>
          <Badge variant="secondary">{logs.length}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={clear} disabled={logs.length === 0}>
          <Trash2 /> Clear
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {logs.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">No activity yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">File</th>
                <th className="px-4 py-2 font-medium">Entry</th>
                <th className="px-4 py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-accent/40">
                  <td className="whitespace-nowrap px-4 py-1.5 text-xs text-muted-foreground">
                    {new Date(l.ts).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-1.5">
                    <Badge variant={VARIANT[l.action]}>{l.action}</Badge>
                  </td>
                  <td className="px-4 py-1.5 font-mono text-xs">{l.file}</td>
                  <td className="px-4 py-1.5 font-mono text-xs">{l.entry}</td>
                  <td className="px-4 py-1.5 text-xs text-muted-foreground">{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
