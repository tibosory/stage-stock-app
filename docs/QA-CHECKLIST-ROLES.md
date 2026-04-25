# Checklist QA - Comptes utilisateurs

Date test: ____ / ____ / ______
Testeur: ______________________
Build: ________________________

## 1) Préparation

- [ ] APK installée sur téléphone de test
- [ ] Base locale initialisée
- [ ] 3 comptes disponibles: `admin`, `technicien`, `emprunteur`
- [ ] Réseau Wi-Fi + 4G testables
- [ ] (Option) serveur local StageStock actif

---

## 2) Connexion / session

### Admin
- [ ] Login PIN admin OK
- [ ] Déconnexion / reconnexion OK
- [ ] Session persistée après relance app

### Technicien
- [ ] Login PIN technicien OK
- [ ] Déconnexion / reconnexion OK

### Emprunteur
- [ ] Login PIN emprunteur OK
- [ ] Déconnexion / reconnexion OK

---

## 3) Permissions par rôle

### Admin
- [ ] Gestion utilisateurs accessible
- [ ] Paramètres sync accessibles
- [ ] Édition inventaire autorisée

### Technicien
- [ ] Paramètres sync accessibles
- [ ] Édition inventaire autorisée
- [ ] Gestion utilisateurs non-admin absente/bloquée

### Emprunteur
- [ ] Écrans prêts accessibles
- [ ] Actions d'administration bloquées
- [ ] Actions d'édition inventaire bloquées

---

## 4) Réseau ONLINE/OFFLINE

- [ ] Passage online -> log `ONLINE`
- [ ] Passage offline -> log `OFFLINE`
- [ ] Retour online déclenche reprise auto de sync

---

## 5) Switch "Synchro double backend"

### Switch OFF
- [ ] Basculer OFF dans Réseau
- [ ] Créer un mouvement
- [ ] Vérifier: aucune requête API locale envoyée

### Switch ON
- [ ] Basculer ON dans Réseau
- [ ] Créer un mouvement
- [ ] Vérifier: API locale + Supabase traitées selon disponibilité

---

## 6) Queue offline + retry

### Hors ligne
- [ ] Couper réseau
- [ ] Créer 3 mouvements
- [ ] Aucune perte: éléments en queue

### Retour réseau
- [ ] Réactiver réseau
- [ ] Flush automatique lancé
- [ ] Queue se vide
- [ ] Pas de doublons en base (idempotence)

---

## 7) Flux métier principaux

### Stock
- [ ] Créer / modifier / supprimer matériel
- [ ] Détail matériel affichage complet

### Consommables
- [ ] Entrée stock
- [ ] Sortie stock
- [ ] Historique mouvements cohérent

### Prêts
- [ ] Créer prêt
- [ ] Retour prêt
- [ ] Statuts mis à jour correctement

### Scanner
- [ ] Scan QR matériel
- [ ] Scan QR consommable
- [ ] NFC (si appareil compatible)

---

## 8) Synchronisation manuelle

- [ ] Bouton Envoyer (push) fonctionne
- [ ] Bouton Recevoir (pull) fonctionne
- [ ] Messages d'erreur clairs en cas d'échec

---

## 9) Régressions UI / stabilité

- [ ] Aucun crash pendant 10 minutes d'usage continu
- [ ] Navigation tabs/écrans fluide
- [ ] Pas de blocage sur modales/retours
- [ ] Performances correctes (pas de freeze long)

---

## 10) Résultat final

- [ ] GO (prêt prod)
- [ ] NO GO

Commentaires / anomalies:

1. ______________________________________________________
2. ______________________________________________________
3. ______________________________________________________

