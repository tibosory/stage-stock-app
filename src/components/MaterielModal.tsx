// src/components/MaterielModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { syncMaterielNoticeAttachments } from '../lib/materielAttachments';
import { triggerSyncAfterActionIfEnabled } from '../lib/syncAfterAction';
import { pushMaterielNoticesToSupabaseAfterSave } from '../lib/supabase';
import { Colors } from '../theme/colors';
import {
  insertMateriel, updateMateriel, insertCategorie, insertLocalisation, categoryPathById,
} from '../db/database';
import { Materiel, Categorie, Localisation, EtatMateriel, StatutMateriel } from '../types';
import {
  Input, SelectPicker, BottomModal, FormButtons, DateField,
} from './UI';
import { useNfc } from '../hooks/useNfc';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  item?: Materiel | null;
  categories: Categorie[];
  localisations: Localisation[];
  initialQr?: string;
  initialNfc?: string;
  /** Recharger catégories / localisations après création inline. */
  onMetaRefresh?: () => void | Promise<void>;
  /** Fiches « en stock » au même libellé (nom) que la fiche ouverte — informatif. */
  sameNameEnStockCount?: number;
}

const ETATS: { label: string; value: EtatMateriel }[] = [
  { label: 'Bon', value: 'bon' },
  { label: 'Moyen', value: 'moyen' },
  { label: 'Usé', value: 'usé' },
  { label: 'Hors service', value: 'hors service' },
];

const STATUTS: { label: string; value: StatutMateriel }[] = [
  { label: 'En stock', value: 'en stock' },
  { label: 'En prêt', value: 'en prêt' },
  { label: 'En réparation', value: 'en réparation' },
  { label: 'Perdu', value: 'perdu' },
];

