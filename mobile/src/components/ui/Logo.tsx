import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { palette, useTheme } from '../../theme';
import { Accent, AppText } from './AppText';

/** The DoAll mark: a ticked box with a hard shadow and a lime "notification" dot. */
export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="30 28 50 50">
      <Path
        d="M46,37 h20 a9,9 0 0 1 9,9 v20 a9,9 0 0 1 -9,9 h-20 a9,9 0 0 1 -9,-9 v-20 a9,9 0 0 1 9,-9 z"
        fill={palette.ink}
      />
      <Path
        d="M42,33 h20 a9,9 0 0 1 9,9 v20 a9,9 0 0 1 -9,9 h-20 a9,9 0 0 1 -9,-9 v-20 a9,9 0 0 1 9,-9 z"
        fill={palette.card}
        stroke={palette.ink}
        strokeWidth={3.5}
      />
      <Path
        d="M42.5,52.5 L49.5,59 L62,45"
        stroke={palette.ink}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle
        cx={70.5}
        cy={33.5}
        r={5.5}
        fill={palette.lime}
        stroke={palette.ink}
        strokeWidth={3}
      />
    </Svg>
  );
}

/** Mark + "DoAll" wordmark, with the brand's italic-serif "All". */
export function Logo({ size = 40 }: { size?: number }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <LogoMark size={size} />
      <AppText
        style={{
          fontSize: size * 0.75,
          lineHeight: size,
          color: t.colors.text,
        }}
        variant="title"
      >
        Do<Accent size={size * 0.9}>All</Accent>
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
