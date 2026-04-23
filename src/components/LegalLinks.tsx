import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Colors } from '../theme/colors';
import { Card } from './UI';
import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '../config/legalUrls';

function openUrl(url: string) {
  void Linking.openURL(url);
}

/** Liens juridiques pour l’écran Notice (bloc type « Block »). */
export function LegalLinksNoticeBlock() {
  const privacy = getPrivacyPolicyUrl();
  const terms = getTermsOfServiceUrl();
  if (!privacy && !terms) return null;
  return (
    <View style={n.block}>
      <Text style={n.blockTitle}>Confidentialité & conditions</Text>
      <Text style={n.p}>
        Les documents suivants sont publiés par l’éditeur. Ils complètent cette notice d’interface.
      </Text>
      {privacy ? (
        <Pressable
          onPress={() => openUrl(privacy)}
          accessibilityRole="link"
          accessibilityLabel="Ouvrir la politique de confidentialité dans le navigateur"
          style={n.row}
        >
          <Text style={n.link}>Politique de confidentialité</Text>
        </Pressable>
      ) : null}
      {terms ? (
        <Pressable
          onPress={() => openUrl(terms)}
          accessibilityRole="link"
          accessibilityLabel="Ouvrir les conditions générales d’utilisation dans le navigateur"
          style={n.row}
        >
          <Text style={n.link}>Conditions générales d’utilisation</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Carte « Juridique » pour Paramètres (masquée si aucune URL configurée). */
export function LegalLinksParamsCard() {
  const privacy = getPrivacyPolicyUrl();
  const terms = getTermsOfServiceUrl();
  if (!privacy && !terms) return null;
  return (
    <Card style={{ marginBottom: 32 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Text style={{ fontSize: 16 }}>⚖️</Text>
        <Text style={p.sectionTitle}>Juridique</Text>
      </View>
      <Text style={p.hint}>Documents publiés sur le web (HTTPS).</Text>
      {privacy ? (
        <Pressable
          onPress={() => openUrl(privacy)}
          accessibilityRole="link"
          accessibilityLabel="Politique de confidentialité"
          style={p.row}
        >
          <Text style={p.link}>Politique de confidentialité</Text>
        </Pressable>
      ) : null}
      {terms ? (
        <Pressable
          onPress={() => openUrl(terms)}
          accessibilityRole="link"
          accessibilityLabel="Conditions générales d’utilisation"
          style={p.row}
        >
          <Text style={p.link}>Conditions d’utilisation</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const n = StyleSheet.create({
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
  row: { paddingVertical: 6 },
  link: {
    color: Colors.blue,
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

const p = StyleSheet.create({
  sectionTitle: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  hint: { color: Colors.textMuted, fontSize: 12, marginBottom: 10 },
  row: { paddingVertical: 8 },
  link: {
    color: Colors.blue,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
