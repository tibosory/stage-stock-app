import {
  createTour,
  createTourLocation,
  getTourById,
  listTourLocations,
  listTours,
  updateTour,
} from '../../db/trackingDb';

export const TourRepository = {
  list: listTours,
  getById: getTourById,
  create: createTour,
  update: updateTour,
  listLocations: listTourLocations,
  createLocation: createTourLocation,
};
