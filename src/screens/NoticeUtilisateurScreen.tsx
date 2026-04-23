// src/screens/NoticeUtilisateurScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { Colors } from '../theme/colors';
import { ScreenHeader, TabScreenSafeArea } from '../components/UI';
import { LegalLinksNoticeBlock } from '../components/LegalLinks';

const CONTACT_EMAIL = 'tibosory@gmail.com';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.block}>
      <Text style={s.blockTitle}>{title}</Text>
      {children}
    </View>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={s.p}>{children}</Text>;
}

export default function NoticeUtilisateurScreen() {
  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator>
        <ScreenHeader
          icon={<Text style={{ fontSize: 22 }}>📖</Text>}
          title="Notice utilisateur"
        />

        <View style={s.creditCard}>
          <Text style={s.creditLabel}>Réalisation</Text>
          <Text style={s.creditName}>Thibaut Sory</Text>
          <Text style={s.creditSub}>
            Conception et développement de l’application Stage Stock pour le suivi du matériel, des consommables
            et des prêts au théâtre.
          </Text>
          <Text style={s.creditContactLabel}>Pour contacter le développeur</Text>
          <Pressable
            onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
            accessibilityRole="link"
            accessibilityLabel={`Envoyer un e-mail à ${CONTACT_EMAIL}`}
          >
            <Text style={s.emailLink}>{CONTACT_EMAIL}</Text>
          </Pressable>
          <Text style={s.creditMeta}>
            Notice d’interface — avril 2026 : assistant 1er lancement, PDF fiches matériel, rafale + pavé, tests
            notif / mail
          </Text>
        </View>

        <Block title="Premier lancement (une fois par installation)">
          <P>
            Après la connexion, un assistant peut proposer de préremplir l’essentiel : identité du lieu, URL du
            serveur, vos coordonnées. Rien d’obligatoire : vous pouvez tout passer ; tout reste modifiable dans
            Paramètres, Réseau et Utilisateur.
          </P>
        </Block>

        <Block title="À quoi sert Stage Stock ?">
          <P>
            Application d’inventaire avec base de données sur l’appareil (SQLite) : matériel, consommables, prêts,
            contrôles VGP. Vous pouvez brancher un serveur HTTP Stage Stock (sur PC, NAS, VPS…) pour synchroniser
            l’inventaire entre appareils ; l’URL se configure dans l’onglet Réseau ou au build (EXPO_PUBLIC_API_URL).
            Optionnellement, un projet Supabase (URL + clé anon saisies sur l’appareil ou au build) peut servir
            pour l’authentification, des notices sur stockage, ou d’autres fonctions selon votre déploiement.
          </P>
        </Block>

        <Block title="Projet Supabase (optionnel)">
          <P>
            Dans Paramètres → Projet Supabase (cet appareil), vous pouvez saisir l’URL du projet et la clé « anon »
            publique (Supabase → Project Settings → API). Cela permet à chaque organisation d’utiliser son propre
            backend sans reconstruire l’APK. Activez le RLS (Row Level Security) sur vos tables. Si vous n’utilisez pas
            Supabase, vous pouvez ignorer ce bloc.
          </P>
        </Block>

        <Block title="Connexion & rôles">
          <P>
            À l’ouverture, choisissez votre nom et votre code PIN à quatre chiffres. En cas d’oubli, un administrateur
            peut réinitialiser l’accès dans Paramètres → Utilisateurs & rôles.
          </P>
          <P>
            Les profils équipe (admin / technicien) voient tous les onglets métier. Le profil emprunteur propose une
            barre d’onglets réduite : Prêts, IA, Notice, Connexion (ou Réseau), Paramètres et Compte — centrée sur les
            demandes et le suivi de prêt.
          </P>
        </Block>

        <Block title="Scanner & Stock">
          <P>
            L’onglet Scanner lit un QR code ou une puce NFC pour ouvrir une fiche matériel, avec mode lot pour
            enchaîner des codes. Pour les consommables, le mode rafale permet des entrées / sorties rapides ; vous
            pouvez activer un pavé numérique à chaque article pour saisir la quantité exacte avant validation.
          </P>
          <P>
            L’onglet Stock : recherche, filtres, fiches matériel avec photo, ajout / modification (selon les droits),
            impression d’étiquettes QR (y compris en lot). Fiche matériel PDF (A4) : depuis la fiche détail, ou dans
            la liste par appui long sur un article puis sélection de plusieurs fiches et « PDF fiches » — chaque page
            inclut la photo, les infos et un QR d’identification.
          </P>
        </Block>

        <Block title="Prêts & demandes">
          <P>
            Les feuilles de prêt enregistrent les sorties. Un emprunteur peut créer une demande (« en demande ») ;
            un administrateur la traite (onglet Demandes si activé), valide ou refuse, puis le prêt passe « en cours ».
            L’emprunteur peut signaler un retour. Vous pouvez joindre une signature électronique sur la feuille ; le
            PDF exporté affiche la signature en noir sur fond blanc pour une lecture nette.
          </P>
        </Block>

        <Block title="Consommables & historique">
          <P>
            Les consommables suivent les quantités et les seuils d’alerte. L’onglet Historique retrace les mouvements
            avec filtres par type, période et recherche.
          </P>
        </Block>

        <Block title="Alertes & VGP">
          <P>
            Alertes regroupe stocks bas, prêts en retard, maintenance et échéances VGP. L’onglet VGP détaille les
            équipements soumis à contrôles périodiques.
          </P>
        </Block>

        <Block title="IA">
          <P>
            L’onglet IA propose un assistant sur votre stock et vos prêts lorsque le backend expose ce service ; en
            build « tout public », des limites peuvent s’appliquer sans serveur dédié.
          </P>
        </Block>

        <Block title="Paramètres">
          <P>
            PDF (logo, entête), alertes, bénéficiaires, utilisateurs et rôles, projet Supabase (URL + clé anon), écran
            Utilisateur (identité, entête des PDF), tests de connexion et synchronisation inventaire (Envoyer /
            Recevoir), import / export, étiquettes rayonnage. Les notifications locales servent aux rappels (prêts, VGP,
            seuils) : les profils autorisés peuvent lancer des tests (notification locale, push vers l’équipe, e-mail via
            le serveur SMTP) pour vérifier le bon fonctionnement.
          </P>
          <P>
            Comptes PIN (écran Utilisateurs et rôles) : avec l’API HTTP configurée, un profil administrateur peut
            pousser la liste des comptes vers le serveur (↑ Envoyer) ; les autres téléphones la récupèrent (↓ Recevoir).
            Les jetons de notification restent propres à chaque appareil. Détail technique : voir le README du dossier
            backend du projet.
          </P>
        </Block>

        <Block title="Connexions réseau possibles">
          <P>
            Wi‑Fi local (PC serveur et téléphone sur le même réseau), serveur HTTPS accessible sur Internet (VPS,
            hébergeur, etc.), tunnel (Cloudflare Tunnel, etc.) ou VPN. Le mode local est adapté au théâtre ; le cloud
            permet l’accès distant.
          </P>
        </Block>

        <Block title="Détection du serveur sur le réseau local">
          <P>
            Tant que l’URL configurée répond, l’application l’utilise. Si le serveur défini au build ne répond pas
            (ou n’est pas défini), une recherche HTTP automatique peut proposer une adresse locale (ports courants 3847
            et 3000, priorité au sous-réseau Wi‑Fi de l’appareil). Vous pouvez aussi ouvrir l’onglet Connexion / Réseau
            et utiliser le bouton « Auto-détecter le serveur (LAN) » pour relancer la recherche, ou saisir l’URL à la
            main (ex. http://192.168.x.x:3847).
          </P>
        </Block>

        <Block title="Valider le Wi‑Fi avec le backend">
          <P>
            1) Le backend tourne sur le PC en écoute sur toutes les interfaces (0.0.0.0), port défini dans le fichier
            .env du serveur (souvent 3847 ; autre numéro possible : pare-feu et URL dans l’app en conséquence). Si le
            démarrage indique un port déjà utilisé, un autre programme occupe ce port : libérez-le ou changez la ligne
            PORT= dans le .env du serveur. 2) Téléphone et PC sur le même Wi‑Fi. 3) Connexion / Réseau : enregistrer
            l’URL, tester la connexion puis l’endpoint sync. 4) Paramètres : synchronisation — Envoyer puis Recevoir.
            Si tout passe, la base est à jour via l’API.
          </P>
        </Block>

        <Block title="Serveur sur un poste fixe (optionnel)">
          <P>
            Si votre organisation héberge l’API Stage Stock sur un PC ou un serveur, suivez sa procédure interne
            (pare-feu, base PostgreSQL, démarrage du service). L’application mobile ne propose pas de téléchargement
            d’installateur depuis Internet.
          </P>
          <P>
            Sur le téléphone (même Wi‑Fi que le serveur) : onglet Connexion / Réseau — auto-détection ou saisie de
            l’URL, puis tests de connexion et synchronisation dans Paramètres lorsque l’API est joignable.
          </P>
        </Block>

        <Block title="Données & sauvegarde">
          <P>
            Les données résident sur l’appareil. Utilisez les exports et la synchronisation prévus par votre
            organisation pour éviter toute perte lors d’un changement de téléphone. Les exports (Excel, CSV, ICS)
            passent par le partage système (Drive, OneDrive, e-mail, etc.).
          </P>
        </Block>

        <LegalLinksNoticeBlock />

        <View style={s.footer}>
          <Text style={s.footerText}>
            Stage Stock — notice d’information à usage du personnel autorisé. Pour le détail réseau avancé, voir aussi
            l’aide dans l’onglet Connexion / Réseau.
          </Text>
          <Pressable
            onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
            style={s.footerEmailWrap}
            accessibilityRole="link"
            accessibilityLabel={`Contacter par e-mail : ${CONTACT_EMAIL}`}
          >
            <Text style={s.footerEmail}>{CONTACT_EMAIL}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </TabScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  creditCard: {
    backgroundColor: Colors.greenBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.green,
  },
  creditLabel: { color: Colors.textMuted, fontSize: 12, marginBottom: 4 },
  creditName: { color: Colors.white, fontSize: 20, fontWeight: '800' },
  creditSub: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22, marginTop: 10 },
  creditContactLabel: { color: Colors.textMuted, fontSize: 12, marginTop: 14, marginBottom: 6 },
  emailLink: {
    color: Colors.blue,
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  creditMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 12 },
  block: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  blockTitle: { color: Colors.green, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  p: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 10 },
  footer: { marginTop: 8, paddingVertical: 16, alignItems: 'center' },
  footerText: { color: Colors.textMuted, fontSize: 12, textAlign: 'center' },
  footerEmailWrap: { marginTop: 12, paddingVertical: 4 },
  footerEmail: { color: Colors.blue, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
});
