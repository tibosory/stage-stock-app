import {
  createAssignment,
  getAssignmentById,
  listAssignmentsByMaterial,
  listAssignmentsByTour,
  moveAssignment,
  sumActiveAssignmentQuantityForMaterial,
  updateAssignmentPackagingPhoto,
  updateAssignmentStatus,
} from '../../db/trackingDb';

export const AssignmentRepository = {
  create: createAssignment,
  byId: getAssignmentById,
  listByTour: listAssignmentsByTour,
  listByMaterial: listAssignmentsByMaterial,
  move: moveAssignment,
  updatePackagingPhoto: updateAssignmentPackagingPhoto,
  updateStatus: updateAssignmentStatus,
  sumActiveQtyByMaterial: sumActiveAssignmentQuantityForMaterial,
};
