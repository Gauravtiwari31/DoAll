import { palette } from './palette';

/** Semantic colour roles. Components only ever reference these, never raw hex. */
export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  textFaint: string;
  /** Outlines and hard shadows — the "ink" of the neo-brutalist look. */
  line: string;
  lineSoft: string;
  shadow: string;
  primary: string;
  onPrimary: string;
  inverse: string;
  onInverse: string;
  highlight: string;
  danger: string;
  success: string;
  /** Sticker colours always sit under dark ink text, in both modes. */
  onSticker: string;
}

export interface Theme {
  dark: boolean;
  colors: ThemeColors;
  spacing: (n: number) => number;
  radius: { sm: number; md: number; lg: number; pill: number };
  /** Offset of the hard drop shadow behind cards and buttons. */
  shadowOffset: number;
  border: number;
}

const shared = {
  spacing: (n: number) => n * 4,
  radius: { sm: 8, md: 14, lg: 22, pill: 999 },
  shadowOffset: 4,
  border: 2,
};

export const lightTheme: Theme = {
  ...shared,
  dark: false,
  colors: {
    background: palette.paper,
    surface: palette.card,
    surfaceAlt: palette.paperDeep,
    text: palette.ink,
    textMuted: palette.inkSoft,
    textFaint: palette.inkFaint,
    line: palette.ink,
    lineSoft: '#D6CEBE',
    shadow: palette.ink,
    primary: palette.signal,
    onPrimary: palette.ink,
    inverse: palette.ink,
    onInverse: palette.paper,
    highlight: palette.lime,
    danger: palette.danger,
    success: palette.mint,
    onSticker: palette.ink,
  },
};

export const darkTheme: Theme = {
  ...shared,
  dark: true,
  colors: {
    background: palette.night,
    surface: palette.nightCard,
    surfaceAlt: palette.nightRaised,
    text: palette.cream,
    textMuted: palette.creamSoft,
    textFaint: palette.creamFaint,
    line: palette.cream,
    lineSoft: '#3A3732',
    shadow: palette.signal,
    primary: palette.signal,
    onPrimary: palette.ink,
    inverse: palette.cream,
    onInverse: palette.ink,
    highlight: palette.lime,
    danger: '#FF6A50',
    success: palette.mint,
    onSticker: palette.ink,
  },
};

/**
 * Shadow colour for a face filled with `fill`. A face the same colour as its
 * shadow would melt into it (black button on black shadow), so those get the
 * accent instead — or the outline colour in dark mode.
 */
export const shadowFor = (theme: Theme, fill: string): string =>
  fill !== theme.colors.shadow
    ? theme.colors.shadow
    : theme.dark
    ? theme.colors.line
    : theme.colors.primary;
