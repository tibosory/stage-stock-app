import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Card, Input, ScreenHeader, SelectPicker, TabScreenSafeArea } from '../components/UI';
import { Colors, Shadow } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { COULEURS_TOP, LABELS_DEPARTEMENT } from '../types';
import type { Conduite, DepartementConduite } from '../types';
import { createConduite, listConduites } from '../db/conduiteDb';
import { triggerSyncAfterActionIfEnabled } from '../lib/syncAfterAction';

const DEPARTEMENT_OPTIONS: { label: string; value: DepartementConduite }[] = [
  { label: 'Générale (tous départements)', value: 'generale' },
  { label: 'Lumière', value: 'lumiere' },
  { label: 'Son', value: 'son' },
  { label: 'Plateau', value: 'plateau' },
  { label: 'Vidéo', value: 'video' },
];

const FILTRES: { label: string; value: DepartementConduite | 'tous' }[] = [
  { label: 'Tous', value: 'tous' },
  { label: 'Lumière', value: 'lumiere' },
  { label: 'Son', value: 'son' },
  { label: 'Plateau', value: 'plateau' },
  { label: 'Vidéo', value: 'video' },
  { label: 'Générale', value: 'generale' },
];

/** Couleur d’accent d’un département (réutilise la palette des tops). */
function departementAccent(dep: DepartementConduite): string {
  if (dep === 'generale') return Colors.green;
  return COULEURS_TOP[dep].border;
}

export default function ConduiteListScreen() {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<Conduite[]>([]);
  const [filtre, setFiltre] = useState<DepartementConduite | 'tous'>('tous');
  const [nomSpectacle, setNomSpectacle] = useState('');
  const [titre, setTitre] = useState('');
  const [departement, setDepartement] = useState<DepartementConduite>('generale');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setItems(await listConduites());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const create = async () => {
    setCreating(true);
    try {
      const created = await createConduite({
        nomSpectacle: nomSpectacle.trim(),
        titre: titre.trim(),
        departement,
      });
      setNomSpectacle('');
      setTitre('');
      setDepartement('generale');
      await load();
      void triggerSyncAfterActionIfEnabled();
      navigation.navigate('ConduiteDetail', { conduiteId: created.id });
    } catch (e: unknown) {
      const { Alert } = await import('react-native');
      Alert.alert('Création impossible', e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const filtered = useMemo(
    () => (filtre === 'tous' ? items : items.filter(c => c.departement === filtre)),
    [items, filtre]
  );

  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          icon={<Text style={s.headerIcon}>🎬</Text>}
          title="Conduites techniques"
          subtitle="Préparez et pilotez en live la régie d’un spectacle (lumière, son, plateau)."
        />

        <Card>
          <Text style={s.step}>Nouvelle conduite</Text>
          <Input
            label="Spectacle"
            value={nomSpectacle}
            onChangeText={setNomSpectacle}
            placeholder="Ex. Le Cid — Tournée 2026"
          />
          <Input
            label="Titre de la conduite"
            value={titre}
            onChangeText={setTitre}
            placeholder="Ex. Conduite Lumière — Acte 1"
          />
          <SelectPicker
            label="Département"
            value={departement}
            options={DEPARTEMENT_OPTIONS}
            onChange={v => setDepartement(v as DepartementConduite)}
          />
          <TouchableOpacity
            style={[s.createBtn, creating && s.createBtnDisabled]}
            onPress={() => void create()}
            disabled={creating}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Créer la conduite"
          >
            <Text style={s.createBtnText}>{creating ? 'Création…' : 'Créer la conduite'}</Text>
          </TouchableOpacity>
        </Card>

        <View style={s.filterRow}>
          {FILTRES.map(f => (
            <TouchableOpacity
              key={f.value}
              style={[s.chip, filtre === f.value && s.chipActive]}
              onPress={() => setFiltre(f.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: filtre === f.value }}
            >
              <Text style={[s.chipText, filtre === f.value && s.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.section}>Vos conduites</Text>
        {filtered.length === 0 ? (
          <Card>
            <Text style={s.emptyTitle}>Aucune conduite</Text>
            <Text style={s.emptyBody}>Créez votre première conduite avec le formulaire ci-dessus.</Text>
          </Card>
        ) : (
          filtered.map(item => (
            <Card key={item.id} onPress={() => navigation.navigate('ConduiteDetail', { conduiteId: item.id })}>
              <View style={s.rowTop}>
                <Text style={s.name} numberOfLines={2}>
                  {item.titre?.trim() || 'Sans titre'}
                </Text>
                <View style={[s.pill, { borderColor: departementAccent(item.departement) }]}>
                  <Text style={[s.pillText, { color: departementAccent(item.departement) }]}>
                    {LABELS_DEPARTEMENT[item.departement]}
                  </Text>
                </View>
              </View>
              <Text style={s.sub}>{item.nomSpectacle?.trim() || '—'}</Text>
              <Text style={s.tapHint}>
                {item.topsCount ?? 0} top{(item.topsCount ?? 0) > 1 ? 's' : ''} · Ouvrir →
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
  section: { ...Typography.label, marginTop: Spacing.sm, marginBottom: Spacing.sm, paddingHorizontal: 4 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: Spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: Colors.greenBg, borderColor: Colors.green },
  chipText: { ...Typography.caption, color: Colors.textSecondary },
  chipTextActive: { color: Colors.green, fontWeight: '700' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md, marginBottom: 6 },
  name: { ...Typography.sectionTitle, flex: 1, minWidth: 0 },
  pill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
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
