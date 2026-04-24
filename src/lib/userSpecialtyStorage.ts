import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_SPECIALTY_ID,
  type SpecialtyId,
  isSpecialtyId,
} from '../config/specialties';

const K = 'stagestock_user_specialty_v1';

export async function getUserSpecialty(): Promise<SpecialtyId> {
  try {
    const raw = (await AsyncStorage.getItem(K))?.trim();
    if (raw && isSpecialtyId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_SPECIALTY_ID;
}

export async function setUserSpecialty(id: SpecialtyId): Promise<void> {
  await AsyncStorage.setItem(K, id);
}
