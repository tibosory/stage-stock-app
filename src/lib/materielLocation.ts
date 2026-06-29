/** Libellé lieu + flightcase optionnel (ex. « Réserve · FC-Lumière 3 »). */
export function formatMaterielEmplacement(item: {
  localisation_nom?: string | null;
  flightcase?: string | null;
}): string {
  const loc = item.localisation_nom?.trim();
  const fc = item.flightcase?.trim();
  if (loc && fc) return `${loc} · ${fc}`;
  return loc || fc || '';
}
