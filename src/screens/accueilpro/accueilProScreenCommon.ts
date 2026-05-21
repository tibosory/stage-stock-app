import { useMemo, useState, useEffect } from 'react';
import { listApOrganizations, listApVenues } from '../../db/accueilProDb';

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export type AccueilProReferencePick = { label: string; value: string };

export function useAccueilProReferenceData(): {
  orgOptions: AccueilProReferencePick[];
  venueOptions: AccueilProReferencePick[];
  loading: boolean;
} {
  const [orgOptions, setOrgOptions] = useState<AccueilProReferencePick[]>([]);
  const [venueOptions, setVenueOptions] = useState<AccueilProReferencePick[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
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
  }, []);

  return useMemo(
    () => ({
      orgOptions,
      venueOptions,
      loading,
    }),
    [orgOptions, venueOptions, loading]
  );
}
