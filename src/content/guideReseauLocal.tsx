import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';

const SECTIONS_FR: { title: string; body: string }[] = [
  {
    title: 'Installation en 4 étapes (débutant)',
    body:
      '1) Sur le téléphone : téléchargez l’installateur serveur Windows.\n' +
      '2) Transférez-le sur le PC et double-cliquez : Suivant → Installer → Terminer.\n' +
      '3) Lancez « StageStock Local » depuis le bureau du PC.\n' +
      '4) Sur le téléphone : dans l’assistant (ou Réseau), appuyez sur « Scanner le QR d’appairage » et visez le QR du PC.\n\n' +
      'En résumé : télécharger → installer sur le PC → ouvrir StageStock Local → scanner le QR. C’est tout.',
  },
  {
    title: 'Principe',
    body:
      'CATRACK Pro enregistre d’abord vos données sur le téléphone. Pour les partager avec l’équipe, un PC serveur ' +
      'doit tourner dans votre organisation. Le téléphone et le PC se connectent sur le même Wi‑Fi (ou via Tailscale à distance).',
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
      'Dans l’app : assistant ou onglet Réseau → « Scanner le QR d’appairage » (ou scan depuis l’onglet Scanner) → Envoyer ↑ / Recevoir ↓ pour synchroniser.',
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
      'Step D: on phone, tap "Scan pairing QR code" in setup (or scan from Scanner tab).\n\n' +
      'If unsure, remember this: 1) install EXE, 2) open StageStock Local, 3) scan pairing QR.',
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
            ? '1) On your phone, open Network and download the Windows server.\n2) On the PC, run the installer: Next → Install → Finish.\n3) Open StageStock Local from the desktop.\n4) Tap Scan pairing QR code in setup and point at the PC QR. Done.'
            : '1) Sur le téléphone : ouvrez Réseau et téléchargez le serveur Windows.\n2) Sur le PC : lancez l’installateur → Suivant → Installer → Terminer.\n3) Ouvrez StageStock Local depuis le bureau.\n4) Appuyez sur « Scanner le QR d’appairage » et visez le QR du PC. C’est terminé.'}
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

const SECTIONS_SUPABASE_FR: { title: string; body: string }[] = [
  {
    title: 'Principe',
    body:
      'En mode Supabase, inventaire, prêts et Accueil Pro sont synchronisés via Internet. ' +
      'Aucun PC serveur n’est nécessaire : il vous faut une connexion Internet et un projet Supabase configuré.',
  },
  {
    title: 'Configuration',
    body:
      'Tuile Connexion (accueil ou ALL → Connexion) : choisissez « Serveur local sur PC » ou « Cloud Supabase », puis synchronisez avec ↑ Envoyer / ↓ Recevoir. ' +
      'Le même choix est aussi disponible dans Utilisateur → Projet Supabase. URL + clé anon : Paramètres utilisateur ou écran Connexion en mode Supabase.',
  },
  {
    title: 'Première synchronisation',
    body:
      'Cartes « Synchronisation inventaire » et « Accueil Pro » : Envoyer ↑ pousse vos modifications, Recevoir ↓ récupère le cloud. ' +
      'Tous les téléphones de l’équipe doivent être en mode Supabase.',
  },
  {
    title: 'Invitations portail (Accueil Pro)',
    body:
      'Le staff peut inviter une association depuis Accueil Pro → fiche Organisation → Inviter au portail cloud. ' +
      'L’invité saisit le code à la connexion, se connecte avec le même e-mail, puis appuie sur Finaliser.',
  },
];

const SECTIONS_SUPABASE_EN: { title: string; body: string }[] = [
  {
    title: 'Overview',
    body:
      'In Supabase mode, inventory, loans and Accueil Pro sync over the Internet. ' +
      'No PC server is needed — only an Internet connection and a configured Supabase project.',
  },
  {
    title: 'Setup',
    body:
      'Connection tile (home or ALL → Connection): choose “Local PC server” or “Supabase cloud”, then sync with ↑ Push / ↓ Pull. ' +
      'The same switch is on User → Supabase project. URL + anon key: user profile or Connection screen in Supabase mode.',
  },
  {
    title: 'First sync',
    body:
      'Use the Inventory sync and Accueil Pro cards: Push ↑ sends your changes, Pull ↓ receives from the cloud. All team phones must use Supabase mode.',
  },
  {
    title: 'Portal invitations (Accueil Pro)',
    body:
      'Staff can invite an association from Accueil Pro → Organization → Invite to cloud portal. ' +
      'The invitee enters the code at sign-in, signs in with the same e-mail, then taps Finalize.',
  },
];

export function GuideReseauSupabaseContent() {
  const { language } = useLanguage();
  const sections = language === 'en' ? SECTIONS_SUPABASE_EN : SECTIONS_SUPABASE_FR;
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

const g = StyleSheet.create({
  wrap: { paddingBottom: 24 },
  block: { marginBottom: 18 },
  title: { color: Colors.green, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22 },
});
