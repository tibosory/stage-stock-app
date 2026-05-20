import type { StructuredQuery } from '../stock/stockEngine';

const CATEGORY_KEYWORDS: Array<{ category: NonNullable<StructuredQuery['category']>; words: string[] }> = [
  { category: 'sound', words: ['son', 'audio', 'enceinte', 'micro', 'console'] },
  { category: 'light', words: ['lumiere', 'lumière', 'projecteur', 'dmx', 'lyre'] },
  { category: 'video', words: ['video', 'vidéo', 'projecteur video', 'ecran', 'écran'] },
  { category: 'stage', words: ['plateau', 'scene', 'scène', 'structure', 'pont'] },
  { category: 'costume', words: ['costume', 'tenue', 'textile', 'habit'] },
  { category: 'props', words: ['accessoire', 'decor', 'décor', 'prop'] },
  { category: 'energy', words: ['energie', 'énergie', 'alimentation', 'electrique', 'électrique'] },
];

/**
 * Rule engine rapide (sans IA): texte naturel -> requête structurée.
 */
export function parseNaturalQueryWithRules(input: string): StructuredQuery {
  const q = input.trim().toLowerCase();
  if (!q) return {};
  const out: StructuredQuery = { text: q, sort: 'relevance' };

  for (const cat of CATEGORY_KEYWORDS) {
    if (cat.words.some(w => q.includes(w))) {
      out.category = cat.category;
      break;
    }
  }
  if (/\b(dispo|disponible|en stock|stock)\b/.test(q)) out.available = true;
  if (/\b(reparation|réparation|maintenance)\b/.test(q)) out.status = 'maintenance';
  if (/\b(casse|cassé|hs|broken)\b/.test(q)) out.status = 'broken';
  if (/\b(ok|bon etat|bon état)\b/.test(q)) out.status = 'ok';
  if (/\b(puissant|puissants)\b/.test(q)) out.sort = 'power_desc';

  const powerMatch = q.match(/\b(\d{2,5})\s*w\b/);
  if (powerMatch) out.minPower = Number(powerMatch[1]);

  const cap = q.match(/\b(\d{2,5})\s*(pers|personnes|pax)\b/);
  if (cap) out.capacity = Number(cap[1]);

  if (/\b(kit|setup|pack)\b/.test(q)) {
    out.recommended_setup = true;
    out.optimized_list = true;
  }

  return out;
}
