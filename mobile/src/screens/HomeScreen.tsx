import { format } from 'date-fns';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../components/tasks/EmptyState';
import { FilterSheet } from '../components/tasks/FilterSheet';
import { StatsHero } from '../components/tasks/StatsHero';
import { SwipeableRow } from '../components/tasks/SwipeableRow';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskSkeleton } from '../components/tasks/TaskSkeleton';
import {
  Accent,
  AppText,
  BrutalPressable,
  Chip,
  Icon,
  IconButton,
  Screen,
  TextField,
  useToast,
} from '../components/ui';
import {
  selectActiveFilterCount,
  selectDashboard,
  selectFilters,
  selectSort,
  selectViewCounts,
  selectVisibleTasks,
} from '../features/tasks/selectors';
import { SORT_META, VIEW_META } from '../features/tasks/taskMeta';
import {
  deleteTask,
  fetchTasks,
  resetFilters,
  restoreTask,
  setSearch,
  setTaskCompleted,
  setView,
} from '../features/tasks/tasksSlice';
import { Task, TaskView, VIEWS } from '../features/tasks/types';
import { useNow } from '../hooks/useNow';
import { AppScreenProps } from '../navigation/types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { palette, shadowFor, useTheme } from '../theme';
import { greeting } from '../utils/dates';
import { tick } from '../utils/haptics';

const EMPTY_COPY: Record<
  TaskView,
  { title: string; accent: string; message: string }
> = {
  all: {
    title: 'A clean',
    accent: 'slate.',
    message: 'Tap the + button to add your first task.',
  },
  today: {
    title: 'Nothing on',
    accent: 'today.',
    message: 'Enjoy it, or pull something forward from Upcoming.',
  },
  upcoming: {
    title: 'Nothing',
    accent: 'ahead.',
    message: 'Tasks planned after today will line up here.',
  },
  overdue: {
    title: 'Nothing overdue.',
    accent: 'Nice.',
    message: 'Every deadline is still in the future.',
  },
  done: {
    title: 'Nothing done',
    accent: 'yet.',
    message: 'Swipe a task to the right to complete it.',
  },
};

