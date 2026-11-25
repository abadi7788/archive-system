/** Render the actual first PDF page locally; works on mobile without a PDF plugin. */
export async function pdfThumbnail(blob: Blob, signal: AbortSignal): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), useSystemFonts: true });
  const abort = () => { void task.destroy(); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(1.5, 420 / Math.max(base.width, base.height)) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    return canvas.toDataURL('image/png');
  } finally {
    signal.removeEventListener('abort', abort);
    await task.destroy();
  }
}
