import React, { PropsWithChildren, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { palette, useTheme } from '../../theme';
import { AppText } from '../ui/AppText';
import { Icon, IconName } from '../ui/Icon';

interface SwipeAction {
  label: string;
  icon: IconName;
  color: string;
  onTrigger: () => void;
}

interface SwipeableRowProps {
  /** Revealed when swiping right (→). */
  right: SwipeAction;
  /** Revealed when swiping left (←). Animates the row out before triggering. */
  left: SwipeAction;
}

const THRESHOLD = 96;

/**
 * Horizontal swipe actions built on PanResponder (no extra native module).
 * The responder only claims clearly-horizontal drags so vertical scrolling in
 * the list keeps working.
 */
export function SwipeableRow({
  right,
  left,
  children,
}: PropsWithChildren<SwipeableRowProps>) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;

  // Latest callbacks without re-creating the responder every render.
  const actions = useRef({ right, left });
  actions.current = { right, left };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_e, g) => x.setValue(g.dx),
        onPanResponderRelease: (_e, g) => {
          if (g.dx > THRESHOLD) {
            actions.current.right.onTrigger();
            Animated.spring(x, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 10,
            }).start();
          } else if (g.dx < -THRESHOLD) {
            Animated.timing(x, {
              toValue: -width,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              actions.current.left.onTrigger();
              // If the row stays mounted (e.g. the delete failed), bring it back.
              setTimeout(() => x.setValue(0), 400);
            });
          } else {
            Animated.spring(x, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 6,
            }).start();
          }
        },
        onPanResponderTerminate: () =>
          Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [x, width],
  );

  const rightOpacity = x.interpolate({
    inputRange: [0, 40],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const leftOpacity = x.interpolate({
    inputRange: [-40, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  // Icons grow as the drag approaches the trigger threshold.
  const rightScale = x.interpolate({
    inputRange: [0, THRESHOLD],
    outputRange: [0.6, 1.15],
    extrapolate: 'clamp',
  });
  const leftScale = x.interpolate({
    inputRange: [-THRESHOLD, 0],
    outputRange: [1.15, 0.6],
    extrapolate: 'clamp',
  });

  const panel = (action: SwipeAction, side: 'start' | 'end') => (
    <Animated.View
      style={[
        styles.panel,
        side === 'start' ? styles.panelStart : styles.panelEnd,
        {
          backgroundColor: action.color,
          borderColor: t.colors.line,
          borderRadius: t.radius.md,
          opacity: side === 'start' ? rightOpacity : leftOpacity,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.panelContent,
          { transform: [{ scale: side === 'start' ? rightScale : leftScale }] },
        ]}
      >
        <Icon
          name={action.icon}
          size={22}
          color={palette.ink}
          strokeWidth={2.8}
        />
        <AppText variant="label" color={palette.ink} uppercase>
          {action.label}
        </AppText>
      </Animated.View>
    </Animated.View>
  );

  return (
    <View>
      {panel(right, 'start')}
      {panel(left, 'end')}
      <Animated.View
        {...responder.panHandlers}
        style={{ transform: [{ translateX: x }] }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    pointerEvents: 'none',
    top: 0,
    left: 0,
    right: 4,
    bottom: 4,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  panelStart: { justifyContent: 'flex-start' },
  panelEnd: { justifyContent: 'flex-end' },
  panelContent: { alignItems: 'center', gap: 4 },
});
