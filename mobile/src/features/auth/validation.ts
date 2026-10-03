/** Client-side checks that mirror the API's DTO rules, for instant feedback. */

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm extends LoginForm {
  name: string;
}

export function validateLogin(form: LoginForm): FieldErrors<LoginForm> {
  const errors: FieldErrors<LoginForm> = {};
  if (!EMAIL_PATTERN.test(form.email.trim())) {
    errors.email = 'Enter a valid email address';
  }
  if (!form.password) {
    errors.password = 'Enter your password';
  }
  return errors;
}

export function validateRegistration(
  form: RegisterForm,
): FieldErrors<RegisterForm> {
  const errors: FieldErrors<RegisterForm> = {};
  const name = form.name.trim();
  if (name.length < 2 || name.length > 50) {
    errors.name = 'Name must be 2–50 characters';
  }
  if (!EMAIL_PATTERN.test(form.email.trim())) {
    errors.email = 'Enter a valid email address';
  }
  if (form.password.length < 8) {
    errors.password = 'Use at least 8 characters';
  } else if (form.password.length > 72) {
    errors.password = 'Use at most 72 characters';
  } else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
    errors.password = 'Include at least one letter and one number';
  }
  return errors;
}

export const hasErrors = (errors: object) => Object.keys(errors).length > 0;

/** 0–4 score for the strength meter on the sign-up screen. */
export function passwordStrength(password: string): {
  score: number;
  label: string;
} {
  if (!password) {
    return { score: 0, label: '' };
  }
  let score = 0;
  if (password.length >= 8) {
    score++;
  }
  if (password.length >= 12) {
    score++;
  }
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score++;
  }
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) {
    score++;
  }
  const labels = ['Too weak', 'Weak', 'Okay', 'Strong', 'Excellent'];
  return { score, label: labels[score] };
}
