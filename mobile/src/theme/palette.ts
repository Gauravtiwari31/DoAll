/**
 * DoAll palette — "paper & ink".
 *
 * Warm paper backgrounds, near-black ink for text and outlines, and a small set
 * of saturated "highlighter" colours for priorities and categories. Everything
 * in the UI is derived from these values via the semantic themes in themes.ts.
 */
export const palette = {
  paper: '#F2EDE4',
  paperDeep: '#E7E0D2',
  card: '#FFFCF6',
  ink: '#121212',
  inkSoft: '#5E594F',
  inkFaint: '#9A9386',

  night: '#121110',
  nightCard: '#1D1C1A',
  nightRaised: '#272522',
  cream: '#F2EDE4',
  creamSoft: '#ABA597',
  creamFaint: '#6F6A60',

  signal: '#FF5A1F', // primary accent
  lime: '#D7F75B',
  butter: '#FFD45C',
  sky: '#9CD7FF',
  lilac: '#CDB8FF',
  mint: '#8FE3B5',
  blush: '#FFA9C9',
  clay: '#E3D9C6',
  danger: '#E5341B',
} as const;
