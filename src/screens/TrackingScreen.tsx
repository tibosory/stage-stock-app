import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { format, isValid, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, SelectPicker, TabScreenSafeArea, ScreenHeader } from '../components/UI';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { getTrackingSnapshotUseCase } from '../application/usecases';
import { assignmentStatusLabel } from '../lib/tourTrackingLabels';
import type { AssignmentStatus } from '../types';

type Row = {
  materialId: string;
  materialName: string;
  assignmentQuantity: number;
  assignmentStatus: string;
  tourName: string | null;
  locationName: string | null;
  assignedTo: string | null;
  assignedAt: string;
};

function formatAssigned(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, "d MMM yyyy '·' HH:mm", { locale: fr }) : iso;
}

function statusLabel(raw: string): string {
  const allowed: AssignmentStatus[] = ['assigned', 'in_use', 'returned', 'lost', 'damaged'];
  if (allowed.includes(raw as AssignmentStatus)) {
    return assignmentStatusLabel(raw as AssignmentStatus);
  }
  return raw;
}

export default function TrackingScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRows(await getTrackingSnapshotUseCase(status));
  }, [status]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={Colors.green} />}
      >
        <ScreenHeader
          icon={<Text style={s.headerIcon}>📍</Text>}
          title="Suivi tournée"
          subtitle="Matériel lié à une tournée : filtre par statut d’affectation, tirez pour actualiser."
        />

        <Card>
          <SelectPicker
            label="Statut d’affectation"
            value={status}
            onChange={setStatus}
            options={[
              { label: 'Tous les statuts', value: 'all' },
              { label: assignmentStatusLabel('assigned'), value: 'assigned' },
              { label: assignmentStatusLabel('in_use'), value: 'in_use' },
              { label: assignmentStatusLabel('returned'), value: 'returned' },
              { label: assignmentStatusLabel('lost'), value: 'lost' },
              { label: assignmentStatusLabel('damaged'), value: 'damaged' },
            ]}
          />
        </Card>

        {rows.length === 0 ? (
          <Card>
            <Text style={s.emptyTitle}>Aucune ligne pour ce filtre</Text>
            <Text style={s.emptyBody}>
              Les affectations terminées ou les matériels hors tournée n’apparaissent pas ici selon le filtre. Ouvrez
              une tournée depuis le menu pour en ajouter, ou choisissez « Tous les statuts ».
            </Text>
          </Card>
        ) : (
          rows.map((r, i) => (
            <Card key={`${r.materialId}-${r.assignedAt}-${i}`}>
              <Text style={s.name}>{r.materialName}</Text>
              <Text style={s.sub}>Quantité : {Number(r.assignmentQuantity ?? 1) || 1}</Text>
              <Text style={s.sub}>Statut : {statusLabel(r.assignmentStatus)}</Text>
              <Text style={s.sub}>Tournée : {r.tourName ?? '—'}</Text>
              <Text style={s.sub}>Lieu : {r.locationName ?? '—'}</Text>
              <Text style={s.sub}>Réf. affectation : {r.assignedTo ?? '—'}</Text>
              <Text style={s.date}>Enregistré le {formatAssigned(r.assignedAt)}</Text>
            </Card>
          ))
        )}
      </ScrollView>
    </TabScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.xl, paddingBottom: 32 },
  headerIcon: { fontSize: 22 },
  name: { ...Typography.sectionTitle, fontSize: 17, marginBottom: 4 },
  sub: { ...Typography.bodySecondary, marginTop: 4 },
  date: { ...Typography.caption, color: Colors.textMuted, marginTop: 10 },
  emptyTitle: { ...Typography.sectionTitle, marginBottom: 8 },
  emptyBody: { ...Typography.bodySecondary, lineHeight: 21 },
});