export default function MaterielModal({
  visible, onClose, onSaved, item,
  categories, localisations, initialQr, initialNfc, onMetaRefresh,
  sameNameEnStockCount,
}: Props) {
  const [nom, setNom] = useState('');
  const [type, setType] = useState('');
  const [marque, setMarque] = useState('');
  const [numeroSerie, setNumeroSerie] = useState('');
  const [poids, setPoids] = useState('');
  const [categorieId, setCategorieId] = useState('');
  const [localisationId, setLocalisationId] = useState('');
  const [etat, setEtat] = useState<EtatMateriel>('bon');
  const [statut, setStatut] = useState<StatutMateriel>('en stock');
  const [dateAchat, setDateAchat] = useState('');
  const [dateValidite, setDateValidite] = useState('');
  const [prochainControle, setProchainControle] = useState('');
  const [intervalleControle, setIntervalleControle] = useState('');
  const [maintenanceTodo, setMaintenanceTodo] = useState('');
  const [maintenanceLastComment, setMaintenanceLastComment] = useState('');
  const [technicien, setTechnicien] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [nfcTagId, setNfcTagId] = useState('');
  const [photoLocal, setPhotoLocal] = useState('');
  const [noticePdfUri, setNoticePdfUri] = useState('');
  const [noticePhotoUri, setNoticePhotoUri] = useState('');
  const [noticePdfTouched, setNoticePdfTouched] = useState(false);
  const [noticePhotoTouched, setNoticePhotoTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newLocalisationName, setNewLocalisationName] = useState('');

  const { nfcSupported, nfcEnabled, scanning, readNfcTagId } = useNfc();

  useEffect(() => {
    if (!visible) return;
    if (item) {
      setNom(item.nom);
      setType(item.type ?? '');
      setMarque(item.marque ?? '');
      setNumeroSerie(item.numero_serie ?? '');
      setPoids(item.poids_kg?.toString() ?? '');
      setCategorieId(item.categorie_id ?? '');
      setLocalisationId(item.localisation_id ?? '');
      setEtat(item.etat);
      setStatut(item.statut);
      setDateAchat(item.date_achat ?? '');
      setDateValidite(item.date_validite ?? '');
      setProchainControle(item.prochain_controle ?? '');
      setIntervalleControle(
        item.intervalle_controle_jours != null ? String(item.intervalle_controle_jours) : ''
      );
      setMaintenanceTodo(item.maintenance_todo ?? '');
      setMaintenanceLastComment(item.maintenance_last_comment ?? '');
      setTechnicien(item.technicien ?? '');
      setQrCode(item.qr_code ?? '');
      setNfcTagId(item.nfc_tag_id ?? '');
      setPhotoLocal(item.photo_local ?? '');
      setNoticePdfUri(item.notice_pdf_local ?? '');
      setNoticePhotoUri(item.notice_photo_local ?? '');
    } else {
      setNom(''); setType(''); setMarque(''); setNumeroSerie('');
      setPoids(''); setCategorieId(''); setLocalisationId('');
      setEtat('bon'); setStatut('en stock');
      setDateAchat(''); setDateValidite(''); setProchainControle(''); setIntervalleControle('');
      setMaintenanceTodo(''); setMaintenanceLastComment('');
      setTechnicien('');
      setQrCode(initialQr ?? '');
      setNfcTagId(initialNfc ?? '');
      setPhotoLocal('');
      setNoticePdfUri('');
      setNoticePhotoUri('');
    }
    setNewCategoryName('');
    setNewLocalisationName('');
    setNoticePdfTouched(false);
    setNoticePhotoTouched(false);
  }, [visible, item, initialQr, initialNfc]);

  const handleAddLocalisation = async () => {
    const t = newLocalisationName.trim();
    if (!t) {
      Alert.alert('Localisation', 'Saisissez un nom (ex. réserve, scène, atelier…).');
      return;
    }
    try {
      const id = await insertLocalisation(t);
      setNewLocalisationName('');
      setLocalisationId(id);
      await onMetaRefresh?.();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de créer la localisation');
    }
  };

  const handleAddCategory = async () => {
    const t = newCategoryName.trim();
    if (!t) {
      Alert.alert('Catégorie', 'Saisissez un nom pour la nouvelle catégorie.');
      return;
    }
    try {
      const id = await insertCategorie(t);
      setNewCategoryName('');
      setCategorieId(id);
      await onMetaRefresh?.();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de créer la catégorie');
    }
  };

  const pickDocumentUri = (pick: DocumentPicker.DocumentPickerResult): string | null => {
    if (pick.canceled) return null;
    const p = pick as DocumentPicker.DocumentPickerSuccessResult;
    return p.assets?.[0]?.uri ?? null;
  };

  const handlePickNoticePdf = async () => {
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      const uri = pickDocumentUri(pick);
      if (uri) {
        setNoticePdfUri(uri);
        setNoticePdfTouched(true);
      }
    } catch (e: any) {
      Alert.alert('PDF', e?.message ?? 'Sélection impossible');
    }
  };

  const handlePickNoticePhoto = async () => {
    Alert.alert('Photo de la notice', 'Source', [
      {
        text: 'Caméra',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return;
          const res = await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: false });
          if (!res.canceled) {
            setNoticePhotoUri(res.assets[0].uri);
            setNoticePhotoTouched(true);
          }
        },
      },
      {
        text: 'Galerie',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return;
          const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });
          if (!res.canceled) {
            setNoticePhotoUri(res.assets[0].uri);
            setNoticePhotoTouched(true);
          }
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const handlePhoto = async () => {
    Alert.alert('Photo', 'Source', [
      {
        text: 'Caméra', onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return;
          const res = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, aspect: [4, 3] });
          if (!res.canceled) setPhotoLocal(res.assets[0].uri);
        }
      },
      {
        text: 'Galerie', onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return;
          const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
          if (!res.canceled) setPhotoLocal(res.assets[0].uri);
        }
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const handleReadNfc = async () => {
    const tagId = await readNfcTagId();
    if (tagId) setNfcTagId(tagId);
    else Alert.alert('NFC', 'Aucun tag détecté');
  };

  const handleSave = async () => {
    if (!nom.trim()) {
      Alert.alert('Champ requis', 'Le nom est obligatoire');
      return;
    }
    setSaving(true);
    try {
      const data = {
        nom: nom.trim(),
        type: type || undefined,
        marque: marque || undefined,
        numero_serie: numeroSerie || undefined,
        poids_kg: poids ? parseFloat(poids) : undefined,
        categorie_id: categorieId || undefined,
        localisation_id: localisationId || undefined,
        etat,
        statut,
        date_achat: dateAchat || undefined,
        date_validite: dateValidite || undefined,
        prochain_controle: prochainControle || undefined,
        intervalle_controle_jours: (() => {
          if (!intervalleControle.trim()) return undefined;
          const n = parseInt(intervalleControle, 10);
          return Number.isFinite(n) ? n : undefined;
        })(),
        maintenance_todo: maintenanceTodo.trim() || undefined,
        maintenance_last_comment: maintenanceLastComment.trim() || undefined,
        technicien: technicien || undefined,
        qr_code: qrCode || undefined,
        nfc_tag_id: nfcTagId || undefined,
        photo_local: photoLocal || undefined,
      };

      if (item) {
        await updateMateriel(item.id, data);
        const pdfArg = noticePdfTouched ? noticePdfUri : undefined;
        const photoArg = noticePhotoTouched ? noticePhotoUri : undefined;
        const n = await syncMaterielNoticeAttachments(item.id, pdfArg, photoArg);
        if (Object.keys(n).length) await updateMateriel(item.id, n);
        const urlPatch = await pushMaterielNoticesToSupabaseAfterSave(item.id, n);
        if (Object.keys(urlPatch).length) await updateMateriel(item.id, urlPatch);
      } else {
        const newId = await insertMateriel(data as any);
        const n = await syncMaterielNoticeAttachments(newId, noticePdfUri, noticePhotoUri);
        if (Object.keys(n).length) await updateMateriel(newId, n);
        const urlPatch = await pushMaterielNoticesToSupabaseAfterSave(newId, n);
        if (Object.keys(urlPatch).length) await updateMateriel(newId, urlPatch);
      }
      onSaved();
      void triggerSyncAfterActionIfEnabled();
      onClose();
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  };

  const stampMaintenanceNow = () => {
    const iso = new Date().toISOString().slice(0, 10);
    setProchainControle(iso);
  };

  const catOptions = [
    { label: 'Aucune', value: '' },
    ...[...categories]
      .sort((a, b) =>
        categoryPathById(categories, a.id).localeCompare(categoryPathById(categories, b.id), 'fr', {
          sensitivity: 'base',
        })
      )
      .map(c => ({
        label: categoryPathById(categories, c.id) || c.nom,
        value: c.id,
      })),
  ];
  const locOptions = [
    { label: 'Aucune', value: '' },
    ...localisations.map(l => ({ label: l.nom, value: l.id })),
  ];

  return (
    <BottomModal
      visible={visible}
      onClose={onClose}
      title={item ? 'Modifier un matériel' : 'Ajouter un matériel'}
    >
      {item != null && sameNameEnStockCount != null && (
        <View style={s.sameNameInfo}>
          <Text style={s.sameNameInfoText}>
            {sameNameEnStockCount === 0
              ? 'Aucun exemplaire n’est actuellement « en stock » sous ce libellé.'
              : sameNameEnStockCount === 1
                ? 'Un seul exemplaire est « en stock » sous ce libellé (cette fiche ou une autre).'
                : `${sameNameEnStockCount} fiches sont « en stock » avec le même libellé (S/N, QR, catégorie peuvent différer).`}
          </Text>
        </View>
      )}

      <Input label="Nom" value={nom} onChangeText={setNom} placeholder="" required />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label="Type" value={type} onChangeText={setType} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Marque" value={marque} onChangeText={setMarque} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label="N° de série" value={numeroSerie} onChangeText={setNumeroSerie} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Poids (kg)" value={poids} onChangeText={setPoids} keyboardType="decimal-pad" />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <SelectPicker label="Catégorie" value={categorieId} options={catOptions} onChange={setCategorieId} />
        </View>
        <View style={{ flex: 1 }}>
          <SelectPicker label="Localisation" value={localisationId} options={locOptions} onChange={setLocalisationId} />
        </View>
      </View>

      <View style={s.newCatRow}>
        <View style={{ flex: 1 }}>
          <Input
            label="Nouvelle catégorie"
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            placeholder="Nom puis « Créer »"
            onSubmitEditing={handleAddCategory}
            returnKeyType="done"
          />
        </View>
        <TouchableOpacity style={s.newCatBtn} onPress={handleAddCategory}>
          <Text style={s.newCatBtnText}>Créer</Text>
        </TouchableOpacity>
      </View>

      <View style={s.newCatRow}>
        <View style={{ flex: 1 }}>
          <Input
            label="Nouvelle localisation"
            value={newLocalisationName}
            onChangeText={setNewLocalisationName}
            placeholder="Nom puis « Créer »"
            onSubmitEditing={handleAddLocalisation}
            returnKeyType="done"
          />
        </View>
        <TouchableOpacity style={s.newCatBtn} onPress={handleAddLocalisation}>
          <Text style={s.newCatBtnText}>Créer</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <SelectPicker label="État" value={etat} options={ETATS} onChange={v => setEtat(v as EtatMateriel)} />
        </View>
        <View style={{ flex: 1 }}>
          <SelectPicker label="Statut" value={statut} options={STATUTS} onChange={v => setStatut(v as StatutMateriel)} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <DateField label="Date achat" value={dateAchat} onChange={setDateAchat} allowClear />
        </View>
        <View style={{ flex: 1 }}>
          <DateField label="Date validité" value={dateValidite} onChange={setDateValidite} allowClear />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Input
            label="Fréquence maintenance (jours)"
            value={intervalleControle}
            onChangeText={setIntervalleControle}
            keyboardType="numeric"
            placeholder="vide = pas d'alerte"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="Dernière maintenance (auto)"
            value={prochainControle}
            onChangeText={setProchainControle}
            placeholder="yyyy-mm-dd"
          />
        </View>
      </View>
      <View style={s.maintActionsRow}>
        <TouchableOpacity style={s.maintBtn} onPress={stampMaintenanceNow}>
          <Text style={s.maintBtnText}>Horodater maintenance maintenant</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.maintBtnGhost}
          onPress={() => {
            setProchainControle('');
            setMaintenanceLastComment('');
          }}
        >
          <Text style={s.maintBtnGhostText}>Effacer horodatage</Text>
        </TouchableOpacity>
      </View>
      <Input
        label="Maintenance à effectuer"
        value={maintenanceTodo}
        onChangeText={setMaintenanceTodo}
        placeholder="Opération prévue, consignes..."
      />
      <Input
        label="Commentaire dernière maintenance"
        value={maintenanceLastComment}
        onChangeText={setMaintenanceLastComment}
        placeholder="Action réalisée, pièces changées..."
      />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label="Technicien" value={technicien} onChangeText={setTechnicien} />
        </View>
        <View style={{ flex: 1 }}>
          {!item ? (
            <>
              <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 8 }}>
                Code QR : l’identifiant interne sera utilisé automatiquement si vous laissez vide (scannable après enregistrement).
              </Text>
              <Input
                label="QR personnalisé (optionnel)"
                value={qrCode}
                onChangeText={setQrCode}
                placeholder="Vide = ID auto"
              />
            </>
          ) : (
            <Input label="QR Code" value={qrCode} onChangeText={setQrCode} />
          )}
        </View>
      </View>

      {/* NFC */}
      <View style={s.nfcRow}>
        <View style={{ flex: 1 }}>
          <Input label="Tag NFC ID" value={nfcTagId} onChangeText={setNfcTagId} placeholder="auto-détecté" />
        </View>
        <TouchableOpacity
          style={s.nfcBtn}
          onPress={handleReadNfc}
          disabled={scanning || !nfcSupported || !nfcEnabled}
        >
          <Text style={{ color: Colors.white, fontSize: 11, textAlign: 'center' }}>
            {scanning ? '...' : '📡\nLire NFC'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={s.sectionLabel}>Notice d’utilisation</Text>
      <Text style={s.sectionHint}>
        Joindre un PDF et/ou une photo (scan) de la notice. Avec Supabase configuré, ils sont aussi envoyés dans le
        stockage cloud pour les autres appareils.
      </Text>
      <View style={s.noticeRow}>
        <TouchableOpacity style={s.noticeBtn} onPress={handlePickNoticePdf}>
          <Text style={s.noticeBtnText}>{noticePdfUri ? '📄 Remplacer le PDF' : '📄 Choisir un PDF'}</Text>
        </TouchableOpacity>
        {(!!noticePdfUri || (item && (item.notice_pdf_local || item.notice_pdf_url))) && (
          <TouchableOpacity
            style={s.noticeBtnOutline}
            onPress={() => {
              setNoticePdfUri('');
              setNoticePdfTouched(true);
            }}
          >
            <Text style={s.noticeBtnOutlineText}>Retirer PDF</Text>
          </TouchableOpacity>
        )}
      </View>
      {(!!noticePdfUri || (item && (item.notice_pdf_local || item.notice_pdf_url))) && (
        <Text style={s.noticePath} numberOfLines={2}>
          {noticePdfUri
            ? noticePdfUri.includes('notice.pdf')
              ? 'Notice PDF enregistrée sur l’appareil'
              : 'PDF sélectionné (copie à l’enregistrement)'
            : item?.notice_pdf_local
              ? 'Notice PDF sur l’appareil'
              : 'Notice PDF disponible en ligne (réseau)'}
        </Text>
      )}
      <View style={s.noticeRow}>
        <TouchableOpacity style={s.noticeBtn} onPress={handlePickNoticePhoto}>
          <Text style={s.noticeBtnText}>{noticePhotoUri ? '🖼 Remplacer la photo' : '🖼 Photo de la notice'}</Text>
        </TouchableOpacity>
        {(!!noticePhotoUri || (item && (item.notice_photo_local || item.notice_photo_url))) && (
          <TouchableOpacity
            style={s.noticeBtnOutline}
            onPress={() => {
              setNoticePhotoUri('');
              setNoticePhotoTouched(true);
            }}
          >
            <Text style={s.noticeBtnOutlineText}>Retirer photo</Text>
          </TouchableOpacity>
        )}
      </View>
      {!!noticePhotoUri && (
        <Image source={{ uri: noticePhotoUri }} style={s.noticeThumb} resizeMode="cover" />
      )}

      {/* Photo */}
      <Text style={s.photoLabel}>Photo du matériel</Text>
      <TouchableOpacity style={s.photoBox} onPress={handlePhoto}>
        {photoLocal ? (
          <Image source={{ uri: photoLocal }} style={s.photo} />
        ) : (
          <View style={s.photoPlaceholder}>
            <Text style={{ fontSize: 28 }}>📷</Text>
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 6 }}>
              Prendre / choisir une photo
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <FormButtons onCancel={onClose} onSave={handleSave} loading={saving} />
    </BottomModal>
  );
}

