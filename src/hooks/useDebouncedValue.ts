import { useState, useEffect } from 'react';

/**
 * Retarde la propagation d’une valeur (recherche, filtres) pour limiter le travail
 * sur chaque frappe et rendre l’UI plus fluide.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
