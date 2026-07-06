import { TourRepository } from '../../infrastructure/repositories';
import type { Tour, TourLocation } from '../../types';
import { syncTourVehiculePlanningToCapi } from '../../lib/capiTourSync';
import { enqueueTrackingUpsert } from './syncQueue';
import { DomainEventBus } from '../../application/events';

export const TourService = {
  async list(): Promise<Tour[]> {
    return TourRepository.list();
  },

  async getById(tourId: string): Promise<Tour | null> {
    return TourRepository.getById(tourId);
  },

  async create(input: {
    name: string;
    status?: Tour['status'];
    startDate: string;
    endDate?: string | null;
  }): Promise<Tour> {
    const tour = await TourRepository.create(input);
    await enqueueTrackingUpsert('tours', {
      id: tour.id,
      name: tour.name,
      status: tour.status,
      start_date: tour.startDate,
      end_date: tour.endDate,
      updated_at: tour.updatedAt,
    });
    await DomainEventBus.publish('tour.created', {
      tourId: tour.id,
      name: tour.name,
      status: tour.status,
      startDate: tour.startDate,
      endDate: tour.endDate,
    });
    void syncTourVehiculePlanningToCapi(tour);
    return tour;
  },

  async update(input: {
    id: string;
    name?: string;
    status?: Tour['status'];
    endDate?: string | null;
  }): Promise<Tour> {
    const tour = await TourRepository.update(input);
    await enqueueTrackingUpsert('tours', {
      id: tour.id,
      name: tour.name,
      status: tour.status,
      start_date: tour.startDate,
      end_date: tour.endDate,
      updated_at: tour.updatedAt,
    });
    await DomainEventBus.publish('tour.updated', {
      tourId: tour.id,
      name: tour.name,
      status: tour.status,
      startDate: tour.startDate,
      endDate: tour.endDate,
    });
    void syncTourVehiculePlanningToCapi(tour);
    return tour;
  },

  async listLocations(tourId: string): Promise<TourLocation[]> {
    return TourRepository.listLocations(tourId);
  },

  async addLocation(input: {
    name: string;
    address?: string | null;
    dateStart?: string | null;
    dateEnd?: string | null;
    tourId: string;
    capiKind?: TourLocation['capiKind'];
    capiRefId?: string | null;
  }): Promise<TourLocation> {
    const row = await TourRepository.createLocation(input);
    await enqueueTrackingUpsert('tour_locations', {
      id: row.id,
      name: row.name,
      address: row.address,
      date_start: row.dateStart,
      date_end: row.dateEnd,
      tour_id: row.tourId,
      capi_kind: row.capiKind,
      capi_ref_id: row.capiRefId,
      updated_at: row.updatedAt,
    });
    await DomainEventBus.publish('tour.location_added', {
      locationId: row.id,
      tourId: row.tourId,
      name: row.name,
      address: row.address,
    });
    const tour = await TourRepository.getById(input.tourId);
    if (tour) void syncTourVehiculePlanningToCapi(tour);
    return row;
  },
};
