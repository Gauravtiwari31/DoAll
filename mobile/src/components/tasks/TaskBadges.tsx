import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CATEGORY_META, PRIORITY_META } from '../../features/tasks/taskMeta';
import { Category, Priority } from '../../features/tasks/types';
import { palette, useTheme } from '../../theme';
import { AppText } from '../ui/AppText';

/** Tilted "sticker" showing priority — reads at a glance in a long list. */
export function PrioritySticker({
  priority,
  tilt = true,
}: {
  priority: Priority;
  tilt?: boolean;
}) {
  const t = useTheme();
  const meta = PRIORITY_META[priority];
  return (
    <View
      style={[
        styles.sticker,
        {
          backgroundColor: meta.color,
          borderColor: t.colors.line,
          transform: [
            {
              rotate: tilt ? (priority === 'high' ? '4deg' : '-3deg') : '0deg',
            },
          ],
        },
      ]}
    >
      <AppText variant="label" color={palette.ink} uppercase>
        {meta.short}
      </AppText>
    </View>
  );
}

export function CategoryPill({ category }: { category: Category }) {
  const t = useTheme();
  const meta = CATEGORY_META[category];
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: meta.color, borderColor: t.colors.line },
      ]}
    >
      <AppText
        variant="label"
        color={palette.ink}
        uppercase
        style={styles.pillText}
      >
        {meta.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  sticker: {
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  pillText: { fontSize: 10 },
});
