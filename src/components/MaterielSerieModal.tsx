// src/components/MaterielSerieModal.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { insertMaterielsSerieBatch, insertCategorie, insertLocalisation } from '../db/database';
import { triggerSyncAfterActionIfEnabled } from '../lib/syncAfterAction';
import { Categorie, Localisation, EtatMateriel, StatutMateriel } from '../types';
import { Input, SelectPicker, BottomModal, FormButtons, DateField } from './UI';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  categories: Categorie[];
  localisations: Localisation[];
  onMetaRefresh?: () => void | Promise<void>;
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

const QR_MODES = [
  { label: 'QR unique (ID interne, recommandé)', value: 'id' },
  { label: 'QR = n° de série (scan du label)', value: 'serial' },
];

const NOM_MODES = [
  { label: 'Nom « base — n° série »', value: 'dash' },
  { label: 'Nom « base (n° série) »', value: 'paren' },
  { label: 'Nom « base » + numéro seul (1, 2…)', value: 'index' },
];

const MAX_SERIE = 80;

function formatSerialPart(n: number, pad: number): string {
  if (pad <= 0) return String(n);
  return String(n).padStart(pad, '0');
}

function buildSerial(prefix: string, n: number, pad: number): string {
  return `${prefix}${formatSerialPart(n, pad)}`;
}

