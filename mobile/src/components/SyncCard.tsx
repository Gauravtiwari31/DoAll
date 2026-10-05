import { formatDistanceStrict } from 'date-fns';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { authApi } from '../api/authApi';
import { getErrorMessage } from '../api/errors';
import { refreshProfile } from '../features/auth/authSlice';
import { syncNow, SyncStatus } from '../features/sync/syncSlice';
import { useNow } from '../hooks/useNow';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { palette } from '../theme';
import { AppText, BrutalBox, Button, Icon, useToast } from './ui';

const HEADLINE: Record<SyncStatus, string> = {
  idle: 'Backed up',
  syncing: 'Syncing…',
  offline: 'Offline',
  unverified: 'Confirm your email to back up',
  error: "Couldn't sync",
};

const COLOR: Record<SyncStatus, string> = {
  idle: palette.lime,
  syncing: palette.sky,
  offline: palette.butter,
  unverified: palette.butter,
  error: palette.blush,
};

/**
 * Backup & sync on the profile screen: the state of sync, what's waiting,
 * the last error (for "my tasks aren't on my other phone"), and confirming
 * the email address when the server asks for it.
 */
export function SyncCard() {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const now = useNow();
  const sync = useAppSelector(state => state.sync);
  const email = useAppSelector(state => state.auth.user?.email);
  const [resending, setResending] = useState(false);

  const ago = (iso: string) =>
    `${formatDistanceStrict(new Date(iso), new Date(now))} ago`;

  const details: string[] = [];
  if (sync.status === 'unverified') {
    details.push(
      `We emailed a link to ${email}. Open it, then come back. Your tasks stay on this phone meanwhile.`,
    );
  } else if (sync.status === 'offline') {
    details.push("Changes are saved on this phone and sync when you're back online.");
  }
  details.push(
    sync.pending === 0
      ? 'Everything on this phone is on the server too.'
      : `${sync.pending} change${sync.pending === 1 ? '' : 's'} waiting to sync.`,
  );
  if (sync.lastSyncedAt) {
    details.push(`Last synced ${ago(sync.lastSyncedAt)}.`);
  }
  if (sync.status === 'error' && sync.lastError) {
    details.push(
      `Error: ${sync.lastError} (${sync.failures} failed attempt${
        sync.failures === 1 ? '' : 's'
      }; retrying automatically).`,
    );
  }

  const resend = async () => {
    setResending(true);
    try {
      await authApi.resendVerification();
      toast({ message: `Sent. Check ${email}.`, tone: 'success' });
    } catch (error) {
      toast({ message: getErrorMessage(error), tone: 'error' });
    } finally {
      setResending(false);
    }
  };

  const checkAgain = async () => {
    await dispatch(refreshProfile());
    const result = await dispatch(syncNow());
    if (syncNow.fulfilled.match(result)) {
      toast({ message: 'Email confirmed. Backing up now.', tone: 'success' });
    } else if (result.payload?.kind === 'unverified') {
      toast({ message: 'Not confirmed yet. Open the link in the email first.', tone: 'error' });
    }
  };

  return (
    <BrutalBox offset={3} color={COLOR[sync.status]} contentStyle={styles.card}>
      <View style={styles.top}>
        <Icon
          name={sync.status === 'error' || sync.status === 'unverified' ? 'alert' : 'cloud'}
          size={18}
          color={palette.ink}
        />
        <AppText variant="bodyStrong" color={palette.ink} style={styles.flex}>
          {HEADLINE[sync.status]}
        </AppText>
      </View>
      {details.map(line => (
        <AppText key={line} color={palette.ink}>
          {line}
        </AppText>
      ))}
      {sync.status === 'unverified' ? (
        <View style={styles.actions}>
          <Button
            title="Resend email"
            icon="mail"
            iconPosition="left"
            variant="dark"
            size="md"
            loading={resending}
            onPress={resend}
            style={styles.flex}
          />
          <Button
            title="I've confirmed"
            variant="outline"
            size="md"
            onPress={checkAgain}
            style={styles.flex}
          />
        </View>
      ) : (
        <Button
          title="Sync now"
          icon="refresh"
          iconPosition="left"
          variant="dark"
          size="md"
          loading={sync.status === 'syncing'}
          onPress={() => dispatch(syncNow())}
        />
      )}
    </BrutalBox>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { padding: 14, gap: 8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
