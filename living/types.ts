/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Living Scenes: every comic "panel" is a small declarative SceneSpec that a
// deterministic renderer turns into an animated SVG scene. No images, no video.

export const LOCATIONS = ['city', 'rooftop', 'countryside', 'forest', 'desert', 'ocean', 'space', 'interior', 'wasteland'] as const;
export type Location = typeof LOCATIONS[number];

export const WEATHERS = ['clear', 'cloudy', 'rain', 'storm', 'snow', 'fog', 'ash'] as const;
export type Weather = typeof WEATHERS[number];

export const MOODS = ['calm', 'mystery', 'tense', 'danger', 'triumph', 'joy', 'sorrow'] as const;
export type Mood = typeof MOODS[number];

export const ROLES = ['hero', 'friend', 'villain', 'crowd', 'other'] as const;
export type Role = typeof ROLES[number];

export const POSES = ['idle', 'run', 'fly', 'fight', 'cower', 'point', 'celebrate', 'fall'] as const;
export type Pose = typeof POSES[number];

export const EMOTIONS = ['neutral', 'angry', 'scared', 'happy', 'determined', 'sad'] as const;
export type Emotion = typeof EMOTIONS[number];

export const PROP_KINDS = ['lamp', 'car', 'crate', 'tree', 'fire', 'crater', 'debris', 'banner', 'portal', 'ufo', 'boat', 'rock', 'campfire', 'door'] as const;
export type PropKind = typeof PROP_KINDS[number];

export const EFFECTS = ['lightning', 'sparks', 'fireworks', 'speedlines', 'shake', 'flash', 'smoke'] as const;
export type Effect = typeof EFFECTS[number];

export interface ActorSpec {
  id: string;
  role: Role;
  x: number;          // 0..1 across the stage
  facing: 1 | -1;
  pose: Pose;
  emotion: Emotion;
  scale: number;      // 0.6..1.6
}

export interface PropSpec {
  id: string;
  kind: PropKind;
  x: number;          // 0..1
  scale: number;
  persist: boolean;   // survives into following scenes until removed
}

export interface CameraSpec {
  x: number;          // -1..1 pan
  zoom: number;       // 1..2.2
  shake: number;      // 0..1
}

export interface Speech {
  speaker: string;    // actor id or role
  text: string;
}

export interface SceneSpec {
  location: Location;
  timeOfDay: number;  // 0..24
  weather: Weather;
  mood: Mood;
  tension: number;    // 0..1
  damage: number;     // 0..1, accumulated destruction of the setting
  camera: CameraSpec;
  actors: ActorSpec[];
  props: PropSpec[];
  effects: Effect[];
  caption?: string;
  speech?: Speech;
  seed: number;
}

// What the story source hands to the director for one beat.
export interface StoryBeat {
  caption?: string;
  dialogue?: Speech;
  scene: string;        // free-text description of what happens
  choices: string[];
  sceneHint?: unknown;  // optional (possibly messy) partial SceneSpec from an LLM
}

// Persistent world that evolves across beats, so scenes stay continuous.
export interface WorldState {
  beat: number;
  location: Location;
  timeOfDay: number;
  weather: Weather;
  tension: number;
  damage: number;
  props: PropSpec[];
  actors: ActorSpec[];
  seed: number;
}