const s = StyleSheet.create({
  newCatRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginBottom: 12 },
  newCatBtn: {
    backgroundColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  newCatBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  nfcRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginBottom: 12 },
  nfcBtn: {
    backgroundColor: Colors.green, borderRadius: 10, padding: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12, width: 60,
  },
  sectionLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  sectionHint: { color: Colors.textMuted, fontSize: 11, marginBottom: 10, lineHeight: 15 },
  noticeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  noticeBtn: {
    backgroundColor: Colors.bgCardAlt,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noticeBtnText: { color: Colors.white, fontSize: 13, fontWeight: '600' },
  noticeBtnOutline: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.textMuted,
  },
  noticeBtnOutlineText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  noticePath: { color: Colors.textMuted, fontSize: 10, marginBottom: 10 },
  noticeThumb: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginBottom: 14,
  },
  photoLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '500', marginBottom: 6, marginTop: 4 },
  photoBox: { borderRadius: 12, overflow: 'hidden', marginBottom: 16, height: 140 },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: {
    backgroundColor: Colors.bgInput, width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    borderStyle: 'dashed',
  },
  sameNameInfo: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    padding: 12,
    marginBottom: 14,
  },
  sameNameInfoText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  maintActionsRow: { flexDirection: 'row', gap: 8, marginBottom: 12, marginTop: 2 },
  maintBtn: {
    flex: 1,
    backgroundColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  maintBtnText: { color: Colors.white, fontWeight: '700', fontSize: 12 },
  maintBtnGhost: {
    backgroundColor: Colors.bgCardAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  maintBtnGhostText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
});
