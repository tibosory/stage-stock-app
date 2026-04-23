import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { getMateriel, getConsommables } from '../db/database';
import { Materiel, Consommable } from '../types';
import { TabScreenSafeArea, ScreenHeader } from '../components/UI';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import BulkQrPrintModal from '../components/BulkQrPrintModal';
import ShelfLabelsModal from '../components/ShelfLabelsModal';
import { useAppAuth } from '../context/AuthContext';

/**
 * Espace « Impression » : raccourcis vers les mêmes flux que le stock (QR groupé, étiquettes),
 * sans passer par la liste matériel.
 */
export default function PrintHubScreen() {
  const { can } = useAppAuth();
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
          <Text style={s.muted}>Chargement des listes…</Text>
        </View>
      </TabScreenSafeArea>
    );
  }

  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader icon={<Text style={{ fontSize: 22 }}>🖨</Text>} title="Impression" />
        <Text style={s.hint}>
          Même rendu qu’en liste stock ou consommables : étiquettes matériel (QR), bacs, formats courants, rayonnage.
        </Text>

        {editOk ? (
          <>
            <TouchableOpacity style={[s.card, s.cardPrimary]} onPress={() => setShowBulk(true)} activeOpacity={0.85}>
              <Text style={s.cardIcon}>🖨</Text>
              <Text style={s.cardTitle}>Impression QR (plusieurs matériels)</Text>
              <Text style={s.cardSub}>Sélection, formats d’étiquettes, A4 / A3</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.card} onPress={() => setShowShelfMat(true)} activeOpacity={0.85}>
              <Text style={s.cardIcon}>🏷</Text>
              <Text style={s.cardTitle}>Étiquettes rayonnage (matériel)</Text>
              <Text style={s.cardSub}>{materiels.length} ligne(s) disponible(s) depuis le stock</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.card} onPress={() => setShowShelfConso(true)} activeOpacity={0.85}>
              <Text style={s.cardIcon}>🏷</Text>
              <Text style={s.cardTitle}>Étiquettes rayonnage (consommables)</Text>
              <Text style={s.cardSub}>{consos.length} consommable(s)</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={s.denied}>
            L’impression d’étiquettes est réservée aux comptes autorisés à modifier l’inventaire.
          </Text>
        )}
      </ScrollView>

      <BulkQrPrintModal visible={showBulk} onClose={() => setShowBulk(false)} materiels={materiels} />
      <ShelfLabelsModal
        visible={showShelfMat}
        onClose={() => setShowShelfMat(false)}
        title="Étiquettes rayonnage (stock)"
        items={materiels.map(m => ({
          id: m.id,
          title: m.nom,
          subtitle: [
            (m as any).localisation_nom,
            (m as any).categorie_nom,
            m.numero_serie ? `S/N ${m.numero_serie}` : undefined,
          ]
            .filter(Boolean)
            .join(' · '),
        }))}
      />
      <ShelfLabelsModal
        visible={showShelfConso}
        onClose={() => setShowShelfConso(false)}
        title="Étiquettes rayonnage (consommables)"
        items={consos.map(c => ({
          id: c.id,
          title: c.nom,
          subtitle: [c.unite, (c as any).localisation_nom].filter(Boolean).join(' · '),
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
