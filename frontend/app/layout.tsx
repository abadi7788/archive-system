import './globals.css';
import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import PwaRegister from './components/PwaRegister';

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-arabic',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#0F172A',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'نظام الأرشفة الإلكتروني | Archive-Yemany',
  description: 'نظام الأرشفة الإلكتروني لإدارة المستندات والمجلدات والبحث السريع.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'الأرشيف',
  },
  icons: {
    icon: [
      { url: '/icons/favicon.ico', sizes: '32x32' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'نظام الأرشفة الإلكتروني | Archive-Yemany',
    description: 'نظام الأرشفة الإلكتروني لإدارة المستندات والمجلدات والبحث السريع.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={ibmPlexArabic.variable} suppressHydrationWarning>
      <body className="font-sans antialiased bg-[#F8FAFC] text-slate-900 dark:bg-[#0B1120] dark:text-slate-100">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
