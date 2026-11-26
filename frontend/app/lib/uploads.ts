export const UPLOAD_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];
export const UPLOAD_ACCEPT = UPLOAD_EXTENSIONS.map((ext) => `.${ext}`).join(',');
export const isAllowedUploadFile = (file: File) => UPLOAD_EXTENSIONS.includes(file.name.split('.').pop()?.toLowerCase() || '');

/** Read ALL directory-reader batches; browsers may return only 100 entries at a time. */
export async function droppedFiles(transfer: DataTransfer): Promise<File[]> {
  type Entry = { isFile: boolean; isDirectory: boolean; file: (ok: (file: File) => void, fail: (error: unknown) => void) => void;
    createReader: () => { readEntries: (ok: (entries: Entry[]) => void, fail: (error: unknown) => void) => void } };
  const entries = Array.from(transfer.items || []).filter((item) => item.kind === 'file')
    .map((item) => (item as unknown as { webkitGetAsEntry?: () => Entry | null }).webkitGetAsEntry?.());
  const fallback = Array.from(transfer.files || []);
  if (!entries.some(Boolean)) return fallback;
  async function walk(entry: Entry): Promise<File[]> {
    if (entry.isFile) return [await new Promise<File>((resolve, reject) => entry.file(resolve, reject))];
    if (!entry.isDirectory) return [];
    const files: File[] = [], reader = entry.createReader();
    while (true) {
      const batch = await new Promise<Entry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch.length) return files;
      for (const child of batch) files.push(...await walk(child));
    }
  }
  const files: File[] = [];
  for (const entry of entries) if (entry) files.push(...await walk(entry));
  return files;
}

type UploadPayload = { file: File; folderId?: string | null; department?: string; classification?: string; keywords?: string; summary?: string };

/** Persist only an opaque session ID. Re-selecting the same file resumes accepted bytes. */
export async function uploadInChunks(payload: UploadPayload, token: string, userId: string,
  onProgress: (percent: number) => void, fallbackError: string): Promise<any> {
  const file = payload.file;
  const digest = async (data: ArrayBuffer) => {
    // LAN installations may be served over HTTP, where WebCrypto.subtle is unavailable.
    const hash = globalThis.crypto?.subtle
      ? new Uint8Array(await crypto.subtle.digest('SHA-256', data))
      : (await import('@noble/hashes/sha2.js')).sha256(new Uint8Array(data));
    return Array.from(hash).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  };
  // Include both ends and metadata so another file with the same name/size cannot accidentally resume.
  const sample = new Blob([file.slice(0, 65536), file.slice(Math.max(0, file.size - 65536))]);
  const fingerprint = await digest(await new Blob([await sample.arrayBuffer(), JSON.stringify({ ...payload, file: undefined, name: file.name, size: file.size, modified: file.lastModified })]).arrayBuffer());
  const key = `archive-upload:${userId}:${fingerprint}`;
  let id: string | null = null;
  try { id = localStorage.getItem(key); } catch { /* restricted storage */ }
  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(`/api/v1/uploads${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
    if (!response.ok) {
      let message = fallbackError;
      try { const error = await response.json(); if (typeof error.detail === 'string') message = error.detail; } catch { /* non-JSON proxy error */ }
      throw Object.assign(new Error(message), { status: response.status });
    }
    return response.json();
  }
  let session;
  if (id) {
    try { session = await request(`/${id}`); }
    catch (error: any) { if ([404, 410].includes(error.status)) id = null; else throw error; }
  }
  if (!id) {
    session = await request('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      file_name: file.name, file_size: file.size, folder_id: payload.folderId || null,
      department: payload.department || null, classification: payload.classification || null,
      keywords: payload.keywords || null, summary: payload.summary || null,
    }) });
    id = session.id;
    try { localStorage.setItem(key, id!); } catch { /* in-memory upload still works */ }
  }
  let offset = Number(session.received);
  const chunkSize = Math.min(Number(session.chunk_size) || 4 * 1024 * 1024, 4 * 1024 * 1024);
  onProgress(Math.min(99, Math.round(offset / file.size * 100)));
  while (offset < file.size) {
    let accepted = false;
    for (let attempt = 0; attempt < 4 && !accepted; attempt += 1) {
      try {
        session = await request(`/${id}?offset=${offset}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: file.slice(offset, offset + chunkSize) });
        if (session.received <= offset || session.received > file.size) throw new Error(fallbackError);
        offset = session.received;
        accepted = true;
      } catch (error: any) {
        if (attempt === 3 || error.status && error.status < 500 && error.status !== 409) throw error;
        await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
        session = await request(`/${id}`);
        if (session.received > offset) { offset = session.received; accepted = true; }
      }
    }
    onProgress(Math.min(99, Math.round(offset / file.size * 100)));
  }
  // Completion is idempotent too: a lost response cannot create another document.
  let doc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { doc = await request(`/${id}/complete`, { method: 'POST' }); break; }
    catch (error: any) {
      if (attempt === 2 || error.status && error.status < 500) throw error;
      await new Promise((resolve) => setTimeout(resolve, 600 * 2 ** attempt));
    }
  }
  try { localStorage.removeItem(key); } catch { /* ignore */ }
  onProgress(100);
  return doc;
}
