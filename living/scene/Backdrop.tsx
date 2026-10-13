/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useMemo } from 'react';
import { Location } from '../types';
import { lit } from '../palette';
import { mulberry32 } from '../util';

export const W = 1600;
export const H = 900;
export const GROUND = 690;
const X0 = -300;
const X1 = 1900;

type Rng = () => number;
interface Env { dl: number; gray: number; damage: number }
export interface Layers { far: React.ReactNode; mid: React.ReactNode; ground: React.ReactNode }

const ridge = (rng: Rng, baseY: number, amp: number, step: number, color: string) => {
  let d = `M ${X0} ${H}`;
  let y = baseY;
  for (let x = X0; x <= X1; x += step) {
    y = baseY + (rng() - 0.5) * amp * 2;
    d += ` L ${x} ${y.toFixed(1)}`;
  }
  return <path d={`${d} L ${X1} ${H} Z`} fill={color} />;
};

const buildings = (rng: Rng, baseY: number, minH: number, maxH: number, minW: number, maxW: number, color: string, env: Env, litProb: number) => {
  const els: React.ReactNode[] = [];
  let x = X0 + rng() * 30;
  let i = 0;
  while (x < X1) {
    const w = minW + rng() * (maxW - minW);
    const h = minH + rng() * (maxH - minH);
    const broken = rng() < env.damage * 0.9;
    const top = baseY - h;
    const pts = broken
      ? `${x},${baseY} ${x},${top + h * 0.12} ${x + w * 0.35},${top + h * 0.2} ${x + w * 0.5},${top + h * 0.02 + h * 0.3} ${x + w * 0.75},${top + h * 0.25} ${x + w},${top + h * 0.1} ${x + w},${baseY}`
      : `${x},${baseY} ${x},${top} ${x + w},${top} ${x + w},${baseY}`;
    let on = '';
    let off = '';
    let flick = '';
    const cols = Math.max(1, Math.floor((w - 8) / 18));
    const rows = Math.floor((h - 30) / 26);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = x + 8 + c * 18;
        const wy = top + 24 + r * 26;
        const roll = rng();
        const rect = `M${wx.toFixed(0)} ${wy.toFixed(0)}h8v12h-8z`;
        if (roll < litProb * (1 - env.damage * 0.6)) { if (roll < litProb * 0.12) flick += rect; else on += rect; }
        else off += rect;
      }
    }
    els.push(
      <g key={i++}>
        <polygon points={pts} fill={color} />
        {off && <path d={off} fill={lit('#18203a', env.dl, env.gray)} opacity={0.8} />}
        {on && <path d={on} fill="#ffd27a" opacity={0.9 * (1 - env.dl * 0.8)} />}
        {flick && <g opacity={0.9 * (1 - env.dl * 0.8)}><path d={flick} fill="#ffe9a8" className="flicker" /></g>}
        {broken && <path d={`M${x + w * 0.3} ${top + h * 0.25} l8 30 l-6 22 l10 28`} stroke="#0008" strokeWidth={2} fill="none" />}
      </g>
    );
    x += w + rng() * 6;
  }
  return els;
};

const conifers = (rng: Rng, baseY: number, size: number, color: string, density: number) => {
  const els: React.ReactNode[] = [];
  for (let x = X0, i = 0; x < X1; x += density * (0.7 + rng() * 0.6), i++) {
    const s = size * (0.7 + rng() * 0.6);
    els.push(
      <g key={i} transform={`translate(${x.toFixed(0)} ${baseY})`}>
        <polygon points={`0,${-s * 1.0} ${-s * 0.28},${-s * 0.55} ${s * 0.28},${-s * 0.55}`} fill={color} />
        <polygon points={`0,${-s * 0.75} ${-s * 0.38},${-s * 0.25} ${s * 0.38},${-s * 0.25}`} fill={color} />
        <polygon points={`0,${-s * 0.45} ${-s * 0.5},0 ${s * 0.5},0`} fill={color} />
      </g>
    );
  }
  return els;
};

