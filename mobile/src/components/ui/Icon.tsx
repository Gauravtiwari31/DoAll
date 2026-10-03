import React from 'react';
import Svg, { Path } from 'react-native-svg';

/**
 * DoAll's own icon set: chunky 24×24 strokes with round caps to match the
 * heavy outlines used across the UI. Each icon is a list of SVG path strings;
 * paths prefixed with "fill:" are filled instead of stroked.
 */
const ICONS = {
  plus: ['M12 5v14', 'M5 12h14'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  checks: ['M2 12.5l4.5 4.5L15 8.5', 'M10.5 16l1 1L21 7.5'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  trash: [
    'M4 7h16',
    'M10 11v6',
    'M14 11v6',
    'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12',
    'M9 7V4h6v3',
  ],
  edit: ['M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z', 'M13.5 6.5l4 4'],
  calendar: [
    'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
    'M3 10h18',
    'M8 3v4',
    'M16 3v4',
  ],
  clock: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 7v5l3 2'],
  flag: ['M5 21V4', 'M5 4h12l-2.5 4 2.5 4H5'],
  search: ['M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z', 'M20 20l-4-4'],
  sliders: ['M4 7h9', 'M17 7h3', 'M15 5v4', 'M4 17h3', 'M11 17h9', 'M9 15v4'],
  arrowLeft: ['M19 12H5', 'M11 6l-6 6 6 6'],
  arrowRight: ['M5 12h14', 'M13 6l6 6-6 6'],
  chevronRight: ['M9 6l6 6-6 6'],
  chevronDown: ['M6 9l6 6 6-6'],
  eye: [
    'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z',
    'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
  ],
  eyeOff: [
    'M3 3l18 18',
    'M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2',
    'M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2',
    'M9.9 9.9a3 3 0 0 0 4.2 4.2',
  ],
  logout: [
    'M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3',
    'M16 17l5-5-5-5',
    'M21 12H9',
  ],
  sun: [
    'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z',
    'M12 2v2',
    'M12 20v2',
    'M4.9 4.9l1.4 1.4',
    'M17.7 17.7l1.4 1.4',
    'M2 12h2',
    'M20 12h2',
    'M4.9 19.1l1.4-1.4',
    'M17.7 6.3l1.4-1.4',
  ],
  moon: ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'],
  auto: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'fill:M12 3a9 9 0 0 1 0 18z'],
  tag: [
    'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9z',
    'fill:M7.5 6a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z',
  ],
  sparkle: [
    'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z',
    'M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  ],
  alert: ['M12 4l9.5 16h-19z', 'M12 10v4', 'M12 17.2v.3'],
  inbox: ['M3 13l3-8h12l3 8', 'M3 13v6h18v-6', 'M3 13h5l1 3h6l1-3h5'],
  mail: ['M4 6h16v12H4z', 'M4 7l8 6 8-6'],
  lock: ['M6 11h12v10H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
  user: ['M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z', 'M4 21a8 8 0 0 1 16 0'],
  refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 4v7h-7'],
  note: ['M6 3h12v18H6z', 'M9.5 8h5', 'M9.5 12h5', 'M9.5 16h3'],
  bolt: ['M13 2L4 14h7l-1 8 9-12h-7z'],
  grid: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 22, color, strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {ICONS[name].map(d =>
        d.startsWith('fill:') ? (
          <Path key={d} d={d.slice(5)} fill={color} />
        ) : (
          <Path
            key={d}
            d={d}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
    </Svg>
  );
}
