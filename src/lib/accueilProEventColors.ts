/** Couleur stable par événement (même id → même teinte partout dans Accueil Pro). */
export type AccueilProEventColor = {
  bg: string;
  text: string;
  border: string;
};

const EVENT_COLOR_PALETTE: AccueilProEventColor[] = [
  { bg: '#1A2744', text: '#FFFFFF', border: '#1A2744' },
  { bg: '#6B4C9A', text: '#FFFFFF', border: '#6B4C9A' },
  { bg: '#B84C7A', text: '#FFFFFF', border: '#B84C7A' },
  { bg: '#4068E0', text: '#FFFFFF', border: '#4068E0' },
  { bg: '#2E7D5A', text: '#FFFFFF', border: '#2E7D5A' },
  { bg: '#8B5E3C', text: '#FFFFFF', border: '#8B5E3C' },
  { bg: '#B54A45', text: '#FFFFFF', border: '#B54A45' },
  { bg: '#0D7377', text: '#FFFFFF', border: '#0D7377' },
  { bg: '#5C4D7D', text: '#FFFFFF', border: '#5C4D7D' },
  { bg: '#D4660A', text: '#FFFFFF', border: '#D4660A' },
  { bg: '#3D5A80', text: '#FFFFFF', border: '#3D5A80' },
  { bg: '#7A6A4F', text: '#FFFFFF', border: '#7A6A4F' },
];

function hashEventId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function accueilProEventColor(eventId: string): AccueilProEventColor {
  const key = eventId.trim() || 'default';
  return EVENT_COLOR_PALETTE[hashEventId(key) % EVENT_COLOR_PALETTE.length]!;
}
