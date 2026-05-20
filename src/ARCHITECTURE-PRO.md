# Architecture Pro (offline-first)

Ce dossier décrit la trajectoire de refactor vers une architecture production:

- `core/` : logique métier pure (moteur stock, règles NL).
- `services/` : intégrations externes (IA, sync, API).
- `db/` : accès données locale + cache mémoire.
- `ui/` : hooks et composants de présentation.
- `utils/` : helpers purs (format, validation, etc.) au fil des migrations.

## Règles

1. Pas de logique métier dans les écrans UI.
2. La base locale reste prioritaire (offline-first).
3. Les modules IA sont optionnels, asynchrones et non bloquants.
4. Les lectures fréquentes passent par une couche cache dédiée.

## Flux recherche (v1)

1. `ui/hooks/useHybridMaterialSearch` déclenche la recherche.
2. `db/materialRepository` fournit un snapshot local mis en cache.
3. `core/rules/queryRuleEngine` parse la requête texte en filtre structuré.
4. `core/stock/stockEngine` renvoie les résultats locaux instantanés.
5. `services/ai/aiWorker` + `services/ai/AIService` enrichissent en arrière-plan.

Ce flux est la référence pour migrer les autres modules écran par écran.
