import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { ApSpace, ApVenue } from '../../types/accueilPro';
import {
  AccueilProChip,
  AccueilProColors,
  AccueilProFormCard,
  AccueilProLinkButton,
  AccueilProPrimaryButton,
  apStyles,
} from './AccueilProUI';

export type VenueSpaceBubblePickerProps = {
  venues: ApVenue[];
  spaces: ApSpace[];
  selectedVenueId: string | null;
  selectedSpaceId: string | null;
  onSelectVenue: (id: string) => void;
  onSelectSpace: (id: string) => void;
  onAddVenue: () => void;
  onAddSpace: (venueId: string) => void;
  onEditVenue: (venueId: string) => void;
  onEditSpace: (venueId: string, spaceId: string) => void;
  onOpenVenueDetail?: (venueId: string) => void;
  /** Sur la fiche d’un lieu : masquer la rangée de bulles lieux. */
  singleVenueMode?: boolean;
  labels: {
    venuesSection: string;
    spacesSection: string;
    addVenue: string;
    addSpace: string;
    noVenues: string;
    noSpaces: string;
    selectVenueHint: string;
    spaceType: string;
    spaceCapacity: string;
    spaceDescription: string;
    controlPoints: string;
    editSpace: string;
    editVenue: string;
    venueDetail: string;
  };
};

export function VenueSpaceBubblePicker(props: VenueSpaceBubblePickerProps) {
  const {
    venues,
    spaces,
    selectedVenueId,
    selectedSpaceId,
    onSelectVenue,
    onSelectSpace,
    onAddVenue,
    onAddSpace,
    onEditVenue,
    onEditSpace,
    onOpenVenueDetail,
    labels,
    singleVenueMode = false,
  } = props;

  const selectedVenue = venues.find(v => v.id === selectedVenueId) ?? null;
  const venueSpaces = selectedVenueId ? spaces.filter(s => s.venue_id === selectedVenueId) : [];
  const selectedSpace = venueSpaces.find(s => s.id === selectedSpaceId) ?? null;
  const controlCount = selectedSpace?.control_points?.length ?? 0;

  return (
    <View style={{ gap: 16 }}>
      {!singleVenueMode ?
        <View>
          <Text style={apStyles.sectionTitle}>{labels.venuesSection}</Text>
          {venues.length === 0 ?
            <Text style={apStyles.hint}>{labels.noVenues}</Text>
          : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
              {venues.map(v => (
                <AccueilProChip
                  key={v.id}
                  label={v.name}
                  selected={v.id === selectedVenueId}
                  onPress={() => onSelectVenue(v.id)}
                />
              ))}
              <AccueilProChip label={`+ ${labels.addVenue}`} onPress={onAddVenue} />
            </ScrollView>
          )}
        </View>
      : null}

      {selectedVenue && !singleVenueMode ?
        <AccueilProFormCard>
          <Text style={[apStyles.rowTitle, { marginBottom: 4 }]}>{selectedVenue.name}</Text>
          <Text style={apStyles.rowMeta}>
            {[selectedVenue.address, selectedVenue.cp, selectedVenue.city].filter(Boolean).join(', ') || '—'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <AccueilProLinkButton label={labels.editVenue} onPress={() => onEditVenue(selectedVenue.id)} />
            {onOpenVenueDetail ?
              <AccueilProLinkButton label={labels.venueDetail} onPress={() => onOpenVenueDetail(selectedVenue.id)} />
            : null}
          </View>
        </AccueilProFormCard>
      : venues.length > 0 ?
        <Text style={apStyles.hint}>{labels.selectVenueHint}</Text>
      : null}

      {selectedVenueId ?
        <View>
          <Text style={apStyles.sectionTitle}>
            {labels.spacesSection.replace('{n}', String(venueSpaces.length))}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
            {venueSpaces.map(sp => (
              <AccueilProChip
                key={sp.id}
                label={sp.capacity ? `${sp.name} (${sp.capacity})` : sp.name}
                selected={sp.id === selectedSpaceId}
                onPress={() => onSelectSpace(sp.id)}
              />
            ))}
            <AccueilProChip label={`+ ${labels.addSpace}`} onPress={() => onAddSpace(selectedVenueId)} />
          </ScrollView>
          {venueSpaces.length === 0 ?
            <Text style={[apStyles.hint, { marginTop: 8 }]}>{labels.noSpaces}</Text>
          : null}
        </View>
      : null}

      {selectedSpace && selectedVenueId ?
        <AccueilProFormCard>
          <Text style={apStyles.sectionTitle}>{selectedSpace.name}</Text>
          <View style={{ gap: 8, marginBottom: 14 }}>
            <Text style={apStyles.rowMeta}>
              {labels.spaceType} : <Text style={{ fontWeight: '700', color: AccueilProColors.textPrimary }}>{selectedSpace.type ?? '—'}</Text>
            </Text>
            <Text style={apStyles.rowMeta}>
              {labels.spaceCapacity} :{' '}
              <Text style={{ fontWeight: '700', color: AccueilProColors.textPrimary }}>{selectedSpace.capacity ?? 0}</Text>
            </Text>
            {selectedSpace.description?.trim() ?
              <Text style={{ lineHeight: 20, color: AccueilProColors.textPrimary }}>
                {labels.spaceDescription} : {selectedSpace.description.trim()}
              </Text>
            : null}
            <Text style={apStyles.rowMeta}>
              {labels.controlPoints.replace('{n}', String(controlCount))}
            </Text>
          </View>
          <AccueilProPrimaryButton
            label={labels.editSpace}
            onPress={() => onEditSpace(selectedVenueId, selectedSpace.id)}
          />
        </AccueilProFormCard>
      : null}
    </View>
  );
}
