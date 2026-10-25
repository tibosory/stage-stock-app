/** Accord français quantité + unité (affichage seulement, pas la valeur stockée). */

const UNITE_INVARIANTE = new Set([
  '%',
  'a',
  'cm',
  'g',
  'kg',
  'km',
  'l',
  'm',
  'm2',
  'm3',
  'm²',
  'm³',
  'mg',
  'ml',
  'mm',
  't',
  'v',
  'w',
]);

/** Formes canoniques (singulier → pluriel). Clés en minuscules. */
const UNITE_ACCORDS: Record<string, { singular: string; plural: string }> = {
  '1/2 feuille': { singular: '1/2 feuille', plural: '1/2 feuilles' },
  '1/2 feuilles': { singular: '1/2 feuille', plural: '1/2 feuilles' },
  bobine: { singular: 'bobine', plural: 'bobines' },
  boite: { singular: 'boite', plural: 'boites' },
  boites: { singular: 'boite', plural: 'boites' },
  boîte: { singular: 'boîte', plural: 'boîtes' },
  boîtes: { singular: 'boîte', plural: 'boîtes' },
  carton: { singular: 'carton', plural: 'cartons' },
  cartons: { singular: 'carton', plural: 'cartons' },
  feuille: { singular: 'feuille', plural: 'feuilles' },
  feuilles: { singular: 'feuille', plural: 'feuilles' },
  litre: { singular: 'litre', plural: 'litres' },
  litres: { singular: 'litre', plural: 'litres' },
  metre: { singular: 'metre', plural: 'metres' },
  metres: { singular: 'metre', plural: 'metres' },
  mètre: { singular: 'mètre', plural: 'mètres' },
  mètres: { singular: 'mètre', plural: 'mètres' },
  paquet: { singular: 'paquet', plural: 'paquets' },
  paquets: { singular: 'paquet', plural: 'paquets' },
  piece: { singular: 'piece', plural: 'pieces' },
  pieces: { singular: 'piece', plural: 'pieces' },
  pièce: { singular: 'pièce', plural: 'pièces' },
  pièces: { singular: 'pièce', plural: 'pièces' },
  pot: { singular: 'pot', plural: 'pots' },
  pots: { singular: 'pot', plural: 'pots' },
  rouleau: { singular: 'rouleau', plural: 'rouleaux' },
  rouleaux: { singular: 'rouleau', plural: 'rouleaux' },
  sac: { singular: 'sac', plural: 'sacs' },
  sacs: { singular: 'sac', plural: 'sacs' },
  tube: { singular: 'tube', plural: 'tubes' },
  tubes: { singular: 'tube', plural: 'tubes' },
};

function cleUnite(unite: string): string {
  return unite.trim().toLowerCase();
}

function appliquerCasse(modele: string, texte: string): string {
  const src = modele.trim();
  if (!src || !texte) return texte;
  if (src === src.toUpperCase()) return texte.toUpperCase();
  if (src[0] === src[0]?.toUpperCase()) {
    return texte.charAt(0).toUpperCase() + texte.slice(1);
  }
  return texte;
}

function formesUnite(unite: string): { singular: string; plural: string } {
  const raw = unite.trim();
  const key = cleUnite(raw);
  const connu = UNITE_ACCORDS[key];
  if (connu) {
    return {
      singular: appliquerCasse(raw, connu.singular),
      plural: appliquerCasse(raw, connu.plural),
    };
  }
  if (UNITE_INVARIANTE.has(key)) {
    return { singular: raw, plural: raw };
  }
  if (/(eau|au|eu)$/i.test(raw)) {
    return { singular: raw, plural: `${raw}x` };
  }
  if (/eaux$/i.test(raw)) {
    return { singular: raw.replace(/eaux$/i, 'eau'), plural: raw };
  }
  if (/[sxz]$/i.test(raw)) {
    if (/s$/i.test(raw) && !/[sxz]s$/i.test(raw)) {
      return { singular: raw.slice(0, -1), plural: raw };
    }
    return { singular: raw, plural: raw };
  }
  return { singular: raw, plural: `${raw}s` };
}

/** 0 et 1 → singulier (0 pièce) ; au-delà → pluriel. */
export function accordUniteFr(unite: string | null | undefined, quantite: number): string {
  const raw = (unite ?? '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  const formes = formesUnite(raw);
  return Math.abs(quantite) > 1 ? formes.plural : formes.singular;
}

/** `24 rouleaux`, `1 pièce`, `0 pièce` — espace entre le nombre et l’unité. */
export function formatQuantiteUnite(
  quantite: number | null | undefined,
  unite: string | null | undefined,
): string {
  const unit = (unite ?? '').trim().replace(/\s+/g, ' ');
  const qty =
    quantite == null || typeof quantite !== 'number' || !Number.isFinite(quantite) ? null : quantite;
  if (qty == null && !unit) return '';
  if (qty == null) return unit;
  if (!unit) return String(qty);
  return `${qty} ${accordUniteFr(unit, qty)}`;
}
