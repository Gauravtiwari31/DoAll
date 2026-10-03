/** Escapes user input so it can be embedded safely in a RegExp / $regex. */
export const escapeRegex = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
