import React, { memo } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';
import { Colors } from '../theme/colors';
import { SelectPicker } from './UI';
import type { FieldDefinition } from '../types';

type Props = {
  fields: FieldDefinition[];
  values: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
  readOnly?: boolean;
};

export const DynamicProfileForm = memo(function DynamicProfileForm({
  fields,
  values,
  onChange,
  readOnly = false,
}: Props) {
  return (
    <View style={{ gap: 10 }}>
      {fields
        .filter(f => !f.isDeleted)
        .map(field => {
          const v = values[field.id];
          if (field.type === 'select') {
            return (
              <SelectPicker
                key={field.id}
                label={`${field.label}${field.required ? ' *' : ''}`}
                value={typeof v === 'string' ? v : ''}
                options={(field.options ?? []).map(opt => ({ label: opt, value: opt }))}
                onChange={next => onChange(field.id, next)}
              />
            );
          }
          if (field.type === 'boolean') {
            return (
              <View
                key={field.id}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}
              >
                <Text style={{ color: Colors.textSecondary }}>{field.label}</Text>
                <Switch
                  value={!!v}
                  onValueChange={next => onChange(field.id, next)}
                  disabled={readOnly}
                  trackColor={{ false: Colors.border, true: Colors.greenMuted }}
                  thumbColor={!!v ? Colors.green : Colors.textMuted}
                />
              </View>
            );
          }
          return (
            <View key={field.id}>
              <Text style={{ color: Colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
                {field.label}
                {field.required ? ' *' : ''}
                {field.unit ? ` (${field.unit})` : ''}
              </Text>
              <TextInput
                editable={!readOnly}
                value={v == null ? '' : String(v)}
                onChangeText={next => onChange(field.id, field.type === 'number' ? next.replace(',', '.') : next)}
                placeholder={
                  field.defaultValue != null
                    ? `Défaut: ${String(field.defaultValue)}`
                    : field.type === 'date'
                      ? 'YYYY-MM-DD'
                      : ''
                }
                placeholderTextColor={Colors.textMuted}
                keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
                style={{
                  backgroundColor: Colors.bgInput,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  color: Colors.white,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              />
            </View>
          );
        })}
    </View>
  );
});
