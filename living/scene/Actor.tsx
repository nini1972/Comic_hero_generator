/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { ActorSpec, Emotion, Pose, Role } from '../types';
import { lit } from '../palette';
import { GROUND } from './Backdrop';
import { hashString } from '../util';

const rad = (d: number) => (d * Math.PI) / 180;
const END = (x: number, y: number, len: number, deg: number): [number, number] => [x + Math.sin(rad(deg)) * len, y + Math.cos(rad(deg)) * len];

interface PoseVals { armF: number; armB: number; legF: number; legB: number; lean: number; lift: number; squash: number; dx: number }

// Angles are measured from "straight down"; positive swings toward the facing direction.
const poseAt = (pose: Pose, t: number, ph: number): PoseVals => {
  const s = Math.sin(t * 10 + ph);
  switch (pose) {
    case 'run': return { armF: 55 * s, armB: -55 * s, legF: -45 * s, legB: 45 * s, lean: 12, lift: Math.abs(s) * 8, squash: 1, dx: 0 };
    case 'fly': return { armF: 150, armB: 160, legF: -18 + Math.sin(t * 6 + ph) * 6, legB: -26, lean: 78, lift: 130 + Math.sin(t * 2 + ph) * 10, squash: 1, dx: 0 };
    case 'fight': return { armF: 95 + 55 * Math.max(0, Math.sin(t * 7 + ph)), armB: 40 + 20 * Math.sin(t * 7 + ph + 2), legF: 28, legB: -26, lean: 8, lift: 0, squash: 1, dx: 10 * Math.max(0, Math.sin(t * 7 + ph)) };
    case 'cower': return { armF: 165, armB: 150, legF: 40, legB: -10, lean: 28, lift: 0, squash: 0.78, dx: 0 };
    case 'point': return { armF: 98, armB: 8, legF: 6, legB: -6, lean: 3, lift: 0, squash: 1, dx: 0 };
    case 'celebrate': return { armF: 160 + 14 * Math.sin(t * 8 + ph), armB: 160 - 14 * Math.sin(t * 8 + ph), legF: 14, legB: -14, lean: 0, lift: Math.abs(Math.sin(t * 5 + ph)) * 26, squash: 1, dx: 0 };
    case 'fall': return { armF: 150 + 25 * Math.sin(t * 9 + ph), armB: 150 - 25 * Math.sin(t * 9 + ph), legF: 20 + 15 * s, legB: -20 - 15 * s, lean: 110 + 10 * Math.sin(t * 2 + ph), lift: 60, squash: 1, dx: 0 };
    default: return { armF: 8 + 3 * Math.sin(t * 2 + ph), armB: -8 - 3 * Math.sin(t * 2 + ph), legF: 4, legB: -4, lean: 0, lift: 0, squash: 1 + Math.sin(t * 2 + ph) * 0.012, dx: 0 };
  }
};

const Limb: React.FC<{ x1: number; y1: number; x2: number; y2: number; w: number; color: string; cap?: string }> = ({ x1, y1, x2, y2, w, color, cap }) => (
  <g strokeLinecap="round">
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0a0a0f" strokeWidth={w + 6} />
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} />
    {cap && <circle cx={x2} cy={y2} r={w * 0.62} fill={cap} stroke="#0a0a0f" strokeWidth={3} />}
  </g>
);

const PALETTE: Record<Exclude<Role, 'crowd'>, { suit: string; accent: string; hair: string }> = {
  hero: { suit: '#2563eb', accent: '#dc2626', hair: '#1d3a8a' },
  friend: { suit: '#16a34a', accent: '#fbbf24', hair: '#b45309' },
  villain: { suit: '#4c1d95', accent: '#111827', hair: '#111827' },
  other: { suit: '#6b7280', accent: '#9ca3af', hair: '#374151' }
};
const CROWD_COLORS = ['#b45309', '#0f766e', '#be185d', '#4338ca', '#65a30d', '#9a3412'];

