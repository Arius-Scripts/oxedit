/* Compact indicator for a FiveM blip: a colour swatch + sprite id.
   (No reliable public CDN serves blip sprite PNGs by id, so we show the
   id and an approximate colour swatch instead of a remote image.) */

/** Common GTA blip colours, approximated for a swatch. */
export const BLIP_COLOURS: Record<number, string> = {
  0: '#c2c4c6', 1: '#e2483d', 2: '#6cae4f', 3: '#4a90c4', 4: '#ffffff', 5: '#f1d14e',
  17: '#e8943a', 18: '#a3d3ee', 27: '#7bd8d8', 38: '#3a6fb0', 46: '#101010', 69: '#9aa0a6', 84: '#1f1f1f',
};

export function BlipChip({ id, colour, compact }: { id?: number; colour?: number; compact?: boolean }) {
  const swatch = (colour != null && BLIP_COLOURS[colour]) || '#9aa0a6';
  if (compact) {
    return (
      <span
        className="inline-flex h-5 items-center gap-1 rounded border border-border bg-card px-1 text-[9px] text-muted-foreground"
        title={`Blip sprite ${id ?? '?'}, colour ${colour ?? '?'}`}
      >
        <span className="h-2 w-2 rounded-full border border-black/20" style={{ background: swatch }} />
        {id ?? '?'}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground"
      title={`Blip sprite ${id ?? '?'}, colour ${colour ?? '?'}`}
    >
      <span className="h-2.5 w-2.5 rounded-full border border-black/20" style={{ background: swatch }} />
      blip #{id ?? '?'}
    </span>
  );
}
