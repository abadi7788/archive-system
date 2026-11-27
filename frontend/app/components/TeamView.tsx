'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { AppIcon } from '../BrandMark';
import DocumentModal from '../DocumentModal';
import { localizeApiError } from '../lib/errorLocalizer';
import type { TranslationKeys } from '../lib/i18n';
import { createImportDirectories, uploadInChunks } from '../lib/uploads';
import FolderTile from './FolderTile';
import UploadView from './UploadView';
import RenameDialog from './RenameDialog';
import EditDocumentModal from './EditDocumentModal';
import FileThumbnail from './FileThumbnail';
import { type DocItem, type FolderItem, type LocaleCode, type User, formatBytes } from './types';

type Peer = { id: string; display_name: string; username: string; job_title?: string; department?: string; access: 'read' | 'full' };
export default function TeamView({ token, user, locale, t, onPersonalChanged }: {
  token: string; user: User; locale: LocaleCode; t: TranslationKeys; onPersonalChanged: () => Promise<void>;
}) {
  const ar = locale === 'ar';
  const [peers, setPeers] = useState<Peer[]>([]), [owner, setOwner] = useState<Peer | null>(null);
  const [folders, setFolders] = useState<FolderItem[]>([]), [docs, setDocs] = useState<DocItem[]>([]);
  const [selected, setSelected] = useState(''), [search, setSearch] = useState(''), [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false), [newFolder, setNewFolder] = useState<string | null>(null);
  const [rename, setRename] = useState<{ kind: 'folder' | 'file'; item: FolderItem | DocItem } | null>(null);
  const [editing, setEditing] = useState<DocItem | null>(null), [deletingFolder, setDeletingFolder] = useState<FolderItem | null>(null);
  const [preview, setPreview] = useState<{ doc: DocItem; objectUrl: string } | null>(null);
  const [copying, setCopying] = useState<DocItem | null>(null), [copyName, setCopyName] = useState('');
  const [copyFolder, setCopyFolder] = useState(''), [personalFolders, setPersonalFolders] = useState<FolderItem[]>([]);
  const previewUrl = useRef(''), requestSequence = useRef(0);
  const full = owner?.access === 'full' && user.role !== 'viewer';
  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(`/api/v1${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers } });
    if (!response.ok) { let detail = ''; try { detail = (await response.json()).detail; } catch {} throw new Error(localizeApiError(detail, response.status, locale, t)); }
    return response;
  }
  async function loadPeers() {
    setLoading(true); setError('');
    try { const response = await request('/relationships/team'); setPeers(await response.json()); }
    catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }
  async function loadWorkspace() {
    if (!owner) return;
    const sequence = ++requestSequence.current;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ owner_id: owner.id, limit: '100' });
      if (appliedSearch) params.set('q', appliedSearch);
      else if (selected) params.set('folder_id', selected);
      else params.set('root_only', 'true');
      const [folderResponse, docResponse] = await Promise.all([request(`/folders?owner_id=${owner.id}`), request(`/search?${params}`)]);
      const [nextFolders, nextDocs] = await Promise.all([folderResponse.json(), docResponse.json()]);
      if (sequence === requestSequence.current) { setFolders(nextFolders); setDocs(nextDocs); }
    } catch (e: any) { if (sequence === requestSequence.current) { setFolders([]); setDocs([]); setError(e.message); } }
    finally { if (sequence === requestSequence.current) setLoading(false); }
  }
  useEffect(() => { void loadPeers(); return () => { requestSequence.current++; if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }; }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadWorkspace(); }, [owner?.id, appliedSearch, selected]); // eslint-disable-line react-hooks/exhaustive-deps
  function closePreview() { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); previewUrl.current = ''; setPreview(null); }
  async function open(doc: DocItem) {
    setBusy(true); setError('');
    try { const response = await request(`/documents/${doc.id}/file?inline=true`); closePreview();
      previewUrl.current = URL.createObjectURL(await response.blob()); setPreview({ doc, objectUrl: previewUrl.current });
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function download(doc: DocItem) {
    try { const response = await request(`/documents/${doc.id}/file?inline=false`); const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = doc.file_name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e: any) { setError(e.message); }
  }
  async function mutate(path: string, method: string, body?: unknown) {
    await request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    await loadWorkspace();
  }
  async function beginCopy(doc: DocItem) {
    setError(''); setCopyName(doc.file_name); setCopyFolder('');
    try { setPersonalFolders(await (await request('/folders')).json()); setCopying(doc); } catch (e: any) { setError(e.message); }
  }
  async function copy(event: FormEvent) {
    event.preventDefault(); if (!copying) return;
    setBusy(true); setError('');
    try { await request(`/documents/${copying.id}/copy`, { method: 'POST', body: JSON.stringify({ name: copyName, folder_id: copyFolder || null }) });
      setCopying(null); setNotice(ar ? 'نُسخت نسخة مستقلة إلى أرشيفك الشخصي.' : 'An independent copy was added to your archive.'); await onPersonalChanged();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  const currentFolder = folders.find(f => f.id === selected);
  const trail: FolderItem[] = []; let parent = currentFolder;
  while (parent && !trail.some(f => f.id === parent!.id)) { trail.unshift(parent); parent = folders.find(f => f.id === parent!.parent_id); }
  const visibleFolders = folders.filter(f => (f.parent_id || '') === selected);
  const visibleDocs = appliedSearch ? docs : docs.filter(d => (d.folder_id || '') === selected);
  const feedback = <>{error && <p role="alert" className="rounded-xl p-4 bg-rose-50 dark:bg-navy-deep text-rose-600">{error}</p>}{notice && <p role="status" className="rounded-xl p-4 bg-emerald-50 dark:bg-navy-deep text-emerald-700 dark:text-emerald-300">{notice}</p>}</>;
  if (uploading && owner) return <div className="space-y-4">{feedback}<UploadView key={`${owner.id}:${selected}`} user={user} folders={folders} defaultFolderId={selected} departments={[]} categories={[]} t={t}
    onCreateDirectories={async (paths, folderId) => { try { await createImportDirectories(paths, token, folderId, owner.id); } catch (e: any) { throw new Error(localizeApiError(e.message, e.status || 0, locale, t)); } }}
    onUpload={(payload, onProgress) => uploadInChunks({ ...payload, ownerId: owner.id }, token, user.id, onProgress, t.errorGeneric).catch(e => { throw new Error(localizeApiError(e.message, e.status || 0, locale, t)); })}
    onFinished={loadWorkspace} onGoArchive={() => { setUploading(false); void loadWorkspace(); }} /></div>;
  return <div className="space-y-5">
    <section className="rounded-2xl bg-gradient-to-l from-[#0E7490] to-[#0F2137] text-white p-6 flex flex-wrap justify-between gap-4">
      <div className="flex gap-4 items-start"><AppIcon name="users" size={32} /><div><h2 className="text-xl font-bold">{owner ? owner.display_name : (ar ? 'ملفات الفريق' : 'Team files')}</h2>
        <p className="text-sm text-white/80 mt-2">{owner ? (ar ? 'أنت داخل مساحة مستقلة. أرشيفك الشخصي لم يتغير.' : 'A separate workspace. Your personal archive stays unchanged.') : (ar ? 'مجلد مستقل لكل زميل متاح لك، دون مشاركة بين الزملاء الآخرين.' : 'One separate workspace for each available colleague. No access to their other relationships.')}</p></div></div>
      {owner && <button className="btn btn-secondary self-center" type="button" onClick={() => { requestSequence.current++; setOwner(null); setSelected(''); setSearch(''); setAppliedSearch(''); setDocs([]); setFolders([]); void loadPeers(); }}>{ar ? 'كل مساحات الفريق' : 'All team workspaces'}</button>}
    </section>
    {feedback}
    {!owner ? <section className="card p-5 space-y-4">
      <div className="flex justify-between items-center gap-3"><h3 className="font-bold">{ar ? 'المساحات المتاحة' : 'Available workspaces'} · {peers.length}</h3><button type="button" disabled={loading} className="btn btn-secondary text-xs" onClick={loadPeers}>{ar ? 'تحديث' : 'Refresh'}</button></div>
      {loading ? <p role="status">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p> : peers.length ? <div className="folder-browser"><div className="folder-icon-grid" role="list">{peers.map(peer => <FolderTile key={peer.id} name={peer.display_name}
        subtitle={peer.access === 'full' ? (ar ? 'تحكم كامل' : 'Full control') : (ar ? 'عرض وتحميل' : 'View & download')}
        detail={peer.job_title || peer.department || `@${peer.username}`}
        onOpen={() => { setOwner(peer); setSelected(''); setNotice(''); }} />)}</div></div> : <div className="py-12 text-center text-slate-500"><AppIcon name="folder" size={42} className="mx-auto mb-4" />{ar ? 'لا توجد مساحات فريق متاحة حاليًا.' : 'No team workspaces are currently available.'}</div>}
    </section> : <section className="card p-4 sm:p-5 space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm"><button type="button" className="btn btn-secondary text-xs" onClick={() => setSelected('')}>{owner.display_name}</button>{trail.map(f => <button type="button" key={f.id} onClick={() => setSelected(f.id)} className="text-brand-600 dark:text-brand-300"> / {f.name}</button>)}
        <span className="ms-auto text-xs rounded-lg bg-slate-100 dark:bg-navy-deep px-3 py-2">{full ? (ar ? 'تحكم كامل' : 'Full control') : (ar ? 'عرض وتحميل فقط' : 'View and download only')}</span></div>
      <div className="flex flex-wrap gap-3"><form className="flex gap-2 flex-1 min-w-0" onSubmit={e => { e.preventDefault(); setAppliedSearch(search.trim()); }}><input className="field min-w-0" aria-label={ar ? 'بحث في مساحة الموظف' : 'Search employee workspace'} placeholder={ar ? 'بحث داخل مساحة هذا الموظف فقط…' : 'Search this employee’s workspace only…'} value={search} onChange={e => setSearch(e.target.value)} /><button type="submit" className="btn btn-secondary">{ar ? 'بحث' : 'Search'}</button>{appliedSearch && <button type="button" className="btn btn-secondary" onClick={() => { setSearch(''); setAppliedSearch(''); }}>{ar ? 'مسح' : 'Clear'}</button>}</form>
        {full && <button type="button" className="btn btn-secondary text-xs" onClick={() => setNewFolder('')}><AppIcon name="folder" size={16} />{ar ? 'مجلد جديد' : 'New folder'}</button>}
      </div>
      {full && <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-50 dark:bg-navy-deep p-3"><p className="text-xs">{ar ? 'الإضافات هنا تُحفظ في مساحة الموظف، لا في أرشيفك.' : 'New items here belong to this employee, not to your archive.'}</p><button type="button" className="btn btn-secondary text-xs shrink-0" onClick={() => setUploading(true)}><AppIcon name="upload" size={16} />{ar ? 'إضافة إلى هذه المساحة' : 'Add to this workspace'}</button></div>}
      {newFolder !== null && <form className="flex flex-wrap gap-2" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await mutate('/folders', 'POST', { name: newFolder, parent_id: selected || null, owner_id: owner.id }); setNewFolder(null); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }}><input autoFocus required maxLength={180} aria-label={t.renameNameLabel} className="field flex-1" value={newFolder} onChange={e => setNewFolder(e.target.value)} /><button className="btn btn-primary" disabled={busy}>{t.saveFolder}</button><button type="button" className="btn btn-secondary" onClick={() => setNewFolder(null)}>{t.cancel}</button></form>}
      {loading ? <p role="status">{ar ? 'جارٍ تحميل الملفات…' : 'Loading files…'}</p> : <>
        {!appliedSearch && visibleFolders.length > 0 && <section className="folder-browser" aria-label={t.foldersTitle}><div className="folder-icon-grid" role="list">{visibleFolders.map(folder => <FolderTile key={folder.id} name={folder.name}
          subtitle={`${(folder.item_count || 0) + (folder.subfolder_count || 0)} ${t.itemsCount}`}
          onOpen={() => setSelected(folder.id)} renameLabel={t.rename} deleteLabel={ar ? 'حذف' : 'Delete'}
          onRename={full && folder.can_manage !== false ? () => setRename({ kind: 'folder', item: folder }) : undefined}
          onDelete={full && folder.can_manage !== false ? () => setDeletingFolder(folder) : undefined} />)}</div></section>}
        {visibleDocs.length > 0 ? <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{visibleDocs.map(doc => <article key={doc.id} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button type="button" className="block w-full bg-slate-50 dark:bg-navy-deep p-3" onClick={() => open(doc)} disabled={busy} aria-label={`${ar ? 'معاينة' : 'Preview'}: ${doc.file_name}`}><FileThumbnail doc={doc} token={token} /></button>
          <div className="p-4 space-y-3"><button type="button" className="font-bold text-sm break-all text-start" onClick={() => open(doc)}>{doc.file_name}</button><p className="text-xs text-slate-500">{formatBytes(doc.file_size || 0)}{appliedSearch && doc.folder_breadcrumb ? ` · ${doc.folder_breadcrumb}` : ''}</p>
          <div className="flex flex-wrap gap-2">{user.role !== 'viewer' && <button type="button" className="btn btn-secondary text-xs" disabled={busy} onClick={() => beginCopy(doc)}>{ar ? 'نسخ لأرشيفي' : 'Copy to my archive'}</button>}{full && doc.can_manage !== false && <><button type="button" className="btn btn-secondary p-2" aria-label={`${t.rename}: ${doc.file_name}`} onClick={() => setRename({ kind: 'file', item: doc })}><AppIcon name="edit" size={15} /></button><button type="button" className="btn btn-secondary text-xs" onClick={() => setEditing(doc)}>{ar ? 'تعديل البيانات' : 'Edit metadata'}</button></>}</div></div>
        </article>)}</div> : <p className="py-8 text-center text-slate-500">{ar ? 'لا توجد ملفات في هذا الموضع.' : 'No files in this location.'}</p>}
        {docs.length >= 100 && <p className="text-xs text-amber-700 dark:text-amber-300">{ar ? 'تُعرض أحدث 100 نتيجة. استخدم البحث للوصول إلى ملف أقدم.' : 'Showing the latest 100 results. Search to find older files.'}</p>}
      </>}
    </section>}
    {rename && <RenameDialog name={rename.kind === 'file' ? (rename.item as DocItem).file_name : (rename.item as FolderItem).name} file={rename.kind === 'file'} t={t} onClose={() => setRename(null)} onSave={name => mutate(rename.kind === 'file' ? `/documents/${rename.item.id}/rename` : `/folders/${rename.item.id}`, 'PATCH', { name })} />}
    {editing && <EditDocumentModal doc={editing} folders={folders} departments={[]} categories={[]} t={t} dir={ar ? 'rtl' : 'ltr'} onClose={() => setEditing(null)} onSave={async (id, payload) => { await mutate(`/documents/${id}`, 'PATCH', payload); setEditing(null); }} />}
    {preview && <DocumentModal doc={{ ...preview.doc, objectUrl: preview.objectUrl, extracted_text: preview.doc.extracted_text || undefined, summary: preview.doc.summary || undefined, classification: preview.doc.classification || undefined, department: preview.doc.department || undefined, keywords: preview.doc.keywords || [] }} token={token} language={locale} canShare={!!full} canPrint={!!user.can_print || user.role === 'admin'} onClose={closePreview} onDownload={() => download(preview.doc)} onDelete={full && preview.doc.can_manage !== false ? async () => { await mutate(`/documents/${preview.doc.id}`, 'DELETE'); closePreview(); } : undefined} />}
    {deletingFolder && <div className="fixed inset-0 z-[90] bg-navy-deep/70 grid place-items-center p-4"><div role="dialog" aria-modal="true" aria-label={ar ? 'حذف المجلد' : 'Delete folder'} className="card p-6 max-w-md space-y-4"><h3 className="font-bold">{ar ? 'حذف المجلد ومحتوياته؟' : 'Delete folder and contents?'}</h3><p>{deletingFolder.name}</p><p className="text-xs text-slate-500">{ar ? 'ستُنقل إلى سلة المحذوفات.' : 'Items will be moved to the recycle bin.'}</p><div className="flex gap-2"><button type="button" disabled={busy} className="btn btn-primary" onClick={async () => { setBusy(true); try { await mutate(`/folders/${deletingFolder.id}`, 'DELETE'); setDeletingFolder(null); } catch (e: any) { setError(e.message); setDeletingFolder(null); } finally { setBusy(false); } }}>{ar ? 'حذف' : 'Delete'}</button><button autoFocus type="button" disabled={busy} className="btn btn-secondary" onClick={() => setDeletingFolder(null)}>{t.cancel}</button></div></div></div>}
    {copying && <div className="fixed inset-0 z-[90] bg-navy-deep/70 grid place-items-center p-4"><form role="dialog" aria-modal="true" aria-label={ar ? 'نسخ لأرشيفي' : 'Copy to my archive'} onSubmit={copy} className="card p-6 w-full max-w-md space-y-4"><h3 className="font-bold">{ar ? 'نسخ لأرشيفي الشخصي' : 'Copy to my personal archive'}</h3><label className="block text-xs font-semibold">{t.renameNameLabel}<input autoFocus required maxLength={250} className="field mt-2" value={copyName} onChange={e => setCopyName(e.target.value)} /></label><label className="block text-xs font-semibold">{t.targetFolderLabel}<select className="field mt-2" value={copyFolder} onChange={e => setCopyFolder(e.target.value)}><option value="">{t.noFolderRoot}</option>{personalFolders.map(f => <option key={f.id} value={f.id}>{f.path}/{f.name}</option>)}</select></label><p className="text-xs text-slate-500">{ar ? 'يبقى الامتداد الأصلي محفوظًا، ولا يتغير الملف المصدر.' : 'The original extension is preserved. The source is unchanged.'}</p>{error && <p role="alert" className="text-rose-600 text-sm">{error}</p>}<div className="flex gap-2"><button type="submit" disabled={busy} className="btn btn-primary">{ar ? 'إنشاء نسخة' : 'Create copy'}</button><button type="button" disabled={busy} className="btn btn-secondary" onClick={() => setCopying(null)}>{t.cancel}</button></div></form></div>}
  </div>;
}
