import { format } from 'date-fns';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppText,
  BrutalBox,
  Button,
  Icon,
  IconButton,
  Screen,
  SectionLabel,
} from '../components/ui';
import type { ReminderStatus } from '../native/NativeReminders';
import { AppScreenProps } from '../navigation/types';
import { reminders, SettingsScreen } from '../services/reminders';
import { palette, useTheme } from '../theme';

/** One phone setting that affects reminders: whether it's fine, and how to fix it. */
function Check({
  ok,
  title,
  okText,
  fixText,
  fixLabel,
  onFix,
}: {
  ok: boolean;
  title: string;
  okText: string;
  fixText: string;
  fixLabel: string;
  onFix: () => void;
}) {
  return (
    <BrutalBox
      offset={3}
      color={ok ? palette.lime : palette.butter}
      contentStyle={styles.check}
    >
      <View style={styles.checkTop}>
        <Icon name={ok ? 'check' : 'alert'} size={18} color={palette.ink} />
        <AppText variant="bodyStrong" color={palette.ink} style={styles.flex}>
          {title}
        </AppText>
      </View>
      <AppText color={palette.ink}>{ok ? okText : fixText}</AppText>
      {ok ? null : (
        <Button title={fixLabel} variant="dark" size="md" onPress={onFix} />
      )}
    </BrutalBox>
  );
}

/** Brands whose battery savers are known to stop reminders, and where to look. */
const OEM_TIPS: { brand: string; steps: string }[] = [
  {
    brand: 'Xiaomi, Redmi, POCO',
    steps:
      'Settings → Apps → DoAll → Autostart on, and Battery saver → No restrictions.',
  },
  {
    brand: 'Oppo, Realme, OnePlus',
    steps:
      'Settings → Battery → App battery management → DoAll → Allow background activity (and auto launch).',
  },
  {
    brand: 'Vivo, iQOO',
    steps:
      'Settings → Battery → Background power consumption → DoAll → Allow. Also turn on Autostart for DoAll.',
  },
  {
    brand: 'Samsung',
    steps:
      'Settings → Battery → Background usage limits → make sure DoAll is not in Sleeping or Deep sleeping apps.',
  },
  {
    brand: 'Huawei, Honor',
    steps:
      'Settings → Battery → App launch → DoAll → Manage manually, with all three switches on.',
  },
];

/**
 * "Reminders not arriving?": checks the settings Android and phone makers
 * use to silence or delay reminders, with a button to each.
 */
export function RemindersScreen({ navigation }: AppScreenProps<'Reminders'>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<ReminderStatus | null>(null);

  const refresh = useCallback(() => {
    reminders
      .status()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  // Coming back from a settings screen shows the new state.
  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh();
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  const open = (screen: SettingsScreen) => {
    reminders.openSettings(screen);
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton
          icon="arrowLeft"
          label="Back"
          onPress={() => navigation.goBack()}
        />
        <AppText variant="label" color="textMuted" uppercase>
          Reminders
        </AppText>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <AppText variant="title">Reminders not arriving?</AppText>
        <AppText color="textMuted" style={styles.intro}>
          DoAll's reminders come from your phone itself, so they work offline.
          But Android and some phone makers hold them back to save battery.
          These settings fix that.
        </AppText>

        {status ? (
          <View style={styles.checks}>
            <Check
              ok={status.notificationsEnabled}
              title="Notifications"
              okText="DoAll may show notifications."
              fixText="Notifications are off for DoAll, so reminders can't show."
              fixLabel="Turn on notifications"
              onFix={() => open('notifications')}
            />
            <Check
              ok={status.exactAlarmsAllowed}
              title="On-time reminders"
              okText="Reminders go off on the minute."
              fixText="Without the Alarms & reminders permission, Android can deliver reminders late, by up to an hour while the phone is asleep."
              fixLabel="Allow alarms & reminders"
              onFix={() => open('exactAlarms')}
            />
            <Check
              ok={status.ignoringBatteryOptimizations}
              title="Battery optimisation"
              okText="Battery optimisation is off for DoAll."
              fixText="Optimised apps can have their reminders delayed. Find DoAll in the list, choose Don't optimise (or Unrestricted)."
              fixLabel="Open battery settings"
              onFix={() => open('battery')}
            />
          </View>
        ) : (
          <AppText color="textMuted" style={styles.intro}>
            Reminders aren't available on this device.
          </AppText>
        )}

        {status ? (
          <AppText variant="mono" color="textMuted" style={styles.queue}>
            {status.scheduled === 0
              ? 'No reminders scheduled.'
              : `${status.scheduled} reminder${
                  status.scheduled === 1 ? '' : 's'
                } scheduled. Next: ${format(
                  status.nextAt,
                  'EEE d MMM · h:mmaaa',
                )}.`}
          </AppText>
        ) : null}

        <SectionLabel style={styles.section}>Phone makers</SectionLabel>
        <AppText color="textMuted">
          Some brands add their own battery savers on top of Android's. Menu
          names vary between models and versions:
        </AppText>
        <View style={styles.tips}>
          {OEM_TIPS.map(tip => (
            <View
              key={tip.brand}
              style={[styles.tip, { borderColor: t.colors.line }]}
            >
              <AppText variant="bodyStrong">{tip.brand}</AppText>
              <AppText color="textMuted">{tip.steps}</AppText>
            </View>
          ))}
        </View>
        <AppText color="textMuted" style={styles.section}>
          Also check that no cleaner or "boost" app closes DoAll, and avoid
          Force stop: Android cancels a force-stopped app's reminders until
          you open it again. (On some brands, swiping DoAll away from recent
          apps does the same.)
        </AppText>
        <Button
          title="Open DoAll's app settings"
          variant="outline"
          size="md"
          onPress={() => open('app')}
          style={styles.section}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  spacer: { width: 47 },
  content: { padding: 20 },
  intro: { marginTop: 8 },
  checks: { gap: 14, marginTop: 20 },
  check: { padding: 14, gap: 10 },
  checkTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  queue: { marginTop: 16 },
  section: { marginTop: 28 },
  tips: { gap: 10, marginTop: 12 },
  tip: { borderWidth: 1.5, borderRadius: 12, padding: 12, gap: 4 },
});
