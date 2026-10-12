
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import jsPDF from 'jspdf';
import {
    MAX_STORY_PAGES, BACK_COVER_PAGE, TOTAL_PAGES, INITIAL_PAGES, GATE_PAGE, BATCH_SIZE, DECISION_PAGES,
    CASE_FILE_SEQUENCE, CASE_FILE_MAX_STORY_PAGES, CASE_FILE_GATE_PAGE, CASE_FILE_INITIAL_PAGES, CASE_FILE_BATCH_SIZE,
    GENRES, TONES, LANGUAGES, ComicFace, Beat, Persona, StoryMode, ArtifactType
} from './types';
import { Setup } from './Setup';
import { Book } from './Book';
import { useApiKey } from './useApiKey';
import { ApiKeyDialog } from './ApiKeyDialog';

// --- Constants ---
const MODEL_V3 = "gemini-3-pro-image-preview";
const MODEL_IMAGE_GEN_NAME = MODEL_V3;
const MODEL_TEXT_NAME = MODEL_V3;

// --- Case File mode constants ---
// Only artifacts that visually depict the hero need the hero reference image.
const CASE_FILE_LIKENESS_ARTIFACTS = new Set<ArtifactType>(['camera_footage', 'witness_drawing', 'hero_statement']);

const CASE_FILE_ARTIFACT_INSTRUCTIONS: Record<ArtifactType, string> = {
    cover_sheet: "INCIDENT COVER SHEET. Establish the setting, date, and a short incident title. CRITICAL: Include a status line stating ONE PERSON IS UNACCOUNTED FOR, without revealing who or why yet. Tone: official, understated, factual.",
    emergency_calls: "TWO OVERLAPPING EMERGENCY CALLS. Write it as a brief transcript-like caption/dialogue: one caller reporting the main visible danger HERO is addressing, a second, shorter caller voice asking if anyone can hear them from somewhere unreachable. Do not resolve this yet.",
    camera_footage: "SECURITY/TRAFFIC CAMERA STILL. A narrow, limited view of HERO acting during the incident. The framing should make clear it CANNOT show the whole scene - establish that something just outside frame remains unknown.",
    witness_drawing: "A CHILD'S DRAWING of the rescue, from a bystander's point of view. HERO appears only as a simple silhouette/shape, not a detailed heroic figure. Caption/dialogue should read like a child's simple, sincere description.",
    responder_notes: "RESPONDER'S FIELD NOTES. A clinical, rapid timeline of how fast conditions changed and how little time responders had. Should make clear WHY not everyone could be reached in time, without blaming HERO.",
    overlooked_detail: "AN OVERLOOKED DETAIL. A short message from a minor figure (e.g. a maintenance worker) noting a warning or detail that was missed earlier. This adds context, not a villain or someone to blame outright.",
    hero_statement: "THE HERO'S OWN STATEMENT. Quiet, first-person, grounded. HERO corrects one or two small public misconceptions, acknowledges what happened plainly, and does NOT argue for forgiveness or declare the choice was right or wrong.",
    closing_summary: "CLOSING SUMMARY. Assemble the full timeline referencing concrete details already established in earlier artifacts (reference them specifically). Explicitly: NO verdict, NO moral judgment, NO choices, NO cliffhanger, NO 'TO BE CONTINUED'. End on an open, human note that sits with what happened."
};

