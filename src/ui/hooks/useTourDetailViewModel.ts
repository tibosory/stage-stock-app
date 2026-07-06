import { useCallback, useMemo, useState } from 'react';
import { AssignmentService, TourService } from '../../services/tracking';
import { MaterialService } from '../../application/services';
import { assignMaterialToTour, getTourUseCase } from '../../application/usecases';
import { createTourFlightcases, listTourFlightcases } from '../../db/trackingDb';
import { listTourLieuRefs } from '../../db/tourLieuRefDb';
import type { Assignment, Materiel, Tour, TourFlightcase, TourLocation, TourLieuRef } from '../../types';

export function useTourDetailViewModel(tourId: string, userId?: string) {
  const [tour, setTour] = useState<Tour | null>(null);
  const [locations, setLocations] = useState<TourLocation[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [materials, setMaterials] = useState<Materiel[]>([]);
  const [flightcases, setFlightcases] = useState<TourFlightcase[]>([]);
  const [tourLieuRefs, setTourLieuRefs] = useState<TourLieuRef[]>([]);
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [tourLieuRefId, setTourLieuRefId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [flightcaseId, setFlightcaseId] = useState('');
  const [quantity, setQuantity] = useState('1');

  const load = useCallback(async () => {
    const [t, locs, asg, mats, fcs, refs] = await Promise.all([
      getTourUseCase(tourId),
      TourService.listLocations(tourId),
      AssignmentService.listByTour(tourId),
      MaterialService.listAll(),
      listTourFlightcases(tourId),
      listTourLieuRefs(),
    ]);
    setTour(t);
    setLocations(locs);
    setAssignments(asg);
    setMaterials(mats);
    setFlightcases(fcs);
    setTourLieuRefs(refs);
  }, [tourId]);

  const createFlightcasesBatch = useCallback(
    async (totalCases: number) => {
      await createTourFlightcases({ tourId, totalCases });
      await load();
    },
    [load, tourId]
  );

  const onTourLieuRefChange = useCallback(
    (refId: string) => {
      setTourLieuRefId(refId);
      if (!refId) return;
      const ref = tourLieuRefs.find((r) => r.id === refId);
      if (!ref) return;
      setLocName(ref.nom);
      setLocAddress(ref.adresse?.trim() || '');
    },
    [tourLieuRefs]
  );

  const addLocation = useCallback(async () => {
    if (!locName.trim()) return;
    const ref = tourLieuRefId ? tourLieuRefs.find((r) => r.id === tourLieuRefId) : null;
    await TourService.addLocation({
      tourId,
      name: locName.trim(),
      address: locAddress.trim() || null,
      capiKind: ref?.kind ?? null,
      capiRefId: ref?.capiRef ?? null,
    });
    setLocName('');
    setLocAddress('');
    setTourLieuRefId('');
    await load();
  }, [locAddress, locName, load, tourId, tourLieuRefId, tourLieuRefs]);

  const assign = useCallback(async () => {
    const created = await assignMaterialToTour({
      materialId,
      tourId,
      locationId: locationId || null,
      flightcaseId: flightcaseId || null,
      quantity: Math.max(1, Number(quantity) || 1),
      userId,
    });
    setMaterialId('');
    await load();
    return created;
  }, [flightcaseId, locationId, materialId, quantity, load, tourId, userId]);

  /** Affecte un matériel déjà identifié (ex. après scan QR / NFC), avec la quantité et le lieu courants. */
  const assignWithMaterialId = useCallback(
    async (mid: string) => {
      const qty = Math.max(1, Math.floor(Number(quantity) || 1));
      const created = await assignMaterialToTour({
        materialId: mid,
        tourId,
        locationId: locationId || null,
        flightcaseId: flightcaseId || null,
        quantity: qty,
        userId,
      });
      setMaterialId('');
      await load();
      return created;
    },
    [flightcaseId, locationId, quantity, load, tourId, userId]
  );

  const materialOptions = useMemo(
    () => [{ label: '— Choisir une fiche matériel —', value: '' }, ...materials.map(m => ({ label: m.nom, value: m.id }))],
    [materials]
  );
  const locationOptions = useMemo(
    () => [{ label: '— Sans lieu précis (optionnel) —', value: '' }, ...locations.map(l => ({ label: l.name, value: l.id }))],
    [locations]
  );
  const flightcaseOptions = useMemo(
    () => [
      { label: '— Sans flightcase —', value: '' },
      ...flightcases.map(fc => ({ label: `Flightcase ${fc.label}`, value: fc.id })),
    ],
    [flightcases]
  );

  const tourLieuRefOptions = useMemo(() => {
    const kindLabel = (kind: TourLieuRef['kind']) => {
      if (kind === 'salle') return 'Salle';
      if (kind === 'exterieur') return 'Ext.';
      return 'Véh.';
    };
    return [
      { label: '— Saisie libre ou sync CAPI —', value: '' },
      ...tourLieuRefs.map((r) => ({
        label: `[${kindLabel(r.kind)}] ${r.nom}`,
        value: r.id,
      })),
    ];
  }, [tourLieuRefs]);

  return {
    tour,
    locations,
    assignments,
    flightcases,
    tourLieuRefs,
    /** Liste matériels (noms pour l’affichage des affectations). */
    materials,
    locName,
    setLocName,
    locAddress,
    setLocAddress,
    tourLieuRefId,
    setTourLieuRefId,
    onTourLieuRefChange,
    tourLieuRefOptions,
    materialId,
    setMaterialId,
    locationId,
    setLocationId,
    flightcaseId,
    setFlightcaseId,
    quantity,
    setQuantity,
    load,
    createFlightcasesBatch,
    addLocation,
    assign,
    assignWithMaterialId,
    materialOptions,
    locationOptions,
    flightcaseOptions,
  };
}
