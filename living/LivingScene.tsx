/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState } from 'react';
import { ActorSpec, Location, SceneSpec, Weather } from './types';
import { MOOD_TINT, WEATHER_GRAY, skyAt } from './palette';
import { RGB, clamp, lerp, lerpHour, rgbToCss } from './util';
import { GROUND, H, W, useScenery } from './scene/Backdrop';
import { PropView } from './scene/Props';
import { ActorView } from './scene/Actor';
import { Fireworks, LightningLayer, Smoke, Sky, SpeedLines, Sparks, WeatherLayer } from './scene/Weather';

const PAN = 150;

interface ActorState { spec: ActorSpec; x: number; alpha: number; leaving: boolean }
interface View {
  t: number; age: number; hour: number; tension: number; damage: number;
  camX: number; zoom: number; gray: number; tint: RGB; tintA: number;
  loc: Location; seed: number; prevLoc: Location | null; prevSeed: number; fade: number;
  weather: Weather; wFade: number; actors: ActorState[];
}

const initView = (s: SceneSpec): View => {
  const tint = MOOD_TINT[s.mood];
  return {
    t: 0, age: 0, hour: s.timeOfDay, tension: s.tension, damage: s.damage, camX: s.camera.x, zoom: s.camera.zoom,
    gray: s.location === 'space' ? 0 : WEATHER_GRAY[s.weather], tint: tint.color, tintA: tint.alpha,
    loc: s.location, seed: s.seed, prevLoc: null, prevSeed: 0, fade: 1, weather: s.weather, wFade: 1,
    actors: s.actors.map(a => ({ spec: a, x: a.x, alpha: 1, leaving: false }))
  };
};

interface Props { spec: SceneSpec }

