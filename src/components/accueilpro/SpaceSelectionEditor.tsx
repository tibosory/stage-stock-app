import React, { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { ApSpacesMode } from '../../types/accueilPro';
import { listApSpaces } from '../../db/accueilProDb';
import { AccueilProChip, AccueilProColors, AccueilProFormCard, apStyles } from './AccueilProUI';

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
    <AccueilProFormCard>
      <Text style={apStyles.sectionTitle}>Espaces</Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <AccueilProChip
          label="Tout le lieu"
          selected={mode === 'all'}
          onPress={() => {
            onModeChange('all');
            onSelectionChange([]);
          }}
        />
        <AccueilProChip
          label="Salles précises"
          selected={mode === 'specific'}
          onPress={() => onModeChange('specific')}
        />
      </View>
      {!venueId ?
        <Text style={apStyles.hint}>Choisissez un lieu pour lister les salles.</Text>
      : mode === 'specific' ?
        <View style={{ gap: 10 }}>
          {spaces.map(sp => {
            const isSelected = selected.has(sp.id);
            return (
              <TouchableOpacity
                key={sp.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? AccueilProColors.chipSelectedBorder : AccueilProColors.borderSubtle,
                  backgroundColor: isSelected ? AccueilProColors.chipSelectedBg : AccueilProColors.card,
                }}
                onPress={() => {
                  const next = new Set(selectedIds);
                  if (next.has(sp.id)) next.delete(sp.id);
                  else next.add(sp.id);
                  onSelectionChange([...next]);
                }}
              >
                <Text
                  style={{
                    fontWeight: '800',
                    color: isSelected ? AccueilProColors.chipSelectedText : AccueilProColors.textPrimary,
                  }}
                >
                  {sp.name}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    marginTop: 4,
                    color: isSelected ? 'rgba(255,255,255,0.85)' : AccueilProColors.textMuted,
                  }}
                >
                  {isSelected ? 'Sélectionnée' : 'Taper pour sélectionner'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      : null}
    </AccueilProFormCard>
  );
}
