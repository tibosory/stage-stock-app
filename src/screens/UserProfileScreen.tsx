// src/screens/UserProfileScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import { Card, Input, TabScreenSafeArea } from '../components/UI';
import { useAppAuth } from '../context/AuthContext';
import {
  loadUserProfile,
  saveUserProfile,
  type UserProfile,
} from '../lib/userProfileStorage';
import {
  loadTheatreBranding,
  saveTheatreIdentity,
  storePickedLogoFile,
  clearTheatreLogo,
} from '../lib/theatreBranding';
import {
  isSupabaseConfigured,
  saveAndApplySupabaseConfig,
  clearStoredSupabaseOverrideAndReapply,
  getEffectiveSupabaseUrlForDisplay,
  getSupabaseProjectUrlFromBuild,
  hasSupabaseUserOverride,
} from '../lib/supabase';
import { useSupabaseAuth } from '../hooks/useAuth';

export default function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, cloudUser, logout, logoutCloudOnly, can, refreshSession } = useAppAuth();
  const { user: sbUser, refreshProfile, signOutSupabase } = useSupabaseAuth();

  const [profile, setProfile] = useState<UserProfile>({
    prenom: '',
    nom: '',
    telephone: '',
    email: '',
    fonction: '',
    etablissement: '',
  });
  const [theatreName, setTheatreName] = useState('');
  const [theatreAddress, setTheatreAddress] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [sbUrlEdit, setSbUrlEdit] = useState('');
  const [sbKeyEdit, setSbKeyEdit] = useState('');
  const [sbSaveBusy, setSbSaveBusy] = useState(false);

  const load = useCallback(async () => {
    const [p, brand] = await Promise.all([loadUserProfile(), loadTheatreBranding()]);
    setProfile(p);
    setTheatreName(brand.theatreName);
    setTheatreAddress(brand.theatreAddress);
    setLogoUri(brand.logoUri);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshSession();
      void refreshProfile();
      setSbUrlEdit(getEffectiveSupabaseUrlForDisplay());
      setSbKeyEdit('');
      void load();
    }, [load, refreshSession, refreshProfile])
  );

  const saveProfile = async () => {
    await saveUserProfile(profile);
    Alert.alert('✓', 'Coordonnées enregistrées (signature des e-mails).');
  };

  const editInventory = can('edit_inventory');

  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 28 + Math.max(insets.bottom, 12) }}
      >
        <View style={s.headerRow}>
          <Text style={{ fontSize: 22, color: Colors.green }}>👤</Text>
          <Text style={s.title}>Utilisateur</Text>
        </View>

        <Card style={{ marginBottom: 16 }}>
          <Text style={s.sectionTitle}>Coordonnées</Text>
          <Text style={s.hint}>
            Utilisées pour la signature des e-mails générés depuis l’app (ex. demande de devis).
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Input label="Prénom" value={profile.prenom} onChangeText={t => setProfile(p => ({ ...p, prenom: t }))} />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Nom" value={profile.nom} onChangeText={t => setProfile(p => ({ ...p, nom: t }))} />
            </View>
          </View>
          <Input
            label="Téléphone"
            value={profile.telephone}
            onChangeText={t => setProfile(p => ({ ...p, telephone: t }))}
            keyboardType="phone-pad"
          />
          <Input
            label="E-mail"
            value={profile.email}
            onChangeText={t => setProfile(p => ({ ...p, email: t }))}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input label="Fonction" value={profile.fonction} onChangeText={t => setProfile(p => ({ ...p, fonction: t }))} />
          <Input
            label="Établissement"
            value={profile.etablissement}
            onChangeText={t => setProfile(p => ({ ...p, etablissement: t }))}
          />
          <TouchableOpacity style={s.addBtnFull} onPress={() => void saveProfile()}>
            <Text style={s.addBtnFullText}>Enregistrer mes coordonnées</Text>
          </TouchableOpacity>
        </Card>

        {editInventory && (
          <Card style={{ marginBottom: 16 }}>
            <Text style={s.sectionTitle}>Théâtre & en-tête PDF</Text>
            <Text style={s.hint}>
              Logo, nom du théâtre et adresse s’affichent en tête des fiches de prêt et des étiquettes PDF.
            </Text>
            <Input label="Nom du théâtre" value={theatreName} onChangeText={setTheatreName} placeholder="ex. Théâtre municipal…" />
            <Input
              label="Adresse"
              value={theatreAddress}
              onChangeText={setTheatreAddress}
              placeholder="Rue, CP ville…"
              multiline
            />
            {logoUri ? (
              <View style={{ marginBottom: 12, alignItems: 'center' }}>
                <Image
                  source={{ uri: logoUri }}
                  style={{ width: 160, height: 72, resizeMode: 'contain', marginBottom: 8 }}
                />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <TouchableOpacity
                style={s.syncBtn}
                onPress={async () => {
                  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (!perm.granted) {
                    Alert.alert('Permission', 'L’accès à la galerie est nécessaire pour choisir un logo.');
                    return;
                  }
                  const res = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 0.92,
                  });
                  if (res.canceled) return;
                  try {
                    const dest = await storePickedLogoFile(res.assets[0].uri);
                    setLogoUri(dest);
                  } catch (e: unknown) {
                    Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                <Text style={s.syncBtnText}>Choisir un logo</Text>
              </TouchableOpacity>
              {logoUri ? (
                <TouchableOpacity
                  style={s.syncBtnOutline}
                  onPress={async () => {
                    await clearTheatreLogo();
                    setLogoUri(null);
                  }}
                >
                  <Text style={s.syncBtnTextOutline}>Retirer le logo</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              style={s.addBtnFull}
              onPress={async () => {
                await saveTheatreIdentity(theatreName.trim(), theatreAddress.trim());
                Alert.alert('✓', 'Nom et adresse enregistrés pour les exports PDF.');
              }}
            >
              <Text style={s.addBtnFullText}>Enregistrer nom & adresse (PDF)</Text>
            </TouchableOpacity>
          </Card>
        )}

        <Card style={{ marginBottom: 16 }}>
          <Text style={s.sectionTitle}>Session</Text>
          {cloudUser ? (
            <Text style={{ color: Colors.textSecondary, marginBottom: 8, fontSize: 13 }}>
              Compte en ligne : {cloudUser.email}
            </Text>
          ) : null}
          <Text style={{ color: Colors.textSecondary, marginBottom: 12 }}>
            {user?.nom} · {user?.role}
          </Text>
          {cloudUser ? (
            <TouchableOpacity style={[s.syncBtnOutline, { marginBottom: 12 }]} onPress={logoutCloudOnly}>
              <Text style={s.syncBtnTextOutline}>Déconnexion du compte en ligne</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={s.addBtnFull} onPress={logout}>
            <Text style={s.addBtnFullText}>Se déconnecter</Text>
          </TouchableOpacity>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Text style={{ fontSize: 16 }}>🔗</Text>
            <Text style={s.sectionTitle}>Projet Supabase (cet appareil)</Text>
          </View>
          <Text style={s.hint}>
            URL + clé anon pour notices cloud et compte optionnel. La clé reste sur cet appareil.
          </Text>
          <Text style={{ color: Colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
            URL utilisée :{' '}
            <Text selectable style={{ color: Colors.textSecondary, fontSize: 12 }}>
              {isSupabaseConfigured() ? getEffectiveSupabaseUrlForDisplay() : '— (non configuré)'}
            </Text>
          </Text>
          {getSupabaseProjectUrlFromBuild() ? (
            <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 10 }}>
              Valeur du build : {getSupabaseProjectUrlFromBuild()}
            </Text>
          ) : (
            <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 10 }}>
              Aucune variable Supabase dans le build : la configuration ci-dessous peut être nécessaire.
            </Text>
          )}
          <Input
            label="URL du projet"
            value={sbUrlEdit}
            onChangeText={setSbUrlEdit}
            placeholder="https://xxxx.supabase.co"
            autoCapitalize="none"
          />
          <Input
            label="Clé anon (publique)"
            value={sbKeyEdit}
            onChangeText={setSbKeyEdit}
            placeholder={hasSupabaseUserOverride() ? 'Collez une nouvelle clé pour remplacer' : 'Collez la clé anon'}
            secureTextEntry
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[s.syncBtn, { marginBottom: 10 }]}
            disabled={sbSaveBusy}
            onPress={async () => {
              setSbSaveBusy(true);
              try {
                await saveAndApplySupabaseConfig(sbUrlEdit, sbKeyEdit);
                setSbKeyEdit('');
                setSbUrlEdit(getEffectiveSupabaseUrlForDisplay());
                void refreshProfile();
                Alert.alert('✓', 'Projet Supabase enregistré.');
              } catch (e: unknown) {
                Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
              } finally {
                setSbSaveBusy(false);
              }
            }}
          >
            {sbSaveBusy ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={s.syncBtnText}>Enregistrer URL et clé</Text>
            )}
          </TouchableOpacity>
          {hasSupabaseUserOverride() ? (
            <TouchableOpacity
              style={s.syncBtnOutline}
              disabled={sbSaveBusy}
              onPress={() => {
                Alert.alert(
                  'Revenir au build',
                  'Supprimer la configuration sur cet appareil et utiliser uniquement les variables du build ?',
                  [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Confirmer',
                      style: 'destructive',
                      onPress: async () => {
                        setSbSaveBusy(true);
                        try {
                          await clearStoredSupabaseOverrideAndReapply();
                          setSbUrlEdit(getEffectiveSupabaseUrlForDisplay());
                          setSbKeyEdit('');
                          void refreshProfile();
                          Alert.alert('✓', 'Configuration locale réinitialisée.');
                        } catch (e: unknown) {
                          Alert.alert('Erreur', e instanceof Error ? e.message : String(e));
                        } finally {
                          setSbSaveBusy(false);
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={s.syncBtnTextOutline}>Utiliser uniquement la config du build</Text>
            </TouchableOpacity>
          ) : null}
        </Card>

        {isSupabaseConfigured() ? (
          <Card style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Text style={{ fontSize: 16 }}>✨</Text>
              <Text style={s.sectionTitle}>Compte Supabase (optionnel)</Text>
            </View>
            <Text style={s.hint}>Connexion au projet Supabase depuis l’écran de connexion.</Text>
            {sbUser ? (
              <>
                <Text style={{ color: Colors.textSecondary, marginBottom: 8, fontSize: 13 }}>
                  {sbUser.email ?? '—'}
                </Text>
                <TouchableOpacity
                  style={[s.syncBtnOutline, { marginBottom: 12 }]}
                  onPress={() => void signOutSupabase()}
                >
                  <Text style={s.syncBtnTextOutline}>Déconnexion Supabase</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={{ color: Colors.textMuted, fontSize: 13 }}>
                Non connecté — utilisez le bloc Supabase sur l’écran de connexion.
              </Text>
            )}
          </Card>
        ) : null}
      </ScrollView>
    </TabScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  title: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  sectionTitle: { color: Colors.white, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  hint: { color: Colors.textMuted, fontSize: 12, marginBottom: 10, lineHeight: 18 },
  addBtnFull: {
    backgroundColor: Colors.green,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  addBtnFullText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  syncBtn: {
    backgroundColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  syncBtnText: { color: Colors.white, fontWeight: '600' },
  syncBtnOutline: {
    borderWidth: 1,
    borderColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  syncBtnTextOutline: { color: Colors.green, fontWeight: '600' },
});
