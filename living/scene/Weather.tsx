/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useMemo } from 'react';
import { Weather } from '../types';
import { WEATHER_CLOUDS } from '../palette';
import { GROUND, H, W } from './Backdrop';
import { mulberry32, rgbToCss, mixRgb, RGB } from '../util';

const frac = (v: number) => v - Math.floor(v);
const hash01 = (n: number) => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);

// ---------- Sky ----------

interface SkyProps { top: RGB; bottom: RGB; daylight: number; hour: number; weatherGray: number; weather: Weather; space: boolean }

export const Sky: React.FC<SkyProps> = ({ top, bottom, daylight, hour, weatherGray, weather, space }) => {
  const stars = useMemo(() => {
    const rng = mulberry32(7);
    return Array.from({ length: 140 }, (_, i) => ({ x: rng() * W, y: rng() * 520, r: 0.8 + rng() * 1.8, d: rng() * 4, i }));
  }, []);
  const clouds = useMemo(() => {
    const rng = mulberry32(21);
    return Array.from({ length: 11 }, (_, i) => ({ x: rng() * 2200 - 300, y: 60 + rng() * 300, s: 0.7 + rng() * 1.1, dur: 80 + rng() * 80, i }));
  }, []);

  const grey: RGB = [92, 96, 108];
  const t = mixRgb(top, mixRgb(top, grey, 0.8), weatherGray);
  const b = mixRgb(bottom, mixRgb(bottom, grey, 0.8), weatherGray);
  const topC = space ? '#02030a' : rgbToCss(t);
  const botC = space ? '#150b30' : rgbToCss(b);
  const night = 1 - daylight;
  const cover = WEATHER_CLOUDS[weather];
  const h = ((hour % 24) + 24) % 24;
  const isDay = h >= 5.5 && h <= 18.5;
  const ang = isDay ? (Math.PI * (h - 5.5)) / 13 : (Math.PI * (((h + 24 - 18.5) % 24) / 11));
  const bx = 800 - Math.cos(ang) * 700;
  const by = 600 - Math.sin(ang) * 460;
  const bodyOpacity = (1 - weatherGray) * 0.95;
  const cloudColor = rgbToCss(mixRgb(mixRgb([255, 255, 255], [18, 24, 48], night * 0.85), [70, 74, 88], weatherGray));

  return (
    <g>
      <defs>
        <linearGradient id="sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={GROUND}>
          <stop offset="0" stopColor={topC} />
          <stop offset="1" stopColor={botC} />
        </linearGradient>
      </defs>
      <rect x={-300} y={-200} width={W + 600} height={GROUND + 220} fill="url(#sky)" />
      {(space || night > 0.3) && (
        <g opacity={space ? 0.9 : Math.min(1, night * 1.2) * (1 - weatherGray)}>
          {stars.map(s => <circle key={s.i} cx={s.x} cy={s.y} r={s.r} fill="#fff" className="twinkle" style={{ animationDelay: `${-s.d}s` }} />)}
        </g>
      )}
      {!space && (
        <g opacity={bodyOpacity}>
          {isDay
            ? <g><circle cx={bx} cy={by} r={120} fill="#ffe9a0" opacity={0.18} /><circle cx={bx} cy={by} r={52} fill="#fff3b0" /></g>
            : <g><circle cx={bx} cy={by} r={90} fill="#cfe0ff" opacity={0.12} /><circle cx={bx} cy={by} r={38} fill="#eef3ff" /><circle cx={bx - 10} cy={by - 6} r={7} fill="#c9d3ea" opacity={0.7} /><circle cx={bx + 12} cy={by + 10} r={5} fill="#c9d3ea" opacity={0.7} /></g>}
        </g>
      )}
      {!space && clouds.map(c => c.i / clouds.length < cover && (
        <g key={c.i} className="drift" style={{ animationDuration: `${c.dur}s`, animationDelay: `${-c.i * 9}s` }}>
          <g transform={`translate(0 ${c.y}) scale(${c.s})`} fill={cloudColor} opacity={0.9}>
            <ellipse cx={0} cy={0} rx={90} ry={28} /><ellipse cx={-40} cy={-16} rx={44} ry={26} /><ellipse cx={30} cy={-24} rx={56} ry={32} />
          </g>
        </g>
      ))}
    </g>
  );
};

