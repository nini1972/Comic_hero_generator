/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import {
  ActorSpec, CameraSpec, EFFECTS, EMOTIONS, Effect, LOCATIONS, Location, MOODS, Mood, POSES, Pose, PROP_KINDS,
  PropKind, PropSpec, ROLES, Role, SceneSpec, StoryBeat, WEATHERS, Weather, WorldState
} from './types';
import { clamp, hashString, lerp } from './util';

// ---------- Keyword lexicon (the offline, instant "director") ----------

const LOCATION_WORDS: Record<Location, string[]> = {
  city: ['city', 'street', 'downtown', 'skyscraper', 'alley', 'traffic', 'avenue', 'plaza', 'metropolis'],
  rooftop: ['roof', 'rooftop', 'ledge', 'skyline'],
  countryside: ['farm', 'field', 'village', 'meadow', 'countryside', 'hill', 'barn', 'orchard'],
  forest: ['forest', 'woods', 'jungle', 'grove', 'thicket'],
  desert: ['desert', 'dune', 'sand', 'canyon', 'oasis'],
  ocean: ['ocean', 'sea', 'harbor', 'harbour', 'dock', 'ship', 'beach', 'wave', 'pier', 'coast'],
  space: ['space', 'orbit', 'asteroid', 'planet', 'galaxy', 'station', 'cosmic', 'nebula', 'starship'],
  interior: ['inside', 'room', 'lab', 'laboratory', 'hallway', 'vault', 'basement', 'office', 'warehouse', 'bunker', 'corridor', 'cellar'],
  wasteland: ['wasteland', 'ruins', 'apocalypse', 'rubble', 'ruined', 'barren', 'scorched']
};

const WEATHER_WORDS: Record<Weather, string[]> = {
  storm: ['storm', 'thunder', 'lightning', 'tempest', 'hurricane'],
  rain: ['rain', 'drizzle', 'downpour', 'rainy'],
  snow: ['snow', 'blizzard', 'frost', 'winter'],
  fog: ['fog', 'mist', 'haze', 'foggy'],
  ash: ['ash', 'volcano', 'cinder', 'fallout'],
  cloudy: ['cloud', 'overcast', 'grey sky', 'gray sky'],
  clear: ['clear sky', 'sunny', 'cloudless', 'starry']
};

// Specific times first so "dawn ... after the long night" resolves to dawn.
const TIME_WORDS: Array<[string[], number]> = [
  [['midnight', 'new year', "new year's"], 23.9],
  [['dawn', 'sunrise', 'daybreak', 'first light'], 6.2],
  [['dusk', 'sunset', 'twilight', 'golden hour'], 18.6],
  [['morning'], 9],
  [['noon', 'midday'], 12],
  [['afternoon'], 15],
  [['evening'], 20],
  [['dead of night', 'at night', 'night', 'moonlit', 'moonlight', 'after dark'], 23]
];

const POSITIVE_TENSION = ['explode', 'explosion', 'attack', 'scream', 'crash', 'collapse', 'danger', 'trap', 'chase', 'fight', 'gun', 'bomb', 'falling', 'destroy', 'panic', 'fire$', 'fires', 'flee', 'villain', 'threat', 'alarm', 'siren', 'ambush', 'battle', 'trembl', 'monster', 'deadly', 'hostage', 'blast'];
const NEGATIVE_TENSION = ['calm', 'quiet', 'peace', 'smile', 'laugh', 'celebrate', 'safe', 'rest', 'hug', 'relief', 'gentle', 'warm', 'cheer', 'rebuild', 'sunrise', 'victory'];
const DESTRUCTIVE = ['explode', 'explosion', 'crash', 'collapse', 'destroy', 'shatter', 'smash', 'blast', 'wreck', 'burn', 'quake', 'ruin'];
const REPAIR = ['rebuild', 'repair', 'restore', 'mend', 'heal'];

