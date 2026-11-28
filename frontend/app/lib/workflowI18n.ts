import type { LocaleCode } from '../components/types';

// Complete translations for the upload/key workflow in every supported language.
export const WORKFLOW_TEXT = {
  ar: {
    uploadMenuLabel: 'رفع',
    uploadFilesOption: 'ملفات',
    uploadFolderOption: 'مجلد',
    geminiKeysTitle: 'مفاتيح Gemini ومتابعة الاستهلاك',
    geminiKeysDescription: 'تُستخدم مفاتيح النظام بالترتيب الظاهر: الأول أساسي، والبقية احتياطية تلقائيًا عند بلوغ الحد أو تعذّر استخدامه.',
    teamWorkspaceIntro: 'مجلد مستقل لكل زميل متاح لك.',
    uploadSuccess: 'تم رفع المستند',
    uploadSuccessPlural: 'تم رفع {count} مستندات',
    savedSuccess: 'تم الحفظ.',
    movedToFolderSuccess: 'تم نقل الملف إلى المجلد.',
  },
  en: {
    uploadMenuLabel: 'Upload',
    uploadFilesOption: 'Files',
    uploadFolderOption: 'Folder',
    geminiKeysTitle: 'Gemini keys & usage',
    geminiKeysDescription: 'System keys are used in the displayed order: first primary, then automatic backups when its quota is reached or it is unavailable.',
    teamWorkspaceIntro: 'A separate folder for each available colleague.',
    uploadSuccess: 'Document uploaded',
    uploadSuccessPlural: '{count} documents uploaded',
    savedSuccess: 'Saved.',
    movedToFolderSuccess: 'File moved to folder.',
  },
  fr: {
    uploadMenuLabel: 'Téléverser',
    uploadFilesOption: 'Fichiers',
    uploadFolderOption: 'Dossier',
    geminiKeysTitle: 'Clés Gemini et utilisation',
    geminiKeysDescription: 'Les clés système suivent l’ordre affiché : la première est principale, les autres prennent automatiquement le relais en cas de quota atteint ou d’indisponibilité.',
    teamWorkspaceIntro: 'Un dossier distinct pour chaque collègue disponible.',
    uploadSuccess: 'Document téléversé',
    uploadSuccessPlural: '{count} documents téléversés',
    savedSuccess: 'Enregistré.',
    movedToFolderSuccess: 'Fichier déplacé dans le dossier.',
  },
  es: {
    uploadMenuLabel: 'Subir',
    uploadFilesOption: 'Archivos',
    uploadFolderOption: 'Carpeta',
    geminiKeysTitle: 'Claves de Gemini y uso',
    geminiKeysDescription: 'Las claves del sistema siguen el orden mostrado: la primera es principal y las demás actúan como respaldo automático si agota su cuota o no está disponible.',
    teamWorkspaceIntro: 'Una carpeta independiente para cada compañero disponible.',
    uploadSuccess: 'Documento subido',
    uploadSuccessPlural: 'Se han subido {count} documentos',
    savedSuccess: 'Guardado.',
    movedToFolderSuccess: 'Archivo movido a la carpeta.',
  },
  tr: {
    uploadMenuLabel: 'Yükle',
    uploadFilesOption: 'Dosyalar',
    uploadFolderOption: 'Klasör',
    geminiKeysTitle: 'Gemini anahtarları ve kullanım',
    geminiKeysDescription: 'Sistem anahtarları gösterilen sırayla kullanılır: ilki birincildir; kotası dolduğunda veya kullanılamadığında yedeklere otomatik geçilir.',
    teamWorkspaceIntro: 'Erişilebilir her çalışma arkadaşı için ayrı bir klasör.',
    uploadSuccess: 'Belge yüklendi',
    uploadSuccessPlural: '{count} belge yüklendi',
    savedSuccess: 'Kaydedildi.',
    movedToFolderSuccess: 'Dosya klasöre taşındı.',
  },
  de: {
    uploadMenuLabel: 'Hochladen',
    uploadFilesOption: 'Dateien',
    uploadFolderOption: 'Ordner',
    geminiKeysTitle: 'Gemini-Schlüssel und Nutzung',
    geminiKeysDescription: 'Systemschlüssel folgen der angezeigten Reihenfolge: zuerst der primäre, dann automatisch die Ersatzschlüssel bei erschöpftem Kontingent oder Nichtverfügbarkeit.',
    teamWorkspaceIntro: 'Ein separater Ordner für jeden verfügbaren Kollegen.',
    uploadSuccess: 'Dokument hochgeladen',
    uploadSuccessPlural: '{count} Dokumente hochgeladen',
    savedSuccess: 'Gespeichert.',
    movedToFolderSuccess: 'Datei in den Ordner verschoben.',
  },
  ru: {
    uploadMenuLabel: 'Загрузить',
    uploadFilesOption: 'Файлы',
    uploadFolderOption: 'Папка',
    geminiKeysTitle: 'Ключи Gemini и использование',
    geminiKeysDescription: 'Системные ключи используются в показанном порядке: первый — основной, остальные подключаются автоматически при исчерпании квоты или недоступности.',
    teamWorkspaceIntro: 'Отдельная папка для каждого доступного коллеги.',
    uploadSuccess: 'Документ загружен',
    uploadSuccessPlural: '{count} документов загружено',
    savedSuccess: 'Сохранено.',
    movedToFolderSuccess: 'Файл перемещён в папку.',
  },
  zh: {
    uploadMenuLabel: '上传',
    uploadFilesOption: '文件',
    uploadFolderOption: '文件夹',
    geminiKeysTitle: 'Gemini 密钥与用量',
    geminiKeysDescription: '系统密钥按显示顺序使用：第一个为主密钥，配额耗尽或不可用时将自动使用备用密钥。',
    teamWorkspaceIntro: '每位可访问的同事都有独立文件夹。',
    uploadSuccess: '已上传文档',
    uploadSuccessPlural: '已上传 {count} 份文档',
    savedSuccess: '已保存。',
    movedToFolderSuccess: '文件已移至文件夹。',
  },
  ja: {
    uploadMenuLabel: 'アップロード',
    uploadFilesOption: 'ファイル',
    uploadFolderOption: 'フォルダー',
    geminiKeysTitle: 'Gemini キーと使用状況',
    geminiKeysDescription: 'システムキーは表示順に使用します。最初がメインで、割り当て超過や利用不可の場合は予備に自動で切り替わります。',
    teamWorkspaceIntro: 'アクセスできる同僚ごとに独立したフォルダーがあります。',
    uploadSuccess: 'ドキュメントをアップロードしました',
    uploadSuccessPlural: '{count} 件のドキュメントをアップロードしました',
    savedSuccess: '保存しました。',
    movedToFolderSuccess: 'ファイルをフォルダーに移動しました。',
  },
  hi: {
    uploadMenuLabel: 'अपलोड',
    uploadFilesOption: 'फ़ाइलें',
    uploadFolderOption: 'फ़ोल्डर',
    geminiKeysTitle: 'Gemini कुंजियाँ और उपयोग',
    geminiKeysDescription: 'सिस्टम कुंजियाँ दिखाए गए क्रम में उपयोग होती हैं: पहली मुख्य है, कोटा पूरा होने या अनुपलब्ध होने पर बाकी अपने आप उपयोग होती हैं।',
    teamWorkspaceIntro: 'हर उपलब्ध सहकर्मी के लिए अलग फ़ोल्डर।',
    uploadSuccess: 'दस्तावेज़ अपलोड किया गया',
    uploadSuccessPlural: '{count} दस्तावेज़ अपलोड किए गए',
    savedSuccess: 'सहेजा गया।',
    movedToFolderSuccess: 'फ़ाइल फ़ोल्डर में ले जाई गई।',
  },
  ur: {
    uploadMenuLabel: 'اپ لوڈ',
    uploadFilesOption: 'فائلیں',
    uploadFolderOption: 'فولڈر',
    geminiKeysTitle: 'Gemini کیز اور استعمال',
    geminiKeysDescription: 'سسٹم کیز دکھائی گئی ترتیب سے استعمال ہوتی ہیں: پہلی بنیادی ہے، کوٹہ پورا ہونے یا عدم دستیابی پر باقی خودکار بیک اپ ہیں۔',
    teamWorkspaceIntro: 'ہر دستیاب ساتھی کے لیے الگ فولڈر۔',
    uploadSuccess: 'دستاویز اپ لوڈ کر دی گئی',
    uploadSuccessPlural: '{count} دستاویزات اپ لوڈ کر دی گئیں',
    savedSuccess: 'محفوظ کر دیا گیا۔',
    movedToFolderSuccess: 'فائل فولڈر میں منتقل کر دی گئی۔',
  },
};

export function uploadNotice(count: number, locale: LocaleCode): string {
  const text = WORKFLOW_TEXT[locale];
  if (count === 1) return text.uploadSuccess;
  if (locale === 'ar') {
    const plural = new Intl.PluralRules('ar').select(count);
    if (plural === 'two') return 'تم رفع مستندين';
    return `تم رفع ${count} ${plural === 'few' ? 'مستندات' : plural === 'many' ? 'مستندًا' : 'مستند'}`;
  }
  if (locale === 'ru') {
    const plural = new Intl.PluralRules('ru').select(count);
    return `Загружено ${count} ${plural === 'one' ? 'документ' : plural === 'few' ? 'документа' : 'документов'}`;
  }
  return text.uploadSuccessPlural.replace('{count}', String(count));
}

/** Also clean informational messages returned by older deployments. */
export function cleanNotice(message: string): string {
  return message.replace(/\s*بنجاح/g, '').replace(/\s*\bsuccessfully\b/gi, '').replace(/\s+([.!،])/g, '$1').trim();
}
