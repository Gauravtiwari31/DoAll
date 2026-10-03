import React from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './ui';

/** Eye button placed inside a password TextField. */
export function PasswordToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Hide password' : 'Show password'}
    >
      <Icon
        name={visible ? 'eyeOff' : 'eye'}
        size={20}
        color={t.colors.textMuted}
      />
    </Pressable>
  );
}
