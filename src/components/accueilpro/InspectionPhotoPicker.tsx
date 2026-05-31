import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AccueilProColors, AccueilProFormCard, apStyles } from './AccueilProUI';

type Props = { photos: string[]; onChange: (next: string[]) => void };

export function InspectionPhotoPicker(props: Props) {
  const add = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.82 });
    if (!res.canceled && res.assets[0]?.uri) {
      props.onChange([...props.photos, res.assets[0].uri]);
    }
  };

  const clear = () => props.onChange([]);

  return (
    <AccueilProFormCard>
      <Text style={apStyles.sectionTitle}>Photos</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => void add()} style={{ marginBottom: 8 }}>
        <Text style={{ color: AccueilProColors.gold, fontWeight: '800' }}>Ajouter depuis la galerie</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={clear}>
        <Text style={{ color: AccueilProColors.statusAnnule, fontWeight: '700' }}>
          Retirer toutes ({props.photos.length})
        </Text>
      </TouchableOpacity>
    </AccueilProFormCard>
  );
}
