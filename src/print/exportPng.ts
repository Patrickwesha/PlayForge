/**
 * Serialize a rendered PlaySvg element to a PNG blob and download it.
 * Works because PlaySvg uses inline attributes only (no CSS classes).
 */
export async function svgToPngBlob(svg: SVGSVGElement, widthPx: number, heightPx: number, scale = 3): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  // editor-only overlay (snap guides, landmark lines, handles) never goes into an export
  clone.querySelectorAll('[data-layer="overlay"]').forEach((el) => el.remove());
  clone.setAttribute('width', String(widthPx));
  clone.setAttribute('height', String(heightPx));
  clone.style.width = '';
  clone.style.height = '';
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG rasterization failed'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(widthPx * scale);
    canvas.height = Math.round(heightPx * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function safeFilename(name: string, ext: string) {
  return `${name.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'play'}.${ext}`;
}

export async function exportSvgAsPng(svg: SVGSVGElement, name: string, widthPx = 1200, heightPx = 900) {
  const blob = await svgToPngBlob(svg, widthPx, heightPx, 2);
  downloadBlob(blob, safeFilename(name, 'png'));
}
