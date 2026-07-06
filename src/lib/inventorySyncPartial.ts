import type { InventorySyncResult } from './inventorySyncOrchestrator';

export function isPartialInventorySync(result: InventorySyncResult): boolean {
  if (result.ok) return false;
  const push = result.pushOk;
  const pull = result.pullOk;
  if (push === undefined && pull === undefined) return false;
  return Boolean(push) !== Boolean(pull);
}

export function formatPartialInventorySyncError(result: InventorySyncResult): string {
  if (result.pushOk && result.pullOk === false) {
    return result.error ?? 'Envoi réussi mais réception échouée. Utilisez Recevoir ↓ dans Connexion.';
  }
  if (result.pullOk && result.pushOk === false) {
    return result.error ?? 'Réception réussie mais envoi échoué. Utilisez Envoyer ↑ dans Connexion.';
  }
  return result.error ?? 'Synchronisation incomplète';
}
