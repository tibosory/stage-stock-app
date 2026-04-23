/**
 * Couleurs indicatives pour filtres éclairage (Lee Filters, Rosco Supergel).
 * Les teintes réelles varient selon lot et source ; ce référentiel sert à l’affichage dans l’app.
 */

export type GelBrand = 'lee' | 'rosco';

/** Lee Filters — numéro → couleur d’affichage (sRGB approximatif) + libellé court */
export const LEE_SWATCHES: Record<string, { hex: string; name: string }> = {
  '1': { hex: '#F5F2E8', name: 'White Diffusion' },
  '3': { hex: '#E8E4DC', name: 'White Diffusion' },
  '6': { hex: '#DDD8CC', name: 'White Diffusion' },
  '8': { hex: '#D4CFC4', name: 'White Diffusion' },
  '13': { hex: '#C8C2B6', name: 'Tough White' },
  '16': { hex: '#B8B2A6', name: 'Light Straw' },
  '19': { hex: '#A8A090', name: 'Straw' },
  '21': { hex: '#9A9078', name: 'Gold Amber' },
  '23': { hex: '#8C8068', name: 'Orange' },
  '24': { hex: '#7E7058', name: 'Deep Amber' },
  '26': { hex: '#6E6048', name: 'Bright Red' },
  '35': { hex: '#5A4838', name: 'Pink' },
  '47': { hex: '#4A3A2E', name: 'Light Rose' },
  '48': { hex: '#3E2E24', name: 'Rose Pink' },
  '79': { hex: '#5A78B0', name: 'Just Blue' },
  '101': { hex: '#FFE85C', name: 'Yellow' },
  '102': { hex: '#FFD040', name: 'Light Amber' },
  '106': { hex: '#E83828', name: 'Primary Red' },
  '109': { hex: '#F07050', name: 'Light Rose' },
  '135': { hex: '#D4A028', name: 'Deep Golden Amber' },
  '158': { hex: '#E8D090', name: 'Straw' },
  '165': { hex: '#B87020', name: 'Daylight Blue' },
  '179': { hex: '#6A5040', name: 'Chrome Orange' },
  '181': { hex: '#5A4030', name: 'Urban Blue' },
  '200': { hex: '#A0B8D8', name: 'Double CT Blue' },
  '201': { hex: '#8FA4C8', name: 'Full CT Blue' },
  '202': { hex: '#A8B8D0', name: '1/2 CT Blue' },
  '203': { hex: '#C0C8DC', name: '1/4 CT Blue' },
  '204': { hex: '#D0D8E8', name: '1/8 CT Blue' },
  '206': { hex: '#9AB0CC', name: '1/2 CT Orange' },
  '208': { hex: '#B8C8E0', name: '1/2 CT Straw' },
  '210': { hex: '#88A0C0', name: '1/2 Minusgreen' },
  '211': { hex: '#B8C8D8', name: '1/4 CT Blue' },
  '213': { hex: '#C8D0E0', name: 'White Frost' },
  '216': { hex: '#D8E0EC', name: 'White Diffusion' },
  '236': { hex: '#7088B0', name: 'HMI → Tungsten' },
  '242': { hex: '#8098B8', name: '1/2 HMI' },
  '246': { hex: '#90A8C0', name: '1/4 HMI' },
  '278': { hex: '#68A078', name: '1/2 Plusgreen' },
  '279': { hex: '#88C098', name: '1/4 Plusgreen' },
  '290': { hex: '#E0E8F0', name: '1/2 CT White' },
  '302': { hex: '#F0E8E0', name: '1/2 CT Straw' },
};

/** Rosco Supergel — numéro (souvent 2 chiffres) */
export const ROSCO_SWATCHES: Record<string, { hex: string; name: string }> = {
  '00': { hex: '#F8F6F0', name: 'Clear' },
  '01': { hex: '#F0EDE4', name: 'Light Frost' },
  '02': { hex: '#E8B8C8', name: 'Rose Pink' },
  '03': { hex: '#E090A8', name: 'Pink' },
  '08': { hex: '#F0D8B0', name: 'Light Rosy Amber' },
  '09': { hex: '#E8C090', name: 'Pale Amber Gold' },
  '10': { hex: '#FFD860', name: 'Medium Yellow' },
  '12': { hex: '#FFB020', name: 'Straw' },
  '19': { hex: '#E85030', name: 'Fire' },
  '22': { hex: '#E83828', name: 'Bright Red' },
  '23': { hex: '#C02018', name: 'Orange' },
  '24': { hex: '#A01810', name: 'Scarlet' },
  '26': { hex: '#802010', name: 'Bright Pink' },
  '33': { hex: '#6A5090', name: 'Medium Pink' },
  '34': { hex: '#504070', name: 'Tough Pink' },
  '36': { hex: '#403050', name: 'Medium Purple' },
  '48': { hex: '#5A88C0', name: 'Just Blue' },
  '58': { hex: '#7098D0', name: 'Medium Blue' },
  '59': { hex: '#88A8D8', name: 'Light Blue' },
  '68': { hex: '#A0B8E0', name: 'Sky Blue' },
  '79': { hex: '#98B0D8', name: 'Tokyo Blue' },
  '88': { hex: '#B0C8E8', name: 'Light Frost' },
  '98': { hex: '#C8D4E8', name: 'Medium Frost' },
  '99': { hex: '#D8E0F0', name: 'Heavy Frost' },
};

function normalizeRoscoCode(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const noR = t.replace(/^R\s*/i, '');
  if (/^\d{1,3}$/.test(noR)) return noR.padStart(2, '0');
  return t;
}

export function getGelSwatch(
  brand: string | null | undefined,
  code: string | null | undefined
): { hex: string; name: string } | null {
  if (!brand || !code?.trim()) return null;
  const b = String(brand).toLowerCase();
  const c = code.trim();
  if (b === 'lee') {
    const key = c.replace(/^\s*L\s*/i, '');
    if (LEE_SWATCHES[key]) return LEE_SWATCHES[key];
    return { hex: '#6B7280', name: `Lee ${key} (non répertorié)` };
  }
  if (b === 'rosco') {
    const k = normalizeRoscoCode(c);
    if (ROSCO_SWATCHES[k]) return ROSCO_SWATCHES[k];
    if (ROSCO_SWATCHES[c]) return ROSCO_SWATCHES[c];
    return { hex: '#6B7280', name: `Rosco ${c} (non répertorié)` };
  }
  return null;
}

export function gelPickerOptions(brand: GelBrand): { label: string; value: string }[] {
  const map = brand === 'lee' ? LEE_SWATCHES : ROSCO_SWATCHES;
  return Object.keys(map)
    .sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (Number.isFinite(na) && Number.isFinite(nb) && String(na) === a && String(nb) === b) return na - nb;
      return a.localeCompare(b, 'fr', { numeric: true });
    })
    .map(k => ({ value: k, label: `${k} — ${map[k].name}` }));
}

export const GEL_BRAND_OPTIONS: { label: string; value: '' | GelBrand }[] = [
  { label: 'Aucune', value: '' },
  { label: 'Lee Filters', value: 'lee' },
  { label: 'Rosco Supergel', value: 'rosco' },
];

export function formatGelLabel(brand: string | undefined | null, code: string | undefined | null): string {
  if (!brand || !code?.trim()) return '';
  const sw = getGelSwatch(brand, code);
  const prefix = brand === 'lee' ? 'Lee' : 'Rosco';
  return sw ? `${prefix} ${code.trim()} — ${sw.name}` : `${prefix} ${code.trim()}`;
}
