import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { getErrorMessage } from '../api/errors';
import { signInWithGoogle } from '../features/auth/authSlice';
import { useOpenPrivacyPolicy } from '../hooks/useOpenPrivacyPolicy';
import { googleSignIn } from '../services/googleSignIn';
import { useAppDispatch } from '../store/hooks';
import { useTheme } from '../theme';
import { ConnectGoogleSheet } from './ConnectGoogleSheet';
import { GoogleButton } from './GoogleButton';
import { AppText, DashedRule, useToast } from './ui';

/** "or", between dashed rules. */
function OrDivider() {
  const t = useTheme();
  return (
    <View
      style={styles.divider}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.rule}>
        <DashedRule color={t.colors.lineSoft} />
      </View>
      <AppText variant="label" color="textMuted" uppercase>
        or
      </AppText>
      <View style={styles.rule}>
        <DashedRule color={t.colors.lineSoft} />
      </View>
    </View>
  );
}

/**
 * "or · Continue with Google" for the welcome, login and sign-up screens, and
 * the whole flow behind it: Google's account chooser, signing in on the
 * server (which creates the account the first time), and connecting Google to
 * an existing email and password account. Renders nothing in builds without
 * Google sign-in. `policyNote` adds the privacy policy line, for screens that
 * don't already show it.
 */
export function GoogleSignInSection({ policyNote }: { policyNote?: boolean }) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const openPrivacyPolicy = useOpenPrivacyPolicy();
  const [busy, setBusy] = useState(false);
  // The connect sheet keeps its details while it animates closed.
  const [connect, setConnect] = useState({ email: '', idToken: '' });
  const [connectOpen, setConnectOpen] = useState(false);

  if (!googleSignIn.isAvailable()) {
    return null;
  }

  const start = async () => {
    setBusy(true);
    try {
      const idToken = await googleSignIn.chooseAccount();
      if (!idToken) {
        return; // backed out of the chooser
      }
      const result = await dispatch(signInWithGoogle({ idToken }));
      // Signed in: the navigator switches to the app on its own.
      if (signInWithGoogle.rejected.match(result)) {
        const { linkEmail } = result.meta;
        if (linkEmail) {
          setConnect({ email: linkEmail, idToken });
          setConnectOpen(true);
        } else {
          toast({
            message: result.payload ?? 'Could not sign in with Google',
            tone: 'error',
          });
        }
      }
    } catch (error) {
      toast({ message: getErrorMessage(error), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      <OrDivider />
      <GoogleButton onPress={start} busy={busy} testID="google-sign-in" />
      {policyNote ? (
        <Pressable
          onPress={openPrivacyPolicy}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityHint="Opens the privacy policy in your browser"
        >
          <AppText variant="caption" color="textMuted" align="center">
            If you're new, continuing with Google creates your account and means
            you agree to the{' '}
            <AppText variant="caption" style={styles.link}>
              Privacy Policy
            </AppText>
            .
          </AppText>
        </Pressable>
      ) : null}
      <ConnectGoogleSheet
        visible={connectOpen}
        email={connect.email}
        idToken={connect.idToken}
        onClose={() => setConnectOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rule: { flex: 1, overflow: 'hidden' },
  link: { textDecorationLine: 'underline' },
});
