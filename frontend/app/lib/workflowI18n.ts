import type { LocaleCode } from '../components/types';

// Complete translations for the upload/key workflow in every supported language.
export const WORKFLOW_TEXT = {
  ar: {
    uploadMenuLabel: 'رفع',
    uploadFilesOption: 'ملفات',
    uploadFolderOption: 'مجلد',
    geminiKeysTitle: 'مفاتيح Gemini ومتابعة الاستهلاك',
    geminiKeysDescription: 'يستخدم النظام المفاتيح المضافة بالترتيب: المفتاح الأول أساسي، والبقية احتياطي تلقائي عند بلوغ الحد.',
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
    geminiKeysDescription: 'Keys are used in the order added: the first is primary, and the rest are automatic backups when its limit is reached.',
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
    geminiKeysDescription: 'Les clés sont utilisées dans l’ordre d’ajout : la première est principale, les suivantes prennent automatiquement le relais lorsque sa limite est atteinte.',
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
    geminiKeysDescription: 'Las claves se usan en el orden añadido: la primera es la principal y las demás actúan como respaldo automático cuando alcanza su límite.',
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
    geminiKeysDescription: 'Anahtarlar eklenme sırasıyla kullanılır: ilki birincildir; sınırına ulaştığında diğerleri otomatik yedek olarak devreye girer.',
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
    geminiKeysDescription: 'Die Schlüssel werden in der Reihenfolge des Hinzufügens verwendet: Der erste ist primär, die übrigen übernehmen automatisch, sobald sein Limit erreicht ist.',
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
    geminiKeysDescription: 'Ключи используются в порядке добавления: первый — основной, остальные подключаются автоматически при достижении его лимита.',
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
    geminiKeysDescription: '系统按添加顺序使用密钥：第一个为主密钥，达到限额后，其余密钥将自动作为备用。',
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
    geminiKeysDescription: 'キーは追加した順に使用されます。最初のキーがメインとなり、上限に達すると残りのキーへ自動的に切り替わります。',
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
    geminiKeysDescription: 'कुंजियाँ जोड़ने के क्रम में उपयोग होती हैं: पहली मुख्य है और उसकी सीमा पूरी होने पर बाकी अपने आप बैकअप के रूप में उपयोग होती हैं।',
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
    geminiKeysDescription: 'کیز شامل کرنے کی ترتیب سے استعمال ہوتی ہیں: پہلی بنیادی ہے اور اس کی حد پوری ہونے پر باقی خودکار بیک اپ کے طور پر استعمال ہوتی ہیں۔',
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
