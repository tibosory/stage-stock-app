import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import { getPrets, updatePret, deletePret } from '../db/loanDb';
import type { Pret } from '../types';
import { Card, ScreenHeader, PretStatutBadge, TabScreenSafeArea } from '../components/UI';
import { notifyBorrowerDemandeAcceptee } from '../lib/pretDemandeNotifications';
import { triggerSyncAfterActionIfEnabled } from '../lib/syncAfterAction';
import { useLanguage } from '../context/LanguageContext';

function formatDateCourt(raw: string | undefined): string {
  if (!raw) return '';
  const d = raw.includes('T') ? parseISO(raw) : parseISO(`${raw}T12:00:00`);
  if (!isValid(d)) return raw;
  return format(d, 'd MMM yyyy', { locale: fr });
}

export default function DemandePretScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const [list, setList] = useState<Pret[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const p = await getPrets();
    setList(p.filter(x => x.statut === 'en demande'));
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const valider = (item: Pret) => {
    Alert.alert(
      t('loanReq.validateTitle'),
      t('loanReq.validateBody', { borrower: item.emprunteur }),
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Valider',
          onPress: async () => {
            try {
              await updatePret(item.id, { statut: 'en cours' });
              const prets = await getPrets();
              const p = prets.find(x => x.id === item.id);
              if (p) await notifyBorrowerDemandeAcceptee(p);
              await load();
              void triggerSyncAfterActionIfEnabled();
              Alert.alert(t('loanReq.doneTitle'), t('loanReq.doneBody'));
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              Alert.alert(t('common.error'), msg);
            }
          },
        },
      ]
    );
  };

  const refuser = (item: Pret) => {
    Alert.alert(
      t('loanReq.refuseTitle'),
      t('loanReq.refuseBody', { borrower: item.emprunteur }),
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePret(item.id);
              await load();
              void triggerSyncAfterActionIfEnabled();
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              Alert.alert(t('common.error'), msg);
            }
          },
        },
      ]
    );
  };

  const modifier = (item: Pret) => {
    navigation.navigate('Prêts', { openPretEditId: item.id });
  };

  const renderItem = ({ item }: { item: Pret }) => (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={s.name}>{item.emprunteur}</Text>
          {item.organisation ? <Text style={s.sub}>{item.organisation}</Text> : null}
          <Text style={s.sub}>
            {t('loanReq.depart')} {formatDateCourt(item.date_depart)}
            {item.retour_prevu ? ` → ${t('loanReq.return')} ${formatDateCourt(item.retour_prevu)}` : ''}
          </Text>
          {item.commentaire ? (
            <Text style={[s.sub, { marginTop: 6 }]} numberOfLines={3}>
              {item.commentaire}
            </Text>
          ) : null}
        </View>
        <PretStatutBadge statut={item.statut} />
      </View>
      <View style={s.actions}>
        <TouchableOpacity style={s.btn} onPress={() => modifier(item)}>
          <Text style={s.btnTextOut}>{t('loanReq.modify')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.btnDanger]} onPress={() => refuser(item)}>
          <Text style={s.btnTextDanger}>{t('loanReq.reject')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.btnOk]} onPress={() => valider(item)}>
          <Text style={s.btnTextOk}>{t('loanReq.approve')}</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  return (
    <TabScreenSafeArea style={s.container}>
      <View style={{ padding: 20, paddingBottom: 8 }}>
        <ScreenHeader
          icon={<Text style={{ fontSize: 22 }}>📥</Text>}
          title={t('loanReq.title')}
        />
        <Text style={s.intro}>{t('loanReq.intro')}</Text>
      </View>
      <FlatList
        data={list}
        keyExtractor={p => p.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 20, paddingTop: 4 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.green} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 40 }}>📥</Text>
            <Text style={{ color: Colors.textMuted, marginTop: 12 }}>{t('loanReq.empty')}</Text>
          </View>
        }
      />
    </TabScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  intro: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 4 },
  name: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  sub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'flex-end' },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgInput,
  },
  btnOk: { backgroundColor: Colors.green, borderColor: Colors.green },
  btnDanger: { borderColor: Colors.red },
  btnTextOut: { color: Colors.green, fontWeight: '600', fontSize: 13 },
  btnTextOk: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  btnTextDanger: { color: Colors.red, fontWeight: '600', fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 48 },
});
