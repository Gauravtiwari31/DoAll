import { useCallback } from 'react';
import { Linking } from 'react-native';
import { useToast } from '../components/ui';
import { PRIVACY_POLICY_URL } from '../config';

/** "doall.example.com/privacy", for typing into a browser by hand. */
const POLICY_ADDRESS = PRIVACY_POLICY_URL.replace(/^https?:\/\//, '');

/**
 * Opens the privacy policy in the browser. There's no canOpenURL check first:
 * on Android 11+ it answers "no" for web links unless the manifest declares
 * them, so just try, and say so if it fails.
 */
export function useOpenPrivacyPolicy() {
  const toast = useToast();
  return useCallback(async () => {
    try {
      await Linking.openURL(PRIVACY_POLICY_URL);
    } catch {
      toast({ message: `Couldn't open ${POLICY_ADDRESS}`, tone: 'error' });
    }
  }, [toast]);
}
