// src/screens/ScannerScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, TextInput,
  ScrollView, Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Colors, Shadow } from '../theme/colors';
import {
  getMaterielByQr, getMaterielByNfc, searchMateriels, searchConsommables,
  getConsommableByQr, getStats, ajusterStock,
  createMaterielStubWithScannedCode,
  createConsommableStubWithScannedCode,
} from '../db/database';
import { triggerSyncAfterActionIfEnabled } from '../lib/syncAfterAction';
import { openMaterielFicheFromAlerte, openConsoFicheFromAlerte } from '../navigation/openFicheFromAlerte';
import { useNfc } from '../hooks/useNfc';
import { EtatBadge, Card, BottomModal, Input, TabScreenSafeArea } from '../components/UI';
import { BurstQtyNumpadModal } from '../components/BurstQtyNumpadModal';
import { Consommable, Materiel } from '../types';
import { useAppAuth } from '../context/AuthContext';

type Mode = 'home' | 'camera' | 'nfc' | 'batch';
type LastConsoMove = {
  id: string;
  nom: string;
  unite: string;
  delta: number;
};

export default function ScannerScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { can } = useAppAuth();
  const editInventory = can('edit_inventory');
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>('home');
  const [scanned, setScanned] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [recentMat, setRecentMat] = useState<Materiel[]>([]);
  const [manualConsoResults, setManualConsoResults] = useState<Consommable[]>([]);
  const [manualSearchActive, setManualSearchActive] = useState(false);
  const [batchResults, setBatchResults] = useState<Materiel[]>([]);
  const [consoMoveItem, setConsoMoveItem] = useState<Consommable | null>(null);
  const [consoMoveQty, setConsoMoveQty] = useState('1');
  const [consoMoveBusy, setConsoMoveBusy] = useState(false);
  const [consoBurstEnabled, setConsoBurstEnabled] = useState(false);
  const [consoBurstType, setConsoBurstType] = useState<'entrée' | 'sortie'>('sortie');
  const [consoBurstQty, setConsoBurstQty] = useState('1');
  /** Entrée/Sortie sur l’accueil, puis pavé numérique à chaque consommable (au lieu d’appliquer la quantité fixe). */
  const [consoBurstAskQtyEachScan, setConsoBurstAskQtyEachScan] = useState(false);
  const [burstNumpadConso, setBurstNumpadConso] = useState<Consommable | null>(null);
  const [consoBurstLast, setConsoBurstLast] = useState('');
  const [lastConsoMove, setLastConsoMove] = useState<LastConsoMove | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getStats>> | null>(null);
  const { nfcSupported, nfcEnabled, scanning: nfcScanning, readNfcTag } = useNfc();
  const manualInputRef = useRef<TextInput>(null);
  const manualSearchDidMount = useRef(false);

  useEffect(() => {
    loadRecent();
  }, []);

  useEffect(() => {
    if (!manualSearchDidMount.current) {
      manualSearchDidMount.current = true;
      return;
    }
    if (!manualInput.trim()) {
      void loadRecent();
      setManualConsoResults([]);
      setManualSearchActive(false);
    }
  }, [manualInput]);

  useFocusEffect(
    useCallback(() => {
      getStats().then(setStats);
    }, [])
  );

  const loadRecent = async () => {
    const results = await searchMateriels('');
    setRecentMat(results);
  };

  const openConsoMove = useCallback((conso: Consommable) => {
    setConsoMoveItem(conso);
    setConsoMoveQty('1');
  }, []);

  const closeConsoMove = useCallback(() => {
    setConsoMoveItem(null);
    setConsoMoveQty('1');
    setScanned(false);
  }, []);

  const submitConsoMove = useCallback(async (type: 'entrée' | 'sortie') => {
    if (!consoMoveItem) return;
    const qty = Math.max(0, parseInt(consoMoveQty, 10) || 0);
    if (qty <= 0) {
      Alert.alert('Quantité invalide', 'Saisissez un nombre supérieur à 0.');
      return;
    }
    const delta = type === 'entrée' ? qty : -qty;
    setConsoMoveBusy(true);
    try {
      await ajusterStock(consoMoveItem.id, delta);
      await getStats().then(setStats);
      setLastConsoMove({
        id: consoMoveItem.id,
        nom: consoMoveItem.nom,
        unite: consoMoveItem.unite,
        delta,
      });
      setConsoBurstLast(`${consoMoveItem.nom} ${delta > 0 ? '+' : ''}${delta} ${consoMoveItem.unite}`);
      Alert.alert(
        'Stock mis à jour',
        `${consoMoveItem.nom}\n${type === 'entrée' ? '+' : '-'}${qty} ${consoMoveItem.unite}`
      );
      closeConsoMove();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de mettre à jour le stock.');
    } finally {
      setConsoMoveBusy(false);
    }
  }, [consoMoveItem, consoMoveQty, closeConsoMove]);

  const getBurstQty = useCallback(() => Math.max(0, parseInt(consoBurstQty, 10) || 0), [consoBurstQty]);

  const applyConsoBurstMove = useCallback(
    async (conso: Consommable, type: 'entrée' | 'sortie', qty: number): Promise<boolean> => {
      if (qty <= 0) {
        Alert.alert('Mode rafale', 'Quantité invalide. Indiquez un nombre supérieur à 0.');
        return false;
      }
      const delta = type === 'entrée' ? qty : -qty;
      try {
        await ajusterStock(conso.id, delta);
        await getStats().then(setStats);
        setLastConsoMove({
          id: conso.id,
          nom: conso.nom,
          unite: conso.unite,
          delta,
        });
        setConsoBurstLast(`${conso.nom} ${type === 'entrée' ? '+' : '-'}${qty} ${conso.unite}`);
        return true;
      } catch (e: any) {
        Alert.alert('Erreur mouvement', e?.message ?? 'Impossible de mettre à jour le stock.');
        return false;
      }
    },
    []
  );

  const applyConsoBurst = useCallback(
    async (conso: Consommable): Promise<boolean> => {
      const qty = getBurstQty();
      if (qty <= 0) {
        Alert.alert('Mode rafale', 'Quantité invalide. Réglez une quantité > 0 ou utilisez le pavé à chaque scan.');
        return false;
      }
      return applyConsoBurstMove(conso, consoBurstType, qty);
    },
    [getBurstQty, consoBurstType, applyConsoBurstMove]
  );

  const handleBurstNumpadConfirm = useCallback(
    async (qty: number) => {
      if (!burstNumpadConso) return;
      const conso = burstNumpadConso;
      const ok = await applyConsoBurstMove(conso, consoBurstType, qty);
      if (ok) {
        setBurstNumpadConso(null);
        setTimeout(() => setScanned(false), 280);
      }
    },
    [burstNumpadConso, consoBurstType, applyConsoBurstMove]
  );

  const handleBurstNumpadCancel = useCallback(() => {
    setBurstNumpadConso(null);
    setScanned(false);
  }, []);

  const undoLastConsoMove = useCallback(async () => {
    if (!lastConsoMove || undoBusy) return;
    setUndoBusy(true);
    try {
      await ajusterStock(lastConsoMove.id, -lastConsoMove.delta);
      await getStats().then(setStats);
      setConsoBurstLast(
        `Annulé: ${lastConsoMove.nom} ${lastConsoMove.delta > 0 ? '+' : ''}${lastConsoMove.delta} ${lastConsoMove.unite}`
      );
      setLastConsoMove(null);
      Alert.alert('Undo appliqué', `Dernier mouvement annulé sur ${lastConsoMove.nom}.`);
    } catch (e: any) {
      Alert.alert('Undo impossible', e?.message ?? 'Impossible d’annuler le dernier mouvement.');
    } finally {
      setUndoBusy(false);
    }
  }, [lastConsoMove, undoBusy]);

  const handleBarcode = useCallback(async (result: BarcodeScanningResult) => {
    if (scanned) return;
    if (burstNumpadConso) return;
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
        if (consoBurstEnabled) {
          if (consoBurstAskQtyEachScan) {
            setBurstNumpadConso(conso);
            return;
          }
          await applyConsoBurst(conso);
          setTimeout(() => setScanned(false), 320);
          return;
        }
        openConsoMove(conso);
        return;
      }
      if (editInventory) {
        const code = result.data;
        Alert.alert(
          'Code inconnu',
          `${code}\n\nAucune fiche ne correspond. Créer une nouvelle fiche avec ce code ?`,
          [
            { text: 'Annuler', style: 'cancel', onPress: () => setScanned(false) },
            {
              text: 'Fiche matériel (stock)',
              onPress: () => {
                void (async () => {
                  try {
                    const id = await createMaterielStubWithScannedCode({ qrCode: code });
                    await triggerSyncAfterActionIfEnabled();
                    openMaterielFicheFromAlerte(navigation, id, 'stock');
                  } catch (e) {
                    Alert.alert('Création impossible', e instanceof Error ? e.message : String(e));
                  } finally {
                    setScanned(false);
                  }
                })();
              },
            },
            {
              text: 'Fiche consommable',
              onPress: () => {
                void (async () => {
                  try {
                    const id = await createConsommableStubWithScannedCode({ qrCode: code });
                    await triggerSyncAfterActionIfEnabled();
                    openConsoFicheFromAlerte(navigation, id);
                  } catch (e) {
                    Alert.alert('Création impossible', e instanceof Error ? e.message : String(e));
                  } finally {
                    setScanned(false);
                  }
                })();
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
  }, [
    scanned,
    burstNumpadConso,
    mode,
    navigation,
    editInventory,
    consoBurstEnabled,
    consoBurstAskQtyEachScan,
    applyConsoBurst,
    openConsoMove,
  ]);

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
        `${tagValue}\n\nAucune fiche ne correspond. Créer une nouvelle fiche avec ce tag ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Fiche matériel (stock)',
            onPress: () => {
              void (async () => {
                try {
                  const id = await createMaterielStubWithScannedCode({ nfcTagId: tagValue });
                  await triggerSyncAfterActionIfEnabled();
                  openMaterielFicheFromAlerte(navigation, id, 'stock');
                } catch (e) {
                  Alert.alert('Création impossible', e instanceof Error ? e.message : String(e));
                }
              })();
            },
          },
          {
            text: 'Fiche consommable',
            onPress: () => {
              void (async () => {
                try {
                  const id = await createConsommableStubWithScannedCode({ nfcTagId: tagValue });
                  await triggerSyncAfterActionIfEnabled();
                  openConsoFicheFromAlerte(navigation, id);
                } catch (e) {
                  Alert.alert('Création impossible', e instanceof Error ? e.message : String(e));
                }
              })();
            },
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
      if (consoBurstEnabled) {
        if (consoBurstAskQtyEachScan) {
          setBurstNumpadConso(conso);
          setManualInput('');
          return;
        }
        await applyConsoBurst(conso);
        setManualInput('');
        return;
      }
      openConsoMove(conso);
      return;
    }
    const t = manualInput.trim();
    const [matResults, consoResults] = await Promise.all([searchMateriels(t), searchConsommables(t)]);
    setRecentMat(matResults);
    setManualConsoResults(consoResults);
    setManualSearchActive(true);
  };

  const renderBurstNumpadModal = () => (
    <BurstQtyNumpadModal
      visible={!!burstNumpadConso}
      productName={burstNumpadConso?.nom ?? ''}
      stockHint={
        burstNumpadConso
          ? `Stock : ${burstNumpadConso.stock_actuel} ${burstNumpadConso.unite}`
          : undefined
      }
      unite={burstNumpadConso?.unite ?? 'pièce'}
      moveType={consoBurstType}
      initialQtyString={consoBurstQty}
      onCancel={handleBurstNumpadCancel}
      onConfirm={handleBurstNumpadConfirm}
    />
  );

  const renderConsoMoveModal = () => (
    <BottomModal
      visible={!!consoMoveItem}
      onClose={closeConsoMove}
      title="Mouvement consommable"
    >
      {consoMoveItem ? (
        <>
          <Text style={{ color: Colors.white, fontSize: 16, fontWeight: '700' }}>{consoMoveItem.nom}</Text>
          <Text style={{ color: Colors.textSecondary, marginTop: 4, marginBottom: 10 }}>
            Stock actuel: {consoMoveItem.stock_actuel} {consoMoveItem.unite}
          </Text>

          <Input
            label="Quantité"
            value={consoMoveQty}
            onChangeText={setConsoMoveQty}
            keyboardType="numeric"
            placeholder="Ex: 5"
          />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 2, marginBottom: 10 }}>
            {['1', '5', '10', '20'].map(q => (
              <TouchableOpacity
                key={q}
                style={s.qtyChip}
                onPress={() => setConsoMoveQty(q)}
                disabled={consoMoveBusy}
              >
                <Text style={s.qtyChipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 6 }}>
            <TouchableOpacity
              style={[s.moveBtn, s.moveBtnOut, consoMoveBusy && { opacity: 0.7 }]}
              onPress={() => submitConsoMove('sortie')}
              disabled={consoMoveBusy}
            >
              <Text style={s.moveBtnText}>Sortie -{consoMoveQty || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.moveBtn, s.moveBtnIn, consoMoveBusy && { opacity: 0.7 }]}
              onPress={() => submitConsoMove('entrée')}
              disabled={consoMoveBusy}
            >
              <Text style={s.moveBtnText}>Entrée +{consoMoveQty || 0}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </BottomModal>
  );

  // ── Écran caméra ──
  if (mode === 'camera' || mode === 'batch') {
    if (!permission?.granted) {
      return (
        <TabScreenSafeArea style={s.container}>
          <View style={s.center}>
            <Text style={s.subtitle}>Permission caméra requise</Text>
            <TouchableOpacity style={s.btnGreen} onPress={requestPermission}>
              <Text style={s.btnGreenText}>Autoriser la caméra</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMode('home')} style={{ marginTop: 12 }}>
              <Text style={{ color: Colors.textMuted }}>← Retour</Text>
            </TouchableOpacity>
          </View>
        </TabScreenSafeArea>
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

        {/* Barre du bas — au-dessus de la barre de navigation système Android */}
        <View style={[s.scanBottom, { bottom: 16 + Math.max(insets.bottom, 8) }]}>
          {consoBurstEnabled && (
            <View style={[s.burstBadge, consoBurstAskQtyEachScan && { borderColor: Colors.greenMuted }]}>
              <Text style={s.burstBadgeTitle}>
                {consoBurstAskQtyEachScan
                  ? `Pavé: ${consoBurstType === 'entrée' ? 'Entrée' : 'Sortie'} (saisie à chaque code)`
                  : `Rafale: ${consoBurstType === 'entrée' ? `Entrée +${getBurstQty()}` : `Sortie -${getBurstQty()}`}`}
              </Text>
              {consoBurstLast ? <Text style={s.burstBadgeSub}>{consoBurstLast}</Text> : null}
            </View>
          )}
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
          <TouchableOpacity
            style={s.btnDark}
            onPress={() => {
              setMode('home');
              setScanned(false);
              setBatchResults([]);
              setBurstNumpadConso(null);
            }}
          >
            <Text style={{ color: Colors.white, fontWeight: '600' }}>← Fermer</Text>
          </TouchableOpacity>
        </View>
        {renderConsoMoveModal()}
        {renderBurstNumpadModal()}
      </View>
    );
  }

  // ── Écran NFC ──
  if (mode === 'nfc') {
    return (
      <TabScreenSafeArea style={s.container}>
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
        {renderConsoMoveModal()}
        {renderBurstNumpadModal()}
      </TabScreenSafeArea>
    );
  }

  // ── Accueil scanner (cartes larges type « scanner-app ») ──
  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 28 + Math.max(insets.bottom, 8) }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.screenTitle}>Scanner</Text>
        <Text style={s.screenSubtitle}>QR, codes-barres, NFC ou saisie</Text>

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
              <Text style={s.statLbl}>Prêts</Text>
            </View>
            <View style={[s.statPill, stats.alertesConsommables > 0 && s.statPillWarn]}>
              <Text style={s.statNum}>{stats.alertesConsommables}</Text>
              <Text style={s.statLbl}>Alertes</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[s.heroCard, Shadow.primaryGlow]}
          activeOpacity={0.88}
          onPress={async () => {
            if (!permission?.granted) await requestPermission();
            setScanned(false);
            setMode('camera');
          }}
        >
          <Text style={s.heroCardIcon}>⊞</Text>
          <View style={s.heroCardTextCol}>
            <Text style={s.heroCardTitle}>Scanner un code QR</Text>
            <Text style={s.heroCardSub}>Ouvrir la caméra</Text>
          </View>
          <Text style={s.heroChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.secondaryCard} activeOpacity={0.88} onPress={() => setMode('nfc')}>
          <Text style={s.secondaryCardIcon}>📡</Text>
          <View style={s.heroCardTextCol}>
            <Text style={s.secondaryCardTitle}>Scanner une puce NFC</Text>
            <Text style={s.secondaryCardSub}>Lecture d’un tag matériel</Text>
          </View>
          <Text style={s.secondaryChevron}>›</Text>
        </TouchableOpacity>

        <View style={s.ouRow}>
          <View style={s.ouLine} />
          <Text style={s.ouText}>OU</Text>
          <View style={s.ouLine} />
        </View>

        <TouchableOpacity
          style={s.secondaryCard}
          activeOpacity={0.88}
          onPress={async () => {
            if (!permission?.granted) await requestPermission();
            setScanned(false);
            setBatchResults([]);
            setMode('batch');
          }}
        >
          <Text style={s.secondaryCardIcon}>⚡</Text>
          <View style={s.heroCardTextCol}>
            <Text style={s.secondaryCardTitle}>Mode scan rapide (lot)</Text>
            <Text style={s.secondaryCardSub}>Enchaîner plusieurs QR / codes-barres</Text>
          </View>
          <Text style={s.secondaryChevron}>›</Text>
        </TouchableOpacity>

        <View style={s.ouRow}>
          <View style={s.ouLine} />
          <Text style={s.ouText}>OU</Text>
          <View style={s.ouLine} />
        </View>

        <View style={s.manualCard}>
          <Text style={s.manualCardLabel}>Recherche manuelle</Text>
          <Text style={s.manualCardHint}>
            Par nom d’article (matériel ou consommable), référence, ou par libellé de catégorie / sous-catégorie
            (ex. « Éclairage › LED » — un mot du chemin suffit).
          </Text>
          <View style={s.manualRow}>
            <TextInput
              ref={manualInputRef}
              style={s.manualInput}
              placeholder="Nom, catégorie, sous-catégorie, QR, n° série…"
              placeholderTextColor={Colors.textMuted}
              value={manualInput}
              onChangeText={setManualInput}
              onSubmitEditing={handleManualSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={s.manualSearchBtn} onPress={handleManualSearch}>
              <Text style={s.manualSearchBtnText}>🔍</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.burstCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={s.burstTitle}>Mode rafale consommables</Text>
            <TouchableOpacity
              style={[s.burstToggle, consoBurstEnabled && s.burstToggleOn]}
              onPress={() => {
                setConsoBurstEnabled(v => {
                  if (v) {
                    setBurstNumpadConso(null);
                    setConsoBurstAskQtyEachScan(false);
                  }
                  return !v;
                });
              }}
            >
              <Text style={s.burstToggleText}>{consoBurstEnabled ? 'Actif' : 'Inactif'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.burstSub}>
            {consoBurstEnabled
              ? consoBurstAskQtyEachScan
                ? 'Chaque consommable scanné (ou choisi dans les résultats) ouvre le pavé. Entrée / Sortie = boutons ci-dessus ; les chiffres 1, 2, 5… règlent la valeur proposée dans le pavé.'
                : 'Scan ou recherche d’un consommable = mouvement immédiat (quantité ci-dessous), sans autre pop-up.'
              : 'Quand c’est actif, un consommable scanné déclenche un mouvement de stock (rafale) ou l’ouverture du pavé, selon l’option ci-dessous.'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity
              style={[s.burstModeBtn, consoBurstType === 'sortie' && s.burstModeBtnActive]}
              onPress={() => setConsoBurstType('sortie')}
            >
              <Text style={s.burstModeText}>Sortie</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.burstModeBtn, consoBurstType === 'entrée' && s.burstModeBtnActive]}
              onPress={() => setConsoBurstType('entrée')}
            >
              <Text style={s.burstModeText}>Entrée</Text>
            </TouchableOpacity>
          </View>
          {consoBurstEnabled && (
            <TouchableOpacity
              style={[
                s.burstNumpadToggle,
                consoBurstAskQtyEachScan && s.burstNumpadToggleOn,
              ]}
              onPress={() => setConsoBurstAskQtyEachScan(v => !v)}
              activeOpacity={0.85}
            >
              <Text style={s.burstNumpadToggleText}>
                {consoBurstAskQtyEachScan
                  ? 'Pavé numérique : à chaque article'
                  : 'Pavé numérique : désactivé (quantité unique ci-dessous)'}
              </Text>
            </TouchableOpacity>
          )}
          <Text
            style={{
              color: Colors.textMuted,
              fontSize: 11,
              marginTop: 6,
              marginBottom: 2,
            }}
          >
            {consoBurstAskQtyEachScan ? 'Quantité proposée dans le pavé (modifiable)' : 'Quantité appliquée à chaque scan'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {['1', '2', '5', '10', '20'].map(q => (
              <TouchableOpacity
                key={q}
                style={[s.burstQtyBtn, consoBurstQty === q && s.burstQtyBtnActive]}
                onPress={() => setConsoBurstQty(q)}
              >
                <Text style={s.burstQtyText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[s.undoBtn, (!lastConsoMove || undoBusy) && { opacity: 0.55 }]}
            onPress={undoLastConsoMove}
            disabled={!lastConsoMove || undoBusy}
          >
            <Text style={s.undoBtnText}>
              {undoBusy
                ? 'Undo en cours...'
                : lastConsoMove
                  ? `Undo dernier mouvement (${lastConsoMove.nom})`
                  : 'Undo dernier mouvement'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={s.tipBox}>
          <Text style={s.tipIcon}>💡</Text>
          <Text style={s.tipText}>
            Les puces NFC doivent contenir l’ID ou le numéro de série du matériel en texte ou URL.
          </Text>
        </View>

        {manualSearchActive &&
          manualInput.trim().length > 0 &&
          recentMat.length === 0 &&
          manualConsoResults.length === 0 && (
            <Text style={s.noResultsText}>Aucun matériel ni consommable ne correspond à « {manualInput.trim()} ».</Text>
          )}

        {recentMat.length > 0 && (
          <>
            <Text style={s.sectionLabel}>{manualSearchActive ? 'MATÉRIELS' : 'DERNIERS AJOUTS'}</Text>
            {recentMat.map(mat => (
              <Card
                key={mat.id}
                onPress={() =>
                  navigation.navigate('Stock', {
                    screen: 'MaterielDetail',
                    params: { materielId: mat.id },
                  })
                }
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ fontSize: 22 }}>📦</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.matName}>{mat.nom}</Text>
                      {!!mat.categorie_nom?.trim() && (
                        <Text style={s.matSub} numberOfLines={2}>
                          {mat.categorie_nom}
                        </Text>
                      )}
                      {mat.numero_serie ? (
                        <Text style={s.matSub}>
                          {mat.marque ? mat.marque + ' · ' : ''}
                          {mat.numero_serie}
                        </Text>
                      ) : mat.marque ? (
                        <Text style={s.matSub}>{mat.marque}</Text>
                      ) : null}
                    </View>
                  </View>
                  <EtatBadge etat={mat.etat} />
                </View>
              </Card>
            ))}
          </>
        )}

        {manualSearchActive && manualConsoResults.length > 0 && (
          <>
            <Text style={[s.sectionLabel, { marginTop: 10 }]}>CONSOMMABLES</Text>
            {manualConsoResults.map(conso => (
              <Card
                key={conso.id}
                onPress={() => {
                  if (consoBurstEnabled) {
                    if (consoBurstAskQtyEachScan) {
                      setBurstNumpadConso(conso);
                    } else {
                      void applyConsoBurst(conso);
                    }
                  } else {
                    openConsoMove(conso);
                  }
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ fontSize: 22 }}>🛒</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.matName}>{conso.nom}</Text>
                      <Text style={s.matSub} numberOfLines={2}>
                        {[conso.categorie_nom?.trim(), conso.reference?.trim()].filter(Boolean).join(' · ') ||
                          ' '}
                        {conso.stock_actuel != null ? ` · Stock ${conso.stock_actuel} ${conso.unite}` : ''}
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
      {renderConsoMoveModal()}
    </TabScreenSafeArea>
  );
}

const CARD_RADIUS = 18;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: Colors.white, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 8 },
  screenTitle: {
    color: Colors.white,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 16,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.green,
    borderRadius: CARD_RADIUS,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 14,
  },
  heroCardIcon: { fontSize: 32, color: Colors.white, width: 44, textAlign: 'center' },
  heroCardTextCol: { flex: 1 },
  heroCardTitle: { color: Colors.white, fontSize: 17, fontWeight: '800' },
  heroCardSub: { color: 'rgba(255,255,255,0.88)', fontSize: 13, marginTop: 4, fontWeight: '500' },
  heroChevron: { fontSize: 28, color: Colors.white, fontWeight: '300', opacity: 0.95 },
  secondaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: CARD_RADIUS,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryCardIcon: { fontSize: 28, width: 44, textAlign: 'center' },
  secondaryCardTitle: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  secondaryCardSub: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  secondaryChevron: { fontSize: 26, color: Colors.textMuted, fontWeight: '300' },
  ouRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 12,
  },
  ouLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  ouText: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  manualCard: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#3F4555',
    padding: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(26,31,42,0.35)',
  },
  manualCardLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  manualCardHint: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  noResultsText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  manualRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  manualInput: {
    flex: 1,
    backgroundColor: Colors.bgInput,
    borderRadius: 12,
    color: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.bgInputBorder,
  },
  manualSearchBtn: {
    backgroundColor: Colors.green,
    borderRadius: 12,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualSearchBtnText: { fontSize: 18 },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.greenBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.greenMuted,
    padding: 14,
    marginBottom: 20,
  },
  tipIcon: { fontSize: 18, marginTop: 1 },
  tipText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  btnGreen: {
    backgroundColor: Colors.green,
    borderRadius: CARD_RADIUS,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnGreenText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  btnDark: {
    backgroundColor: Colors.bgCard,
    borderRadius: CARD_RADIUS,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: CARD_RADIUS,
    paddingVertical: 16,
    alignItems: 'center',
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },
  matName: { color: Colors.white, fontSize: 15, fontWeight: '600' },
  matSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  alertBox: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    alignItems: 'center',
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
    position: 'absolute', left: 20, right: 20,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
    justifyContent: 'center',
  },
  statPill: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: '22%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statPillWarn: { borderColor: Colors.red },
  statNum: { color: Colors.white, fontSize: 18, fontWeight: '800' },
  statLbl: { color: Colors.textMuted, fontSize: 10, marginTop: 2, fontWeight: '600' },
  qtyChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCardAlt,
  },
  qtyChipText: { color: Colors.white, fontWeight: '700', fontSize: 12 },
  moveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  moveBtnOut: {
    backgroundColor: Colors.bgCard,
    borderColor: Colors.red,
  },
  moveBtnIn: {
    backgroundColor: Colors.bgElevated,
    borderColor: Colors.greenMuted,
  },
  moveBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  burstCard: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    padding: 14,
    marginBottom: 14,
  },
  burstTitle: { color: Colors.white, fontSize: 15, fontWeight: '800' },
  burstSub: { color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
  burstToggle: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCardAlt,
  },
  burstToggleOn: { borderColor: Colors.greenMuted, backgroundColor: Colors.bgElevated },
  burstToggleText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  burstModeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  burstModeBtnActive: { borderColor: Colors.textSecondary, backgroundColor: Colors.bgElevated },
  burstModeText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  burstNumpadToggle: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCardAlt,
  },
  burstNumpadToggleOn: { borderColor: Colors.greenMuted, backgroundColor: Colors.bgElevated },
  burstNumpadToggleText: { color: Colors.white, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  burstQtyBtn: {
    minWidth: 44,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.bgCardAlt,
  },
  burstQtyBtnActive: { borderColor: Colors.textSecondary, backgroundColor: Colors.bgElevated },
  burstQtyText: { color: Colors.white, fontWeight: '700', fontSize: 12 },
  burstBadge: {
    backgroundColor: 'rgba(11,12,15,0.9)',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  burstBadgeTitle: { color: Colors.white, fontSize: 12, fontWeight: '800' },
  burstBadgeSub: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  undoBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.bgCardAlt,
  },
  undoBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
});
