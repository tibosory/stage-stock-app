/** Lieu (salle CAPI) + localisation fine (CATRACK). */
export function formatLieuLocalisation(item: {
  lieu_nom?: string | null;
  localisation_nom?: string | null;
}): string {
  const lieu = item.lieu_nom?.trim();
  const loc = item.localisation_nom?.trim();
  if (lieu && loc) return `${lieu} · ${loc}`;
  return lieu || loc || '';
}

/** Libellé lieu + local + flightcase optionnel (ex. « Le Vellein · Réserve · FC-Lumière 3 »). */
export function formatMaterielEmplacement(item: {
  lieu_nom?: string | null;
  localisation_nom?: string | null;
  flightcase?: string | null;
}): string {
  const base = formatLieuLocalisation(item);
  const fc = item.flightcase?.trim();
  if (base && fc) return `${base} · ${fc}`;
  return base || fc || '';
}
