import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { getGelSwatch } from '../lib/gelFilters';

type Props = {
  gelBrand?: string | null;
  gelCode?: string | null;
  size?: number;
  /** Occupe toute la largeur du conteneur (fiche matériel) */
  fullWidth?: boolean;
  showCaption?: boolean;
};

export function GelMaterialSwatch({
  gelBrand,
  gelCode,
  size = 120,
  fullWidth = false,
  showCaption = true,
}: Props) {
  const sw = getGelSwatch(gelBrand ?? undefined, gelCode ?? undefined);
  if (!sw) return null;
  const prefix = gelBrand === 'lee' ? 'Lee' : gelBrand === 'rosco' ? 'Rosco' : '';
  const h = size * 0.72;
  return (
    <View style={[styles.wrap, fullWidth ? { width: '100%', alignSelf: 'stretch' } : { width: size, maxWidth: '100%' }]}>
      <View style={[styles.swatch, { height: h, backgroundColor: sw.hex }]} />
      {showCaption ? (
        <Text style={styles.caption} numberOfLines={2}>
          {prefix ? `${prefix} ${gelCode?.trim() ?? ''}` : gelCode ?? ''}
          {'\n'}
          <Text style={styles.sub}>{sw.name}</Text>
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  swatch: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  caption: { color: Colors.textSecondary, fontSize: 12, marginTop: 8, lineHeight: 16 },
  sub: { color: Colors.textMuted, fontSize: 11 },
});
