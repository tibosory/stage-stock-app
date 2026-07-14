import type {
  ApCapiContactRef,
  ApCapiDocumentRef,
  ApCapiDossierRef,
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

function parseJsonArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? (raw as T[]) : [];
}

function mapDossierRow(r: Record<string, unknown>): ApCapiDossierRef {
  return {
    id: String(r.id),
    capiSpectacleRefId: String(r.capi_spectacle_ref_id),
    capiRef: String(r.capi_ref),
    compagnie: r.compagnie != null ? String(r.compagnie) : '',
    dateRepresentationDebut: r.date_representation_debut != null ? String(r.date_representation_debut) : null,
    dateRepresentationFin: r.date_representation_fin != null ? String(r.date_representation_fin) : null,
    dateOccupationDebut: r.date_occupation_debut != null ? String(r.date_occupation_debut) : null,
    dateOccupationFin: r.date_occupation_fin != null ? String(r.date_occupation_fin) : null,
    datePremontageDebut: r.date_premontage_debut != null ? String(r.date_premontage_debut) : null,
    datePremontageFin: r.date_premontage_fin != null ? String(r.date_premontage_fin) : null,
    dateDemontage: r.date_demontage != null ? String(r.date_demontage) : null,
    premontageRequis: Boolean(r.premontage_requis),
    representations: parseJsonArray(r.representations_json),
    contactCompagnieNom: r.contact_compagnie_nom != null ? String(r.contact_compagnie_nom) : null,
    contactCompagnieEmail: r.contact_compagnie_email != null ? String(r.contact_compagnie_email) : null,
    contactCompagnieTel: r.contact_compagnie_tel != null ? String(r.contact_compagnie_tel) : null,
    referentsCompagnie: parseJsonArray(r.referents_compagnie_json),
    hebergements: parseJsonArray(r.hebergements_json),
    repas: parseJsonArray(r.repas_json),
    loges: parseJsonArray(r.loges_json),
    contactsLocalCrew: parseJsonArray(r.contacts_local_crew_json),
    zonesAccueil: parseJsonArray(r.zones_accueil_json),
    transportsAccueil: parseJsonArray(r.transports_accueil_json),
    personnelAccueil: r.personnel_accueil != null ? String(r.personnel_accueil) : null,
    notesAccueil: r.notes_accueil != null ? String(r.notes_accueil) : null,
    equipe: parseJsonArray(r.equipe_json),
    planningPersonnel: parseJsonArray(r.planning_personnel_json),
    besoinsTechnique: parseJsonArray(r.besoins_technique_json),
    updatedAt: r.updated_at != null ? String(r.updated_at) : null,
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

export async function getApCapiDossierRefBySpectacleRefId(
  capiSpectacleRefId: string,
): Promise<ApCapiDossierRef | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM ap_capi_dossier_refs WHERE capi_spectacle_ref_id = ?',
    [capiSpectacleRefId],
  );
  return row ? mapDossierRow(row) : null;
}

export async function getApCapiContactRefById(id: string): Promise<ApCapiContactRef | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM ap_capi_contact_refs WHERE id = ?',
    [id],
  );
  return row ? mapContactRow(row) : null;
}
