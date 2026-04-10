// src/screens/MaterielDetailScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Image, TouchableOpacity, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import {
  getMaterielById, setNfcTagMateriel, updateMateriel, getHistoriqueEmpruntsMateriel,
} from '../db/database';
import { exportEtiquetteMaterielPdf } from '../lib/pdfEtiquette';
import { MaterielEmpruntHistorique } from '../types';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { uploadPhoto } from '../lib/supabase';
import { useNfc } from '../hooks/useNfc';
import { Materiel } from '../types';
import { EtatBadge, StatutBadge, Card } from '../components/UI';
import { useAuth } from '../context/AuthContext';

export default function MaterielDetailScreen() {
  const { can } = useAuth();
  const editOk = can('edit_inventory');
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { materielId } = route.params ?? {};

  const [mat, setMat] = useState<Materiel | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [historique, setHistorique] = useState<MaterielEmpruntHistorique[]>([]);

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
    <SafeAreaView style={s.container}>
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

        {/* Photo */}
        <TouchableOpacity style={s.photoBox} onPress={handlePhoto} disabled={!editOk}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={s.photo} />
          ) : (
            <View style={s.photoPlaceholder}>
              <Text style={{ fontSize: 36 }}>📷</Text>
              <Text style={{ color: Colors.textMuted, marginTop: 8, fontSize: 13 }}>
                Appuyer pour ajouter une photo
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

        {editOk && (
          <TouchableOpacity
            style={[s.editBtn, { marginBottom: 10 }]}
            onPress={async () => {
              try {
                await exportEtiquetteMaterielPdf(mat);
              } catch (e: any) {
                Alert.alert('PDF', e?.message ?? 'Erreur export');
              }
            }}
          >
            <Text style={{ color: Colors.white, fontWeight: '700', fontSize: 15 }}>📄 PDF étiquette (QR)</Text>
          </TouchableOpacity>
        )}

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
    </SafeAreaView>
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
  subtitle: { color: Colors.textSecondary, fontSize: 15, marginBottom: 16 },
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
});
