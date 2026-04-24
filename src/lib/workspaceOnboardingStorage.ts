import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'stagestock_workspace_onboarding_v1_done';

/**
 * L’utilisateur a terminé (ou ignoré) l’assistant de préconfiguration.
 * N’est affiché qu’une fois par installation, jusqu’à reset des données de l’app.
 */
export async function hasCompletedWorkspaceOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setWorkspaceOnboardingCompleted(): Promise<void> {
  await AsyncStorage.setItem(KEY, '1');
}

/** Force la réapparition de l’assistant au prochain affichage de la navigation connectée. */
export async function resetWorkspaceOnboardingCompleted(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
