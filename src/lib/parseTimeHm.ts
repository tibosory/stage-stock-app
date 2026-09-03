export type ParsedTimeHm = { h: number; m: number };

function clampHm(h: number, m: number): ParsedTimeHm | null {
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

/**
 * Parse une heure saisie libre vers { h, m } (24 h).
 * Accepte notamment : `9`, `9.30`, `9,30`, `930`, `9:30`, `09:30`, `9h30`.
 * Aligné sur CAPI RegieTec (frontend/src/lib/dateFormat.ts).
 */
export function parseTimeHm(value: string): ParsedTimeHm | null {
  const raw = value.trim().replace(/\s+/g, ' ');
  if (!raw) return null;

  const h12 = raw.match(/^(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)$/i);
  if (h12) {
    let h = parseInt(h12[1]!, 10) % 12;
    if (/p/i.test(h12[3]!)) h += 12;
    const m = parseInt(h12[2]!, 10);
    return clampHm(h, m);
  }

  const h24 = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (h24) {
    return clampHm(parseInt(h24[1]!, 10), parseInt(h24[2]!, 10));
  }

  const frH = raw.match(/^(\d{1,2})\s*[hH]\s*(\d{0,2})$/);
  if (frH) {
    const mPart = frH[2]!;
    return clampHm(parseInt(frH[1]!, 10), mPart === '' ? 0 : parseInt(mPart, 10));
  }

  const dotted = raw.match(/^(\d{1,2})[.,](\d{1,2})$/);
  if (dotted) {
    return clampHm(parseInt(dotted[1]!, 10), parseInt(dotted[2]!, 10));
  }

  if (/^\d{1,4}$/.test(raw)) {
    if (raw.length <= 2) {
      return clampHm(parseInt(raw, 10), 0);
    }
    if (raw.length === 3) {
      return clampHm(parseInt(raw.slice(0, 1), 10), parseInt(raw.slice(1), 10));
    }
    return clampHm(parseInt(raw.slice(0, 2), 10), parseInt(raw.slice(2), 10));
  }

  return null;
}

/** Normalise une heure HH:mm pour stockage. */
export function normalizeTimeHm(value: string): string {
  const parsed = parseTimeHm(value);
  if (!parsed) return value.trim();
  return `${String(parsed.h).padStart(2, '0')}:${String(parsed.m).padStart(2, '0')}`;
}
