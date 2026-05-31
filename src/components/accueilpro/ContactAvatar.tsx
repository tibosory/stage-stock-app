import React, { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { AccueilProColors } from './AccueilProUI';
import { contactPhotoExists } from '../../lib/accueilProContactPhotoStorage';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
  return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}

export function ContactAvatar(props: { displayName: string; photoUri?: string | null; size?: number }) {
  const size = props.size ?? 52;
  const [uri, setUri] = useState<string | null>(null);
  const initials = useMemo(() => initialsFromName(props.displayName), [props.displayName]);

  useEffect(() => {
    void (async () => {
      if (props.photoUri && (await contactPhotoExists(props.photoUri))) {
        setUri(props.photoUri);
      } else {
        setUri(null);
      }
    })();
  }, [props.photoUri]);

  const shell = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 2,
    borderColor: AccueilProColors.borderSubtle,
    backgroundColor: AccueilProColors.surfaceMuted,
    overflow: 'hidden' as const,
  };

  if (uri) {
    return <Image source={{ uri }} style={shell} />;
  }

  return (
    <View style={[shell, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ fontWeight: '800', color: AccueilProColors.navy, fontSize: size * 0.32 }}>{initials}</Text>
    </View>
  );
}
