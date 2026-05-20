import React, { useCallback, useLayoutEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { Card, SelectPicker, TabScreenSafeArea } from '../components/UI';
import { Colors } from '../theme/colors';
import { listActivityLogsUseCase, listToursUseCase } from '../application/usecases';
import { MaterialService } from '../application/services';
import type { ActivityLog, ActivityLogType, Materiel, Tour } from '../types';

const TYPE_LABELS: Record<ActivityLogType, string> = {
  ASSIGNED: 'Affectation',
  MOVED: 'Déplacement',
  RETURNED: 'Retour',
  DAMAGED: 'Problème / abîmé',
  CHECKED: 'Contrôle / utilisation',
};

export default function ActivityLogScreen() {
  const route = useRoute<any>();
  const [tourFilter, setTourFilter] = useState('');

  useLayoutEffect(() => {
    const id = typeof route.params?.tourId === 'string' ? route.params.tourId.trim() : '';
    if (id) setTourFilter(id);
  }, [route.params?.tourId]);
  const [materialFilter, setMaterialFilter] = useState('');
  const [tours, setTours] = useState<Tour[]>([]);
  const [materials, setMaterials] = useState<Materiel[]>([]);
  const [rows, setRows] = useState<ActivityLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [t, m, logs] = await Promise.all([
      listToursUseCase(),
      MaterialService.listAll(),
      listActivityLogsUseCase({
        tourId: tourFilter.trim() || undefined,
        materialId: materialFilter.trim() || undefined,
      }),
    ]);
    setTours(t);
    setMaterials(m);
    setRows(logs);
  }, [tourFilter, materialFilter]);

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

  const tourPickerOptions = [
    { label: 'Toutes les tournées', value: '' },
    ...tours.map(t => ({ label: t.name, value: t.id })),
  ];
  const materialPickerOptions = [
    { label: 'Tous les matériels', value: '' },
    ...materials.map(m => ({ label: m.nom, value: m.id })),
  ];

  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={Colors.green} />
        }
      >
        <Card>
          <Text style={s.title}>Journal d’activité (tournées)</Text>
          <Text style={s.intro}>
            Filtres par libellé (comme sur les fiches). Les entrées affichent le nom du matériel, de la tournée et du lieu
            lorsque c’est possible.
          </Text>
          <SelectPicker label="Tournée" value={tourFilter} options={tourPickerOptions} onChange={setTourFilter} />
          <SelectPicker label="Matériel" value={materialFilter} options={materialPickerOptions} onChange={setMaterialFilter} />
        </Card>
        {rows.map(log => (
          <Card key={log.id}>
            <Text style={s.name}>{TYPE_LABELS[log.type] ?? log.type}</Text>
            <Text style={s.sub}>
              Matériel : {log.materialName?.trim() ? log.materialName : log.materialId}
            </Text>
            <Text style={s.sub}>
              Tournée : {log.tourName?.trim() ? log.tourName : log.tourId ?? '—'}
            </Text>
            <Text style={s.sub}>
              Lieu : {log.locationName?.trim() ? log.locationName : log.locationId ?? '—'}
            </Text>
            <Text style={s.sub}>Utilisateur : {log.userId ?? '—'}</Text>
            <Text style={s.sub}>Horodatage : {log.timestamp}</Text>
            {!!log.note && <Text style={s.sub}>Note : {log.note}</Text>}
          </Card>
        ))}
      </ScrollView>
    </TabScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  title: { color: Colors.white, fontWeight: '800', fontSize: 16, marginBottom: 8 },
  intro: { color: Colors.textMuted, fontSize: 13, marginBottom: 12, lineHeight: 18 },
  name: { color: Colors.white, fontWeight: '700' },
  sub: { color: Colors.textMuted, marginTop: 4 },
});
