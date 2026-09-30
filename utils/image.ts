// Client-side image helpers: decode a picked file, downscale it on a canvas,
// and re-encode as JPEG. Shared by the scouting photo forms and the social
// media composer.

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This browser can't read that image. Try a JPEG or PNG.")); };
    img.src = url;
  });
}

/** Source crop + output size for fitting `w×h` inside `maxDim`, optionally
 *  center-cropping so the aspect ratio lands within [minAspect, maxAspect]. */
export function fitRect(w: number, h: number, maxDim: number, minAspect = 0, maxAspect = Infinity) {
  let sx = 0, sy = 0, sw = w, sh = h;
  const aspect = w / h;
  if (aspect < minAspect) { sh = Math.round(w / minAspect); sy = Math.round((h - sh) / 2); }
  else if (aspect > maxAspect) { sw = Math.round(h * maxAspect); sx = Math.round((w - sw) / 2); }
  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  return { sx, sy, sw, sh, width: Math.round(sw * scale), height: Math.round(sh * scale), cropped: sw !== w || sh !== h };
}

async function drawJpeg(file: Blob, maxDim: number, minAspect?: number, maxAspect?: number) {
  const img = await loadImage(file);
  const r = fitRect(img.naturalWidth, img.naturalHeight, maxDim, minAspect, maxAspect);
  const canvas = document.createElement('canvas');
  canvas.width = r.width;
  canvas.height = r.height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; // PNG transparency would otherwise turn black in a JPEG
  ctx.fillRect(0, 0, r.width, r.height);
  ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, r.width, r.height);
  return { canvas, ...r };
}

/** Small JPEG data URL for storing inline (scouting photos). */
export async function compressImage(file: File, maxDim = 800, quality = 0.7): Promise<string> {
  const { canvas } = await drawJpeg(file, maxDim);
  return canvas.toDataURL('image/jpeg', quality);
}

/** A publish-quality JPEG for Instagram/Facebook, center-cropped into the
 *  aspect range Instagram's feed accepts (4:5 portrait … 1.91:1 landscape). */
export async function prepareSocialImage(
  file: File,
  opts: { maxDim?: number; quality?: number; minAspect?: number; maxAspect?: number } = {},
): Promise<{ blob: Blob; width: number; height: number; cropped: boolean }> {
  const { canvas, width, height, cropped } = await drawJpeg(
    file, opts.maxDim ?? 1440, opts.minAspect ?? 4 / 5, opts.maxAspect ?? 1.91,
  );
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image.'))), 'image/jpeg', opts.quality ?? 0.88),
  );
  return { blob, width, height, cropped };
}

/** Read a video's duration and dimensions without uploading it. */
export function probeVideo(file: File): Promise<{ durationSec: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({ durationSec: Math.round(v.duration), width: v.videoWidth, height: v.videoHeight });
    };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This browser can't read that video. Use an MP4 or MOV file.")); };
    v.src = url;
  });
}
