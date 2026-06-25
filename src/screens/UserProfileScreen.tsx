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
  Platform,
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
import { exportShareSupabaseSchemaSql } from '../lib/supabaseSchemaSql';
import { useSupabaseAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { BackendModePicker } from '../components/BackendModePicker';
import { SupabaseAccountForm } from '../components/SupabaseAccountForm';

export default function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const bottomSafePad =
    Platform.OS === 'android' ? Math.max(insets.bottom, 64) : Math.max(insets.bottom, 16);
  const { user, cloudUser, logout, logoutCloudOnly, can, refreshSession } = useAppAuth();
  const { user: sbUser, refreshProfile, signOutSupabase } = useSupabaseAuth();
  const { t } = useLanguage();

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
    Alert.alert(t('common.success'), t('profile.coordsSaved'));
  };

  const editInventory = can('edit_inventory');

  return (
    <TabScreenSafeArea style={s.container}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 28 + bottomSafePad }}
      >
        <View style={s.headerRow}>
          <Text style={{ fontSize: 22, color: Colors.green }}>👤</Text>
          <Text style={s.title}>{t('profile.title')}</Text>
        </View>

        <Card style={{ marginBottom: 16 }}>
          <Text style={s.sectionTitle}>{t('profile.coordsTitle')}</Text>
          <Text style={s.hint}>{t('profile.coordsHint')}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Input label={t('profile.firstName')} value={profile.prenom} onChangeText={v => setProfile(p => ({ ...p, prenom: v }))} />
            </View>
            <View style={{ flex: 1 }}>
              <Input label={t('profile.lastName')} value={profile.nom} onChangeText={v => setProfile(p => ({ ...p, nom: v }))} />
            </View>
          </View>
          <Input
            label={t('profile.phone')}
            value={profile.telephone}
            onChangeText={v => setProfile(p => ({ ...p, telephone: v }))}
            keyboardType="phone-pad"
          />
          <Input
            label={t('profile.email')}
            value={profile.email}
            onChangeText={v => setProfile(p => ({ ...p, email: v }))}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input label={t('profile.job')} value={profile.fonction} onChangeText={v => setProfile(p => ({ ...p, fonction: v }))} />
          <Input
            label={t('profile.establishment')}
            value={profile.etablissement}
            onChangeText={v => setProfile(p => ({ ...p, etablissement: v }))}
          />
          <TouchableOpacity style={s.addBtnFull} onPress={() => void saveProfile()}>
            <Text style={s.addBtnFullText}>{t('profile.saveCoords')}</Text>
          </TouchableOpacity>
        </Card>

        {editInventory && (
          <Card style={{ marginBottom: 16 }}>
            <Text style={s.sectionTitle}>{t('profile.theatreTitle')}</Text>
            <Text style={s.hint}>{t('profile.theatreHint')}</Text>
            <Input label={t('profile.theatreName')} value={theatreName} onChangeText={setTheatreName} placeholder={t('profile.theatreNamePh')} />
            <Input
              label={t('profile.address')}
              value={theatreAddress}
              onChangeText={setTheatreAddress}
              placeholder={t('profile.addressPh')}
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
                    Alert.alert(t('common.permission'), t('profile.galleryDenied'));
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
                    Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                <Text style={s.syncBtnText}>{t('profile.pickLogo')}</Text>
              </TouchableOpacity>
              {logoUri ? (
                <TouchableOpacity
                  style={s.syncBtnOutline}
                  onPress={async () => {
                    await clearTheatreLogo();
                    setLogoUri(null);
                  }}
                >
                  <Text style={s.syncBtnTextOutline}>{t('profile.removeLogo')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              style={s.addBtnFull}
              onPress={async () => {
                await saveTheatreIdentity(theatreName.trim(), theatreAddress.trim());
                Alert.alert(t('common.success'), t('profile.theatreSaved'));
              }}
            >
              <Text style={s.addBtnFullText}>{t('profile.saveTheatre')}</Text>
            </TouchableOpacity>
          </Card>
        )}

        <Card style={{ marginBottom: 16 }}>
          <Text style={s.sectionTitle}>{t('profile.sessionTitle')}</Text>
          {cloudUser ? (
            <Text style={{ color: Colors.textSecondary, marginBottom: 8, fontSize: 13 }}>
              {t('profile.onlineAccount', { email: cloudUser.email ?? '—' })}
            </Text>
          ) : null}
          <Text style={{ color: Colors.textSecondary, marginBottom: 12 }}>
            {user?.nom} · {user?.role}
          </Text>
          {cloudUser ? (
            <TouchableOpacity style={[s.syncBtnOutline, { marginBottom: 12 }]} onPress={logoutCloudOnly}>
              <Text style={s.syncBtnTextOutline}>{t('profile.signOutCloud')}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={s.addBtnFull} onPress={logout}>
            <Text style={s.addBtnFullText}>{t('profile.signOut')}</Text>
          </TouchableOpacity>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Text style={{ fontSize: 16 }}>🔗</Text>
            <Text style={s.sectionTitle}>{t('profile.supabaseDeviceTitle')}</Text>
          </View>
          <Text style={s.hint}>{t('profile.supabaseDeviceHint')}</Text>
          <Text style={{ color: Colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
            {t('profile.urlUsed')}{' '}
            <Text selectable style={{ color: Colors.textSecondary, fontSize: 12 }}>
              {isSupabaseConfigured() ? getEffectiveSupabaseUrlForDisplay() : t('profile.notConfigured')}
            </Text>
          </Text>
          {getSupabaseProjectUrlFromBuild() ? (
            <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 10 }}>
              {t('profile.buildValue', { url: getSupabaseProjectUrlFromBuild() })}
            </Text>
          ) : (
            <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 10 }}>
              {t('profile.noSupabaseBuild')}
            </Text>
          )}
          <Input
            label={t('profile.projectUrl')}
            value={sbUrlEdit}
            onChangeText={setSbUrlEdit}
            placeholder={t('login.supabase.placeholderUrl')}
            autoCapitalize="none"
          />
          <Input
            label={t('profile.anonKey')}
            value={sbKeyEdit}
            onChangeText={setSbKeyEdit}
            placeholder={hasSupabaseUserOverride() ? t('profile.anonPlaceholderNew') : t('profile.anonPlaceholder')}
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
                Alert.alert(t('common.success'), t('profile.supabaseSaved'));
              } catch (e: unknown) {
                Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
              } finally {
                setSbSaveBusy(false);
              }
            }}
          >
            {sbSaveBusy ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={s.syncBtnText}>{t('profile.saveUrlKey')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.syncBtnOutline, { marginBottom: 10 }]}
            disabled={sbSaveBusy}
            onPress={async () => {
              try {
                await exportShareSupabaseSchemaSql();
                Alert.alert(t('common.success'), t('profile.supabaseSchemaExported'));
              } catch (e: unknown) {
                Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
              }
            }}
          >
            <Text style={s.syncBtnTextOutline}>{t('profile.downloadSupabaseSchema')}</Text>
          </TouchableOpacity>
          {hasSupabaseUserOverride() ? (
            <TouchableOpacity
              style={s.syncBtnOutline}
              disabled={sbSaveBusy}
              onPress={() => {
                Alert.alert(
                  t('profile.resetBuildTitle'),
                  t('profile.resetBuildBody'),
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('profile.resetBuildConfirm'),
                      style: 'destructive',
                      onPress: async () => {
                        setSbSaveBusy(true);
                        try {
                          await clearStoredSupabaseOverrideAndReapply();
                          setSbUrlEdit(getEffectiveSupabaseUrlForDisplay());
                          setSbKeyEdit('');
                          void refreshProfile();
                          Alert.alert(t('common.success'), t('profile.resetDone'));
                        } catch (e: unknown) {
                          Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
                        } finally {
                          setSbSaveBusy(false);
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={s.syncBtnTextOutline}>{t('profile.useBuildOnly')}</Text>
            </TouchableOpacity>
          ) : null}
        </Card>

        {can('params_sync') ? <BackendModePicker /> : null}

        {isSupabaseConfigured() ? (
          <Card style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Text style={{ fontSize: 16 }}>✨</Text>
              <Text style={s.sectionTitle}>{t('profile.supabaseAcctTitle')}</Text>
            </View>
            <Text style={s.hint}>{t('profile.supabaseAcctHint')}</Text>
            {sbUser ? (
              <>
                <Text style={{ color: Colors.textSecondary, marginBottom: 8, fontSize: 13 }}>
                  {sbUser.email ?? '—'}
                </Text>
                <TouchableOpacity
                  style={[s.syncBtnOutline, { marginBottom: 12 }]}
                  onPress={() => void signOutSupabase()}
                >
                  <Text style={s.syncBtnTextOutline}>{t('profile.supabaseSignOut')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <SupabaseAccountForm compact />
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
