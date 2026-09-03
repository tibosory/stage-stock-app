/**
 * Détection « PC inventaire incomplet » pour escalader Envoyer → Envoyer tout.
 * Pure (testable) : longueurs snapshot vs compteurs locaux.
 *
 * Cas couverts :
 * - serveur vide (reset / première montée) ;
 * - synchro partielle (ex. 50 matériels PC, 200 sur le téléphone) ;
 * - type manquant (ex. 0 consommable serveur alors que le téléphone en a).
 */
export function shouldEscalateToFullInventoryPush(input: {
  localMateriels: number;
  localConsommables: number;
  remoteMateriels: number;
  remoteConsommables: number;
}): boolean {
  const hasLocal = input.localMateriels > 0 || input.localConsommables > 0;
  if (!hasLocal) return false;

  const remoteEmpty = input.remoteMateriels === 0 && input.remoteConsommables === 0;
  if (remoteEmpty) return true;

  if (input.localMateriels > input.remoteMateriels) return true;
  if (input.localConsommables > input.remoteConsommables) return true;

  return false;
}
