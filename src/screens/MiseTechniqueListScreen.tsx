import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Card, Input, ScreenHeader, TabScreenSafeArea } from '../components/UI';
import { Colors, Shadow } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import type { MiseTechnique } from '../types';
import { createMiseTechnique, listMisesTechniques } from '../db/miseTechniqueDb';
import { triggerSyncAfterActionIfEnabled } from '../lib/syncAfterAction';

export default function MiseTechniqueListScreen() {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<MiseTechnique[]>([]);
  const [nomSpectacle, setNomSpectacle] = useState('');
  const [titre, setTitre] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setItems(await listMisesTechniques());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const create = async () => {
    setCreating(true);
    try {
      const created = await createMiseTechnique({ nomSpectacle: nomSpectacle.trim(), titre: titre.trim() });
      setNomSpectacle('');
      setTitre('');
      await load();
      void triggerSyncAfterActionIfEnabled();
      navigation.navigate('MiseTechniqueDetail', { miseId: created.id });
    } catch (e: unknown) {
      const { Alert } = await import('react-native');
      Alert.alert('Création impossible', e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          icon={<Text style={s.headerIcon}>🗺️</Text>}
          title="Mise technique"
          subtitle="Préparez l’implantation des accessoires et décors à chaque étape, photos à l’appui."
        />

        <Card>
          <Text style={s.step}>Nouvelle mise technique</Text>
          <Input label="Spectacle" value={nomSpectacle} onChangeText={setNomSpectacle} placeholder="Ex. Le Cid — Tournée 2026" />
          <Input label="Titre" value={titre} onChangeText={setTitre} placeholder="Ex. Implantation — Tournée 2026" />
          <TouchableOpacity
            style={[s.createBtn, creating && s.createBtnDisabled]}
            onPress={() => void create()}
            disabled={creating}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Créer la mise technique"
          >
            <Text style={s.createBtnText}>{creating ? 'Création…' : 'Créer la mise technique'}</Text>
          </TouchableOpacity>
        </Card>

        <Text style={s.section}>Vos mises techniques</Text>
        {items.length === 0 ? (
          <Card>
            <Text style={s.emptyTitle}>Aucune mise technique</Text>
            <Text style={s.emptyBody}>Créez votre première mise technique avec le formulaire ci-dessus.</Text>
          </Card>
        ) : (
          items.map(item => (
            <Card key={item.id} onPress={() => navigation.navigate('MiseTechniqueDetail', { miseId: item.id })}>
              <Text style={s.name} numberOfLines={2}>
                {item.titre?.trim() || 'Sans titre'}
              </Text>
              <Text style={s.sub}>{item.nomSpectacle?.trim() || '—'}</Text>
              <Text style={s.tapHint}>
                {item.etapesCount ?? 0} étape{(item.etapesCount ?? 0) > 1 ? 's' : ''} · Ouvrir →
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </TabScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.xl, paddingBottom: 40 },
  headerIcon: { fontSize: 22 },
  step: { ...Typography.sectionTitle, marginBottom: Spacing.md },
  section: { ...Typography.label, marginTop: Spacing.lg, marginBottom: Spacing.sm, paddingHorizontal: 4 },
  name: { ...Typography.sectionTitle },
  sub: { ...Typography.bodySecondary, marginTop: 2 },
  tapHint: { ...Typography.caption, marginTop: 10, color: Colors.green },
  emptyTitle: { ...Typography.sectionTitle, marginBottom: 8 },
  emptyBody: { ...Typography.bodySecondary },
  createBtn: {
    marginTop: 4,
    backgroundColor: Colors.green,
    borderRadius: 14,
    paddingVertical: 16,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  createBtnDisabled: { opacity: 0.75 },
  createBtnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
});
