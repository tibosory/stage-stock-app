/**
 * Envoie automatiquement un e-mail récapitulatif d’alertes via le backend (SMTP),
 * lorsque le téléphone est en Wi‑Fi ou données mobiles et que le jeu d’alertes change.
 */
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getResolvedApiBase, stageStockApiHeadersAsync, checkServerReachableQuick } from '../config/stageStockApi';
import {
  getAlertesEmail,
  getConsommablesAlerte,
  getMaterielsPourMaintenanceAlertes,
  getMaterielsPourVgpAlertes,
  getPrets,
  getSessionAppUserRole,
} from '../db/database';
import { loadMailRecipientAlerteIds, loadNotificationPrefs } from './notificationPrefs';
import { isVgpEpi, isVgpEnRetard, vgpProchaineEcheanceIso } from './vgp';
import type { Consommable, Materiel, Pret } from '../types';

const FP_KEY = '@stagestock_auto_mail_fp_v1';

/** Limite les tentatives si plusieurs déclencheurs (sync + changement réseau) arrivent en rafale. */
let lastAttemptAt = 0;
const MIN_MS_BETWEEN_ATTEMPTS = 45_000;

function joinBasePath(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

function formatDateCourt(raw: string | undefined): string {
  if (!raw) return '';
  const d = raw.includes('T') ? parseISO(raw) : parseISO(`${raw}T12:00:00`);
  if (!isValid(d)) return raw;
  return format(d, 'd MMM yyyy', { locale: fr });
}

function fpPart(ids: string[]): string {
  return [...ids].sort().join(',');
}

export function isWifiOrCellularNetwork(state: Network.NetworkState): boolean {
  if (!state.isConnected) return false;
  if (state.isInternetReachable === false) return false;
  const t = state.type;
  return t === Network.NetworkStateType.WIFI || t === Network.NetworkStateType.CELLULAR;
}

async function loadLastFp(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(FP_KEY);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

async function saveLastFp(fp: string): Promise<void> {
  await AsyncStorage.setItem(FP_KEY, fp);
}

async function getRecipientEmails(): Promise<string[]> {
  const [ids, list] = await Promise.all([loadMailRecipientAlerteIds(), getAlertesEmail()]);
  const pick = ids.length ? list.filter(a => ids.includes(a.id)) : list;
  return [...new Set(pick.map(a => a.email.trim().toLowerCase()).filter(Boolean))];
}

function buildBody(params: {
  pretsRetard: Pret[];
  consoBas: Consommable[];
  maint: Materiel[];
  vgp: Materiel[];
}): string {
  const lines: string[] = [
    'Bonjour,',
    '',
    'Récapitulatif des alertes Stage Stock (généré automatiquement depuis l’application).',
    '',
  ];
  if (params.pretsRetard.length) {
    lines.push('— PRÊTS EN RETARD');
    for (const p of params.pretsRetard) {
      lines.push(
        `• ${p.emprunteur} — retour prévu ${formatDateCourt(p.retour_prevu)}${p.organisation ? ` (${p.organisation})` : ''}`
      );
    }
    lines.push('');
  }
  if (params.consoBas.length) {
    lines.push('— STOCKS CONSOMMABLES SOUS LE SEUIL');
    for (const c of params.consoBas) {
      lines.push(`• ${c.nom} — stock ${c.stock_actuel} / seuil ${c.seuil_minimum}${c.reference?.trim() ? ` — ref. ${c.reference.trim()}` : ''}`);
    }
    lines.push('');
  }
  if (params.maint.length) {
    lines.push('— MAINTENANCE (30 J)');
    for (const m of params.maint) {
      const last = m.prochain_controle ? `dernière intervention ${formatDateCourt(m.prochain_controle)}` : 'jamais horodatée';
      const freq = m.intervalle_controle_jours ? `tous les ${m.intervalle_controle_jours} j` : '';
      const todo = m.maintenance_todo?.trim() ? `à faire: ${m.maintenance_todo.trim()}` : '';
      lines.push(`• ${m.nom} — ${[last, freq, todo].filter(Boolean).join(' · ')}`);
    }
    lines.push('');
  }
  if (params.vgp.length) {
    const epi = params.vgp.filter(isVgpEpi);
    const autres = params.vgp.filter(m => !isVgpEpi(m));
    if (epi.length) {
      lines.push('— VGP — EPI (30 J)');
      for (const m of epi) {
        const proch = vgpProchaineEcheanceIso(m);
        lines.push(
          `• ${m.nom}${m.vgp_libelle ? ` — ${m.vgp_libelle}` : ''} — ${proch ? `échéance ${formatDateCourt(proch)}` : 'à planifier'}${isVgpEnRetard(m) ? ' (en retard)' : ''}`
        );
      }
      lines.push('');
    }
    if (autres.length) {
      lines.push('— VGP — AUTRES ÉQUIPEMENTS (30 J)');
      for (const m of autres) {
        const proch = vgpProchaineEcheanceIso(m);
        lines.push(
          `• ${m.nom}${m.vgp_libelle ? ` — ${m.vgp_libelle}` : ''} — ${proch ? `échéance ${formatDateCourt(proch)}` : 'à planifier'}${isVgpEnRetard(m) ? ' (en retard)' : ''}`
        );
      }
      lines.push('');
    }
  }
  lines.push('—', 'Stage Stock');
  return lines.join('\n');
}

/**
 * Si les conditions sont réunies (rôle, préf., Wi‑Fi/cellulaire, API + SMTP), envoie un e-mail
 * lorsque le jeu d’alertes pertinent change.
 */
export async function maybeSendAutoAlertEmailsIfNeeded(): Promise<void> {
  try {
    const role = await getSessionAppUserRole();
    if (role !== 'admin' && role !== 'technicien') return;

    const prefs = await loadNotificationPrefs();
    if (!prefs.mailAutoSendWifiCellular) return;

    const net = await Network.getNetworkStateAsync();
    if (!isWifiOrCellularNetwork(net)) return;

    const base = await getResolvedApiBase();
    if (!base || base.length < 8 || !/^https?:\/\//i.test(base)) return;

    const reachable = await checkServerReachableQuick();
    if (!reachable) return;

    const nowMs = Date.now();
    if (nowMs - lastAttemptAt < MIN_MS_BETWEEN_ATTEMPTS) return;
    lastAttemptAt = nowMs;

    const today = new Date().toISOString().split('T')[0];
    const [pretsAll, consoAll, maintAll, vgpAll] = await Promise.all([
      getPrets(),
      getConsommablesAlerte(),
      getMaterielsPourMaintenanceAlertes(30),
      getMaterielsPourVgpAlertes(30),
    ]);

    const pretsRetard = prefs.mailSuggestionPrets
      ? pretsAll.filter(
          p =>
            (p.statut === 'en cours' || p.statut === 'en retard') &&
            p.retour_prevu &&
            p.retour_prevu < today
        )
      : [];

    const consoBas = prefs.mailSuggestionSeuil ? consoAll : [];
    const maint = prefs.mailSuggestionVgp ? maintAll : [];
    const vgp = prefs.mailSuggestionVgp ? vgpAll : [];

    const fp =
      'pret:' +
      fpPart(pretsRetard.map(p => p.id)) +
      '|conso:' +
      fpPart(consoBas.map(c => c.id)) +
      '|maint:' +
      fpPart(maint.map(m => m.id)) +
      '|vgp:' +
      fpPart(vgp.map(m => m.id));

    const last = await loadLastFp();
    if (last === fp) return;

    const hasContent =
      pretsRetard.length > 0 || consoBas.length > 0 || maint.length > 0 || vgp.length > 0;
    if (!hasContent) {
      await saveLastFp(fp);
      return;
    }

    const recipients = await getRecipientEmails();
    if (recipients.length === 0) {
      return;
    }

    const subject = `[Stage Stock] Alertes — ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}`;
    const text = buildBody({ pretsRetard, consoBas, maint, vgp });

    const url = joinBasePath(base, '/api/email/send-alert');
    const headers = await stageStockApiHeadersAsync();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: recipients, subject, text }),
    });

    if (res.status === 501) {
      return;
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.warn('[StageStock] auto alert email failed', res.status, t.slice(0, 200));
      return;
    }

    await saveLastFp(fp);
  } catch (e) {
    console.warn('[StageStock] maybeSendAutoAlertEmailsIfNeeded', e);
  }
}
