// src/components/MaterielModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Image
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { triggerSyncAfterActionIfEnabled } from '../lib/syncAfterAction';
import { Colors } from '../theme/colors';
import {
  insertCategorie, insertLocalisation, categoryPathById,
} from '../db/catalogDb';
import { getTourById } from '../db/trackingDb';
import { Materiel, Categorie, Localisation, EtatMateriel, StatutMateriel, Profile, FieldDefinition } from '../types';
import {
  Input, SelectPicker, BottomModal, FormButtons, DateField,
} from './UI';
import { useNfc } from '../hooks/useNfc';
import { DynamicProfileForm } from './DynamicProfileForm';
import { ProfileSchemaSystem } from '../application/services';
import { loadMaterialProfileSchema, saveMaterialUseCase } from '../application/usecases';
import { useLanguage } from '../context/LanguageContext';
import { isMaterielGestionLot, materielLotUnite, materielStockActuel } from '../lib/materielLot';
import { stockFlightcaseKeyFromMateriel, assertMaterielQrNotFlightcase } from '../lib/stockFlightcase';
import { ensureStockFlightcase } from '../db/stockFlightcasesDb';
type DynamicAttrs = Record<string, string | number | boolean | null>;


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
  /** Raccourci vers l’écran d’édition des profils dynamiques. */
  onOpenProfileEditor?: () => void;
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
  { label: 'On tour', value: 'en tournée' },
  { label: 'En réparation', value: 'en réparation' },
  { label: 'Perdu', value: 'perdu' },
];

