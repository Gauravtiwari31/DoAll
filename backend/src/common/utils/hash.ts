import { createHash } from 'node:crypto';

/**
 * SHA-256 for refresh tokens. bcrypt is the wrong tool here: it only looks at
 * the first 72 bytes, and JWTs from the same user share a long common prefix.
 * Refresh tokens are already high-entropy, so a fast hash is sufficient.
 */
export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
