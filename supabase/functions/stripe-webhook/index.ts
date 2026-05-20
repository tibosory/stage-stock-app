import Stripe from 'https://esm.sh/stripe@16.12.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
});
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
  } catch (e) {
    return new Response(`Signature error: ${String(e)}`, { status: 400 });
  }

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const orgId = String(sub.metadata?.organization_id ?? '');
    if (orgId) {
      const priceId = sub.items.data[0]?.price?.id ?? '';
      const plan =
        priceId.includes('enterprise') ? 'enterprise' : priceId.includes('pro') ? 'pro' : 'free';
      await supabase.from('organization_billing').upsert([
        {
          organization_id: orgId,
          stripe_customer_id: String(sub.customer),
          stripe_subscription_id: sub.id,
          plan,
          status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
    }
  }

  return Response.json({ ok: true });
});
