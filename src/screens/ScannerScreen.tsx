// src/screens/ScannerScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, TextInput,
  ScrollView, Vibration
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import {
  getMaterielByQr, getMaterielByNfc, searchMateriels,
  getConsommableByQr, getStats,
} from '../db/database';
import { useNfc } from '../hooks/useNfc';
import { EtatBadge, StatutBadge, Card } from '../components/UI';
import { Materiel } from '../types';
import { useAuth } from '../context/AuthContext';

type Mode = 'home' | 'camera' | 'nfc' | 'batch' | 'manual';

export default function ScannerScreen() {
  const navigation = useNavigation<any>();
  const { can } = useAuth();
  const editInventory = can('edit_inventory');
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>('home');
  const [scanned, setScanned] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [recentMat, setRecentMat] = useState<Materiel[]>([]);
  const [batchResults, setBatchResults] = useState<Materiel[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getStats>> | null>(null);
  const { nfcSupported, nfcEnabled, scanning: nfcScanning, readNfcTag } = useNfc();

  useEffect(() => {
    loadRecent();
  }, []);

  useFocusEffect(
    useCallback(() => {
      getStats().then(setStats);
    }, [])
  );

  const loadRecent = async () => {
    const results = await searchMateriels('');
    setRecentMat(results.slice(0, 5));
  };

  const handleBarcode = useCallback(async (result: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);
    Vibration.vibrate(80);

    const mat = await getMaterielByQr(result.data);
    if (mat) {
      if (mode === 'batch') {
        setBatchResults(prev => {
          if (prev.find(m => m.id === mat.id)) {
            Alert.alert('Déjà scanné', mat.nom);
            setScanned(false);
            return prev;
          }
          Alert.alert('✓ Trouvé', mat.nom);
          setTimeout(() => setScanned(false), 800);
          return [mat, ...prev];
        });
      } else {
        navigation.navigate('Stock', {
          screen: 'MaterielDetail',
          params: { materielId: mat.id },
        });
        setTimeout(() => setScanned(false), 1500);
      }
    } else {
      const conso = await getConsommableByQr(result.data);
      if (conso) {
        if (mode === 'batch') {
          Alert.alert(
            'Consommable',
            `${conso.nom} — le mode lot est prévu pour le matériel scène. Ouvrez l’onglet Consom. pour les consommables.`,
            [{ text: 'OK', onPress: () => setScanned(false) }]
          );
          return;
        }
        navigation.navigate('Consom.', { openConsoId: conso.id });
        setTimeout(() => setScanned(false), 1200);
        return;
      }
      if (editInventory) {
        Alert.alert(
          'Code inconnu',
          `Code: ${result.data}\n\nCréer un nouveau matériel avec ce code ?`,
          [
            { text: 'Annuler', onPress: () => setScanned(false) },
            {
              text: 'Créer',
              onPress: () => {
                navigation.navigate('Stock', { newQr: result.data });
                setScanned(false);
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Code inconnu',
          `Code: ${result.data}\n\nDemandez à un technicien d’enregistrer ce matériel.`,
          [{ text: 'OK', onPress: () => setScanned(false) }]
        );
      }
    }
  }, [scanned, mode, navigation, editInventory]);

  const handleNfcScan = async () => {
    const tagValue = await readNfcTag();
    if (!tagValue) {
      Alert.alert('Pas de tag', 'Aucun tag NFC détecté ou lecture impossible.');
      return;
    }

    Vibration.vibrate(100);
    const mat = await getMaterielByNfc(tagValue);
    if (mat) {
      navigation.navigate('Stock', {
        screen: 'MaterielDetail',
        params: { materielId: mat.id },
      });
    } else if (editInventory) {
      Alert.alert(
        'Tag NFC non associé',
        `Tag ID: ${tagValue}\n\nVoulez-vous associer ce tag à un matériel ?`,
        [
          { text: 'Annuler' },
          {
            text: 'Associer',
            onPress: () => navigation.navigate('Stock', { newNfc: tagValue }),
          },
        ]
      );
    } else {
      Alert.alert(
        'Tag NFC non associé',
        `Tag ID: ${tagValue}\n\nContactez un technicien pour l’association.`
      );
    }
  };

  const handleManualSearch = async () => {
    if (!manualInput.trim()) return;
    const mat = await getMaterielByQr(manualInput.trim());
    if (mat) {
      navigation.navigate('Stock', {
        screen: 'MaterielDetail',
        params: { materielId: mat.id },
      });
      return;
    }
    const conso = await getConsommableByQr(manualInput.trim());
    if (conso) {
      navigation.navigate('Consom.', { openConsoId: conso.id });
      return;
    }
    const results = await searchMateriels(manualInput.trim());
    setRecentMat(results);
  };

  // ── Écran caméra ──
  if (mode === 'camera' || mode === 'batch') {
    if (!permission?.granted) {
      return (
        <SafeAreaView style={s.container}>
          <View style={s.center}>
            <Text style={s.subtitle}>Permission caméra requise</Text>
            <TouchableOpacity style={s.btnGreen} onPress={requestPermission}>
              <Text style={s.btnGreenText}>Autoriser la caméra</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMode('home')} style={{ marginTop: 12 }}>
              <Text style={{ color: Colors.textMuted }}>← Retour</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e', 'pdf417', 'aztec', 'datamatrix'],
          }}
          onBarcodeScanned={handleBarcode}
        />

        {/* Viseur */}
        <View style={s.scanOverlay}>
          <View style={s.scanFrame}>
            <View style={[s.corner, { top: 0, left: 0 }]} />
            <View style={[s.corner, { top: 0, right: 0, transform: [{ scaleX: -1 }] }]} />
            <View style={[s.corner, { bottom: 0, left: 0, transform: [{ scaleY: -1 }] }]} />
            <View style={[s.corner, { bottom: 0, right: 0, transform: [{ scale: -1 }] }]} />
          </View>
          <Text style={s.scanHint}>
            {mode === 'batch' ? `Mode lot — ${batchResults.length} scannés` : 'Pointez vers un QR code ou code-barres'}
          </Text>
        </View>

        {/* Barre du bas */}
        <View style={s.scanBottom}>
          {mode === 'batch' && (
            <TouchableOpacity
              style={[s.btnGreen, { marginBottom: 8 }]}
              onPress={() => {
                Alert.alert(`${batchResults.length} matériels scannés`, batchResults.map(m => m.nom).join('\n'));
              }}
            >
              <Text style={s.btnGreenText}>Voir la liste ({batchResults.length})</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.btnDark} onPress={() => { setMode('home'); setScanned(false); setBatchResults([]); }}>
            <Text style={{ color: Colors.white, fontWeight: '600' }}>← Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Écran NFC ──
  if (mode === 'nfc') {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>📡</Text>
          <Text style={[s.title, { marginTop: 16 }]}>Scanner NFC</Text>
          <Text style={s.subtitle}>Approchez une puce NFC du téléphone</Text>

          {!nfcSupported && (
            <View style={s.alertBox}>
              <Text style={{ color: Colors.red }}>Ce téléphone ne supporte pas le NFC</Text>
            </View>
          )}
          {nfcSupported && !nfcEnabled && (
            <View style={s.alertBox}>
              <Text style={{ color: Colors.yellow }}>NFC désactivé — activez-le dans les paramètres</Text>
            </View>
          )}

          {nfcSupported && nfcEnabled && (
            <TouchableOpacity
              style={[s.btnGreen, { marginTop: 24, width: '80%' }]}
              onPress={handleNfcScan}
              disabled={nfcScanning}
            >
              <Text style={s.btnGreenText}>
                {nfcScanning ? 'Lecture en cours...' : '📡 Activer la lecture'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => setMode('home')} style={{ marginTop: 24 }}>
            <Text style={{ color: Colors.textMuted }}>← Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Accueil scanner ──
  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 24 }}>
          <View style={s.scanIconBox}>
            <Text style={{ fontSize: 40 }}>⊞</Text>
          </View>
          <Text style={[s.title, { marginTop: 16 }]}>Scanner / Recherche</Text>
          <Text style={s.subtitle}>Recherchez par QR code, n° de série ou nom</Text>
        </View>

        {stats && (
          <View style={s.statsRow}>
            <View style={s.statPill}>
              <Text style={s.statNum}>{stats.totalMateriels}</Text>
              <Text style={s.statLbl}>Matériels</Text>
            </View>
            <View style={s.statPill}>
              <Text style={s.statNum}>{stats.enPret}</Text>
              <Text style={s.statLbl}>En prêt</Text>
            </View>
            <View style={s.statPill}>
              <Text style={s.statNum}>{stats.pretsEnCours}</Text>
              <Text style={s.statLbl}>Prêts actifs</Text>
            </View>
            <View style={[s.statPill, stats.alertesConsommables > 0 && s.statPillWarn]}>
              <Text style={s.statNum}>{stats.alertesConsommables}</Text>
              <Text style={s.statLbl}>Alertes</Text>
            </View>
          </View>
        )}

        {/* Barre de recherche manuelle */}
        <View style={s.searchRow}>
          <TextInput
            style={s.searchInput}
            placeholder="QR code, n° série, nom..."
            placeholderTextColor={Colors.textMuted}
            value={manualInput}
            onChangeText={setManualInput}
            onSubmitEditing={handleManualSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={s.searchBtn} onPress={handleManualSearch}>
            <Text style={{ fontSize: 18 }}>🔍</Text>
          </TouchableOpacity>
        </View>

        {/* Modes de scan */}
        <TouchableOpacity style={s.btnGreen} onPress={async () => {
          if (!permission?.granted) await requestPermission();
          setScanned(false);
          setMode('camera');
        }}>
          <Text style={s.btnGreenText}>⊞  Scanner un code QR</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.btnDark, { marginTop: 10 }]} onPress={() => setMode('nfc')}>
          <Text style={{ color: Colors.white, fontWeight: '600', fontSize: 15 }}>
            📡  Scanner une puce NFC
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.btnOutline, { marginTop: 10 }]} onPress={async () => {
          if (!permission?.granted) await requestPermission();
          setScanned(false);
          setBatchResults([]);
          setMode('batch');
        }}>
          <Text style={{ color: Colors.white, fontWeight: '600', fontSize: 15 }}>
            ⚡  Mode scan rapide (lot)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.btnText, { marginTop: 10 }]} onPress={() => setMode('manual')}>
          <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>⌨️  Saisie manuelle</Text>
        </TouchableOpacity>

        <Text style={s.hint}>
          💡 Les puces NFC doivent contenir l'ID ou le numéro de série du matériel en texte ou URL
        </Text>

        {/* Derniers ajouts */}
        {recentMat.length > 0 && (
          <>
            <Text style={s.sectionLabel}>DERNIERS AJOUTS</Text>
            {recentMat.map(mat => (
              <Card key={mat.id} onPress={() => navigation.navigate('Stock', {
                screen: 'MaterielDetail',
                params: { materielId: mat.id },
              })}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ fontSize: 22 }}>📦</Text>
                    <View>
                      <Text style={s.matName}>{mat.nom}</Text>
                      {mat.numero_serie && (
                        <Text style={s.matSub}>{mat.marque ? mat.marque + ' · ' : ''}{mat.numero_serie}</Text>
                      )}
                    </View>
                  </View>
                  <EtatBadge etat={mat.etat} />
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: Colors.white, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 8 },
  scanIconBox: {
    width: 90, height: 90, borderRadius: 22,
    backgroundColor: Colors.greenBg, alignItems: 'center', justifyContent: 'center',
  },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  searchInput: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: 12,
    color: Colors.white, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchBtn: {
    backgroundColor: Colors.green, borderRadius: 12,
    width: 48, alignItems: 'center', justifyContent: 'center',
  },
  btnGreen: {
    backgroundColor: Colors.green, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  btnGreenText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  btnDark: {
    backgroundColor: Colors.bgCard, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  btnOutline: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  btnText: { alignItems: 'center', paddingVertical: 12 },
  hint: {
    color: Colors.textMuted, fontSize: 12,
    textAlign: 'center', marginTop: 20, marginBottom: 24,
    lineHeight: 18,
  },
  sectionLabel: {
    color: Colors.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 1, marginBottom: 10,
  },
  matName: { color: Colors.white, fontSize: 15, fontWeight: '600' },
  matSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  alertBox: {
    backgroundColor: Colors.bgCard, borderRadius: 10,
    padding: 14, marginTop: 16, alignItems: 'center',
  },

  // Scanner overlay
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  scanFrame: {
    width: 240, height: 240, position: 'relative',
  },
  corner: {
    position: 'absolute', width: 30, height: 30,
    borderColor: Colors.green, borderTopWidth: 3, borderLeftWidth: 3,
  },
  scanHint: {
    color: Colors.white, marginTop: 24, fontSize: 14,
    textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  scanBottom: {
    position: 'absolute', bottom: 40, left: 20, right: 20,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
    justifyContent: 'center',
  },
  statPill: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: '22%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statPillWarn: { borderColor: Colors.red },
  statNum: { color: Colors.white, fontSize: 18, fontWeight: '800' },
  statLbl: { color: Colors.textMuted, fontSize: 10, marginTop: 2, fontWeight: '600' },
});
