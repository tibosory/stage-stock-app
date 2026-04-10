// src/components/MaterielModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../theme/colors';
import {
  insertMateriel, updateMateriel, getCategories, getLocalisations
} from '../db/database';
import { Materiel, Categorie, Localisation, EtatMateriel, StatutMateriel } from '../types';
import {
  Input, SelectPicker, BottomModal, FormButtons
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
  categories, localisations, initialQr, initialNfc
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
  const [technicien, setTechnicien] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [nfcTagId, setNfcTagId] = useState('');
  const [photoLocal, setPhotoLocal] = useState('');
  const [saving, setSaving] = useState(false);

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
      setTechnicien(item.technicien ?? '');
      setQrCode(item.qr_code ?? '');
      setNfcTagId(item.nfc_tag_id ?? '');
      setPhotoLocal(item.photo_local ?? '');
    } else {
      setNom(''); setType(''); setMarque(''); setNumeroSerie('');
      setPoids(''); setCategorieId(''); setLocalisationId('');
      setEtat('bon'); setStatut('en stock');
      setDateAchat(''); setDateValidite(''); setProchainControle(''); setIntervalleControle('');
      setTechnicien('');
      setQrCode(initialQr ?? '');
      setNfcTagId(initialNfc ?? '');
      setPhotoLocal('');
    }
  }, [visible, item, initialQr, initialNfc]);

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
        technicien: technicien || undefined,
        qr_code: qrCode || undefined,
        nfc_tag_id: nfcTagId || undefined,
        photo_local: photoLocal || undefined,
      };

      if (item) {
        await updateMateriel(item.id, data);
      } else {
        await insertMateriel(data as any);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  };

  const catOptions = [
    { label: 'Aucune', value: '' },
    ...categories.map(c => ({ label: c.nom, value: c.id })),
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

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <SelectPicker label="État" value={etat} options={ETATS} onChange={v => setEtat(v as EtatMateriel)} />
        </View>
        <View style={{ flex: 1 }}>
          <SelectPicker label="Statut" value={statut} options={STATUTS} onChange={v => setStatut(v as StatutMateriel)} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label="Date achat (AAAA-MM-JJ)" value={dateAchat} onChangeText={setDateAchat} placeholder="2024-01-15" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Date validité" value={dateValidite} onChangeText={setDateValidite} placeholder="2026-01-15" />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input
            label="Prochain contrôle"
            value={prochainControle}
            onChangeText={setProchainControle}
            placeholder="AAAA-MM-JJ"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="Intervalle (jours)"
            value={intervalleControle}
            onChangeText={setIntervalleControle}
            keyboardType="numeric"
            placeholder="ex. 90"
          />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label="Technicien" value={technicien} onChangeText={setTechnicien} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="QR Code" value={qrCode} onChangeText={setQrCode} />
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

      {/* Photo */}
      <Text style={s.photoLabel}>Photo</Text>
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
  nfcRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginBottom: 12 },
  nfcBtn: {
    backgroundColor: Colors.green, borderRadius: 10, padding: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12, width: 60,
  },
  photoLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '500', marginBottom: 6 },
  photoBox: { borderRadius: 12, overflow: 'hidden', marginBottom: 16, height: 140 },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: {
    backgroundColor: Colors.bgInput, width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    borderStyle: 'dashed',
  },
});
