import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Colors } from '../theme/colors';
import { useAppAuth } from '../context/AuthContext';
import { ScreenHeader, TabScreenSafeArea } from '../components/UI';

export default function EmprunteurCompteScreen() {
  const { user, logout } = useAppAuth();

  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          icon={<Text style={{ fontSize: 22 }}>👤</Text>}
          title="Mon compte"
        />
        <View style={s.card}>
          <Text style={s.label}>Connecté en tant que</Text>
          <Text style={s.name}>{user?.nom ?? '—'}</Text>
          <Text style={s.hint}>
            Consultation de vos prêts et création de demandes de prêt. Activez les notifications pour être
            prévenu lorsqu’une demande est acceptée.
          </Text>
        </View>
        <View style={s.card}>
          <Text style={s.p}>
            Nouvelle demande : onglet Prêts → « Nouvelle demande ». Les administrateurs sont notifiés ; après
            validation, le prêt passe en « en cours » et vous recevez une notification.
          </Text>
          <Text style={[s.p, { marginTop: 12 }]}>
            Pour signaler un retour de matériel déjà en cours, ouvrez le prêt puis « Notifier l’équipe ».
          </Text>
        </View>
        <TouchableOpacity style={s.logout} onPress={() => void logout()} activeOpacity={0.85}>
          <Text style={s.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </ScrollView>
    </TabScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: { color: Colors.textMuted, fontSize: 12, marginBottom: 4 },
  name: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  hint: { color: Colors.textSecondary, fontSize: 13, marginTop: 10, lineHeight: 20 },
  p: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22 },
  logout: {
    marginTop: 8,
    backgroundColor: Colors.red,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
});
