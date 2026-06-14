import { Suspense, lazy, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Boxes, FolderInput, FolderOpen, Loader2, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/stores/appStore';
import { captureDrop } from '@/services/fileSystem';
import { cn } from '@/lib/utils';

// The editor surface is loaded only once a folder is opened, keeping the landing
// screen's initial bundle tiny (no jszip, diff viewer, Monaco or data pages).
const Workspace = lazy(() => import('./Workspace'));

export default function App() {
  const { supported, status, error, init } = useApp();

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

  if (status !== 'ready') return <Landing loading={status === 'loading'} supported={supported} />;

  return (
    <Suspense
      fallback={
        <div className="grid h-screen place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <Workspace />
    </Suspense>
  );
}

function Landing({ loading, supported }: { loading: boolean; supported: boolean }) {
  const choose = useApp((s) => s.chooseFolder);
  const upload = useApp((s) => s.chooseUpload);
  const drop = useApp((s) => s.chooseDrop);
  const tryDemo = useApp((s) => s.loadDemo);
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
        <h1 className="text-2xl font-semibold">oxEdit</h1>
        <p className="mt-1 text-sm font-medium text-primary">ox_inventory item, weapon &amp; shop editor</p>
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

        <button
          onClick={tryDemo}
          disabled={loading}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" /> Try it with sample data — no folder needed
        </button>

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

        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-1 text-left text-[11px] text-muted-foreground">
          <li>Items editor</li>
          <li>Weapons editor</li>
          <li>Shops editor</li>
          <li>Crafting editor</li>
          <li>Stashes editor</li>
          <li>Image optimizer</li>
          <li>Bulk edits</li>
          <li>Non-destructive saves</li>
        </ul>

        <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <a
            href="https://github.com/Arius-Scripts/inventory_manager"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            GitHub
          </a>
          <span className="h-3 w-px bg-border" />
          <a
            href="https://overextended.dev/ox_inventory"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            ox_inventory docs
          </a>
          <span className="h-3 w-px bg-border" />
          <span>Made for FiveM servers</span>
        </footer>
      </div>
    </div>
  );
}
