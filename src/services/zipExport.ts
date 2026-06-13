export interface ZipEntry {
  /** Path inside the zip, e.g. "data/items.lua" or "web/images/burger.png". */
  path: string;
  data: string | Blob;
}

export async function buildZip(entries: ZipEntry[]): Promise<Blob> {
  // Loaded on demand so jszip stays out of the initial bundle (only needed on export).
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const e of entries) {
    zip.file(e.path, e.data);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