// ---------- Foreground weather ----------

export const WeatherLayer: React.FC<{ weather: Weather; t: number }> = ({ weather, t }) => {
  if (weather === 'rain' || weather === 'storm') {
    const n = weather === 'storm' ? 170 : 100;
    const slant = weather === 'storm' ? 26 : 14;
    let d = '';
    for (let i = 0; i < n; i++) {
      const sp = 800 + (i % 5) * 120;
      const x = ((hash01(i) * (W + 300) - t * slant * 5) % (W + 300) + (W + 300)) % (W + 300) - 100;
      const y = ((hash01(i + 99) * H + t * sp) % (H + 80)) - 40;
      d += `M${x.toFixed(0)} ${y.toFixed(0)}l${-slant * 0.6} ${slant * 1.6}`;
    }
    return <path d={d} stroke="#cfe6ff" strokeOpacity={0.45} strokeWidth={2} strokeLinecap="round" fill="none" />;
  }
  if (weather === 'snow') {
    return (
      <g fill="#fff" opacity={0.9}>
        {Array.from({ length: 90 }, (_, i) => {
          const x = (hash01(i) * W + Math.sin(t * 0.9 + i) * 30 + W) % W;
          const y = (hash01(i + 50) * H + t * (40 + (i % 4) * 22)) % H;
          return <circle key={i} cx={x} cy={y} r={1.8 + (i % 4)} />;
        })}
      </g>
    );
  }
  if (weather === 'ash') {
    return (
      <g>
        {Array.from({ length: 70 }, (_, i) => {
          const x = (hash01(i) * W + Math.sin(t * 0.7 + i) * 40 + W) % W;
          const y = (hash01(i + 50) * H + t * (30 + (i % 5) * 14)) % H;
          return <rect key={i} x={x} y={y} width={3 + (i % 3)} height={3 + (i % 3)} fill={i % 6 === 0 ? '#ff8a3d' : '#9a948c'} opacity={0.75} transform={`rotate(${t * 60 + i * 20} ${x} ${y})`} />;
        })}
      </g>
    );
  }
  if (weather === 'fog') {
    return (
      <g>
        <defs><radialGradient id="fogg"><stop offset="0" stopColor="#dfe6ee" stopOpacity={0.55} /><stop offset="1" stopColor="#dfe6ee" stopOpacity={0} /></radialGradient></defs>
        {[0, 1, 2, 3].map(i => <ellipse key={i} cx={(i * 480 + Math.sin(t * 0.12 + i * 2) * 160 + W) % (W + 400) - 100} cy={GROUND - 10 + (i % 2) * 90} rx={520} ry={130} fill="url(#fogg)" />)}
      </g>
    );
  }
  return null;
};

// ---------- Effects ----------

export const LightningLayer: React.FC<{ t: number; active: boolean }> = ({ t, active }) => {
  if (!active) return null;
  const period = 5;
  const idx = Math.floor(t / period);
  const onset = 0.4 + hash01(idx) * 3.2;
  const phase = (t % period) - onset;
  if (phase < 0 || phase > 0.45) return null;
  const alpha = Math.max(0, 1 - phase / 0.45) * (0.55 + 0.45 * Math.abs(Math.sin(phase * 40)));
  let x = 200 + hash01(idx + 3) * 1200;
  let y = 0;
  let d = `M${x.toFixed(0)} 0`;
  for (let k = 0; y < GROUND - 40; k++) {
    x += (hash01(idx * 7 + k) - 0.5) * 120;
    y += 60 + hash01(idx * 13 + k) * 50;
    d += ` L${x.toFixed(0)} ${y.toFixed(0)}`;
  }
  return (
    <g>
      <path d={d} stroke="#fff" strokeWidth={9} fill="none" opacity={alpha} strokeLinejoin="round" />
      <path d={d} stroke="#bcd7ff" strokeWidth={20} fill="none" opacity={alpha * 0.3} strokeLinejoin="round" />
      <rect x={-300} y={-200} width={W + 600} height={H + 400} fill="#fff" opacity={alpha * 0.45} />
    </g>
  );
};

