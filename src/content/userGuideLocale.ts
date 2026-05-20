import type { AppLanguage } from '../i18n/strings';
import type { UserGuideSection } from './userGuideManual';
import { USER_GUIDE_META, USER_GUIDE_SECTIONS } from './userGuideManual';
import { USER_GUIDE_META_EN, USER_GUIDE_SECTIONS_EN } from './userGuideManualEn';

export type UserGuideMetaBundle = {
  title: string;
  subtitle: string;
  versionLabel: string;
};

export function getUserGuideForLanguage(lang: AppLanguage): {
  meta: UserGuideMetaBundle;
  sections: UserGuideSection[];
} {
  if (lang === 'fr') {
    return { meta: USER_GUIDE_META, sections: USER_GUIDE_SECTIONS };
  }
  return { meta: USER_GUIDE_META_EN, sections: USER_GUIDE_SECTIONS_EN };
}
