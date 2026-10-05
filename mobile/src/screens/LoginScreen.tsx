import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInputInstance } from 'react-native';
import { AuthLayout } from '../components/AuthLayout';
import { ForgotPasswordSheet } from '../components/ForgotPasswordSheet';
import { GoogleSignInSection } from '../components/GoogleSignInSection';
import { PasswordToggle } from '../components/PasswordToggle';
import { Accent, AppText, Banner, Button, TextField } from '../components/ui';
import { clearNotice, login } from '../features/auth/authSlice';
import {
  FieldErrors,
  hasErrors,
  LoginForm,
  validateLogin,
} from '../features/auth/validation';
import { AuthScreenProps } from '../navigation/types';
import { useAppDispatch, useAppSelector } from '../store/hooks';

export function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const dispatch = useAppDispatch();
  const { submitting, notice } = useAppSelector(state => state.auth);
  const [form, setForm] = useState<LoginForm>({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors<LoginForm>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  // The "session expired" notice is shown once, then forgotten.
  useEffect(
    () => () => {
      dispatch(clearNotice());
    },
    [dispatch],
  );

  const update = (field: keyof LoginForm) => (value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const submit = async () => {
    const found = validateLogin(form);
    setErrors(found);
    setServerError(null);
    if (hasErrors(found)) {
      return;
    }
    const result = await dispatch(
      login({ email: form.email.trim(), password: form.password }),
    );
    if (login.rejected.match(result)) {
      setServerError(result.payload ?? 'Could not log in');
    }
    // On success the navigator swaps to the app stack automatically.
  };

  return (
    <AuthLayout
      title={
        <>
          Welcome{'\n'}
          <Accent size={50}>back.</Accent>
        </>
      }
      subtitle="Log in to pick up right where you left off."
      onBack={() => navigation.goBack()}
      footer={
        <Pressable onPress={() => navigation.replace('Register')} hitSlop={8}>
          <AppText color="textMuted">
            New to DoAll?{' '}
            <AppText variant="bodyStrong">Create an account</AppText>
          </AppText>
        </Pressable>
      }
    >
      {notice ? <Banner message={notice} tone="info" /> : null}

      <TextField
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
        testID="login-email"
      />
      <TextField
        ref={passwordRef}
        label="Password"
        icon="lock"
        value={form.password}
        onChangeText={update('password')}
        error={errors.password}
        placeholder="Your password"
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        right={
          <PasswordToggle
            visible={showPassword}
            onToggle={() => setShowPassword(v => !v)}
          />
        }
        testID="login-password"
      />
      <Pressable
        onPress={() => setForgotOpen(true)}
        hitSlop={8}
        style={styles.forgot}
        accessibilityRole="button"
        testID="login-forgot"
      >
        <AppText variant="bodyStrong" color="textMuted">
          Forgot password?
        </AppText>
      </Pressable>

      {serverError ? <Banner message={serverError} /> : null}

      <Button
        title="Log in"
        variant="dark"
        icon="arrowRight"
        onPress={submit}
        loading={submitting}
        testID="login-submit"
      />

      <GoogleSignInSection policyNote />

      <ForgotPasswordSheet
        visible={forgotOpen}
        onClose={() => setForgotOpen(false)}
        initialEmail={form.email.trim()}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', marginTop: -6 },
});
