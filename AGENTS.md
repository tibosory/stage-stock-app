# Stage Stock — repères pour contributeurs

- **UI** : réutiliser `Typography`, `Spacing`, `Radius`, `Colors` / `Shadow` ; en-têtes d’écran via `ScreenHeader` (titre + `subtitle` quand ça clarifie le contexte).
- **Notice** : toute évolution visible pour l’utilisateur doit mettre à jour `src/content/userGuideManual.ts` (voir `.cursor/rules/stagestock-user-guide.mdc`).
- **Données** : SQLite locale d’abord ; synchro et erreurs réseau gérées sans bloquer l’usage hors ligne.
- **Diffs** : changements ciblés, pas de refactors gratuits ; textes utilisateur en français, ton sobre.
