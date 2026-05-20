import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BottomModal, Card, SelectPicker, TabScreenSafeArea } from '../components/UI';
import { Colors } from '../theme/colors';
import { ProfileSchemaSystem } from '../application/services';
import {
  createProfile as createProfileUseCase,
  saveProfileSchemaVersion,
  validateProfileSchemaPreview,
} from '../application/usecases';
import type { DynamicFieldType, FieldDefinition, Profile, ProfileSchema } from '../types';
import { DynamicProfileForm } from '../components/DynamicProfileForm';
import { PROFILE_PRESETS } from '../lib/profilePresets';

const FIELD_TYPES: Array<{ label: string; value: DynamicFieldType }> = [
  { label: 'Texte', value: 'text' },
  { label: 'Nombre', value: 'number' },
  { label: 'Select', value: 'select' },
  { label: 'Booléen', value: 'boolean' },
  { label: 'Date', value: 'date' },
];

type DraftField = FieldDefinition;

function emptyField(): DraftField {
  return {
    id: '',
    label: '',
    type: 'text',
    required: false,
    unit: null,
    defaultValue: null,
    options: [],
    min: null,
    max: null,
    isDeleted: false,
  };
}

export default function ProfileEditorScreen() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [schema, setSchema] = useState<ProfileSchema | null>(null);
  const [history, setHistory] = useState<ProfileSchema[]>([]);
  const [newProfileName, setNewProfileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [fieldDraft, setFieldDraft] = useState<DraftField>(emptyField());
  const [draftFields, setDraftFields] = useState<FieldDefinition[]>([]);
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});

  const load = useCallback(async () => {
    const list = await ProfileSchemaSystem.listProfiles();
    setProfiles(list);
    const active = selectedProfileId || list.find(p => p.isActive)?.id || list[0]?.id || '';
    setSelectedProfileId(active);
    if (!active) {
      setSchema(null);
      setHistory([]);
      setDraftFields([]);
      return;
    }
    const [latest, versions] = await Promise.all([
      ProfileSchemaSystem.getCurrentSchema(active),
      ProfileSchemaSystem.getVersionHistory(active),
    ]);
    setSchema(latest);
    setHistory(versions);
    setDraftFields(latest?.fields ?? []);
  }, [selectedProfileId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const selectedProfile = useMemo(
    () => profiles.find(p => p.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId]
  );

  const addField = () => {
    if (!fieldDraft.id.trim() || !fieldDraft.label.trim()) {
      Alert.alert('Champ', 'ID et label sont obligatoires.');
      return;
    }
    if (draftFields.some(f => f.id === fieldDraft.id.trim())) {
      Alert.alert('Champ', 'ID déjà utilisé dans ce profil.');
      return;
    }
    setDraftFields(prev => [
      ...prev,
      { ...fieldDraft, id: fieldDraft.id.trim(), label: fieldDraft.label.trim() },
    ]);
    setFieldDraft(emptyField());
    setFieldModalOpen(false);
  };

  const moveField = (idx: number, direction: -1 | 1) => {
    const to = idx + direction;
    if (to < 0 || to >= draftFields.length) return;
    const arr = [...draftFields];
    const [item] = arr.splice(idx, 1);
    arr.splice(to, 0, item);
    setDraftFields(arr);
  };

  const softDeleteField = (idx: number) => {
    setDraftFields(prev =>
      prev.map((f, i) => (i === idx ? { ...f, isDeleted: true } : f))
    );
  };

  const saveNewVersion = async () => {
    if (!selectedProfileId) return;
    setSaving(true);
    try {
      const next = await saveProfileSchemaVersion({
        profileId: selectedProfileId,
        fields: draftFields,
        nextName: selectedProfile?.name,
      });
      setSchema(next);
      setHistory(await ProfileSchemaSystem.getVersionHistory(selectedProfileId));
      Alert.alert('Profil', `Version ${next.version} enregistrée.`);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible d’enregistrer la version');
    } finally {
      setSaving(false);
    }
  };

  const createProfileAction = async () => {
    const name = newProfileName.trim();
    if (!name) return;
    try {
      const created = await createProfileUseCase({ name });
      setNewProfileName('');
      setSelectedProfileId(created.id);
      await load();
    } catch (e: any) {
      Alert.alert('Profil', e?.message ?? 'Création impossible');
    }
  };

  const runPreviewValidation = () => {
    const issues = validateProfileSchemaPreview({ fields: draftFields, values: previewValues });
    if (!issues.length) {
      Alert.alert('Validation', 'Aucune erreur de validation.');
      return;
    }
    Alert.alert(
      'Validation',
      issues.map(i => `• ${i}`).join('\n')
    );
  };

  const applyProfilePreset = async (presetName: string) => {
    const preset = PROFILE_PRESETS.find(p => p.profileName === presetName);
    if (!preset) return;
    try {
      const existing = profiles.find(p => p.name.trim().toLowerCase() === preset.profileName.toLowerCase());
      const profile = existing ?? (await createProfileUseCase({ name: preset.profileName }));
      const next = await saveProfileSchemaVersion({
        profileId: profile.id,
        fields: preset.fields,
        nextName: preset.profileName,
      });
      setSelectedProfileId(profile.id);
      setSchema(next);
      setDraftFields(next.fields);
      setHistory(await ProfileSchemaSystem.getVersionHistory(profile.id));
      Alert.alert(
        'Profil importé',
        existing
          ? `${preset.profileName} mis à jour en version ${next.version}.`
          : `${preset.profileName} créé en version ${next.version}.`
      );
      await load();
    } catch (e: any) {
      Alert.alert('Import preset', e?.message ?? 'Import impossible');
    }
  };

  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Card>
          <Text style={s.title}>Profile List</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TextInput
              value={newProfileName}
              onChangeText={setNewProfileName}
              placeholder="Nouveau profil (ex. Son / Lumière)"
              placeholderTextColor={Colors.textMuted}
              style={[s.input, { flex: 1 }]}
            />
            <TouchableOpacity style={s.btn} onPress={() => void createProfileAction()}>
              <Text style={s.btnText}>Créer</Text>
            </TouchableOpacity>
          </View>
          <SelectPicker
            label="Profil actif"
            value={selectedProfileId}
            options={profiles.map(p => ({ value: p.id, label: `${p.name} (v${p.version})` }))}
            onChange={v => setSelectedProfileId(v)}
          />
          {selectedProfile && (
            <View style={s.row}>
              <Text style={s.muted}>Actif pour saisie matériel</Text>
              <Switch
                value={selectedProfile.isActive}
                onValueChange={v => void ProfileSchemaSystem.setProfileActive(selectedProfile.id, v).then(load)}
              />
            </View>
          )}
        </Card>

        <Card>
          <Text style={s.title}>Profile Info</Text>
          <Text style={s.muted}>
            {selectedProfile
              ? `${selectedProfile.name} — version ${selectedProfile.version}`
              : 'Sélectionnez un profil.'}
          </Text>
        </Card>

        <Card>
          <Text style={s.title}>Presets métiers</Text>
          <Text style={s.muted}>
            Import en un clic : crée (ou met à jour) les profils Costumière, Accessoiriste, Lumière, Audio, Vidéo
            et Structure / Scène.
          </Text>
          {PROFILE_PRESETS.map(preset => (
            <TouchableOpacity
              key={preset.profileName}
              style={[s.btn, { marginTop: 8 }]}
              onPress={() => void applyProfilePreset(preset.profileName)}
            >
              <Text style={s.btnText}>Importer « {preset.profileName} »</Text>
            </TouchableOpacity>
          ))}
        </Card>

        <Card>
          <View style={s.rowBetween}>
            <Text style={s.title}>Field List</Text>
            <TouchableOpacity style={s.btn} onPress={() => setFieldModalOpen(true)}>
              <Text style={s.btnText}>Ajouter un champ</Text>
            </TouchableOpacity>
          </View>
          {draftFields.map((f, idx) => (
            <View key={`${f.id}-${idx}`} style={[s.fieldRow, f.isDeleted && { opacity: 0.4 }]}>
              <Text style={{ color: Colors.white, flex: 1 }}>
                {f.label} ({f.type}) {f.required ? '*' : ''} {f.isDeleted ? '[supprimé]' : ''}
              </Text>
              <TouchableOpacity onPress={() => moveField(idx, -1)}><Text style={s.action}>↑</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => moveField(idx, 1)}><Text style={s.action}>↓</Text></TouchableOpacity>
              {!f.isDeleted && (
                <TouchableOpacity onPress={() => softDeleteField(idx)}>
                  <Text style={[s.action, { color: Colors.red }]}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </Card>

        <Card>
          <Text style={s.title}>Live Preview Form</Text>
          <DynamicProfileForm
            fields={draftFields}
            values={previewValues}
            onChange={(fieldId, value) =>
              setPreviewValues(prev => ({ ...prev, [fieldId]: value }))
            }
          />
          <TouchableOpacity style={[s.btn, { marginTop: 12 }]} onPress={runPreviewValidation}>
            <Text style={s.btnText}>Valider le preview</Text>
          </TouchableOpacity>
        </Card>

        <Card>
          <Text style={s.title}>Version history</Text>
          {history.map(v => (
            <Text key={v.version} style={s.muted}>
              v{v.version} — {v.fields.filter(f => !f.isDeleted).length} champs actifs
            </Text>
          ))}
        </Card>

        <TouchableOpacity
          style={[s.btn, saving && { opacity: 0.6 }]}
          disabled={saving || !selectedProfileId}
          onPress={() => void saveNewVersion()}
        >
          <Text style={s.btnText}>{saving ? 'Enregistrement…' : 'Créer une nouvelle version'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomModal visible={fieldModalOpen} onClose={() => setFieldModalOpen(false)} title="Add Field">
        <TextInput
          value={fieldDraft.id}
          onChangeText={t => setFieldDraft(prev => ({ ...prev, id: t }))}
          placeholder="id interne (ex. power_w)"
          placeholderTextColor={Colors.textMuted}
          style={s.input}
        />
        <TextInput
          value={fieldDraft.label}
          onChangeText={t => setFieldDraft(prev => ({ ...prev, label: t }))}
          placeholder="Label"
          placeholderTextColor={Colors.textMuted}
          style={s.input}
        />
        <SelectPicker
          label="Type"
          value={fieldDraft.type}
          options={FIELD_TYPES}
          onChange={v => setFieldDraft(prev => ({ ...prev, type: v as DynamicFieldType }))}
        />
        <View style={s.row}>
          <Text style={s.muted}>Requis</Text>
          <Switch
            value={fieldDraft.required}
            onValueChange={v => setFieldDraft(prev => ({ ...prev, required: v }))}
          />
        </View>
        {fieldDraft.type === 'select' && (
          <TextInput
            value={(fieldDraft.options ?? []).join(', ')}
            onChangeText={t =>
              setFieldDraft(prev => ({
                ...prev,
                options: t
                  .split(',')
                  .map(x => x.trim())
                  .filter(Boolean),
              }))
            }
            placeholder="Options séparées par virgule"
            placeholderTextColor={Colors.textMuted}
            style={s.input}
          />
        )}
        <TouchableOpacity style={s.btn} onPress={addField}>
          <Text style={s.btnText}>Ajouter</Text>
        </TouchableOpacity>
      </BottomModal>
    </TabScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  title: { color: Colors.white, fontWeight: '800', fontSize: 15 },
  muted: { color: Colors.textMuted, fontSize: 12 },
  input: {
    marginTop: 8,
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    color: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  btn: {
    backgroundColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  btnText: { color: Colors.white, fontWeight: '700' },
  fieldRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 6,
  },
  action: { color: Colors.green, fontSize: 16, fontWeight: '700' },
});
