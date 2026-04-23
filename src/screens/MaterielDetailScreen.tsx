// src/screens/MaterielDetailScreen.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Image, TouchableOpacity, Alert, ActivityIndicator, Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { syncMaterielNoticeAttachments } from '../lib/materielAttachments';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import {
  getMaterielById,
  getMateriel,
  setNfcTagMateriel,
  updateMateriel,
  getHistoriqueEmpruntsMateriel,
} from '../db/database';
import { countMaterielSameNameEnStock } from '../lib/materielSameName';
import { getPdfBranding } from '../lib/theatreBranding';
import {
  buildCustomMaterielLabelHtml,
  exportEtiquetteMaterielPdfCustom,
} from '../lib/labelCustomPdf';
import {
  getFormatsByKind,
  loadUserLabelFormats,
  type UserLabelFormat,
} from '../lib/labelUserFormatsStorage';
import { exportMaterielFichesPdf } from '../lib/pdfMaterielFiche';
import { MaterielEmpruntHistorique } from '../types';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { uploadPhoto, pushMaterielNoticesToSupabaseAfterSave } from '../lib/supabase';
import { useNfc } from '../hooks/useNfc';
import { Materiel } from '../types';
import { EtatBadge, StatutBadge, Card, BottomModal, TabScreenSafeArea, SelectPicker } from '../components/UI';
import { useAppAuth } from '../context/AuthContext';
import ShelfLabelsModal from '../components/ShelfLabelsModal';
import LabelUserFormatsManagerModal from '../components/LabelUserFormatsManagerModal';
import LabelHtmlPreviewModal from '../components/LabelHtmlPreviewModal';

