import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInputInstance, View } from 'react-native';
import { AuthLayout } from '../components/AuthLayout';
import { GoogleSignInSection } from '../components/GoogleSignInSection';
import { PasswordToggle } from '../components/PasswordToggle';
import { Accent, AppText, Banner, Button, TextField } from '../components/ui';
import { register } from '../features/auth/authSlice';
import {
  FieldErrors,
  hasErrors,
  passwordStrength,
  RegisterForm,
  validateRegistration,
} from '../features/auth/validation';
import { useOpenPrivacyPolicy } from '../hooks/useOpenPrivacyPolicy';
import { AuthScreenProps } from '../navigation/types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { palette, useTheme } from '../theme';

const STRENGTH_COLORS = [
  palette.danger,
  palette.signal,
  palette.butter,
  palette.mint,
  palette.lime,
];

/** Four-segment meter under the password field. */
function StrengthMeter({ password }: { password: string }) {
  const t = useTheme();
  const { score, label } = passwordStrength(password);
  if (!password) {
    return null;
  }
  return (
    <View style={styles.meter}>
      <View style={styles.bars}>
        {[1, 2, 3, 4].map(i => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                borderColor: t.colors.line,
                backgroundColor:
                  score >= i ? STRENGTH_COLORS[score] : t.colors.surface,
              },
            ]}
          />
        ))}
      </View>
      <AppText variant="label" color="textMuted" uppercase>
        {label}
      </AppText>
    </View>
  );
}

export function RegisterScreen({ navigation }: AuthScreenProps<'Register'>) {
  const dispatch = useAppDispatch();
  const submitting = useAppSelector(state => state.auth.submitting);
  const openPrivacyPolicy = useOpenPrivacyPolicy();
  const [form, setForm] = useState<RegisterForm>({
    name: '',
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<FieldErrors<RegisterForm>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  const update = (field: keyof RegisterForm) => (value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const submit = async () => {
    const found = validateRegistration(form);
    setErrors(found);
    setServerError(null);
    if (hasErrors(found)) {
      return;
    }
    const result = await dispatch(
      register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      }),
    );
    if (register.rejected.match(result)) {
      setServerError(result.payload ?? 'Could not create your account');
    }
  };

  return (
    <AuthLayout
      title={
        <>
          Let's get you{'\n'}
          <Accent size={50}>set up.</Accent>
        </>
      }
      subtitle="One account, every task. Takes about twenty seconds."
      onBack={() => navigation.goBack()}
      footer={
        <Pressable onPress={() => navigation.replace('Login')} hitSlop={8}>
          <AppText color="textMuted">
            Already registered? <AppText variant="bodyStrong">Log in</AppText>
          </AppText>
        </Pressable>
      }
    >
      <TextField
        label="Your name"
        icon="user"
        value={form.name}
        onChangeText={update('name')}
        error={errors.name}
        placeholder="Ada Lovelace"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
        testID="register-name"
      />
      <TextField
        ref={emailRef}
        label="Email"
        icon="mail"
        value={form.email}
        onChangeText={update('email')}
        error={errors.email}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
        testID="register-email"
      />
      <View>
        <TextField
          ref={passwordRef}
          label="Password"
          icon="lock"
          value={form.password}
          onChangeText={update('password')}
          error={errors.password}
          hint={
            errors.password
              ? undefined
              : '8+ characters with a letter and a number'
          }
          placeholder="Make it a good one"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
          right={
            <PasswordToggle
              visible={showPassword}
              onToggle={() => setShowPassword(v => !v)}
            />
          }
          testID="register-password"
        />
        <StrengthMeter password={form.password} />
      </View>

      {serverError ? <Banner message={serverError} /> : null}

      <Button
        title="Create account"
        icon="arrowRight"
        onPress={submit}
        loading={submitting}
        testID="register-submit"
      />

      <GoogleSignInSection />

      <Pressable
        onPress={openPrivacyPolicy}
        hitSlop={8}
        accessibilityRole="link"
        accessibilityHint="Opens the privacy policy in your browser"
        testID="register-privacy-policy"
      >
        <AppText variant="caption" color="textMuted" align="center">
          By creating an account you agree to the{' '}
          <AppText variant="caption" style={styles.link}>
            Privacy Policy
          </AppText>
          .
        </AppText>
      </Pressable>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  meter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  bars: { flex: 1, flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 8, borderRadius: 4, borderWidth: 1.5 },
  link: { textDecorationLine: 'underline' },
});
