import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import { DatePreset, formatDateTime } from '../../utils/dates';
import { AppText } from '../ui/AppText';
import { BrutalPressable } from '../ui/Brutal';
import { Chip } from '../ui/Chip';
import { Icon, IconName } from '../ui/Icon';

interface DateTimeFieldProps {
  value: Date | null;
  onChange: (value: Date | null) => void;
  presets: DatePreset[];
  icon: IconName;
  placeholder: string;
  /** Show a "None" chip that clears the value (used for the optional deadline). */
  clearable?: boolean;
  minimumDate?: Date;
  error?: string;
}

/**
 * Date-time input: one-tap presets for the common cases, plus the native
 * Android date → time dialogs for anything else.
 */
export function DateTimeField({
  value,
  onChange,
  presets,
  icon,
  placeholder,
  clearable,
  minimumDate,
  error,
}: DateTimeFieldProps) {
  const t = useTheme();

  const openPicker = () => {
    const initial = value ?? new Date();
    DateTimePickerAndroid.open({
      value: initial,
      mode: 'date',
      minimumDate,
      onValueChange: (_event, date) => {
        // Chain the time dialog once a day has been picked.
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          is24Hour: false,
          onValueChange: (_e, withTime) => onChange(withTime),
        });
      },
    });
  };

  const now = new Date();

  return (
    <View>
      <BrutalPressable
        onPress={openPicker}
        accessibilityLabel={
          value ? `Change ${formatDateTime(value)}` : placeholder
        }
        offset={3}
        borderColor={error ? t.colors.danger : undefined}
        contentStyle={styles.field}
      >
        <Icon
          name={icon}
          size={19}
          color={value ? t.colors.text : t.colors.textMuted}
        />
        <AppText
          variant="bodyStrong"
          color={value ? 'text' : 'textFaint'}
          style={styles.value}
        >
          {value ? formatDateTime(value, now) : placeholder}
        </AppText>
        <AppText variant="label" color="textMuted" uppercase>
          Pick
        </AppText>
      </BrutalPressable>
      {error ? (
        <AppText variant="mono" color="danger" style={styles.error}>
          {error}
        </AppText>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presets}
        keyboardShouldPersistTaps="handled"
      >
        {clearable ? (
          <Chip
            label="None"
            selected={value === null}
            onPress={() => onChange(null)}
          />
        ) : null}
        {presets.map(preset => {
          const presetValue = preset.value(now);
          const selected =
            value !== null &&
            Math.abs(presetValue.getTime() - value.getTime()) < 60_000;
          return (
            <Chip
              key={preset.key}
              label={preset.label}
              selected={selected}
              onPress={() => onChange(preset.value(new Date()))}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 54,
    paddingHorizontal: 14,
  },
  value: { flex: 1 },
  error: { marginTop: 6 },
  presets: { gap: 8, paddingTop: 12, paddingRight: 8 },
});