const cracks = (rng: Rng, damage: number) => {
  const n = Math.round(damage * 16);
  const els: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    let x = X0 + rng() * (X1 - X0);
    let y = GROUND + 6 + rng() * 40;
    let d = `M${x.toFixed(0)} ${y.toFixed(0)}`;
    for (let k = 0; k < 4; k++) { x += (rng() - 0.4) * 50; y += 10 + rng() * 25; d += ` L${x.toFixed(0)} ${y.toFixed(0)}`; }
    els.push(<path key={i} d={d} stroke="#000" strokeOpacity={0.55} strokeWidth={2 + rng() * 2} fill="none" />);
  }
  return els;
};

const ground = (color: string, texture: string, rng: Rng, damage: number, top = GROUND) => (
  <g>
    <rect x={X0} y={top} width={X1 - X0} height={H - top + 40} fill={color} />
    <rect x={X0} y={top} width={X1 - X0} height={5} fill="#000" opacity={0.25} />
    {Array.from({ length: 26 }, (_, i) => {
      const x = X0 + rng() * (X1 - X0);
      const y = top + 14 + rng() * (H - top - 14);
      return <line key={i} x1={x} y1={y} x2={x + 30 + rng() * 60} y2={y} stroke={texture} strokeOpacity={0.35} strokeWidth={3} strokeLinecap="round" />;
    })}
    {cracks(rng, damage)}
  </g>
);

