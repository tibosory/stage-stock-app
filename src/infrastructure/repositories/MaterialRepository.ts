import { getMateriel, getMaterielById } from '../../db/inventoryDb';

export const MaterialRepository = {
  list: getMateriel,
  byId: getMaterielById,
};
