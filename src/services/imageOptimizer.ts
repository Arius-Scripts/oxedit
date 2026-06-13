export interface ImageAnalysis {
  name: string;
  size: number;
  width: number;
  height: number;
  hash: string;
  isLarge: boolean;
  duplicateOf?: string;
}

export interface OptimizeResult {
  name: string;
  originalSize: number;
  optimizedSize: number;
  blob: Blob;
  saved: number;
  outWidth: number;
  outHeight: number;
}

/** Thresholds for flagging "large" images. */
export const LARGE_BYTES = 100 * 1024; // 100 KB
export const LARGE_DIM = 512; // px

async function sha256(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function dimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/** Analyse a set of images: dimensions, size flags, and duplicate detection by content hash. */
export async function analyzeImages(
  images: { name: string; blob: Blob; size: number }[]
): Promise<ImageAnalysis[]> {
  const results: ImageAnalysis[] = [];
  const seen = new Map<string, string>(); // hash -> first name

  for (const img of images) {
    const [hash, dim] = await Promise.all([sha256(img.blob), dimensions(img.blob)]);
    const duplicateOf = seen.has(hash) ? seen.get(hash) : undefined;
    if (!duplicateOf) seen.set(hash, img.name);
    results.push({
      name: img.name,
      size: img.size,
      width: dim.width,
      height: dim.height,
      hash,
      isLarge: img.size > LARGE_BYTES || dim.width > LARGE_DIM || dim.height > LARGE_DIM,
      duplicateOf,
    });
  }
  return results;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type));
}

/**
 * Downscale + re-encode one image to a max dimension using a canvas.
 * The chosen maxDim genuinely changes the output: the image is scaled so its
 * longest side is at most maxDim (never upscaled), then re-encoded as PNG so
 * transparency for inventory icons is preserved.
 * Returns the optimized blob, or the original if it could not be improved.
 */
export async function optimizeImage(
  name: string,
  blob: Blob,
  maxDim = 256
): Promise<OptimizeResult> {
  const originalSize = blob.size;
  try {
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    // Scale the longest side to maxDim. Never upscale beyond the original.
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const unchanged: OptimizeResult = {
      name, originalSize, optimizedSize: originalSize, blob, saved: 0, outWidth: width, outHeight: height,
    };

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return unchanged;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const out = await canvasToBlob(canvas, 'image/png');
    // Keep the re-encoded blob whenever it is smaller OR the image was downscaled
    // (downscaling is the user's explicit intent even if PNG headers add a few bytes).
    if (!out || (out.size >= originalSize && scale === 1)) return unchanged;

    return {
      name,
      originalSize,
      optimizedSize: out.size,
      blob: out,
      saved: originalSize - out.size,
      outWidth: w,
      outHeight: h,
    };
  } catch {
    return { name, originalSize, optimizedSize: originalSize, blob, saved: 0, outWidth: 0, outHeight: 0 };
  }
}
