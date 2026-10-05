import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../../auth/authSlice';
import preferencesReducer, {
  setSort,
} from '../../preferences/preferencesSlice';
import syncReducer from '../../sync/syncSlice';
import {
  matchesFilters,
  matchesView,
  selectDashboard,
  selectViewCounts,
  selectVisibleTasks,
} from '../selectors';
import tasksReducer, {
  fetchTasks,
  setCategoryFilter,
  setSearch,
  setView,
} from '../tasksSlice';
import { initialFilters } from '../tasksSlice';
import { makeTask } from '../../../test-utils/fixtures';

// Saturday noon, local time.
const NOW = new Date(2026, 0, 10, 12, 0).getTime();
const H = 60 * 60 * 1000;
const iso = (offsetHours: number) =>
  new Date(NOW + offsetHours * H).toISOString();

const overdue = makeTask({
  title: 'Pay rent',
  deadline: iso(-2),
  scheduledAt: iso(-26),
});
const today = makeTask({
  title: 'Call mum',
  scheduledAt: iso(3),
  category: 'personal',
});
const upcoming = makeTask({
  title: 'Dentist',
  scheduledAt: iso(48),
  category: 'health',
  tags: ['teeth'],
});
const doneToday = makeTask({
  title: 'Groceries',
  completed: true,
  completedAt: iso(-1),
  category: 'shopping',
});
const all = [overdue, today, upcoming, doneToday];

function storeWith() {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      tasks: tasksReducer,
      sync: syncReducer,
      preferences: preferencesReducer,
    },
  });
  store.dispatch({ type: fetchTasks.fulfilled.type, payload: all });
  return store;
}

describe('matchesView', () => {
  it('classifies tasks into quick views', () => {
    expect(matchesView(overdue, 'overdue', NOW)).toBe(true);
    expect(matchesView(overdue, 'today', NOW)).toBe(true);
    expect(matchesView(today, 'today', NOW)).toBe(true);
    expect(matchesView(today, 'upcoming', NOW)).toBe(false);
    expect(matchesView(upcoming, 'upcoming', NOW)).toBe(true);
    expect(matchesView(doneToday, 'done', NOW)).toBe(true);
    expect(matchesView(doneToday, 'today', NOW)).toBe(true);
  });
});

describe('matchesFilters', () => {
  it('searches title, description and tags (with or without #)', () => {
    const filters = { ...initialFilters, search: '#TEETH' };
    expect(matchesFilters(upcoming, filters, NOW)).toBe(true);
    expect(matchesFilters(today, filters, NOW)).toBe(false);
  });
});

describe('selectors', () => {
  it('applies view, filters and sort together', () => {
    const store = storeWith();
    expect(selectVisibleTasks(store.getState(), NOW).map(t => t.title)).toEqual(
      ['Pay rent', 'Call mum', 'Dentist', 'Groceries'],
    );

    store.dispatch(setView('today'));
    store.dispatch(setCategoryFilter('personal'));
    expect(selectVisibleTasks(store.getState(), NOW).map(t => t.title)).toEqual(
      ['Pay rent', 'Call mum'],
    );

    store.dispatch(setSearch('mum'));
    expect(selectVisibleTasks(store.getState(), NOW).map(t => t.title)).toEqual(
      ['Call mum'],
    );
  });

  it('honours the chosen sort', () => {
    const store = storeWith();
    store.dispatch(setSort('scheduled'));
    expect(selectVisibleTasks(store.getState(), NOW)[0].title).toBe('Pay rent');
    store.dispatch(setSort('created'));
    expect(selectVisibleTasks(store.getState(), NOW).at(-1)?.title).toBe(
      'Groceries',
    );
  });

  it('counts views and builds the dashboard', () => {
    const store = storeWith();
    expect(selectViewCounts(store.getState(), NOW)).toEqual({
      all: 3,
      today: 2,
      upcoming: 1,
      overdue: 1,
      done: 1,
    });
    const dashboard = selectDashboard(store.getState(), NOW);
    expect(dashboard).toEqual(
      expect.objectContaining({
        total: 4,
        active: 3,
        completed: 1,
        overdue: 1,
        todayTotal: 3,
        todayDone: 1,
      }),
    );
    expect(dashboard.nextUp?.title).toBe('Pay rent');
  });
});
