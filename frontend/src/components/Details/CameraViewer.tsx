'use client';

import { useUIStore } from '@/store/uiStore';
import { useCameraStore } from '@/store/cameraStore';
import { X, Camera, MapPin, ExternalLink, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export function CameraViewer() {
    const { selectedCamera, setCameraViewerOpen, selectCamera } = useUIStore();
    const { cameras } = useCameraStore();
    const [refreshKey, setRefreshKey] = useState(0);

    if (!selectedCamera) return null;

    const close = () => { setCameraViewerOpen(false); selectCamera(null); };

    // Determine the best URL to show
    const embedUrl = selectedCamera.stream_url;
    const windyId = selectedCamera.id.match(/^windy_(\d+)$/)?.[1];
    const windyPageUrl = windyId ? `https://www.windy.com/webcams/${windyId}` : null;

    // Windy embed: use their public embed player directly
    // Format confirmed from API: https://webcams.windy.com/webcams/public/embed/player/{id}/day
    const windyEmbedUrl = windyId
        ? `https://webcams.windy.com/webcams/public/embed/player/${windyId}/day`
        : null;

    const finalEmbedUrl = windyEmbedUrl || embedUrl;
    const isWindy = !!windyId;
    const isTfL = selectedCamera.id.startsWith('tfl_');

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
            <div
                className="hud-panel-bright rounded-lg w-full max-w-3xl mx-4 overflow-hidden animate-fade-in"
                style={{ border: '1px solid #1a4a6e', boxShadow: '0 0 40px rgba(0,212,255,0.1)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-hud-border">
                    <div className="flex items-center gap-2">
                        <Camera size={14} className="text-hud-green" />
                        <span className="font-mono text-sm text-hud-green tracking-wider">CCTV FEED</span>
                        <span className="font-mono text-[10px] text-hud-text-dim px-2 py-0.5 rounded border border-hud-border ml-2">
                            {selectedCamera.type.toUpperCase()}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setRefreshKey((k) => k + 1)}
                            className="p-1.5 text-hud-text-dim hover:text-hud-cyan transition-colors"
                            title="Reload"
                        >
                            <RefreshCw size={12} />
                        </button>
                        {(windyPageUrl || selectedCamera.stream_url) && (
                            <a
                                href={windyPageUrl || selectedCamera.stream_url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-hud-text-dim hover:text-hud-cyan transition-colors"
                                title="Open on Windy.com"
                            >
                                <ExternalLink size={12} />
                            </a>
                        )}
                        <button onClick={close} className="p-1.5 text-hud-text-dim hover:text-hud-text">
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* Camera info */}
                <div className="px-4 py-2 border-b border-hud-border bg-hud-bg/40">
                    <div className="font-mono text-sm text-hud-text-bright">{selectedCamera.name}</div>
                    <div className="flex items-center gap-4 mt-0.5 font-mono text-[10px] text-hud-text-dim">
                        <span className="flex items-center gap-1">
                            <MapPin size={9} />
                            {selectedCamera.latitude.toFixed(4)}°, {selectedCamera.longitude.toFixed(4)}°
                        </span>
                        {selectedCamera.city && <span>{selectedCamera.city}</span>}
                        {selectedCamera.country && (
                            <span className="px-1.5 py-0.5 rounded border border-hud-border">{selectedCamera.country}</span>
                        )}
                    </div>
                </div>

                {/* Feed */}
                <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>

                    {/* TfL: show image directly */}
                    {isTfL && selectedCamera.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            key={refreshKey}
                            src={selectedCamera.image_url}
                            alt={selectedCamera.name}
                            className="w-full h-full object-cover"
                        />
                    )}

                    {/* Windy embed — no sandbox, allow all scripts */}
                    {isWindy && windyEmbedUrl && (
                        <iframe
                            key={`${windyId}-${refreshKey}`}
                            src={windyEmbedUrl}
                            className="w-full h-full border-0"
                            allow="autoplay; fullscreen; encrypted-media"
                            allowFullScreen
                            title={selectedCamera.name}
                        // No sandbox — Windy player needs unrestricted script execution
                        />
                    )}

                    {/* Other embeds */}
                    {!isWindy && !isTfL && finalEmbedUrl && (
                        <iframe
                            key={refreshKey}
                            src={finalEmbedUrl}
                            className="w-full h-full border-0"
                            allow="autoplay; fullscreen"
                            allowFullScreen
                            title={selectedCamera.name}
                        />
                    )}

                    {/* No feed available */}
                    {!isWindy && !isTfL && !finalEmbedUrl && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 font-mono text-hud-text-dim">
                            <Camera size={28} className="opacity-20" />
                            <div className="text-sm">No live feed available</div>
                        </div>
                    )}

                    {/* HUD overlay */}
                    <div className="absolute top-2 left-2 font-mono text-[10px] text-hud-green bg-black/70 px-2 py-0.5 rounded pointer-events-none">
                        ● REC
                    </div>
                    <div className="absolute top-2 right-2 font-mono text-[10px] text-hud-text-dim bg-black/70 px-2 py-0.5 rounded pointer-events-none">
                        {new Date().toISOString().substring(0, 19)}Z
                    </div>
                </div>

                {/* Camera list */}
                <div className="border-t border-hud-border">
                    <div className="px-4 py-2 font-mono text-[10px] text-hud-text-dim tracking-wider">
                        OTHER CAMERAS ({cameras.length} total)
                    </div>
                    <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
                        {cameras.slice(0, 12).map((cam) => (
                            <button
                                key={cam.id}
                                onClick={() => selectCamera(cam)}
                                className={`shrink-0 px-3 py-1.5 rounded border font-mono text-[10px] transition-colors whitespace-nowrap ${cam.id === selectedCamera.id
                                        ? 'border-hud-green text-hud-green bg-hud-green/10'
                                        : 'border-hud-border text-hud-text-dim hover:border-hud-green/40 hover:text-hud-text'
                                    }`}
                            >
                                {cam.city || cam.name.split(',')[0].substring(0, 15)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
