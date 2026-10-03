import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { palette, useTheme } from '../../theme';
import { Accent, AppText } from '../ui/AppText';
import { Button } from '../ui/Button';

/** Two sticky notes and a pencil — drawn in code so it follows the theme. */
function StickyNotes() {
  const t = useTheme();
  const ink = t.colors.line;
  return (
    <Svg width={150} height={120} viewBox="0 0 150 120">
      <G rotation={-8} origin="60, 60">
        <Rect x={22} y={22} width={72} height={72} rx={8} fill={ink} />
        <Rect
          x={18}
          y={18}
          width={72}
          height={72}
          rx={8}
          fill={palette.butter}
          stroke={ink}
          strokeWidth={2.5}
        />
        <Path
          d="M30 40h44M30 52h36M30 64h40"
          stroke={palette.ink}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </G>
      <G rotation={7} origin="100, 60">
        <Rect x={72} y={34} width={62} height={62} rx={8} fill={ink} />
        <Rect
          x={68}
          y={30}
          width={62}
          height={62}
          rx={8}
          fill={palette.sky}
          stroke={ink}
          strokeWidth={2.5}
        />
        <Path
          d="M84 62l9 9 18-20"
          stroke={palette.ink}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </G>
      <Circle
        cx={128}
        cy={22}
        r={8}
        fill={palette.lime}
        stroke={ink}
        strokeWidth={2.5}
      />
    </Svg>
  );
}

interface EmptyStateProps {
  title: string;
  accent?: string;
  message: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({
  title,
  accent,
  message,
  action,
}: EmptyStateProps) {
  return (
    <View style={styles.root}>
      <StickyNotes />
      <AppText variant="heading" align="center" style={styles.title}>
        {title} {accent ? <Accent size={26}>{accent}</Accent> : null}
      </AppText>
      <AppText color="textMuted" align="center" style={styles.message}>
        {message}
      </AppText>
      {action ? (
        <Button
          title={action.label}
          onPress={action.onPress}
          variant="outline"
          size="md"
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  title: { marginTop: 18 },
  message: { marginTop: 6, maxWidth: 280 },
  action: { marginTop: 18 },
});
