import type {
  ApCapiContactRef,
  ApCapiDocumentRef,
  ApCapiEspaceRef,
  ApCapiLieuRef,
  ApCapiPlanningRef,
  ApCapiSpectacleRef,
} from '../types/accueilPro';
import { getDB } from './database';

function mapLieuRow(r: Record<string, unknown>): ApCapiLieuRef {
  return {
    id: String(r.id),
    kind: r.kind as ApCapiLieuRef['kind'],
    nom: String(r.nom),
    adresse: r.adresse != null ? String(r.adresse) : null,
    ville: r.ville != null ? String(r.ville) : null,
    capiRef: String(r.capi_ref),
  };
}

function mapSpectacleRow(r: Record<string, unknown>): ApCapiSpectacleRef {
  return {
    id: String(r.id),
    titre: String(r.titre),
    compagnie: String(r.companie ?? ''),
    categorieCode: String(r.categorie_code ?? ''),
    categorieLibelle: String(r.categorie_libelle ?? ''),
    salleId: String(r.salle_id ?? ''),
    salleNom: String(r.salle_nom ?? ''),
    capiLieuRefId: String(r.capi_lieu_ref_id ?? ''),
    dateDebut: String(r.date_debut ?? ''),
    dateFin: String(r.date_fin ?? ''),
    capiRef: String(r.capi_ref),
  };
}

function mapContactRow(r: Record<string, unknown>): ApCapiContactRef {
  return {
    id: String(r.id),
    kind: r.kind as ApCapiContactRef['kind'],
    nom: String(r.nom),
    role: r.role != null ? String(r.role) : null,
    organisation: r.organisation != null ? String(r.organisation) : null,
    telephone: r.telephone != null ? String(r.telephone) : null,
    email: r.email != null ? String(r.email) : null,
    capiRef: String(r.capi_ref),
  };
}

function parseControlPointsJson(raw: unknown): ApCapiEspaceRef['controlPoints'] {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as ApCapiEspaceRef['controlPoints']) : null;
    } catch {
      return null;
    }
  }
  return Array.isArray(raw) ? (raw as ApCapiEspaceRef['controlPoints']) : null;
}

function mapEspaceRow(r: Record<string, unknown>): ApCapiEspaceRef {
  return {
    id: String(r.id),
    salleId: String(r.salle_id),
    capiLieuRefId: String(r.capi_lieu_ref_id),
    nom: String(r.nom),
    type: r.type != null ? String(r.type) : null,
    jauge: r.jauge != null ? Number(r.jauge) : null,
    description: r.description != null ? String(r.description) : null,
    controlPoints: parseControlPointsJson(r.control_points_json),
    ordre: r.ordre != null ? Number(r.ordre) : 0,
    capiRef: String(r.capi_ref),
  };
}

function mapPlanningRow(r: Record<string, unknown>): ApCapiPlanningRef {
  return {
    id: String(r.id),
    capiSpectacleRefId: String(r.capi_spectacle_ref_id),
    dateKey: String(r.date_key),
    timeStart: r.time_start != null ? String(r.time_start) : null,
    timeEnd: r.time_end != null ? String(r.time_end) : null,
    title: String(r.title),
    assigneeName: r.assignee_name != null ? String(r.assignee_name) : null,
    capiEspaceRefId: r.capi_espace_ref_id != null ? String(r.capi_espace_ref_id) : null,
    notes: r.notes != null ? String(r.notes) : null,
    sortOrder: r.sort_order != null ? Number(r.sort_order) : 0,
    capiRef: String(r.capi_ref),
  };
}

function mapDocumentRow(r: Record<string, unknown>): ApCapiDocumentRef {
  return {
    id: String(r.id),
    capiSpectacleRefId: String(r.capi_spectacle_ref_id),
    nom: String(r.nom),
    cheminDossier: r.chemin_dossier != null ? String(r.chemin_dossier) : null,
    mimeType: r.mime_type != null ? String(r.mime_type) : null,
    tailleOctets: r.taille_octets != null ? Number(r.taille_octets) : null,
    pole: r.pole != null ? String(r.pole) : null,
    versionId: String(r.version_id),
    familleId: String(r.famille_id),
    capiRef: String(r.capi_ref),
  };
}

export async function listApCapiLieuRefs(): Promise<ApCapiLieuRef[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM ap_capi_lieu_refs ORDER BY nom COLLATE NOCASE ASC',
  );
  return rows.map(mapLieuRow);
}

export async function listApCapiSpectacleRefs(): Promise<ApCapiSpectacleRef[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM ap_capi_spectacle_refs ORDER BY date_debut ASC, titre COLLATE NOCASE ASC',
  );
  return rows.map(mapSpectacleRow);
}

export async function listApCapiContactRefs(): Promise<ApCapiContactRef[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM ap_capi_contact_refs ORDER BY nom COLLATE NOCASE ASC',
  );
  return rows.map(mapContactRow);
}

export async function listApCapiEspaceRefs(): Promise<ApCapiEspaceRef[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM ap_capi_espace_refs ORDER BY capi_lieu_ref_id ASC, ordre ASC, nom COLLATE NOCASE ASC',
  );
  return rows.map(mapEspaceRow);
}

export async function listApCapiPlanningRefs(): Promise<ApCapiPlanningRef[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM ap_capi_planning_refs ORDER BY date_key ASC, sort_order ASC',
  );
  return rows.map(mapPlanningRow);
}

export async function listApCapiDocumentRefs(capiSpectacleRefId?: string): Promise<ApCapiDocumentRef[]> {
  const db = await getDB();
  const rows = capiSpectacleRefId
    ? await db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM ap_capi_document_refs WHERE capi_spectacle_ref_id = ? ORDER BY nom COLLATE NOCASE ASC',
        [capiSpectacleRefId],
      )
    : await db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM ap_capi_document_refs ORDER BY nom COLLATE NOCASE ASC',
      );
  return rows.map(mapDocumentRow);
}

export async function getApCapiLieuRefById(id: string): Promise<ApCapiLieuRef | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM ap_capi_lieu_refs WHERE id = ?',
    [id],
  );
  return row ? mapLieuRow(row) : null;
}

export async function getApCapiSpectacleRefById(id: string): Promise<ApCapiSpectacleRef | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM ap_capi_spectacle_refs WHERE id = ?',
    [id],
  );
  return row ? mapSpectacleRow(row) : null;
}

export async function getApCapiContactRefById(id: string): Promise<ApCapiContactRef | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM ap_capi_contact_refs WHERE id = ?',
    [id],
  );
  return row ? mapContactRow(row) : null;
}
