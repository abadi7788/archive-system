'use client';
import dynamic from 'next/dynamic';

// Client-only boundary avoids SSR/sessionStorage hydration flashes while keeping transitions smooth.
const HomeClient = dynamic(() => import('./HomeClient'), {
  ssr: false,
  loading: () => (
    <main
      aria-busy="true"
      className="min-h-[100svh] bg-[#F1F5F9] dark:bg-[#0A1626] flex items-center justify-center"
    >
      <div className="w-8 h-8 rounded-full border-2 border-[#0E7490] border-t-transparent animate-spin" />
    </main>
  ),
});

export default function HomePage() {
  return <HomeClient />;
}