export default function MaterielDetailScreen() {
  const { can } = useAppAuth();
  const editOk = can('edit_inventory');
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { materielId } = route.params ?? {};

  const [mat, setMat] = useState<Materiel | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [historique, setHistorique] = useState<MaterielEmpruntHistorique[]>([]);
  const [qrFormats, setQrFormats] = useState<UserLabelFormat[]>([]);
  const [selectedQrFormatId, setSelectedQrFormatId] = useState<string>('');
  const [labelManagerOpen, setLabelManagerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoad, setPreviewLoad] = useState(false);
  const [shelfLabelModal, setShelfLabelModal] = useState(false);
  const [etiquetteSheet, setEtiquetteSheet] = useState(false);
  const [sameNameEnStockCount, setSameNameEnStockCount] = useState<number | null>(null);

  const reloadQrFormats = useCallback(async () => {
    const all = await loadUserLabelFormats();
    const qr = getFormatsByKind(all, 'qr');
    setQrFormats(qr);
    setSelectedQrFormatId(prev => {
      if (prev && qr.some(f => f.id === prev)) return prev;
      return qr[0]?.id ?? '';
    });
  }, []);

  useEffect(() => {
    if (etiquetteSheet) void reloadQrFormats();
  }, [etiquetteSheet, reloadQrFormats]);

  const qrFormatOptions = useMemo(
    () =>
      qrFormats.map(f => ({
        value: f.id,
        label: `${f.name} (${f.widthMm}×${f.heightMm} mm)`,
      })),
    [qrFormats]
  );

  const selectedQrFormat = useMemo(
    () => qrFormats.find(f => f.id === selectedQrFormatId) ?? null,
    [qrFormats, selectedQrFormatId]
  );

  const runEtiquettePreview = async () => {
    if (!mat || !selectedQrFormat) {
      Alert.alert('Format', 'Crée au moins un format QR (bouton Gérer les formats) puis sélectionne-le.');
      return;
    }
    setEtiquetteSheet(false);
    setPreviewOpen(true);
    setPreviewLoad(true);
    setPreviewHtml(null);
    try {
      const brand = await getPdfBranding();
      setPreviewHtml(buildCustomMaterielLabelHtml(mat, selectedQrFormat, brand));
    } catch (e: any) {
      Alert.alert('Aperçu', e?.message ?? 'Erreur');
    } finally {
      setPreviewLoad(false);
    }
  };

  const runEtiquetteExport = async () => {
    if (!mat || !selectedQrFormat) {
      Alert.alert('Format', 'Crée au moins un format QR puis sélectionne-le.');
      return;
    }
    try {
      setEtiquetteSheet(false);
      await exportEtiquetteMaterielPdfCustom(mat, selectedQrFormat);
      setPreviewOpen(false);
      setPreviewHtml(null);
    } catch (e: any) {
      Alert.alert('PDF', e?.message ?? 'Erreur export');
    }
  };

  const { nfcSupported, nfcEnabled, scanning, writeNfcTag, readNfcTagId } = useNfc();

  useEffect(() => {
    if (materielId) {
      getMaterielById(materielId).then(m => {
        setMat(m);
        setLoading(false);
      });
      getHistoriqueEmpruntsMateriel(materielId).then(setHistorique);
    } else {
      setLoading(false);
    }
  }, [materielId]);

  useEffect(() => {
    if (!mat) {
      setSameNameEnStockCount(null);
      return;
    }
    void getMateriel().then(list => {
      setSameNameEnStockCount(countMaterielSameNameEnStock(list, mat));
    });
  }, [mat?.id, mat?.nom, mat?.statut]);

  const fmt = (raw?: string) => {
    if (!raw) return '—';
    const d = raw.includes('T') ? parseISO(raw) : parseISO(`${raw}T12:00:00`);
    return isValid(d) ? format(d, 'd MMM yyyy', { locale: fr }) : raw;
  };

  const handlePhoto = async () => {
    if (!editOk) return;
    Alert.alert('Photo du matériel', 'Choisissez une source', [
      {
        text: 'Prendre une photo',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return;
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: true,
            aspect: [4, 3],
          });
          if (!result.canceled && mat) {
            const uri = result.assets[0].uri;
            await updateMateriel(mat.id, { photo_local: uri });
            setMat(prev => prev ? { ...prev, photo_local: uri } : prev);

            // Upload async
            setUploadingPhoto(true);
            const url = await uploadPhoto(uri, mat.id);
            if (url) {
              await updateMateriel(mat.id, { photo_url: url });
              setMat(prev => prev ? { ...prev, photo_url: url } : prev);
            }
            setUploadingPhoto(false);
          }
        }
      },
      {
        text: 'Depuis la galerie',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return;
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
          });
          if (!result.canceled && mat) {
            const uri = result.assets[0].uri;
            await updateMateriel(mat.id, { photo_local: uri });
            setMat(prev => prev ? { ...prev, photo_local: uri } : prev);
          }
        }
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const handleWriteNfc = async () => {
    if (!mat || !editOk) return;
    if (!nfcSupported || !nfcEnabled) {
      Alert.alert('NFC indisponible');
      return;
    }
    Alert.alert(
      'Écrire sur puce NFC',
      `Approchez une puce NFC vierge pour y écrire l'ID: ${mat.id}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Écrire',
          onPress: async () => {
            const ok = await writeNfcTag(mat.id);
            if (ok) {
              Alert.alert('✓ Succès', 'ID écrit sur la puce NFC');
              await setNfcTagMateriel(mat.id, mat.id);
              setMat(prev => prev ? { ...prev, nfc_tag_id: mat.id } : prev);
            } else {
              Alert.alert('Erreur', 'Écriture NFC échouée');
            }
          }
        },
      ]
    );
  };

  const docPickUri = (pick: DocumentPicker.DocumentPickerResult): string | null => {
    if (pick.canceled) return null;
    const p = pick as DocumentPicker.DocumentPickerSuccessResult;
    return p.assets?.[0]?.uri ?? null;
  };

  const openNoticePdf = async () => {
    const target = mat?.notice_pdf_local ?? mat?.notice_pdf_url;
    if (!target) return;
    try {
      if (target.startsWith('http://') || target.startsWith('https://')) {
        const ok = await Linking.canOpenURL(target);
        if (!ok) {
          Alert.alert('Notice PDF', 'Impossible d’ouvrir ce lien.');
          return;
        }
        await Linking.openURL(target);
        return;
      }
      const shareOk = await Sharing.isAvailableAsync();
      if (!shareOk) {
        Alert.alert('Notice PDF', 'Le partage de fichiers n’est pas disponible sur cet appareil.');
        return;
      }
      await Sharing.shareAsync(target, {
        mimeType: 'application/pdf',
        dialogTitle: 'Notice PDF',
      });
    } catch (e: any) {
      Alert.alert('PDF', e?.message ?? 'Impossible d’ouvrir le fichier');
    }
  };

  const applyNoticeSync = async (nextPdf?: string, nextPhoto?: string) => {
    if (!mat || !editOk) return;
    try {
      const n = await syncMaterielNoticeAttachments(mat.id, nextPdf, nextPhoto);
      if (Object.keys(n).length) await updateMateriel(mat.id, n);
      const urlPatch = await pushMaterielNoticesToSupabaseAfterSave(mat.id, n);
      if (Object.keys(urlPatch).length) await updateMateriel(mat.id, urlPatch);
      setMat(prev => (prev ? { ...prev, ...n, ...urlPatch } : prev));
    } catch (e: any) {
      Alert.alert('Notice', e?.message ?? 'Enregistrement impossible');
    }
  };

  const handleAttachNoticePdf = async () => {
    if (!mat || !editOk) return;
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      const uri = docPickUri(pick);
      if (!uri) return;
      await applyNoticeSync(uri, undefined);
    } catch (e: any) {
      Alert.alert('PDF', e?.message ?? 'Sélection impossible');
    }
  };

  const handleAttachNoticePhoto = async () => {
    if (!mat || !editOk) return;
    Alert.alert('Photo de la notice', 'Source', [
      {
        text: 'Caméra',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return;
          const res = await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: false });
          if (!res.canceled && res.assets[0]) {
            await applyNoticeSync(undefined, res.assets[0].uri);
          }
        },
      },
      {
        text: 'Galerie',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return;
          const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });
          if (!res.canceled && res.assets[0]) {
            await applyNoticeSync(undefined, res.assets[0].uri);
          }
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const handleRemoveNoticePdf = () => {
    if (!mat?.notice_pdf_local && !mat?.notice_pdf_url) return;
    Alert.alert('Retirer le PDF', 'Supprimer la notice PDF de cette fiche (appareil et nuage) ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => applyNoticeSync('', undefined) },
    ]);
  };

  const handleRemoveNoticePhoto = () => {
    if (!mat?.notice_photo_local && !mat?.notice_photo_url) return;
    Alert.alert('Retirer la photo', 'Supprimer la photo de notice (appareil et nuage) ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => applyNoticeSync(undefined, '') },
    ]);
  };

  const handleLinkNfc = async () => {
    if (!mat || !editOk) return;
    const tagId = await readNfcTagId();
    if (tagId) {
      await setNfcTagMateriel(mat.id, tagId);
      setMat(prev => prev ? { ...prev, nfc_tag_id: tagId } : prev);
      Alert.alert('✓ Associé', `Tag NFC associé: ${tagId}`);
    }
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={Colors.green} /></View>;
  }

  if (!mat) {
    return (
      <View style={s.center}>
        <Text style={{ color: Colors.textMuted }}>Matériel introuvable</Text>
      </View>
    );
  }

  const photoUri = mat.photo_local ?? mat.photo_url;

  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ color: Colors.green, fontSize: 16 }}>← Retour</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <EtatBadge etat={mat.etat} />
            <StatutBadge statut={mat.statut} />
          </View>
        </View>

        <Text style={s.title}>{mat.nom}</Text>
        {mat.marque && <Text style={s.subtitle}>{mat.marque}{mat.type ? ' · ' + mat.type : ''}</Text>}

        {sameNameEnStockCount != null && (
          <View style={s.sameNameInfo}>
            <Text style={s.sameNameInfoText}>
              {sameNameEnStockCount === 0
                ? 'Aucune fiche « en stock » ne partage ce libellé (hors statut de cette fiche).'
                : sameNameEnStockCount === 1
                  ? 'Un seul exemplaire est « en stock » sous ce libellé (cette fiche ou une autre).'
                  : `${sameNameEnStockCount} fiches sont « en stock » avec le même libellé (S/N, QR, catégorie peuvent différer).`}
            </Text>
          </View>
        )}

        {/* Photo */}
        <TouchableOpacity style={s.photoBox} onPress={handlePhoto} disabled={!editOk}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={s.photo} />
          ) : (
            <View style={s.photoPlaceholder}>
              <Text style={{ fontSize: 36 }}>📷</Text>
              <Text style={{ color: Colors.textMuted, marginTop: 8, fontSize: 13 }}>
                Appuyer pour ajouter une photo (fiche édition)
              </Text>
            </View>
          )}
          {uploadingPhoto && (
            <View style={s.photoOverlay}>
              <ActivityIndicator color={Colors.green} />
              <Text style={{ color: Colors.white, marginTop: 8 }}>Upload...</Text>
            </View>
          )}
          <TouchableOpacity style={s.photoEditBtn} onPress={handlePhoto}>
            <Text style={{ fontSize: 16 }}>✏️</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Infos */}
        <Card style={{ marginBottom: 12 }}>
          <Text style={s.sectionTitle}>Informations</Text>
          <InfoRow label="N° de série" value={mat.numero_serie} />
          <InfoRow label="Poids" value={mat.poids_kg ? mat.poids_kg + ' kg' : undefined} />
          <InfoRow label="Date achat" value={mat.date_achat} />
          <InfoRow label="Date validité" value={mat.date_validite} />
          <InfoRow label="Prochain contrôle" value={mat.prochain_controle} />
          <InfoRow
            label="Intervalle contrôle (j)"
            value={mat.intervalle_controle_jours != null ? String(mat.intervalle_controle_jours) : undefined}
          />
          <InfoRow label="Technicien" value={mat.technicien} />
          <InfoRow label="QR Code" value={mat.qr_code} />
        </Card>

        {/* NFC */}
        <Card style={{ marginBottom: 12 }}>
          <Text style={s.sectionTitle}>Puce NFC</Text>
          {mat.nfc_tag_id ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ color: Colors.green, fontSize: 12 }}>✓ Tag associé</Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 11, marginTop: 2 }}>{mat.nfc_tag_id}</Text>
              </View>
              <TouchableOpacity onPress={handleLinkNfc} style={s.nfcBtn}>
                <Text style={{ color: Colors.white, fontSize: 12 }}>Changer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Aucun tag NFC associé</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={[s.nfcBtn, { flex: 1 }]} onPress={handleWriteNfc} disabled={scanning}>
                  <Text style={{ color: Colors.white, fontSize: 12, textAlign: 'center' }}>
                    {scanning ? '...' : '✍️ Écrire sur puce'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.nfcBtnOutline, { flex: 1 }]} onPress={handleLinkNfc} disabled={scanning}>
                  <Text style={{ color: Colors.green, fontSize: 12, textAlign: 'center' }}>
                    {scanning ? '...' : '🔗 Associer puce'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <Text style={s.sectionTitle}>Notice d’utilisation</Text>
          {!mat.notice_pdf_local &&
            !mat.notice_pdf_url &&
            !mat.notice_photo_local &&
            !mat.notice_photo_url && (
            <Text style={{ color: Colors.textMuted, fontSize: 13 }}>
              Aucune notice jointe. Ajoutez un PDF ou une photo ; avec Supabase, elles sont partagées entre appareils.
            </Text>
          )}
          {!!(mat.notice_pdf_local || mat.notice_pdf_url) && (
            <TouchableOpacity style={s.noticeMainBtn} onPress={openNoticePdf}>
              <Text style={{ color: Colors.white, fontWeight: '700', fontSize: 15 }}>📄 Ouvrir / partager le PDF</Text>
            </TouchableOpacity>
          )}
          {!!(mat.notice_photo_local || mat.notice_photo_url) && (
            <View style={{ marginTop: mat.notice_pdf_local || mat.notice_pdf_url ? 12 : 0 }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 12, marginBottom: 8 }}>Photo de la notice</Text>
              <Image
                source={{ uri: (mat.notice_photo_local ?? mat.notice_photo_url) as string }}
                style={s.noticePhoto}
                resizeMode="contain"
              />
            </View>
          )}
          {editOk && (
            <View style={{ marginTop: 12, gap: 8 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity style={s.noticeChip} onPress={handleAttachNoticePdf}>
                  <Text style={s.noticeChipText}>
                    {mat.notice_pdf_local || mat.notice_pdf_url ? 'Remplacer PDF' : 'Joindre PDF'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.noticeChip} onPress={handleAttachNoticePhoto}>
                  <Text style={s.noticeChipText}>
                    {mat.notice_photo_local || mat.notice_photo_url ? 'Remplacer photo' : 'Joindre photo'}
                  </Text>
                </TouchableOpacity>
              </View>
              {(mat.notice_pdf_local ||
                mat.notice_pdf_url ||
                mat.notice_photo_local ||
                mat.notice_photo_url) && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {!!(mat.notice_pdf_local || mat.notice_pdf_url) && (
                    <TouchableOpacity style={s.noticeChipDanger} onPress={handleRemoveNoticePdf}>
                      <Text style={s.noticeChipDangerText}>Retirer PDF</Text>
                    </TouchableOpacity>
                  )}
                  {!!(mat.notice_photo_local || mat.notice_photo_url) && (
                    <TouchableOpacity style={s.noticeChipDanger} onPress={handleRemoveNoticePhoto}>
                      <Text style={s.noticeChipDangerText}>Retirer photo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        </Card>

        {/* Historique emprunts */}
        {historique.length > 0 && (
          <Card style={{ marginBottom: 12 }}>
            <Text style={s.sectionTitle}>Historique des emprunts</Text>
            {historique.map(h => (
              <View key={h.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                <Text style={{ color: Colors.white, fontSize: 14, fontWeight: '600' }}>{h.emprunteur}</Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  Départ {fmt(h.date_depart)}
                  {h.retour_prevu ? ` · prévu ${fmt(h.retour_prevu)}` : ''}
                  {h.retour_reel ? ` · réel ${fmt(h.retour_reel)}` : ''}
                </Text>
                {h.etat_au_retour && (
                  <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 2 }}>
                    État retour : {h.etat_au_retour} · {h.statut_pret}
                  </Text>
                )}
              </View>
            ))}
          </Card>
        )}

        <TouchableOpacity
          style={[s.editBtn, { marginBottom: 10 }]}
          onPress={async () => {
            if (!mat) return;
            try {
              await exportMaterielFichesPdf([mat]);
            } catch (e: any) {
              Alert.alert('PDF fiche', e?.message ?? 'Erreur export');
            }
          }}
        >
          <Text style={{ color: Colors.white, fontWeight: '700', fontSize: 15 }}>📋 Fiche matériel PDF (A4, photo)</Text>
        </TouchableOpacity>

        {editOk && (
          <TouchableOpacity
            style={[s.editBtn, { marginBottom: 10 }]}
            onPress={() => setEtiquetteSheet(true)}
          >
            <Text style={{ color: Colors.white, fontWeight: '700', fontSize: 15 }}>📄 PDF étiquette (QR)</Text>
          </TouchableOpacity>
        )}

        {editOk && (
          <TouchableOpacity
            style={[s.editBtn, { marginBottom: 10 }]}
            onPress={() => setShelfLabelModal(true)}
          >
            <Text style={{ color: Colors.white, fontWeight: '700', fontSize: 15 }}>🏷 Étiquette rayonnage / bac</Text>
          </TouchableOpacity>
        )}

        <BottomModal
          visible={etiquetteSheet}
          onClose={() => setEtiquetteSheet(false)}
          title="Étiquette QR (format personnalisé)"
        >
          <Text style={{ color: Colors.textMuted, fontSize: 13, marginBottom: 10 }}>
            Largeur, hauteur, marge, police et couleur se règlent dans « Gérer les formats ». Pense à l’aperçu avant de générer le PDF.
          </Text>
          {qrFormatOptions.length ? (
            <SelectPicker
              label="Format enregistré"
              value={selectedQrFormatId}
              options={qrFormatOptions}
              onChange={v => setSelectedQrFormatId(v)}
            />
          ) : (
            <Text style={{ color: Colors.yellow, fontSize: 13, marginBottom: 10 }}>
              Aucun format QR enregistré. Utilise « Gérer les formats » pour en ajouter.
            </Text>
          )}
          <TouchableOpacity
            style={[s.editBtn, { marginTop: 6 }]}
            onPress={() => {
              setEtiquetteSheet(false);
              setLabelManagerOpen(true);
            }}
          >
            <Text style={{ color: Colors.green, fontWeight: '700', fontSize: 15 }}>Gérer les formats d’étiquette…</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.editBtn, { marginTop: 8 }]} onPress={() => void runEtiquettePreview()}>
            <Text style={{ color: Colors.white, fontWeight: '700', fontSize: 15 }}>Aperçu</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.editBtn, { marginTop: 8, marginBottom: 4 }]}
            onPress={runEtiquetteExport}
            disabled={!selectedQrFormat}
          >
            <Text
              style={{
                color: selectedQrFormat ? Colors.white : Colors.textMuted,
                fontWeight: '700',
                fontSize: 15,
              }}
            >
              Générer le PDF (partage)
            </Text>
          </TouchableOpacity>
        </BottomModal>

        <LabelUserFormatsManagerModal
          visible={labelManagerOpen}
          onClose={() => {
            setLabelManagerOpen(false);
            void reloadQrFormats();
          }}
          kind="qr"
          onSaved={() => void reloadQrFormats()}
        />

        <LabelHtmlPreviewModal
          visible={previewOpen}
          onClose={() => {
            setPreviewOpen(false);
            setPreviewHtml(null);
          }}
          title="Matériel"
          fullHtml={previewHtml}
          loading={previewLoad}
          onGeneratePdf={previewHtml && !previewLoad && selectedQrFormat ? runEtiquetteExport : undefined}
        />

        <ShelfLabelsModal
          visible={shelfLabelModal}
          onClose={() => setShelfLabelModal(false)}
          title="Étiquette rayonnage (cet article)"
          items={[
            {
              id: mat.id,
              title: mat.nom,
              subtitle: [mat.marque, mat.type, mat.numero_serie ? `S/N ${mat.numero_serie}` : undefined]
                .filter(Boolean)
                .join(' · '),
            },
          ]}
        />

        {editOk && !mat.qr_code?.trim() && (
          <TouchableOpacity
            style={[s.editBtn, { marginBottom: 10 }]}
            onPress={async () => {
              await updateMateriel(mat.id, { qr_code: mat.id });
              setMat(prev => (prev ? { ...prev, qr_code: mat.id } : prev));
              Alert.alert('QR', 'Code QR défini sur l’ID matériel (scannable).');
            }}
          >
            <Text style={{ color: Colors.green, fontWeight: '700', fontSize: 15 }}>Définir QR = ID interne</Text>
          </TouchableOpacity>
        )}

        {editOk && (
          <TouchableOpacity
            style={s.editBtn}
            onPress={() => navigation.navigate('StockList', { editId: mat.id })}
          >
            <Text style={{ color: Colors.white, fontWeight: '700', fontSize: 15 }}>✏️ Modifier ce matériel</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </TabScreenSafeArea>
  );
}

const InfoRow = ({ label, value }: { label: string; value?: string | null }) => {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
      <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: Colors.white, fontSize: 13, flex: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: Colors.white, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: Colors.textSecondary, fontSize: 15, marginBottom: 8 },
  sameNameInfo: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    padding: 10,
    marginBottom: 14,
  },
  sameNameInfoText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  photoBox: { height: 220, borderRadius: 14, overflow: 'hidden', marginBottom: 16, position: 'relative' },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: {
    width: '100%', height: '100%',
    backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoEditBtn: {
    position: 'absolute', bottom: 10, right: 10,
    backgroundColor: Colors.bgCard, borderRadius: 20, padding: 8,
  },
  nfcBtn: {
    backgroundColor: Colors.green, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12,
  },
  nfcBtnOutline: {
    borderWidth: 1, borderColor: Colors.green, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12,
  },
  editBtn: {
    backgroundColor: Colors.bgCard, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border, marginTop: 4, marginBottom: 20,
  },
  noticeMainBtn: {
    backgroundColor: Colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  noticePhoto: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    backgroundColor: Colors.bgInput,
  },
  noticeChip: {
    backgroundColor: Colors.bgCardAlt,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noticeChipText: { color: Colors.white, fontSize: 13, fontWeight: '600' },
  noticeChipDanger: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.red,
  },
  noticeChipDangerText: { color: Colors.red, fontSize: 12, fontWeight: '600' },
});
