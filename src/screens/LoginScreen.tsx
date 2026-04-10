import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { listAppUsersForLogin } from '../db/database';
import { AppUserRole } from '../types';

export default function LoginScreen() {
  const { login } = useAuth();
  const [users, setUsers] = useState<{ id: string; nom: string; role: AppUserRole }[]>([]);
  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listAppUsersForLogin().then(u => {
      setUsers(u);
      if (u.length === 1) setUserId(u[0].id);
      setLoading(false);
    });
  }, []);

  const handleLogin = async () => {
    if (!userId || !pin) {
      Alert.alert('Connexion', 'Choisissez un utilisateur et saisissez le code PIN.');
      return;
    }
    setSubmitting(true);
    const ok = await login(userId, pin);
    setSubmitting(false);
    if (!ok) {
      Alert.alert('Connexion', 'PIN incorrect.');
      setPin('');
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={Colors.green} size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Stage Stock</Text>
      <Text style={s.sub}>Connexion — PIN à 4 chiffres (admin par défaut : 1234)</Text>

      <Text style={s.label}>Utilisateur</Text>
      <View style={s.chips}>
        {users.map(u => (
          <TouchableOpacity
            key={u.id}
            style={[s.chip, userId === u.id && s.chipOn]}
            onPress={() => setUserId(u.id)}
          >
            <Text style={[s.chipTxt, userId === u.id && s.chipTxtOn]}>
              {u.nom} · {u.role}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Code PIN</Text>
      <TextInput
        style={s.input}
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={12}
        placeholder="••••"
        placeholderTextColor={Colors.textMuted}
      />

      <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.btnTxt}>Se connecter</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, backgroundColor: Colors.bg, padding: 24, paddingTop: 80 },
  title: { color: Colors.white, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  sub: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 32 },
  label: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
  },
  chipOn: { borderColor: Colors.green, backgroundColor: Colors.greenBg },
  chipTxt: { color: Colors.textSecondary, fontSize: 13 },
  chipTxtOn: { color: Colors.green },
  input: {
    backgroundColor: Colors.bgInput, borderRadius: 12, padding: 14, fontSize: 18,
    color: Colors.white, borderWidth: 1, borderColor: Colors.border, marginBottom: 24,
    letterSpacing: 4,
  },
  btn: {
    backgroundColor: Colors.green, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  btnTxt: { color: Colors.white, fontWeight: '700', fontSize: 16 },
});
