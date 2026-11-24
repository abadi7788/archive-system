import './globals.css';
import type { Metadata, Viewport } from 'next';
import PwaRegister from './components/PwaRegister';

export const viewport: Viewport = {
  themeColor: '#0b1c2d',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'نظام الأرشفة الإلكتروني | Archive-Yemany',
  description: 'نظام الأرشفة الإلكتروني لإدارة المستندات والبحث في النصوص والأرشفة الآمنة.',
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
    description: 'نظام الأرشفة الإلكتروني لإدارة المستندات والبحث في النصوص والأرشفة الآمنة.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
