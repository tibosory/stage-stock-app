import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Card } from '../UI';
import { apStyles } from './AccueilProUI';

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
    <Card>
      <Text style={apStyles.sectionTitle}>Photos</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => void add()} style={{ marginBottom: 8 }}>
        <Text style={{ color: '#4068E0', fontWeight: '800' }}>Ajouter depuis la galerie</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={clear}>
        <Text style={{ color: '#B54A45', fontWeight: '700' }}>Retirer toutes ({props.photos.length})</Text>
      </TouchableOpacity>
    </Card>
  );
}
