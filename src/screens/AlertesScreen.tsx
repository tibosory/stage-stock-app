// src/screens/AlertesScreen.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, SectionList, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import { getConsommablesAlerte, getPrets, getMaterielsPourMaintenanceAlertes } from '../db/database';
import { Consommable, Pret, Materiel } from '../types';
import { Card } from '../components/UI';

type AlerteRow =
  | { type: 'pret'; data: Pret }
  | { type: 'conso'; data: Consommable }
  | { type: 'maint'; data: Materiel };

type AlerteSection = { title: string; data: AlerteRow[] };

function formatDateCourt(raw: string | undefined): string {
  if (!raw) return '';
  const d = raw.includes('T') ? parseISO(raw) : parseISO(`${raw}T12:00:00`);
  if (!isValid(d)) return raw;
  return format(d, 'd MMM yyyy', { locale: fr });
}

export default function AlertesScreen() {
  const [consoBas, setConsoBas] = useState<Consommable[]>([]);
  const [pretsRetard, setPretsRetard] = useState<Pret[]>([]);
  const [maint, setMaint] = useState<Materiel[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [conso, prets, matMaint] = await Promise.all([
      getConsommablesAlerte(),
      getPrets(),
      getMaterielsPourMaintenanceAlertes(30),
    ]);
    setConsoBas(conso);
    setMaint(matMaint);
    const today = new Date().toISOString().split('T')[0];
    setPretsRetard(
      prets.filter(
        p =>
          (p.statut === 'en cours' || p.statut === 'en retard') &&
          p.retour_prevu &&
          p.retour_prevu < today
      )
    );
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const total = consoBas.length + pretsRetard.length + maint.length;

  const sections = useMemo(() => {
    const out: AlerteSection[] = [];
    if (pretsRetard.length) {
      out.push({
        title: 'PRÊTS EN RETARD',
        data: pretsRetard.map(p => ({ type: 'pret' as const, data: p })),
      });
    }
    if (consoBas.length) {
      out.push({
        title: 'STOCKS CONSOMMABLES FAIBLES',
        data: consoBas.map(c => ({ type: 'conso' as const, data: c })),
      });
    }
    if (maint.length) {
      out.push({
        title: 'MAINTENANCE / VALIDITÉ (30 J)',
        data: maint.map(m => ({ type: 'maint' as const, data: m })),
      });
    }
    return out;
  }, [pretsRetard, consoBas, maint]);

  return (
    <SafeAreaView style={s.container}>
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
        <View style={s.header}>
          <Text style={{ fontSize: 22, color: Colors.green }}>🔔</Text>
          <Text style={s.title}>Alertes</Text>
          {total > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{total}</Text>
            </View>
          )}
        </View>
      </View>

      {total === 0 ? (
        <View style={[s.empty, { paddingHorizontal: 20 }]}>
          <Text style={{ fontSize: 48 }}>✅</Text>
          <Text style={{ color: Colors.textMuted, marginTop: 12, fontSize: 16 }}>Aucune alerte</Text>
          <Text style={{ color: Colors.textMuted, marginTop: 4, fontSize: 13 }}>
            Prêts à jour, stocks consommables et maintenance OK
          </Text>
        </View>
      ) : (
        <SectionList<AlerteRow, AlerteSection>
          sections={sections}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.green} />}
          keyExtractor={(item: AlerteRow) => `${item.type}-${item.data.id}`}
          renderSectionHeader={({ section }: { section: AlerteSection }) => (
            <Text style={s.sectionLabel}>
              {section.title.startsWith('PRÊTS') ? '⚠️ ' : section.title.startsWith('MAINT') ? '🔧 ' : '📦 '}
              {section.title}
              {(section.title.startsWith('STOCKS') || section.title.startsWith('MAINT')) ? ` (${section.data.length})` : ''}
            </Text>
          )}
          renderItem={({ item }: { item: AlerteRow }) => {
            if (item.type === 'maint') {
              const m = item.data;
              return (
                <Card style={[s.alertCard, { borderColor: Colors.yellow }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 20 }}>🔧</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.alertName}>{m.nom}</Text>
                      <Text style={s.alertSub}>
                        {m.date_validite ? `Validité : ${formatDateCourt(m.date_validite)} · ` : ''}
                        {m.prochain_controle ? `Contrôle : ${formatDateCourt(m.prochain_controle)}` : ''}
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            }
            if (item.type === 'pret') {
              const pret = item.data;
              return (
                <Card style={s.alertCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 20 }}>⚠️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.alertName}>{pret.emprunteur}</Text>
                      <Text style={s.alertSub}>
                        Retour prévu : {formatDateCourt(pret.retour_prevu)}
                        {pret.organisation ? ` · ${pret.organisation}` : ''}
                      </Text>
                    </View>
                    <View style={[s.pill, { backgroundColor: Colors.red }]}>
                      <Text style={s.pillText}>En retard</Text>
                    </View>
                  </View>
                </Card>
              );
            }

            const conso = item.data;
            const isEmpty = conso.stock_actuel === 0;
            return (
              <Card style={s.alertCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 20 }}>⚠️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.alertName}>{conso.nom}</Text>
                    <Text style={s.alertSub}>{conso.reference ?? ' '}</Text>
                  </View>
                  <View style={[s.pill, { backgroundColor: isEmpty ? Colors.red : Colors.yellow }]}>
                    <Text style={s.pillText}>{conso.stock_actuel} / {conso.seuil_minimum}</Text>
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  title: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  badge: {
    backgroundColor: Colors.red, borderRadius: 12,
    minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  badgeText: { color: Colors.white, fontSize: 12, fontWeight: '800' },
  sectionLabel: {
    color: Colors.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 1, marginBottom: 10,
  },
  alertCard: { borderWidth: 1, borderColor: Colors.red },
  alertName: { color: Colors.white, fontSize: 15, fontWeight: '600' },
  alertSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 48 },
});
