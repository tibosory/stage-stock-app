import type { Locale } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { fr } from 'date-fns/locale/fr';
import type { AppLanguage } from './strings';

export function getDateFnsLocale(language: AppLanguage): Locale {
  return language === 'fr' ? fr : enUS;
}

/** ICU-style tag for RN DateTimePicker `locale` when supported */
export function getDatePickerLocaleTag(language: AppLanguage): string {
  return language === 'fr' ? 'fr_FR' : 'en_US';
}
