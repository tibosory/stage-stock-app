import { useCallback, useMemo, useState } from 'react';
import { AssignmentService, TourService } from '../../services/tracking';
import { MaterialService } from '../../application/services';
import { assignMaterialToTour, getTourUseCase } from '../../application/usecases';
import { createTourFlightcases, listTourFlightcases } from '../../db/trackingDb';
import type { Assignment, Materiel, Tour, TourFlightcase, TourLocation } from '../../types';

export function useTourDetailViewModel(tourId: string, userId?: string) {
  const [tour, setTour] = useState<Tour | null>(null);
  const [locations, setLocations] = useState<TourLocation[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [materials, setMaterials] = useState<Materiel[]>([]);
  const [flightcases, setFlightcases] = useState<TourFlightcase[]>([]);
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [flightcaseId, setFlightcaseId] = useState('');
  const [quantity, setQuantity] = useState('1');

  const load = useCallback(async () => {
    const [t, locs, asg, mats, fcs] = await Promise.all([
      getTourUseCase(tourId),
      TourService.listLocations(tourId),
      AssignmentService.listByTour(tourId),
      MaterialService.listAll(),
      listTourFlightcases(tourId),
    ]);
    setTour(t);
    setLocations(locs);
    setAssignments(asg);
    setMaterials(mats);
    setFlightcases(fcs);
  }, [tourId]);

  const createFlightcasesBatch = useCallback(
    async (totalCases: number) => {
      await createTourFlightcases({ tourId, totalCases });
      await load();
    },
    [load, tourId]
  );

  const addLocation = useCallback(async () => {
    if (!locName.trim()) return;
    await TourService.addLocation({ tourId, name: locName.trim(), address: locAddress.trim() || null });
    setLocName('');
    setLocAddress('');
    await load();
  }, [locAddress, locName, load, tourId]);

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

  return {
    tour,
    locations,
    assignments,
    flightcases,
    /** Liste matériels (noms pour l’affichage des affectations). */
    materials,
    locName,
    setLocName,
    locAddress,
    setLocAddress,
    materialId,
    setMaterialId,
    locationId,
    setLocationId,
    flightcaseId,
    setFlightcaseId,
    quantity,
    setQuantity,
    load,
    addLocation,
    createFlightcasesBatch,
    assign,
    assignWithMaterialId,
    materialOptions,
    locationOptions,
    flightcaseOptions,
  };
}
