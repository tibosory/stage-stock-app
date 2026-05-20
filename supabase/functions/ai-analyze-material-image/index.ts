import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const body = await req.json().catch(() => ({}));
  const imagePath = String(body?.imagePath ?? '');
  // Template: replace this heuristics block with Ollama or cloud vision provider.
  const suggestion = imagePath.toLowerCase().includes('lyre') ? 'light' : 'sound';
  return Response.json({
    category_suggestion: suggestion,
    extracted_fields: {
      name: '',
      brand: '',
      model: '',
      notes: 'Analyse IA à compléter côté backend',
    },
    confidence: 0.42,
  });
});
