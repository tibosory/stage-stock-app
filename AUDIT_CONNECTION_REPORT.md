# Audit connexion — CATRACK Pro / StageStock

Date : 22 mai 2026  
Périmètre : chaîne complète téléphone ↔ serveur local ↔ cloud (Supabase)

---

## 1. Problèmes identifiés

### Bloquants utilisateur
| # | Problème | Gravité |
|---|----------|---------|
| B1 | **Accès app bloqué** si jumelage serveur non validé (`App.tsx` exigeait `hasVerifiedServerPairing`) | Critique |
| B2 | **Onboarding serveur obligatoire** — impossible de terminer sans ping OK (`WorkspaceOnboardingScreen`) | Critique |
| B3 | Étape serveur non skippable (contraire au message « offline-first ») | Majeur |

### UX / messages
| # | Problème | Gravité |
|---|----------|---------|
| U1 | Messages techniques (`ECONNREFUSED`, traces HTTP) affichés aux utilisateurs | Majeur |
| U2 | Pas d’écran diagnostic unifié local + cloud | Majeur |
| U3 | Lien navigateur `/pair` → `stagestock://` provoquait erreur Android | Majeur (corrigé session précédente) |

### Robustesse technique
| # | Problème | Gravité |
|---|----------|---------|
| T1 | `ConnectionContext` sans reconnexion périodique ni écoute NetInfo | Moyen |
| T2 | `SyncProfileRouter` prêt mais non branché sur la sync production (double backend possible) | Moyen |
| T3 | Tests connexion incomplets (`SyncScheduler`, LAN, pairing apply) | Moyen |
| T4 | Deux notions « online » (NetInfo vs serveur joignable) non unifiées dans l’UI | Faible |

### Cas non couverts automatiquement
- Serveur lent (timeout) — partiellement via classifier
- Token JWT expiré côté backend — test auth incomplet
- Changement de réseau Wi‑Fi — partiellement via NetInfo + foreground sync

---

## 2. Corrections réalisées

### Mode dégradé / hors ligne
- **`App.tsx`** : seul `hasCompletedWorkspaceOnboarding()` conditionne l’entrée dans l’app (plus de blocage sur le jumelage).
- **`WorkspaceOnboardingScreen`** : bouton « Continuer sans serveur (hors ligne) », fin du didacticiel possible sans serveur, étape serveur avançable sans ping.
- **`workspaceOnboardingStorage.ts`** : jumelage documenté comme recommandé, non bloquant.

### Auto-détection & reconnexion
- **`ConnectionContext.tsx`** : refresh périodique (60 s), écoute NetInfo (reconnexion → refresh + `runForegroundInventorySync`), refresh forcé au retour au premier plan.
- Logique existante conservée : `runAutoLanDiscoveryWhenUnreachable`, `SyncScheduler`, `foregroundInventorySync`.

### Messages compréhensibles
- **`userFriendlyNetworkError.ts`** : traduction ECONNREFUSED, timeout, DNS, token expiré, etc.
- **`completePairingFromScan.ts`**, **`NetworkScreen.tsx`** : alertes utilisateur via mapper friendly.

### Assistant diagnostic
- **`connectionDiagnostics.ts`** + **`ConnectionDiagnosticPanel.tsx`** : indicateurs 🟢🟠🔴 (réseau, serveur local, sync, auth, cloud config, session).
- Onglet **Diagnostic** dans **Connexion / Réseau** (consumer + pro).

### Jumelage (session précédente, rappel)
- Scan QR in-app, page `/pair` sans redirect `stagestock://` agressif, intent Android.

---

## 3. Améliorations UX

- Parcours premier démarrage : télécharger → installer → scanner QR **ou** continuer hors ligne.
- Bandeau connexion non bloquant (existant) + diagnostic actionnable (« Réparer »).
- Tests réseau avec messages simples au lieu de dumps HTTP.
- Notice utilisateur v1.0.54 alignée.

---

## 4. Fichiers modifiés / ajoutés

| Fichier | Action |
|---------|--------|
| `App.tsx` | Gate onboarding sans jumelage obligatoire |
| `src/context/ConnectionContext.tsx` | Reconnexion auto |
| `src/screens/WorkspaceOnboardingScreen.tsx` | Mode hors ligne |
| `src/lib/workspaceOnboardingStorage.ts` | Commentaire sémantique |
| `src/lib/userFriendlyNetworkError.ts` | **Nouveau** |
| `src/lib/connectionDiagnostics.ts` | **Nouveau** |
| `src/components/ConnectionDiagnosticPanel.tsx` | **Nouveau** |
| `src/screens/NetworkScreen.tsx` | Onglet diagnostic + messages |
| `src/lib/completePairingFromScan.ts` | Messages friendly |
| `src/i18n/strings.ts` | i18n diagnostic + offline |
| `src/content/userGuideManual.ts` | Notice v1.0.54 |
| `src/tests/user-friendly-network-error.spec.ts` | **Nouveau** |
| `src/tests/connection-diagnostics.spec.ts` | **Nouveau** |
| `package.json` | `test:core` étendu |
| `backend/src/pairingPageHtml.ts` | (session préc.) intent Android |

---

## 5. Points à surveiller

1. **SyncProfileRouter** : brancher sur `inventoryApiSync` / `supabaseSyncCycle` pour un seul backend actif.
2. **Tests d’intégration** : `SyncScheduler`, LAN discovery, scénarios serveur arrêté en conditions réelles.
3. **Cloud Supabase** : pas de probe reachability cloud dans le router (by design) — documenter pour les déploiements cloud-only.
4. **Rebuild APK** nécessaire pour livrer ces changements mobile.
5. **Redémarrage serveur PC** pour la page `/pair` corrigée.

---

## 6. Préparation client

| Critère | Avant audit | Après corrections |
|---------|-------------|-------------------|
| App utilisable sans serveur | ❌ Bloquée | ✅ Oui (SQLite local) |
| Premier démarrage non-technicien | ⚠️ Friction | ✅ Guidé + sortie hors ligne |
| Messages erreur | ❌ Techniques | ✅ Compréhensibles |
| Diagnostic | ⚠️ Dispersé | ✅ Écran dédié |
| Reconnexion auto | ⚠️ Partielle | ✅ Renforcée |
| Tests automatisés connexion | ⚠️ Partiels | ✅ Base étendue |

**Niveau estimé pour utilisation client réelle : 7,5/10**  
(atteignable **8,5/10** après branchement SyncProfileRouter + tests scheduler/LAN + validation terrain Wi‑Fi hétérogène)

---

## Tests exécutés

```bash
cd C:\dev\SStock\StageStock
npx tsx src/tests/user-friendly-network-error.spec.ts
npx tsx src/tests/connection-diagnostics.spec.ts
npx tsx src/tests/pairing-deep-link.spec.ts
```

Scénarios couverts par tests unitaires : messages friendly, diagnostic sans URL, device offline, serveur OK mocké, parsing QR jumelage.

Scénarios restant manuels : serveur arrêté réel, réseau coupé, réinstallation, sync interrompue, changement de box Wi‑Fi.
