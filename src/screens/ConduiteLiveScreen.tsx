import React, { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useKeepAwake } from 'expo-keep-awake';
import { FullScreenSafeArea } from '../components/UI';
import { COULEURS_TOP, LABELS_LOCALISATION_TOP, LABELS_TYPE_TOP } from '../types';
import type { Conduite, Top } from '../types';
import { getConduite, listTops, resetTopsEffectues, toggleTopEffectue } from '../db/conduiteDb';

/**
 * Mode live plein écran pour la régie pendant la représentation.
 * Priorité absolue à la lisibilité en pénombre : fond noir, gros texte, contraste élevé.
 */
export default function ConduiteLiveScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const conduiteId: string = route.params?.conduiteId;

  // Empêche la mise en veille pendant toute la durée du mode live (régie).
  useKeepAwake();

  const [conduite, setConduite] = useState<Conduite | null>(null);
  const [tops, setTops] = useState<Top[]>([]);
  const [index, setIndex] = useState(0);

  const load = useCallback(async () => {
    const [c, t] = await Promise.all([getConduite(conduiteId), listTops(conduiteId)]);
    setConduite(c);
    setTops(t);
    const firstNotDone = t.findIndex(top => !top.effectue);
    setIndex(firstNotDone >= 0 ? firstNotDone : 0);
  }, [conduiteId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const current = tops[index] ?? null;
  const prev = index > 0 ? tops[index - 1] : null;
  const next = index < tops.length - 1 ? tops[index + 1] : null;
  const accent = useMemo(() => (current ? COULEURS_TOP[current.departement] : COULEURS_TOP.autre), [current]);

  const goPrev = () => setIndex(i => Math.max(0, i - 1));
  const goNext = () => setIndex(i => Math.min(tops.length - 1, i + 1));

  const markDone = async () => {
    if (!current) return;
    const newVal = !current.effectue;
    setTops(ts => ts.map((t, i) => (i === index ? { ...t, effectue: newVal } : t)));
    await toggleTopEffectue(current.id, newVal);
    if (newVal && index < tops.length - 1) goNext();
  };

  const quit = () => {
    Alert.alert('Quitter le mode Live', 'Réinitialiser les tops « effectués » ?', [
      { text: 'Garder l’état', onPress: () => navigation.goBack() },
      {
        text: 'Réinitialiser',
        style: 'destructive',
        onPress: () => void resetTopsEffectues(conduiteId).then(() => navigation.goBack()),
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  return (
    <FullScreenSafeArea style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle} numberOfLines={1}>
          {conduite?.titre ?? 'Conduite'}
        </Text>
        <TouchableOpacity onPress={quit} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Quitter le mode live">
          <Text style={s.quit}>✕ Quitter</Text>
        </TouchableOpacity>
      </View>

      {/* Top précédent */}
      <View style={s.peek}>
        {prev ? (
          <Text style={[s.peekText, prev.effectue && s.peekDone]} numberOfLines={1}>
            ↑ {prev.numero} · {prev.minutage || '—'} · {prev.description}
          </Text>
        ) : (
          <Text style={s.peekMuted}>— début —</Text>
        )}
      </View>

      {/* Top courant */}
      <View style={s.current}>
        {current ? (
          <>
            <Text style={s.currentTop}>
              TOP {current.numero}
              {current.minutage ? `  ·  ${current.minutage}` : ''}
            </Text>
            {current.localisation ? (
              <Text style={s.currentLoc}>📍 {LABELS_LOCALISATION_TOP[current.localisation]}</Text>
            ) : null}
            {current.repere ? <Text style={s.currentRepere}>{current.repere}</Text> : null}
            {current.action ? <Text style={s.currentAction}>{current.action}</Text> : null}
            <Text style={s.currentDesc}>{current.description}</Text>
            {current.detail ? <Text style={s.currentDetail}>{current.detail}</Text> : null}
            <View style={[s.depDot, { backgroundColor: accent.border }]}>
              <Text style={s.depDotText}>{LABELS_TYPE_TOP[current.departement]}</Text>
            </View>
            {current.effectue ? <Text style={s.doneFlag}>✓ effectué</Text> : null}
          </>
        ) : (
          <Text style={s.currentDesc}>Aucun top dans cette conduite.</Text>
        )}
      </View>

      {/* Top suivant */}
      <View style={s.peek}>
        {next ? (
          <Text style={s.peekText} numberOfLines={1}>
            ↓ {next.numero} · {next.minutage || '—'} · {next.description}
          </Text>
        ) : (
          <Text style={s.peekMuted}>— fin —</Text>
        )}
      </View>

      {/* Navigation */}
      <View style={s.nav}>
        <TouchableOpacity style={[s.navBtn, index === 0 && s.navBtnDisabled]} onPress={goPrev} disabled={index === 0} accessibilityRole="button" accessibilityLabel="Top précédent">
          <Text style={s.navBtnText}>◀</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.doneBtn, current?.effectue && s.doneBtnActive]} onPress={() => void markDone()} disabled={!current} accessibilityRole="button" accessibilityLabel="Marquer effectué">
          <Text style={s.doneBtnText}>✓ EFFECTUÉ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.navBtn, index >= tops.length - 1 && s.navBtnDisabled]} onPress={goNext} disabled={index >= tops.length - 1} accessibilityRole="button" accessibilityLabel="Top suivant">
          <Text style={s.navBtnText}>▶</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.progress}>
        {tops.length > 0 ? `${index + 1} / ${tops.length}` : '0 / 0'}
      </Text>
    </FullScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  headerTitle: { color: '#9CA3AF', fontSize: 14, flex: 1, marginRight: 12 },
  quit: { color: '#9CA3AF', fontSize: 14, fontWeight: '700' },
  peek: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18 },
  peekText: { color: '#D1D5DB', fontSize: 18 },
  peekDone: { color: '#6B7280', textDecorationLine: 'line-through' },
  peekMuted: { color: '#4B5563', fontSize: 16, fontStyle: 'italic' },
  current: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  currentTop: { color: '#F9FAFB', fontSize: 34, fontWeight: '800', letterSpacing: 1, marginBottom: 12, textAlign: 'center' },
  currentLoc: { color: '#9CA3AF', fontSize: 22, fontWeight: '700', marginBottom: 14, textAlign: 'center' },
  currentRepere: { color: '#FCD34D', fontSize: 30, fontWeight: '800', textAlign: 'center', lineHeight: 38, marginBottom: 16 },
  currentAction: { color: '#FFFFFF', fontSize: 44, fontWeight: '900', textAlign: 'center', lineHeight: 50, marginBottom: 12 },
  currentDesc: { color: '#D1D5DB', fontSize: 28, fontWeight: '700', textAlign: 'center', lineHeight: 34 },
  currentDetail: { color: '#E5E7EB', fontSize: 24, textAlign: 'center', marginTop: 22, lineHeight: 32 },
  depDot: { marginTop: 28, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  depDotText: { color: '#000', fontSize: 16, fontWeight: '800' },
  doneFlag: { color: '#34D399', fontSize: 20, fontWeight: '800', marginTop: 16 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingTop: 10 },
  navBtn: { width: 76, height: 76, borderRadius: 18, backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center' },
  navBtnDisabled: { opacity: 0.35 },
  navBtnText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  doneBtn: { flex: 1, height: 76, borderRadius: 18, backgroundColor: '#065F46', alignItems: 'center', justifyContent: 'center' },
  doneBtnActive: { backgroundColor: '#10B981' },
  doneBtnText: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  progress: { color: '#6B7280', fontSize: 14, textAlign: 'center', paddingVertical: 14 },
});
