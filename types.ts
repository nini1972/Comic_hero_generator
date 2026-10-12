/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export const MAX_STORY_PAGES = 10;
export const BACK_COVER_PAGE = 11;
export const TOTAL_PAGES = 11;
export const INITIAL_PAGES = 2;
export const GATE_PAGE = 2;
export const BATCH_SIZE = 6;
export const DECISION_PAGES = [3];

// --- Case File mode ---
// An alternate, non-branching story experience: a superhero incident is
// reconstructed from a fixed sequence of mixed-format evidence artifacts
// instead of a linear, choice-driven comic.
export type StoryMode = 'classic' | 'case_file';

export type ArtifactType =
  | 'cover_sheet'
  | 'emergency_calls'
  | 'camera_footage'
  | 'witness_drawing'
  | 'responder_notes'
  | 'overlooked_detail'
  | 'hero_statement'
  | 'closing_summary';

export const CASE_FILE_SEQUENCE: ArtifactType[] = [
  'cover_sheet',
  'emergency_calls',
  'camera_footage',
  'witness_drawing',
  'responder_notes',
  'overlooked_detail',
  'hero_statement',
  'closing_summary'
];

export const CASE_FILE_MAX_STORY_PAGES = CASE_FILE_SEQUENCE.length;
export const CASE_FILE_GATE_PAGE = 2;
export const CASE_FILE_INITIAL_PAGES = 2;
export const CASE_FILE_BATCH_SIZE = 6;

export const ARTIFACT_LABELS: Record<ArtifactType, string> = {
  cover_sheet: 'Incident Report',
  emergency_calls: 'Emergency Dispatch Calls',
  camera_footage: 'Security Camera Footage',
  witness_drawing: "Witness's Drawing",
  responder_notes: "Responder's Field Notes",
  overlooked_detail: 'Overlooked Detail',
  hero_statement: "Hero's Statement",
  closing_summary: 'Closing Summary'
};

export const GENRES = [
  "Classic Horror",
  "Superhero Action",
  "Dark Sci-Fi",
  "High Fantasy",
  "Neon Noir Detective",
  "Wasteland Apocalypse",
  "Lighthearted Comedy",
  "Teen Drama / Slice of Life",
  "New Year Evening", // Add this
  "Custom"
];
export const TONES = [
  "ACTION-HEAVY (Short, punchy dialogue. Focus on kinetics.)",
  "INNER-MONOLOGUE (Heavy captions revealing thoughts.)",
  "QUIPPY (Characters use humor as a defense mechanism.)",
  "OPERATIC (Grand, dramatic declarations and high stakes.)",
  "CASUAL (Natural dialogue, focus on relationships/gossip.)",
  "WHOLESOME (Warm, gentle, optimistic.)"
];

export const LANGUAGES = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'ar-EG', name: 'Arabic (Egypt)' },
  { code: 'de-DE', name: 'German (Germany)' },
  { code: 'es-MX', name: 'Spanish (Mexico)' },
  { code: 'fr-FR', name: 'French (France)' },
  { code: 'hi-IN', name: 'Hindi (India)' },
  { code: 'id-ID', name: 'Indonesian (Indonesia)' },
  { code: 'it-IT', name: 'Italian (Italy)' },
  { code: 'ja-JP', name: 'Japanese (Japan)' },
  { code: 'ko-KR', name: 'Korean (South Korea)' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'ru-RU', name: 'Russian (Russia)' },
  { code: 'ua-UA', name: 'Ukrainian (Ukraine)' },
  { code: 'vi-VN', name: 'Vietnamese (Vietnam)' },
  { code: 'zh-CN', name: 'Chinese (China)' }
];

export interface ComicFace {
  id: string;
  type: 'cover' | 'story' | 'back_cover';
  imageUrl?: string;
  narrative?: Beat;
  choices: string[];
  resolvedChoice?: string;
  isLoading: boolean;
  pageIndex?: number;
  isDecisionPage?: boolean;
  artifactType?: ArtifactType;
  audioBase64?: string;
}

export interface Beat {
  caption?: string;
  dialogue?: string;
  scene: string;
  choices: string[];
  focus_char: 'hero' | 'friend' | 'other';
  sourceLabel?: string;
  timestamp?: string;
}

export interface Persona {
  base64: string;
  desc: string;
}