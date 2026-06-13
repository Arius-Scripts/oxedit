import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Loader2, Minimize2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { optimizeImage, dimensions, type OptimizeResult } from '@/services/imageOptimizer';
import { useApp, type ImageState } from '@/stores/appStore';
import { formatBytes } from '@/lib/utils';

/** Resize presets for this image: its real size plus common smaller icon sizes.
 * ox_inventory icons display small, so 96px is a good balance and the default. */
function presetsFor(maxNatural: number): number[] {
  if (!maxNatural) return [128, 96, 64];
  const downs = [256, 128, 96, 64, 48].filter((n) => n < maxNatural);
  return [...new Set([maxNatural, ...downs])].slice(0, 4);
}

export function OptimizeModal({ image, onClose }: { image: ImageState | null; onClose: () => void }) {
  const setOptimized = useApp((s) => s.setOptimizedImage);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [maxDim, setMaxDim] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Read the image's real dimensions when it opens, then default to half-size.
  useEffect(() => {
    if (!image) {
      setNatural(null);
      setMaxDim(null);
      return;
    }
    dimensions(image.blob).then((d) => {
      setNatural(d);
      const opts = presetsFor(Math.max(d.width, d.height));
      // Default to the first real downscale if available, else the original.
      setMaxDim(opts.length > 1 ? opts[1] : opts[0]);
    });
  }, [image]);

  const sizes = useMemo(() => presetsFor(natural ? Math.max(natural.width, natural.height) : 0), [natural]);

  useEffect(() => {
    if (!image || maxDim == null) return;
    let url: string | null = null;
    setBusy(true);
    setResult(null);
    optimizeImage(image.name, image.blob, maxDim).then((r) => {
      setResult(r);
      url = URL.createObjectURL(r.blob);
      setPreviewUrl(url);
      setBusy(false);
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [image, maxDim]);

  const apply = () => {
    if (image && result && result.blob !== image.blob) setOptimized(image.name, result.blob);
    onClose();
  };

  const pct = result && result.originalSize ? Math.round((result.saved / result.originalSize) * 100) : 0;
  const changed = !!result && result.blob !== image?.blob;

  return (
    <Dialog open={!!image} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Minimize2 className="text-primary" /> Optimize image
          </DialogTitle>
          <DialogDescription>
            Resizes and re-encodes the PNG, keeping transparency. ox_inventory icons are usually 100×100 —
            shrink them to cut file size. The original is never modified until you export.
          </DialogDescription>
        </DialogHeader>

        {image && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                Resize to{natural ? ` (source ${natural.width}×${natural.height})` : ''}
              </span>
              {sizes.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={maxDim === s ? 'default' : 'outline'}
                  className="h-7"
                  onClick={() => setMaxDim(s)}
                >
                  {s}px{natural && s === Math.max(natural.width, natural.height) ? ' (orig)' : ''}
                </Button>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4 rounded-md border border-border p-4">
              <Cell
                label="Before"
                url={image.url}
                size={image.size}
                dims={natural ? `${natural.width}×${natural.height}` : ''}
              />
              <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              <Cell
                label="After"
                url={previewUrl ?? image.url}
                size={result?.optimizedSize ?? image.size}
                dims={result && result.outWidth ? `${result.outWidth}×${result.outHeight}` : ''}
                busy={busy}
              />
            </div>

            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
              {busy ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculating…
                </span>
              ) : result && result.saved > 0 ? (
                <span>
                  Saves <span className="font-semibold text-emerald-400">{formatBytes(result.saved)}</span> (
                  {pct}% smaller) — {formatBytes(result.originalSize)} → {formatBytes(result.optimizedSize)}
                </span>
              ) : changed ? (
                <span className="text-muted-foreground">
                  Resized to {result?.outWidth}×{result?.outHeight}. File is {formatBytes(result?.optimizedSize ?? 0)}.
                </span>
              ) : (
                <span className="text-muted-foreground">
                  This is the original size — pick a smaller option to shrink it.
                </span>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={apply} disabled={busy || !changed}>
                <Minimize2 /> Apply
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Cell({ label, url, size, dims, busy }: { label: string; url: string; size: number; dims?: string; busy?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="icon-checker relative grid h-24 w-24 place-items-center overflow-hidden rounded-md border border-border/50">
        <img src={url} alt={label} className="h-full w-full object-contain p-1" />
        {busy && <div className="absolute inset-0 grid place-items-center bg-background/60"><Loader2 className="h-4 w-4 animate-spin" /></div>}
      </div>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{formatBytes(size)}</span>
      {dims && <span className="text-[10px] text-muted-foreground">{dims}</span>}
    </div>
  );
}