export function HomeScreen({ navigation }: AppScreenProps<'Home'>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const toast = useToast();
  const now = useNow();

  const user = useAppSelector(state => state.auth.user);
  const status = useAppSelector(state => state.tasks.status);
  const refreshing = useAppSelector(state => state.tasks.refreshing);
  const error = useAppSelector(state => state.tasks.error);
  const filters = useAppSelector(selectFilters);
  const sort = useAppSelector(selectSort);
  const activeFilters = useAppSelector(selectActiveFilterCount);
  const tasks = useAppSelector(state => selectVisibleTasks(state, now));
  const counts = useAppSelector(state => selectViewCounts(state, now));
  const dashboard = useAppSelector(state => selectDashboard(state, now));
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchTasks());
    }
  }, [status, dispatch]);

  const openTask = useCallback(
    (task: Task) => navigation.navigate('TaskDetail', { id: task.id }),
    [navigation],
  );

  const toggleTask = useCallback(
    (task: Task) => {
      const completed = !task.completed;
      if (completed) {
        tick();
      }
      dispatch(setTaskCompleted({ task, completed }))
        .unwrap()
        .then(() => {
          if (completed) {
            toast({
              message: 'Done and dusted.',
              tone: 'success',
              action: {
                label: 'Undo',
                onPress: () =>
                  dispatch(
                    setTaskCompleted({
                      task: { ...task, completed: true },
                      completed: false,
                    }),
                  ),
              },
            });
          }
        })
        .catch((message: string) => toast({ message, tone: 'error' }));
    },
    [dispatch, toast],
  );

  const removeTask = useCallback(
    (task: Task) => {
      dispatch(deleteTask(task))
        .unwrap()
        .then(() =>
          toast({
            message: `Deleted “${task.title}”`,
            action: {
              label: 'Undo',
              onPress: () =>
                dispatch(restoreTask(task))
                  .unwrap()
                  .catch((message: string) =>
                    toast({ message, tone: 'error' }),
                  ),
            },
          }),
        )
        .catch((message: string) => toast({ message, tone: 'error' }));
    },
    [dispatch, toast],
  );

  const isFiltered = activeFilters > 0 || filters.search.trim().length > 0;
  const firstLoad =
    status === 'loading' || (status === 'idle' && tasks.length === 0);

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <View style={styles.flex}>
          <AppText variant="label" color="textMuted" uppercase>
            {format(now, 'EEE · d MMM')}
          </AppText>
          <AppText variant="title" numberOfLines={1} style={styles.greeting}>
            {greeting(new Date(now))},{' '}
            <Accent size={36}>{user?.name.split(' ')[0] ?? 'there'}.</Accent>
          </AppText>
        </View>
        <BrutalPressable
          onPress={() => navigation.navigate('Profile')}
          accessibilityLabel="Open profile"
          color={palette.lilac}
          radius={16}
          offset={3}
          contentStyle={styles.avatar}
        >
          <AppText variant="heading" color={palette.ink}>
            {(user?.name ?? '?').charAt(0).toUpperCase()}
          </AppText>
        </BrutalPressable>
      </View>

      <StatsHero
        todayTotal={dashboard.todayTotal}
        todayDone={dashboard.todayDone}
        overdue={dashboard.overdue}
        active={dashboard.active}
        nextUp={dashboard.nextUp}
        now={now}
        onOpenTask={openTask}
      />

      <View style={styles.searchRow}>
        <TextField
          icon="search"
          value={filters.search}
          onChangeText={text => dispatch(setSearch(text))}
          placeholder="Search tasks or #tags"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          containerStyle={styles.flex}
          right={
            filters.search ? (
              <Pressable
                onPress={() => dispatch(setSearch(''))}
                hitSlop={10}
                accessibilityLabel="Clear search"
              >
                <Icon name="x" size={18} color={t.colors.textMuted} />
              </Pressable>
            ) : null
          }
        />
        <View>
          <IconButton
            icon="sliders"
            label="Sort and filter"
            onPress={() => setSheetOpen(true)}
            size={51}
            color={activeFilters > 0 ? palette.butter : undefined}
          />
          {activeFilters > 0 ? (
            <View style={[styles.badge, { borderColor: t.colors.line }]}>
              <AppText variant="label" color={palette.card}>
                {activeFilters}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {VIEWS.map(view => (
          <Chip
            key={view}
            label={VIEW_META[view].label}
            count={counts[view]}
            selected={filters.view === view}
            color={
              view === 'overdue' && counts.overdue > 0
                ? palette.signal
                : undefined
            }
            onPress={() => dispatch(setView(view))}
          />
        ))}
      </ScrollView>

      <View style={styles.listLabel}>
        <Pressable
          onPress={() => setSheetOpen(true)}
          style={styles.sortLabel}
          hitSlop={8}
        >
          {sort === 'smart' ? (
            <Icon name="sparkle" size={14} color={t.colors.text} />
          ) : null}
          <AppText variant="label" uppercase>
            Sorted by {SORT_META[sort].label}
          </AppText>
          <Icon name="chevronDown" size={14} color={t.colors.text} />
        </Pressable>
        <AppText variant="label" color="textMuted" uppercase>
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </AppText>
      </View>
    </View>
  );

  const empty = firstLoad ? (
    <TaskSkeleton />
  ) : status === 'failed' ? (
    <EmptyState
      title="Couldn't load"
      accent="tasks."
      message={error ?? 'Something went wrong.'}
      action={{ label: 'Try again', onPress: () => dispatch(fetchTasks()) }}
    />
  ) : isFiltered ? (
    <EmptyState
      title="No"
      accent="matches."
      message="Nothing fits this search and filter combo."
      action={{
        label: 'Clear filters',
        onPress: () => {
          dispatch(resetFilters());
          dispatch(setSearch(''));
        },
      }}
    />
  ) : (
    <EmptyState {...EMPTY_COPY[filters.view]} />
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Task; index: number }) => (
      <SwipeableRow
        right={{
          label: item.completed ? 'Undo' : 'Done',
          icon: item.completed ? 'refresh' : 'check',
          color: palette.lime,
          onTrigger: () => toggleTask(item),
        }}
        left={{
          label: 'Delete',
          icon: 'trash',
          color: palette.signal,
          onTrigger: () => removeTask(item),
        }}
      >
        <TaskCard
          task={item}
          now={now}
          index={index}
          onPress={openTask}
          onToggle={toggleTask}
          upNext={item.id === dashboard.nextUp?.id}
        />
      </SwipeableRow>
    ),
    [now, openTask, toggleTask, removeTask, dashboard.nextUp?.id],
  );

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={() => {
          dispatch(fetchTasks({ refresh: true }));
        }}
        colors={[palette.ink]}
        progressBackgroundColor={palette.lime}
      />
    ),
    [refreshing, dispatch],
  );

  return (
    <Screen edges={['top']}>
      <FlatList
        data={tasks}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 120 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      />

      <BrutalPressable
        onPress={() => navigation.navigate('TaskEditor')}
        accessibilityLabel="Add a task"
        testID="add-task"
        color={t.colors.primary}
        shadowColor={shadowFor(t, t.colors.primary)}
        radius={22}
        offset={5}
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        contentStyle={styles.fabFace}
      >
        <Icon name="plus" size={30} color={palette.ink} strokeWidth={3} />
      </BrutalPressable>

      <FilterSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </Screen>
  );
}

const Separator = () => <View style={styles.separator} />;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: 20 },
  header: { paddingTop: 12, gap: 20, marginBottom: 18 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  greeting: { marginTop: 4 },
  avatar: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  badge: {
    position: 'absolute',
    top: -8,
    right: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    backgroundColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: { gap: 8, paddingRight: 20 },
  listLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  sortLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  separator: { height: 16 },
  fab: { position: 'absolute', right: 20 },
  fabFace: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
