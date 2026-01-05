
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { MAX_STORY_PAGES, BACK_COVER_PAGE, TOTAL_PAGES, INITIAL_PAGES, BATCH_SIZE, DECISION_PAGES, GENRES, TONES, LANGUAGES, ComicFace, Beat, Persona } from './types';
import { Setup } from './Setup';
import { Book } from './Book';
import { useApiKey } from './useApiKey';
import { ApiKeyDialog } from './ApiKeyDialog';

// --- Constants ---
// --- Constants ---
const MODEL_V3 = "gemini-3-pro-image-preview";
const MODEL_TEXT_NAME = MODEL_V3;
const MODEL_IMAGE_GEN_NAME = MODEL_V3;
const MODEL_AUDIO_NAME = "gemini-2.5-flash-preview-tts";

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
    const [narrationEnabled, setNarrationEnabled] = useState(true);

    const heroRef = useRef<Persona | null>(null);
    const friendRef = useRef<Persona | null>(null);

    const setHero = (p: Persona | null) => { setHeroState(p); heroRef.current = p; };
    const setFriend = (p: Persona | null) => { setFriendState(p); friendRef.current = p; };

    const [comicFaces, setComicFaces] = useState<ComicFace[]>([]);
    const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
    const [isStarted, setIsStarted] = useState(false);
    const [isNarrating, setIsNarrating] = useState(false);

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
            if (part?.inlineData?.data) return { base64: part.inlineData.data, desc, gender: 'female' };
            throw new Error("Failed");
        } catch (e) {
            handleAPIError(e);
            throw e;
        }
    };

    const generateImage = async (beat: Beat, type: ComicFace['type']): Promise<string> => {
        const contents = [];
        if (heroRef.current?.base64) {
            contents.push({ text: "REFERENCE 1 [HERO]:" });
            contents.push({ inlineData: { mimeType: 'image/jpeg', data: heroRef.current.base64 } });
        }
        if (friendRef.current?.base64) {
            contents.push({ text: "REFERENCE 2 [CO-STAR]:" });
            contents.push({ inlineData: { mimeType: 'image/jpeg', data: friendRef.current.base64 } });
        }

        const styleEra = selectedGenre === 'Custom' ? "Modern American" : selectedGenre;
        let promptText = `STYLE: ${styleEra} comic book art, detailed ink, vibrant colors. `;

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

    const wrapInWav = (base64Pcm: string): string => {
        const pcmData = atob(base64Pcm);
        const dataLength = pcmData.length;
        const header = new ArrayBuffer(44);
        const view = new DataView(header);

        /* RIFF identifier */
        view.setUint32(0, 0x52494646, false); // "RIFF"
        /* file length */
        view.setUint32(4, 36 + dataLength, true);
        /* RIFF type */
        view.setUint32(8, 0x57415645, false); // "WAVE"
        /* format chunk identifier */
        view.setUint32(12, 0x666d7420, false); // "fmt "
        /* format chunk length */
        view.setUint32(16, 16, true);
        /* sample format (raw) */
        view.setUint16(20, 1, true);
        /* channel count */
        view.setUint16(22, 1, true);
        /* sample rate */
        view.setUint32(24, 24000, true);
        /* byte rate (sample rate * block align) */
        view.setUint32(28, 48000, true);
        /* block align (channel count * bytes per sample) */
        view.setUint16(32, 2, true);
        /* bits per sample */
        view.setUint16(34, 16, true);
        /* data chunk identifier */
        view.setUint32(36, 0x64617461, false); // "data"
        /* data chunk length */
        view.setUint32(40, dataLength, true);

        const headerBlob = new Uint8Array(header);
        const pcmBlob = new Uint8Array(dataLength);
        for (let i = 0; i < dataLength; i++) {
            pcmBlob[i] = pcmData.charCodeAt(i);
        }

        const combined = new Uint8Array(44 + dataLength);
        combined.set(headerBlob);
        combined.set(pcmBlob, 44);

        // Convert byte array back to base64
        let binary = '';
        const len = combined.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(combined[i]);
        }
        return btoa(binary);
    };

    const generateAudio = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
        if (!text) return '';
        try {
            const ai = getAI();
            const response = await ai.models.generateContent({
                model: MODEL_AUDIO_NAME,
                contents: [{ parts: [{ text: `Recite this comic narration with an expressive, dramatic voice: "${text}"` }] }],
                config: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: voiceName // Options: Kore, Charon, Aoede, etc.
                            },
                        },
                    },
                },
            });

            const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!data) return '';

            // Wrap the raw 24kHz PCM data in a WAV container for the browser
            return wrapInWav(data);
        } catch (e) {
            console.error("Audio generation failed", e);
            return '';
        }
    };

    const updateFaceState = (id: string, updates: Partial<ComicFace>) => {
        setComicFaces(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
        const idx = historyRef.current.findIndex(f => f.id === id);
        if (idx !== -1) historyRef.current[idx] = { ...historyRef.current[idx], ...updates };
    };

    const generateSinglePage = async (faceId: string, pageNum: number, type: ComicFace['type']) => {
        const isDecision = DECISION_PAGES.includes(pageNum);
        let beat: Beat = { scene: "", choices: [], focus_char: 'other' };

        if (type === 'cover') {
            // Cover beat is handled in generateImage
        } else if (type === 'back_cover') {
            beat = { scene: "Thematic teaser image", choices: [], focus_char: 'other' };
        } else {
            beat = await generateBeat(historyRef.current, pageNum % 2 === 0, pageNum, isDecision);
        }

        if (beat.focus_char === 'friend' && !friendRef.current && type === 'story') {
            try {
                const newSidekick = await generatePersona(selectedGenre === 'Custom' ? "A fitting sidekick for this story" : `Sidekick for ${selectedGenre} story.`);
                setFriend(newSidekick);
            } catch (e) { beat.focus_char = 'other'; }
        }

        updateFaceState(faceId, { narrative: beat, choices: beat.choices, isDecisionPage: isDecision });

        // Generate Image only
        const url = await generateImage(beat, type);
        updateFaceState(faceId, { imageUrl: url, isLoading: false });
    };

    // --- Narration Background Queue ---
    useEffect(() => {
        if (!narrationEnabled || !isStarted || isNarrating) return;

        const processNextNarration = async () => {
            const nextFace = comicFaces.find(f =>
                f.imageUrl &&
                (f.narrative?.caption || f.narrative?.dialogue) &&
                !f.audioBase64 &&
                f.type !== 'cover' &&
                f.type !== 'back_cover'
            );

            if (nextFace) {
                setIsNarrating(true);
                try {
                    console.log(`Generating narration for page ${nextFace.pageIndex}...`);

                    const caption = nextFace.narrative?.caption || '';
                    const dialogue = nextFace.narrative?.dialogue ? ` ${nextFace.narrative.focus_char === 'hero' ? 'The hero says: ' : 'The sidekick says: '}${nextFace.narrative.dialogue}` : '';
                    const fullText = `${caption}${dialogue}`.trim();

                    // Voice Selection Logic
                    let voice = 'Kore'; // Default narrator
                    if (nextFace.narrative?.focus_char === 'hero' && heroRef.current) {
                        voice = heroRef.current.gender === 'male' ? 'Charon' : 'Kore';
                    } else if (nextFace.narrative?.focus_char === 'friend' && friendRef.current) {
                        voice = friendRef.current.gender === 'male' ? 'Charon' : 'Kore';
                    }

                    const audio = await generateAudio(fullText, voice);
                    if (audio) {
                        updateFaceState(nextFace.id, { audioBase64: audio });
                    } else {
                        // Mark as failed to prevent infinite retry loop
                        updateFaceState(nextFace.id, { audioBase64: 'FAILED' });
                    }
                } catch (e) {
                    console.error("Narration queue error:", e);
                    updateFaceState(nextFace.id, { audioBase64: 'FAILED' });
                } finally {
                    setIsNarrating(false);
                }
            }
        };

        processNextNarration();
    }, [comicFaces, narrationEnabled, isStarted, isNarrating]);

    const generateBatch = async (startPage: number, count: number) => {
        const pagesToGen: number[] = [];
        for (let i = 0; i < count; i++) {
            const p = startPage + i;
            if (p <= TOTAL_PAGES && !generatingPages.current.has(p)) {
                pagesToGen.push(p);
            }
        }

        if (pagesToGen.length === 0) return;
        pagesToGen.forEach(p => generatingPages.current.add(p));

        const newFaces: ComicFace[] = [];
        pagesToGen.forEach(pageNum => {
            const type = pageNum === BACK_COVER_PAGE ? 'back_cover' : 'story';
            newFaces.push({ id: `page-${pageNum}`, type, choices: [], isLoading: true, pageIndex: pageNum });
        });

        setComicFaces(prev => {
            const existing = new Set(prev.map(f => f.id));
            return [...prev, ...newFaces.filter(f => !existing.has(f.id))];
        });
        newFaces.forEach(f => { if (!historyRef.current.find(h => h.id === f.id)) historyRef.current.push(f); });

        try {
            for (const pageNum of pagesToGen) {
                await generateSinglePage(`page-${pageNum}`, pageNum, pageNum === BACK_COVER_PAGE ? 'back_cover' : 'story');
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
            await generateBatch(1, INITIAL_PAGES);
            generateBatch(3, 3);
        }, 1100);
    };

    const handleChoice = async (pageIndex: number, choice: string) => {
        updateFaceState(`page-${pageIndex}`, { resolvedChoice: choice });
        const maxPage = Math.max(...historyRef.current.map(f => f.pageIndex || 0));
        if (maxPage + 1 <= TOTAL_PAGES) {
            generateBatch(maxPage + 1, BATCH_SIZE);
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

        const getFace = (pIdx: number) => comicFaces.find(f => f.pageIndex === pIdx && f.imageUrl && !f.isLoading);

        // 1. COVER
        const cover = getFace(0);
        if (cover?.imageUrl) {
            doc.addImage(cover.imageUrl, 'JPEG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
        }

        // 2. INTERNAL SPREADS (1-2, 3-4, ...)
        for (let i = 1; i <= MAX_STORY_PAGES; i += 2) {
            const left = getFace(i);
            const right = getFace(i + 1);

            if (left || right) {
                // Add a landscape spread page
                doc.addPage([PAGE_WIDTH * 2, PAGE_HEIGHT], 'landscape');
                if (left?.imageUrl) doc.addImage(left.imageUrl, 'JPEG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
                if (right?.imageUrl) doc.addImage(right.imageUrl, 'JPEG', PAGE_WIDTH, 0, PAGE_WIDTH, PAGE_HEIGHT);
            }
        }

        // 3. BACK COVER
        const backCover = getFace(BACK_COVER_PAGE);
        if (backCover?.imageUrl) {
            doc.addPage([PAGE_WIDTH, PAGE_HEIGHT], 'portrait');
            doc.addImage(backCover.imageUrl, 'JPEG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
        }

        doc.save('Infinite-Heroes-Issue.pdf');
    };

    const getDigitalHtml = () => {
        const title = `Infinite Heroes - ${selectedGenre}`;
        const faces = comicFaces
            .filter(f => f.imageUrl && !f.isLoading)
            .sort((a, b) => (a.pageIndex || 0) - (b.pageIndex || 0));

        const dataTemplates = faces.map((f, i) => `
    <div class="page-data" id="data-${i}" data-audio="${f.audioBase64 !== 'FAILED' ? (f.audioBase64 || '') : ''}">
        <img class="lazy-image" data-src="${f.imageUrl}" />
    </div>`).join('');

        return `
<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta charset="UTF-8">
    <style>
        body { background: #000; color: white; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; display: flex; flex-direction: column; align-items: center; min-height: 100vh; -webkit-font-smoothing: antialiased; }
        .container { position: relative; width: 100%; max-width: 600px; margin-top: 5px; background: #000; display: flex; align-items: center; justify-content: center; flex: 1; }
        #pageImage { width: 100%; height: auto; max-height: 80vh; object-fit: contain; border-bottom: 2px solid #333; }
        .controls { width: 100%; padding: 20px; display: flex; justify-content: center; gap: 15px; background: #111; border-top: 1px solid #333; padding-bottom: env(safe-area-inset-bottom); }
        button { background: #ff4444; color: white; border: none; padding: 12px 25px; font-size: 1.1rem; cursor: pointer; font-weight: bold; border-radius: 12px; text-transform: uppercase; -webkit-tap-highlight-color: transparent; }
        button:active { opacity: 0.7; transform: scale(0.95); }
        button:disabled { background: #333; color: #666; }
        .page-info { font-size: 1rem; align-self: center; font-weight: bold; min-width: 90px; text-align: center; }
        h1 { font-style: italic; color: #ffd700; margin: 10px 0 5px 0; font-size: 1.2rem; text-align: center; }
        .ios-tip { font-size: 0.75rem; color: #aaa; margin: 5px 0; padding: 10px; background: #222; border-radius: 8px; margin: 0 10px 10px 10px; }
        
        #overlay { position: fixed; inset: 0; background: #000; z-index: 1000; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px; }
        #startBtn { font-size: 1.5rem; padding: 15px 40px; background: #22c55e; margin-top: 20px; }
        .hidden-data { display: none; }
    </style>
</head>
<body>
    <div id="overlay">
        <h1 style="font-size: 2rem;">${title}</h1>
        <p>TAP BELOW TO START YOUR ADVENTURE</p>
        <button id="startBtn">PLAY STORY</button>
        <p style="margin-top: 20px; color: #666; font-size: 0.8rem;">(Enabled audio on mobile)</p>
    </div>

    <h1>${title}</h1>
    <div class="ios-tip">
        <b>iPhone Tip:</b> If images don't load, tap the <b>Share icon</b> (square with up arrow) at the top right and select <b>"Open in Safari"</b>.
    </div>
    
    <div class="container">
        <img id="pageImage" src="" />
    </div>

    <div class="controls">
        <button id="prevBtn">BACK</button>
        <span class="page-info">PAGE <span id="pageNum">1</span> / ${faces.length}</span>
        <button id="nextBtn">NEXT</button>
    </div>

    <audio id="mainAudio"></audio>

    <div class="hidden-data">
        ${dataTemplates}
    </div>

    <script>
        let currentIndex = 0;
        const totalPages = ${faces.length};
        const img = document.getElementById('pageImage');
        const num = document.getElementById('pageNum');
        const next = document.getElementById('nextBtn');
        const prev = document.getElementById('prevBtn');
        const audio = document.getElementById('mainAudio');
        const overlay = document.getElementById('overlay');
        const startBtn = document.getElementById('startBtn');

        function update() {
            const data = document.getElementById('data-' + currentIndex);
            const sourceImg = data.querySelector('img');
            
            // UI Update
            img.src = sourceImg.getAttribute('data-src');
            num.innerText = currentIndex + 1;
            prev.disabled = currentIndex === 0;
            next.disabled = currentIndex === totalPages - 1;

            // Audio Logic
            audio.pause();
            const audioData = data.getAttribute('data-audio');
            if (audioData && audioData !== '') {
                audio.src = 'data:audio/wav;base64,' + audioData;
                audio.play().catch(e => console.log("Audio failed", e));
            }
        }

        startBtn.onclick = () => {
            overlay.style.display = 'none';
            // Unlock audio on iOS
            audio.play().catch(() => {});
            update();
        };

        prev.onclick = (e) => { e.stopPropagation(); if(currentIndex > 0) { currentIndex--; update(); } };
        next.onclick = (e) => { e.stopPropagation(); if(currentIndex < totalPages - 1) { currentIndex++; update(); } };

        update(); // Early load for image
    </script>
</body>
</html>
        `;
    };

    const downloadDigitalEdition = () => {
        const htmlContent = getDigitalHtml();
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Infinite-Heroes-Digital-Edition.html';
        a.click();
        URL.revokeObjectURL(url);
    };

    const downloadZipEdition = async () => {
        const zip = new JSZip();
        const htmlContent = getDigitalHtml();
        zip.file("Story.html", htmlContent);

        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Infinite-Heroes-Digital-Edition.zip';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleHeroUpload = async (file: File) => {
        try { const base64 = await fileToBase64(file); setHero({ base64, desc: "The Main Hero", gender: 'female' }); } catch (e) { alert("Hero upload failed"); }
    };
    const handleFriendUpload = async (file: File) => {
        try { const base64 = await fileToBase64(file); setFriend({ base64, desc: "The Sidekick/Rival", gender: 'female' }); } catch (e) { alert("Friend upload failed"); }
    };

    const handleGenderChange = (personaType: 'hero' | 'friend', gender: 'male' | 'female') => {
        if (personaType === 'hero' && hero) {
            setHero({ ...hero, gender });
        } else if (personaType === 'friend' && friend) {
            setFriend({ ...friend, gender });
        }
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
                onHeroUpload={handleHeroUpload}
                onFriendUpload={handleFriendUpload}
                onGenreChange={setSelectedGenre}
                onLanguageChange={setSelectedLanguage}
                onPremiseChange={setCustomPremise}
                onRichModeChange={setRichMode}
                narrationEnabled={narrationEnabled}
                onNarrationChange={setNarrationEnabled}
                onGenderChange={handleGenderChange}
                onLaunch={launchStory}
            />

            <Book
                comicFaces={comicFaces}
                currentSheetIndex={currentSheetIndex}
                isStarted={isStarted}
                isSetupVisible={showSetup && !isTransitioning}
                onSheetClick={handleSheetClick}
                onChoice={handleChoice}
                onOpenBook={() => setCurrentSheetIndex(1)}
                onDownload={downloadPDF}
                onExportDigital={() => downloadDigitalEdition()}
                onExportZip={() => downloadZipEdition()}
                onReset={resetApp}
            />
        </div>
    );
};

export default App;
