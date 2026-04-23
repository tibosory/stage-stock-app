import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Principe',
    body:
      'Sur le Wi‑Fi du théâtre (ou tout réseau local), un PC ou un mini‑serveur peut héberger l’API Stage Stock. ' +
      'Les téléphones sur le même Wi‑Fi utilisent alors l’adresse locale (ex. http://192.168.1.20:3000). ' +
      'Les données inventaire restent surtout dans l’app (SQLite) ; l’API sert aux synchronisations ' +
      'ou services que vous branchez côté serveur.',
  },
  {
    title: '2. Prérequis réseau',
    body:
      '• Le téléphone et le PC serveur doivent être sur le même réseau Wi‑Fi (pas d’isolement client « AP isolation » si possible).\n' +
      '• Notez l’adresse IPv4 du PC sous Windows : invite de commandes → ipconfig → « Adresse IPv4 » du Wi‑Fi.\n' +
      '• Le serveur HTTP doit écouter sur 0.0.0.0 (toutes les interfaces), pas seulement localhost, sinon les autres appareils ne joignent pas le port.',
  },
  {
    title: '3. Exemple minimal (Node + Express)',
    body:
      'Créez un dossier, npm init, puis : npm install express cors. Fichier server.js :\n\n' +
      "const express = require('express');\n" +
      "const cors = require('cors');\n" +
      'const app = express();\n' +
      "app.use(cors({ origin: true, credentials: true }));\n" +
      "app.get('/health', (_, res) => res.json({ ok: true }));\n" +
      "app.get('/', (_, res) => res.send('Stage Stock API'));\n" +
      'const PORT = process.env.PORT || 3000;\n' +
      "app.listen(PORT, '0.0.0.0', () => console.log('http://0.0.0.0:' + PORT));\n\n" +
      'Lancez : node server.js. Testez depuis le navigateur du téléphone : http://IP:3000/health',
  },
  {
    title: '4. Pare-feu Windows',
    body:
      'Autoriser le port entrant (ex. 3000) dans « Pare-feu Windows Defender » → Règles de trafic entrant → Nouvelle règle → Port → TCP → 3000 → Autoriser. Sinon les requêtes depuis le téléphone seront bloquées.',
  },
  {
    title: '5. CORS',
    body:
      'Si l’API répond mais le navigateur ou un client bloque : configurez CORS pour accepter l’origine de vos outils. ' +
      'Pour une app mobile React Native, les requêtes fetch ne sont pas soumises aux mêmes règles que le navigateur, ' +
      'mais gardez CORS correct pour d’éventuels outils web.',
  },
  {
    title: '6. Validation complète app ↔ backend',
    body:
      'Dans l’app : onglet Réseau → Enregistrer l’URL locale → Tester la connexion → Tester endpoint sync. ' +
      'Puis onglet Paramètres → Synchronisation cloud (API) → faire un test Envoyer et Recevoir. ' +
      'Si ces quatre étapes passent, l’accès backend et la mise à jour de base sont opérationnels sur le Wi‑Fi local.',
  },
  {
    title: '7. Configuration dans Stage Stock',
    body:
      'Onglet « Réseau » : saisissez l’URL de base (ex. http://192.168.1.20:3000 sans slash final). Optionnel : clé API ' +
      'si votre serveur vérifie X-API-Key / Bearer, et chemin de santé si ce n’est pas /health. Enregistrez, puis ' +
      '« Tester la connexion ». Le test réessaie plusieurs chemins (/health, /, etc.). Pour revenir à la valeur ' +
      'par défaut du build : « Réinitialiser » ou laissez le champ vide selon les boutons proposés.',
  },
  {
    title: '8. Types de connexion réseau possibles',
    body:
      'A) Wi‑Fi local (PC + téléphone sur la même box): rapide et gratuit, recommandé sur site.\n' +
      'B) Cloud public (hébergeur HTTPS, VPS, etc.) : accès depuis partout, idéal multi-sites.\n' +
      'C) Tunnel sécurisé (Cloudflare Tunnel, Tailscale Funnel, etc.): publie un serveur local sans ouvrir de port sur la box.\n' +
      'D) VPN site-à-site / Tailscale privé: accès distant privé sans exposition publique.\n' +
      'E) Hotspot temporaire (partage connexion): utile en dépannage terrain.',
  },
  {
    title: '9. HTTP sur Android',
    body:
      'L’application autorise le trafic HTTP non chiffré (cleartext) pour pouvoir joindre une API locale en http://. ' +
      'En production sur Internet, privilégiez toujours HTTPS.',
  },
  {
    title: '10. iOS et réseau local',
    body:
      'Une option réseau local est déclarée pour faciliter l’accès aux IP privées. Si une connexion échoue encore, ' +
      'vérifiez que l’URL est correcte et que le serveur écoute bien sur 0.0.0.0.',
  },
  {
    title: '11. Export et sauvegarde cloud (Google Drive, OneDrive, Dropbox)',
    body:
      'Depuis Paramètres → Import / export (Excel, CSV, ICS), l’app ouvre le partage natif du téléphone. ' +
      'Choisissez Google Drive, OneDrive, Dropbox, e-mail ou fichiers locaux. Cette méthode fonctionne sans config serveur ' +
      'spécifique et permet des sauvegardes régulières hors appareil.',
  },
  {
    title: '12. HTTPS local (optionnel, avancé)',
    body:
      'Pour du HTTPS en local (certificat de confiance), des outils comme mkcert permettent de générer un certificat ' +
      'pour une IP ou un nom local ; il faut alors installer le certificat racine sur chaque téléphone de test. ' +
      'La solution la plus simple reste souvent le HTTP sur le LAN pour un usage interne au théâtre.',
  },
];

export function GuideReseauLocalContent() {
  return (
    <View style={g.wrap}>
      {SECTIONS.map((sec, i) => (
        <View key={i} style={g.block}>
          <Text style={g.title}>{sec.title}</Text>
          <Text style={g.body}>{sec.body}</Text>
        </View>
      ))}
    </View>
  );
}

/** Mode d’emploi simplifié (aucune adresse IP ni port). */
export function GuideReseauPublicContent() {
  return (
    <View style={g.wrap}>
      <View style={g.block}>
        <Text style={g.title}>Connexion automatique</Text>
        <Text style={g.body}>
          L’application se connecte seule au service Stage Stock. Vous n’avez pas besoin de saisir d’adresse : tout se
          fait en arrière-plan lorsque le téléphone a accès à Internet ou au même réseau Wi‑Fi que votre installation.
        </Text>
      </View>
      <View style={g.block}>
        <Text style={g.title}>Si rien ne se synchronise</Text>
        <Text style={g.body}>
          Vérifiez que le Wi‑Fi est actif, que le serveur de l’organisation est démarré, et que le pare-feu de votre
          réseau n’empêche pas les connexions. Fermez puis rouvrez l’app, ou utilisez « Réessayer » dans l’onglet
          Connexion.
        </Text>
      </View>
      <View style={g.block}>
        <Text style={g.title}>Données sur le téléphone</Text>
        <Text style={g.body}>
          Votre inventaire reste disponible hors connexion sur l’appareil. La connexion sert à la synchronisation et aux
          services en ligne lorsque c’est possible.
        </Text>
      </View>
    </View>
  );
}

const g = StyleSheet.create({
  wrap: { paddingBottom: 24 },
  block: { marginBottom: 18 },
  title: { color: Colors.green, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22 },
});
