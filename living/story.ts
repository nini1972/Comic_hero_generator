/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from '@google/genai';
import { StoryBeat, WorldState } from './types';

// A story source only produces *text beats*. Turning them into a scene is the
// director's job, so any source (hand-authored graph, LLM, ...) can drive the
// same living world.
export interface StorySource {
  readonly name: string;
  start(premise: string, world: WorldState): Promise<StoryBeat>;
  next(choice: string, history: StoryBeat[], world: WorldState): Promise<StoryBeat>;
}

// ---------- Offline: a small branching story that needs no API key ----------

interface Node { beat: StoryBeat; to: string[] }

const NODES: Record<string, Node> = {
  start: {
    beat: {
      caption: 'Midnight in Port Meridian. Rain hammers the rooftops.',
      dialogue: { speaker: 'friend', text: 'Power readings just spiked at Helix Tower. Something is waking up.' },
      scene: 'Night on a city rooftop in the rain. The hero and a friend watch the glowing tower across the skyline.',
      choices: ['Storm in through the front doors', 'Glide down onto the tower roof'],
      sceneHint: { location: 'rooftop', timeOfDay: 23, weather: 'rain', mood: 'mystery', tension: 0.3 }
    },
    to: ['lobby', 'roof']
  },
  lobby: {
    beat: {
      caption: 'The lobby erupts in sirens.',
      dialogue: { speaker: 'hero', text: 'Stay behind me!' },
      scene: 'Inside the tower lobby, alarm sirens flash. A security robot attacks, sparks scatter as the hero and friend run for cover.',
      choices: ['Fight the robot head-on', 'Sneak past toward the vault']
    },
    to: ['clash', 'vault']
  },
  roof: {
    beat: {
      caption: 'Thunder rolls as the hero lands.',
      dialogue: { speaker: 'villain', text: 'You are too late. The storm is mine.' },
      scene: 'A storm rages on the tower roof. A hooded stranger waits at the edge, lightning crackling around him. The hero glides down to confront him.',
      choices: ['Confront him', 'Look for another way down']
    },
    to: ['clash', 'vault']
  },
  clash: {
    beat: {
      caption: 'Steel meets lightning.',
      dialogue: { speaker: 'villain', text: 'Enough games!' },
      scene: 'The hero and the villain fight. A huge explosion tears through the floor, sparks and smoke everywhere, the whole tower shakes and begins to collapse. A crowd of panicked citizens runs below.',
      choices: ['Finish the villain', 'Save the crowd first']
    },
    to: ['climax', 'rescue']
  },
  vault: {
    beat: {
      caption: 'Down in the vault, something hums.',
      dialogue: { speaker: 'friend', text: 'That portal... it was never in the blueprints.' },
      scene: 'Inside a quiet vault, a strange glowing portal hums in the shadow. A whisper echoes in the secret chamber and the lights flicker.',
      choices: ['Step through the portal', 'Seal it shut']
    },
    to: ['space', 'climax']
  },
  space: {
    beat: {
      caption: 'Beyond the portal: silent orbit.',
      dialogue: { speaker: 'hero', text: 'Whatever built this is watching us.' },
      scene: 'In orbit above a cold planet, near a drifting asteroid station. An alien creature rises from the wreckage, and the hero faces it as a ufo spacecraft looms nearby.',
      choices: ['Strike first', 'Retreat through the portal']
    },
    to: ['climax', 'dawn']
  },
  rescue: {
    beat: {
      caption: 'Every second counts.',
      dialogue: { speaker: 'hero', text: 'This way! Run, run!' },
      scene: 'In the city street, the burning tower collapses. The hero flies down, scoops up civilians and leads the fleeing crowd to safety through fire and debris.',
      choices: ['Go back for the villain', 'Hold the street until dawn']
    },
    to: ['climax', 'dawn']
  },
  climax: {
    beat: {
      caption: 'Everything comes down to this moment.',
      dialogue: { speaker: 'villain', text: 'If I fall, the whole city falls with me!' },
      scene: 'A blinding blast. The hero battles the villain amid flames as the tower collapses, a huge explosion lighting the stormy night. A crater opens in the street.',
      choices: ['Hold the tower up with everything left', 'Let go and run']
    },
    to: ['dawn', 'dawn']
  },
  dawn: {
    beat: {
      caption: 'Dawn. Smoke drifts over the quiet city.',
      dialogue: { speaker: 'friend', text: 'We did it. We actually did it.' },
      scene: 'At sunrise the storm is gone. In the quiet street, relieved citizens cheer for the hero and his friend, a victory after the long night.',
      choices: ['Help rebuild the city', 'Look to the horizon']
    },
    to: ['rebuild', 'rebuild']
  },
  rebuild: {
    beat: {
      caption: 'Weeks later. New Year in Port Meridian.',
      dialogue: { speaker: 'hero', text: 'Not bad for a fresh start.' },
      scene: 'Midnight, New Year. The city is rebuilt and repair crews have restored the street. A crowd laughs and celebrates under fireworks with a friend at the hero\'s side.',
      choices: ['Begin a new story']
    },
    to: ['start']
  }
};

