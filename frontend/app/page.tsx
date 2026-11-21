'use client';
import dynamic from 'next/dynamic';

// This client-only app uses browser session storage for authentication. Keeping it
// out of SSR avoids server/client markup races on the login/session boundary.
const HomeClient = dynamic(() => import('./HomeClient'), {
  ssr: false,
  loading: () => <main aria-busy="true" style={{ minHeight: '100svh', background: '#f7f9fc' }} />,
});

export default function HomePage() {
  return <HomeClient />;
}
