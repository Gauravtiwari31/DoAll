/** Password rules, shared by sign-up (RegisterDto) and the password reset page. */
export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt only looks at the first 72 bytes. */
export const PASSWORD_MAX_LENGTH = 72;
/** At least one letter and one number. */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export const PASSWORD_MESSAGES = {
  min: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  max: `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
  pattern: 'Password must contain at least one letter and one number',
} as const;

/** What's wrong with a new password, or null if it's fine. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return PASSWORD_MESSAGES.min;
  if (password.length > PASSWORD_MAX_LENGTH) return PASSWORD_MESSAGES.max;
  if (!PASSWORD_PATTERN.test(password)) return PASSWORD_MESSAGES.pattern;
  return null;
}
