import React from 'react';
import { StyleSheet, View } from 'react-native';
import { scoreBreakdown } from '../../features/tasks/ordering';
import { Task } from '../../features/tasks/types';
import { palette, useTheme } from '../../theme';
import { AppText } from '../ui/AppText';

/** Theoretical maximum score (high priority, very overdue, started) — scales the bar. */
const MAX = 0.4 * 1 + 0.45 * 1.5 + 0.15 * 1;

const SEGMENTS = [
  { key: 'priority', label: 'Priority', color: palette.signal },
  { key: 'deadline', label: 'Deadline', color: palette.sky },
  { key: 'schedule', label: 'Schedule', color: palette.lilac },
] as const;

/**
 * Visual explanation of the smart sort for one task: how much priority,
 * deadline pressure and schedule each contribute to its score.
 */
export function ScoreBreakdown({ task, now }: { task: Task; now: number }) {
  const t = useTheme();
  const score = scoreBreakdown(task, now);

  return (
    <View>
      <View
        style={[
          styles.bar,
          { borderColor: t.colors.line, backgroundColor: t.colors.surfaceAlt },
        ]}
      >
        {SEGMENTS.map(segment => (
          <View
            key={segment.key}
            style={{
              width: `${(score[segment.key] / MAX) * 100}%`,
              backgroundColor: segment.color,
            }}
          />
        ))}
      </View>
      <View style={styles.legend}>
        {SEGMENTS.map(segment => (
          <View key={segment.key} style={styles.legendItem}>
            <View
              style={[
                styles.swatch,
                { backgroundColor: segment.color, borderColor: t.colors.line },
              ]}
            />
            <AppText variant="mono" color="textMuted">
              {segment.label} {score[segment.key].toFixed(2)}
            </AppText>
          </View>
        ))}
      </View>
      <AppText variant="mono" color="textFaint" style={styles.total}>
        Smart score {score.total.toFixed(2)} / {MAX.toFixed(2)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 22,
    borderWidth: 2,
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3, borderWidth: 1.5 },
  total: { marginTop: 6 },
});
