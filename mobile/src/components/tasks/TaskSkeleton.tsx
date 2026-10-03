import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme';
import { BrutalBox } from '../ui/Brutal';

/** Pulsing placeholder cards shown during the first load. */
export function TaskSkeleton({ count = 3 }: { count?: number }) {
  const t = useTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const bar = (width: `${number}%`, height = 12) => (
    <View
      style={[
        styles.bar,
        { width, height, backgroundColor: t.colors.lineSoft },
      ]}
    />
  );

  return (
    <Animated.View
      style={[styles.list, { opacity: pulse }]}
      accessibilityLabel="Loading tasks"
    >
      {Array.from({ length: count }, (_, i) => (
        <BrutalBox key={i} contentStyle={styles.card}>
          <View style={[styles.check, { borderColor: t.colors.lineSoft }]} />
          <View style={styles.lines}>
            {bar('70%', 16)}
            {bar('45%')}
            {bar('30%')}
          </View>
        </BrutalBox>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 14 },
  card: { flexDirection: 'row', gap: 12, padding: 14 },
  check: { width: 30, height: 30, borderRadius: 9, borderWidth: 2 },
  lines: { flex: 1, gap: 9, paddingTop: 4 },
  bar: { borderRadius: 6 },
});
