// src/screens/FlightcaseDetailScreen.tsx
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import { Card, TabScreenSafeArea } from '../components/UI';
import { getMaterielsInStockFlightcase } from '../db/inventoryOpsDb';
import { getLocalisations } from '../db/catalogDb';
import type { Materiel } from '../types';
import type { StockFlightcaseKey } from '../lib/stockFlightcase';
import { ensureStockFlightcaseQr } from '../db/stockFlightcasesDb';
import {
  printStockFlightcaseContentLabel,
  printStockFlightcaseQrOnly,
  printStockFlightcaseShelfLabel,
  printStockFlightcaseGroupedQrsPdf,
} from '../lib/pdfStockFlightcase';
import { materielReferenceDisplay } from '../lib/labelQrLayout';
import { formatMaterielEmplacement } from '../lib/materielLocation';
import { useLanguage } from '../context/LanguageContext';

export default function FlightcaseDetailScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const localisationId = (route.params?.localisationId as string | null | undefined) ?? null;
  const flightcase = String(route.params?.flightcase ?? '').trim();

  const [items, setItems] = useState<Materiel[]>([]);
  const [localisationName, setLocalisationName] = useState('');
  const [loading, setLoading] = useState(true);
  const [flightcaseQr, setFlightcaseQr] = useState('');

  const [printBusy, setPrintBusy] = useState(false);

  const key: StockFlightcaseKey = { localisationId, flightcase };

  const load = useCallback(async () => {
    if (!flightcase) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [mats, locs, fcQr] = await Promise.all([
        getMaterielsInStockFlightcase(localisationId, flightcase),
        getLocalisations(),
        ensureStockFlightcaseQr({ localisationId, flightcase }),
      ]);
      setItems(mats);
      setFlightcaseQr(fcQr);
      const loc = localisationId ? locs.find(l => l.id === localisationId) : null;
      setLocalisationName(loc?.nom ?? (mats[0] as Materiel & { localisation_nom?: string })?.localisation_nom ?? '');
    } finally {
      setLoading(false);
    }
  }, [localisationId, flightcase]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const runPrint = async (mode: 'content' | 'qr' | 'shelf' | 'grouped') => {
    if (!flightcase) return;
    setPrintBusy(true);
    try {
      if (mode === 'content') {
        await printStockFlightcaseContentLabel({
          key,
          localisationName,
          items,
        });
      } else if (mode === 'qr') {
        await printStockFlightcaseQrOnly({ key, localisationName });
      } else if (mode === 'shelf') {
        await printStockFlightcaseShelfLabel({ key, localisationName });
      } else {
        await printStockFlightcaseGroupedQrsPdf({
          key,
          localisationName,
          items,
        });
      }
    } catch (e: unknown) {
      Alert.alert(
        t('stock.flightcase.printError'),
        e instanceof Error ? e.message : String(e)
      );
    } finally {
      setPrintBusy(false);
    }
  };

  const qrPreview = flightcaseQr || '—';

  return (
    <TabScreenSafeArea style={s.container}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: Colors.green, fontSize: 16 }}>← {t('scanner.back')}</Text>
        </TouchableOpacity>
        <Text style={s.sectionTitle}>{t('stock.flightcase.detailTitle')}</Text>
        <Text style={s.fcName}>{flightcase || '—'}</Text>
        <Text style={s.sub}>
          {localisationName || t('stock.flightcase.noLocation')} · {items.length}{' '}
          {t('stock.flightcase.itemCountSuffix')}
        </Text>
        <Text style={s.qrHint} selectable>
          {t('stock.flightcase.qrHint')}: {qrPreview}
        </Text>
        <Text style={s.qrSepHint}>{t('stock.flightcase.qrSeparateHint')}</Text>
        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.btn, s.btnPrimary, printBusy && { opacity: 0.6 }]}
            onPress={() => void runPrint('content')}
            disabled={printBusy}
          >
            {printBusy ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={s.btnPrimaryText}>{t('stock.flightcase.printContent')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, s.btnOutline, printBusy && { opacity: 0.6 }]}
            onPress={() => void runPrint('qr')}
            disabled={printBusy}
          >
            <Text style={s.btnOutlineText}>{t('stock.flightcase.printQrOnly')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, s.btnOutline, printBusy && { opacity: 0.6 }]}
            onPress={() => void runPrint('grouped')}
            disabled={printBusy || items.length === 0}
          >
            <Text style={s.btnOutlineText}>{t('stock.flightcase.printGroupedQrs')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, s.btnOutline, printBusy && { opacity: 0.6 }]}
            onPress={() => void runPrint('shelf')}
            disabled={printBusy}
          >
            <Text style={s.btnOutlineText}>{t('stock.flightcase.printShelf')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.green} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={s.empty}>{t('stock.flightcase.empty')}</Text>
          }
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 10 }}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('MaterielDetail', { materielId: item.id })
                }
              >
                <Text style={s.itemName}>{item.nom}</Text>
                <Text style={s.itemSub}>
                  {[item.marque, item.numero_serie, item.statut].filter(Boolean).join(' · ')}
                </Text>
                <Text style={s.itemQrLine} selectable>
                  {t('stock.flightcase.itemQrLabel')}:{' '}
                  {materielReferenceDisplay(item)}
                </Text>
                {formatMaterielEmplacement(item) ? (
                  <Text style={s.itemSub}>{formatMaterielEmplacement(item)}</Text>
                ) : null}
              </TouchableOpacity>
            </Card>
          )}
        />
      )}
    </TabScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  sectionTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 4, textTransform: 'uppercase' },
  fcName: { color: Colors.white, fontSize: 20, fontWeight: '800' },
  sub: { color: Colors.textMuted, fontSize: 13, marginTop: 4 },
  qrHint: { color: Colors.textSecondary, fontSize: 10, marginTop: 8, lineHeight: 14 },
  qrSepHint: { color: Colors.textMuted, fontSize: 11, marginTop: 6, lineHeight: 15 },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  btn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: '46%',
    flexGrow: 1,
  },
  btnPrimary: { backgroundColor: Colors.green },
  btnPrimaryText: { color: Colors.white, fontWeight: '700', fontSize: 13, textAlign: 'center' },
  btnOutline: { borderWidth: 1, borderColor: Colors.green },
  btnOutlineText: { color: Colors.green, fontWeight: '700', fontSize: 13, textAlign: 'center' },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 32 },
  itemName: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  itemSub: { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  itemQrLine: { color: Colors.green, fontSize: 11, marginTop: 4, fontFamily: 'monospace' },
});
