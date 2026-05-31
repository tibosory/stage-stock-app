/** Bloque les alertes sync pendant le scan QR d’appairage. */
let pairingInProgress = false;

export function setPairingInProgress(active: boolean): void {
  pairingInProgress = active;
}

export function isPairingInProgress(): boolean {
  return pairingInProgress;
}