function parseWeightKg(raw: string): number | undefined | null {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function MaterielModal({
  visible, onClose, onSaved, item,
  categories, localisations, initialQr, initialNfc, onMetaRefresh,
  sameNameEnStockCount,
  onOpenProfileEditor,
}: Props) {
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const [nom, setNom] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [marque, setMarque] = useState('');
  const [numeroSerie, setNumeroSerie] = useState('');
  const [poids, setPoids] = useState('');
  const [categorieId, setCategorieId] = useState('');
  const [localisationId, setLocalisationId] = useState('');
  const [flightcase, setFlightcase] = useState('');
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
  const [newCatParentId, setNewCatParentId] = useState('');
  const [newLocalisationName, setNewLocalisationName] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedProfileVersion, setSelectedProfileVersion] = useState<number | null>(null);
  const [dynamicFields, setDynamicFields] = useState<FieldDefinition[]>([]);
  const [dynamicAttrs, setDynamicAttrs] = useState<DynamicAttrs>({});
  const [currentTourName, setCurrentTourName] = useState('');

  const { nfcSupported, nfcEnabled, scanning, readNfcTagId } = useNfc();

  useEffect(() => {
    if (!visible) return;
    if (item) {
      setNom(item.nom);
      setQuantite(
        isMaterielGestionLot(item)
          ? String(materielStockActuel(item))
          : '1'
      );
      setMarque(item.marque ?? '');
      setNumeroSerie(item.numero_serie ?? '');
      setPoids(item.poids_kg?.toString() ?? '');
      setCategorieId(item.categorie_id ?? '');
      setLocalisationId(item.localisation_id ?? '');
      setFlightcase(item.flightcase ?? '');
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
      setPhotoLocal(item.photo_local ?? item.photo_url ?? '');
      setNoticePdfUri(item.notice_pdf_local ?? item.notice_pdf_url ?? '');
      setNoticePhotoUri(item.notice_photo_local ?? item.notice_photo_url ?? '');
    } else {
      setNom(''); setQuantite('1'); setMarque(''); setNumeroSerie('');
      setPoids(''); setCategorieId(''); setLocalisationId(''); setFlightcase('');
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
    setNewCatParentId('');
    setNewLocalisationName('');
    setNoticePdfTouched(false);
    setNoticePhotoTouched(false);
  }, [visible, item, initialQr, initialNfc]);

  const statutLockedByTour = Boolean(item?.tracking_state === 'in_tour' && item?.current_tour_id);

  useEffect(() => {
    if (!visible || !item?.current_tour_id) {
      setCurrentTourName('');
      return;
    }
    let alive = true;
    void getTourById(item.current_tour_id)
      .then(tour => {
        if (!alive) return;
        setCurrentTourName(tour?.name?.trim() || item.current_tour_id || '');
      })
      .catch(() => {
        if (!alive) return;
        setCurrentTourName(item.current_tour_id || '');
      });
    return () => {
      alive = false;
    };
  }, [visible, item?.current_tour_id]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const loaded = await loadMaterialProfileSchema({
        materialProfileId: item?.profile_id ?? null,
        materialProfileVersion: item?.profile_version ?? null,
      });
      if (cancelled) return;
      setProfiles(loaded.profiles);
      setSelectedProfileId(loaded.selectedProfileId);
      setDynamicFields(loaded.fields);
      setSelectedProfileVersion(loaded.selectedProfileVersion);
      const existingTechnical =
        item?.technical_data && typeof item.technical_data === 'string'
          ? JSON.parse(item.technical_data || '{}')
          : (item?.technical_data as DynamicAttrs | null) ?? {};
      setDynamicAttrs((existingTechnical ?? {}) as DynamicAttrs);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [visible, item]);

  useEffect(() => {
    if (!visible) return;
    if (!selectedProfileId) {
      // Sans profil dynamique, aucune règle de champ requis ne doit s'appliquer.
      setDynamicFields([]);
      setSelectedProfileVersion(null);
      return;
    }
    (async () => {
      const schema = await ProfileSchemaSystem.getCurrentSchema(selectedProfileId);
      setDynamicFields(schema?.fields ?? []);
      setSelectedProfileVersion(schema?.version ?? null);
    })().catch(() => undefined);
  }, [visible, selectedProfileId]);

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
    const name = newCategoryName.trim();
    if (!name) {
      Alert.alert(t('consumables.category.nameRequired'), t('consumables.category.nameRequiredBody'));
      return;
    }
    try {
      const pid = newCatParentId.trim() || null;
      const id = await insertCategorie(name, pid);
      setNewCategoryName('');
      setNewCatParentId('');
      setCategorieId(id);
      await onMetaRefresh?.();
      Alert.alert('✓', t('consumables.category.created'));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(t('scanner.error'), msg);
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
          const res = await ImagePicker.launchCameraAsync({ quality: 0.65, allowsEditing: false });
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
          const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.65 });
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
          const res = await ImagePicker.launchCameraAsync({ quality: 0.65, allowsEditing: true, aspect: [4, 3] });
          if (!res.canceled) setPhotoLocal(res.assets[0].uri);
        }
      },
      {
        text: 'Galerie', onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return;
          const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.65 });
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

  const handlePoidsChange = (next: string) => {
    const normalized = next.replace('.', ',');
    if (/^\d*(?:[.,]\d{0,2})?$/.test(normalized)) {
      setPoids(normalized);
    }
  };

  const handleSave = async () => {
    if (!nom.trim()) {
      Alert.alert('Champ requis', 'Le nom est obligatoire');
      return;
    }
    const parsedWeight = parseWeightKg(poids);
    if (parsedWeight === null) {
      Alert.alert('Poids invalide', 'Utilisez un nombre avec 2 décimales max (ex: 12,34).');
      return;
    }
    const qtyParsed = parseInt(quantite, 10);
    if (!item) {
      if (!Number.isFinite(qtyParsed) || qtyParsed < 1) {
        Alert.alert(t('stock.lot.qtyInvalidTitle'), t('stock.lot.qtyInvalidBody'));
        return;
      }
    } else if (isMaterielGestionLot(item)) {
      if (!Number.isFinite(qtyParsed) || qtyParsed < 0) {
        Alert.alert(t('stock.lot.qtyInvalidTitle'), t('stock.lot.stockInvalidBody'));
        return;
      }
    }
    setSaving(true);
    try {
      if (qrCode.trim()) {
        try {
          assertMaterielQrNotFlightcase(qrCode);
        } catch (e: unknown) {
          Alert.alert(t('scanner.error'), e instanceof Error ? e.message : String(e));
          setSaving(false);
          return;
        }
      }
      const gestionLot = item ? isMaterielGestionLot(item) : qtyParsed > 1;
      const stockActuel = item
        ? isMaterielGestionLot(item)
          ? qtyParsed
          : 1
        : qtyParsed;
      const data = {
        nom: nom.trim(),
        marque: marque || undefined,
        numero_serie: gestionLot ? undefined : numeroSerie || undefined,
        poids_kg: parsedWeight,
        categorie_id: categorieId || undefined,
        localisation_id: localisationId || undefined,
        flightcase: flightcase.trim() || undefined,
        etat,
        statut: statutLockedByTour ? 'en tournée' : statut,
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
        technical_data: dynamicAttrs,
        profile_id: selectedProfileId || undefined,
        profile_version: selectedProfileVersion ?? undefined,
        gestion_lot: gestionLot ? 1 : 0,
        stock_actuel: stockActuel,
        unite: gestionLot ? materielLotUnite(item ?? { unite: 'pièce' }) : 'pièce',
      };
      await saveMaterialUseCase({
        existingMaterialId: item?.id,
        materialData: data as any,
        profileFields: dynamicFields as any,
        dynamicAttrs,
        noticePdfUri,
        noticePhotoUri,
        noticePdfTouched,
        noticePhotoTouched,
      });
      if (flightcase.trim()) {
        await ensureStockFlightcase(localisationId || null, flightcase.trim());
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

  const sortedCats = useMemo(
    () =>
      [...categories].sort((a, b) =>
        categoryPathById(categories, a.id).localeCompare(categoryPathById(categories, b.id), 'fr', {
          sensitivity: 'base',
        })
      ),
    [categories]
  );

  const catOptions = useMemo(
    () => [
      { label: t('common.none'), value: '' },
      ...sortedCats.map(c => ({
        label: categoryPathById(categories, c.id) || c.nom,
        value: c.id,
      })),
    ],
    [categories, sortedCats, t]
  );

  const parentCreateOptions = useMemo(
    () => [
      { label: t('consumables.category.rootMain'), value: '' },
      ...sortedCats.map(c => ({
        label: categoryPathById(categories, c.id) || c.nom,
        value: c.id,
      })),
    ],
    [categories, sortedCats, t]
  );
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
        {(!item || isMaterielGestionLot(item)) && (
          <View style={{ flex: 1 }}>
            <Input
              label={item ? t('stock.lot.stockLabel') : t('stock.lot.qtyLabel')}
              value={quantite}
              onChangeText={setQuantite}
              keyboardType="number-pad"
              placeholder="1"
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Input label="Marque" value={marque} onChangeText={setMarque} />
        </View>
      </View>

      {!item && <Text style={s.lotHint}>{t('stock.lot.createHint')}</Text>}
      {item && isMaterielGestionLot(item) && (
        <Text style={s.lotHint}>
          {t('stock.lot.editHint', { unit: materielLotUnite(item) })}
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {(!item || !isMaterielGestionLot(item)) && (
          <View style={{ flex: 1 }}>
            <Input label="N° de série" value={numeroSerie} onChangeText={setNumeroSerie} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Input
            label="Poids (kg)"
            value={poids}
            onChangeText={handlePoidsChange}
            keyboardType="decimal-pad"
            placeholder="Ex: 12,34"
          />
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

      <Input
        label={t('stock.flightcase.label')}
        value={flightcase}
        onChangeText={setFlightcase}
        placeholder={t('stock.flightcase.placeholder')}
      />
      <Text style={s.lotHint}>{t('stock.flightcase.hint')}</Text>
      <Text style={s.lotHint}>{t('stock.flightcase.qrSeparateHint')}</Text>
      {item && flightcase.trim() ? (
        <TouchableOpacity
          style={s.fcOpenBtn}
          onPress={() => {
            const key = stockFlightcaseKeyFromMateriel({
              localisation_id: localisationId || null,
              flightcase,
            });
            if (!key) return;
            onClose();
            navigation.navigate('FlightcaseDetail', {
              localisationId: key.localisationId,
              flightcase: key.flightcase,
            });
          }}
        >
          <Text style={s.fcOpenBtnText}>📦 {t('stock.flightcase.openContent')}</Text>
        </TouchableOpacity>
      ) : null}

      <View style={s.newCatBlock}>
        <Text style={s.newCatHint}>{t('consumables.category.createHint')}</Text>
        <SelectPicker
          label={t('consumables.category.parentOptional')}
          value={newCatParentId}
          options={parentCreateOptions}
          onChange={setNewCatParentId}
        />
        <Input
          label={t('consumables.category.newName')}
          value={newCategoryName}
          onChangeText={setNewCategoryName}
          placeholder={t('consumables.category.newPlaceholder')}
          onSubmitEditing={handleAddCategory}
          returnKeyType="done"
        />
        <TouchableOpacity style={s.newCatCreateBtn} onPress={handleAddCategory}>
          <Text style={s.newCatBtnText}>{t('consumables.category.create')}</Text>
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
          <SelectPicker
            label="Statut"
            value={statutLockedByTour ? 'en tournée' : statut}
            options={STATUTS}
            onChange={v => setStatut(v as StatutMateriel)}
            disabled={statutLockedByTour}
          />
        </View>
      </View>
      {statutLockedByTour ? (
        <Text style={s.lockInfo}>
          Statut verrouillé : ce matériel est en tournée ({currentTourName || item?.current_tour_id}). Modifiez-le depuis la tournée.
        </Text>
      ) : null}

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

      <Text style={s.sectionLabel}>Profil métier dynamique</Text>
      {onOpenProfileEditor ? (
        <TouchableOpacity style={s.profileEditorBtn} onPress={onOpenProfileEditor}>
          <Text style={s.profileEditorBtnText}>Ouvrir l’éditeur de profils dynamiques</Text>
        </TouchableOpacity>
      ) : null}
      <SelectPicker
        label="Profil"
        value={selectedProfileId}
        options={[
          { label: 'Aucun profil', value: '' },
          ...profiles.map(p => ({ label: `${p.name} (v${p.version})`, value: p.id })),
        ]}
        onChange={setSelectedProfileId}
      />
      {!!selectedProfileVersion && (
        <Text style={s.sectionHint}>Version appliquée au matériel: v{selectedProfileVersion}</Text>
      )}
      {!!selectedProfileId && (
        <DynamicProfileForm
          fields={dynamicFields}
          values={dynamicAttrs}
          onChange={(fieldId, value) =>
            setDynamicAttrs(prev => ({ ...prev, [fieldId]: (value ?? null) as DynamicAttrs[string] }))
          }
        />
      )}

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
  newCatBlock: {
    marginTop: 4,
    marginBottom: 8,
    padding: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  newCatHint: { color: Colors.textMuted, fontSize: 12, marginBottom: 10 },
  newCatRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginBottom: 12 },
  newCatCreateBtn: {
    backgroundColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
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
  lotHint: { color: Colors.textMuted, fontSize: 12, marginBottom: 12, lineHeight: 17 },
  fcOpenBtn: {
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.green,
    alignItems: 'center',
  },
  fcOpenBtnText: { color: Colors.green, fontWeight: '700', fontSize: 13 },
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
  lockInfo: { color: Colors.yellow, fontSize: 12, marginTop: -6, marginBottom: 10, lineHeight: 17 },
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
  profileEditorBtn: {
    borderWidth: 1,
    borderColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    backgroundColor: Colors.greenBg,
  },
  profileEditorBtnText: { color: Colors.green, fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
