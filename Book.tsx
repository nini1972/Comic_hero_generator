/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef } from 'react';
import { ComicFace, TOTAL_PAGES } from './types';
import { Panel } from './Panel';

interface BookProps {
    comicFaces: ComicFace[];
    currentSheetIndex: number;
    isStarted: boolean;
    isSetupVisible: boolean;
    onSheetClick: (index: number) => void;
    onChoice: (pageIndex: number, choice: string) => void;
    onOpenBook: () => void;
    onDownload: () => void;
    onExportDigital: () => void;
    onExportZip: () => void;
    onReset: () => void;
}

export const Book: React.FC<BookProps> = (props) => {
    const sheetsToRender = [];
    if (props.comicFaces.length > 0) {
        sheetsToRender.push({ front: props.comicFaces[0], back: props.comicFaces.find(f => f.pageIndex === 1) });
        for (let i = 2; i <= TOTAL_PAGES; i += 2) {
            sheetsToRender.push({ front: props.comicFaces.find(f => f.pageIndex === i), back: props.comicFaces.find(f => f.pageIndex === i + 1) });
        }
    } else if (props.isSetupVisible) {
        // Placeholder sheet for initial render behind setup
        sheetsToRender.push({ front: undefined, back: undefined });
    }

    const currentAudioRef = useRef<HTMLAudioElement | null>(null);
    const lastStartedIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!props.isStarted || props.isSetupVisible) return;

        // Stop previous session if sheet index changed
        const currentViewKey = `sheet-${props.currentSheetIndex}`;
        if (!lastStartedIdsRef.current.has(currentViewKey)) {
            if (currentAudioRef.current) {
                currentAudioRef.current.pause();
                currentAudioRef.current.onended = null;
                currentAudioRef.current = null;
            }
            lastStartedIdsRef.current.clear();
            lastStartedIdsRef.current.add(currentViewKey);
        }

        // Identify the pages currently visible
        // When index is k, we see Back of Sheet k-1 (Page 2k-1) and Front of Sheet k (Page 2k)
        // Except for k=0 where we only see Page 0 (Cover)
        const activeFaces: ComicFace[] = [];
        if (props.currentSheetIndex === 0) {
            const cover = props.comicFaces.find(f => f.id === 'cover');
            if (cover) activeFaces.push(cover);
        } else {
            const leftFace = props.comicFaces.find(f => f.pageIndex === (props.currentSheetIndex * 2) - 1);
            const rightFace = props.comicFaces.find(f => f.pageIndex === (props.currentSheetIndex * 2));
            if (leftFace) activeFaces.push(leftFace);
            if (rightFace) activeFaces.push(rightFace);
        }

        // Find all faces with audio that haven't played yet in this view
        const facesWithAudio = activeFaces.filter(f => f.audioBase64 && f.audioBase64 !== 'FAILED');

        const playSequentially = async (index: number) => {
            if (index >= facesWithAudio.length) return;

            const face = facesWithAudio[index];
            if (face.audioBase64 && !lastStartedIdsRef.current.has(face.id)) {
                lastStartedIdsRef.current.add(face.id);
                const audio = new Audio(`data:audio/wav;base64,${face.audioBase64}`);
                currentAudioRef.current = audio;

                audio.onended = () => {
                    playSequentially(index + 1);
                };

                try {
                    await audio.play();
                } catch (e) {
                    console.error("Audio playback failed", e);
                    playSequentially(index + 1);
                }
            } else if (lastStartedIdsRef.current.has(face.id)) {
                if (!currentAudioRef.current || currentAudioRef.current.ended) {
                    playSequentially(index + 1);
                }
            }
        };

        playSequentially(0);

        return () => {
            // Let audio continue if unrelated states change. 
            // Cleanup happens when sheet index changes or setup becomes visible.
        };
    }, [props.currentSheetIndex, props.isStarted, props.isSetupVisible, props.comicFaces]);

    return (
        <div className={`book ${props.currentSheetIndex > 0 ? 'opened' : ''} transition-all duration-1000 ease-in-out`}
            style={(props.isSetupVisible) ? { transform: 'translateZ(-600px) translateY(-100px) rotateX(20deg) scale(0.9)', filter: 'blur(6px) brightness(0.7)', pointerEvents: 'none' } : {}}>
            {sheetsToRender.map((sheet, i) => (
                <div key={i} className={`paper ${i < props.currentSheetIndex ? 'flipped' : ''}`} style={{ zIndex: i < props.currentSheetIndex ? i : sheetsToRender.length - i }}
                    onClick={() => props.onSheetClick(i)}>
                    <div className="front">
                        <Panel face={sheet.front} allFaces={props.comicFaces} onChoice={props.onChoice} onOpenBook={props.onOpenBook} onDownload={props.onDownload} onExportDigital={props.onExportDigital} onExportZip={props.onExportZip} onReset={props.onReset} />
                    </div>
                    <div className="back">
                        <Panel face={sheet.back} allFaces={props.comicFaces} onChoice={props.onChoice} onOpenBook={props.onOpenBook} onDownload={props.onDownload} onExportDigital={props.onExportDigital} onExportZip={props.onExportZip} onReset={props.onReset} />
                    </div>
                </div>
            ))}
        </div>
    );
}
