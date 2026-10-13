/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MOODS, SceneSpec, StoryBeat, WEATHERS, Weather, WorldState } from './types';
import { composeScene } from './director';
import { advanceWorld, initialWorld } from './world';
import { GeminiStory, OfflineStory, ResilientStory, StorySource } from './story';
import { LivingScene } from './LivingScene';

const GENRES = ['Superhero Action', 'Dark Sci-Fi', 'Neon Noir Detective', 'High Fantasy', 'Wasteland Apocalypse', 'Lighthearted Comedy'];

// The key is injected at build time by Vite; absent in a plain checkout.
const readApiKey = (): string => {
  try { return process.env.API_KEY || ''; } catch { return ''; }
};

interface LogEntry { beat: number; location: string; hour: string; mood: string; text: string }

const fmtHour = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

export const LivingApp: React.FC = () => {
  const apiKey = readApiKey();
  const [premise, setPremise] = useState('');
  const [genre, setGenre] = useState(GENRES[0]);
  const [useAI, setUseAI] = useState(false);
  const [spec, setSpec] = useState<SceneSpec | null>(null);
  const [beat, setBeat] = useState<StoryBeat | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [showSpec, setShowSpec] = useState(false);

  const storyRef = useRef<StorySource>(new OfflineStory());
  const worldRef = useRef<WorldState>(initialWorld());
  const historyRef = useRef<StoryBeat[]>([]);

  const apply = useCallback((b: StoryBeat) => {
    const s = composeScene(b, worldRef.current);
    worldRef.current = advanceWorld(worldRef.current, s);
    historyRef.current.push(b);
    setSpec(s);
    setBeat(b);
    setLog(l => [...l, { beat: worldRef.current.beat, location: s.location, hour: fmtHour(s.timeOfDay), mood: s.mood, text: b.scene }]);
  }, []);

  const startStory = useCallback(async () => {
    setBusy(true);
    setNote('');
    worldRef.current = initialWorld(Math.floor(Math.random() * 100000));
    historyRef.current = [];
    setLog([]);
    const offline = new OfflineStory();
    const story = useAI && apiKey ? new ResilientStory(new GeminiStory(apiKey, genre), offline) : offline;
    storyRef.current = story;
    const b = await story.start(premise, worldRef.current);
    if (story instanceof ResilientStory && story.lastError) setNote('Gemini unavailable, using the offline story.');
    apply(b);
    setBusy(false);
  }, [apiKey, apply, genre, premise, useAI]);

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return; // StrictMode runs effects twice in dev
    startedRef.current = true;
    void startStory(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const choose = async (choice: string) => {
    setBusy(true);
    const story = storyRef.current;
    const b = await story.next(choice, historyRef.current, worldRef.current);
    setNote(story instanceof ResilientStory && story.lastError ? 'Gemini hiccup, continued with the offline story.' : '');
    apply(b);
    setBusy(false);
  };

  // Scene lab: tweak the live world and watch the scene adapt.
  const tweak = (patch: Partial<SceneSpec>) => {
    setSpec(s => {
      if (!s) return s;
      const next = { ...s, ...patch };
      worldRef.current = { ...worldRef.current, timeOfDay: next.timeOfDay, weather: next.weather, damage: next.damage, tension: next.tension };
      return next;
    });
  };

  return (
    <div className="la-page">
      <header className="la-header">
        <h1>LIVING COMIC</h1>
        <p>Every panel is code: a scene spec rendered live and adapted to the story. No images, no video.</p>
      </header>

      <section className="la-controls">
        <input value={premise} onChange={e => setPremise(e.target.value)} placeholder="Story premise (used with Gemini)" />
        <select value={genre} onChange={e => setGenre(e.target.value)}>{GENRES.map(g => <option key={g}>{g}</option>)}</select>
        <label title={apiKey ? '' : 'No GEMINI_API_KEY found'}>
          <input type="checkbox" checked={useAI && !!apiKey} disabled={!apiKey} onChange={e => setUseAI(e.target.checked)} /> Gemini writer
        </label>
        <button onClick={startStory} disabled={busy}>New story</button>
      </section>

      <main className="la-stage">
        <div className="la-frame">{spec && <LivingScene spec={spec} />}</div>
        {note && <p className="la-note">{note}</p>}
        <div className="la-choices">
          {busy && <span className="la-busy">The director is composing the next scene...</span>}
          {!busy && beat?.choices.map(c => <button key={c} onClick={() => choose(c)}>{c}</button>)}
        </div>
      </main>

      {spec && (
        <aside className="la-lab">
          <h2>Scene lab</h2>
          <label>Time of day {fmtHour(spec.timeOfDay)}
            <input type="range" min={0} max={23.9} step={0.1} value={spec.timeOfDay} onChange={e => tweak({ timeOfDay: Number(e.target.value) })} />
          </label>
          <label>Damage {spec.damage.toFixed(1)}
            <input type="range" min={0} max={1} step={0.1} value={spec.damage} onChange={e => tweak({ damage: Number(e.target.value) })} />
          </label>
          <label>Tension {spec.tension.toFixed(2)}
            <input type="range" min={0} max={1} step={0.05} value={spec.tension} onChange={e => tweak({ tension: Number(e.target.value) })} />
          </label>
          <label>Weather
            <select value={spec.weather} onChange={e => tweak({ weather: e.target.value as Weather })}>{WEATHERS.map(w => <option key={w}>{w}</option>)}</select>
          </label>
          <label>Mood
            <select value={spec.mood} onChange={e => tweak({ mood: e.target.value as SceneSpec['mood'] })}>{MOODS.map(m => <option key={m}>{m}</option>)}</select>
          </label>
          <button onClick={() => setShowSpec(s => !s)}>{showSpec ? 'Hide' : 'Show'} scene spec</button>
          {showSpec && <pre>{JSON.stringify({ ...spec, caption: undefined, speech: undefined }, null, 1)}</pre>}
        </aside>
      )}

      <footer className="la-log">
        {log.map((e, i) => <div key={i}><b>#{e.beat}</b> {e.location} {e.hour} <i>{e.mood}</i> - {e.text}</div>)}
      </footer>
    </div>
  );
};
