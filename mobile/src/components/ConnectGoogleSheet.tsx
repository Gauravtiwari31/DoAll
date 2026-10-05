import React, { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { signInWithGoogle } from '../features/auth/authSlice';
import { useAppDispatch } from '../store/hooks';
import { PasswordToggle } from './PasswordToggle';
import { AppText, Banner, Button, Sheet, TextField } from './ui';

/**
 * Someone chose a Google account whose address already has an email and
 * password account. The server connects the two once that password is given,
 * so nobody can take over an account with a Google account alone. Signing in
 * then swaps to the app, which closes the sheet with the screen.
 */
export function ConnectGoogleSheet({
  visible,
  email,
  idToken,
  onClose,
}: {
  visible: boolean;
  email: string;
  /** The token from the account chooser, sent again with the password. */
  idToken: string;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const close = () => {
    if (connecting) {
      return;
    }
    setPassword('');
    setShowPassword(false);
    setPasswordError(null);
    setServerError(null);
    onClose();
  };

  const submit = async () => {
    if (!password) {
      setPasswordError('Enter your password');
      return;
    }
    setPasswordError(null);
    setServerError(null);
    setConnecting(true);
    const result = await dispatch(signInWithGoogle({ idToken, password }));
    setConnecting(false);
    if (signInWithGoogle.fulfilled.match(result)) {
      return;
    }
    const message = result.payload ?? 'Could not connect Google';
    if (result.meta.wrongPassword) {
      setPasswordError(message);
    } else {
      setServerError(message);
    }
    AccessibilityInfo.announceForAccessibility(message);
  };

  return (
    <Sheet visible={visible} onClose={close} title="Connect Google">
      <View style={styles.body}>
        <AppText color="textMuted">
          You already have a DoAll account with{' '}
          <AppText variant="bodyStrong">{email}</AppText>. Enter its password
          once to connect Google, and from then on you can sign in either way.
        </AppText>
        <TextField
          label="Password"
          icon="lock"
          value={password}
          onChangeText={value => {
            setPassword(value);
            setPasswordError(null);
          }}
          error={passwordError}
          placeholder="Your DoAll password"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          editable={!connecting}
          accessibilityLabel="Password"
          right={
            <PasswordToggle
              visible={showPassword}
              onToggle={() => setShowPassword(v => !v)}
            />
          }
          testID="connect-google-password"
        />
        {serverError ? <Banner message={serverError} /> : null}
        <View style={styles.actions}>
          <Button
            title="Cancel"
            variant="outline"
            size="md"
            onPress={close}
            disabled={connecting}
            style={styles.flex}
            testID="connect-google-cancel"
          />
          <Button
            title="Connect"
            variant="dark"
            size="md"
            onPress={submit}
            loading={connecting}
            style={styles.flex}
            testID="connect-google-submit"
          />
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
