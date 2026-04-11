'use client';

import { useState } from 'react';
import { Layers, Cloud, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAP_STYLES, MapStyleDef, WINDY_FORECAST_KEY, WINDY_LAYERS } from '@/lib/mapStyles';

type Panel = 'style' | 'weather' | null;

interface Props {
    currentStyleId: string;
    onStyleChange: (style: MapStyleDef) => void;
}

function ControlBtn({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded border font-mono text-[10px] tracking-wider transition-all w-full justify-center',
                active
                    ? 'border-hud-cyan text-hud-cyan bg-hud-cyan/10'
                    : 'border-hud-border text-hud-text-dim hover:border-hud-cyan hover:text-hud-cyan bg-hud-bg/90'
            )}
        >
            {children}
        </button>
    );
}

export function MapControls({ currentStyleId, onStyleChange }: Props) {
    const [openPanel, setOpenPanel] = useState<Panel>(null);
    const [activeWeatherLayer, setActiveWeatherLayer] = useState<string | null>(null);

    const currentStyle = MAP_STYLES.find((s) => s.id === currentStyleId) ?? MAP_STYLES[0];
    const toggle = (panel: Panel) => setOpenPanel((p) => (p === panel ? null : panel));

    return (
        <>
            {/* Panel — opens above the buttons on the left side */}
            {openPanel && (
                <div
                    className="absolute z-20 animate-fade-in"
                    style={{ bottom: '100px', left: '12px' }}
                >
                    <div
                        className="hud-panel rounded border border-hud-border-bright overflow-hidden"
                        style={{ width: '260px', boxShadow: '0 0 20px rgba(0,212,255,0.12)' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-hud-border">
                            <span className="font-mono text-[10px] text-hud-cyan tracking-wider">
                                {openPanel === 'style' ? 'MAP STYLE' : 'WEATHER OVERLAY'}
                            </span>
                            <button onClick={() => setOpenPanel(null)} className="text-hud-text-dim hover:text-hud-text">
                                <X size={10} />
                            </button>
                        </div>

                        {/* Style grid */}
                        {openPanel === 'style' && (
                            <div className="grid grid-cols-3 gap-1 p-2">
                                {MAP_STYLES.map((style) => (
                                    <button
                                        key={style.id}
                                        onClick={() => { onStyleChange(style); setOpenPanel(null); }}
                                        className={cn(
                                            'flex flex-col items-center gap-1 px-2 py-2 rounded border font-mono text-[10px] transition-all',
                                            currentStyleId === style.id
                                                ? 'border-hud-cyan text-hud-cyan bg-hud-cyan/10'
                                                : 'border-hud-border text-hud-text-dim hover:border-hud-border-bright hover:text-hud-text'
                                        )}
                                    >
                                        <span className="text-base leading-none">{style.icon}</span>
                                        <span className="tracking-wider text-[9px]">{style.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Weather grid + embed */}
                        {openPanel === 'weather' && (
                            <>
                                <div className="grid grid-cols-3 gap-1 p-2">
                                    {WINDY_LAYERS.map((layer) => (
                                        <button
                                            key={layer.id}
                                            onClick={() => setActiveWeatherLayer((l) => (l === layer.id ? null : layer.id))}
                                            className={cn(
                                                'flex flex-col items-center gap-1 px-2 py-2 rounded border font-mono text-[10px] transition-all',
                                                activeWeatherLayer === layer.id
                                                    ? 'border-hud-cyan text-hud-cyan bg-hud-cyan/10'
                                                    : 'border-hud-border text-hud-text-dim hover:border-hud-border-bright hover:text-hud-text'
                                            )}
                                        >
                                            <span className="text-base leading-none">{layer.icon}</span>
                                            <span className="tracking-wider text-[9px]">{layer.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {activeWeatherLayer && (
                                    <div className="border-t border-hud-border">
                                        <iframe
                                            src={`https://embed.windy.com/embed2.html?lat=25&lon=10&zoom=3&level=surface&overlay=${activeWeatherLayer}&product=ecmwf&key=${WINDY_FORECAST_KEY}`}
                                            className="w-full border-0"
                                            style={{ height: '160px' }}
                                            title="Windy Weather"
                                            allow="fullscreen"
                                        />
                                    </div>
                                )}

                                <div className="px-3 py-1 font-mono text-[9px] text-hud-text-dim border-t border-hud-border">
                                    Powered by <span className="text-hud-cyan">Windy.com</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Buttons — bottom LEFT, completely separate from MapLibre's bottom-right controls */}
            <div
                className="absolute z-20 flex flex-col gap-1"
                style={{ bottom: '40px', left: '12px', width: '130px' }}
            >
                <ControlBtn active={openPanel === 'style'} onClick={() => toggle('style')}>
                    <Layers size={11} />
                    <span>{currentStyle.icon} {currentStyle.label}</span>
                </ControlBtn>

                <ControlBtn active={openPanel === 'weather'} onClick={() => toggle('weather')}>
                    <Cloud size={11} />
                    <span>{activeWeatherLayer ? `☁ ${activeWeatherLayer.toUpperCase()}` : '☁ WEATHER'}</span>
                </ControlBtn>
            </div>
        </>
    );
}
