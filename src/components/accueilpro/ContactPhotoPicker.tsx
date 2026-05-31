import React, { useEffect, useState } from 'react';
import { Alert, Image, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AccueilProColors, AccueilProFormCard, apStyles } from './AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import {
  contactPhotoExists,
  persistContactPhotoCopy,
  removeContactPhotoLocal,
} from '../../lib/accueilProContactPhotoStorage';

type Props = {
  contactId: string;
  photoUri: string | null;
  onChange: (uri: string | null) => void;
};

export function ContactPhotoPicker(props: Props) {
  const { t } = useLanguage();
  const [previewUri, setPreviewUri] = useState<string | null>(props.photoUri);

  useEffect(() => {
    void (async () => {
      if (props.photoUri && (await contactPhotoExists(props.photoUri))) {
        setPreviewUri(props.photoUri);
      } else {
        setPreviewUri(null);
      }
    })();
  }, [props.photoUri]);

  const pick = async (mode: 'gallery' | 'camera') => {
    const perm =
      mode === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('common.permission'), t('accueilpro.contacts.photoPermission'));
      return;
    }
    const res =
      mode === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: true, aspect: [1, 1] })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
            allowsEditing: true,
            aspect: [1, 1],
          });
    if (res.canceled || !res.assets[0]?.uri) return;
    try {
      if (props.photoUri) await removeContactPhotoLocal(props.photoUri);
      const dest = await persistContactPhotoCopy(props.contactId, res.assets[0].uri);
      setPreviewUri(dest);
      props.onChange(dest);
    } catch (e: unknown) {
      Alert.alert(t('accueilpro.orgs.errTitle'), e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async () => {
    await removeContactPhotoLocal(props.photoUri);
    setPreviewUri(null);
    props.onChange(null);
  };

  return (
    <AccueilProFormCard style={{ marginBottom: 14 }}>
      <Text style={apStyles.sectionTitle}>{t('accueilpro.contacts.fieldPhoto')}</Text>
      <View style={{ alignItems: 'center', marginVertical: 12 }}>
        {previewUri ?
          <Image
            source={{ uri: previewUri }}
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              borderWidth: 2,
              borderColor: AccueilProColors.borderSubtle,
              backgroundColor: AccueilProColors.surfaceMuted,
            }}
          />
        : <View
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: AccueilProColors.surfaceMuted,
              borderWidth: 2,
              borderColor: AccueilProColors.borderSubtle,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 40 }}>👤</Text>
          </View>
        }
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => void pick('gallery')}
          style={{
            flexGrow: 1,
            minWidth: '45%',
            paddingVertical: 12,
            paddingHorizontal: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: AccueilProColors.borderSubtle,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontWeight: '700', color: AccueilProColors.primary }}>
            {previewUri ? t('accueilpro.contacts.changePhoto') : t('accueilpro.contacts.addPhotoGallery')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => void pick('camera')}
          style={{
            flexGrow: 1,
            minWidth: '45%',
            paddingVertical: 12,
            paddingHorizontal: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: AccueilProColors.borderSubtle,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontWeight: '700', color: AccueilProColors.navy }}>{t('accueilpro.contacts.addPhotoCamera')}</Text>
        </TouchableOpacity>
        {previewUri ?
          <TouchableOpacity accessibilityRole="button" onPress={() => void remove()} style={{ width: '100%', paddingVertical: 10 }}>
            <Text style={{ textAlign: 'center', fontWeight: '700', color: AccueilProColors.statusAnnule }}>
              {t('accueilpro.contacts.removePhoto')}
            </Text>
          </TouchableOpacity>
        : null}
      </View>
    </AccueilProFormCard>
  );
}
