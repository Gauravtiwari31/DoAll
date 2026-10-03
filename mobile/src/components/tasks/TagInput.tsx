import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { normalizeTag } from '../../features/tasks/validation';
import { MAX_TAGS } from '../../features/tasks/types';
import { useTheme } from '../../theme';
import { AppText } from '../ui/AppText';
import { Icon } from '../ui/Icon';
import { TextField } from '../ui/TextField';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

/** Free-form tags: type and press enter / space / comma to add, tap a tag to remove. */
export function TagInput({ tags, onChange }: TagInputProps) {
  const t = useTheme();
  const [draft, setDraft] = useState('');
  const full = tags.length >= MAX_TAGS;

  const commit = (raw: string) => {
    const tag = normalizeTag(raw);
    if (tag && !tags.includes(tag) && !full) {
      onChange([...tags, tag]);
    }
    setDraft('');
  };

  return (
    <View>
      <TextField
        icon="tag"
        value={draft}
        editable={!full}
        placeholder={
          full ? `Max ${MAX_TAGS} tags` : 'Add a tag and press enter'
        }
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        submitBehavior="submit"
        onChangeText={text => {
          // Space or comma finishes the current tag.
          if (/[\s,]$/.test(text)) {
            commit(text);
          } else {
            setDraft(text);
          }
        }}
        onSubmitEditing={() => commit(draft)}
        hint={`${tags.length}/${MAX_TAGS} tags`}
      />
      {tags.length > 0 ? (
        <View style={styles.list}>
          {tags.map(tag => (
            <Pressable
              key={tag}
              onPress={() => onChange(tags.filter(x => x !== tag))}
              accessibilityRole="button"
              accessibilityLabel={`Remove tag ${tag}`}
              style={[
                styles.tag,
                {
                  borderColor: t.colors.line,
                  backgroundColor: t.colors.surfaceAlt,
                },
              ]}
            >
              <AppText variant="mono">#{tag}</AppText>
              <Icon
                name="x"
                size={12}
                color={t.colors.textMuted}
                strokeWidth={3}
              />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1.5,
  },
});
