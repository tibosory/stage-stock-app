import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AccueilProEmpty,
  AccueilProScreenLayout,
  AccueilProColors,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { Colors } from '../../theme/colors';
import { useLanguage } from '../../context/LanguageContext';
import { useAppAuth } from '../../context/AuthContext';
import {
  confirmRentalAsEvent,
  listApOrganizations,
  listApRentalRequests,
  saveApRentalRequest,
} from '../../db/accueilProDb';
import {
  findBookingConflictsForRentalValidation,
  formatBookingConflictLine,
} from '../../lib/accueilProBookingConflicts';
import { notifyAccueilProRentalDecision } from '../../lib/accueilProRentalNotifications';
import { logAccueilProAction } from '../../lib/accueilProActivityLog';
import { PermissionGuard } from '../../modules/accueilpro/components/PermissionGuard';
import type { ApRentalRequest } from '../../types/accueilPro';

export default function AccueilProRentalRequestsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const { user } = useAppAuth();
  const [rows, setRows] = useState<ApRentalRequest[]>([]);
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [reqs, orgs] = await Promise.all([listApRentalRequests(), listApOrganizations()]);
    setRows(reqs);
    const map: Record<string, string> = {};
    for (const o of orgs) map[o.id] = o.name;
    setOrgNames(map);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onValidate = (id: string) => {
    Alert.alert(t('accueilpro.requests.validateTitle'), t('accueilpro.requests.validateBody'), [
      { text: t('accueilpro.cancel'), style: 'cancel' },
      {
        text: t('accueilpro.requests.validateCta'),
        onPress: () => {
          void (async () => {
            const conflicts = await findBookingConflictsForRentalValidation(id);
            if (conflicts.length > 0) {
              const lines = conflicts.slice(0, 4).map(c => formatBookingConflictLine(c)).join('\n');
              Alert.alert(t('accueilpro.booking.validateBlocked'), lines);
              return;
            }
            const eventId = await confirmRentalAsEvent(id);
            if (eventId) {
              const row = rows.find(r => r.id === id);
              if (row) {
                await notifyAccueilProRentalDecision(row, 'validée', row.event_name);
                await logAccueilProAction({
                  action: 'rental.validated',
                  entity: 'rental_request',
                  entityId: id,
                  summary: `Demande validée : ${row.event_name ?? id}`,
                  actorName: user?.nom,
                });
              }
              Alert.alert(t('accueilpro.requests.validated'), t('accueilpro.requests.eventCreated'));
              await load();
            }
          })();
        },
      },
    ]);
  };

  const onRefuse = (id: string) => {
    Alert.alert(t('accueilpro.requests.refuseTitle'), undefined, [
      { text: t('accueilpro.cancel'), style: 'cancel' },
      {
        text: t('accueilpro.requests.refuseCta'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const row = rows.find(r => r.id === id);
            if (!row) return;
            await saveApRentalRequest({ ...row, status: 'refusée' });
            await notifyAccueilProRentalDecision({ ...row, status: 'refusée' }, 'refusée');
            await logAccueilProAction({
              action: 'rental.refused',
              entity: 'rental_request',
              entityId: id,
              summary: `Demande refusée : ${row.event_name ?? id}`,
              actorName: user?.nom,
            });
            await load();
          })();
        },
      },
    ]);
  };

  const statusColor = useMemo(
    () =>
      ({
        soumise: Colors.yellow,
        validée: Colors.green,
        refusée: Colors.red,
        annulée: Colors.textMuted,
      }) as Record<string, string>,
    []
  );

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>📋</Text>}
      headerTitle={t('accueilpro.requests.title')}
      headerRightLabel={t('accueilpro.orgs.add')}
      onHeaderRight={() => navigation.navigate('AccueilProRentalRequestEdit')}
      loading={loading}
      scroll={false}
    >
      <PermissionGuard
        staffOnly
        fallback={
          <AccueilProEmpty
            emoji="🔒"
            message={`${t('accueilpro.rbac.staffOnlyTitle')}\n${t('accueilpro.rbac.staffOnlyBody')}`}
          />
        }
      >
        <FlatList
        data={rows}
        keyExtractor={item => item.id}
        contentContainerStyle={[apStyles.list, { paddingBottom: 48 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={AccueilProColors.primary}
          />
        }
        ListEmptyComponent={<AccueilProEmpty message={t('accueilpro.requests.empty')} />}
        renderItem={({ item }) => (
          <View style={[apStyles.row, { alignItems: 'flex-start', flexWrap: 'wrap', columnGap: 8 }]}>
            <TouchableOpacity
              style={{ flex: 1, minWidth: 120 }}
              onPress={() => navigation.navigate('AccueilProRentalRequestEdit', { id: item.id })}
              activeOpacity={0.85}
            >
              <Text style={apStyles.rowTitle}>{item.event_name || orgNames[item.organization_id] || '—'}</Text>
              <Text style={apStyles.rowMeta}>
                {item.date_debut}
                {item.heure_debut ? ` · ${item.heure_debut}` : ''}
              </Text>
              <Text
                style={[
                  apStyles.rowMeta,
                  { color: statusColor[item.status] ?? Colors.textPrimary, fontWeight: '700' },
                ]}
              >
                {item.status}
              </Text>
            </TouchableOpacity>
            {item.status === 'soumise' ?
              <View style={[apStyles.rowActions, { marginLeft: 'auto' }]}>
                <TouchableOpacity onPress={() => onValidate(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={apStyles.actionOk}>{t('accueilpro.requests.validateCta')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onRefuse(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={apStyles.actionNo}>{t('accueilpro.requests.refuseCta')}</Text>
                </TouchableOpacity>
              </View>
            : null}
          </View>
        )}
      />
      </PermissionGuard>
    </AccueilProScreenLayout>
  );
}
