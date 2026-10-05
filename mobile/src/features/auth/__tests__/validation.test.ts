import {
  passwordStrength,
  validateLogin,
  validateRegistration,
} from '../validation';
import { normalizeTag, validateTask } from '../../tasks/validation';

describe('auth validation', () => {
  it('validates login input', () => {
    expect(validateLogin({ email: 'nope', password: '' })).toEqual({
      email: expect.any(String),
      password: expect.any(String),
    });
    expect(validateLogin({ email: ' a@b.co ', password: 'x' })).toEqual({});
  });

  it('mirrors the API password rules on sign-up', () => {
    const base = { name: 'Ada', email: 'ada@example.com' };
    expect(
      validateRegistration({ ...base, password: 'short1' }).password,
    ).toMatch(/8 characters/);
    expect(
      validateRegistration({ ...base, password: 'onlyletters' }).password,
    ).toMatch(/letter and one number/);
    expect(validateRegistration({ ...base, password: 'letters123' })).toEqual(
      {},
    );
    expect(
      validateRegistration({ ...base, name: 'A', password: 'letters123' }).name,
    ).toBeDefined();
  });

  it('scores password strength', () => {
    expect(passwordStrength('').score).toBe(0);
    expect(passwordStrength('abcdefgh').score).toBe(1);
    expect(passwordStrength('Abcdefgh1234!').score).toBe(4);
  });
});

describe('task validation', () => {
  const input = {
    title: 'Ship it',
    description: '',
    scheduledAt: '2026-01-10T10:00:00.000Z',
    deadline: null,
    priority: 'high' as const,
    category: 'work' as const,
    tags: [],
    reminderOffset: null,
    recurrence: null,
  };

  it('requires a title and a deadline after the start', () => {
    expect(validateTask(input)).toEqual({});
    expect(validateTask({ ...input, title: '   ' }).title).toBeDefined();
    expect(
      validateTask({ ...input, deadline: '2026-01-10T09:00:00.000Z' }).deadline,
    ).toBeDefined();
  });

  it('normalises tags', () => {
    expect(normalizeTag('  #Deep Work ')).toBe('deep-work');
    expect(normalizeTag('#')).toBeNull();
    expect(normalizeTag('x'.repeat(21))).toBeNull();
  });
});