const MOOD_WORDS: Array<[Mood, string[]]> = [
  ['triumph', ['victory', 'triumph', 'defeated', 'saved the', 'won', 'prevail']],
  ['joy', ['laugh', 'party', 'celebrat', 'firework', 'cheer', 'joy', 'dance']],
  ['sorrow', ['cry', 'mourn', 'grief', 'farewell', 'lost', 'tearful', 'sorrow', 'goodbye']],
  ['mystery', ['strange', 'whisper', 'shadow', 'unknown', 'secret', 'clue', 'mysterious', 'eerie', 'unseen']]
];

const ROLE_WORDS: Record<'friend' | 'villain' | 'crowd', string[]> = {
  friend: ['friend', 'ally', 'sidekick', 'partner', 'companion', 'together', 'both', 'we ', 'team'],
  villain: ['villain', 'enemy', 'monster', 'boss', 'robot', 'creature', 'rival', 'thief', 'dragon', 'beast', 'alien', 'nemesis', 'intruder', 'attacker', 'stranger'],
  crowd: ['crowd', 'people', 'citizens', 'villagers', 'onlookers', 'bystanders', 'townsfolk', 'civilians']
};

// Order matters: on a tie the earlier pose wins, so an explicit fight beats incidental words like "collapse".
const POSE_WORDS: Array<[Pose, string[]]> = [
  ['fight', ['fight', 'punch', 'strike', 'battle', 'clash', 'duel', 'kick', 'slam', 'face ']],
  ['fly', ['fly', 'soar', 'leap', 'glide', 'airborne', 'swoop']],
  ['run', ['run', 'chase', 'dash', 'sprint', 'flee', 'race', 'rush']],
  ['fall', ['fall', 'plunge', 'drop', 'tumble', 'collapse']],
  ['cower', ['cower', 'hide', 'duck', 'cringe', 'tremble']],
  ['celebrate', ['celebrate', 'cheer', 'victory', 'triumph', 'dance', 'hooray']],
  ['point', ['point', 'gesture', 'notice', 'spot', 'discover', 'look', 'see ']]
];

const PROP_WORDS: Array<[PropKind, string[], boolean]> = [
  ['fire', ['fire$', 'fires', 'flame', 'burning', 'blaze', 'inferno'], true],
  ['crater', ['crater', 'impact', 'sinkhole'], true],
  ['debris', ['debris', 'rubble', 'wreckage', 'shatter', 'ruin'], true],
  ['car', ['car', 'vehicle', 'taxi', 'truck', 'van'], false],
  ['lamp', ['lamp', 'streetlight', 'lantern'], false],
  ['crate', ['crate', 'box', 'container', 'cargo'], false],
  ['tree', ['tree', 'oak', 'pine'], false],
  ['banner', ['banner', 'flag', 'sign', 'poster'], false],
  ['portal', ['portal', 'gateway', 'rift', 'vortex'], false],
  ['ufo', ['ufo', 'saucer', 'spacecraft', 'mothership'], false],
  ['boat', ['boat', 'canoe', 'sailboat', 'ferry'], false],
  ['rock', ['rock', 'boulder', 'stone'], false],
  ['campfire', ['campfire', 'bonfire'], false],
  ['door', ['door', 'gate', 'hatch'], false]
];

const EFFECT_WORDS: Array<[Effect, string[]]> = [
  ['lightning', ['lightning', 'thunder', 'storm']],
  ['sparks', ['explode', 'spark', 'electric', 'clash', 'short-circuit', 'weld']],
  ['fireworks', ['firework', 'new year', "new year's", 'midnight strikes']],
  ['speedlines', ['run', 'chase', 'fly', 'dash', 'speed', 'fall', 'rush', 'race']],
  ['shake', ['explode', 'crash', 'quake', 'collapse', 'slam', 'rumble']],
  ['flash', ['explode', 'flash', 'blast', 'blinding']],
  ['smoke', ['fire$', 'fires', 'smoke', 'burn', 'explo']]
];

