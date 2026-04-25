import { getSupabase, getSupabaseProjectUrlFromBuild, isSupabaseConfigured } from './supabase';

/**
 * Bridge JS pour modules non-TS.
 * Le client est créé dans `src/lib/supabase.ts` avec :
 * - EXPO_PUBLIC_SUPABASE_URL
 * - EXPO_PUBLIC_SUPABASE_ANON_KEY
 */
export const supabase = getSupabase();

/**
 * Pattern standard :
 *   const { data, error } = await q('table').select('*')
 *   if (error) console.log(error)
 */
export function q(table) {
  return supabase.from(table);
}

export function getSupabaseStatus() {
  return {
    configured: isSupabaseConfigured(),
    projectUrl: getSupabaseProjectUrlFromBuild(),
  };
}

/**
 * Wrapper de requête avec logs d'erreur homogènes.
 */
export async function runQuery(label, executor) {
  try {
    const { data, error } = await executor();
    if (error) {
      console.log(`[supabase.js] ${label} error:`, error);
      return { ok: false, data: null, error };
    }
    return { ok: true, data, error: null };
  } catch (error) {
    console.log(`[supabase.js] ${label} exception:`, error);
    return { ok: false, data: null, error };
  }
}

/**
 * Exemple optimisé avec relations :
 * stocks -> materiels + lieux
 */
export async function getStocksWithMaterielsAndLieux() {
  return runQuery('getStocksWithMaterielsAndLieux', async () =>
    q('stocks')
      .select(
        `
        id,
        quantite,
        updated_at,
        materiel:materiels(id, nom, numero_serie, categorie_id),
        lieu:lieux(id, nom)
      `
      )
      .order('updated_at', { ascending: false })
  );
}
