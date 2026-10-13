/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { PropSpec } from '../types';
import { lit } from '../palette';
import { GROUND } from './Backdrop';

interface Props { prop: PropSpec; t: number; dl: number; gray: number; damage: number }

const Flames: React.FC<{ t: number; s: number; seed: number }> = ({ t, s, seed }) => (
  <g>
    <ellipse cx={0} cy={4} rx={46 * s} ry={9 * s} fill="#ff6a00" opacity={0.25} />
    {[0, 1, 2].map(i => {
      const f = 1 + Math.sin(t * (8 + i * 2) + seed + i) * 0.18;
      const w = (30 - i * 8) * s;
      const h = (90 - i * 22) * s * f;
      const col = ['#ff5a14', '#ffa51c', '#ffe27a'][i];
      return <path key={i} d={`M ${-w} 0 C ${-w} ${-h * 0.5}, ${-w * 0.2} ${-h * 0.7}, ${Math.sin(t * 6 + i) * 6} ${-h} C ${w * 0.3} ${-h * 0.6}, ${w} ${-h * 0.4}, ${w} 0 Z`} fill={col} />;
    })}
  </g>
);

export const PropView: React.FC<Props> = ({ prop, t, dl, gray, damage }) => {
  const x = 100 + prop.x * 1400;
  const s = prop.scale;
  const c = (hex: string) => lit(hex, dl, gray);
  const seed = prop.x * 10;
  const night = 1 - dl;

  let body: React.ReactNode = null;
  let y = GROUND + 70;

  switch (prop.kind) {
    case 'lamp':
      body = (
        <g>
          <rect x={-5} y={-230} width={10} height={230} fill={c('#2a2d36')} />
          <rect x={-5} y={-230} width={50} height={8} fill={c('#2a2d36')} />
          <ellipse cx={40} cy={-218} rx={14} ry={7} fill="#ffe9a8" />
          <polygon points="26,-214 54,-214 120,0 -40,0" fill="#fff0b0" opacity={0.18 * night + 0.02} />
        </g>
      );
      break;
    case 'car': {
      const wreck = damage > 0.4;
      body = (
        <g transform={wreck ? 'rotate(-8) translate(0 6)' : ''}>
          <rect x={-90} y={-46} width={180} height={34} rx={10} fill={c('#b3261e')} stroke="#111" strokeWidth={3} />
          <path d="M-52 -46 L-34 -84 L38 -84 L58 -46 Z" fill={c('#b3261e')} stroke="#111" strokeWidth={3} />
          <path d="M-42 -48 L-29 -78 L-2 -78 L-2 -48 Z M6 -48 L6 -78 L34 -78 L48 -48 Z" fill={wreck ? '#1a1a1a' : c('#9fd0ea')} />
          {[-52, 52].map(w => <g key={w}><circle cx={w} cy={-8} r={18} fill="#111" /><circle cx={w} cy={-8} r={8} fill="#999" /></g>)}
          <circle cx={88} cy={-34} r={5} fill="#fff7c0" opacity={0.6 + night * 0.4} />
        </g>
      );
      break;
    }
    case 'crate':
      body = (
        <g>
          <rect x={-40} y={-80} width={80} height={80} fill={c('#a97c4a')} stroke="#2a1b0c" strokeWidth={4} />
          <line x1={-40} y1={-80} x2={40} y2={0} stroke="#2a1b0c" strokeWidth={4} />
          <line x1={40} y1={-80} x2={-40} y2={0} stroke="#2a1b0c" strokeWidth={4} />
        </g>
      );
      break;
    case 'tree':
      body = (
        <g>
          <rect x={-12} y={-130} width={24} height={130} fill={c('#5b3a1e')} />
          <ellipse cx={0} cy={-170} rx={80} ry={72} fill={c('#2f7a3a')} stroke="#0b2410" strokeWidth={4} />
          <ellipse cx={-30} cy={-190} rx={36} ry={30} fill="#fff" opacity={0.08} />
        </g>
      );
      break;
    case 'fire':
      body = <Flames t={t} s={1.3} seed={seed} />;
      break;
    case 'campfire':
      body = (
        <g>
          <rect x={-40} y={-10} width={80} height={12} rx={5} fill="#3b2412" transform="rotate(-8)" />
          <rect x={-40} y={-10} width={80} height={12} rx={5} fill="#4a2e17" transform="rotate(8)" />
          <Flames t={t} s={0.7} seed={seed} />
        </g>
      );
      break;
    case 'crater':
      y = GROUND + 60;
      body = (
        <g>
          <ellipse cx={0} cy={0} rx={150} ry={26} fill="#1a120d" stroke="#3a2b20" strokeWidth={8} />
          <ellipse cx={0} cy={4} rx={110} ry={16} fill="#050302" />
          <ellipse cx={0} cy={2} rx={60} ry={8} fill="#ff6a00" opacity={0.35 + Math.sin(t * 4) * 0.1} />
        </g>
      );
      break;
    case 'debris':
      body = (
        <g>
          <polygon points="-90,0 -60,-50 -20,-30 10,-64 50,-26 90,0" fill={c('#4c5060')} stroke="#111" strokeWidth={3} />
          <polygon points="-30,0 -10,-24 30,-10 40,0" fill={c('#666b7c')} />
          <rect x={30} y={-60} width={6} height={50} fill={c('#2a2d36')} transform="rotate(25 30 -10)" />
        </g>
      );
      break;
    case 'banner':
      body = (
        <g>
          <rect x={-3} y={-210} width={6} height={210} fill={c('#2a2d36')} />
          <path d={`M3 -205 q 30 ${10 + Math.sin(t * 3) * 8} 60 0 t 60 0 l 0 60 q -30 ${-10 + Math.sin(t * 3 + 1) * 8} -60 0 t -60 0 Z`} fill={c('#e0b020')} stroke="#111" strokeWidth={3} />
        </g>
      );
      break;
    case 'portal':
      y = GROUND + 30;
      body = (
        <g transform="translate(0 -110)">
          <ellipse rx={74} ry={110} fill="#7c3aed" opacity={0.25 + 0.1 * Math.sin(t * 3)} />
          {[0, 1, 2].map(i => <ellipse key={i} rx={62 - i * 14} ry={96 - i * 18} fill="none" stroke={['#c4b5fd', '#8b5cf6', '#fff'][i]} strokeWidth={5 - i} strokeDasharray="22 14" strokeDashoffset={t * (30 + i * 20) * (i % 2 ? -1 : 1)} />)}
        </g>
      );
      break;
    case 'ufo':
      y = 240 + Math.sin(t * 1.5 + seed) * 12;
      body = (
        <g>
          <polygon points="-70,20 70,20 120,70 -120,70" fill="#fdf6a0" opacity={0.14} />
          <ellipse cx={0} cy={0} rx={30} ry={22} fill="#9fd0ea" stroke="#111" strokeWidth={3} />
          <ellipse cx={0} cy={14} rx={86} ry={20} fill={c('#7d869c')} stroke="#111" strokeWidth={4} />
          {[-52, -18, 18, 52].map(l => <circle key={l} cx={l} cy={14} r={5} fill="#ffe27a" opacity={0.6 + 0.4 * Math.sin(t * 5 + l)} />)}
        </g>
      );
      break;
    case 'boat':
      y = GROUND - 30 + Math.sin(t * 1.2 + seed) * 5;
      body = (
        <g>
          <polygon points="-100,-30 100,-30 70,10 -70,10" fill={c('#8c3b2a')} stroke="#111" strokeWidth={4} />
          <rect x={-3} y={-180} width={6} height={150} fill={c('#2a2d36')} />
          <polygon points="6,-176 80,-50 6,-50" fill={c('#f3ece0')} stroke="#111" strokeWidth={3} />
        </g>
      );
      break;
    case 'rock':
      body = (
        <g>
          <polygon points="-70,0 -50,-60 -10,-80 40,-62 72,0" fill={c('#6f6a60')} stroke="#111" strokeWidth={4} />
          <polygon points="-10,-80 40,-62 20,-30 -20,-40" fill="#fff" opacity={0.12} />
        </g>
      );
      break;
    case 'door':
      body = (
        <g>
          <rect x={-46} y={-170} width={92} height={170} fill={c('#2d2a33')} stroke="#111" strokeWidth={5} />
          <rect x={-34} y={-158} width={68} height={158} fill={c('#4d3b2b')} />
          <circle cx={20} cy={-80} r={5} fill="#e0b020" />
        </g>
      );
      break;
  }

  return <g transform={`translate(${x} ${y}) scale(${s})`}>{body}</g>;
};