export const Fireworks: React.FC<{ t: number }> = ({ t }) => {
  const PERIOD = 2.6;
  const COLORS = ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#c77dff'];
  return (
    <g strokeLinecap="round">
      {[0, 1, 2].map(i => {
        const tt = t + i * 0.9;
        const n = Math.floor(tt / PERIOD);
        const local = (tt % PERIOD) / PERIOD;
        const cx = 250 + hash01(n * 3 + i) * 1100;
        const cy = 110 + hash01(n * 5 + i + 9) * 260;
        const color = COLORS[(n + i) % COLORS.length];
        const ease = 1 - Math.pow(1 - local, 3);
        return (
          <g key={i} stroke={color} strokeWidth={4} opacity={Math.max(0, 1 - local * 1.1)}>
            {Array.from({ length: 18 }, (_, k) => {
              const a = (k / 18) * Math.PI * 2;
              const r0 = ease * 110;
              const r1 = ease * 160;
              return <line key={k} x1={cx + Math.cos(a) * r0} y1={cy + Math.sin(a) * r0 + local * 40} x2={cx + Math.cos(a) * r1} y2={cy + Math.sin(a) * r1 + local * 40} />;
            })}
          </g>
        );
      })}
    </g>
  );
};

export const Sparks: React.FC<{ t: number; x: number; y: number }> = ({ t, x, y }) => {
  const slice = Math.floor(t * 12);
  return (
    <g stroke="#ffe27a" strokeLinecap="round">
      {Array.from({ length: 12 }, (_, i) => {
        const a = hash01(slice * 17 + i) * Math.PI * 2;
        const r = 20 + hash01(slice * 5 + i + 3) * 90;
        const l = 8 + hash01(slice + i * 7) * 22;
        return <line key={i} x1={x + Math.cos(a) * r} y1={y + Math.sin(a) * r} x2={x + Math.cos(a) * (r + l)} y2={y + Math.sin(a) * (r + l)} strokeWidth={2 + (i % 3)} />;
      })}
    </g>
  );
};

export const Smoke: React.FC<{ xs: number[]; t: number }> = ({ xs, t }) => (
  <g fill="#2a2a30">
    {xs.flatMap((x, j) => Array.from({ length: 6 }, (_, i) => {
      const ph = (t * 0.3 + i / 6 + j * 0.17) % 1;
      return <circle key={`${j}-${i}`} cx={x + ph * 60 + Math.sin(t + i) * 8} cy={GROUND + 40 - ph * 360} r={20 + ph * 60} opacity={0.5 * (1 - ph)} />;
    }))}
  </g>
);

// Screen-space speed lines radiating from the centre.
export const SpeedLines: React.FC<{ t: number }> = ({ t }) => {
  const slice = Math.floor(t * 14);
  return (
    <g stroke="#fff" strokeLinecap="round" opacity={0.4}>
      {Array.from({ length: 26 }, (_, i) => {
        const a = (i / 26) * Math.PI * 2 + hash01(slice + i) * 0.1;
        const r0 = 480 + hash01(slice * 3 + i) * 200;
        const r1 = r0 + 160 + hash01(slice * 7 + i) * 220;
        return <line key={i} x1={W / 2 + Math.cos(a) * r0 * 1.5} y1={H / 2 + Math.sin(a) * r0} x2={W / 2 + Math.cos(a) * r1 * 1.5} y2={H / 2 + Math.sin(a) * r1} strokeWidth={2 + hash01(i + slice) * 5} />;
      })}
    </g>
  );
};
