'use client';

import { useState } from 'react';
import { MAP_STYLES, MapStyleDef } from '@/lib/mapStyles';
import { cn } from '@/lib/utils';
import { Layers } from 'lucide-react';

interface Props {
    currentId: string;
    onChange: (style: MapStyleDef) => void;
}

export function StyleSwitcher({ currentId, onChange }: Props) {
    const [open, setOpen] = useState(false);
    const current = MAP_STYLES.find((s) => s.id === currentId) ?? MAP_STYLES[0];

    return (
        <div className="absolute bottom-20 right-12 z-20 flex flex-col items-end gap-1">
            {/* Expanded panel */}
            {open && (
                <div className="hud-panel rounded border border-hud-border-bright mb-1 p-2 w-52 animate-fade-in"
                    style={{ boxShadow: '0 0 20px rgba(0,212,255,0.1)' }}>
                    <div className="font-mono text-[10px] text-hud-text-dim tracking-wider mb-2 px-1">
                        MAP STYLE
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        {MAP_STYLES.map((style) => (
                            <button
                                key={style.id}
                                onClick={() => { onChange(style); setOpen(false); }}
                                className={cn(
                                    'flex flex-col items-center gap-1 px-2 py-2 rounded border font-mono text-[10px] transition-all',
                                    currentId === style.id
                                        ? 'border-hud-cyan text-hud-cyan bg-hud-cyan/10'
                                        : 'border-hud-border text-hud-text-dim hover:border-hud-border-bright hover:text-hud-text'
                                )}
                            >
                                <span className="text-base leading-none">{style.icon}</span>
                                <span className="tracking-wider">{style.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Toggle button */}
            <button
                onClick={() => setOpen((o) => !o)}
                className={cn(
                    'flex items-center gap-1.5 px-2 py-1.5 rounded border font-mono text-[10px] transition-all',
                    open
                        ? 'border-hud-cyan text-hud-cyan bg-hud-cyan/10'
                        : 'border-hud-border text-hud-text-dim hover:border-hud-cyan hover:text-hud-cyan bg-hud-bg/90'
                )}
                title="Change map style"
            >
                <Layers size={11} />
                <span>{current.icon} {current.label}</span>
            </button>
        </div>
    );
}