const matcherCache = new Map<string, RegExp>();
// Word-start match so "ash" doesn't fire on "flash"; very short words must match whole (optionally plural).
// A trailing "$" forces a whole-word match ("fire$" skips "firework").
const matcher = (w: string): RegExp => {
  let re = matcherCache.get(w);
  if (!re) {
    const whole = w.endsWith('$');
    const word = whole ? w.slice(0, -1) : w;
    const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    re = new RegExp(whole ? `\\b${esc}\\b` : word.trim().length <= 3 ? `\\b${esc.trim()}(?:s|es)?\\b` : `\\b${esc}`);
    matcherCache.set(w, re);
  }
  return re;
};
const count = (text: string, words: string[]) => words.reduce((n, w) => n + (matcher(w).test(text) ? 1 : 0), 0);
const pickBest = <T extends string>(text: string, table: Record<T, string[]>): T | undefined => {
  let best: T | undefined;
  let bestScore = 0;
  (Object.keys(table) as T[]).forEach(k => {
    const s = count(text, table[k]);
    if (s > bestScore) { best = k; bestScore = s; }
  });
  return best;
};

// ---------- Hint sanitising (LLM output is never trusted blindly) ----------

const inList = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export const sanitizeHint = (raw: unknown): Partial<SceneSpec> => {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<SceneSpec> = {};

  if (inList(LOCATIONS, r.location)) out.location = r.location;
  if (inList(WEATHERS, r.weather)) out.weather = r.weather;
  if (inList(MOODS, r.mood)) out.mood = r.mood;
  const t = num(r.timeOfDay);
  if (t !== undefined) out.timeOfDay = ((t % 24) + 24) % 24;
  const tension = num(r.tension);
  if (tension !== undefined) out.tension = clamp(tension, 0, 1);
  if (Array.isArray(r.effects)) out.effects = r.effects.filter((e): e is Effect => inList(EFFECTS, e)).slice(0, 4);

  if (Array.isArray(r.actors)) {
    out.actors = r.actors.slice(0, 6).flatMap((a, i): ActorSpec[] => {
      if (!a || typeof a !== 'object') return [];
      const x = a as Record<string, unknown>;
      if (!inList(ROLES, x.role)) return [];
      return [{
        id: typeof x.id === 'string' ? x.id.slice(0, 20) : `${x.role}-${i}`,
        role: x.role,
        x: clamp(num(x.x) ?? 0.5, 0.05, 0.95),
        facing: x.facing === -1 ? -1 : 1,
        pose: inList(POSES, x.pose) ? x.pose : 'idle',
        emotion: inList(EMOTIONS, x.emotion) ? x.emotion : 'neutral',
        scale: clamp(num(x.scale) ?? 1, 0.6, 1.6)
      }];
    });
  }

  if (Array.isArray(r.props)) {
    out.props = r.props.slice(0, 8).flatMap((p, i): PropSpec[] => {
      if (!p || typeof p !== 'object') return [];
      const x = p as Record<string, unknown>;
      if (!inList(PROP_KINDS, x.kind)) return [];
      return [{
        id: typeof x.id === 'string' ? x.id.slice(0, 20) : `${x.kind}-${i}`,
        kind: x.kind,
        x: clamp(num(x.x) ?? 0.5, 0.02, 0.98),
        scale: clamp(num(x.scale) ?? 1, 0.5, 2),
        persist: x.persist === true
      }];
    });
  }
  return out;
};

// ---------- The director ----------

const defaultX = (role: Role, i: number, villainPresent = false): number =>
  role === 'hero' ? 0.36 : role === 'friend' ? 0.17 : role === 'villain' ? 0.82 : (villainPresent ? 0.58 : 0.62) + 0.09 * i;

const speakerId = (speaker: string, actors: ActorSpec[]): string => {
  const s = speaker.toLowerCase();
  const hit = actors.find(a => a.id.toLowerCase() === s || a.role === s);
  return hit ? hit.id : (actors.find(a => a.role === 'hero')?.id ?? actors[0]?.id ?? 'hero');
};

