import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Archive-Yemany', description: 'Archive-Yemany — smart document archiving and search' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="ar" dir="rtl"><body>{children}</body></html>; }
