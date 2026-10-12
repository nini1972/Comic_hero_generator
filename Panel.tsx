/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { ComicFace, ARTIFACT_LABELS, ArtifactType, StoryMode } from './types';
import { LoadingFX } from './LoadingFX';

interface PanelProps {
    face?: ComicFace;
    allFaces: ComicFace[]; // Needed for cover "printing" status
    gatePage: number;
    initialPages: number;
    storyMode: StoryMode;
    onChoice: (pageIndex: number, choice: string) => void;
    onOpenBook: () => void;
    onDownload: () => void;
    onReset: () => void;
}

// Visual treatment applied per evidence artifact type in Case File mode.
const ARTIFACT_STYLE_CLASS: Record<ArtifactType, string> = {
    cover_sheet: 'artifact-document',
    emergency_calls: 'artifact-transcript',
    camera_footage: 'artifact-footage',
    witness_drawing: 'artifact-drawing',
    responder_notes: 'artifact-document',
    overlooked_detail: 'artifact-document',
    hero_statement: 'artifact-statement',
    closing_summary: 'artifact-document'
};

export const Panel: React.FC<PanelProps> = ({ face, allFaces, gatePage, initialPages, storyMode, onChoice, onOpenBook, onDownload, onReset }) => {
    if (!face) return <div className="w-full h-full bg-gray-950" />;
    if (face.isLoading && !face.imageUrl) return <LoadingFX />;
    
    const isFullBleed = face.type === 'cover' || face.type === 'back_cover';
    const isCaseFile = storyMode === 'case_file';
    const artifactClass = face.artifactType ? `case-file-artifact ${ARTIFACT_STYLE_CLASS[face.artifactType]}` : '';

    return (
        <div className={`panel-container relative group ${isFullBleed ? '!p-0 !bg-[#0a0a0a]' : ''} ${artifactClass}`}>
            <div className="gloss"></div>
            {face.imageUrl && <img src={face.imageUrl} alt="Comic panel" className={`panel-image ${isFullBleed ? '!object-cover' : ''}`} />}

            {/* Evidence Artifact Label */}
            {face.artifactType && (
                <div className="absolute top-0 inset-x-0 bg-black/70 text-yellow-300 text-xs md:text-sm font-mono uppercase tracking-widest px-3 py-1 z-10">
                    {ARTIFACT_LABELS[face.artifactType]}{face.narrative?.timestamp ? ` \u00b7 ${face.narrative.timestamp}` : ''}
                </div>
            )}
            
            {/* Decision Buttons */}
            {face.isDecisionPage && face.choices.length > 0 && (
                <div className={`absolute bottom-0 inset-x-0 p-6 pb-12 flex flex-col gap-3 items-center justify-end transition-opacity duration-500 ${face.resolvedChoice ? 'opacity-0 pointer-events-none' : 'opacity-100'} bg-gradient-to-t from-black/90 via-black/50 to-transparent z-20`}>
                    <p className="text-white font-comic text-2xl uppercase tracking-widest animate-pulse">What drives you?</p>
                    {face.choices.map((choice, i) => (
                        <button key={i} onClick={(e) => { e.stopPropagation(); if(face.pageIndex) onChoice(face.pageIndex, choice); }}
                          className={`comic-btn w-full py-3 text-xl font-bold tracking-wider ${i===0?'bg-yellow-400 hover:bg-yellow-300':'bg-blue-500 text-white hover:bg-blue-400'}`}>
                            {choice}
                        </button>
                    ))}
                </div>
            )}

            {/* Cover Action */}
            {face.type === 'cover' && (
                 <div className="absolute bottom-20 inset-x-0 flex justify-center z-20">
                     <button onClick={(e) => { e.stopPropagation(); onOpenBook(); }}
                      disabled={!allFaces.find(f => f.pageIndex === gatePage)?.imageUrl}
                      className="comic-btn bg-yellow-400 px-10 py-4 text-3xl font-bold hover:scale-105 animate-bounce disabled:animate-none disabled:bg-gray-400 disabled:cursor-wait">
                         {(!allFaces.find(f => f.pageIndex === gatePage)?.imageUrl)
                            ? `${isCaseFile ? 'ASSEMBLING FILE' : 'PRINTING'}... ${allFaces.filter(f => f.type==='story' && f.imageUrl && (f.pageIndex||0) <= gatePage).length}/${initialPages}`
                            : (isCaseFile ? 'OPEN THE FILE' : 'READ ISSUE #1')}
                     </button>
                 </div>
            )}

            {/* Back Cover Actions */}
            {face.type === 'back_cover' && (
                <div className="absolute bottom-24 inset-x-0 flex flex-col items-center gap-4 z-20">
                    <button onClick={(e) => { e.stopPropagation(); onDownload(); }} className="comic-btn bg-blue-500 text-white px-8 py-3 text-xl font-bold hover:scale-105">{isCaseFile ? 'DOWNLOAD CASE FILE' : 'DOWNLOAD ISSUE'}</button>
                    <button onClick={(e) => { e.stopPropagation(); onReset(); }} className="comic-btn bg-green-500 text-white px-8 py-4 text-2xl font-bold hover:scale-105">{isCaseFile ? 'OPEN A NEW CASE' : 'CREATE NEW ISSUE'}</button>
                </div>
            )}
        </div>
    );
}
