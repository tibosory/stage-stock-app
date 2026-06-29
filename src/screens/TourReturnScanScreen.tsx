import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Card, Input, ScreenHeader, TabScreenSafeArea } from '../components/UI';
import { Colors, Shadow } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { useAppAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getTourUseCase } from '../application/usecases';
import { returnAssignedMaterial } from '../application/usecases';
import { MaterialService } from '../application/services';
import { AssignmentService } from '../services/tracking';
import { findMaterielForTourScan } from '../db/inventoryOpsDb';
import type { Assignment, Materiel, Tour } from '../types';
import {
  assignmentStatusLabel,
  tourStatusLabel,
} from '../lib/tourTrackingLabels';
import { triggerScanMatchHaptic } from '../lib/scanHaptic';
import { pickBarcodeAtTap, rememberDetectedBarcode } from '../lib/tapToScanBarcode';
import {
  filterManualReturnCandidates,
  findPendingAssignmentForMaterial,
  summarizeTourReturns,
} from '../lib/tourReturnScan';
import { useNfc } from '../hooks/useNfc';

export default function TourReturnScanScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAppAuth();
  const tourId = String(route.params?.tourId ?? '');

  const [tour, setTour] = useState<Tour | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [materials, setMaterials] = useState<Materiel[]>([]);
  const [manualQuery, setManualQuery] = useState('');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLockRef = useRef(false);
  const detectedBarcodesRef = useRef<Map<string, BarcodeScanningResult>>(new Map());
  const { nfcSupported, nfcEnabled, scanning: nfcBusy, readNfcTagId } = useNfc();

  const load = useCallback(async () => {
    const [t, a, m] = await Promise.all([
      getTourUseCase(tourId),
      AssignmentService.listByTour(tourId),
      MaterialService.listAll(),
    ]);
    setTour(t ?? null);
    setAssignments(a);
    setMaterials(m);
  }, [tourId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: tour?.name?.trim() ? `${t('tour.returnScan.title')} — ${tour.name}` : t('tour.returnScan.title'),
    });
  }, [navigation, t, tour?.name]);

  const summary = summarizeTourReturns(assignments);
  const materialById = new Map(materials.map(m => [m.id, m]));
  const manualCandidates = filterManualReturnCandidates(summary.pendingAssignments, materials, manualQuery);

  const returnAssignment = useCallback(
    async (assignment: Assignment) => {
      try {
        await returnAssignedMaterial({ assignmentId: assignment.id, userId: user?.id });
        await triggerScanMatchHaptic();
        const updated = await AssignmentService.listByTour(tourId);
        setAssignments(updated);
        const next = summarizeTourReturns(updated);
        if (next.pendingAssignments.length === 0 && next.totalExpected > 0) {
          Alert.alert(t('tour.returnScan.allReturnedTitle'), t('tour.returnScan.allReturnedBody'));
        }
      } catch (e: unknown) {
        Alert.alert(t('tour.detail.returnError'), e instanceof Error ? e.message : String(e));
      }
    },
    [t, tourId, user?.id]
  );

  const processReturnCode = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      const m = await findMaterielForTourScan(code);
      if (!m) {
        Alert.alert(t('tour.detail.unknownCodeTitle'), t('tour.returnScan.unknownCodeBody'));
        return;
      }
      const pending = findPendingAssignmentForMaterial(assignments, tourId, m.id);
      if (!pending) {
        const onTour = assignments.some(a => a.materialId === m.id);
        if (onTour) {
          Alert.alert(t('tour.returnScan.alreadyReturnedTitle'), `${m.nom}\n\n${t('tour.returnScan.alreadyReturnedBody')}`);
        } else {
          Alert.alert(t('tour.returnScan.notOnTourTitle'), `${m.nom}\n\n${t('tour.returnScan.notOnTourBody')}`);
        }
        return;
      }
      setQrModalOpen(false);
      await returnAssignment(pending);
    },
    [assignments, returnAssignment, t, tourId]
  );

  const openQrScanner = useCallback(async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert(t('tour.detail.cameraTitle'), t('tour.detail.cameraBody'));
        return;
      }
    }
    detectedBarcodesRef.current.clear();
    scanLockRef.current = false;
    setQrModalOpen(true);
  }, [permission?.granted, requestPermission, t]);

  const onBarcodeDetected = useCallback(
    (res: BarcodeScanningResult) => {
      if (!qrModalOpen || scanLockRef.current) return;
      rememberDetectedBarcode(detectedBarcodesRef.current, res);
    },
    [qrModalOpen]
  );

  const onCameraTap = useCallback(
    (locationX: number, locationY: number) => {
      if (!qrModalOpen || scanLockRef.current) return;
      const picked = pickBarcodeAtTap(
        Array.from(detectedBarcodesRef.current.values()),
        locationX,
        locationY
      );
      if (!picked) {
        Vibration.vibrate(40);
        return;
      }
      scanLockRef.current = true;
      void (async () => {
        try {
          await processReturnCode(picked.data?.trim() ?? '');
        } finally {
          setTimeout(() => {
            scanLockRef.current = false;
          }, 600);
        }
      })();
    },
    [processReturnCode, qrModalOpen]
  );

  const onNfcReturn = useCallback(async () => {
    try {
      const tagId = await readNfcTagId();
      if (!tagId) return;
      await processReturnCode(tagId);
    } catch (e: unknown) {
      Alert.alert(t('tour.detail.returnError'), e instanceof Error ? e.message : String(e));
    }
  }, [processReturnCode, readNfcTagId, t]);

  const tourSubtitle = tour
    ? `${tourStatusLabel(tour.status)} · ${summary.returnedCount}/${summary.totalExpected} ${t('tour.returnScan.returnedShort')}`
    : t('common.loading');

  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          icon={<Text style={s.headerIcon}>↩️</Text>}
          title={t('tour.returnScan.title')}
          subtitle={tourSubtitle}
        />

        <TouchableOpacity style={s.backLink} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={s.backLinkText}>{t('tour.returnScan.backToDetail')}</Text>
        </TouchableOpacity>

        <Card>
          <Text style={s.step}>{t('tour.returnScan.progressTitle')}</Text>
          <Text style={s.progress}>
            {t('tour.returnScan.progressBody', {
              returned: summary.returnedCount,
              total: summary.totalExpected,
              missing: summary.pendingAssignments.length,
            })}
          </Text>
          {summary.pendingAssignments.length === 0 && summary.totalExpected > 0 ? (
            <Text style={s.success}>{t('tour.returnScan.completeHint')}</Text>
          ) : null}
        </Card>

        <Card>
          <Text style={s.step}>{t('tour.returnScan.scanTitle')}</Text>
          <Text style={s.hint}>{t('tour.returnScan.scanHint')}</Text>
          <View style={s.scanRow}>
            <TouchableOpacity style={s.btnPrimary} onPress={() => void openQrScanner()} accessibilityRole="button">
              <Text style={s.btnPrimaryText}>{t('tour.returnScan.scanQr')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnSecondary, (!nfcSupported || !nfcEnabled || nfcBusy) && s.btnDisabled]}
              onPress={() => void onNfcReturn()}
              disabled={!nfcSupported || !nfcEnabled || nfcBusy}
              accessibilityRole="button"
            >
              {nfcBusy ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={s.btnSecondaryText}>{t('tour.detail.readNfc')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </Card>

        <Card>
          <Text style={s.step}>{t('tour.returnScan.manualTitle')}</Text>
          <Text style={s.hint}>{t('tour.returnScan.manualHint')}</Text>
          <Input
            label={t('tour.returnScan.manualSearchLabel')}
            value={manualQuery}
            onChangeText={setManualQuery}
            placeholder={t('tour.returnScan.manualSearchPlaceholder')}
          />
          {summary.pendingAssignments.length === 0 ? (
            <Text style={s.muted}>{t('tour.returnScan.noPendingManual')}</Text>
          ) : manualCandidates.length === 0 ? (
            <Text style={s.muted}>{t('tour.returnScan.manualNoMatch')}</Text>
          ) : (
            manualCandidates.map(({ assignment, material }) => (
              <TouchableOpacity
                key={assignment.id}
                style={s.manualRow}
                onPress={() => void returnAssignment(assignment)}
                accessibilityRole="button"
              >
                <Text style={s.manualName}>{material.nom}</Text>
                {material.numero_serie ? (
                  <Text style={s.manualMeta}>{t('tour.returnScan.serial')}: {material.numero_serie}</Text>
                ) : null}
                {!material.qr_code ? (
                  <Text style={s.manualBadge}>{t('tour.returnScan.noQrBadge')}</Text>
                ) : null}
                <Text style={s.manualAction}>{t('tour.returnScan.tapToReturn')}</Text>
              </TouchableOpacity>
            ))
          )}
        </Card>

        <Card>
          <Text style={s.step}>{t('tour.returnScan.missingTitle')}</Text>
          <Text style={s.hint}>{t('tour.returnScan.missingHint')}</Text>
          {summary.pendingAssignments.length === 0 ? (
            <Text style={s.muted}>{t('tour.returnScan.noMissing')}</Text>
          ) : (
            summary.pendingAssignments.map(a => {
              const name = materialById.get(a.materialId)?.nom ?? a.materialId;
              return (
                <View key={a.id} style={s.missingRow}>
                  <Text style={s.missingName}>{name}</Text>
                  <Text style={s.missingStatus}>{assignmentStatusLabel(a.status)} · x{a.quantity}</Text>
                </View>
              );
            })
          )}
        </Card>

        {summary.returnedAssignments.length > 0 ? (
          <Card>
            <Text style={s.step}>{t('tour.returnScan.returnedTitle')}</Text>
            {summary.returnedAssignments.map(a => {
              const name = materialById.get(a.materialId)?.nom ?? a.materialId;
              return (
                <View key={a.id} style={s.returnedRow}>
                  <Text style={s.returnedName}>{name}</Text>
                  <Text style={s.returnedOk}>✓</Text>
                </View>
              );
            })}
          </Card>
        ) : null}
      </ScrollView>

      <Modal visible={qrModalOpen} animationType="slide" onRequestClose={() => setQrModalOpen(false)}>
        <View style={[s.modalRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          {permission?.granted ? (
            <Pressable
              style={s.cameraTap}
              onPress={event => onCameraTap(event.nativeEvent.locationX, event.nativeEvent.locationY)}
              accessibilityRole="button"
              accessibilityLabel={t('tour.returnScan.scanModalHint')}
            >
              <CameraView
                style={s.camera}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
                }}
                onBarcodeScanned={onBarcodeDetected}
              />
            </Pressable>
          ) : (
            <Text style={s.modalHint}>{t('scanner.cameraPermission')}</Text>
          )}
          <Text style={s.modalTitle}>{t('tour.returnScan.scanModalHint')}</Text>
          <TouchableOpacity style={s.modalClose} onPress={() => setQrModalOpen(false)} accessibilityRole="button">
            <Text style={s.modalCloseText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </TabScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xl * 2 },
  headerIcon: { fontSize: 28 },
  backLink: { marginBottom: Spacing.sm },
  backLinkText: { ...Typography.body, color: Colors.green, fontWeight: '600' },
  step: { ...Typography.sectionTitle, marginBottom: Spacing.xs },
  hint: { ...Typography.caption, marginBottom: Spacing.sm },
  progress: { ...Typography.body, lineHeight: 22 },
  success: { ...Typography.body, color: Colors.green, marginTop: Spacing.sm, fontWeight: '600' },
  scanRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnPrimary: {
    flex: 1,
    backgroundColor: Colors.green,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    ...Shadow.card,
  },
  btnPrimaryText: { ...Typography.body, color: Colors.white, fontWeight: '700' },
  btnSecondary: {
    flex: 1,
    backgroundColor: Colors.bgCardAlt,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnSecondaryText: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
  btnDisabled: { opacity: 0.45 },
  manualRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingVertical: Spacing.sm,
  },
  manualName: { ...Typography.body, fontWeight: '600' },
  manualMeta: { ...Typography.caption, marginTop: 2 },
  manualBadge: {
    ...Typography.caption,
    color: Colors.alerteOrange,
    marginTop: 4,
    fontWeight: '600',
  },
  manualAction: { ...Typography.caption, color: Colors.green, marginTop: 4 },
  missingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingVertical: Spacing.sm,
    gap: 8,
  },
  missingName: { ...Typography.body, flex: 1, fontWeight: '600' },
  missingStatus: { ...Typography.caption, color: Colors.alerteOrange },
  returnedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingVertical: Spacing.xs,
  },
  returnedName: { ...Typography.bodySecondary },
  returnedOk: { color: Colors.green, fontSize: 16, fontWeight: '700' },
  muted: { ...Typography.bodySecondary, fontStyle: 'italic', marginTop: Spacing.xs },
  modalRoot: { flex: 1, backgroundColor: '#000' },
  cameraTap: { flex: 1 },
  camera: { flex: 1 },
  modalTitle: {
    ...Typography.body,
    color: Colors.white,
    textAlign: 'center',
    padding: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalHint: { color: Colors.white, textAlign: 'center', padding: Spacing.lg },
  modalClose: {
    padding: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.green,
  },
  modalCloseText: { ...Typography.body, color: Colors.white, fontWeight: '700' },
});
