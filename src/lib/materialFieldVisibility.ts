import type { Materiel } from '../types';

export type MaterialStatus = 'ok' | 'maintenance' | 'broken';

/** Clés techniques prédéfinies (libellés FR) — les autres clés viennent du profil dynamique (`technical_data`). */
const TECHNICAL_LABELS: Record<string, string> = {
  power: 'Puissance',
  weight: 'Poids',
  dimensions: 'Dimensions',
  connectors: 'Connecteurs',
  frequency: 'Fréquence',
  dmx_channels: 'Canaux DMX',
  resolution: 'Résolution',
  load_capacity: 'Charge admissible',
  material_type: 'Type de matière',
  consumption: 'Consommation',
  impedance: 'Impédance',
  angle: 'Angle',
  type_light_source: 'Type de source lumineuse',
  brightness: 'Luminosité',
  inputs: 'Entrées',
  latency: 'Latence',
  safety_rating: 'Indice sécurité',
  textile_type: 'Type textile',
  size: 'Taille',
  maintenance_info: 'Informations maintenance',
  fragility: 'Fragilité',
};

const PREDEFINED_TECHNICAL_KEYS = Object.keys(TECHNICAL_LABELS);

const STOCK_KEYS = ['status', 'total_quantity', 'available_quantity', 'broken_quantity'] as const;
const LOCATION_KEYS = ['location', 'flightcase', 'rack_position'] as const;

export interface MaterialEntity {
  id: string;
  name: string;
  category?: string;
  brand?: string;
  model?: string;
  internal_code?: string;
  total_quantity?: number;
  available_quantity?: number;
  broken_quantity?: number;
  status?: MaterialStatus;
  location?: string;
  flightcase?: string;
  rack_position?: string;
  technical_data: Record<string, string | number | undefined>;
}

export interface VisibleMaterialSections {
  identification: Array<{ key: keyof MaterialEntity; label: string; value?: string | number }>;
  stock: Array<{ key: string; label: string; value?: string | number }>;
  localisation: Array<{ key: string; label: string; value?: string | number }>;
  technical: Array<{ key: string; label: string; value?: string | number }>;
}

function parseTechnicalData(raw?: unknown): Record<string, string | number | undefined> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, string | number | undefined>;
    } catch {
      return {};
    }
    return {};
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, string | number | undefined>;
  return {};
}

function parseStatus(mat: Materiel): MaterialStatus {
  if (mat.statut === 'en réparation') return 'maintenance';
  if (mat.statut === 'perdu' || mat.etat === 'hors service') return 'broken';
  return 'ok';
}

function toMaterialEntity(mat: Materiel): MaterialEntity {
  const matWithJoins = mat as Materiel & { localisation_nom?: string };
  const baseTechnical = parseTechnicalData((mat as Materiel & { technical_data?: unknown }).technical_data);
  const storageBoxRaw = baseTechnical['storage_box'];
  const rackPositionRaw = baseTechnical['rack_position'];
  const maintenanceInfo = [mat.maintenance_todo, mat.maintenance_last_comment].filter(Boolean).join(' | ');
  return {
    id: mat.id,
    name: mat.nom,
    category: mat.categorie_nom ?? mat.categorie_id ?? undefined,
    brand: mat.marque ?? undefined,
    model: mat.type ?? undefined,
    internal_code: mat.qr_code ?? mat.id,
    total_quantity: 1,
    available_quantity: mat.statut === 'en stock' ? 1 : 0,
    broken_quantity: mat.etat === 'hors service' ? 1 : 0,
    status: parseStatus(mat),
    location: matWithJoins.localisation_nom ?? mat.localisation_id ?? undefined,
    flightcase:
      mat.flightcase?.trim() ||
      (typeof storageBoxRaw === 'string' && storageBoxRaw.trim() ? storageBoxRaw.trim() : undefined),
    rack_position: typeof rackPositionRaw === 'string' ? rackPositionRaw : undefined,
    technical_data: {
      ...baseTechnical,
      weight: baseTechnical.weight ?? mat.poids_kg,
      maintenance_info: baseTechnical.maintenance_info ?? (maintenanceInfo || undefined),
    },
  };
}

function labelForExtraTechnicalKey(key: string): string {
  if (/^[a-z0-9_]+$/i.test(key)) {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  return key;
}

/** Vue fiche matériel : toujours complète + champs libres issus du profil dynamique (`technical_data`). */
export function getVisibleFields(material: Materiel): VisibleMaterialSections {
  const entity = toMaterialEntity(material);
  const predefined = new Set(PREDEFINED_TECHNICAL_KEYS);

  const identification: VisibleMaterialSections['identification'] = [
    { key: 'id', label: 'ID', value: entity.id },
    { key: 'name', label: 'Nom', value: entity.name },
    { key: 'category', label: 'Catégorie', value: entity.category },
    { key: 'brand', label: 'Marque', value: entity.brand },
    { key: 'model', label: 'Modèle', value: entity.model },
    { key: 'internal_code', label: 'Code interne', value: entity.internal_code },
  ];

  const stockEntries: Record<string, string | number | undefined> = {
    status: entity.status,
    total_quantity: entity.total_quantity,
    available_quantity: entity.available_quantity,
    broken_quantity: entity.broken_quantity,
  };
  const stockLabels: Record<string, string> = {
    status: 'Statut',
    total_quantity: 'Qté totale',
    available_quantity: 'Qté disponible',
    broken_quantity: 'Qté HS',
  };
  const stock = STOCK_KEYS.map(k => ({ key: k, label: stockLabels[k], value: stockEntries[k] }));

  const localisationEntries: Record<string, string | number | undefined> = {
    location: entity.location,
    flightcase: entity.flightcase,
    rack_position: entity.rack_position,
  };
  const localisationLabels: Record<string, string> = {
    location: 'Localisation',
    flightcase: 'Flightcase / caisse',
    rack_position: 'Position rack',
  };
  const localisation = LOCATION_KEYS.map(k => ({
    key: k,
    label: localisationLabels[k],
    value: localisationEntries[k],
  }));

  const technical: VisibleMaterialSections['technical'] = PREDEFINED_TECHNICAL_KEYS.map(key => ({
    key,
    label: TECHNICAL_LABELS[key] ?? key,
    value: entity.technical_data[key],
  }));

  for (const [key, value] of Object.entries(entity.technical_data)) {
    if (predefined.has(key)) continue;
    if (key === 'storage_box' || key === 'rack_position') continue;
    if (value === undefined || value === null || value === '') continue;
    technical.push({
      key,
      label: labelForExtraTechnicalKey(key),
      value: typeof value === 'number' || typeof value === 'string' ? value : String(value),
    });
  }

  return { identification, stock, localisation, technical };
}
