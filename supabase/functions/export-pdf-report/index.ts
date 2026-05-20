import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

/**
 * Template Edge Function for pro exports.
 * Plug a real HTML->PDF engine or external renderer.
 */
serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const body = await req.json().catch(() => ({}));
  const reportType = String(body?.reportType ?? 'inventory');
  const jobId = crypto.randomUUID();
  return Response.json({
    job_id: jobId,
    report_type: reportType,
    status: 'queued',
    download_url: null,
    message: 'Template export function. Connect a PDF renderer in production.',
  });
});
