import type { AppLanguage } from './strings';
import type { TranslateVars } from './strings';
import { tForLanguage } from './strings';

let currentLanguage: AppLanguage = 'fr';

export function getRuntimeLanguage(): AppLanguage {
  return currentLanguage;
}

export function setRuntimeLanguage(lang: AppLanguage): void {
  currentLanguage = lang;
}

export function tRuntime(key: string, vars?: TranslateVars): string {
  return tForLanguage(currentLanguage, key, vars);
}

