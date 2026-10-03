import axios from 'axios';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DEFAULT_API_URL } from '../config';
import {
  displayHost,
  normalizeApiUrl,
  server,
  useServerUrl,
} from '../services/server';
import { palette, useTheme } from '../theme';
import {
  AppText,
  Banner,
  Button,
  Icon,
  Sheet,
  TextField,
  useToast,
} from './ui';

type Check =
  | { state: 'idle' | 'checking' }
  | { state: 'ok' | 'error'; message: string };

/** Pings `/health` so people can confirm the address before saving it. */
async function checkServer(url: string): Promise<Check> {
  try {
    const { data } = await axios.get<{ db?: string }>(`${url}/health`, {
      timeout: 5000,
    });
    return data.db === 'up'
      ? { state: 'ok', message: 'Connected — the server and database are up.' }
      : {
          state: 'error',
          message: 'Server reached, but its database is down.',
        };
  } catch {
    return {
      state: 'error',
      message: 'No DoAll server answered at that address.',
    };
  }
}

/**
 * Compact "server" pill that opens a sheet for changing the API address.
 * Shown on the auth screens, where the address must be right before signing in.
 */
export function ServerButton() {
  const t = useTheme();
  const toast = useToast();
  const url = useServerUrl();
  const label = displayHost(url);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(url);
  const [check, setCheck] = useState<Check>({ state: 'idle' });

  const normalized = normalizeApiUrl(draft);
  const invalid = draft.trim().length > 0 && !normalized;

  const show = () => {
    setDraft(url);
    setCheck({ state: 'idle' });
    setOpen(true);
  };

  const test = async () => {
    if (!normalized) {
      return;
    }
    setCheck({ state: 'checking' });
    setCheck(await checkServer(normalized));
  };

  const save = async (next: string) => {
    await server.save(next);
    setOpen(false);
    toast({ message: `Using ${displayHost(next)}`, tone: 'success' });
  };

  return (
    <>
      <Pressable
        onPress={show}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Server address: ${label}. Change`}
        style={[
          styles.pill,
          { borderColor: t.colors.line, backgroundColor: t.colors.surface },
        ]}
      >
        <Icon name="server" size={14} color={t.colors.textMuted} />
        <AppText
          variant="mono"
          color="textMuted"
          numberOfLines={1}
          style={styles.pillText}
        >
          {label}
        </AppText>
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Server">
        <View style={styles.body}>
          <AppText color="textMuted">
            Where the DoAll API is running. On the Android emulator keep the
            default; on a phone, use your computer's Wi-Fi IP address.
          </AppText>
          <TextField
            label="API address"
            icon="server"
            value={draft}
            onChangeText={text => {
              setDraft(text);
              setCheck({ state: 'idle' });
            }}
            placeholder="http://192.168.1.20:3000/api"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            error={invalid ? 'That doesn’t look like an address' : null}
            hint={
              normalized && normalized !== draft.trim()
                ? `Will use ${normalized}`
                : undefined
            }
          />
          {check.state === 'ok' || check.state === 'error' ? (
            <Banner
              message={check.message}
              tone={check.state === 'ok' ? 'info' : 'error'}
            />
          ) : null}
          <View style={styles.actions}>
            <Button
              title="Test"
              variant="outline"
              size="md"
              onPress={test}
              loading={check.state === 'checking'}
              disabled={!normalized}
              style={styles.flex}
            />
            <Button
              title="Save"
              variant="dark"
              size="md"
              onPress={() => normalized && save(normalized)}
              disabled={!normalized}
              style={styles.flex}
            />
          </View>
          {url !== DEFAULT_API_URL ? (
            <Pressable
              onPress={() => save(DEFAULT_API_URL)}
              hitSlop={8}
              style={styles.reset}
            >
              <AppText variant="label" uppercase color={palette.signal}>
                Reset to emulator default ({displayHost(DEFAULT_API_URL)})
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    maxWidth: 190,
    paddingHorizontal: 10,
    borderRadius: 15,
    borderWidth: 1.5,
  },
  pillText: { flexShrink: 1 },
  body: { gap: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  reset: { alignSelf: 'center', paddingVertical: 4 },
});