const CASE_FILE_IMAGE_STYLE: Record<ArtifactType, string> = {
    cover_sheet: "TYPE: Official incident report cover sheet. STYLE: Plain typed document on slightly worn paper, redaction marks, a case number stamp. NO illustrated character art - this is a paper document, not a comic panel.",
    emergency_calls: "TYPE: Emergency dispatch transcript page. STYLE: Monospace transcript on a printed page, caller timestamps in the margin, minimal graphics. NO character art.",
    camera_footage: "TYPE: Grainy black-and-white security/traffic camera still. STYLE: High-contrast, slightly blurred, timestamp burned into a corner, narrow/obstructed framing so only part of the scene is visible. If HERO is present, render them distant/partially obscured using REFERENCE 1, not a heroic close-up.",
    witness_drawing: "TYPE: A child's crayon/marker drawing recreating the scene. STYLE: Naive, wobbly linework, bright flat colors, hero shown only as a simple silhouette or stick-figure shape (NOT a detailed comic rendering), a scrawled caption in a child's handwriting.",
    responder_notes: "TYPE: A responder's handwritten field notes and rough timeline on a clipboard page. STYLE: Handwriting/ballpoint pen on a lined form, creases, no illustrated scene - mostly text and a small sketch of a timeline.",
    overlooked_detail: "TYPE: A short internal memo/message. STYLE: Plain memo paper or a printed email, understated, matter-of-fact tone, no dramatic imagery.",
    hero_statement: "TYPE: The hero's personal statement, styled like a quiet interview transcript or a handwritten letter, with a small, modest portrait of HERO (use REFERENCE 1) off to the side - not an action pose.",
    closing_summary: "TYPE: A final assembled timeline page in the case file, combining a brief typed summary with small thumbnail-style callbacks to the earlier evidence. STYLE: Understated, documentary, NOT a dramatic splash page. No decision prompt, no cliffhanger text."
};

