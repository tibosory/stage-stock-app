import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@stagestock_user_profile_v1';

export type UserProfile = {
  prenom: string;
  nom: string;
  telephone: string;
  email: string;
  fonction: string;
  etablissement: string;
};

function emptyProfile(): UserProfile {
  return {
    prenom: '',
    nom: '',
    telephone: '',
    email: '',
    fonction: '',
    etablissement: '',
  };
}

export async function loadUserProfile(): Promise<UserProfile> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return emptyProfile();
    const p = JSON.parse(raw) as Partial<UserProfile>;
    return { ...emptyProfile(), ...p };
  } catch {
    return emptyProfile();
  }
}

export async function saveUserProfile(p: UserProfile): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(p));
}

/** Bloc de signature pour les e-mails générés (devis, etc.). */
export function formatMailSignature(p: UserProfile): string {
  const nameLine = [p.prenom, p.nom].filter(x => x?.trim()).join(' ').trim();
  const coord = [p.telephone?.trim(), p.email?.trim()].filter(Boolean).join(' · ');
  const lines = [nameLine, p.fonction?.trim(), p.etablissement?.trim(), coord].filter(
    l => l && String(l).trim()
  );
  return lines.join('\n');
}
