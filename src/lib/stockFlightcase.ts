/** QR stock flightcase : SS-FC:{id} — id déterministe, distinct des QR matériel. */
const PREFIX = 'SS-FC:';
const NO_LOC = '_';

export type StockFlightcaseKey = {
  localisationId: string | null;
  flightcase: string;
};

export type ParsedStockFlightcaseQr =
  | { kind: 'id'; id: string }
  | { kind: 'legacy'; localisationId: string | null; flightcase: string };

export function isStockFlightcaseQr(raw: string): boolean {
  return raw.trim().startsWith(PREFIX);
}

export function buildStockFlightcaseQrFromId(id: string): string {
  const t = id.trim();
  if (!t) throw new Error('Id flightcase requis');
  return `${PREFIX}${t}`;
}

/** @deprecated Préférer ensureStockFlightcaseQr (db) — conservé pour tests / affichage si id connu. */
export function buildStockFlightcaseQr(key: StockFlightcaseKey & { id?: string }): string {
  if (key.id?.trim()) return buildStockFlightcaseQrFromId(key.id);
  throw new Error('Utiliser ensureStockFlightcaseQr pour obtenir le QR flightcase');
}

export function parseStockFlightcaseQr(raw: string): ParsedStockFlightcaseQr | null {
  const t = raw.trim();
  if (!t.startsWith(PREFIX)) return null;
  const rest = t.slice(PREFIX.length);
  if (!rest) return null;

  const pipe = rest.indexOf('|');
  if (pipe >= 0) {
    const locPart = rest.slice(0, pipe);
    const fcPart = rest.slice(pipe + 1);
    try {
      const flightcase = decodeURIComponent(fcPart).trim();
      if (!flightcase) return null;
      const localisationId = locPart === NO_LOC ? null : locPart;
      return { kind: 'legacy', localisationId, flightcase };
    } catch {
      return null;
    }
  }

  return { kind: 'id', id: rest };
}

export function stockFlightcaseKeyFromMateriel(m: {
  localisation_id?: string | null;
  flightcase?: string | null;
}): StockFlightcaseKey | null {
  const flightcase = m.flightcase?.trim();
  if (!flightcase) return null;
  return {
    localisationId: m.localisation_id?.trim() || null,
    flightcase,
  };
}

export function normalizeFlightcaseName(s: string): string {
  return s.trim().toLowerCase();
}

export function assertMaterielQrNotFlightcase(qr: string): void {
  const t = qr.trim();
  if (t && isStockFlightcaseQr(t)) {
    throw new Error(
      'Ce code est réservé aux flightcases (préfixe SS-FC:). Chaque matériel garde son propre QR distinct.'
    );
  }
}
