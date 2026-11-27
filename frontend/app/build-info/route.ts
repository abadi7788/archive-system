// Read from the running image, never from a cached build-time page.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { revision: process.env.APP_REVISION || 'development' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
