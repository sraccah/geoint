'use client';

import { useState } from 'react';
import { WINDY_FORECAST_KEY, WINDY_LAYERS } from '@/lib/mapStyles';
import { cn } from '@/lib/utils';
import { Cloud, X } from 'lucide-react';

export function WeatherOverlay() {
    const [open, setOpen] = useState(false);
    const [activeLayer, setActiveLayer] = useState<string | null>(null);

    const windyUrl = activeLayer
        ? `https://embed.windy.com/embed2.html?lat=25&lon=10&detailLat=25&detailLon=10&width=650&height=450&zoom=3&level=surface&overlay=${activeLayer}&product=ecmwf&menu=&message=true&marker=&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1&key=${WINDY_FORECAST_KEY}`
        : null;

    return (
        <>
            {/* Weather panel */}
            {open && (
                <div className="absolute bottom-30 right-12 z-20 animate-fade-in"
                    style={{ width: '320px' }}>
                    <div className="hud-panel rounded border border-hud-border-bright overflow-hidden"
                        style={{ boxShadow: '0 0 20px rgba(0,212,255,0.1)' }}>
                        <div className="flex items-center justify-between px-3 py-2 border-b border-hud-border">
                            <div className="flex items-center gap-2">
                                <Cloud size={11} className="text-hud-cyan" />
                                <span className="font-mono text-[10px] text-hud-cyan tracking-wider">WEATHER OVERLAY</span>
                            </div>
                            <button onClick={() => setOpen(false)} className="text-hud-text-dim hover:text-hud-text">
                                <X size={11} />
                            </button>
                        </div>

                        {/* Layer selector */}
                        <div className="p-2 grid grid-cols-3 gap-1">
                            {WINDY_LAYERS.map((layer) => (
                                <button
                                    key={layer.id}
                                    onClick={() => setActiveLayer(activeLayer === layer.id ? null : layer.id)}
                                    className={cn(
                                        'flex flex-col items-center gap-1 px-2 py-2 rounded border font-mono text-[10px] transition-all',
                                        activeLayer === layer.id
                                            ? 'border-hud-cyan text-hud-cyan bg-hud-cyan/10'
                                            : 'border-hud-border text-hud-text-dim hover:border-hud-border-bright'
                                    )}
                                >
                                    <span className="text-sm">{layer.icon}</span>
                                    <span>{layer.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Windy embed */}
                        {windyUrl && (
                            <div className="border-t border-hud-border">
                                <iframe
                                    src={windyUrl}
                                    className="w-full border-0"
                                    style={{ height: '220px' }}
                                    title="Windy Weather"
                                    allow="fullscreen"
                                />
                            </div>
                        )}

                        {!activeLayer && (
                            <div className="px-3 py-3 font-mono text-[10px] text-hud-text-dim text-center border-t border-hud-border">
                                Select a layer to show weather overlay
                            </div>
                        )}

                        <div className="px-3 py-1.5 font-mono text-[9px] text-hud-text-dim border-t border-hud-border">
                            Powered by <span className="text-hud-cyan">Windy.com</span> — ECMWF forecast data
                        </div>
                    </div>
                </div>
            )}

            {/* Toggle button */}
            <div className="absolute bottom-10 right-12 z-20">
                <button
                    onClick={() => setOpen((o) => !o)}
                    className={cn(
                        'flex items-center gap-1.5 px-2 py-1.5 rounded border font-mono text-[10px] transition-all',
                        open || activeLayer
                            ? 'border-hud-cyan text-hud-cyan bg-hud-cyan/10'
                            : 'border-hud-border text-hud-text-dim hover:border-hud-cyan hover:text-hud-cyan bg-hud-bg/90'
                    )}
                    title="Weather overlay"
                >
                    <Cloud size={11} />
                    <span>{activeLayer ? `☁ ${activeLayer.toUpperCase()}` : '☁ WEATHER'}</span>
                </button>
            </div>
        </>
    );
}
