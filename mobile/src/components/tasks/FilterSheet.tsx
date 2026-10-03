import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { setSort } from '../../features/preferences/preferencesSlice';
import { selectFilters, selectSort } from '../../features/tasks/selectors';
import {
  CATEGORY_META,
  PRIORITY_META,
  SORT_META,
} from '../../features/tasks/taskMeta';
import {
  resetFilters,
  setCategoryFilter,
  setPriorityFilter,
} from '../../features/tasks/tasksSlice';
import { CATEGORIES, PRIORITIES, SORTS } from '../../features/tasks/types';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { palette, useTheme } from '../../theme';
import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Icon } from '../ui/Icon';
import { SectionLabel } from '../ui/SectionLabel';
import { Sheet } from '../ui/Sheet';

/** Sort order + priority/category filters, all applied live. */
export function FilterSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const sort = useAppSelector(selectSort);
  const filters = useAppSelector(selectFilters);

  return (
    <Sheet visible={visible} onClose={onClose} title="Sort & filter">
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <SectionLabel>Sort by</SectionLabel>
        <View
          style={[
            styles.sortList,
            { borderColor: t.colors.line, backgroundColor: t.colors.surface },
          ]}
        >
          {SORTS.map((key, index) => {
            const selected = key === sort;
            return (
              <Pressable
                key={key}
                onPress={() => dispatch(setSort(key))}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[
                  styles.sortRow,
                  index > 0 && [
                    styles.divider,
                    { borderTopColor: t.colors.lineSoft },
                  ],
                  selected && { backgroundColor: t.colors.highlight },
                ]}
              >
                <View style={styles.flex}>
                  <View style={styles.sortTitle}>
                    {key === 'smart' ? (
                      <Icon
                        name="sparkle"
                        size={16}
                        color={selected ? palette.ink : t.colors.text}
                      />
                    ) : null}
                    <AppText
                      variant="bodyStrong"
                      color={selected ? palette.ink : 'text'}
                    >
                      {SORT_META[key].label}
                    </AppText>
                  </View>
                  <AppText
                    variant="caption"
                    color={selected ? palette.inkSoft : 'textMuted'}
                  >
                    {SORT_META[key].hint}
                  </AppText>
                </View>
                <View
                  style={[
                    styles.radio,
                    { borderColor: selected ? palette.ink : t.colors.line },
                    selected && { backgroundColor: palette.ink },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        <SectionLabel style={styles.section}>Priority</SectionLabel>
        <View style={styles.wrap}>
          <Chip
            label="Any"
            selected={filters.priority === null}
            onPress={() => dispatch(setPriorityFilter(null))}
          />
          {PRIORITIES.map(p => (
            <Chip
              key={p}
              label={PRIORITY_META[p].label}
              dot={PRIORITY_META[p].color}
              color={PRIORITY_META[p].color}
              selected={filters.priority === p}
              onPress={() =>
                dispatch(setPriorityFilter(filters.priority === p ? null : p))
              }
            />
          ))}
        </View>

        <SectionLabel style={styles.section}>Category</SectionLabel>
        <View style={styles.wrap}>
          <Chip
            label="Any"
            selected={filters.category === null}
            onPress={() => dispatch(setCategoryFilter(null))}
          />
          {CATEGORIES.map(c => (
            <Chip
              key={c}
              label={CATEGORY_META[c].label}
              dot={CATEGORY_META[c].color}
              color={CATEGORY_META[c].color}
              selected={filters.category === c}
              onPress={() =>
                dispatch(setCategoryFilter(filters.category === c ? null : c))
              }
            />
          ))}
        </View>
      </ScrollView>
      <View style={styles.actions}>
        <Button
          title="Reset"
          variant="outline"
          size="md"
          onPress={() => dispatch(resetFilters())}
          style={styles.flex}
        />
        <Button
          title="Show tasks"
          variant="dark"
          size="md"
          onPress={onClose}
          style={styles.flex}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // Shrinks to fit the sheet so the action row below stays on screen.
  scroll: { flexShrink: 1 },
  content: { paddingBottom: 8 },
  sortList: { borderWidth: 2, borderRadius: 14, overflow: 'hidden' },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  divider: { borderTopWidth: 1.5 },
  sortTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  section: { marginTop: 22 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  flex: { flex: 1 },
});
