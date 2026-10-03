import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Every route is protected by the global JWT guard. Mark a handler (or a whole
 * controller) with `@Public()` to opt out — e.g. register / login.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
