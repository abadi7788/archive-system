import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/800.css';
import '@fontsource/tajawal/700.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import PwaRegister from './components/PwaRegister';

export const viewport: Viewport = {
  themeColor: '#0F2137',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  applicationName: 'Archive YemanY',
  title: 'Archive YemanY',
  description:
    'منصة أرشفة مؤسسية آمنة لإدارة المستندات والمجلدات والبحث الذكي في المحتوى باللغتين العربية والإنجليزية.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/favicon.ico', sizes: 'any' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Archive YemanY',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var l=localStorage.getItem('archive-pref-lang');var t=localStorage.getItem('archive-pref-theme');if(l&&['ar','en','fr','es','de','tr','ur','hi','zh','ja','ru'].includes(l)){document.documentElement.lang=l;document.documentElement.dir=['ar','ur'].includes(l)?'rtl':'ltr';}document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}})();` }} />
      </head>
      <body className="font-sans antialiased bg-[#F1F5F9] text-[#0F2137] dark:bg-[#0A1626] dark:text-slate-100">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
