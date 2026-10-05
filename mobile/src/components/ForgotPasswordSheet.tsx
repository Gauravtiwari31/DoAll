import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { authApi } from '../api/authApi';
import { getErrorMessage } from '../api/errors';
import { EMAIL_PATTERN } from '../features/auth/validation';
import { AppText, Banner, Button, Sheet, TextField } from './ui';

/**
 * "Forgot password?": asks the server to email a reset link. The new
 * password is chosen on the web page the link opens. The answer is the same
 * whether or not the address has an account, so this says so carefully.
 */
export function ForgotPasswordSheet({
  visible,
  onClose,
  initialEmail,
}: {
  visible: boolean;
  onClose: () => void;
  initialEmail: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setEmail(initialEmail);
      setError(null);
      setSentTo(null);
    }
  }, [visible, initialEmail]);

  const send = async () => {
    const address = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(address)) {
      setError('Please enter a valid email address');
      return;
    }
    setError(null);
    setSending(true);
    try {
      await authApi.forgotPassword(address);
      setSentTo(address);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Reset password">
      <View style={styles.body}>
        {sentTo ? (
          <>
            <Banner
              tone="info"
              message={`If ${sentTo} has a DoAll account, a reset link is on its way. It works for 1 hour.`}
            />
            <AppText color="textMuted">
              Open the link on any device, choose a new password, then log in
              here with it. No email after a few minutes? Check your spam
              folder.
            </AppText>
            <Button title="Done" variant="dark" size="md" onPress={onClose} />
          </>
        ) : (
          <>
            <AppText color="textMuted">
              Enter the email you signed up with and we'll send you a link to
              choose a new password.
            </AppText>
            <TextField
              label="Email"
              icon="mail"
              value={email}
              onChangeText={setEmail}
              error={error}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="send"
              onSubmitEditing={send}
            />
            <Button
              title="Send reset link"
              icon="mail"
              variant="dark"
              size="md"
              loading={sending}
              onPress={send}
            />
          </>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16 },
});
