import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'stagestock_association_portal_profile_v1';

export type OrganizationDocumentCategoryDraft = {
  id: string;
  label?: string;
};

export type AssociationProfileLocal = {
  name: string;
  type: string;
  siret: string;
  address: string;
  cp: string;
  city: string;
  website: string;
  contactName: string;
  email: string;
  phone: string;
  notes: string;
  hasPrimaryContact?: boolean;
  documentCategories: OrganizationDocumentCategoryDraft[];
  linkedOrganizationId?: string | null;
};

const defaultProfile = (): AssociationProfileLocal => ({
  name: '',
  type: '',
  siret: '',
  address: '',
  cp: '',
  city: '',
  website: '',
  contactName: '',
  email: '',
  phone: '',
  notes: '',
  hasPrimaryContact: false,
  documentCategories: [],
});

export async function loadAssociationProfileLocal(): Promise<AssociationProfileLocal> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw) as Partial<AssociationProfileLocal>;
    return { ...defaultProfile(), ...parsed, documentCategories: parsed.documentCategories ?? [] };
  } catch {
    return defaultProfile();
  }
}

export async function saveAssociationProfileLocal(profile: AssociationProfileLocal): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export type AssociationChecklistSnapshot = Record<string, unknown>;

/** Alimentation de la grille checklist portail association (minimal). */
export function associationProfileToChecklistSnapshot(
  profile: AssociationProfileLocal,
  documents: Array<{ category?: string | null }>
): AssociationChecklistSnapshot {
  return {
    name: profile.name,
    siret: profile.siret,
    addressFilled: !!(profile.address?.trim() && profile.cp?.trim() && profile.city?.trim()),
    contactFilled: !!(profile.contactName?.trim() && profile.email?.trim() && profile.phone?.trim()),
    documentCategoriesPresent: documents.length > 0,
    documents,
  };
}
