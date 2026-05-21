/**
 * Point unique importé par les écrans Accueil Pro — proxifie les constantes depuis `src/lib`.
 */
export {
  VERIF_ITEMS,
  ERP_TYPES,
  ERP_CATS,
  EVENT_TYPES,
  ESPACE_TYPES,
  ROOM_INSPECTION_CHECKS,
  serializeVerifications,
  parseVerificationsJson,
  serializePhotos,
  parsePhotosJson,
  parseControlPointsJson,
  serializeControlPointsJson,
  resolveInspectionChecksForSpace,
  defaultControlPointsFromStandard,
  makeControlPointId,
} from '../../../lib/inspectionChecklist';
export type {
  RoomInspectionCheckDefinition,
  VerifItem,
  ApSpaceCategory,
  ApEventCategory,
  ApInspectionControlPoint,
  ApInspectionPointKind,
} from '../../../lib/inspectionChecklist';
export type { InspectionTriState, InspectionVerifications } from '../../../types/accueilPro';
