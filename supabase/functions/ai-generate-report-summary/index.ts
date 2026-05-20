import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const body = await req.json().catch(() => ({}));
  const scope = String(body?.scope ?? 'stock');
  return Response.json({
    summary: `Résumé ${scope} généré (template).`,
    highlights: ['Aucune anomalie bloquante détectée (template).'],
    risks: ['Compléter la logique IA réelle côté fonction edge.'],
  });
});
