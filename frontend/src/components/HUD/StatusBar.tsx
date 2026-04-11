'use client';

import { useFlightStore } from '@/store/flightStore';
import { useCameraStore } from '@/store/cameraStore';
import { timeAgo } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

export function StatusBar() {
    const { flights, isConnected, lastUpdate, dataSourceError } = useFlightStore();
    const { cameras } = useCameraStore();

    // Only show error if it's a real outage — not routine OpenSky rate-limiting
    // OpenSky rate-limits are expected; airplanes.live keeps data flowing
    const isRealError = dataSourceError &&
        !dataSourceError.toLowerCase().includes('opensky') &&
        !dataSourceError.toLowerCase().includes('rate limit');

    return (
        <div className="hud-panel border-t border-hud-border px-4 py-1 flex items-center justify-between font-mono text-[10px] text-hud-text-dim z-20 shrink-0">
            <div className="flex items-center gap-4">
                <span>SOURCE: <span className="text-hud-cyan">OpenSky · airplanes.live</span></span>
                <span>FLIGHTS: <span className="text-hud-cyan">{flights.length.toLocaleString()}</span></span>
                <span>CAMERAS: <span className="text-hud-green">{cameras.length}</span></span>
            </div>

            <div className="flex items-center gap-4">
                {isRealError && (
                    <span className="flex items-center gap-1 text-hud-amber">
                        <AlertTriangle size={10} />
                        {dataSourceError}
                    </span>
                )}

                <span className="hidden sm:block text-hud-text-dim">
                    ⚠ FOR INFORMATIONAL USE ONLY — NOT FOR NAVIGATION
                </span>

                {lastUpdate && (
                    <span>UPDATED: <span className="text-hud-text">{timeAgo(lastUpdate / 1000)}</span></span>
                )}

                <span className={isConnected ? 'text-hud-green' : 'text-hud-red'}>
                    {isConnected ? '● CONNECTED' : '○ DISCONNECTED'}
                </span>
            </div>
        </div>
    );
}
