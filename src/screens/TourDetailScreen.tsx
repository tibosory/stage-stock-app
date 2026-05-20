import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { WebView } from 'react-native-webview';
import { format, isValid, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, Input, SelectPicker, TabScreenSafeArea, ScreenHeader } from '../components/UI';
import { Colors, Shadow } from '../theme/colors';
import { Typography } from '../theme/typography';
import { HitSlop, Spacing } from '../theme/spacing';
import {
  moveAssignedMaterial,
  reportAssignedMaterialIssue,
  returnAssignedMaterial,
  setAssignedMaterialInUse,
} from '../application/usecases';
import { useAppAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTourDetailViewModel } from '../ui/hooks/useTourDetailViewModel';
import { useNfc } from '../hooks/useNfc';
import { findMaterielForTourScan } from '../db/inventoryOpsDb';
import type { Assignment, TourDocument, TourLocation } from '../types';
import {
  addTourDocument,
  deleteTour,
  deleteTourDocument,
  findTourFlightcaseByScan,
  listTourDocuments,
  updateTourDocumentTitle,
} from '../db/trackingDb';
import { AssignmentService } from '../services/tracking';
import {
  assignmentStatusColor,
  assignmentStatusHint,
  assignmentStatusLabel,
  tourStatusLabel,
} from '../lib/tourTrackingLabels';
import { triggerScanMatchHaptic } from '../lib/scanHaptic';
import { showTourLifecycleMenu } from '../lib/tourLifecyclePrompt';
import { exportFlightcaseContentPdf, exportFlightcaseQrLabelsPdf } from '../lib/pdfTourFlightcases';

function formatAssignedAt(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, "d MMM yyyy '·' HH:mm", { locale: fr }) : iso;
}

