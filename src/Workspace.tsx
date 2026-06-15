import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import toast from 'react-hot-toast';
import {
  Archive,
  Boxes,
  ClipboardList,
  Crosshair,
  Download,
  Hammer,
  Image as ImageIcon,
  Loader2,
  ShoppingCart,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useApp } from '@/stores/appStore';
import { FILE_LABELS } from '@/engine/schemaRegistry';
import { type DataFileName } from '@/services/fileSystem';
import { DataFilePage } from '@/pages/DataFilePage';
import { ImagesPage } from '@/pages/ImagesPage';
import { LogsPage } from '@/pages/LogsPage';
import { cn } from '@/lib/utils';

type View = DataFileName | 'images' | 'logs';

const VALID_VIEWS: View[] = ['items', 'weapons', 'shops', 'crafting', 'stashes', 'images', 'logs'];

function locationToView(path: string): View {
  const segment = path.replace(/^\//, '') as View;
  return VALID_VIEWS.includes(segment) ? segment : 'items';
}

const FILE_ICON: Record<DataFileName, any> = {
  items: Boxes,
  weapons: Crosshair,
  shops: ShoppingCart,
  crafting: Hammer,
  stashes: Archive,
};

// The editor surface, shown once a folder is loaded. Lazy-loaded from App so the
// landing screen (and crawlers/first-time visitors) never pay for jszip, the diff
// viewer, Monaco or the data pages up front.
export default function Workspace() {
  const order = useApp((s) => s.order);
  const files = useApp((s) => s.files);
  const [location, setLocation] = useLocation();
  const view = locationToView(location);
  const setView = (v: View) => setLocation('/' + v);

  // Sync URL on first mount: if user opened a folder from landing (/), push /items.
  useEffect(() => {
    if (location === '/' || location === '') setLocation('/items', { replace: true });
  }, []);

  useEffect(() => {
    if (order.length && !order.includes(view as DataFileName) && view !== 'images' && view !== 'logs') {
      setView(order[0]);
    }
  }, [order, view]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar view={view} setView={setView} />
      <main className="min-w-0 flex-1">
        {view === 'images' ? (
          <ImagesPage />
        ) : view === 'logs' ? (
          <LogsPage />
        ) : files[view as DataFileName] ? (
          <DataFilePage key={view} file={view as DataFileName} />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">Select a file</div>
        )}
      </main>
    </div>
  );
}

function Sidebar({ view, setView }: { view: View; setView: (v: View) => void }) {
  const order = useApp((s) => s.order);
  const files = useApp((s) => s.files);
  const handle = useApp((s) => s.handle);
  const demo = useApp((s) => s.demo);
  const close = useApp((s) => s.closeFolder);
  const images = useApp((s) => s.images);

  const dirtyCount = order.filter((f) => files[f]?.dirty).length;
  const imagesDirty = images.some((i) => !!(i.optimized || i.removed || i.added));

  const NavItem = ({ id, label, icon: Icon, dirty }: { id: View; label: string; icon: any; dirty?: boolean }) => (
    <button
      onClick={() => setView(id)}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
        view === id ? 'bg-primary/15 text-primary' : 'text-foreground/80 hover:bg-accent'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {dirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
    </button>
  );

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card/40">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/20 text-primary">
          <Boxes className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-tight">oxEdit</div>
          <div className="truncate text-[11px] text-muted-foreground" title={handle?.name}>
            {demo ? 'Sample data' : handle?.name ?? 'no folder'}
          </div>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-auto p-2">
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Data files
        </div>
        {order.map((f) => (
          <NavItem key={f} id={f} label={FILE_LABELS[f]} icon={FILE_ICON[f]} dirty={files[f]?.dirty} />
        ))}
        <div className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Assets
        </div>
        <NavItem id="images" label="Images" icon={ImageIcon} dirty={imagesDirty} />
        <NavItem id="logs" label="Activity log" icon={ClipboardList} />
      </nav>

      <div className="space-y-2 border-t border-border p-3">
        <ExportDialog dirtyCount={dirtyCount} />
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={close}>
          <X /> {demo ? 'Exit sample data' : 'Close folder'}
        </Button>
      </div>
    </aside>
  );
}

function ExportDialog({ dirtyCount }: { dirtyCount: number }) {
  const exportZip = useApp((s) => s.exportZip);
  const [open, setOpen] = useState(false);
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await exportZip({ onlyChanged });
      toast.success('Zip downloaded');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full">
          <Download /> Export zip
          {dirtyCount > 0 && <Badge variant="secondary">{dirtyCount}</Badge>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export zip</DialogTitle>
          <DialogDescription>
            Builds a zip with <span className="font-mono">data/</span> and{' '}
            <span className="font-mono">web/images/</span> ready to drop into ox_inventory.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <Label className="text-sm text-foreground">Only changed data files</Label>
            <p className="text-xs text-muted-foreground">
              {onlyChanged ? 'Exports just the files you edited.' : 'Exports all data files.'}
            </p>
          </div>
          <Switch checked={onlyChanged} onCheckedChange={setOnlyChanged} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={run} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Download />} Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