// Compose the next scene from the story beat and the evolving world.
// Heuristics always run first (instant, offline); a validated LLM hint then
// overrides whatever it explicitly specified.
export const composeScene = (beat: StoryBeat, world: WorldState): SceneSpec => {
  const text = `${beat.scene} ${beat.caption ?? ''} ${beat.dialogue?.text ?? ''}`.toLowerCase();
  const hint = sanitizeHint(beat.sceneHint);

  // Location: explicit words win, otherwise stay where we were.
  const location = hint.location ?? pickBest(text, LOCATION_WORDS) ?? world.location;

  // Time: named time, else the clock keeps running.
  let timeOfDay = world.timeOfDay + 0.4;
  for (const [words, hour] of TIME_WORDS) {
    if (count(text, words) > 0) { timeOfDay = hour; break; }
  }
  timeOfDay = (hint.timeOfDay ?? timeOfDay + 24) % 24;

  // Tension & mood.
  const pos = count(text, POSITIVE_TENSION);
  const neg = count(text, NEGATIVE_TENSION);
  const targetTension = clamp(0.25 + 0.17 * pos - 0.12 * neg + (count(text, ROLE_WORDS.villain) > 0 ? 0.2 : 0) + (count(text, WEATHER_WORDS.storm) > 0 ? 0.1 : 0), 0, 1);
  const tension = hint.tension ?? clamp(lerp(world.tension, targetTension, 0.6), 0, 1);
  let mood: Mood = tension > 0.75 ? 'danger' : tension > 0.45 ? 'tense' : 'calm';
  for (const [m, words] of MOOD_WORDS) {
    if (count(text, words) > 0 && !((m === 'mystery' || m === 'sorrow') && tension > 0.7)) { mood = m; break; }
  }
  mood = hint.mood ?? mood;

  // Weather: explicit, "the storm is gone" clears it, else it eases down as tension drops.
  const cleared = /\b(storm|rain|fog|snow|clouds?|ash)\b[^.]{0,12}\b(gone|passed|cleared|ended|stopped|lifted)\b/.test(text);
  let weather: Weather = hint.weather ?? (cleared ? 'clear' : pickBest(text, WEATHER_WORDS)) ?? world.weather;
  if (!hint.weather && !cleared && !pickBest(text, WEATHER_WORDS) && tension < 0.3) {
    weather = world.weather === 'storm' ? 'rain' : world.weather === 'rain' ? 'cloudy' : world.weather;
  }
  if (location === 'space') weather = 'clear';

  // Damage accumulates; repairs reduce it.
  const destroyed = Math.min(count(text, DESTRUCTIVE), 3);
  const repaired = count(text, REPAIR);
  const damage = clamp(world.damage + destroyed * 0.12 - repaired * 0.2, 0, 1);

  // Props carry over from the world (but belong to a place, so they stay behind when the story moves on);
  // new ones are added, extinguished/burnt-out/repaired ones removed.
  let props: PropSpec[] = location === world.location ? world.props.map(p => ({ ...p })) : [];
  if (/put out|extinguish|doused/.test(text)) props = props.filter(p => p.kind !== 'fire');
  if (tension < 0.4 && count(text, PROP_WORDS[0][1]) === 0) props = props.filter(p => p.kind !== 'fire');
  if (repaired > 0) props = props.filter(p => p.kind !== 'debris' && p.kind !== 'crater' && p.kind !== 'fire');
  const have = new Set(props.map(p => p.kind));
  const h = hashString(`${world.seed}:${world.beat}`);
  PROP_WORDS.forEach(([kind, words, persist], i) => {
    if (have.has(kind) || count(text, words) === 0 || props.length >= 7) return;
    props.push({ id: `${kind}-${world.beat}`, kind, x: 0.1 + (((h >> (i % 8)) & 15) / 15) * 0.8, scale: 0.8 + ((h >> i) & 3) * 0.15, persist });
    have.add(kind);
  });
  if (destroyed > 0 && !have.has('debris')) props.push({ id: `debris-${world.beat}`, kind: 'debris', x: 0.5 + ((h & 7) - 3) * 0.06, scale: 1, persist: true });
  if (hint.props) {
    hint.props.forEach(p => { if (!props.some(q => q.kind === p.kind) && props.length < 8) props.push(p); });
  }

  // Effects.
  let effects: Effect[] = EFFECT_WORDS.filter(([, words]) => count(text, words) > 0).map(([e]) => e);
  if (weather === 'storm' && !effects.includes('lightning')) effects.push('lightning');
  if (tension < 0.4 || cleared) effects = effects.filter(e => e !== 'speedlines' && !(cleared && e === 'lightning'));
  effects = hint.effects ?? effects;

  // Actors: cast persists, positions are laid out for the action.
  const wantFriend = count(text, ROLE_WORDS.friend) > 0 || world.actors.some(a => a.role === 'friend');
  const wantVillain = count(text, ROLE_WORDS.villain) > 0 || (world.tension > 0.6 && world.actors.some(a => a.role === 'villain') && !/escape|vanish|gone|retreat/.test(text));
  const wantCrowd = count(text, ROLE_WORDS.crowd) > 0;
  const heroPose = POSE_WORDS.find(([, words]) => count(text, words) > 0)?.[0] ?? 'idle';
  const fighting = heroPose === 'fight';

  const emotionFor = (role: Role) => {
    if (mood === 'joy' || mood === 'triumph') return 'happy' as const;
    if (mood === 'sorrow') return 'sad' as const;
    if (role === 'villain') return 'angry' as const;
    if (role === 'hero') return mood === 'danger' || mood === 'tense' ? ('determined' as const) : ('neutral' as const);
    return mood === 'danger' ? ('scared' as const) : ('neutral' as const);
  };

  const prev = (role: Role) => world.actors.find(a => a.role === role);
  const cast: ActorSpec[] = [{
    id: 'hero', role: 'hero', x: fighting && wantVillain ? 0.4 : defaultX('hero', 0), facing: 1,
    pose: heroPose, emotion: emotionFor('hero'), scale: prev('hero')?.scale ?? 1
  }];
  if (wantFriend) {
    const scared = mood === 'danger' && tension > 0.7;
    cast.push({
      id: 'friend', role: 'friend', x: defaultX('friend', 0), facing: 1,
      pose: scared ? 'cower' : heroPose === 'run' || heroPose === 'celebrate' ? heroPose : 'idle',
      emotion: emotionFor('friend'), scale: prev('friend')?.scale ?? 0.9
    });
  }
  if (wantVillain) {
    cast.push({
      id: 'villain', role: 'villain', x: fighting ? 0.53 : defaultX('villain', 0), facing: -1,
      pose: fighting || tension > 0.6 ? 'fight' : 'idle', emotion: 'angry', scale: prev('villain')?.scale ?? 1.15
    });
  }
  if (wantCrowd) {
    for (let i = 0; i < 3; i++) {
      cast.push({
        id: `crowd-${i}`, role: 'crowd', x: fighting && wantVillain ? 0.68 + 0.1 * i : defaultX('crowd', i, wantVillain), facing: -1,
        pose: mood === 'danger' ? 'cower' : mood === 'joy' || mood === 'triumph' ? 'celebrate' : 'idle',
        emotion: emotionFor('crowd'), scale: 0.7
      });
    }
  }
  let actors = cast;
  if (hint.actors && hint.actors.length > 0 && hint.actors.some(a => a.role === 'hero')) actors = hint.actors;

  // Camera follows the action.
  const hero = actors.find(a => a.role === 'hero') ?? actors[0];
  const foe = actors.find(a => a.role === 'villain');
  const focusX = fighting && foe && hero ? (hero.x + foe.x) / 2 : hero?.x ?? 0.5;
  const camera: CameraSpec = {
    x: clamp((focusX - 0.5) * 1.6, -1, 1),
    zoom: fighting ? 1.3 : tension > 0.7 ? 1.35 : mood === 'mystery' ? 1.18 : mood === 'triumph' ? 1.12 : 1,
    shake: effects.includes('shake') ? 0.7 : tension * 0.15
  };

  return {
    location, timeOfDay, weather, mood, tension, damage, camera, actors, props, effects,
    caption: beat.caption,
    speech: beat.dialogue ? { speaker: speakerId(beat.dialogue.speaker, actors), text: beat.dialogue.text } : undefined,
    // Same place keeps the same skyline: continuity comes from seeding by location.
    seed: hashString(`${world.seed}:${location}`)
  };
};
