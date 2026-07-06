import { useCallback, useMemo, useState, useEffect } from 'react';
import { listApOrganizations, listApVenues } from '../../db/accueilProDb';
import {
  listApCapiContactRefs,
  listApCapiLieuRefs,
  listApCapiSpectacleRefs,
} from '../../db/capiAccueilProRefDb';
import type { ApCapiContactRef, ApCapiLieuRef, ApCapiSpectacleRef } from '../../types/accueilPro';
import {
  capiContactRefLabel,
  capiLieuRefLabel,
  capiSpectacleRefLabel,
} from '../../lib/capiAccueilProHelpers';

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

export function useCapiAccueilProCatalog(): {
  capiLieuRefs: ApCapiLieuRef[];
  capiSpectacleRefs: ApCapiSpectacleRef[];
  capiContactRefs: ApCapiContactRef[];
  capiLieuOptions: AccueilProReferencePick[];
  capiSpectacleOptions: AccueilProReferencePick[];
  capiContactOptions: AccueilProReferencePick[];
  loading: boolean;
  reload: () => void;
} {
  const [capiLieuRefs, setCapiLieuRefs] = useState<ApCapiLieuRef[]>([]);
  const [capiSpectacleRefs, setCapiSpectacleRefs] = useState<ApCapiSpectacleRef[]>([]);
  const [capiContactRefs, setCapiContactRefs] = useState<ApCapiContactRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick(n => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [lieux, spectacles, contacts] = await Promise.all([
          listApCapiLieuRefs(),
          listApCapiSpectacleRefs(),
          listApCapiContactRefs(),
        ]);
        if (!cancelled) {
          setCapiLieuRefs(lieux);
          setCapiSpectacleRefs(spectacles);
          setCapiContactRefs(contacts);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const capiLieuOptions = useMemo(
    () => [
      { label: '—', value: '' },
      ...capiLieuRefs.map(r => ({ label: capiLieuRefLabel(r), value: r.id })),
    ],
    [capiLieuRefs],
  );

  const capiSpectacleOptions = useMemo(
    () => [
      { label: '—', value: '' },
      ...capiSpectacleRefs.map(r => ({ label: capiSpectacleRefLabel(r), value: r.id })),
    ],
    [capiSpectacleRefs],
  );

  const capiContactOptions = useMemo(
    () => [
      { label: '—', value: '' },
      ...capiContactRefs.map(r => ({ label: capiContactRefLabel(r), value: r.id })),
    ],
    [capiContactRefs],
  );

  return useMemo(
    () => ({
      capiLieuRefs,
      capiSpectacleRefs,
      capiContactRefs,
      capiLieuOptions,
      capiSpectacleOptions,
      capiContactOptions,
      loading,
      reload,
    }),
    [
      capiLieuRefs,
      capiSpectacleRefs,
      capiContactRefs,
      capiLieuOptions,
      capiSpectacleOptions,
      capiContactOptions,
      loading,
      reload,
    ],
  );
}
