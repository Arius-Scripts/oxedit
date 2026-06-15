import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Copy, ImagePlus, ImageOff, Loader2, Minimize2, ScanSearch, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { InfoHint, Hint } from '@/components/InfoHint';
import { OptimizeModal } from '@/components/OptimizeModal';
import { useApp, type ImageState } from '@/stores/appStore';
import {
  analyzeImages,
  optimizeImage,
  type ImageAnalysis,
  LARGE_BYTES,
  LARGE_DIM,
} from '@/services/imageOptimizer';
import { formatBytes, cn } from '@/lib/utils';

export function ImagesPage() {
  const images = useApp((s) => s.images);
  const setOptimized = useApp((s) => s.setOptimizedImage);
  const toggleRemove = useApp((s) => s.toggleRemoveImage);
  const addImages = useApp((s) => s.addImages);

  const [analysis, setAnalysis] = useState<Record<string, ImageAnalysis>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [modalImage, setModalImage] = useState<ImageState | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);

  const filtered = useMemo(
    () => images.filter((i) => i.name.toLowerCase().includes(query.toLowerCase())),
    [images, query]
  );

  const totals = useMemo(() => {
    let original = 0;
    let current = 0;
    for (const i of images) {
      original += i.size;
      current += i.removed ? 0 : i.optimized?.size ?? i.size;
    }
    return { original, current, saved: original - current };
  }, [images]);

  const toggleSelect = (name: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(name) ? n.delete(name) : n.add(name);
      return n;
    });
  const allSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.name));
  const selectAll = () =>
    setSelected(allSelected ? new Set() : new Set(filtered.map((i) => i.name)));

  const runAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await analyzeImages(images.map((i) => ({ name: i.name, blob: i.blob, size: i.size })));
      setAnalysis(Object.fromEntries(res.map((r) => [r.name, r])));
      const large = res.filter((r) => r.isLarge).length;
      const dupes = res.filter((r) => r.duplicateOf).length;
      toast.success(`Analyzed ${res.length}: ${large} large, ${dupes} duplicates`);
    } finally {
      setAnalyzing(false);
    }
  };

  const optimizeSilently = async (img: ImageState) => {
    setBusy((b) => new Set(b).add(img.name));
    try {
      const res = await optimizeImage(img.name, img.blob);
      if (res.saved > 0) setOptimized(img.name, res.blob);
      return res.saved;
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(img.name);
        return n;
      });
    }
  };

  const bulk = async (targets: ImageState[], labelText: string) => {
    if (targets.length === 0) return toast(`Nothing to ${labelText}`);
    setBulkRunning(true);
    let saved = 0;
    try {
      for (const t of targets) saved += await optimizeSilently(t);
      toast.success(`Optimized ${targets.length}, saved ${formatBytes(saved)}`);
    } finally {
      setBulkRunning(false);
    }
  };

  const optimizeSelected = () => bulk(filtered.filter((i) => selected.has(i.name) && !i.optimized), 'optimize');
  const optimizeLarge = () =>
    bulk(filtered.filter((i) => analysis[i.name]?.isLarge && !i.optimized), 'optimize');

  const onAddImages = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.multiple = true;
    input.onchange = () => {
      const n = addImages(input.files ? Array.from(input.files) : []);
      if (n) toast.success(`Added ${n} image${n === 1 ? '' : 's'}`);
    };
    input.click();
  };

  const largeExplain = `"Large" = wider/taller than ${LARGE_DIM}px or bigger than ${formatBytes(
    LARGE_BYTES
  )}. Inventory icons only display small, so large images waste space and load slower. Run Analyze first to detect them.`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Images</h2>
          <Badge variant="secondary">{images.length}</Badge>
          <span className="text-xs text-muted-foreground">
            {formatBytes(totals.current)} / {formatBytes(totals.original)}
            {totals.saved > 0 && <span className="ml-1 text-emerald-400">(−{formatBytes(totals.saved)})</span>}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="h-8 w-36 text-xs"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button variant="outline" size="sm" onClick={onAddImages}>
            <ImagePlus /> Add images
          </Button>
          <Hint text="Detect oversized images and exact duplicates (by content hash).">
            <Button variant="outline" size="sm" onClick={runAnalyze} disabled={analyzing}>
              {analyzing ? <Loader2 className="animate-spin" /> : <ScanSearch />} Analyze
            </Button>
          </Hint>
          <div className="flex items-center">
            <Button size="sm" onClick={optimizeLarge} disabled={bulkRunning} className="rounded-r-none">
              {bulkRunning ? <Loader2 className="animate-spin" /> : <Minimize2 />} Optimize large
            </Button>
            <span className="grid h-8 place-items-center rounded-r-md border border-l-0 border-primary/40 bg-primary/10 px-1.5">
              <InfoHint text={largeExplain} />
            </span>
          </div>
        </div>
      </div>

      {/* selection bar */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/30 px-4 py-1.5 text-xs">
        <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
          <input type="checkbox" checked={allSelected} onChange={selectAll} className="accent-[hsl(var(--primary))]" />
          {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
        </label>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={selected.size === 0 || bulkRunning}
            onClick={optimizeSelected}
          >
            <Minimize2 /> Optimize selected
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={selected.size === 0}
            onClick={() => {
              selected.forEach((n) => toggleRemove(n));
              setSelected(new Set());
            }}
          >
            <Trash2 className="text-destructive" /> Exclude selected
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {images.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
            <div>
              <ImageOff className="mx-auto mb-2 h-8 w-8 opacity-40" />
              No images yet.
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={onAddImages}>
                  <ImagePlus /> Add images
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filtered.map((img) => {
              const a = analysis[img.name];
              const working = busy.has(img.name);
              const isSel = selected.has(img.name);
              return (
                <div
                  key={img.name}
                  className={cn(
                    'group relative rounded-lg border bg-card p-2 transition-colors',
                    isSel ? 'border-primary' : 'border-border',
                    img.removed && 'opacity-40'
                  )}
                >
                  <button
                    onClick={() => toggleSelect(img.name)}
                    className={cn(
                      'absolute left-3 top-3 z-10 grid h-5 w-5 place-items-center rounded border',
                      isSel ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background/80'
                    )}
                  >
                    {isSel && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <div className="icon-checker relative mb-2 aspect-square overflow-hidden rounded">
                    <img
                      src={img.optimizedUrl ?? img.url}
                      alt={img.name}
                      className="h-full w-full object-contain p-2"
                      loading="lazy"
                    />
                    <div className="absolute right-1 top-1 flex flex-col items-end gap-1">
                      {img.added && <Badge variant="default">new</Badge>}
                      {a?.isLarge && <Badge variant="warning">large</Badge>}
                      {a?.duplicateOf && (
                        <Badge variant="destructive" title={`same as ${a.duplicateOf}`}>
                          <Copy className="mr-0.5 h-2.5 w-2.5" /> dup
                        </Badge>
                      )}
                      {img.optimized && <Badge variant="success">opt</Badge>}
                    </div>
                  </div>
                  <div className="truncate text-[11px] font-medium" title={img.name}>
                    {img.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatBytes(img.optimized?.size ?? img.size)}
                    {a && ` · ${a.width}×${a.height}`}
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 flex-1 px-1 text-[10px]"
                      disabled={working}
                      onClick={() => setModalImage(img)}
                    >
                      {working ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Optimize…'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => toggleRemove(img.name)}
                      title={img.removed ? 'Keep in export' : 'Exclude from export'}
                    >
                      {img.removed ? <Undo2 className="h-3 w-3" /> : <Trash2 className="h-3 w-3 text-destructive" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <OptimizeModal image={modalImage} onClose={() => setModalImage(null)} />
    </div>
  );
}
