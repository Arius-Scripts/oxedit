import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Archive,
  Boxes,
  ClipboardList,
  Crosshair,
  Download,
  FolderInput,
  FolderOpen,
  Hammer,
  Image as ImageIcon,
  Loader2,
  ShoppingCart,
  Upload,
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
import { captureDrop, type DataFileName } from '@/services/fileSystem';
import { DataFilePage } from '@/pages/DataFilePage';
import { ImagesPage } from '@/pages/ImagesPage';
import { LogsPage } from '@/pages/LogsPage';
import { cn } from '@/lib/utils';

type View = DataFileName | 'images' | 'logs';

const FILE_ICON: Record<DataFileName, any> = {
  items: Boxes,
  weapons: Crosshair,
  shops: ShoppingCart,
  crafting: Hammer,
  stashes: Archive,
};

export default function App() {
  const { supported, status, error, init } = useApp();
  const order = useApp((s) => s.order);
  const files = useApp((s) => s.files);
  const [view, setView] = useState<View>('items');

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // Prevent the browser from navigating away if a folder is dropped outside the drop zone.
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  useEffect(() => {
    if (status === 'ready' && order.length && !order.includes(view as DataFileName) && view !== 'images' && view !== 'logs') {
      setView(order[0]);
    }
  }, [status, order, view]);

  if (status !== 'ready') return <Landing loading={status === 'loading'} supported={supported} />;

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
  const close = useApp((s) => s.closeFolder);

  const dirtyCount = order.filter((f) => files[f]?.dirty).length;

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
          <div className="truncate text-sm font-semibold leading-tight">ox Item Manager</div>
          <div className="truncate text-[11px] text-muted-foreground" title={handle?.name}>
            {handle?.name ?? 'no folder'}
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
        <NavItem id="images" label="Images" icon={ImageIcon} />
        <NavItem id="logs" label="Activity log" icon={ClipboardList} />
      </nav>

      <div className="space-y-2 border-t border-border p-3">
        <ExportDialog dirtyCount={dirtyCount} />
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={close}>
          <X /> Close folder
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

function Landing({ loading, supported }: { loading: boolean; supported: boolean }) {
  const choose = useApp((s) => s.chooseFolder);
  const upload = useApp((s) => s.chooseUpload);
  const drop = useApp((s) => s.chooseDrop);
  const [dragOver, setDragOver] = useState(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (loading || !e.dataTransfer?.items?.length) return;
    // Capture synchronously — the DataTransfer dies once this handler returns.
    drop(captureDrop(Array.from(e.dataTransfer.items)));
  };

  return (
    <div className="grid h-screen place-items-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-primary/20 text-primary">
          <Boxes className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold">ox Item Manager</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Edit your ox_inventory items, weapons, shops and more — safely. Only the lines you change get
          touched; everything else stays byte-for-byte identical.
        </p>

        {/* Primary action: drag the folder in. Works in every browser and only reads
            data/ and web/images/, so the rest of the resource is never loaded. */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            'mt-6 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 transition-colors',
            dragOver ? 'border-primary bg-primary/10' : 'border-border bg-card/30'
          )}
        >
          {loading ? (
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          ) : (
            <FolderInput className="h-7 w-7 text-primary" />
          )}
          <div className="text-sm font-medium">
            {loading ? 'Loading…' : 'Drag your ox_inventory folder here'}
          </div>
          <div className="text-xs text-muted-foreground">
            Lightest option — loads only items and icons, never the whole resource.
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span className="h-px w-8 bg-border" /> or pick it <span className="h-px w-8 bg-border" />
          </div>
          {supported ? (
            <>
              <Button size="lg" className="w-64" onClick={choose} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <FolderOpen />}
                Open ox_inventory folder
              </Button>
              <button
                onClick={upload}
                disabled={loading}
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                or upload the folder instead
              </button>
              <p className="max-w-sm text-[11px] text-muted-foreground">
                “Open” and dragging into Chrome/Edge let you save edits straight back to disk.
              </p>
            </>
          ) : (
            <>
              <Button size="lg" className="w-64" onClick={upload} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Upload />}
                Upload ox_inventory folder
              </Button>
              <p className="max-w-sm text-[11px] text-muted-foreground">
                Uploading the whole folder is slower here (Brave/Firefox/Safari list every file).
                Dragging the folder above is faster. Changes export as a zip — for in-place saving use
                Chrome or Edge.
              </p>
            </>
          )}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Your files never leave your computer — everything runs in your browser.
        </p>
      </div>
    </div>
  );
}