const App: React.FC = () => {
    // --- API Key Hook ---
    const { validateApiKey, setShowApiKeyDialog, showApiKeyDialog, handleApiKeyDialogContinue } = useApiKey();

    const [hero, setHeroState] = useState<Persona | null>(null);
    const [friend, setFriendState] = useState<Persona | null>(null);
    const [selectedGenre, setSelectedGenre] = useState(GENRES[0]);
    const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0].code);
    const [customPremise, setCustomPremise] = useState("");
    const [storyTone, setStoryTone] = useState(TONES[0]);
    const [richMode, setRichMode] = useState(true);
    const [storyMode, setStoryMode] = useState<StoryMode>('classic');

    // --- Mode-aware page structure ---
    // Case File mode replaces the linear 10-page comic with a fixed sequence
    // of evidence artifacts; Classic Comic keeps its original constants.
    const isCaseFile = storyMode === 'case_file';
    const effectiveMaxStoryPages = isCaseFile ? CASE_FILE_MAX_STORY_PAGES : MAX_STORY_PAGES;
    const effectiveBackCoverPage = effectiveMaxStoryPages + 1;
    const effectiveTotalPages = effectiveBackCoverPage;
    const effectiveGatePage = isCaseFile ? CASE_FILE_GATE_PAGE : GATE_PAGE;
    const effectiveInitialPages = isCaseFile ? CASE_FILE_INITIAL_PAGES : INITIAL_PAGES;
    const effectiveBatchSize = isCaseFile ? CASE_FILE_BATCH_SIZE : BATCH_SIZE;

    const heroRef = useRef<Persona | null>(null);
    const friendRef = useRef<Persona | null>(null);

    const setHero = (p: Persona | null) => { setHeroState(p); heroRef.current = p; };
    const setFriend = (p: Persona | null) => { setFriendState(p); friendRef.current = p; };

    const [comicFaces, setComicFaces] = useState<ComicFace[]>([]);
    const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
    const [isStarted, setIsStarted] = useState(false);

    // --- Transition States ---
    const [showSetup, setShowSetup] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const generatingPages = useRef(new Set<number>());
    const historyRef = useRef<ComicFace[]>([]);

    // --- AI Helpers ---
    // Helper to always get a fresh instance with the selected key
    const getAI = () => {
        return new GoogleGenAI({ apiKey: process.env.API_KEY });
    };

    const handleAPIError = (e: any) => {
        const msg = String(e);
        console.error("API Error:", msg);
        if (
            msg.includes('Requested entity was not found') ||
            msg.includes('API_KEY_INVALID') ||
            msg.toLowerCase().includes('permission denied')
        ) {
            setShowApiKeyDialog(true);
        }
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const generateBeat = async (history: ComicFace[], isRightPage: boolean, pageNum: number, isDecisionPage: boolean): Promise<Beat> => {
        if (!heroRef.current) throw new Error("No Hero");

        const isFinalPage = pageNum === MAX_STORY_PAGES;
        const langName = LANGUAGES.find(l => l.code === selectedLanguage)?.name || "English";

        // Get relevant history and last focus to prevent repetition
        const relevantHistory = history
            .filter(p => p.type === 'story' && p.narrative && (p.pageIndex || 0) < pageNum)
            .sort((a, b) => (a.pageIndex || 0) - (b.pageIndex || 0));

        const lastBeat = relevantHistory[relevantHistory.length - 1]?.narrative;
        const lastFocus = lastBeat?.focus_char || 'none';

        const historyText = relevantHistory.map(p =>
            `[Page ${p.pageIndex}] [Focus: ${p.narrative?.focus_char}] (Caption: "${p.narrative?.caption || ''}") (Dialogue: "${p.narrative?.dialogue || ''}") (Scene: ${p.narrative?.scene}) ${p.resolvedChoice ? `-> USER CHOICE: "${p.resolvedChoice}"` : ''}`
        ).join('\n');

        // Aggressive Co-Star Injection Logic
        let friendInstruction = "Not yet introduced.";
        if (friendRef.current) {
            friendInstruction = "ACTIVE and PRESENT (User Provided).";
            // If the last panel wasn't the friend, strongly suggest switching to them to maintain balance.
            if (lastFocus !== 'friend' && Math.random() > 0.4) {
                friendInstruction += " MANDATORY: FOCUS ON THE CO-STAR FOR THIS PANEL.";
            } else {
                friendInstruction += " Ensure they are woven into the scene even if not the main focus.";
            }
        }

        // Determine Core Story Driver (Genre vs Custom Premise)
        let coreDriver = `GENRE: ${selectedGenre}. TONE: ${storyTone}.`;
        if (selectedGenre === 'Custom') {
            coreDriver = `STORY PREMISE: ${customPremise || "A totally unique, unpredictable adventure"}. (Follow this premise strictly over standard genre tropes).`;
        } else if (selectedGenre === 'New Year Evening') {
            // Add this block
            coreDriver += " SETTING: New Year's Eve celebration. VISUALS: Festive atmosphere, fireworks in the background or sky where appropriate.";
        }

        const isSliceOfLife = selectedGenre.includes("Comedy") ||
            selectedGenre.includes("Teen") ||
            selectedGenre.includes("Slice") ||
            selectedGenre === "New Year Evening"; // Add this check

        // Guardrails to prevent everything becoming "Quantum Sci-Fi"
        const guardrails = `
    NEGATIVE CONSTRAINTS:
    1. UNLESS GENRE IS "Dark Sci-Fi" OR "Superhero Action" OR "Custom": DO NOT use technical jargon like "Quantum", "Timeline", "Portal", "Multiverse", or "Singularity".
    2. IF GENRE IS "Teen Drama" OR "Lighthearted Comedy" OR "New Year Evening": The "stakes" must be SOCIAL, EMOTIONAL, or PERSONAL (e.g., a rumor, a competition, a broken promise, being late, embarrassing oneself). Do NOT make it life-or-death. Keep it grounded.
    3. Avoid "The artifact" or "The device" unless established earlier.
    `;

        // BASE INSTRUCTION: Strictly enforce language for output text.
        let instruction = `Continue the story. ALL OUTPUT TEXT (Captions, Dialogue, Choices) MUST BE IN ${langName.toUpperCase()}. ${coreDriver} ${guardrails}`;
        if (richMode) {
            instruction += " RICH/NOVEL MODE ENABLED. Prioritize deeper character thoughts, descriptive captions, and meaningful dialogue exchanges over short punchlines.";
        }

        if (isFinalPage) {
            instruction += " FINAL PAGE. KARMIC CLIFFHANGER REQUIRED. You MUST explicitly reference the User's choice from PAGE 3 in the narrative and show how that specific philosophy led to this conclusion. Text must end with 'TO BE CONTINUED...' (or localized equivalent).";
        } else if (isDecisionPage) {
            instruction += " End with a PSYCHOLOGICAL choice about VALUES, RELATIONSHIPS, or RISK. (e.g., Truth vs. Safety, Forgive vs. Avenge). The options must NOT be simple physical actions like 'Go Left'.";
        } else {
            // Neutralized Narrative Arc to avoid forcing "scary mystery" tones if the genre doesn't call for it.
            if (pageNum === 1) {
                instruction += " INCITING INCIDENT. An event disrupts the status quo. Establish the genre's intended mood. (If Slice of Life: A social snag/surprise. If Adventure: A call to action).";
            } else if (pageNum <= 4) {
                instruction += " RISING ACTION. The heroes engage with the new situation. Focus on dialogue, character dynamics, and initial challenges.";
            } else if (pageNum <= 8) {
                instruction += " COMPLICATION. A twist occurs! A secret is revealed, a misunderstanding deepens, or the path is blocked. (Keep intensity appropriate to Genre - e.g. Social awkwardness for Comedy, Danger for Horror).";
            } else {
                instruction += " CLIMAX. The confrontation with the main conflict. The truth comes out, the contest ends, or the battle is fought.";
            }
        }

        // Dynamic text limits based on richMode
        const capLimit = richMode ? "max 35 words. Detailed narration or internal monologue" : "max 15 words";
        const diaLimit = richMode ? "max 30 words. Rich, character-driven speech" : "max 12 words";

        const prompt = `
You are writing a comic book script. PAGE ${pageNum} of ${MAX_STORY_PAGES}.
TARGET LANGUAGE FOR TEXT: ${langName} (CRITICAL: CAPTIONS, DIALOGUE, CHOICES MUST BE IN THIS LANGUAGE).
${coreDriver}

CHARACTERS:
- HERO: Active.
- CO-STAR: ${friendInstruction}

PREVIOUS PANELS (READ CAREFULLY):
${historyText.length > 0 ? historyText : "Start the adventure."}

RULES:
1. NO REPETITION. Do not use the same captions or dialogue from previous pages.
2. IF CO-STAR IS ACTIVE, THEY MUST APPEAR FREQUENTLY.
3. VARIETY. If page ${pageNum - 1} was an action shot, make this one a reaction or wide shot.
4. LANGUAGE: All user-facing text MUST be in ${langName}.
5. Avoid saying "CO-star" and "hero" in the text captions. Use names if established, or generic descriptors.

INSTRUCTION: ${instruction}

OUTPUT STRICT JSON ONLY (No markdown formatting):
{
  "caption": "Unique narrator text in ${langName}. (${capLimit}).",
  "dialogue": "Unique speech in ${langName}. (${diaLimit}). Optional.",
  "scene": "Vivid visual description (ALWAYS IN ENGLISH for the artist model). MUST mention 'HERO' or 'CO-STAR' if they are present.",
  "focus_char": "hero" OR "friend" OR "other",
  "choices": ["Option A in ${langName}", "Option B in ${langName}"] (Only if decision page)
}
`;
        try {
            const ai = getAI();
            const res = await ai.models.generateContent({ model: MODEL_TEXT_NAME, contents: prompt, config: { responseMimeType: 'application/json' } });
            let rawText = res.text || "{}";
            rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

            const parsed = JSON.parse(rawText);

            if (parsed.dialogue) parsed.dialogue = parsed.dialogue.replace(/^[\w\s\-]+:\s*/i, '').replace(/["']/g, '').trim();
            if (parsed.caption) parsed.caption = parsed.caption.replace(/^[\w\s\-]+:\s*/i, '').trim();
            if (!isDecisionPage) parsed.choices = [];
            if (isDecisionPage && !isFinalPage && (!parsed.choices || parsed.choices.length < 2)) parsed.choices = ["Option A", "Option B"];
            if (!['hero', 'friend', 'other'].includes(parsed.focus_char)) parsed.focus_char = 'hero';

            return parsed as Beat;
        } catch (e) {
            console.error("Beat generation failed", e);
            handleAPIError(e);
            return {
                caption: pageNum === 1 ? "It began..." : "...",
                scene: `Generic scene for page ${pageNum}.`,
                focus_char: 'hero',
                choices: []
            };
        }
    };

    const generateCaseFileBeat = async (history: ComicFace[], pageNum: number, artifactType: ArtifactType): Promise<Beat> => {
        if (!heroRef.current) throw new Error("No Hero");
        const langName = LANGUAGES.find(l => l.code === selectedLanguage)?.name || "English";

        const relevantHistory = history
            .filter(p => p.type === 'story' && p.narrative && (p.pageIndex || 0) < pageNum)
            .sort((a, b) => (a.pageIndex || 0) - (b.pageIndex || 0));

        const historyText = relevantHistory.map(p =>
            `[${p.artifactType}] (Caption: "${p.narrative?.caption || ''}") (Dialogue: "${p.narrative?.dialogue || ''}") (Scene: ${p.narrative?.scene})`
        ).join('\n');

        let coreDriver = `GENRE/SETTING FLAVOR: ${selectedGenre}.`;
        if (selectedGenre === 'Custom') {
            coreDriver = `STORY PREMISE: ${customPremise || "A grounded incident involving the hero"}.`;
        }

        const instruction = CASE_FILE_ARTIFACT_INSTRUCTIONS[artifactType];
        const capLimit = richMode ? "max 35 words" : "max 20 words";
        const diaLimit = richMode ? "max 30 words" : "max 18 words";

        const prompt = `
You are assembling a CASE FILE reconstructing a superhero incident through found evidence and witness accounts. GROUNDED, HUMAN TONE - not a typical comic-book splash page. PAGE ${pageNum} of ${CASE_FILE_MAX_STORY_PAGES}. ARTIFACT TYPE: ${artifactType}.
TARGET LANGUAGE FOR TEXT: ${langName} (CRITICAL).
${coreDriver}

PREVIOUS ARTIFACTS (READ CAREFULLY, STAY CONSISTENT):
${historyText.length > 0 ? historyText : "This is the first artifact in the file."}

RULES:
1. Stay factually consistent with previous artifacts.
2. NO superhero bravado, no quips, no action-movie dialogue - grounded, plausible people.
3. NEVER include decision options or choices.
4. LANGUAGE: All user-facing text MUST be in ${langName}.

INSTRUCTION: ${instruction}

OUTPUT STRICT JSON ONLY (no markdown):
{
  "caption": "Narrator/document text in ${langName}. (${capLimit}).",
  "dialogue": "Quoted speech/transcript line in ${langName}. (${diaLimit}). Optional.",
  "scene": "Vivid visual description of the EVIDENCE ITEM ITSELF (ALWAYS IN ENGLISH for the artist model). Describe it as a document/photo/drawing, not a comic panel. Mention 'HERO' only if the artifact type calls for a view of them.",
  "focus_char": "hero" OR "other",
  "sourceLabel": "Short in-world label for this artifact (in ${langName}).",
  "timestamp": "A short time/date stamp fitting the scene, e.g. '11:47 PM' (optional)."
}
`;
        try {
            const ai = getAI();
            const res = await ai.models.generateContent({ model: MODEL_TEXT_NAME, contents: prompt, config: { responseMimeType: 'application/json' } });
            let rawText = res.text || "{}";
            rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

            const parsed = JSON.parse(rawText);

            if (parsed.dialogue) parsed.dialogue = parsed.dialogue.replace(/^[\w\s\-]+:\s*/i, '').replace(/["']/g, '').trim();
            if (parsed.caption) parsed.caption = parsed.caption.replace(/^[\w\s\-]+:\s*/i, '').trim();
            parsed.choices = [];
            if (!['hero', 'other'].includes(parsed.focus_char)) parsed.focus_char = 'other';

            return parsed as Beat;
        } catch (e) {
            console.error("Case file beat generation failed", e);
            handleAPIError(e);
            return {
                caption: artifactType === 'cover_sheet' ? "Incident report pending review." : "...",
                scene: `Evidence item representing ${artifactType.replace(/_/g, ' ')}.`,
                focus_char: 'other',
                choices: []
            };
        }
    };

    const generatePersona = async (desc: string): Promise<Persona> => {
        const style = selectedGenre === 'Custom' ? "Modern American comic book art" : `${selectedGenre} comic`;
        try {
            const ai = getAI();
            const res = await ai.models.generateContent({
                model: MODEL_IMAGE_GEN_NAME,
                contents: { text: `STYLE: Masterpiece ${style} character sheet, detailed ink, neutral background. FULL BODY. Character: ${desc}` },
                config: { imageConfig: { aspectRatio: '1:1' } }
            });
            const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (part?.inlineData?.data) return { base64: part.inlineData.data, desc };
            throw new Error("Failed");
        } catch (e) {
            handleAPIError(e);
            throw e;
        }
    };

    const generateImage = async (beat: Beat, type: ComicFace['type'], artifactType?: ArtifactType): Promise<string> => {
        const contents: any[] = [];
        const needsLikeness = isCaseFile
            ? (type === 'story' && !!artifactType && CASE_FILE_LIKENESS_ARTIFACTS.has(artifactType))
            : true;

        if (needsLikeness && heroRef.current?.base64) {
            contents.push({ text: "REFERENCE 1 [HERO]:" });
            contents.push({ inlineData: { mimeType: 'image/jpeg', data: heroRef.current.base64 } });
        }
        if (needsLikeness && friendRef.current?.base64) {
            contents.push({ text: "REFERENCE 2 [CO-STAR]:" });
            contents.push({ inlineData: { mimeType: 'image/jpeg', data: friendRef.current.base64 } });
        }

        let promptText: string;

        if (isCaseFile) {
            const styleFlavor = selectedGenre === 'Custom' ? "a custom" : selectedGenre;
            promptText = `STYLE BASE: Grounded, documentary-leaning style appropriate to ${styleFlavor} setting. Muted, realistic palette - NOT vibrant comic-book coloring. `;

            if (type === 'cover') {
                const langName = LANGUAGES.find(l => l.code === selectedLanguage)?.name || "English";
                promptText += `TYPE: Case file folder cover. STYLE: A plain manila folder or confidential report cover. TITLE: "CASE FILE" (OR LOCALIZED TRANSLATION IN ${langName.toUpperCase()}). Include a case number and a short incident title. NO illustrated hero action art - this is a document cover, not a comic cover.`;
            } else if (type === 'back_cover') {
                promptText += `TYPE: Case file closing page. STYLE: A folder cover closing, a "CASE CLOSED" or "FILE COMPLETE" stamp, understated and quiet. NO dramatic teaser text, NO "next issue" hype.`;
            } else if (artifactType) {
                promptText += CASE_FILE_IMAGE_STYLE[artifactType] + ' ';
                promptText += `SCENE CONTEXT: ${beat.scene}. `;
                if (needsLikeness) promptText += `If a figure representing HERO appears, you MUST use REFERENCE 1 for likeness, rendered subtly per the artifact style above (not a heroic pose). `;
                if (beat.caption) promptText += ` INCLUDE VISIBLE DOCUMENT/CAPTION TEXT: "${beat.caption}"`;
                if (beat.dialogue) promptText += ` INCLUDE QUOTED/TRANSCRIPT TEXT: "${beat.dialogue}"`;
            }
        } else {
            const styleEra = selectedGenre === 'Custom' ? "Modern American" : selectedGenre;
            promptText = `STYLE: ${styleEra} comic book art, detailed ink, vibrant colors. `;

            if (type === 'cover') {
                const langName = LANGUAGES.find(l => l.code === selectedLanguage)?.name || "English";
                promptText += `TYPE: Comic Book Cover. TITLE: "INFINITE HEROES" (OR LOCALIZED TRANSLATION IN ${langName.toUpperCase()}). Main visual: Dynamic action shot of [HERO] (Use REFERENCE 1).`;
            } else if (type === 'back_cover') {
                promptText += `TYPE: Comic Back Cover. FULL PAGE VERTICAL ART. Dramatic teaser. Text: "NEXT ISSUE SOON".`;
            } else {
                promptText += `TYPE: Vertical comic panel. SCENE: ${beat.scene}. `;
                promptText += `INSTRUCTIONS: Maintain strict character likeness. If scene mentions 'HERO', you MUST use REFERENCE 1. If scene mentions 'CO-STAR' or 'SIDEKICK', you MUST use REFERENCE 2.`;

                if (beat.caption) promptText += ` INCLUDE CAPTION BOX: "${beat.caption}"`;
                if (beat.dialogue) promptText += ` INCLUDE SPEECH BUBBLE: "${beat.dialogue}"`;
            }
        }

        contents.push({ text: promptText });

        try {
            const ai = getAI();
            const res = await ai.models.generateContent({
                model: MODEL_IMAGE_GEN_NAME,
                contents: contents,
                config: { imageConfig: { aspectRatio: '2:3' } }
            });
            const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            return part?.inlineData?.data ? `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` : '';
        } catch (e) {
            handleAPIError(e);
            return '';
        }
    };

    const updateFaceState = (id: string, updates: Partial<ComicFace>) => {
        setComicFaces(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
        const idx = historyRef.current.findIndex(f => f.id === id);
        if (idx !== -1) historyRef.current[idx] = { ...historyRef.current[idx], ...updates };
    };

    const generateSinglePage = async (faceId: string, pageNum: number, type: ComicFace['type']) => {
        const isDecision = !isCaseFile && DECISION_PAGES.includes(pageNum);
        const artifactType: ArtifactType | undefined = isCaseFile && type === 'story' ? CASE_FILE_SEQUENCE[pageNum - 1] : undefined;
        let beat: Beat = { scene: "", choices: [], focus_char: 'other' };

        if (type === 'cover') {
            // Cover beat is handled in generateImage
        } else if (type === 'back_cover') {
            beat = { scene: isCaseFile ? "Case file closing stamp" : "Thematic teaser image", choices: [], focus_char: 'other' };
        } else if (isCaseFile && artifactType) {
            beat = await generateCaseFileBeat(historyRef.current, pageNum, artifactType);
        } else {
            beat = await generateBeat(historyRef.current, pageNum % 2 === 0, pageNum, isDecision);
        }

        if (!isCaseFile && beat.focus_char === 'friend' && !friendRef.current && type === 'story') {
            try {
                const newSidekick = await generatePersona(selectedGenre === 'Custom' ? "A fitting sidekick for this story" : `Sidekick for ${selectedGenre} story.`);
                setFriend(newSidekick);
            } catch (e) { beat.focus_char = 'other'; }
        }

        updateFaceState(faceId, { narrative: beat, choices: beat.choices, isDecisionPage: isDecision, artifactType });
        const url = await generateImage(beat, type, artifactType);
        updateFaceState(faceId, { imageUrl: url, isLoading: false });
    };

    const generateBatch = async (startPage: number, count: number) => {
        const pagesToGen: number[] = [];
        for (let i = 0; i < count; i++) {
            const p = startPage + i;
            if (p <= effectiveTotalPages && !generatingPages.current.has(p)) {
                pagesToGen.push(p);
            }
        }

        if (pagesToGen.length === 0) return;
        pagesToGen.forEach(p => generatingPages.current.add(p));

        const newFaces: ComicFace[] = [];
        pagesToGen.forEach(pageNum => {
            const type = pageNum === effectiveBackCoverPage ? 'back_cover' : 'story';
            newFaces.push({ id: `page-${pageNum}`, type, choices: [], isLoading: true, pageIndex: pageNum });
        });

        setComicFaces(prev => {
            const existing = new Set(prev.map(f => f.id));
            return [...prev, ...newFaces.filter(f => !existing.has(f.id))];
        });
        newFaces.forEach(f => { if (!historyRef.current.find(h => h.id === f.id)) historyRef.current.push(f); });

        try {
            for (const pageNum of pagesToGen) {
                await generateSinglePage(`page-${pageNum}`, pageNum, pageNum === effectiveBackCoverPage ? 'back_cover' : 'story');
                generatingPages.current.delete(pageNum);
            }
        } catch (e) {
            console.error("Batch generation error", e);
        } finally {
            pagesToGen.forEach(p => generatingPages.current.delete(p));
        }
    }

    const launchStory = async () => {
        // --- API KEY VALIDATION ---
        const hasKey = await validateApiKey();
        if (!hasKey) return; // Stop if cancelled or invalid

        if (!heroRef.current) return;
        if (selectedGenre === 'Custom' && !customPremise.trim()) {
            alert("Please enter a custom story premise.");
            return;
        }
        setIsTransitioning(true);

        let availableTones = TONES;
        if (selectedGenre === "Teen Drama / Slice of Life" || selectedGenre === "Lighthearted Comedy") {
            availableTones = TONES.filter(t => t.includes("CASUAL") || t.includes("WHOLESOME") || t.includes("QUIPPY"));
        } else if (selectedGenre === "Classic Horror") {
            availableTones = TONES.filter(t => t.includes("INNER-MONOLOGUE") || t.includes("OPERATIC"));
        }

        setStoryTone(availableTones[Math.floor(Math.random() * availableTones.length)]);

        const coverFace: ComicFace = { id: 'cover', type: 'cover', choices: [], isLoading: true, pageIndex: 0 };
        setComicFaces([coverFace]);
        historyRef.current = [coverFace];
        generatingPages.current.add(0);

        generateSinglePage('cover', 0, 'cover').finally(() => generatingPages.current.delete(0));

        setTimeout(async () => {
            setIsStarted(true);
            setShowSetup(false);
            setIsTransitioning(false);
            await generateBatch(1, effectiveInitialPages);
            if (isCaseFile) {
                // No decision gating in Case File mode - generate the rest of the sequence right away.
                generateBatch(1 + effectiveInitialPages, effectiveTotalPages - effectiveInitialPages);
            } else {
                generateBatch(3, 3);
            }
        }, 1100);
    };

    const handleChoice = async (pageIndex: number, choice: string) => {
        updateFaceState(`page-${pageIndex}`, { resolvedChoice: choice });
        const maxPage = Math.max(...historyRef.current.map(f => f.pageIndex || 0));
        if (maxPage + 1 <= effectiveTotalPages) {
            generateBatch(maxPage + 1, effectiveBatchSize);
        }
    }

    const resetApp = () => {
        setIsStarted(false);
        setShowSetup(true);
        setComicFaces([]);
        setCurrentSheetIndex(0);
        historyRef.current = [];
        generatingPages.current.clear();
        setHero(null);
        setFriend(null);
    };

    const downloadPDF = () => {
        const PAGE_WIDTH = 480;
        const PAGE_HEIGHT = 720;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [PAGE_WIDTH, PAGE_HEIGHT] });
        const pagesToPrint = comicFaces.filter(face => face.imageUrl && !face.isLoading).sort((a, b) => (a.pageIndex || 0) - (b.pageIndex || 0));

        pagesToPrint.forEach((face, index) => {
            if (index > 0) doc.addPage([PAGE_WIDTH, PAGE_HEIGHT], 'portrait');
            if (face.imageUrl) doc.addImage(face.imageUrl, 'JPEG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
        });
        doc.save('Infinite-Heroes-Issue.pdf');
    };

    const handleHeroUpload = async (file: File) => {
        try { const base64 = await fileToBase64(file); setHero({ base64, desc: "The Main Hero" }); } catch (e) { alert("Hero upload failed"); }
    };
    const handleFriendUpload = async (file: File) => {
        try { const base64 = await fileToBase64(file); setFriend({ base64, desc: "The Sidekick/Rival" }); } catch (e) { alert("Friend upload failed"); }
    };

    const handleSheetClick = (index: number) => {
        if (!isStarted) return;
        if (index === 0 && currentSheetIndex === 0) return;
        if (index < currentSheetIndex) setCurrentSheetIndex(index);
        else if (index === currentSheetIndex && comicFaces.find(f => f.pageIndex === index)?.imageUrl) setCurrentSheetIndex(prev => prev + 1);
    };

    return (
        <div className="comic-scene">
            {showApiKeyDialog && <ApiKeyDialog onContinue={handleApiKeyDialogContinue} />}

            <Setup
                show={showSetup}
                isTransitioning={isTransitioning}
                hero={hero}
                friend={friend}
                selectedGenre={selectedGenre}
                selectedLanguage={selectedLanguage}
                customPremise={customPremise}
                richMode={richMode}
                storyMode={storyMode}
                onHeroUpload={handleHeroUpload}
                onFriendUpload={handleFriendUpload}
                onGenreChange={setSelectedGenre}
                onLanguageChange={setSelectedLanguage}
                onPremiseChange={setCustomPremise}
                onRichModeChange={setRichMode}
                onStoryModeChange={setStoryMode}
                onLaunch={launchStory}
            />

            <Book
                comicFaces={comicFaces}
                currentSheetIndex={currentSheetIndex}
                isStarted={isStarted}
                isSetupVisible={showSetup && !isTransitioning}
                totalPages={effectiveTotalPages}
                gatePage={effectiveGatePage}
                initialPages={effectiveInitialPages}
                storyMode={storyMode}
                onSheetClick={handleSheetClick}
                onChoice={handleChoice}
                onOpenBook={() => setCurrentSheetIndex(1)}
                onDownload={downloadPDF}
                onReset={resetApp}
            />
        </div>
    );
};

export default App;
