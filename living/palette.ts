/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { Mood, Weather } from './types';
import { RGB, clamp, hexToRgb, mixRgb, rgbToCss } from './util';

// [hour, sky top, sky bottom]
const SKY_KEYS: Array<[number, string, string]> = [
  [0, '#04060f', '#0c1430'],
  [5, '#101736', '#33294f'],
  [6.5, '#3b5a9c', '#f2a36b'],
  [9, '#4a88d6', '#bfe0f5'],
  [12, '#3580d8', '#a9d6f5'],
  [16, '#4a88cf', '#cfe3ee'],
  [18.5, '#5a4a8c', '#f58f4f'],
  [20, '#1c2050', '#6b3f6e'],
  [22, '#080c22', '#18204a'],
  [24, '#04060f', '#0c1430']
];

export const daylightAt = (hour: number): number => {
  const s = Math.sin((Math.PI * (hour - 6)) / 12);
  return clamp(s * 1.6 + 0.25, 0, 1);
};

export interface SkyColors { top: RGB; bottom: RGB; daylight: number }

export const skyAt = (hour: number): SkyColors => {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < SKY_KEYS.length - 2 && h >= SKY_KEYS[i + 1][0]) i++;
  const [h0, t0, b0] = SKY_KEYS[i];
  const [h1, t1, b1] = SKY_KEYS[i + 1];
  const f = clamp((h - h0) / (h1 - h0), 0, 1);
  return { top: mixRgb(hexToRgb(t0), hexToRgb(t1), f), bottom: mixRgb(hexToRgb(b0), hexToRgb(b1), f), daylight: daylightAt(h) };
};

// How strongly the weather greys out and darkens the sky.
export const WEATHER_GRAY: Record<Weather, number> = { clear: 0, cloudy: 0.3, rain: 0.45, storm: 0.7, snow: 0.25, fog: 0.4, ash: 0.55 };
export const WEATHER_CLOUDS: Record<Weather, number> = { clear: 0.15, cloudy: 0.8, rain: 1, storm: 1, snow: 0.8, fog: 0.5, ash: 0.9 };

export const MOOD_TINT: Record<Mood, { color: RGB; alpha: number }> = {
  calm: { color: [0, 0, 0], alpha: 0 },
  mystery: { color: [70, 25, 120], alpha: 0.16 },
  tense: { color: [70, 0, 30], alpha: 0.1 },
  danger: { color: [140, 0, 0], alpha: 0.2 },
  triumph: { color: [255, 200, 90], alpha: 0.14 },
  joy: { color: [255, 170, 120], alpha: 0.12 },
  sorrow: { color: [60, 85, 130], alpha: 0.2 }
};

// Darken/cool a base colour according to the amount of daylight.
export const lit = (hex: string, daylight: number, gray = 0): string => {
  const base = hexToRgb(hex);
  const night: RGB = [base[0] * 0.22 + 6, base[1] * 0.26 + 10, base[2] * 0.4 + 24];
  const day = mixRgb(base, [120, 124, 132], gray * 0.5);
  return rgbToCss(mixRgb(night, day, daylight));
};
