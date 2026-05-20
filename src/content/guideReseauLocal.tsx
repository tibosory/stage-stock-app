import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';

const SECTIONS_FR: { title: string; body: string }[] = [
  {
    title: '0. Installation facile (comme une recette)',
    body:
      'Objectif: installer le serveur local sans connaissance informatique.\n\n' +
      'Etape A: sur le telephone, appuyez "Installer le serveur sur PC".\n' +
      'Etape B: sur le PC, ouvrez le fichier telecharge puis cliquez "Suivant", "Installer", "Terminer".\n' +
      'Etape C: lancez "StageStock Local" depuis le bureau du PC.\n' +
      'Etape D: sur le telephone, scannez le QR affiche par le PC.\n' +
      'Etape E: appuyez sur "Tester la connexion".\n\n' +
      'Si vous etes perdu, retenez juste ceci: 1) installer l EXE, 2) ouvrir StageStock Local, 3) scanner le QR.',
  },
  {
    title: '1. Principe',
    body:
      'Sur le Wi‑Fi du théâtre (ou tout réseau local), un PC ou un mini‑serveur peut héberger l’API CATRACK Pro. ' +
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
      "app.get('/', (_, res) => res.send('CATRACK Pro API'));\n" +
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
    title: '7. Configuration dans CATRACK Pro',
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

const SECTIONS_EN: { title: string; body: string }[] = [
  {
    title: '0. Easy setup (recipe style)',
    body:
      'Goal: install the local server with no advanced IT skills.\n\n' +
      'Step A: on phone, tap "Install server on PC".\n' +
      'Step B: on PC, open the downloaded file and click "Next", "Install", "Finish".\n' +
      'Step C: launch "StageStock" from the PC desktop.\n' +
      'Step D: on phone, scan the QR shown by the PC.\n' +
      'Step E: tap "Test connection".\n\n' +
      'If unsure, remember this: 1) install EXE, 2) open StageStock, 3) scan QR.',
  },
  {
    title: '1. Principle',
    body:
      'On theater Wi-Fi (or any LAN), a PC or mini-server can host the CATRACK Pro API. ' +
      'Phones on the same Wi-Fi then use the local address (e.g. http://192.168.1.20:3000). ' +
      'Inventory data mainly stays in the app (SQLite); the API is used for synchronization ' +
      'or services connected server-side.',
  },
  {
    title: '2. Network requirements',
    body:
      '• Phone and server PC must be on the same Wi-Fi (disable AP isolation if possible).\n' +
      '• Note the PC IPv4 address on Windows: command prompt -> ipconfig -> Wi-Fi "IPv4 Address".\n' +
      '• HTTP server must listen on 0.0.0.0 (all interfaces), not just localhost.',
  },
  {
    title: '3. Minimal example (Node + Express)',
    body:
      'Create a folder, npm init, then: npm install express cors. server.js:\n\n' +
      "const express = require('express');\n" +
      "const cors = require('cors');\n" +
      'const app = express();\n' +
      "app.use(cors({ origin: true, credentials: true }));\n" +
      "app.get('/health', (_, res) => res.json({ ok: true }));\n" +
      "app.get('/', (_, res) => res.send('CATRACK Pro API'));\n" +
      'const PORT = process.env.PORT || 3000;\n' +
      "app.listen(PORT, '0.0.0.0', () => console.log('http://0.0.0.0:' + PORT));\n\n" +
      'Run: node server.js. Test from phone browser: http://IP:3000/health',
  },
];

export function GuideReseauLocalContent() {
  const { language } = useLanguage();
  const sections = language === 'en' ? SECTIONS_EN : SECTIONS_FR;
  return (
    <View style={g.wrap}>
      {sections.map((sec, i) => (
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
  const { language } = useLanguage();
  const isEn = language === 'en';
  return (
    <View style={g.wrap}>
      <View style={g.block}>
        <Text style={g.title}>
          {isEn ? 'Install local server (very simple)' : 'Installer le serveur local (tres simple)'}
        </Text>
        <Text style={g.body}>
          {isEn
            ? '1) On phone, open Connection then tap "Install server on PC".\n2) On PC, open the downloaded file and click "Next", "Install", "Finish".\n3) On PC, open StageStock from the desktop.\n4) On phone, scan the QR shown by PC.\n5) Tap "Test connection". Done.'
            : '1) Sur le telephone, ouvrez Connexion puis touchez "Installer le serveur sur PC".\n2) Sur le PC, ouvrez le fichier telecharge et cliquez "Suivant", "Installer", "Terminer".\n3) Sur le PC, ouvrez StageStock depuis le bureau.\n4) Sur le telephone, scannez le QR affiche par le PC.\n5) Touchez "Tester la connexion". C est fini.'}
        </Text>
      </View>
      <View style={g.block}>
        <Text style={g.title}>{isEn ? 'Automatic connection' : 'Connexion automatique'}</Text>
        <Text style={g.body}>
          {isEn
            ? 'The app can connect automatically to CATRACK Pro service. You do not need to type an address: everything runs in background when the phone has Internet access or is on the same Wi-Fi as your installation.'
            : 'L’application se connecte seule au service CATRACK Pro. Vous n’avez pas besoin de saisir d’adresse : tout se fait en arrière-plan lorsque le téléphone a accès à Internet ou au même réseau Wi-Fi que votre installation.'}
        </Text>
      </View>
      <View style={g.block}>
        <Text style={g.title}>{isEn ? 'If nothing syncs' : 'Si rien ne se synchronise'}</Text>
        <Text style={g.body}>
          {isEn
            ? 'Check Wi-Fi is enabled, the organization server is running, and firewall rules are not blocking connections. Close and reopen the app, or tap "Retry" in the Connection tab.'
            : 'Verifiez que le Wi-Fi est actif, que le serveur de l’organisation est demarre, et que le pare-feu de votre reseau n’empeche pas les connexions. Fermez puis rouvrez l’app, ou utilisez "Reessayer" dans l’onglet Connexion.'}
        </Text>
      </View>
      <View style={g.block}>
        <Text style={g.title}>{isEn ? 'Data on phone' : 'Donnees sur le telephone'}</Text>
        <Text style={g.body}>
          {isEn
            ? 'Your inventory remains available offline on the device. Connection is used for synchronization and online services when available.'
            : 'Votre inventaire reste disponible hors connexion sur l’appareil. La connexion sert a la synchronisation et aux services en ligne lorsque c’est possible.'}
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
