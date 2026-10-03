import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SortKey } from '../tasks/types';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface PreferencesState {
  themeMode: ThemeMode;
  sort: SortKey;
}

export const initialPreferences: PreferencesState = {
  themeMode: 'system',
  sort: 'smart',
};

/** Device-level preferences, persisted by the listener in store/index.ts. */
const preferencesSlice = createSlice({
  name: 'preferences',
  initialState: initialPreferences,
  reducers: {
    preferencesHydrated(
      state,
      action: PayloadAction<Partial<PreferencesState> | null>,
    ) {
      return { ...state, ...action.payload };
    },
    setThemeMode(state, action: PayloadAction<ThemeMode>) {
      state.themeMode = action.payload;
    },
    setSort(state, action: PayloadAction<SortKey>) {
      state.sort = action.payload;
    },
  },
});

export const { preferencesHydrated, setThemeMode, setSort } =
  preferencesSlice.actions;
export default preferencesSlice.reducer;
