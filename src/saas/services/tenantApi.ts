import { getSupabase } from '../../lib/supabase';
import type { ActivityLog, Billing, Issue, Organization, Product, ProductMovement, SaaSUser, Tour } from '../types';

const sb = () => getSupabase();

export async function getMyOrganization(): Promise<Organization | null> {
  const { data: me } = await sb().from('users').select('organization_id').single();
  if (!me?.organization_id) return null;
  const { data } = await sb().from('organizations').select('*').eq('id', me.organization_id).single();
  return (data as Organization) ?? null;
}

export async function listUsers(): Promise<SaaSUser[]> {
  const { data } = await sb().from('users').select('*').order('created_at', { ascending: false });
  return (data as SaaSUser[]) ?? [];
}

export async function listProducts(limit = 100, offset = 0): Promise<Product[]> {
  const { data } = await sb()
    .from('products')
    .select('*')
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);
  return (data as Product[]) ?? [];
}

export async function listTours(limit = 50): Promise<Tour[]> {
  const { data } = await sb().from('tours').select('*').order('updated_at', { ascending: false }).limit(limit);
  return (data as Tour[]) ?? [];
}

export async function listIssues(limit = 50): Promise<Issue[]> {
  const { data } = await sb().from('issues').select('*').order('updated_at', { ascending: false }).limit(limit);
  return (data as Issue[]) ?? [];
}

export async function listMovementsForProduct(productId: string, limit = 100): Promise<ProductMovement[]> {
  const { data } = await sb()
    .from('product_movements')
    .select('*')
    .eq('product_id', productId)
    .order('timestamp', { ascending: false })
    .limit(limit);
  return (data as ProductMovement[]) ?? [];
}

export async function getBilling(): Promise<Billing | null> {
  const org = await getMyOrganization();
  if (!org) return null;
  const { data } = await sb()
    .from('organization_billing')
    .select('*')
    .eq('organization_id', org.id)
    .maybeSingle();
  return (data as Billing) ?? null;
}

export async function insertActivityLog(input: Omit<ActivityLog, 'id' | 'timestamp'>): Promise<void> {
  await sb().from('activity_logs').insert([input]);
}
