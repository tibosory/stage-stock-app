import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { ApInspectionControlPoint, ApInspectionPointKind } from '../../types/accueilPro';
import { AccueilProLinkButton, AccueilProColors, apStyles } from './AccueilProUI';
import { defaultControlPointsFromStandard, makeControlPointId } from '../../lib/inspectionChecklist';

type Props = {
  points: ApInspectionControlPoint[];
  onChange: (points: ApInspectionControlPoint[]) => void;
  labels: {
    sectionControl: string;
    sectionVigilance: string;
    fieldLabel: string;
    fieldHint: string;
    addControl: string;
    addVigilance: string;
    useStandard: string;
    empty: string;
    remove: string;
  };
};

function PointEditor({
  point,
  onUpdate,
  onRemove,
  fieldLabel,
  fieldHint,
  removeLabel,
}: {
  point: ApInspectionControlPoint;
  onUpdate: (p: ApInspectionControlPoint) => void;
  onRemove: () => void;
  fieldLabel: string;
  fieldHint: string;
  removeLabel: string;
}) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: AccueilProColors.borderSubtle,
        borderRadius: 10,
        padding: 10,
        marginBottom: 8,
        backgroundColor: '#fff',
      }}
    >
      <TextInput
        value={point.label}
        onChangeText={label => onUpdate({ ...point, label })}
        placeholder={fieldLabel}
        style={{
          borderWidth: 1,
          borderColor: AccueilProColors.borderSubtle,
          borderRadius: 8,
          padding: 10,
          marginBottom: 6,
        }}
      />
      <TextInput
        value={point.description ?? ''}
        onChangeText={description => onUpdate({ ...point, description: description || null })}
        placeholder={fieldHint}
        multiline
        style={{
          borderWidth: 1,
          borderColor: AccueilProColors.borderSubtle,
          borderRadius: 8,
          padding: 10,
          minHeight: 44,
          textAlignVertical: 'top',
        }}
      />
      <TouchableOpacity onPress={onRemove} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
        <Text style={{ color: '#c0392b', fontSize: 13, fontWeight: '600' }}>{removeLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Section({
  kind,
  title,
  addLabel,
  points,
  allPoints,
  onChange,
  fieldLabel,
  fieldHint,
  empty,
  removeLabel,
}: {
  kind: ApInspectionPointKind;
  title: string;
  addLabel: string;
  points: ApInspectionControlPoint[];
  allPoints: ApInspectionControlPoint[];
  onChange: (next: ApInspectionControlPoint[]) => void;
  fieldLabel: string;
  fieldHint: string;
  empty: string;
  removeLabel: string;
}) {
  const addPoint = () => {
    const label = kind === 'vigilance' ? 'Nouveau point de vigilance' : 'Nouveau point de contrôle';
    const id = makeControlPointId(label, allPoints);
    onChange([...allPoints, { id, label, description: null, kind }]);
  };

  const updateAt = (id: string, updated: ApInspectionControlPoint) => {
    onChange(allPoints.map(p => (p.id === id ? updated : p)));
  };

  const removeAt = (id: string) => {
    onChange(allPoints.filter(p => p.id !== id));
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={apStyles.sectionTitle}>{title}</Text>
      {points.length === 0 ?
        <Text style={[apStyles.hint, { marginBottom: 8 }]}>{empty}</Text>
      : points.map(p => (
          <PointEditor
            key={p.id}
            point={p}
            onUpdate={u => updateAt(p.id, u)}
            onRemove={() => removeAt(p.id)}
            fieldLabel={fieldLabel}
            fieldHint={fieldHint}
            removeLabel={removeLabel}
          />
        ))}
      <AccueilProLinkButton label={addLabel} onPress={addPoint} />
    </View>
  );
}

export function SpaceControlPointsEditor({ points, onChange, labels }: Props) {
  const controls = points.filter(p => p.kind !== 'vigilance');
  const vigilance = points.filter(p => p.kind === 'vigilance');

  return (
    <View>
      <AccueilProLinkButton
        label={labels.useStandard}
        onPress={() => onChange(defaultControlPointsFromStandard())}
      />
      <Section
        kind="control"
        title={labels.sectionControl}
        addLabel={labels.addControl}
        points={controls}
        allPoints={points}
        onChange={onChange}
        fieldLabel={labels.fieldLabel}
        fieldHint={labels.fieldHint}
        empty={labels.empty}
        removeLabel={labels.remove}
      />
      <Section
        kind="vigilance"
        title={labels.sectionVigilance}
        addLabel={labels.addVigilance}
        points={vigilance}
        allPoints={points}
        onChange={onChange}
        fieldLabel={labels.fieldLabel}
        fieldHint={labels.fieldHint}
        empty={labels.empty}
        removeLabel={labels.remove}
      />
    </View>
  );
}
