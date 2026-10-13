/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { ActorSpec, SceneSpec, WorldState } from './types';

export const initialWorld = (seed = 1): WorldState => ({
  beat: 0,
  location: 'city',
  timeOfDay: 21,
  weather: 'clear',
  tension: 0.15,
  damage: 0,
  props: [],
  actors: [
    { id: 'hero', role: 'hero', x: 0.35, facing: 1, pose: 'idle', emotion: 'neutral', scale: 1 },
    { id: 'friend', role: 'friend', x: 0.18, facing: 1, pose: 'idle', emotion: 'neutral', scale: 0.9 }
  ],
  seed
});

// Fold a rendered scene back into the world so the next beat starts from it.
// Only `persist` props survive (a fire keeps burning, a crater stays), which is
// what makes consecutive scenes read as one continuous place.
export const advanceWorld = (world: WorldState, spec: SceneSpec): WorldState => ({
  beat: world.beat + 1,
  location: spec.location,
  timeOfDay: spec.timeOfDay,
  weather: spec.weather,
  tension: spec.tension,
  damage: spec.damage,
  props: spec.props.filter(p => p.persist),
  actors: spec.actors.filter(a => a.role !== 'crowd'),
  seed: world.seed
});
