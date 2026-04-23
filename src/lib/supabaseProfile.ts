import { getSupabase } from './supabase';

export type SupabaseProfileRow = {
  id: string;
  plan: 'free' | 'pro';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  updated_at: string | null;
};

export async function fetchSupabaseProfile(userId: string): Promise<SupabaseProfileRow | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, plan, stripe_customer_id, stripe_subscription_id, updated_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('fetchSupabaseProfile', error.message);
    return null;
  }
  if (!data) return null;
  const plan = data.plan === 'pro' ? 'pro' : 'free';
  return { ...data, plan };
}
