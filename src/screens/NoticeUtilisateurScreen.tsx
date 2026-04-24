// src/screens/NoticeUtilisateurScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { Colors, Shadow } from '../theme/colors';
import { ScreenHeader, TabScreenSafeArea } from '../components/UI';
import { LegalLinksNoticeBlock } from '../components/LegalLinks';

const CONTACT_EMAIL = 'tibosory@gmail.com';

const SECTIONS: { icon: string; title: string; paragraphs: string[] }[] = [
  {
    icon: '🚀',
    title: 'Premier lancement',
    paragraphs: [
      'Après la connexion, l’assistant de démarrage peut préremplir le lieu, le serveur et votre profil. Rien n’est obligatoire : chaque étape est passable.',
      'Tous les réglages restent modifiables ensuite dans Paramètres, Réseau et Utilisateur.',
    ],
  },
  {
    icon: '📦',
    title: 'Stock, Scanner, Consommables',
    paragraphs: [
      'Scanner ouvre rapidement les fiches via QR/NFC. Le mode rafale permet des entrées/sorties rapides avec saisie de quantité.',
      'Stock propose recherche, filtres, édition (selon droits), étiquettes QR et export PDF des fiches matériel.',
      'Consommables suit les seuils et l’historique des mouvements.',
    ],
  },
  {
    icon: '🧾',
    title: 'Prêts et demandes',
    paragraphs: [
      'Les prêts suivent le cycle en demande → en cours → retourné. Les retours peuvent être signalés côté emprunteur.',
      'Signature électronique et PDF de feuille de prêt sont inclus.',
    ],
  },
  {
    icon: '🛎️',
    title: 'Alertes, VGP, notifications',
    paragraphs: [
      'Alertes centralise stocks bas, retards, maintenance et échéances de contrôle VGP.',
      'Les notifications locales aident pour les rappels prêts/VGP/seuils. Des tests push/e-mail sont disponibles selon profil.',
    ],
  },
  {
    icon: '🌐',
    title: 'Réseau et synchronisation',
    paragraphs: [
      'Vous pouvez utiliser un serveur Stage Stock local (Wi-Fi) ou distant (HTTPS/VPN/tunnel).',
      'L’app sait auto-détecter un serveur LAN, sinon URL saisie manuellement. Ensuite, test de connexion puis sync.',
      'Supabase reste optionnel selon votre organisation.',
    ],
  },
  {
    icon: '💾',
    title: 'Sauvegarde',
    paragraphs: [
      'Les données sont locales sur l’appareil. Utilisez export/synchronisation pour sécuriser la migration vers un autre téléphone.',
    ],
  },
];

function SectionCard({ icon, title, paragraphs }: { icon: string; title: string; paragraphs: string[] }) {
  return (
    <View style={s.block}>
      <View style={s.blockHead}>
        <Text style={s.blockIcon}>{icon}</Text>
        <Text style={s.blockTitle}>{title}</Text>
      </View>
      {paragraphs.map((p, i) => (
        <Text key={`${title}-${i}`} style={s.p}>
          {p}
        </Text>
      ))}
    </View>
  );
}

export default function NoticeUtilisateurScreen() {
  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator>
        <ScreenHeader icon={<Text style={{ fontSize: 22 }}>📖</Text>} title="Notice utilisateur" />

        <View style={s.heroCard}>
          <Text style={s.heroKicker}>Bienvenue sur Stage Stock</Text>
          <Text style={s.heroTitle}>Guide rapide et rassurant</Text>
          <Text style={s.heroSub}>
            Cette notice est pensée pour démarrer vite : où cliquer, quoi configurer et comment synchroniser sans stress.
          </Text>
          <View style={s.heroPills}>
            <Text style={s.pill}>Simple</Text>
            <Text style={s.pill}>Rapide</Text>
            <Text style={s.pill}>Modifiable à tout moment</Text>
          </View>
        </View>

        <View style={s.creditCard}>
          <Text style={s.creditLabel}>Réalisation</Text>
          <Text style={s.creditName}>Thibaut Sory</Text>
          <Text style={s.creditSub}>
            Conception et développement de Stage Stock pour le suivi du matériel, des consommables et des prêts.
          </Text>
          <Pressable
            onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
            accessibilityRole="link"
            accessibilityLabel={`Envoyer un e-mail à ${CONTACT_EMAIL}`}
            style={s.contactRow}
          >
            <Text style={s.contactIcon}>✉️</Text>
            <Text style={s.emailLink}>{CONTACT_EMAIL}</Text>
          </Pressable>
          <Text style={s.creditMeta}>Mise à jour interface — avril 2026</Text>
        </View>

        {SECTIONS.map(section => (
          <SectionCard
            key={section.title}
            icon={section.icon}
            title={section.title}
            paragraphs={section.paragraphs}
          />
        ))}

        <LegalLinksNoticeBlock />

        <View style={s.footer}>
          <Text style={s.footerText}>
            Pour le détail avancé (réseau et backend), utilisez aussi l’aide de l’onglet Connexion / Réseau.
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
  scroll: { padding: 20, paddingBottom: 44 },
  heroCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.32)',
    ...Shadow.card,
  },
  heroKicker: { color: Colors.green, fontWeight: '700', fontSize: 12, letterSpacing: 0.4 },
  heroTitle: { color: Colors.white, fontSize: 22, fontWeight: '800', marginTop: 6 },
  heroSub: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22, marginTop: 8 },
  heroPills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 12 },
  pill: {
    color: Colors.green,
    backgroundColor: Colors.greenBg,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '700',
  },
  creditCard: {
    backgroundColor: Colors.greenBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.green,
  },
  creditLabel: { color: Colors.textMuted, fontSize: 12, marginBottom: 4 },
  creditName: { color: Colors.white, fontSize: 20, fontWeight: '800' },
  creditSub: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 8 },
  contactRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactIcon: { fontSize: 15 },
  emailLink: { color: Colors.blue, fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
  creditMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 10 },
  block: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  blockIcon: { fontSize: 16 },
  blockTitle: { color: Colors.green, fontSize: 16, fontWeight: '800', flex: 1 },
  p: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 8 },
  footer: { marginTop: 8, paddingVertical: 16, alignItems: 'center' },
  footerText: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  footerEmailWrap: { marginTop: 12, paddingVertical: 4 },
  footerEmail: { color: Colors.blue, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
});