function roundWeightKg(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatWeightKg(value: number): string {
  return `${roundWeightKg(value).toFixed(2)} kg`;
}

function fileNameFromUri(uri: string): string {
  const clean = uri.split('?')[0];
  const idx = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
  return idx >= 0 ? clean.slice(idx + 1) : clean;
}

function isImageDocument(doc: TourDocument): boolean {
  const mt = (doc.mimeType ?? '').toLowerCase();
  const n = doc.fileName.toLowerCase();
  return mt.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(n);
}

function isPdfDocument(doc: TourDocument): boolean {
  const mt = (doc.mimeType ?? '').toLowerCase();
  return mt.includes('pdf') || /\.pdf$/i.test(doc.fileName);
}

export default function TourDetailScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAppAuth();
  const tourId = String(route.params?.tourId ?? '');
  const {
    tour,
    locations,
    assignments,
    locName,
    setLocName,
    locAddress,
    setLocAddress,
    materialId,
    setMaterialId,
    locationId,
    setLocationId,
    flightcases,
    flightcaseId,
    setFlightcaseId,
    quantity,
    setQuantity,
    load,
    addLocation,
    assign,
    assignWithMaterialId,
    materials,
    materialOptions,
    locationOptions,
    flightcaseOptions,
  } = useTourDetailViewModel(tourId, user?.id);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: tour?.name?.trim() ? tour.name : t('tour.titleFallback'),
    });
  }, [navigation, t, tour?.name]);

  const [permission, requestPermission] = useCameraPermissions();
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [burstMode, setBurstMode] = useState(false);
  const [burstTargetCount, setBurstTargetCount] = useState('5');
  const [burstRemaining, setBurstRemaining] = useState(0);
  const [recentAssignmentIds, setRecentAssignmentIds] = useState<string[]>([]);
  const [tourDocuments, setTourDocuments] = useState<TourDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<TourDocument | null>(null);
  const [renameDoc, setRenameDoc] = useState<TourDocument | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const scanLockRef = useRef(false);
  const { nfcSupported, nfcEnabled, scanning: nfcBusy, readNfcTag, readNfcTagId } = useNfc();
  const materialById = new Map(materials.map(m => [m.id, m] as const));

  const assignmentWeightKg = useCallback(
    (a: Assignment): number => {
      const perUnit = Number(materialById.get(a.materialId)?.poids_kg ?? 0);
      if (!Number.isFinite(perUnit) || perUnit <= 0) return 0;
      return perUnit * Math.max(1, Number(a.quantity) || 1);
    },
    [materialById]
  );

  const flightcaseTotalWeightKg = useCallback(
    (caseId: string): number =>
      assignments
        .filter(
          a =>
            a.flightcaseId === caseId &&
            (a.status === 'assigned' || a.status === 'in_use' || a.status === 'damaged')
        )
        .reduce((sum, a) => sum + assignmentWeightKg(a), 0),
    [assignmentWeightKg, assignments]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void listTourDocuments(tourId)
        .then(rows => {
          if (!alive) return;
          setTourDocuments(rows);
        })
        .catch(() => {
          if (!alive) return;
          setTourDocuments([]);
        });
      return () => {
        alive = false;
      };
    }, [tourId])
  );

  useEffect(() => {
    if (qrModalOpen) scanLockRef.current = false;
  }, [qrModalOpen]);

  const locationName = useCallback(
    (id: string | null | undefined) => {
      if (!id) return t('tour.detail.noLocation');
      return locations.find(l => l.id === id)?.name ?? t('tour.detail.unknownLocation');
    },
    [locations, t]
  );

  const proposeAssignAfterResolve = useCallback(
    (nom: string, materialIdResolved: string) => {
      const locLabel =
        locationOptions.find(o => o.value === locationId)?.label ?? (locationId ? t('common.dash') : t('tour.detail.noSpecificLocation'));
      const qty = Math.max(1, Math.floor(Number(quantity) || 1));
      Alert.alert(
        t('tour.detail.addToTourTitle'),
        t('tour.detail.addToTourBody', { nom, locLabel, qty }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('tour.detail.confirmAssign'),
            onPress: () => {
              void assignWithMaterialId(materialIdResolved).catch((e: unknown) =>
                Alert.alert(t('tour.detail.assignError'), e instanceof Error ? e.message : String(e))
              );
            },
          },
        ]
      );
    },
    [assignWithMaterialId, locationId, locationOptions, quantity]
  );

  const openQrScanner = useCallback(async () => {
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        Alert.alert(t('tour.detail.cameraTitle'), t('tour.detail.cameraBody'));
        return;
      }
    }
    setQrModalOpen(true);
  }, [permission?.granted, requestPermission]);

  const onBarcodeScanned = useCallback(
    (res: BarcodeScanningResult) => {
      if (!qrModalOpen || scanLockRef.current) return;
      scanLockRef.current = true;
      void (async () => {
        try {
          const data = res.data?.trim() ?? '';
          const scannedFlightcase = await findTourFlightcaseByScan(data);
          if (scannedFlightcase && scannedFlightcase.tourId === tourId) {
            const inCase = assignments.filter(
              a =>
                a.flightcaseId === scannedFlightcase.id &&
                (a.status === 'assigned' || a.status === 'in_use' || a.status === 'damaged')
            );
            const totalWeightKg = inCase.reduce((sum, a) => sum + assignmentWeightKg(a), 0);
            const lines =
              inCase.length === 0
                ? t('tour.detail.noMaterialAssignedInFlightcase')
                : inCase
                    .slice(0, 12)
                    .map(a => {
                      const lineWeight = assignmentWeightKg(a);
                      return `• ${(materials.find(m => m.id === a.materialId)?.nom ?? a.materialId)} x${a.quantity}${
                        lineWeight > 0 ? ` · ${formatWeightKg(lineWeight)}` : ''
                      }`;
                    })
                    .join('\n');
            setQrModalOpen(false);
            Alert.alert(
              `Flightcase ${scannedFlightcase.label}`,
              `${lines}\n\n${t('tour.detail.totalWeight')}: ${formatWeightKg(totalWeightKg)}`
            );
            return;
          }
          const m = await findMaterielForTourScan(data);
          if (!m) {
            Alert.alert(
              t('tour.detail.unknownCodeTitle'),
              t('tour.detail.unknownCodeBody')
            );
            return;
          }
          void triggerScanMatchHaptic();
          if (burstMode) {
            const created = await assignWithMaterialId(m.id);
            setRecentAssignmentIds(prev => [created.id, ...prev].slice(0, 20));
            setBurstRemaining(prev => {
              const next = Math.max(0, prev - 1);
              if (next === 0) {
                setQrModalOpen(false);
                setBurstMode(false);
                Alert.alert(t('tour.detail.scanFinishedTitle'), t('tour.detail.scanFinishedBody'));
              }
              return next;
            });
            return;
          }
          setQrModalOpen(false);
          proposeAssignAfterResolve(m.nom, m.id);
        } finally {
          setTimeout(() => {
            scanLockRef.current = false;
          }, 600);
        }
      })();
    },
    [assignWithMaterialId, assignments, burstMode, materials, proposeAssignAfterResolve, qrModalOpen, tourId]
  );

  const exportFlightcaseContent = useCallback(
    async (flightcaseIdToPrint: string) => {
      if (!tour) return;
      const fc = flightcases.find(x => x.id === flightcaseIdToPrint);
      if (!fc) return;
      const items = assignments
        .filter(
          a =>
            a.flightcaseId === flightcaseIdToPrint &&
            (a.status === 'assigned' || a.status === 'in_use' || a.status === 'damaged')
        )
        .map(a => ({
          materialName: materials.find(m => m.id === a.materialId)?.nom ?? a.materialId,
          quantity: a.quantity,
          lineWeightKg: assignmentWeightKg(a),
          locationName: locationName(a.locationId),
          statusLabel: assignmentStatusLabel(a.status),
        }));
      await exportFlightcaseContentPdf({
        tourName: tour.name,
        flightcaseLabel: fc.label,
        items,
      });
    },
    [assignments, flightcases, locationName, materials, tour]
  );

  const exportFlightcaseQr = useCallback(
    async (flightcaseIdToPrint: string) => {
      if (!tour) return;
      const fc = flightcases.find(x => x.id === flightcaseIdToPrint);
      if (!fc) return;
      await exportFlightcaseQrLabelsPdf({
        tourName: tour.name,
        flightcases: [{ label: fc.label, qrCode: fc.qrCode }],
      });
    },
    [flightcases, tour]
  );

  const openFlightcaseLongPressMenu = useCallback(
    (flightcaseIdToPrint: string) => {
      const fc = flightcases.find(x => x.id === flightcaseIdToPrint);
      if (!fc) return;
      Alert.alert(`Flightcase ${fc.label}`, t('tour.detail.chooseAction'), [
        {
          text: t('tour.detail.printMaterialList'),
          onPress: () => {
            void exportFlightcaseContent(flightcaseIdToPrint).catch((e: unknown) =>
              Alert.alert(t('common.pdf'), e instanceof Error ? e.message : String(e))
            );
          },
        },
        {
          text: t('tour.detail.printQrContent'),
          onPress: () => {
            void exportFlightcaseQr(flightcaseIdToPrint).catch((e: unknown) =>
              Alert.alert(t('common.pdf'), e instanceof Error ? e.message : String(e))
            );
          },
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    },
    [exportFlightcaseContent, exportFlightcaseQr, flightcases, t]
  );

  const onNfcAssign = useCallback(async () => {
    let m = null as Awaited<ReturnType<typeof findMaterielForTourScan>>;
    const text = await readNfcTag();
    if (text?.trim()) {
      m = await findMaterielForTourScan(text);
    }
    if (!m) {
      const hw = await readNfcTagId();
      if (hw?.trim()) {
        m = await findMaterielForTourScan(hw);
      }
    }
    if (!m) {
      Alert.alert(
        t('tour.detail.nfcTitle'),
        t('tour.detail.nfcNotFoundBody')
      );
      return;
    }
    void triggerScanMatchHaptic();
    if (burstMode) {
      const created = await assignWithMaterialId(m.id);
      setRecentAssignmentIds(prev => [created.id, ...prev].slice(0, 20));
      setBurstRemaining(prev => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          setBurstMode(false);
          Alert.alert(t('tour.detail.scanFinishedTitle'), t('tour.detail.scanFinishedBody'));
        }
        return next;
      });
      return;
    }
    proposeAssignAfterResolve(m.nom, m.id);
  }, [assignWithMaterialId, burstMode, proposeAssignAfterResolve, readNfcTag, readNfcTagId]);

  const uploadTourDocument = useCallback(async () => {
    setUploadingDoc(true);
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: '*/*',
      });
      if (pick.canceled) return;
      const asset = pick.assets?.[0];
      if (!asset?.uri) return;

      const fallbackName = fileNameFromUri(asset.uri) || `document-${Date.now()}`;
      const originalName = (asset.name || fallbackName).trim() || fallbackName;
      const safeName = originalName.replace(/[^\w.\- ()]/g, '_');
      const baseDir = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}tour-documents/${tourId}`;
      await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
      const localUri = `${baseDir}/${Date.now()}-${safeName}`;
      await FileSystem.copyAsync({ from: asset.uri, to: localUri });

      const dot = safeName.lastIndexOf('.');
      const title = dot > 0 ? safeName.slice(0, dot) : safeName;
      const created = await addTourDocument({
        tourId,
        title,
        fileName: safeName,
        mimeType: asset.mimeType ?? null,
        fileSize: asset.size ?? null,
        localUri,
      });
      setTourDocuments(prev => [created, ...prev]);
      Alert.alert(t('common.success'), t('tour.detail.docAdded'));
    } catch (e: unknown) {
      Alert.alert(t('tour.detail.docAddFail'), e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingDoc(false);
    }
  }, [t, tourId]);

  const openTourDocument = useCallback(
    async (doc: TourDocument) => {
      try {
        const uri = doc.localUri;
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
          const ok = await Linking.canOpenURL(uri);
          if (!ok) throw new Error(t('tour.detail.docOpenFail'));
          await Linking.openURL(uri);
          return;
        }
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: doc.mimeType ?? undefined,
            dialogTitle: doc.fileName,
          });
          return;
        }
        const ok = await Linking.canOpenURL(uri);
        if (!ok) throw new Error(t('tour.detail.docOpenFail'));
        await Linking.openURL(uri);
      } catch (e: unknown) {
        Alert.alert(t('tour.detail.docOpenFail'), e instanceof Error ? e.message : String(e));
      }
    },
    [t]
  );

  const removeTourDocument = useCallback(
    (doc: TourDocument) => {
      Alert.alert(t('tour.detail.docDeleteTitle'), t('tour.detail.docDeleteBody', { file: doc.fileName }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('tour.detail.deleteDocument'),
          style: 'destructive',
          onPress: async () => {
            try {
              const removed = await deleteTourDocument(doc.id);
              if (removed?.localUri?.startsWith('file://')) {
                try {
                  await FileSystem.deleteAsync(removed.localUri, { idempotent: true });
                } catch {
                  // ignore local cleanup failures
                }
              }
              setTourDocuments(prev => prev.filter(d => d.id !== doc.id));
            } catch (e: unknown) {
              Alert.alert(t('tour.detail.docDeleteFail'), e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]);
    },
    [t]
  );

  const startRenameTourDocument = useCallback((doc: TourDocument) => {
    setRenameDoc(doc);
    setRenameValue(doc.title || doc.fileName);
  }, []);

  const submitRenameTourDocument = useCallback(async () => {
    if (!renameDoc) return;
    try {
      const updated = await updateTourDocumentTitle(renameDoc.id, renameValue);
      if (!updated) throw new Error(t('tour.detail.docRenameInvalid'));
      setTourDocuments(prev => prev.map(d => (d.id === updated.id ? updated : d)));
      setRenameDoc(null);
      setRenameValue('');
    } catch (e: unknown) {
      Alert.alert(t('tour.detail.docRenameFail'), e instanceof Error ? e.message : String(e));
    }
  }, [renameDoc, renameValue, t]);

  const startBurstScan = useCallback(() => {
    const n = Math.max(1, Math.floor(Number(burstTargetCount) || 0));
    setBurstRemaining(n);
    setBurstMode(true);
    void openQrScanner();
  }, [burstTargetCount, openQrScanner]);

  const undoLastAssign = useCallback(async () => {
    const last = recentAssignmentIds[0];
    if (!last) {
      Alert.alert(t('tour.detail.undoTitle'), t('tour.detail.undoNone'));
      return;
    }
    try {
      await returnAssignedMaterial({ assignmentId: last, userId: user?.id, note: t('tour.detail.undoNote') });
      setRecentAssignmentIds(prev => prev.slice(1));
      await load();
      Alert.alert(t('tour.detail.undoTitle'), t('tour.detail.undoDone'));
    } catch (e: unknown) {
      Alert.alert(t('tour.detail.undoError'), e instanceof Error ? e.message : String(e));
    }
  }, [load, recentAssignmentIds, user?.id]);

  const openTourLifecycleMenu = useCallback(() => {
    if (tour) showTourLifecycleMenu(tour, load);
  }, [load, tour]);

  const confirmDeleteTour = useCallback(() => {
    if (!tour) return;
    Alert.alert(
      t('tour.detail.deleteTourTitle'),
      t('tour.detail.deleteTourBody', { name: tour.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('tour.detail.deleteTourConfirm'),
          style: 'destructive',
          onPress: () => {
            void deleteTour(tour.id)
              .then(() => {
                Alert.alert(t('common.success'), t('tour.detail.deleteTourDone'));
                navigation.goBack();
              })
              .catch((e: unknown) => {
                Alert.alert(t('tour.detail.deleteTourFail'), e instanceof Error ? e.message : String(e));
              });
          },
        },
      ]
    );
  }, [navigation, t, tour]);

  const promptMoveAssignment = useCallback(
    (a: Assignment) => {
      if (locations.length === 0) {
        Alert.alert(t('tour.detail.noLocationTitle'), t('tour.detail.noLocationBody'));
        return;
      }
      const buttons = locations.map((loc: TourLocation) => ({
        text: loc.name,
        onPress: () => {
          void moveAssignedMaterial({ assignmentId: a.id, locationId: loc.id, userId: user?.id })
            .then(load)
            .catch((e: unknown) => Alert.alert(t('tour.detail.moveError'), e instanceof Error ? e.message : String(e)));
        },
      }));
      Alert.alert(t('tour.detail.moveWhereTitle'), `${t('tour.detail.material')}: ${materials.find(m => m.id === a.materialId)?.nom ?? ''}`, [
        ...buttons,
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    },
    [locations, load, materials, user?.id]
  );

  const confirmReturn = useCallback(
    (a: Assignment) => {
      Alert.alert(
        t('tour.detail.returnToStockTitle'),
        t('tour.detail.returnToStockBody'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('tour.detail.confirmReturn'),
            onPress: () => {
              void returnAssignedMaterial({ assignmentId: a.id, userId: user?.id })
                .then(load)
                .catch((e: unknown) => Alert.alert(t('tour.detail.returnError'), e instanceof Error ? e.message : String(e)));
            },
          },
        ]
      );
    },
    [load, user?.id]
  );

  const confirmIssue = useCallback(
    (a: Assignment, kind: 'lost' | 'damaged') => {
      const title = kind === 'lost' ? t('tour.detail.reportLostTitle') : t('tour.detail.reportDamagedTitle');
      const body =
        kind === 'lost'
          ? t('tour.detail.reportLostBody')
          : t('tour.detail.reportDamagedBody');
      Alert.alert(title, body, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: kind === 'lost' ? t('tour.detail.reportLostAction') : t('tour.detail.reportDamagedAction'),
          style: 'destructive',
          onPress: () => {
            void reportAssignedMaterialIssue({ assignmentId: a.id, status: kind, userId: user?.id })
              .then(load)
              .catch((e: unknown) => Alert.alert(t('tour.detail.saveImpossible'), e instanceof Error ? e.message : String(e)));
          },
        },
      ]);
    },
    [load, t, user?.id]
  );

  const onAssignFromList = useCallback(async () => {
    try {
      await assign();
    } catch (e: unknown) {
      Alert.alert(t('tour.detail.assignError'), e instanceof Error ? e.message : String(e));
    }
  }, [assign]);

  const onAddLocation = useCallback(async () => {
    try {
      await addLocation();
    } catch (e: unknown) {
      Alert.alert(t('tour.detail.locationError'), e instanceof Error ? e.message : String(e));
    }
  }, [addLocation]);

  const setInUse = useCallback(
    (a: Assignment) => {
      void setAssignedMaterialInUse({ assignmentId: a.id, userId: user?.id })
        .then(load)
        .catch((e: unknown) => Alert.alert(t('tour.detail.actionError'), e instanceof Error ? e.message : String(e)));
    },
    [load, user?.id]
  );

  const updatePackagingPhoto = useCallback(
    async (assignmentId: string, photoUri: string | null) => {
      await AssignmentService.setPackagingPhoto({ assignmentId, photoUri });
      await load();
    },
    [load]
  );

  const pickPackagingPhoto = useCallback(
    async (a: Assignment, source: 'camera' | 'gallery') => {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
        const res = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
        if (!res.canceled && res.assets[0]) {
          await updatePackagingPhoto(a.id, res.assets[0].uri);
        }
        return;
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
      if (!res.canceled && res.assets[0]) {
        await updatePackagingPhoto(a.id, res.assets[0].uri);
      }
    },
    [updatePackagingPhoto]
  );

  const openPackagingPhotoMenu = useCallback(
    (a: Assignment) => {
      Alert.alert(t('tour.detail.photoTitle'), t('tour.detail.photoBody'), [
        {
          text: t('tour.detail.takePhoto'),
          onPress: () => {
            void pickPackagingPhoto(a, 'camera').catch((e: unknown) =>
              Alert.alert(t('tour.detail.photoError'), e instanceof Error ? e.message : String(e))
            );
          },
        },
        {
          text: t('tour.detail.chooseFromGallery'),
          onPress: () => {
            void pickPackagingPhoto(a, 'gallery').catch((e: unknown) =>
              Alert.alert(t('tour.detail.photoError'), e instanceof Error ? e.message : String(e))
            );
          },
        },
        ...(a.packagingPhotoLocal
          ? [
              {
                text: t('tour.detail.removePhoto'),
                style: 'destructive' as const,
                onPress: () => {
                  void updatePackagingPhoto(a.id, null).catch((e: unknown) =>
                    Alert.alert(t('tour.detail.photoDeleteError'), e instanceof Error ? e.message : String(e))
                  );
                },
              },
            ]
          : []),
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    },
    [pickPackagingPhoto, t, updatePackagingPhoto]
  );

  const tourSubtitle = tour
    ? `${tourStatusLabel(tour.status)} · début ${tour.startDate}${tour.endDate ? ` · fin ${tour.endDate}` : ''}`
    : t('common.loading');

  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          icon={<Text style={s.headerIcon}>🎪</Text>}
          title={t('tour.detail.title')}
          subtitle={tourSubtitle}
        />

        {tour ? (
          <View style={s.lifecycleBar}>
            <Text style={s.lifecycleLabel}>{t('tour.detail.orgState')}</Text>
            <View style={s.lifecycleActions}>
              <TouchableOpacity style={s.lifecycleBtn} onPress={openTourLifecycleMenu} accessibilityRole="button">
                <Text style={s.lifecycleBtnText}>{tourStatusLabel(tour.status)} — {t('common.edit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.lifecycleDeleteBtn}
                onPress={confirmDeleteTour}
                accessibilityRole="button"
              >
                <Text style={s.lifecycleDeleteBtnText}>{t('tour.detail.deleteTour')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <Card>
          <Text style={s.step}>{t('tour.detail.howItWorks')}</Text>
          <Text style={s.help}>
            1) Créez les lieux (ville, salle, camion…).{'\n'}
            2) Importez les documents utiles (plans AutoCAD, PDF techniques, etc.) pour l’équipe terrain.{'\n'}
            3) Choisissez le lieu par défaut et ajoutez du matériel depuis la liste ou plus vite avec le scan.{'\n'}
            4) Pour chaque ligne : déplacer = changer de lieu ; en service = sorti / utilisé ; retour = fin de suivi sur
            cette tournée.
          </Text>
          <TouchableOpacity
            style={s.linkBtn}
            onPress={() => navigation.navigate('ActivityLog', { tourId })}
            accessibilityRole="button"
            accessibilityLabel={t('tour.detail.a11y.viewHistory')}
          >
            <Text style={s.linkBtnText}>{t('tour.detail.viewActionHistory')}</Text>
          </TouchableOpacity>
        </Card>

        <Card>
          <Text style={s.step}>{t('tour.detail.stepLocations')}</Text>
          <Text style={s.hint}>{t('tour.detail.locationsHint')}</Text>
          <Input label={t('tour.detail.locationName')} value={locName} onChangeText={setLocName} placeholder={t('tour.detail.locationNamePlaceholder')} />
          <Input label={t('tour.detail.locationAddressOptional')} value={locAddress} onChangeText={setLocAddress} placeholder={t('tour.detail.locationAddressPlaceholder')} />
          <TouchableOpacity style={s.btnPrimary} onPress={() => void onAddLocation()} accessibilityRole="button">
            <Text style={s.btnPrimaryText}>{t('tour.detail.addLocation')}</Text>
          </TouchableOpacity>
          {locations.length === 0 ? (
            <Text style={s.muted}>{t('tour.detail.noLocationYetHint')}</Text>
          ) : (
            locations.map(l => (
              <View key={l.id} style={s.locRow}>
                <Text style={s.locName}>{l.name}</Text>
                {l.address ? <Text style={s.locAddr}>{l.address}</Text> : null}
              </View>
            ))
          )}
        </Card>

        <Card>
          <Text style={s.step}>{t('tour.detail.stepDocs')}</Text>
          <Text style={s.hint}>{t('tour.detail.docsHint')}</Text>
          <TouchableOpacity
            style={[s.btnSecondary, uploadingDoc && s.btnDisabled]}
            onPress={() => void uploadTourDocument()}
            disabled={uploadingDoc}
            accessibilityRole="button"
          >
            {uploadingDoc ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={s.btnSecondaryText}>{t('tour.detail.addDocument')}</Text>
            )}
          </TouchableOpacity>
          {tourDocuments.length === 0 ? (
            <Text style={s.muted}>{t('tour.detail.noDocumentYet')}</Text>
          ) : (
            tourDocuments.map(doc => (
              <View key={doc.id} style={s.docRow}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => void openTourDocument(doc)}
                  accessibilityRole="button"
                >
                  <Text style={s.docName} numberOfLines={2}>
                    {doc.fileName}
                  </Text>
                  <Text style={s.docMeta}>
                    {doc.title}
                    {doc.fileSize ? ` · ${(Number(doc.fileSize) / 1024 / 1024).toFixed(2)} MB` : ''}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionChip, s.docActionBtn]}
                  onPress={() => {
                    if (isImageDocument(doc) || isPdfDocument(doc)) {
                      setPreviewDoc(doc);
                    } else {
                      void openTourDocument(doc);
                    }
                  }}
                  accessibilityRole="button"
                >
                  <Text style={s.actionChipText}>{t('tour.detail.previewDocument')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionChip, s.docActionBtn]}
                  onPress={() => startRenameTourDocument(doc)}
                  accessibilityRole="button"
                >
                  <Text style={s.actionChipText}>{t('tour.detail.renameDocument')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionChip, s.docDeleteBtn]}
                  onPress={() => removeTourDocument(doc)}
                  accessibilityRole="button"
                >
                  <Text style={s.actionChipText}>{t('tour.detail.deleteDocument')}</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </Card>

        <Card>
          <Text style={s.step}>{t('tour.detail.stepAssign')}</Text>
          <Text style={s.hint}>
            Seules les fiches au statut « en stock » peuvent être affectées. Une fiche = 1 unité physique. Vous pouvez
            ajouter du matériel dans un flightcase, ou hors flightcase.
          </Text>
          {flightcases.length > 0 ? (
            <>
              <Text style={s.flightcaseLabel}>{t('tour.detail.targetFlightcase')}</Text>
              <View style={s.flightcaseGrid}>
                {flightcases.map(fc => {
                  const active = fc.id === flightcaseId;
                  return (
                    <TouchableOpacity
                      key={fc.id}
                      style={[s.flightcaseBtn, active && s.flightcaseBtnActive]}
                      onPress={() => setFlightcaseId(fc.id)}
                      onLongPress={() => openFlightcaseLongPressMenu(fc.id)}
                      delayLongPress={450}
                      accessibilityRole="button"
                      accessibilityLabel={`Choisir flightcase ${fc.label}`}
                    >
                      <View style={[s.flightcaseHandle, active && s.flightcaseHandleActive]} />
                      <View style={s.flightcaseCornerTL} />
                      <View style={s.flightcaseCornerTR} />
                      <View style={s.flightcaseCornerBL} />
                      <View style={s.flightcaseCornerBR} />
                      <View style={s.flightcaseTopBar}>
                        <Text style={[s.flightcaseTopBarText, active && s.flightcaseTopBarTextActive]}>{t('tour.detail.flightcaseLabel')}</Text>
                      </View>
                      <View style={s.flightcaseBody}>
                        <Text style={[s.flightcaseNumber, active && s.flightcaseNumberActive]}>{fc.label}</Text>
                        <Text style={[s.flightcaseWeight, active && s.flightcaseWeightActive]}>
                          {formatWeightKg(flightcaseTotalWeightKg(fc.id))}
                        </Text>
                        <View style={s.flightcaseRivetRow}>
                          <View style={s.flightcaseRivet} />
                          <View style={s.flightcaseRivet} />
                          <View style={s.flightcaseRivet} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <SelectPicker
                label={t('tour.detail.orChooseFromList')}
                value={flightcaseId}
                options={flightcaseOptions}
                onChange={setFlightcaseId}
              />
            </>
          ) : null}
          <SelectPicker label={t('tour.detail.material')} value={materialId} options={materialOptions} onChange={setMaterialId} />
          <SelectPicker label={t('tour.detail.locationForAssignment')} value={locationId} options={locationOptions} onChange={setLocationId} />
          <Input label={t('scanner.quantity')} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />

          <View style={s.scanRow}>
            <TouchableOpacity
              style={[s.btnSecondary, burstMode && s.btnBurstOn]}
              onPress={startBurstScan}
              accessibilityRole="button"
            >
              <Text style={s.btnSecondaryText}>{t('tour.detail.burstScan')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnSecondary} onPress={() => void openQrScanner()} accessibilityRole="button">
              <Text style={s.btnSecondaryText}>{t('tour.detail.scanQrBarcode')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnSecondary, (!nfcSupported || !nfcEnabled || nfcBusy) && s.btnDisabled]}
              onPress={() => void onNfcAssign()}
              disabled={!nfcSupported || !nfcEnabled || nfcBusy}
              accessibilityRole="button"
              accessibilityLabel={t('tour.detail.a11y.readNfc')}
            >
              {nfcBusy ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={s.btnSecondaryText}>{t('tour.detail.readNfc')}</Text>}
            </TouchableOpacity>
          </View>
          <View style={s.scanRow}>
            <Input
              label={t('tour.detail.burstCountLabel')}
              value={burstTargetCount}
              onChangeText={setBurstTargetCount}
              keyboardType="number-pad"
            />
          </View>
          {burstMode ? (
            <Text style={s.hint}>Mode rafale actif — restant à scanner : {burstRemaining}</Text>
          ) : null}
          {!nfcSupported ? (
            <Text style={s.hint}>{t('tour.detail.nfcUnavailable')}</Text>
          ) : !nfcEnabled ? (
            <Text style={s.hint}>{t('tour.detail.nfcEnableHint')}</Text>
          ) : (
            <Text style={s.hint}>{t('tour.detail.nfcTagHint')}</Text>
          )}

          <TouchableOpacity style={s.btnPrimary} onPress={() => void onAssignFromList()} accessibilityRole="button">
            <Text style={s.btnPrimaryText}>{t('tour.detail.addFromList')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnSecondary} onPress={() => void undoLastAssign()} accessibilityRole="button">
            <Text style={s.btnSecondaryText}>{t('tour.detail.undoLastAssignment')}</Text>
          </TouchableOpacity>
        </Card>

        <Card>
          <Text style={s.step}>{t('tour.detail.stepTracked')}</Text>
          {assignments.length === 0 ? (
            <Text style={s.muted}>{t('tour.detail.emptyAssignments')}</Text>
          ) : (
            assignments.map(a => {
              const name = materials.find(m => m.id === a.materialId)?.nom ?? a.materialId;
              const canMove = a.status === 'assigned' || a.status === 'in_use';
              const canMarkInUse = a.status === 'assigned';
              const canReturn = a.status === 'assigned' || a.status === 'in_use' || a.status === 'damaged';
              const canReportLossOrDamage = a.status === 'assigned' || a.status === 'in_use';
              return (
                <View key={a.id} style={s.asgBlock}>
                  <View style={s.asgHead}>
                    <Text style={s.asgTitle} numberOfLines={2}>
                      {name}
                    </Text>
                    <View style={[s.statusPill, { borderColor: assignmentStatusColor(a.status) }]}>
                      <Text style={[s.statusPillText, { color: assignmentStatusColor(a.status) }]}>
                        {assignmentStatusLabel(a.status)}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.asgMeta}>
                    Lieu : {locationName(a.locationId)} · qté {a.quantity} · {a.flightcaseId ? 'En flightcase' : 'Hors flightcase'}
                  </Text>
                  {!a.flightcaseId ? (
                    <View style={s.packagingBox}>
                      <Text style={s.packagingTitle}>{t('tour.detail.packagingTitle')}</Text>
                      {a.packagingPhotoLocal ? (
                        <Image source={{ uri: a.packagingPhotoLocal }} style={s.packagingPhoto} resizeMode="cover" />
                      ) : (
                        <Text style={s.packagingHint}>{t('tour.detail.packagingNoPhoto')}</Text>
                      )}
                      <TouchableOpacity
                        style={s.actionChip}
                        onPress={() => openPackagingPhotoMenu(a)}
                        hitSlop={HitSlop}
                        accessibilityRole="button"
                        accessibilityLabel={t('tour.detail.a11y.packagingPhoto')}
                      >
                        <Text style={s.actionChipText}>
                          {a.packagingPhotoLocal ? t('tour.detail.editPackagingPhoto') : t('tour.detail.addPackagingPhoto')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  <Text style={s.asgHint}>{assignmentStatusHint(a.status)}</Text>
                  <Text style={s.asgDate}>Affecté le {formatAssignedAt(a.assignedAt)}</Text>

                  <View style={s.actions}>
                    <TouchableOpacity
                      style={[s.actionChip, !canMove && s.actionChipOff]}
                      disabled={!canMove}
                      onPress={() => promptMoveAssignment(a)}
                      hitSlop={HitSlop}
                      accessibilityRole="button"
                      accessibilityLabel={t('tour.detail.a11y.changeLocation')}
                    >
                      <Text style={[s.actionChipText, !canMove && s.actionChipTextOff]}>{t('tour.detail.changeLocation')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.actionChip, !canMarkInUse && s.actionChipOff]}
                      disabled={!canMarkInUse}
                      onPress={() => setInUse(a)}
                      hitSlop={HitSlop}
                      accessibilityRole="button"
                      accessibilityLabel={t('tour.detail.a11y.markInUse')}
                    >
                      <Text style={[s.actionChipText, !canMarkInUse && s.actionChipTextOff]}>{t('tour.detail.inUse')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.actionChip, !canReturn && s.actionChipOff]}
                      disabled={!canReturn}
                      onPress={() => confirmReturn(a)}
                      hitSlop={HitSlop}
                      accessibilityRole="button"
                      accessibilityLabel={t('tour.detail.a11y.returnToStock')}
                    >
                      <Text style={[s.actionChipText, !canReturn && s.actionChipTextOff]}>{t('tour.detail.returnStock')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.actionChip, s.actionChipWarn, !canReportLossOrDamage && s.actionChipOff]}
                      disabled={!canReportLossOrDamage}
                      onPress={() => confirmIssue(a, 'damaged')}
                      hitSlop={HitSlop}
                      accessibilityRole="button"
                        accessibilityLabel={t('tour.detail.a11y.reportDamaged')}
                    >
                      <Text style={[s.actionChipText, !canReportLossOrDamage && s.actionChipTextOff]}>{t('tour.detail.damaged')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.actionChip, s.actionChipDanger, !canReportLossOrDamage && s.actionChipOff]}
                      disabled={!canReportLossOrDamage}
                      onPress={() => confirmIssue(a, 'lost')}
                      hitSlop={HitSlop}
                      accessibilityRole="button"
                      accessibilityLabel={t('tour.detail.a11y.reportLost')}
                    >
                      <Text style={[s.actionChipText, !canReportLossOrDamage && s.actionChipTextOff]}>{t('tour.detail.lost')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>

      <Modal visible={qrModalOpen} animationType="slide" onRequestClose={() => setQrModalOpen(false)}>
        <View style={s.modalRoot}>
          {permission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: [
                  'qr',
                  'ean13',
                  'ean8',
                  'code128',
                  'code39',
                  'upc_a',
                  'upc_e',
                  'pdf417',
                  'aztec',
                  'datamatrix',
                ],
              }}
              onBarcodeScanned={onBarcodeScanned}
            />
          ) : (
            <View style={s.modalCenter}>
              <Text style={s.modalHint}>{t('scanner.cameraPermission')}</Text>
            </View>
          )}
          <View style={[s.modalBar, { paddingBottom: 12 + Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0) }]}>
            <Text style={s.modalTitle}>{t('tour.detail.scanModalHint')}</Text>
            {burstMode ? <Text style={s.modalHint}>Rafale en cours — restant : {burstRemaining}</Text> : null}
            <TouchableOpacity
              style={s.btnPrimary}
              onPress={() => {
                setQrModalOpen(false);
                setBurstMode(false);
              }}
              accessibilityRole="button"
            >
              <Text style={s.btnPrimaryText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!previewDoc} animationType="slide" onRequestClose={() => setPreviewDoc(null)}>
        <View style={s.previewRoot}>
          <View style={s.previewTopBar}>
            <Text style={s.previewTitle} numberOfLines={2}>
              {previewDoc?.fileName ?? ''}
            </Text>
            <TouchableOpacity style={s.previewCloseBtn} onPress={() => setPreviewDoc(null)} accessibilityRole="button">
              <Text style={s.previewCloseText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
          <View style={s.previewBody}>
            {previewDoc ? (
              isImageDocument(previewDoc) ? (
                <Image source={{ uri: previewDoc.localUri }} style={s.previewImage} resizeMode="contain" />
              ) : isPdfDocument(previewDoc) ? (
                <WebView source={{ uri: previewDoc.localUri }} style={s.previewWebview} />
              ) : (
                <View style={s.previewFallback}>
                  <Text style={s.muted}>{t('tour.detail.docPreviewUnsupported')}</Text>
                  <TouchableOpacity style={s.btnSecondary} onPress={() => void openTourDocument(previewDoc)}>
                    <Text style={s.btnSecondaryText}>{t('tour.detail.openWithSystem')}</Text>
                  </TouchableOpacity>
                </View>
              )
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={!!renameDoc} transparent animationType="fade" onRequestClose={() => setRenameDoc(null)}>
        <View style={s.renameOverlay}>
          <View style={s.renameSheet}>
            <Text style={s.step}>{t('tour.detail.renameDocument')}</Text>
            <Input
              label={t('tour.detail.docNameLabel')}
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder={t('tour.detail.docNamePlaceholder')}
            />
            <View style={s.renameActions}>
              <TouchableOpacity style={s.btnSecondary} onPress={() => setRenameDoc(null)}>
                <Text style={s.btnSecondaryText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnPrimary} onPress={() => void submitRenameTourDocument()}>
                <Text style={s.btnPrimaryText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </TabScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.xl, paddingBottom: 32 },
  headerIcon: { fontSize: 22 },
  lifecycleBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.md,
    paddingHorizontal: 4,
  },
  lifecycleActions: { flex: 1, gap: 8 },
  lifecycleLabel: { ...Typography.caption, color: Colors.textMuted, flexShrink: 0 },
  lifecycleBtn: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    minHeight: Spacing.touchMin,
    justifyContent: 'center',
  },
  lifecycleBtnText: { ...Typography.sectionTitle, fontSize: 14, textAlign: 'right', color: Colors.green },
  lifecycleDeleteBtn: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.redBg,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.4)',
  },
  lifecycleDeleteBtnText: { ...Typography.caption, color: Colors.red, fontWeight: '700' },
  step: { ...Typography.sectionTitle, marginBottom: Spacing.sm },
  help: { ...Typography.bodySecondary, marginBottom: Spacing.md, lineHeight: 22 },
  hint: { ...Typography.caption, color: Colors.textMuted, marginBottom: Spacing.md, lineHeight: 18 },
  flightcaseLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: 8,
    fontWeight: '700',
  },
  flightcaseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  flightcaseBtn: {
    width: 108,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#6b7280',
    backgroundColor: '#20242d',
    overflow: 'hidden',
    minHeight: 86,
    position: 'relative',
  },
  flightcaseBtnActive: {
    borderColor: Colors.green,
    backgroundColor: '#1b2a24',
  },
  flightcaseTopBar: {
    backgroundColor: '#111827',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
  },
  flightcaseTopBarText: {
    textAlign: 'center',
    fontSize: 9,
    color: '#9ca3af',
    fontWeight: '800',
    letterSpacing: 1,
  },
  flightcaseTopBarTextActive: {
    color: '#6ee7b7',
  },
  flightcaseBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#2a2f39',
  },
  flightcaseNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#f9fafb',
  },
  flightcaseNumberActive: {
    color: Colors.green,
  },
  flightcaseWeight: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  flightcaseWeightActive: {
    color: '#a7f3d0',
  },
  flightcaseHandle: {
    position: 'absolute',
    top: 2,
    left: 32,
    right: 32,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#9ca3af',
    opacity: 0.85,
    zIndex: 3,
  },
  flightcaseHandleActive: {
    backgroundColor: '#6ee7b7',
  },
  flightcaseCornerTL: {
    position: 'absolute',
    width: 10,
    height: 10,
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#d1d5db',
    borderTopLeftRadius: 8,
    zIndex: 2,
  },
  flightcaseCornerTR: {
    position: 'absolute',
    width: 10,
    height: 10,
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: '#d1d5db',
    borderTopRightRadius: 8,
    zIndex: 2,
  },
  flightcaseCornerBL: {
    position: 'absolute',
    width: 10,
    height: 10,
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#d1d5db',
    borderBottomLeftRadius: 8,
    zIndex: 2,
  },
  flightcaseCornerBR: {
    position: 'absolute',
    width: 10,
    height: 10,
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: '#d1d5db',
    borderBottomRightRadius: 8,
    zIndex: 2,
  },
  flightcaseRivetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  flightcaseRivet: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#9ca3af',
    opacity: 0.9,
  },
  muted: { ...Typography.bodySecondary, fontStyle: 'italic' },
  linkBtn: { alignSelf: 'flex-start', paddingVertical: Spacing.sm },
  linkBtnText: { color: Colors.green, fontWeight: '700', fontSize: 15 },
  btnPrimary: {
    backgroundColor: Colors.green,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: Spacing.md,
    minHeight: Spacing.touchMin,
    justifyContent: 'center',
    ...Shadow.card,
  },
  btnPrimaryText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
  btnSecondary: {
    backgroundColor: Colors.bgCardAlt,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: 0,
    minHeight: Spacing.touchMin,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  btnSecondaryText: { color: Colors.textPrimary, fontWeight: '700', fontSize: 13, textAlign: 'center' },
  btnDisabled: { opacity: 0.45 },
  btnBurstOn: {
    borderColor: Colors.green,
    backgroundColor: Colors.greenMuted,
  },
  scanRow: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: Spacing.sm },
  locRow: {
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
  },
  locName: { ...Typography.sectionTitle, fontSize: 16 },
  locAddr: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4 },
  docRow: {
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  docName: { ...Typography.body, fontWeight: '700' },
  docMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  docActionBtn: { minWidth: 80, alignItems: 'center' },
  docDeleteBtn: { minWidth: 90, alignItems: 'center' },
  asgBlock: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  asgHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  asgTitle: { ...Typography.sectionTitle, flex: 1, minWidth: 0, fontSize: 16 },
  statusPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: { fontSize: 12, fontWeight: '800' },
  asgMeta: { ...Typography.bodySecondary, marginTop: 6 },
  packagingBox: {
    marginTop: 8,
    marginBottom: 4,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCardAlt,
  },
  packagingTitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    marginBottom: 8,
  },
  packagingHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  packagingPhoto: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    marginBottom: 8,
    backgroundColor: Colors.bgInput,
  },
  asgHint: { ...Typography.caption, color: Colors.textMuted, marginTop: 6, lineHeight: 17 },
  asgDate: { ...Typography.caption, color: Colors.textMuted, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.md },
  actionChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.greenMuted,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    minHeight: 40,
    justifyContent: 'center',
  },
  actionChipOff: { opacity: 0.4 },
  actionChipWarn: {
    backgroundColor: Colors.yellowBg,
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  actionChipDanger: {
    backgroundColor: Colors.redBg,
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  actionChipText: { color: Colors.green, fontWeight: '700', fontSize: 13 },
  actionChipTextOff: { color: Colors.textMuted },
  modalRoot: { flex: 1, backgroundColor: '#000' },
  modalBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  modalTitle: { ...Typography.body, textAlign: 'center', marginBottom: Spacing.md, color: Colors.white },
  modalCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalHint: { color: Colors.textSecondary },
  previewRoot: { flex: 1, backgroundColor: Colors.bg },
  previewTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  previewTitle: { ...Typography.sectionTitle, flex: 1, marginRight: Spacing.sm },
  previewCloseBtn: {
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  previewCloseText: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '700' },
  previewBody: { flex: 1 },
  previewImage: { width: '100%', height: '100%' },
  previewWebview: { flex: 1, backgroundColor: Colors.bg },
  previewFallback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, gap: Spacing.md },
  renameOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  renameSheet: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    padding: Spacing.lg,
  },
  renameActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
});