export default function MaterielSerieModal({
  visible,
  onClose,
  onSaved,
  categories,
  localisations,
  onMetaRefresh,
}: Props) {
  const [nomBase, setNomBase] = useState('');
  const [marque, setMarque] = useState('');
  const [type, setType] = useState('');
  const [categorieId, setCategorieId] = useState('');
  const [localisationId, setLocalisationId] = useState('');
  const [etat, setEtat] = useState<EtatMateriel>('bon');
  const [statut, setStatut] = useState<StatutMateriel>('en stock');
  const [seriePrefix, setSeriePrefix] = useState('');
  const [serieDebut, setSerieDebut] = useState('1');
  const [serieQuantite, setSerieQuantite] = useState('5');
  const [seriePadding, setSeriePadding] = useState('3');
  const [qrMode, setQrMode] = useState<'id' | 'serial'>('id');
  const [nomMode, setNomMode] = useState<'dash' | 'paren' | 'index'>('dash');
  const [dateAchat, setDateAchat] = useState('');
  const [technicien, setTechnicien] = useState('');
  const [saving, setSaving] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newLocalisationName, setNewLocalisationName] = useState('');

  useEffect(() => {
    if (!visible) return;
    setNomBase('');
    setMarque('');
    setType('');
    setCategorieId('');
    setLocalisationId('');
    setEtat('bon');
    setStatut('en stock');
    setSeriePrefix('');
    setSerieDebut('1');
    setSerieQuantite('5');
    setSeriePadding('3');
    setQrMode('id');
    setNomMode('dash');
    setDateAchat('');
    setTechnicien('');
    setNewCategoryName('');
    setNewLocalisationName('');
  }, [visible]);

  const handleAddLocalisation = async () => {
    const t = newLocalisationName.trim();
    if (!t) {
      Alert.alert('Localisation', 'Saisissez un nom pour la nouvelle localisation.');
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

  const catOptions = [
    { label: 'Aucune', value: '' },
    ...categories.map(c => ({ label: c.nom, value: c.id })),
  ];
  const locOptions = [
    { label: 'Aucune', value: '' },
    ...localisations.map(l => ({ label: l.nom, value: l.id })),
  ];

  const preview = (): string => {
    const start = parseInt(serieDebut, 10);
    const qty = parseInt(serieQuantite, 10);
    const pad = parseInt(seriePadding, 10);
    if (!Number.isFinite(start) || !Number.isFinite(qty) || qty < 1) return '—';
    const p = Number.isFinite(pad) && pad >= 0 ? pad : 0;
    const a = buildSerial(seriePrefix, start, p);
    const b = buildSerial(seriePrefix, start + 1, p);
    const last = buildSerial(seriePrefix, start + qty - 1, p);
    if (qty <= 2) return `${a}, ${b}`;
    return `${a}, ${b}, … ${last}`;
  };

  const handleSave = async () => {
    if (!nomBase.trim()) {
      Alert.alert('Champ requis', 'Indiquez un nom de base (ex. nom du modèle).');
      return;
    }
    const start = parseInt(serieDebut, 10);
    const qty = parseInt(serieQuantite, 10);
    const pad = parseInt(seriePadding, 10);
    if (!Number.isFinite(start) || start < 0) {
      Alert.alert('Série', 'Numéro de départ invalide (entier ≥ 0).');
      return;
    }
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_SERIE) {
      Alert.alert('Série', `Quantité entre 1 et ${MAX_SERIE}.`);
      return;
    }
    const padN = Number.isFinite(pad) && pad >= 0 ? pad : 0;

    const rows: Parameters<typeof insertMaterielsSerieBatch>[0] = [];
    for (let i = 0; i < qty; i++) {
      const num = start + i;
      const serial = buildSerial(seriePrefix, num, padN);
      let nom: string;
      if (nomMode === 'dash') {
        nom = `${nomBase.trim()} — ${serial}`;
      } else if (nomMode === 'paren') {
        nom = `${nomBase.trim()} (${serial})`;
      } else {
        nom = `${nomBase.trim()} ${i + 1}`; // index
      }
      const qr_code = qrMode === 'serial' ? serial : undefined;
      rows.push({
        nom,
        type: type || undefined,
        marque: marque || undefined,
        numero_serie: serial,
        poids_kg: undefined,
        categorie_id: categorieId || undefined,
        localisation_id: localisationId || undefined,
        etat,
        statut,
        date_achat: dateAchat || undefined,
        date_validite: undefined,
        prochain_controle: undefined,
        intervalle_controle_jours: undefined,
        technicien: technicien || undefined,
        qr_code,
        nfc_tag_id: undefined,
        photo_url: undefined,
        photo_local: undefined,
      });
    }

    setSaving(true);
    try {
      const n = await insertMaterielsSerieBatch(rows);
      Alert.alert('✓ Série créée', `${n} matériel(s) ajouté(s).`);
      onSaved();
      void triggerSyncAfterActionIfEnabled();
      onClose();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Échec de la création');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomModal visible={visible} onClose={onClose} title="Série (même marque / modèle)">
      <Text style={styles.hint}>
        Même marque, modèle et réglages pour tous les articles. Les numéros de série et les QR sont
        différents pour chaque ligne.
      </Text>

      <Input label="Nom de base (modèle)" value={nomBase} onChangeText={setNomBase} required />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label="Marque" value={marque} onChangeText={setMarque} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Type / modèle" value={type} onChangeText={setType} />
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

      <View style={styles.newCatRow}>
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
        <TouchableOpacity style={styles.newCatBtn} onPress={handleAddCategory}>
          <Text style={styles.newCatBtnText}>Créer</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.newCatRow}>
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
        <TouchableOpacity style={styles.newCatBtn} onPress={handleAddLocalisation}>
          <Text style={styles.newCatBtnText}>Créer</Text>
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

      <View style={styles.sep} />
      <Text style={styles.section}>Numérotation série</Text>

      <Input
        label="Préfixe n° série (optionnel)"
        value={seriePrefix}
        onChangeText={setSeriePrefix}
        placeholder="ex. INV- ou ML-"
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label="N° départ" value={serieDebut} onChangeText={setSerieDebut} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label={`Quantité (max ${MAX_SERIE})`} value={serieQuantite} onChangeText={setSerieQuantite} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="Padding (chiffres)"
            value={seriePadding}
            onChangeText={setSeriePadding}
            keyboardType="number-pad"
            placeholder="0"
          />
        </View>
      </View>

      <Text style={styles.preview}>Exemples : {preview()}</Text>

      <SelectPicker
        label="Format du nom affiché"
        value={nomMode}
        options={NOM_MODES}
        onChange={v => setNomMode(v as 'dash' | 'paren' | 'index')}
      />

      <SelectPicker label="Contenu du QR" value={qrMode} options={QR_MODES} onChange={v => setQrMode(v as 'id' | 'serial')} />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <DateField label="Date achat (commune)" value={dateAchat} onChange={setDateAchat} allowClear />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Technicien" value={technicien} onChangeText={setTechnicien} />
        </View>
      </View>

      <FormButtons onCancel={onClose} onSave={handleSave} loading={saving} />
    </BottomModal>
  );
}

const styles = StyleSheet.create({
  newCatRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginBottom: 12 },
  newCatBtn: {
    backgroundColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  newCatBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  hint: {
    color: Colors.textMuted,
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },
  section: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  sep: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  preview: {
    color: Colors.green,
    fontSize: 12,
    marginBottom: 12,
    marginTop: -4,
  },
});
