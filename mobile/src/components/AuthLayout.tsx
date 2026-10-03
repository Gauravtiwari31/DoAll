import React, { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ServerButton } from './ServerSettings';
import { AppText, IconButton, Screen } from './ui';

interface AuthLayoutProps {
  title: ReactNode;
  subtitle: string;
  onBack: () => void;
  footer?: ReactNode;
}

/** Shared frame for the login and sign-up forms. */
export function AuthLayout({
  title,
  subtitle,
  onBack,
  footer,
  children,
}: PropsWithChildren<AuthLayoutProps>) {
  return (
    <Screen>
      {/* Edge-to-edge Android doesn't resize for the keyboard, so pad manually. */}
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <IconButton icon="arrowLeft" label="Back" onPress={onBack} />
            <ServerButton />
          </View>
          <View style={styles.header}>
            <AppText variant="title" style={styles.title}>
              {title}
            </AppText>
            <AppText color="textMuted" style={styles.subtitle}>
              {subtitle}
            </AppText>
          </View>
          <View style={styles.form}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 24, paddingTop: 12 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  header: { marginTop: 28, marginBottom: 28 },
  title: { fontSize: 40, lineHeight: 50, letterSpacing: -1.4 },
  subtitle: { marginTop: 10, fontSize: 16, lineHeight: 22 },
  form: { gap: 18 },
  footer: { marginTop: 'auto', paddingTop: 28, alignItems: 'center' },
});