export class OfflineStory implements StorySource {
  readonly name = 'Offline story';
  private nodeId = 'start';

  async start(): Promise<StoryBeat> {
    this.nodeId = 'start';
    return NODES.start.beat;
  }

  async next(choice: string): Promise<StoryBeat> {
    const node = NODES[this.nodeId];
    const idx = node.beat.choices.indexOf(choice);
    this.nodeId = node.to[idx >= 0 ? idx : 0] ?? 'start';
    return NODES[this.nodeId].beat;
  }
}

// ---------- Gemini: beats written live, with continuity from the world ----------

const MODEL = 'gemini-3.8-flash';

const extractJson = (text: string): unknown => {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(cleaned);
};

const asBeat = (raw: unknown): StoryBeat => {
  const r = (raw ?? {}) as Record<string, any>;
  if (typeof r.scene !== 'string' || !r.scene.trim()) throw new Error('Beat is missing a scene');
  const choices = Array.isArray(r.choices) ? r.choices.filter((c: unknown): c is string => typeof c === 'string').slice(0, 3) : [];
  const d = r.dialogue;
  return {
    caption: typeof r.caption === 'string' ? r.caption.slice(0, 240) : undefined,
    dialogue: d && typeof d.text === 'string' ? { speaker: String(d.speaker ?? 'hero'), text: d.text.slice(0, 200) } : undefined,
    scene: r.scene,
    choices: choices.length > 0 ? choices : ['Press on', 'Take a moment to think'],
    sceneHint: r.sceneHint
  };
};

const SCHEMA_HELP = `Reply with ONE JSON object only:
{
  "caption": "one short narration sentence",
  "dialogue": { "speaker": "hero|friend|villain", "text": "one short line" },
  "scene": "2-3 sentences describing the visible action, naming the place, time of day, weather and who is present",
  "choices": ["option A", "option B"],
  "sceneHint": {
    "location": "city|rooftop|countryside|forest|desert|ocean|space|interior|wasteland",
    "timeOfDay": 0-24,
    "weather": "clear|cloudy|rain|storm|snow|fog|ash",
    "mood": "calm|mystery|tense|danger|triumph|joy|sorrow",
    "tension": 0-1,
    "effects": ["lightning|sparks|fireworks|speedlines|shake|flash|smoke"]
  }
}`;

export class GeminiStory implements StorySource {
  readonly name = 'Gemini story';
  constructor(private readonly apiKey: string, private readonly genre: string = 'Superhero Action') {}

  private async ask(prompt: string): Promise<StoryBeat> {
    const ai = new GoogleGenAI({ apiKey: this.apiKey, apiVersion: 'v1beta' });
    const res = await ai.models.generateContent({ model: MODEL, contents: prompt, config: { responseMimeType: 'application/json' } });
    return asBeat(extractJson(res.text ?? ''));
  }

  private worldLine(world: WorldState) {
    const props = world.props.map(p => p.kind).join(', ') || 'none';
    return `Current world: location=${world.location}, timeOfDay=${world.timeOfDay.toFixed(1)}h, weather=${world.weather}, tension=${world.tension.toFixed(2)}, damage=${world.damage.toFixed(2)} (0 intact .. 1 ruined), persistent props=${props}, cast=${world.actors.map(a => a.role).join(', ')}.`;
  }

  start(premise: string, world: WorldState): Promise<StoryBeat> {
    return this.ask(`You are the writer of an animated comic. Genre: ${this.genre}. Premise: ${premise || 'a hero faces a threat to their city'}.
Write the opening beat. ${this.worldLine(world)}
${SCHEMA_HELP}`);
  }

  next(choice: string, history: StoryBeat[], world: WorldState): Promise<StoryBeat> {
    const recap = history.slice(-4).map((b, i) => `${i + 1}. ${b.scene}`).join('\n');
    return this.ask(`You are the writer of an animated comic. Genre: ${this.genre}.
Story so far:
${recap}
The reader chose: "${choice}".
Write the next beat. Keep the world continuous with what came before (same place unless the story moves, time moves forward, damage and weather carry on). ${this.worldLine(world)}
${SCHEMA_HELP}`);
  }
}

// Falls back to the offline story whenever the primary source fails, so the
// comic never stalls on a network or parsing error.
export class ResilientStory implements StorySource {
  readonly name: string;
  lastError: string | null = null;
  constructor(private readonly primary: StorySource, private readonly fallback: StorySource) {
    this.name = primary.name;
  }

  async start(premise: string, world: WorldState): Promise<StoryBeat> {
    try { this.lastError = null; return await this.primary.start(premise, world); }
    catch (e) { this.lastError = String(e); return this.fallback.start(premise, world); }
  }

  async next(choice: string, history: StoryBeat[], world: WorldState): Promise<StoryBeat> {
    try { this.lastError = null; return await this.primary.next(choice, history, world); }
    catch (e) { this.lastError = String(e); return this.fallback.next(choice, history, world); }
  }
}
