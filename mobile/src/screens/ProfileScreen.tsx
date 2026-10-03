import { format } from 'date-fns';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Accent,
  AppText,
  BrutalBox,
  Button,
  IconButton,
  Screen,
  SectionLabel,
  Segmented,
  useConfirm,
  useToast,
} from '../components/ui';
import { logout } from '../features/auth/authSlice';
import {
  setThemeMode,
  ThemeMode,
} from '../features/preferences/preferencesSlice';
import { selectAllTasks, selectDashboard } from '../features/tasks/selectors';
import { CATEGORY_META } from '../features/tasks/taskMeta';
import { clearCompleted } from '../features/tasks/tasksSlice';
import { CATEGORIES } from '../features/tasks/types';
import { useNow } from '../hooks/useNow';
import { AppScreenProps } from '../navigation/types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { palette, useTheme } from '../theme';

function StatTile({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <BrutalBox
      color={color}
      style={styles.tile}
      contentStyle={styles.tileFace}
      offset={3}
    >
      <AppText variant="title" color={palette.ink}>
        {value}
      </AppText>
      <AppText variant="label" color={palette.ink} uppercase>
        {label}
      </AppText>
    </BrutalBox>
  );
}

export function ProfileScreen({ navigation }: AppScreenProps<'Profile'>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const toast = useToast();
  const now = useNow();
  const user = useAppSelector(state => state.auth.user);
  const themeMode = useAppSelector(state => state.preferences.themeMode);
  const stats = useAppSelector(state => selectDashboard(state, now));
  const tasks = useAppSelector(selectAllTasks);

  // Open tasks per category, for the little bar chart.
  const open = tasks.filter(task => !task.completed);
  const maxPerCategory = Math.max(
    1,
    ...CATEGORIES.map(c => open.filter(task => task.category === c).length),
  );

  const onClearCompleted = async () => {
    const ok = await confirm({
      title: `Clear ${stats.completed} completed?`,
      message: 'Finished tasks will be permanently deleted.',
      confirmLabel: 'Clear',
      destructive: true,
    });
    if (ok) {
      dispatch(clearCompleted())
        .unwrap()
        .then(count =>
          toast({ message: `Cleared ${count} tasks`, tone: 'success' }),
        )
        .catch((message: string) => toast({ message, tone: 'error' }));
    }
  };

  const onLogout = async () => {
    const ok = await confirm({
      title: 'Log out?',
      message: 'You can log back in any time.',
      confirmLabel: 'Log out',
    });
    if (ok) {
      dispatch(logout());
    }
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
          Profile
        </AppText>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <View style={styles.identity}>
          <BrutalBox
            color={palette.lilac}
            radius={26}
            contentStyle={styles.avatar}
          >
            <AppText variant="display" color={palette.ink}>
              {(user?.name ?? '?').charAt(0).toUpperCase()}
            </AppText>
          </BrutalBox>
          <View style={styles.flex}>
            <AppText variant="title" numberOfLines={2}>
              {user?.name}
            </AppText>
            <AppText variant="mono" color="textMuted" numberOfLines={1}>
              {user?.email}
            </AppText>
            {user?.createdAt ? (
              <AppText variant="mono" color="textFaint">
                Member since {format(new Date(user.createdAt), 'MMM yyyy')}
              </AppText>
            ) : null}
          </View>
        </View>

        <SectionLabel style={styles.section}>Your numbers</SectionLabel>
        <View style={styles.grid}>
          <StatTile label="Total" value={stats.total} color={palette.butter} />
          <StatTile label="Done" value={stats.completed} color={palette.lime} />
          <StatTile label="Open" value={stats.active} color={palette.sky} />
          <StatTile
            label="Overdue"
            value={stats.overdue}
            color={palette.blush}
          />
        </View>
        <BrutalBox style={styles.rateBox} contentStyle={styles.rate} offset={3}>
          <View style={styles.rateTop}>
            <AppText variant="bodyStrong">Completion rate</AppText>
            <AppText variant="heading">
              {Math.round(stats.completionRate * 100)}
              <Accent size={22}>%</Accent>
            </AppText>
          </View>
          <View
            style={[
              styles.track,
              {
                borderColor: t.colors.line,
                backgroundColor: t.colors.surfaceAlt,
              },
            ]}
          >
            <View
              style={[styles.fill, { width: `${stats.completionRate * 100}%` }]}
            />
          </View>
        </BrutalBox>

        <SectionLabel style={styles.section}>Open by category</SectionLabel>
        <View style={styles.bars}>
          {CATEGORIES.map(category => {
            const count = open.filter(
              task => task.category === category,
            ).length;
            return (
              <View key={category} style={styles.barRow}>
                <AppText variant="mono" style={styles.barLabel}>
                  {CATEGORY_META[category].label}
                </AppText>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      count > 0 && styles.barFilled,
                      {
                        width: `${(count / maxPerCategory) * 100}%`,
                        backgroundColor: CATEGORY_META[category].color,
                        borderColor: t.colors.line,
                      },
                    ]}
                  />
                </View>
                <AppText
                  variant="mono"
                  color="textMuted"
                  style={styles.barCount}
                >
                  {count}
                </AppText>
              </View>
            );
          })}
        </View>

        <SectionLabel style={styles.section}>Appearance</SectionLabel>
        <Segmented<ThemeMode>
          value={themeMode}
          onChange={mode => dispatch(setThemeMode(mode))}
          options={[
            { value: 'system', label: 'Auto', icon: 'auto' },
            { value: 'light', label: 'Light', icon: 'sun' },
            { value: 'dark', label: 'Dark', icon: 'moon' },
          ]}
        />

        <SectionLabel style={styles.section}>Housekeeping</SectionLabel>
        <View style={styles.actions}>
          <Button
            title={`Clear completed (${stats.completed})`}
            icon="checks"
            iconPosition="left"
            variant="outline"
            size="md"
            disabled={stats.completed === 0}
            onPress={onClearCompleted}
          />
          <Button
            title="Log out"
            icon="logout"
            iconPosition="left"
            variant="danger"
            size="md"
            onPress={onLogout}
          />
        </View>

        <AppText
          variant="mono"
          color="textFaint"
          align="center"
          style={styles.version}
        >
          DoAll 1.0 · ink, paper & a smart sort
        </AppText>
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
  identity: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  avatar: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginTop: 30 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47%', flexGrow: 1 },
  tileFace: { padding: 14, gap: 2 },
  rateBox: { marginTop: 12 },
  rate: { padding: 14, gap: 10 },
  rateTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  track: { height: 16, borderRadius: 8, borderWidth: 2, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: palette.lime },
  bars: { gap: 10 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 74 },
  barTrack: { flex: 1, height: 16 },
  bar: { height: 16, borderRadius: 5, minWidth: 4 },
  barFilled: { borderWidth: 1.5 },
  barCount: { width: 24, textAlign: 'right' },
  actions: { gap: 12 },
  version: { marginTop: 36 },
});
