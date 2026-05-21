import React, { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { ApSpacesMode } from '../../types/accueilPro';
import { listApSpaces } from '../../db/accueilProDb';
import { Card } from '../UI';
import { apStyles } from './AccueilProUI';

export type SpaceSelectionEditorProps = {
  venueId: string;
  mode: ApSpacesMode;
  selectedIds: string[];
  onModeChange: (m: ApSpacesMode) => void;
  onSelectionChange: (ids: string[]) => void;
};

export function SpaceSelectionEditor(props: SpaceSelectionEditorProps) {
  const { venueId, mode, selectedIds, onModeChange, onSelectionChange } = props;
  const [spaces, setSpaces] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!venueId) {
        setSpaces([]);
        return;
      }
      const rows = await listApSpaces(venueId);
      if (!cancelled) setSpaces(rows.map(r => ({ id: r.id, name: r.name })));
    })();
    return () => {
      cancelled = true;
    };
  }, [venueId]);

  const selected = useMemo(() => new Set(selectedIds ?? []), [selectedIds]);

  return (
    <Card>
      <Text style={apStyles.sectionTitle}>Espaces</Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {(['all', 'specific'] as const).map(m => (
          <TouchableOpacity
            key={m}
            accessibilityRole="button"
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: mode === m ? 'rgba(200,151,58,0.35)' : '#fff',
              borderWidth: 1,
              borderColor: 'rgba(26,39,68,0.15)',
            }}
            onPress={() => {
              onModeChange(m);
              if (m === 'all') onSelectionChange([]);
            }}
          >
            <Text>{m === 'all' ? 'Tout le lieu' : 'Salles précises'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {!venueId ?
        <Text style={apStyles.hint}>Choisissez un lieu pour lister les salles.</Text>
      : mode === 'specific' ?
        <View style={{ gap: 10 }}>
          {spaces.map(sp => (
            <TouchableOpacity
              key={sp.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected.has(sp.id) }}
              style={{
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: selected.has(sp.id) ? '#C8973A' : 'rgba(26,39,68,0.12)',
              }}
              onPress={() => {
                const next = new Set(selectedIds);
                if (next.has(sp.id)) next.delete(sp.id);
                else next.add(sp.id);
                onSelectionChange([...next]);
              }}
            >
              <Text style={{ fontWeight: '700', color: '#1A2744' }}>{sp.name}</Text>
              <Text style={{ fontSize: 12, color: 'rgba(26,39,68,0.55)' }}>
                {selected.has(sp.id) ? '— sélectionnée' : '— taper pour sélectionner'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      : null}
    </Card>
  );
}
