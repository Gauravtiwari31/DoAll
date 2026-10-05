import React, { useState } from 'react';
import { AccessibilityInfo, Linking, StyleSheet, View } from 'react-native';
import { DeletionConfirmation, signInMethodsOf } from '../api/authApi';
import { getErrorMessage } from '../api/errors';
import { ACCOUNT_DELETION_URL } from '../config';
import { deleteAccount } from '../features/auth/authSlice';
import { googleSignIn } from '../services/googleSignIn';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { PasswordToggle } from './PasswordToggle';
import { AppText, Banner, Button, Sheet, TextField, useToast } from './ui';

/** "all 12 of your tasks", "your 1 task", or "all of your tasks". */
function describeTasks(count: number | null) {
  if (count === 1) {
    return 'your 1 task';
  }
  // No count when there are none, or while the list hasn't loaded.
  return count ? `all ${count} of your tasks` : 'all of your tasks';
}

/**
 * Last stop before the account is gone: says plainly what goes with it and
 * asks the user to confirm who they are, with the password or, for an
 * account that only signs in with Google, by choosing that Google account
 * again. A wrong password shows on the field; anything else (offline, server
 * trouble, another Google account) in a banner, because retyping won't fix it.
 */
export function DeleteAccountSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const user = useAppSelector(state => state.auth.user);
  const taskCount = useAppSelector(state =>
    state.tasks.status === 'succeeded' ? state.tasks.ids.length : null,
  );
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const email = user?.email;
  const account = email ? `your account (${email})` : 'your account';
  const withGoogle = !signInMethodsOf(user).includes('password');

  const reset = () => {
    setPassword('');
    setShowPassword(false);
    setPasswordError(null);
    setServerError(null);
  };

  const close = () => {
    // Once sent, the request finishes either way; stay until it does.
    if (deleting) {
      return;
    }
    reset();
    onClose();
  };

  const confirmDeletion = async (confirmation: DeletionConfirmation) => {
    const result = await dispatch(deleteAccount(confirmation));
    setDeleting(false);

    if (deleteAccount.fulfilled.match(result)) {
      // The app is switching to the signed-out screens. The toast host sits
      // above the navigator, so the message outlives this screen.
      reset();
      onClose();
      toast({
        message: 'Your account and tasks were deleted.',
        tone: 'success',
      });
      return;
    }
    const message = result.payload ?? 'Could not delete your account';
    if (result.meta.wrongPassword) {
      setPasswordError(message);
    } else {
      setServerError(message);
    }
    AccessibilityInfo.announceForAccessibility(message);
  };

  const submitPassword = async () => {
    if (!password) {
      setPasswordError('Enter your password');
      return;
    }
    setPasswordError(null);
    setServerError(null);
    setDeleting(true);
    await confirmDeletion({ password });
  };

  const submitWithGoogle = async () => {
    setServerError(null);
    setDeleting(true);
    let googleIdToken: string | null;
    try {
      googleIdToken = await googleSignIn.chooseAccount();
    } catch (error) {
      setDeleting(false);
      setServerError(getErrorMessage(error));
      return;
    }
    if (!googleIdToken) {
      setDeleting(false); // backed out of the chooser
      return;
    }
    await confirmDeletion({ googleIdToken });
  };

  const openWebDeletion = () => {
    Linking.openURL(ACCOUNT_DELETION_URL).catch(() =>
      setServerError(`Couldn't open ${ACCOUNT_DELETION_URL}`),
    );
  };

  const cancelButton = (
    <Button
      title="Cancel"
      variant="outline"
      size="md"
      onPress={close}
      disabled={deleting}
      style={styles.flex}
      testID="delete-account-cancel"
    />
  );

  return (
    <Sheet visible={visible} onClose={close} title="Delete your account?">
      <View style={styles.body}>
        <AppText color="textMuted">
          This permanently deletes {account} and {describeTasks(taskCount)}.{' '}
          <AppText variant="bodyStrong">It can't be undone.</AppText>
        </AppText>

        {!withGoogle ? (
          <TextField
            label="Password"
            icon="lock"
            value={password}
            onChangeText={value => {
              setPassword(value);
              setPasswordError(null);
            }}
            error={passwordError}
            hint={passwordError ? undefined : 'Enter your password to confirm'}
            placeholder="Your password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            editable={!deleting}
            accessibilityLabel="Password"
            right={
              <PasswordToggle
                visible={showPassword}
                onToggle={() => setShowPassword(v => !v)}
              />
            }
            testID="delete-account-password"
          />
        ) : googleSignIn.isAvailable() ? (
          <AppText color="textMuted">
            You sign in with Google, so after you tap Delete, choose that Google
            account again to confirm.
          </AppText>
        ) : (
          <Banner
            tone="info"
            message="You sign in with Google, which this version of DoAll can't use. Delete your account on the web instead."
          />
        )}

        {serverError ? <Banner message={serverError} /> : null}
        <View style={styles.actions}>
          {cancelButton}
          {!withGoogle || googleSignIn.isAvailable() ? (
            <Button
              title="Delete"
              variant="danger"
              size="md"
              onPress={withGoogle ? submitWithGoogle : submitPassword}
              loading={deleting}
              style={styles.flex}
              testID="delete-account-confirm"
            />
          ) : (
            <Button
              title="Open web page"
              variant="danger"
              size="md"
              onPress={openWebDeletion}
              style={styles.flex}
              testID="delete-account-web"
            />
          )}
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
});