const Face: React.FC<{ emotion: Emotion }> = ({ emotion }) => {
  const ink = '#111';
  const eyeL = 4;
  const eyeR = 18;
  const ey = -214;
  // [outer, inner] brow height offsets from the eye line.
  const brows: Record<Emotion, [number, number] | null> = {
    neutral: null, happy: null, scared: [-17, -17],
    angry: [-18, -9], determined: [-13, -11], sad: [-9, -17]
  };
  const b = brows[emotion];
  const open = emotion === 'scared';
  return (
    <g>
      {[eyeL, eyeR].map((ex, i) => (
        <g key={ex}>
          {emotion === 'happy'
            ? <path d={`M ${ex - 5} ${ey + 1} q 5 -8 10 0`} stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round" />
            : <><ellipse cx={ex} cy={ey} rx={open ? 6 : 5} ry={open ? 7 : 5} fill="#fff" stroke={ink} strokeWidth={2} /><circle cx={ex + 1.5} cy={ey} r={open ? 2 : 2.6} fill={ink} /></>}
          {b && <line x1={i === 0 ? ex - 6 : ex + 6} y1={ey + b[0]} x2={i === 0 ? ex + 6 : ex - 6} y2={ey + b[1]} stroke={ink} strokeWidth={4} strokeLinecap="round" />}
        </g>
      ))}
      {emotion === 'happy' && <path d="M 4 -200 q 8 12 18 0 z" fill="#fff" stroke={ink} strokeWidth={2.5} />}
      {emotion === 'scared' && <ellipse cx={12} cy={-198} rx={4} ry={6} fill="#400" stroke={ink} strokeWidth={2} />}
      {emotion === 'sad' && <path d="M 4 -196 q 8 -8 16 0" stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round" />}
      {emotion === 'angry' && <path d="M 4 -197 l 16 0" stroke={ink} strokeWidth={4} strokeLinecap="round" />}
      {(emotion === 'neutral' || emotion === 'determined') && <path d={emotion === 'determined' ? 'M 5 -197 l 14 1' : 'M 5 -197 q 7 4 14 0'} stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round" />}
    </g>
  );
};

interface ActorProps { actor: ActorSpec; x: number; alpha: number; moving: boolean; t: number; dl: number }

export const ActorView: React.FC<ActorProps> = ({ actor, x, alpha, moving, t, dl }) => {
  const ph = (hashString(actor.id) % 628) / 100;
  const pose: Pose = moving && actor.pose !== 'fly' && actor.pose !== 'fall' ? 'run' : actor.pose;
  const p = poseAt(pose, t, ph);
  const crowd = actor.role === 'crowd';
  const pal = crowd ? { suit: CROWD_COLORS[hashString(actor.id) % CROWD_COLORS.length], accent: '#e5e7eb', hair: '#2a1b0c' } : PALETTE[actor.role];
  const suit = lit(pal.suit, 0.35 + dl * 0.65);
  const accent = lit(pal.accent, 0.35 + dl * 0.65);
  const skin = lit('#f1c27d', 0.35 + dl * 0.65);

  const hip: [number, number] = [0, -110];
  const sh: [number, number] = [0, -178];
  const lf = END(hip[0], hip[1], 112, p.legF);
  const lb = END(hip[0], hip[1], 112, p.legB);
  const af = END(sh[0], sh[1], 84, p.armF);
  const ab = END(sh[0], sh[1], 84, p.armB);
  const flutter = Math.sin(t * 7 + ph) * (pose === 'run' || pose === 'fly' ? 20 : 5);
  const cape = actor.role === 'hero' || actor.role === 'villain';
  const y = GROUND + 60;

  return (
    <g transform={`translate(${x + p.dx * actor.facing} ${y}) scale(${actor.facing * actor.scale} ${actor.scale})`} opacity={alpha}>
      <ellipse cx={0} cy={4} rx={44 * (1 - p.lift / 400)} ry={9} fill="#000" opacity={0.3 * (1 - p.lift / 300)} />
      <g transform={`translate(0 ${-p.lift})`}>
        <g transform={`rotate(${p.lean} ${hip[0]} ${hip[1]}) translate(0 ${(1 - p.squash) * 110}) scale(1 ${p.squash})`}>
          {cape && <path d={`M -6 -182 C ${-30 - flutter} -170, ${-60 - flutter * 1.4} -120, ${-72 - flutter * 2} ${-60 + flutter * 0.6} L -8 -118 Z`} fill={accent} stroke="#0a0a0f" strokeWidth={4} />}
          <Limb x1={hip[0] - 8} y1={hip[1]} x2={lb[0] - 8} y2={lb[1]} w={20} color={actor.role === 'hero' ? lit('#1e40af', 0.35 + dl * 0.65) : suit} cap="#1a1a22" />
          <Limb x1={sh[0]} y1={sh[1]} x2={ab[0]} y2={ab[1]} w={15} color={suit} cap={skin} />
          <path d="M -24 -112 L -28 -182 Q 0 -198 28 -182 L 24 -112 Z" fill={suit} stroke="#0a0a0f" strokeWidth={4} strokeLinejoin="round" />
          <rect x={-25} y={-124} width={50} height={11} fill={actor.role === 'villain' ? '#a78bfa' : '#fbbf24'} stroke="#0a0a0f" strokeWidth={3} />
          {actor.role === 'hero' && <g><circle cx={4} cy={-158} r={13} fill="#fde047" stroke="#0a0a0f" strokeWidth={3} /><path d="M4 -167 l3 7 l7 0 l-6 4 l2 7 l-6 -4 l-6 4 l2 -7 l-6 -4 l7 0 z" fill="#dc2626" /></g>}
          <Limb x1={hip[0] + 8} y1={hip[1]} x2={lf[0] + 8} y2={lf[1]} w={20} color={suit} cap="#1a1a22" />
          <circle cx={4} cy={-212} r={26} fill={skin} stroke="#0a0a0f" strokeWidth={4} />
          {actor.role === 'hero' && <path d="M -21 -218 A 26 26 0 0 1 30 -222 L 30 -207 Q 4 -203 -21 -207 Z" fill={lit('#1e3a8a', 0.35 + dl * 0.65)} stroke="#0a0a0f" strokeWidth={3} />}
          {actor.role === 'friend' && <path d="M -22 -214 A 26 26 0 0 1 30 -216 Q 14 -232 -2 -226 Q -16 -224 -22 -214 Z" fill={lit(pal.hair, 0.35 + dl * 0.65)} stroke="#0a0a0f" strokeWidth={3} />}
          {actor.role === 'villain' && <path d="M -26 -210 A 29 29 0 0 1 34 -214 L 30 -228 L 22 -246 L 10 -232 L -6 -246 L -12 -230 Z" fill="#141022" stroke="#0a0a0f" strokeWidth={3} />}
          {(crowd || actor.role === 'other') && <path d="M -22 -214 A 26 26 0 0 1 30 -216 Q 4 -226 -22 -214 Z" fill={lit(pal.hair, 0.35 + dl * 0.65)} />}
          <Face emotion={actor.emotion} />
          <Limb x1={sh[0]} y1={sh[1]} x2={af[0]} y2={af[1]} w={15} color={suit} cap={skin} />
        </g>
      </g>
    </g>
  );
};
