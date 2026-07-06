import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { getMateriel, getConsommables } from '../db/inventoryDb';
import { Materiel, Consommable } from '../types';
import { formatLieuLocalisation, formatMaterielEmplacement } from '../lib/materielLocation';
import { TabScreenSafeArea, ScreenHeader } from '../components/UI';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import BulkQrPrintModal from '../components/BulkQrPrintModal';
import ShelfLabelsModal from '../components/ShelfLabelsModal';
import { useAppAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

/**
 * Espace « Impression » : raccourcis vers les mêmes flux que le stock (QR groupé, étiquettes),
 * sans passer par la liste matériel.
 */
export default function PrintHubScreen() {
  const { can } = useAppAuth();
  const { t } = useLanguage();
  const editOk = can('edit_inventory');
  const [materiels, setMateriels] = useState<Materiel[]>([]);
  const [consos, setConsos] = useState<Consommable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBulk, setShowBulk] = useState(false);
  const [showShelfMat, setShowShelfMat] = useState(false);
  const [showShelfConso, setShowShelfConso] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, c] = await Promise.all([getMateriel(), getConsommables()]);
      setMateriels(m);
      setConsos(c);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <TabScreenSafeArea style={s.container}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={Colors.green} />
          <Text style={s.muted}>{t('print.loadingLists')}</Text>
        </View>
      </TabScreenSafeArea>
    );
  }

  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader icon={<Text style={{ fontSize: 22 }}>🖨</Text>} title={t('print.hubTitle')} />
        <Text style={s.hint}>{t('print.hubIntro')}</Text>

        {editOk ? (
          <>
            <TouchableOpacity style={[s.card, s.cardPrimary]} onPress={() => setShowBulk(true)} activeOpacity={0.85}>
              <Text style={s.cardIcon}>🖨</Text>
              <Text style={s.cardTitle}>{t('print.qrBulk')}</Text>
              <Text style={s.cardSub}>
                {t('print.qrBulkSub', {
                  mat: materiels.length,
                  conso: consos.length,
                })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.card} onPress={() => setShowShelfMat(true)} activeOpacity={0.85}>
              <Text style={s.cardIcon}>🏷</Text>
              <Text style={s.cardTitle}>{t('print.shelfMat')}</Text>
              <Text style={s.cardSub}>{t('print.shelfMatSub', { count: materiels.length })}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.card} onPress={() => setShowShelfConso(true)} activeOpacity={0.85}>
              <Text style={s.cardIcon}>🏷</Text>
              <Text style={s.cardTitle}>{t('print.shelfConso')}</Text>
              <Text style={s.cardSub}>{t('print.shelfConsoSub', { count: consos.length })}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={s.denied}>
            {t('print.denied')}
          </Text>
        )}
      </ScrollView>

      <BulkQrPrintModal
        visible={showBulk}
        onClose={() => setShowBulk(false)}
        materiels={materiels}
        consommables={consos}
      />
      <ShelfLabelsModal
        visible={showShelfMat}
        onClose={() => setShowShelfMat(false)}
        title={t('print.shelfModalMat')}
        items={materiels.map(m => ({
          id: m.id,
          title: m.nom,
          subtitle: [
            formatMaterielEmplacement(m),
            m.categorie_nom,
            m.numero_serie ? `S/N ${m.numero_serie}` : undefined,
          ]
            .filter(Boolean)
            .join(' · '),
        }))}
      />
      <ShelfLabelsModal
        visible={showShelfConso}
        onClose={() => setShowShelfConso(false)}
        title={t('print.shelfModalConso')}
        items={consos.map(c => ({
          id: c.id,
          title: c.nom,
          subtitle: [c.unite, formatLieuLocalisation(c)].filter(Boolean).join(' · '),
        }))}
      />
    </TabScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted: { ...Typography.bodySecondary, marginTop: 10 },
  hint: { ...Typography.bodySecondary, marginBottom: 16 },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardPrimary: { borderColor: 'rgba(52, 211, 153, 0.45)' },
  cardIcon: { fontSize: 28, marginBottom: 8 },
  cardTitle: { ...Typography.sectionTitle, fontSize: 16, marginBottom: 4 },
  cardSub: { ...Typography.caption, color: Colors.textMuted },
  denied: { ...Typography.bodySecondary, textAlign: 'center', marginTop: 20 },
});
