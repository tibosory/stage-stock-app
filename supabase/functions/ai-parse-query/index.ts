import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const body = await req.json().catch(() => ({}));
  const query = String(body?.query ?? '').trim().toLowerCase();
  const filters: Record<string, unknown> = {};
  if (query.includes('son')) filters.category = 'sound';
  if (query.includes('lumi') || query.includes('projecteur')) filters.category = 'light';
  if (query.includes('video') || query.includes('vidéo')) filters.category = 'video';
  if (query.includes('dispo')) filters.status = 'available';
  if (query.includes('maintenance')) filters.status = 'maintenance';
  return Response.json({
    filters,
    sort: query.includes('puissant') ? 'power_desc' : 'relevance',
    limit: 50,
  });
});
