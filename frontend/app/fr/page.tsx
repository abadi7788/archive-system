'use client';
import dynamic from 'next/dynamic';

const HomeClient = dynamic(() => import('../HomeClient'), {
  ssr: false,
  loading: () => <main aria-busy="true" className="min-h-[100svh] bg-[#F8FAFC] dark:bg-[#0B1120]" />,
});

export default function FrenchHomePage() {
  return <HomeClient initialLocale="fr" />;
}
