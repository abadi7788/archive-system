'use client';
import React, { FormEvent, useEffect, useState } from 'react';
import { AppIcon } from '../BrandMark';
import { DocItem, FolderItem, User, formatBytes } from './types';

export default function UploadView({
  user,
  folders,
  departments,
  categories,
  defaultFolderId,
  onUpload,
  onGoArchive,
}: {
  user: User;
  folders: FolderItem[];
  departments: string[];
  categories: string[];
  defaultFolderId: string;
  onUpload: (payload: {
    file: File;
    folderId: string;
    department: string;
    classification: string;
    keywords: string;
    summary: string;
  }) => Promise<DocItem>;
  onGoArchive: (folderId?: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [folderId, setFolderId] = useState(defaultFolderId || '');
  const [department, setDepartment] = useState(user.department || '');
  const [classification, setClassification] = useState('');
  const [keywords, setKeywords] = useState('');
  const [summary, setSummary] = useState('');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploadedDoc, setUploadedDoc] = useState<DocItem | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (user.role === 'viewer') {
    return (
      <section className="card p-8 text-center max-w-xl mx-auto">
        <h2 className="text-lg font-extrabold text-slate-900">صلاحية عرض فقط</h2>
        <p className="mt-2 text-sm text-slate-600">
          حسابك مخصص للعرض فقط ولا يمتلك صلاحية رفع مستندات جديدة. يمكنك العودة إلى الأرشيف للبحث والمعاينة.
        </p>
        <button type="button" onClick={() => onGoArchive()} className="btn btn-primary mt-5 text-xs">
          العودة إلى الأرشيف
        </button>
      </section>
    );
  }

  function pickFile(candidate: File | null) {
    setError('');
    setUploadedDoc(null);
    if (!candidate) {
      setFile(null);
      return;
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/tiff'];
    if (!allowed.includes(candidate.type)) {
      setError('نوع الملف غير مدعوم. يرجى اختيار ملف PDF أو صورة (JPEG, PNG, WEBP, TIFF).');
      return;
    }
    if (candidate.size > 30 * 1024 * 1024) {
      setError('حجم الملف يتجاوز الحد الأقصى المسموح به (30 ميجابايت).');
      return;
    }
    setFile(candidate);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('يرجى اختيار ملف أو صورة قبل الرفع.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await onUpload({
        file,
        folderId,
        department,
        classification,
        keywords,
        summary,
      });
      setUploadedDoc(created);
      setFile(null);
      setClassification('');
      setKeywords('');
      setSummary('');
    } catch (err: any) {
      setError(err?.message || 'تعذر رفع المستند حالياً.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <section className="archive-hero !mb-0">
        <div>
          <span className="section-eyebrow">DOCUMENT UPLOAD</span>
          <h2>رفع مستند جديد إلى الأرشيف</h2>
          <p>
            اختر الملف وحدد المجلد والبيانات الوصفية. سيقوم النظام باستخراج النصوص العربية والإنجليزية تلقائياً في الخلفية لتمكين البحث الفوري.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onGoArchive(folderId || undefined)}
          className="btn btn-muted text-xs shrink-0"
        >
          العودة إلى الأرشيف
        </button>
      </section>

      {uploadedDoc && (
        <div className="card p-5 border-emerald-200 bg-emerald-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-sm">
              <span>✓</span>
              <span>تم رفع المستند وحفظه بنجاح: {uploadedDoc.file_name}</span>
            </div>
            <p className="text-xs text-emerald-700 mt-1.5">
              المسار: <b>{uploadedDoc.folder_path || `الرئيسية > ${uploadedDoc.file_name}`}</b> · جاري استخراج النص بالذكاء الاصطناعي في الخلفية.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onGoArchive(uploadedDoc.folder_id || '')}
              className="btn btn-primary text-xs"
            >
              فتح في الأرشيف
            </button>
            <button
              type="button"
              onClick={() => setUploadedDoc(null)}
              className="btn btn-muted text-xs"
            >
              رفع مستند آخر
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 sm:p-7 space-y-6">
        {/* Dropzone */}
        <div>
          <label className="block text-sm font-extrabold text-slate-800 mb-2">
            الملف أو الصورة <span className="text-rose-500">*</span>
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pickFile(e.dataTransfer.files?.[0] || null);
            }}
            className={`relative rounded-2xl border-2 border-dashed p-7 text-center transition-colors ${
              dragging
                ? 'border-sky-500 bg-sky-50/70'
                : file
                ? 'border-teal-400 bg-teal-50/30'
                : 'border-slate-300 bg-slate-50/60 hover:border-sky-400'
            }`}
          >
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp,image/tiff"
              onChange={(e) => pickFile(e.target.files?.[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="اختر ملف PDF أو صورة للرفع"
            />

            {!file ? (
              <div className="space-y-2 pointer-events-none">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-sky-100 text-sky-700 grid place-items-center">
                  <AppIcon name="upload" size={26} />
                </div>
                <p className="text-sm font-extrabold text-slate-800">
                  اسحب الملف هنا أو اضغط للاختيار من جهازك
                </p>
                <p className="text-xs text-slate-500">
                  الأنواع المدعومة: PDF, PNG, JPG, WEBP, TIFF · الحد الأقصى 30 ميجابايت
                </p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="w-24 h-24 rounded-xl object-cover border border-slate-200 bg-white shadow-sm"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 grid place-items-center font-black text-base">
                    PDF
                  </div>
                )}
                <div className="text-right">
                  <p className="text-sm font-extrabold text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-1" dir="ltr">
                    {formatBytes(file.size)} · {file.type}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="relative z-10 mt-2 text-xs font-bold text-rose-600 hover:underline"
                  >
                    إزالة الملف واختيار آخر
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Target Folder & Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-xs font-bold text-slate-700">
            المجلد المستهدف
            <select
              className="field mt-1.5 text-sm"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            >
              <option value="">الرئيسية (بدون مجلد محدد)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.path && f.path !== '/' ? `${f.path}/${f.name}` : f.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-bold text-slate-700">
            القسم / الإدارة
            <input
              list="upload-departments-list"
              className="field mt-1.5 text-sm"
              placeholder="مثال: المالية، الموارد البشرية، العقود..."
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
            <datalist id="upload-departments-list">
              {departments.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </label>

          <label className="block text-xs font-bold text-slate-700">
            التصنيف (اختياري — يُكتشف تلقائياً عبر OCR)
            <input
              list="upload-categories-list"
              className="field mt-1.5 text-sm"
              placeholder="مثال: فاتورة، عقد، خطاب رسمي، تقرير..."
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
            />
            <datalist id="upload-categories-list">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label className="block text-xs font-bold text-slate-700">
            كلمات مفتاحية (اختياري، مفصولة بفاصلة)
            <input
              className="field mt-1.5 text-sm"
              placeholder="مثال: ميزانية, 2026, اعتماد"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </label>
        </div>

        <label className="block text-xs font-bold text-slate-700">
          وصف أو ملخص مختصر (اختياري)
          <textarea
            rows={3}
            className="field mt-1.5 text-sm resize-y"
            placeholder="أضف ملاحظة تعريفية للمستند إذا رغبت..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            يتم تشفير الملفات عند الحفظ وفهرسة محتواها تلقائياً باستخدام محرك Gemini OCR.
          </p>
          <button type="submit" disabled={busy || !file} className="btn btn-primary w-full sm:w-auto px-7 text-sm">
            {busy ? 'جاري الرفع والحفظ...' : 'رفع المستند للأرشيف'}
          </button>
        </div>
      </form>
    </div>
  );
}
