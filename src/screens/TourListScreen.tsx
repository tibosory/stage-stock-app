import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, DateField, Input, ScreenHeader, TabScreenSafeArea } from '../components/UI';
import { Colors, Shadow } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { createTourUseCase, listToursUseCase } from '../application/usecases';
import type { Tour } from '../types';
import { tourStatusColor, tourStatusLabel } from '../lib/tourTrackingLabels';
import { showTourLifecycleMenu } from '../lib/tourLifecyclePrompt';
import { createTourFlightcases, deleteTour } from '../db/trackingDb';
import { useLanguage } from '../context/LanguageContext';

function formatTourDate(iso: string): string {
  const d = parseISO(`${iso.trim()}T12:00:00`);
  return isValid(d) ? format(d, 'd MMMM yyyy', { locale: fr }) : iso;
}

export default function TourListScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<Tour[]>([]);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [flightcaseTotal, setFlightcaseTotal] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setItems(await listToursUseCase());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const createTour = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const created = await createTourUseCase({ name: name.trim(), startDate, status: 'planned' });
      const total = Math.floor(Number(flightcaseTotal) || 0);
      if (total > 0) {
        await createTourFlightcases({ tourId: created.id, totalCases: Math.min(200, total) });
      }
      setName('');
      setFlightcaseTotal('');
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const { Alert } = await import('react-native');
      Alert.alert(t('tour.list.createError'), msg);
    } finally {
      setCreating(false);
    }
  };

  const confirmDeleteTour = useCallback(
    (item: Tour) => {
      Alert.alert(
        t('tour.list.deleteTitle'),
        t('tour.list.deleteBody', { name: item.name }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('tour.list.deleteConfirm'),
            style: 'destructive',
            onPress: () => {
              void deleteTour(item.id)
                .then(() => {
                  Alert.alert(t('common.success'), t('tour.list.deleteDone'));
                  void load();
                })
                .catch((e: unknown) => {
                  Alert.alert(t('tour.list.deleteFail'), e instanceof Error ? e.message : String(e));
                });
            },
          },
        ]
      );
    },
    [load, t]
  );

  const openTourQuickActions = useCallback(
    (item: Tour) => {
      Alert.alert(t('tour.list.quickActionsTitle'), item.name, [
        { text: t('tour.list.quickOpenDetail'), onPress: () => navigation.navigate('TourDetail', { tourId: item.id }) },
        { text: t('tour.list.quickChangeState'), onPress: () => showTourLifecycleMenu(item, load) },
        { text: t('tour.list.quickDelete'), style: 'destructive', onPress: () => confirmDeleteTour(item) },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    },
    [confirmDeleteTour, load, navigation, t]
  );

  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          icon={<Text style={s.headerIcon}>🎪</Text>}
          title={t('tour.list.title')}
          subtitle={t('tour.list.subtitle')}
        />

        <Card>
          <Text style={s.step}>{t('tour.list.new')}</Text>
          <Input
            label={t('tour.list.nameLabel')}
            value={name}
            onChangeText={setName}
            placeholder={t('tour.list.namePlaceholder')}
          />
          <DateField label={t('tour.list.startDate')} value={startDate} onChange={setStartDate} />
          <Input
            label={t('tour.list.flightcaseCount')}
            value={flightcaseTotal}
            onChangeText={setFlightcaseTotal}
            keyboardType="number-pad"
            placeholder="ex. 8"
          />
          <TouchableOpacity
            style={[s.createBtn, creating && s.createBtnDisabled]}
            onPress={() => void createTour()}
            disabled={creating}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('tour.list.create')}
          >
            {creating ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={s.createBtnText}>{t('tour.list.create')}</Text>
            )}
          </TouchableOpacity>
        </Card>

        <Text style={s.section}>{t('tour.list.yours')}</Text>
        {items.length === 0 ? (
          <Card>
            <Text style={s.emptyTitle}>{t('tour.list.emptyTitle')}</Text>
            <Text style={s.emptyBody}>{t('tour.list.emptyBody')}</Text>
          </Card>
        ) : (
          items.map(item => (
            <Card key={item.id}>
              <TouchableOpacity
                onPress={() => navigation.navigate('TourDetail', { tourId: item.id })}
                onLongPress={() => openTourQuickActions(item)}
                delayLongPress={280}
                activeOpacity={0.88}
              >
                <View style={s.rowTop}>
                  <Text style={s.name} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <View style={[s.pill, { borderColor: tourStatusColor(item.status) }]}>
                    <Text style={[s.pillText, { color: tourStatusColor(item.status) }]}>{tourStatusLabel(item.status)}</Text>
                  </View>
                </View>
                <Text style={s.sub}>
                  {t('tour.list.start')} : {formatTourDate(item.startDate)}
                  {item.endDate ? ` · ${t('tour.list.end')} : ${formatTourDate(item.endDate)}` : ''}
                </Text>
                <Text style={s.tapHint}>{t('tour.list.tapHint')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.statusRow}
                onPress={() => showTourLifecycleMenu(item, load)}
                accessibilityRole="button"
                accessibilityLabel={`Changer le statut de la tournée ${item.name}`}
              >
                <Text style={s.statusRowText}>{t('tour.list.changeState')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.deleteRow}
                onPress={() => confirmDeleteTour(item)}
                accessibilityRole="button"
                accessibilityLabel={t('tour.list.delete')}
              >
                <Text style={s.deleteRowText}>{t('tour.list.delete')}</Text>
              </TouchableOpacity>
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
  step: {
    ...Typography.sectionTitle,
    marginBottom: Spacing.md,
  },
  section: {
    ...Typography.label,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingHorizontal: 4,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: 6,
  },
  name: { ...Typography.sectionTitle, flex: 1, minWidth: 0 },
  pill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { fontSize: 12, fontWeight: '700' },
  sub: { ...Typography.bodySecondary, marginTop: 2 },
  tapHint: { ...Typography.caption, marginTop: 10, color: Colors.green },
  statusRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  statusRowText: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' },
  deleteRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(248, 113, 113, 0.25)',
  },
  deleteRowText: { ...Typography.caption, color: Colors.red, fontWeight: '700' },
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