export const LivingScene: React.FC<Props> = ({ spec }) => {
  const specRef = useRef(spec);
  specRef.current = spec;
  const st = useRef<{ view: View; spec: SceneSpec }>({ view: initView(spec), spec });
  const [view, setView] = useState<View>(st.current.view);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      if (acc < 1 / 32) return;
      const step = acc;
      acc = 0;

      const s = specRef.current;
      const v = st.current.view;
      const k = 1 - Math.exp(-step * 2.2);
      const kActor = 1 - Math.exp(-step * 2.6);

      // A new spec arrived: start the transition bookkeeping.
      if (s !== st.current.spec) {
        st.current.spec = s;
        v.age = 0;
        if (s.location !== v.loc || s.seed !== v.seed) { v.prevLoc = v.loc; v.prevSeed = v.seed; v.loc = s.location; v.seed = s.seed; v.fade = 0; }
        if (s.weather !== v.weather) { v.weather = s.weather; v.wFade = 0; }
      }

      const tint = MOOD_TINT[s.mood];
      v.t += step;
      v.age += step;
      v.hour = lerpHour(v.hour, s.timeOfDay, k);
      v.tension = lerp(v.tension, s.tension, k);
      v.damage = lerp(v.damage, s.damage, k);
      v.camX = lerp(v.camX, s.camera.x, k);
      v.zoom = lerp(v.zoom, s.camera.zoom, k);
      v.gray = lerp(v.gray, s.location === 'space' ? 0 : WEATHER_GRAY[s.weather], k);
      v.tint = [lerp(v.tint[0], tint.color[0], k), lerp(v.tint[1], tint.color[1], k), lerp(v.tint[2], tint.color[2], k)];
      v.tintA = lerp(v.tintA, tint.alpha + s.tension * 0.08, k);
      v.fade = Math.min(1, v.fade + step / 1.1);
      v.wFade = Math.min(1, v.wFade + step / 1.5);
      if (v.fade >= 1) v.prevLoc = null;

      // Actors glide to their marks; newcomers walk in from the edge, leavers walk off.
      const byId = new Map<string, ActorState>(v.actors.map(a => [a.spec.id, a] as [string, ActorState]));
      const next: ActorState[] = s.actors.map(a => {
        const cur = byId.get(a.id);
        if (!cur) return { spec: a, x: a.x < 0.5 ? -0.12 : 1.12, alpha: 0, leaving: false };
        return { spec: a, x: lerp(cur.x, a.x, kActor), alpha: Math.min(1, cur.alpha + step * 2), leaving: false };
      });
      v.actors.forEach(a => {
        if (s.actors.some(n => n.id === a.spec.id)) return;
        const alpha = a.alpha - step * 1.4;
        if (alpha > 0.02) next.push({ spec: a.spec, x: a.x + (a.x < 0.5 ? -1 : 1) * step * 0.35, alpha, leaving: true });
      });
      v.actors = next;

      setView({ ...v });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const v = view;
  const interior = v.loc === 'interior';
  const space = v.loc === 'space';
  const sky = skyAt(v.hour);
  const dl = interior ? 0.6 : space ? 0 : sky.daylight;
  const gray = interior ? 0 : v.gray;
  const cur = useScenery(v.loc, v.seed, dl, gray, v.damage);
  const prev = useScenery(v.prevLoc ?? v.loc, v.prevSeed, dl, gray, v.damage);

  const shake = clamp(spec.camera.shake + (spec.effects.includes('shake') ? 0.3 : 0), 0, 1);
  const sx = Math.sin(v.t * 47) * shake * 7;
  const sy = Math.cos(v.t * 53) * shake * 7;
  const pan = (depth: number) => `translate(${-v.camX * PAN * depth} 0)`;

  const hero = v.actors.find(a => a.spec.role === 'hero');
  const foe = v.actors.find(a => a.spec.role === 'villain');
  const sparkX = (hero && foe ? (hero.x + foe.x) / 2 : hero?.x ?? 0.5) * 1400 + 100;
  const fires = spec.props.filter(p => p.kind === 'fire' || p.kind === 'crater' || p.kind === 'campfire').map(p => 100 + p.x * 1400);
  const smokeXs = spec.effects.includes('smoke') ? (fires.length ? fires : v.damage > 0.5 ? [800] : []) : [];

  const actors = [...v.actors].sort((a, b) => (a.spec.role === 'crowd' ? -1 : 0) - (b.spec.role === 'crowd' ? -1 : 0) || a.spec.scale - b.spec.scale);
  const speaker = spec.speech ? v.actors.find(a => a.spec.id === spec.speech!.speaker) : undefined;
  const bubbleLeft = clamp(((speaker?.x ?? 0.4) * 1400 + 100 - PAN * v.camX - W / 2) * v.zoom / W + 0.5, 0.2, 0.8) * 100;
  const chars = Math.floor(v.age * 38);

  return (
    <div className="ls-root">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="ls-svg">
        <g transform={`translate(${W / 2 + sx} ${GROUND - 40 + sy}) scale(${v.zoom}) translate(${-W / 2} ${-(GROUND - 40)})`}>
          <Sky top={sky.top} bottom={sky.bottom} daylight={sky.daylight} hour={v.hour} weatherGray={gray} weather={v.weather} space={space} />
          {spec.effects.includes('fireworks') && <Fireworks t={v.t} />}
          {v.prevLoc && (
            <g>
              <g transform={pan(0.15)}>{prev.far}</g><g transform={pan(0.4)}>{prev.mid}</g><g transform={pan(1)}>{prev.ground}</g>
            </g>
          )}
          <g opacity={v.fade}>
            <g transform={pan(0.15)}>{cur.far}</g>
            <g transform={pan(0.4)}>{cur.mid}</g>
            <g transform={pan(1)}>{cur.ground}</g>
          </g>
          <g transform={pan(1)}>
            {spec.props.map(p => <PropView key={p.id} prop={p} t={v.t} dl={dl} gray={gray} damage={v.damage} />)}
            {smokeXs.length > 0 && <Smoke xs={smokeXs} t={v.t} />}
            {actors.map(a => (
              <ActorView key={a.spec.id} actor={a.spec} x={100 + a.x * 1400} alpha={a.alpha} moving={Math.abs(a.spec.x - a.x) > 0.03 || a.leaving} t={v.t} dl={dl} />
            ))}
            {spec.effects.includes('sparks') && <Sparks t={v.t} x={sparkX} y={GROUND - 120} />}
          </g>
          <g opacity={v.wFade}>
            {!interior && <WeatherLayer weather={v.weather} t={v.t} />}
          </g>
          {!interior && <LightningLayer t={v.t} active={v.weather === 'storm' || spec.effects.includes('lightning')} />}
        </g>

        {spec.effects.includes('speedlines') && <SpeedLines t={v.t} />}
        <rect width={W} height={H} fill={rgbToCss(v.tint)} opacity={v.tintA} />
        <defs>
          <radialGradient id="vig" cx="50%" cy="50%" r="75%">
            <stop offset="55%" stopColor="#000" stopOpacity={0} />
            <stop offset="100%" stopColor="#000" stopOpacity={0.45 + v.tension * 0.3} />
          </radialGradient>
          <pattern id="dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.6" fill="#000" /></pattern>
          <linearGradient id="dotfade" x1="0" y1="1" x2="0.6" y2="0.4"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#000" /></linearGradient>
          <mask id="dotmask"><rect width={W} height={H} fill="url(#dotfade)" /></mask>
        </defs>
        <rect width={W} height={H} fill="url(#dots)" mask="url(#dotmask)" opacity={0.14} />
        <rect width={W} height={H} fill="url(#vig)" />
        {spec.effects.includes('flash') && <rect width={W} height={H} fill="#fff" opacity={Math.max(0, 0.9 - v.age * 3)} />}
      </svg>

      {spec.caption && <div className="ls-caption">{spec.caption.slice(0, chars)}</div>}
      {spec.speech && chars > 8 && (
        <div className="ls-bubble" style={{ left: `${bubbleLeft}%` }}>
          {spec.speech.text.slice(0, Math.max(0, chars - 8))}
        </div>
      )}
    </div>
  );
};
