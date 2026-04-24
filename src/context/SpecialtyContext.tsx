import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { SpecialtyId } from '../config/specialties';
import { DEFAULT_SPECIALTY_ID } from '../config/specialties';
import { getUserSpecialty, setUserSpecialty as persistSpecialty } from '../lib/userSpecialtyStorage';

type SpecialtyCtx = {
  specialtyId: SpecialtyId;
  setSpecialtyId: (id: SpecialtyId) => Promise<void>;
  ready: boolean;
};

const SpecialtyContext = createContext<SpecialtyCtx | null>(null);

export function SpecialtyProvider({ children }: { children: React.ReactNode }) {
  const [specialtyId, setState] = useState<SpecialtyId>(DEFAULT_SPECIALTY_ID);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const v = await getUserSpecialty();
      if (!cancel) {
        setState(v);
        setReady(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const setSpecialtyId = useCallback(async (id: SpecialtyId) => {
    setState(id);
    await persistSpecialty(id);
  }, []);

  const value = useMemo(
    () => ({ specialtyId, setSpecialtyId, ready }),
    [specialtyId, setSpecialtyId, ready]
  );

  return <SpecialtyContext.Provider value={value}>{children}</SpecialtyContext.Provider>;
}

export function useSpecialty(): SpecialtyCtx {
  const v = useContext(SpecialtyContext);
  if (!v) {
    throw new Error('useSpecialty doit être utilisé sous SpecialtyProvider');
  }
  return v;
}
