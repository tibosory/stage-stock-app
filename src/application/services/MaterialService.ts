import { MaterialRepository } from '../../infrastructure/repositories';
import type { Materiel } from '../../types';

export const MaterialService = {
  async listAll(): Promise<Materiel[]> {
    return MaterialRepository.list();
  },

  async getById(materialId: string): Promise<Materiel | null> {
    return MaterialRepository.byId(materialId);
  },

  async listAvailableForTour(): Promise<Materiel[]> {
    const rows = await MaterialRepository.list();
    return rows.filter(m => (m.tracking_state ?? 'available') === 'available' || m.statut === 'en stock');
  },
};
