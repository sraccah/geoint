'use client';

import { Flight } from '@/types';
import { getCategoryColor, getCategoryLabel, formatAltitude, formatSpeed, formatHeading } from '@/lib/utils';

interface Props {
    flight: Flight;
    position: { x: number; y: number };
}

export function FlightPopup({ flight, position }: Props) {
    const color = getCategoryColor(flight.category);

    return (
        <div
            className="fixed z-50 pointer-events-none"
            style={{ left: position.x + 20, top: position.y - 10 }}
        >
            <div className="hud-panel rounded p-3 min-w-[180px] text-xs font-mono"
                style={{ borderColor: color, boxShadow: `0 0 12px ${color}22` }}>
                <div className="font-bold mb-1" style={{ color }}>
                    {flight.callsign || flight.flight_id.toUpperCase()}
                </div>
                <div className="text-hud-text-dim space-y-0.5">
                    <div className="flex justify-between gap-4">
                        <span>TYPE</span>
                        <span style={{ color }}>{getCategoryLabel(flight.category)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span>ALT</span>
                        <span className="text-hud-text">{formatAltitude(flight.altitude)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span>SPD</span>
                        <span className="text-hud-text">{formatSpeed(flight.velocity)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span>HDG</span>
                        <span className="text-hud-text">{formatHeading(flight.heading)}</span>
                    </div>
                    {flight.origin_country && (
                        <div className="flex justify-between gap-4">
                            <span>REG</span>
                            <span className="text-hud-text">{flight.origin_country}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
