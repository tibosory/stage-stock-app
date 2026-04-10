// src/lib/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// 🔧 Remplacez ces valeurs par vos credentials Supabase
// https://supabase.com/dashboard → votre projet → Settings → API
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://VOTRE_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'VOTRE_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ═══════════════════════════════════════════════════════════════════
// SYNC : pousse les données locales non-syncées vers Supabase
// ═══════════════════════════════════════════════════════════════════

import { getDB } from '../db/database';

export const syncToSupabase = async (): Promise<{ ok: boolean; error?: string }> => {
  try {
    const database = await getDB();

    // Sync matériels
    const materielsToSync = await database.getAllAsync<any>(
      'SELECT * FROM materiels WHERE synced = 0'
    );
    if (materielsToSync.length > 0) {
      const { error } = await supabase
        .from('materiels')
        .upsert(materielsToSync.map(m => ({ ...m, synced: true })));
      if (!error) {
        await database.runAsync("UPDATE materiels SET synced = 1 WHERE synced = 0");
      }
    }

    // Sync consommables
    const consoToSync = await database.getAllAsync<any>(
      'SELECT * FROM consommables WHERE synced = 0'
    );
    if (consoToSync.length > 0) {
      const { error } = await supabase
        .from('consommables')
        .upsert(consoToSync.map(c => ({ ...c, synced: true })));
      if (!error) {
        await database.runAsync("UPDATE consommables SET synced = 1 WHERE synced = 0");
      }
    }

    // Sync prêts
    const pretsToSync = await database.getAllAsync<any>(
      'SELECT * FROM prets WHERE synced = 0'
    );
    if (pretsToSync.length > 0) {
      const { error } = await supabase
        .from('prets')
        .upsert(pretsToSync.map(p => ({ ...p, synced: true })));
      if (!error) {
        await database.runAsync("UPDATE prets SET synced = 1 WHERE synced = 0");
      }
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
};

// Télécharge les données depuis Supabase (pull complet)
export const syncFromSupabase = async (): Promise<{ ok: boolean; error?: string }> => {
  try {
    const database = await getDB();

    const { data: materiels, error: e1 } = await supabase
      .from('materiels')
      .select('*')
      .order('updated_at', { ascending: false });

    if (e1) throw e1;
    if (materiels) {
      for (const m of materiels) {
        await database.runAsync(`
          INSERT OR REPLACE INTO materiels VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1
          )`, [m.id, m.nom, m.type, m.marque, m.numero_serie, m.poids_kg,
               m.categorie_id, m.localisation_id, m.etat, m.statut,
               m.date_achat, m.date_validite, m.technicien, m.qr_code,
               m.nfc_tag_id, m.photo_url, m.photo_local, m.created_at, m.updated_at]);
      }
    }

    const { data: consommables, error: e2 } = await supabase
      .from('consommables')
      .select('*');
    if (e2) throw e2;
    if (consommables) {
      for (const c of consommables) {
        await database.runAsync(`
          INSERT OR REPLACE INTO consommables VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1
          )`, [c.id, c.nom, c.reference, c.unite, c.stock_actuel, c.seuil_minimum,
               c.categorie_id, c.localisation_id, c.fournisseur, c.prix_unitaire,
               c.qr_code, c.nfc_tag_id, c.created_at, c.updated_at]);
      }
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
};

// Upload d'une photo locale vers Supabase Storage
export const uploadPhoto = async (localUri: string, materielId: string): Promise<string | null> => {
  try {
    const ext = localUri.split('.').pop() ?? 'jpg';
    const path = `materiels/${materielId}.${ext}`;

    const response = await fetch(localUri);
    const blob = await response.blob();

    const { error } = await supabase.storage
      .from('photos')
      .upload(path, blob, { upsert: true, contentType: `image/${ext}` });

    if (error) return null;

    const { data } = supabase.storage.from('photos').getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
};
