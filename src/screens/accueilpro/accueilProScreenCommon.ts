import { useCallback, useMemo, useState, useEffect } from 'react';
import { listApOrganizations, listApVenues } from '../../db/accueilProDb';

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export type AccueilProReferencePick = { label: string; value: string };

export function useAccueilProReferenceData(): {
  orgOptions: AccueilProReferencePick[];
  venueOptions: AccueilProReferencePick[];
  loading: boolean;
  reload: () => void;
} {
  const [orgOptions, setOrgOptions] = useState<AccueilProReferencePick[]>([]);
  const [venueOptions, setVenueOptions] = useState<AccueilProReferencePick[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick(n => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [orgs, venues] = await Promise.all([listApOrganizations(), listApVenues()]);
        if (!cancelled) {
          setOrgOptions(orgs.map(o => ({ label: o.name, value: o.id })));
          setVenueOptions(venues.map(v => ({ label: v.name, value: v.id })));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return useMemo(
    () => ({
      orgOptions,
      venueOptions,
      loading,
      reload,
    }),
    [orgOptions, venueOptions, loading, reload]
  );
}
