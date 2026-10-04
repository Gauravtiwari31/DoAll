const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes text so it can be embedded safely in HTML content or a quoted attribute value. */
export const escapeHtml = (input: string): string =>
  input.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