const build = (location: Location, seed: number, env: Env): Layers => {
  const rng = mulberry32(seed);
  const { dl, gray, damage } = env;
  const c = (hex: string) => lit(hex, dl, gray);

  switch (location) {
    case 'city':
      return {
        far: <g>{buildings(rng, GROUND - 10, 150, 330, 40, 90, c('#3a4a6b'), env, 0.35)}</g>,
        mid: <g>{buildings(rng, GROUND, 200, 430, 60, 120, c('#26324d'), env, 0.5)}</g>,
        ground: (
          <g>
            {ground(c('#2b2f3a'), c('#000'), rng, damage)}
            <rect x={X0} y={GROUND} width={X1 - X0} height={22} fill={c('#59606e')} />
            {Array.from({ length: 14 }, (_, i) => <rect key={i} x={X0 + i * 160} y={GROUND + 120} width={80} height={8} fill={c('#d8d4a0')} opacity={0.7} />)}
          </g>
        )
      };
    case 'rooftop': {
      const tankX = 200 + rng() * 1000;
      return {
        far: <g transform="translate(0 110)">{buildings(rng, GROUND, 150, 330, 40, 90, c('#3a4a6b'), env, 0.35)}</g>,
        mid: <g transform="translate(0 170)">{buildings(rng, GROUND, 200, 430, 60, 120, c('#26324d'), env, 0.5)}</g>,
        ground: (
          <g>
            {ground(c('#3b3f4a'), c('#000'), rng, damage)}
            <rect x={X0} y={GROUND - 26} width={X1 - X0} height={30} fill={c('#4a4f5d')} />
            <rect x={X0} y={GROUND - 30} width={X1 - X0} height={6} fill={c('#6b7080')} />
            <g transform={`translate(${tankX} ${GROUND - 26})`}>
              <rect x={-4} y={-150} width={8} height={150} fill={c('#2a2d36')} />
              <rect x={-60} y={-190} width={120} height={90} rx={12} fill={c('#5a4f45')} />
              <line x1={-50} y1={-190} x2={50} y2={-100} stroke="#0006" strokeWidth={4} />
            </g>
            <g transform={`translate(${(tankX + 700) % 1500} ${GROUND - 26})`}>
              <rect x={-3} y={-210} width={6} height={210} fill={c('#2a2d36')} />
              <circle cx={0} cy={-216} r={7} fill="#ff4040" className="flicker" />
            </g>
          </g>
        )
      };
    }
    case 'countryside': {
      const barnX = 150 + rng() * 500;
      const millX = 1000 + rng() * 400;
      return {
        far: <g>{ridge(rng, 500, 28, 110, c('#5a7d9a'))}</g>,
        mid: (
          <g>
            {ridge(rng, 590, 24, 130, c('#4a8548'))}
            <g transform={`translate(${barnX} ${GROUND - 20})`}>
              <rect x={0} y={-90} width={140} height={90} fill={c('#a3362b')} />
              <polygon points="-10,-90 70,-150 150,-90" fill={c('#6e231c')} />
              <rect x={50} y={-55} width={40} height={55} fill={c('#f3e6d0')} />
            </g>
            <g transform={`translate(${millX} ${GROUND - 20})`}>
              <polygon points="-22,0 22,0 12,-170 -12,-170" fill={c('#e4dccb')} />
              <g transform="translate(0 -170)"><g className="spin">
                {[0, 90, 180, 270].map(a => <rect key={a} x={-5} y={-110} width={10} height={110} fill={c('#d0c6b0')} transform={`rotate(${a})`} />)}
              </g></g>
            </g>
          </g>
        ),
        ground: (
          <g>
            {ground(c('#3d7a35'), c('#a6d66a'), rng, damage)}
            {Array.from({ length: 30 }, (_, i) => <g key={i} transform={`translate(${X0 + i * 75} ${GROUND + 6})`}><rect x={0} y={-34} width={6} height={50} fill={c('#8b6b3d')} /><rect x={-20} y={-22} width={46} height={5} fill={c('#8b6b3d')} /></g>)}
          </g>
        )
      };
    }
    case 'forest':
      return {
        far: <g>{ridge(rng, 470, 30, 100, c('#264b4f'))}{conifers(rng, 560, 200, c('#1d4040'), 70)}</g>,
        mid: <g>{conifers(rng, 650, 300, c('#1a3a2e'), 90)}</g>,
        ground: (
          <g>
            {ground(c('#254a2a'), c('#6bbf59'), rng, damage)}
            {Array.from({ length: 5 }, (_, i) => <rect key={i} x={X0 + 120 + i * 480 + rng() * 120} y={0} width={46 + rng() * 20} height={GROUND + 30} fill={c('#2b1d12')} opacity={0.95} />)}
          </g>
        )
      };
    case 'desert':
      return {
        far: <g>{ridge(rng, 520, 26, 160, c('#d9a066'))}</g>,
        mid: <g>{ridge(rng, 610, 34, 200, c('#c98a4f'))}{Array.from({ length: 5 }, (_, i) => {
          const x = 100 + rng() * 1400;
          return <g key={i} transform={`translate(${x} ${GROUND - 10})`}><rect x={-9} y={-90} width={18} height={90} rx={9} fill={c('#4f7a3a')} /><rect x={-34} y={-62} width={30} height={12} rx={6} fill={c('#4f7a3a')} /><rect x={-34} y={-84} width={12} height={30} rx={6} fill={c('#4f7a3a')} /></g>;
        })}</g>,
        ground: <g>{ground(c('#e0b072'), c('#fff0c8'), rng, damage)}</g>
      };
    case 'ocean':
      return {
        far: (
          <g>
            <rect x={X0} y={520} width={X1 - X0} height={200} fill={c('#2b6f9f')} />
            <g transform="translate(1100 505)"><polygon points="0,15 90,15 70,0 20,0" fill={c('#222a3a')} /><rect x={30} y={-22} width={30} height={22} fill={c('#2c3446')} /></g>
          </g>
        ),
        mid: (
          <g>
            <rect x={X0} y={600} width={X1 - X0} height={140} fill={c('#1e5f90')} />
            <g className="waves">
              {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${X0 + i * 260} ${620 + (i % 3) * 30} q 30 -18 60 0 t 60 0 t 60 0`} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={4} fill="none" />)}
            </g>
          </g>
        ),
        ground: (
          <g>
            <rect x={X0} y={GROUND} width={X1 - X0} height={H - GROUND + 40} fill={c('#6b4b2e')} />
            {Array.from({ length: 22 }, (_, i) => <line key={i} x1={X0 + i * 100} y1={GROUND} x2={X0 + i * 100 - 40} y2={H + 40} stroke="#000" strokeOpacity={0.35} strokeWidth={4} />)}
            {Array.from({ length: 8 }, (_, i) => <rect key={i} x={X0 + 60 + i * 280} y={GROUND - 40} width={16} height={60} fill={c('#3b2a19')} />)}
            {cracks(rng, damage)}
          </g>
        )
      };
    case 'space':
      return {
        far: (
          <g>
            <circle cx={1150} cy={330} r={230} fill={c('#7a4fa8')} opacity={0.95} />
            <circle cx={1090} cy={290} r={190} fill="#fff" opacity={0.08} />
            <ellipse cx={1150} cy={330} rx={360} ry={60} fill="none" stroke="#e5c8ff" strokeOpacity={0.5} strokeWidth={10} transform="rotate(-14 1150 330)" />
            <circle cx={330} cy={200} r={60} fill={c('#b9b4c9')} />
          </g>
        ),
        mid: <g>{Array.from({ length: 7 }, (_, i) => <g key={i} transform={`translate(${X0 + 150 + i * 280 + rng() * 80} ${300 + rng() * 260}) scale(${1 + rng() * 1.8})`}><polygon className="floaty" style={{ animationDelay: `${-i * 0.9}s` }} points="0,-26 22,-14 28,12 4,28 -24,16 -26,-10" fill={c('#6b6478')} /></g>)}</g>,
        ground: (
          <g>
            {ground('#2c2a38', '#8b86a0', rng, damage)}
            {Array.from({ length: 8 }, (_, i) => <ellipse key={i} cx={X0 + 100 + i * 270 + rng() * 80} cy={GROUND + 60 + rng() * 120} rx={50 + rng() * 40} ry={14 + rng() * 8} fill="#000" opacity={0.3} />)}
          </g>
        )
      };
    case 'interior':
      return {
        far: (
          <g>
            <rect x={X0} y={0} width={X1 - X0} height={GROUND + 10} fill={c('#2a3550')} />
            {Array.from({ length: 15 }, (_, i) => <rect key={i} x={X0 + i * 150} y={0} width={4} height={GROUND} fill="#000" opacity={0.25} />)}
            <rect x={620} y={150} width={360} height={260} fill="url(#sky)" stroke="#0b0f1c" strokeWidth={14} />
            <line x1={800} y1={150} x2={800} y2={410} stroke="#0b0f1c" strokeWidth={8} />
            <line x1={620} y1={280} x2={980} y2={280} stroke="#0b0f1c" strokeWidth={8} />
          </g>
        ),
        mid: (
          <g>
            <rect x={X0} y={70} width={X1 - X0} height={26} fill="#1b2236" />
            {Array.from({ length: 5 }, (_, i) => {
              const x = 120 + i * 360;
              return <g key={i}><line x1={x} y1={96} x2={x} y2={170} stroke="#0b0f1c" strokeWidth={4} /><polygon points={`${x - 30},170 ${x + 30},170 ${x + 18},196 ${x - 18},196`} fill="#cfd6e8" /><g opacity={0.18}><ellipse cx={x} cy={200} rx={60} ry={14} fill="#fff6c8" className="flicker" /></g></g>;
            })}
          </g>
        ),
        ground: (
          <g>
            <rect x={X0} y={GROUND} width={X1 - X0} height={H - GROUND + 40} fill="#3a4358" />
            {Array.from({ length: 22 }, (_, i) => <line key={i} x1={X0 + i * 110} y1={GROUND} x2={X0 + i * 110 - (i - 10) * 90} y2={H + 40} stroke="#000" strokeOpacity={0.25} strokeWidth={3} />)}
            {cracks(rng, damage)}
          </g>
        )
      };
    case 'wasteland':
    default:
      return {
        far: <g>{buildings(rng, GROUND - 20, 120, 300, 40, 90, c('#4a3a38'), { ...env, damage: 0.95 }, 0.02)}</g>,
        mid: (
          <g>
            {ridge(rng, 600, 30, 140, c('#3a2d2a'))}
            {Array.from({ length: 6 }, (_, i) => {
              const x = rng() * 1500;
              return <g key={i} transform={`translate(${x} ${GROUND - 10}) rotate(${(rng() - 0.5) * 20})`}><rect x={-6} y={-200} width={12} height={200} fill={c('#2a2220')} /><line x1={-50} y1={-190} x2={50} y2={-170} stroke={c('#2a2220')} strokeWidth={8} /></g>;
            })}
          </g>
        ),
        ground: <g>{ground(c('#5a4636'), c('#2a1f18'), rng, Math.max(damage, 0.5))}</g>
      };
  }
};

export const useScenery = (location: Location, seed: number, dl: number, gray: number, damage: number): Layers => {
  // Quantised so the heavy geometry only rebuilds when the look visibly changes.
  const qdl = Math.round(dl * 40) / 40;
  const qg = Math.round(gray * 20) / 20;
  const qd = Math.round(damage * 10) / 10;
  return useMemo(() => build(location, seed, { dl: qdl, gray: qg, damage: qd }), [location, seed, qdl, qg, qd]);
};
