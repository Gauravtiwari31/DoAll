import { isEmail } from 'class-validator';

export type DeleteAccountField = 'email' | 'password' | 'confirm';

/** A message for the user; `field` ties it to one input of the form. */
export interface FormProblem {
  field?: DeleteAccountField;
  message: string;
}

export interface DeleteAccountForm {
  email: string;
  password: string;
  problems: FormProblem[];
}

/** Value of the "I understand" checkbox when it is ticked. */
export const CONFIRM_VALUE = 'yes';

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const fieldsOf = (body: unknown) =>
  typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

export const CONFIRM_PROBLEM: FormProblem = {
  field: 'confirm',
  message: 'Please tick the box to confirm that you understand deletion is permanent',
};

/** Whether the "I understand" checkbox was ticked (both forms have one). */
export const isConfirmed = (body: unknown) => fieldsOf(body).confirm === CONFIRM_VALUE;

/**
 * Reads the urlencoded form posted by the account deletion page. It is checked
 * here instead of with a DTO so that mistakes come back as the HTML form, never
 * as the ValidationPipe's JSON. Anything that is not a plain string (the body
 * parser turns `email[]=x` into an array) counts as missing.
 */
export function parseDeleteAccountForm(body: unknown): DeleteAccountForm {
  const fields = fieldsOf(body);
  const email = text(fields.email).trim().toLowerCase();
  const password = text(fields.password);
  const problems: FormProblem[] = [];

  if (!email) {
    problems.push({ field: 'email', message: 'Email is required' });
  } else if (!isEmail(email)) {
    problems.push({ field: 'email', message: 'Please enter a valid email address' });
  }
  if (!password) {
    problems.push({ field: 'password', message: 'Password is required' });
  }
  if (!isConfirmed(body)) {
    problems.push(CONFIRM_PROBLEM);
  }

  return { email, password, problems };
}
