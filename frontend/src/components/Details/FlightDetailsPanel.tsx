'use client';

import { useFlightStore } from '@/store/flightStore';
import { useUIStore } from '@/store/uiStore';
import {
    getCategoryColor,
    getCategoryLabel,
    formatAltitude,
    formatSpeed,
    formatHeading,
    formatVerticalRate,
    formatCoord,
    timeAgo,
} from '@/lib/utils';
import { X, Plane, Navigation, Gauge, ArrowUp, Clock, Globe } from 'lucide-react';

export function FlightDetailsPanel() {
    const { selectedFlight, selectFlight } = useFlightStore();
    const { rightPanelOpen, toggleRightPanel } = useUIStore();

    if (!selectedFlight && !rightPanelOpen) return null;

    const flight = selectedFlight;
    const color = flight ? getCategoryColor(flight.category) : '#00d4ff';

    return (
        <div className="hud-panel border-l border-hud-border h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center justify-between px-3 py-2 border-b"
                style={{ borderColor: color + '44' }}
            >
                <div className="flex items-center gap-2">
                    <Plane size={12} style={{ color }} />
                    <span className="font-mono text-xs tracking-wider" style={{ color }}>
                        FLIGHT INTEL
                    </span>
                </div>
                <button
                    onClick={() => {
                        selectFlight(null);
                        if (rightPanelOpen) toggleRightPanel();
                    }}
                    className="text-hud-text-dim hover:text-hud-text transition-colors"
                >
                    <X size={12} />
                </button>
            </div>

            {!flight ? (
                <div className="flex-1 flex items-center justify-center text-hud-text-dim font-mono text-xs text-center p-4">
                    <div>
                        <Plane size={24} className="mx-auto mb-2 opacity-30" />
                        <div>Click a flight on the map</div>
                        <div className="text-[10px] mt-1">to view details</div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-3 space-y-4 font-mono text-xs">
                    {/* Callsign / ID */}
                    <div className="text-center py-2 border rounded" style={{ borderColor: color + '44', background: color + '0a' }}>
                        <div className="text-lg font-bold" style={{ color }}>
                            {flight.callsign || flight.flight_id.toUpperCase()}
                        </div>
                        <div className="text-hud-text-dim text-[10px] mt-0.5">
                            ICAO: {flight.flight_id.toUpperCase()}
                        </div>
                        <div
                            className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] border"
                            style={{ borderColor: color, color, background: color + '15' }}
                        >
                            {getCategoryLabel(flight.category)}
                        </div>
                    </div>

                    {/* Position */}
                    <Section title="POSITION" icon={<Globe size={10} />}>
                        <Row label="LAT" value={formatCoord(flight.latitude, 'lat')} />
                        <Row label="LON" value={formatCoord(flight.longitude, 'lon')} />
                        <Row
                            label="STATUS"
                            value={flight.on_ground ? 'ON GROUND' : 'AIRBORNE'}
                            valueColor={flight.on_ground ? '#ffaa00' : '#00ff88'}
                        />
                    </Section>

                    {/* Dynamics */}
                    <Section title="DYNAMICS" icon={<Gauge size={10} />}>
                        <Row label="ALTITUDE" value={formatAltitude(flight.altitude)} />
                        <Row label="SPEED" value={formatSpeed(flight.velocity)} />
                        <Row label="HEADING" value={formatHeading(flight.heading)} />
                        <Row label="V/RATE" value={formatVerticalRate(flight.vertical_rate)}
                            valueColor={
                                flight.vertical_rate === null ? undefined
                                    : flight.vertical_rate > 0 ? '#00ff88'
                                        : flight.vertical_rate < 0 ? '#ff3355'
                                            : undefined
                            }
                        />
                    </Section>

                    {/* Origin */}
                    <Section title="ORIGIN" icon={<Navigation size={10} />}>
                        <Row label="COUNTRY" value={flight.origin_country || 'Unknown'} />
                        <Row label="ORIGIN" value={flight.origin_airport || 'N/A'} />
                        <Row label="DEST" value={flight.destination_airport || 'N/A'} />
                        {flight.squawk && <Row label="SQUAWK" value={flight.squawk} />}
                    </Section>

                    {/* Timing */}
                    <Section title="SIGNAL" icon={<Clock size={10} />}>
                        <Row label="LAST SEEN" value={timeAgo(flight.last_contact)} />
                        <Row label="ICAO24" value={flight.flight_id.toUpperCase()} />
                        <Row label="TRAIL" value="↗ Drawn on map (60 min)" valueColor="#00d4ff" />
                    </Section>

                    {/* Disclaimer */}
                    <div className="text-[9px] text-hud-text-dim border border-hud-border rounded p-2 leading-relaxed">
                        ⚠ Data sourced from OpenSky Network. For informational purposes only. Not for navigation.
                    </div>
                </div>
            )}
        </div>
    );
}

function Section({
    title,
    icon,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div className="flex items-center gap-1.5 text-hud-text-dim text-[10px] mb-1.5 tracking-wider">
                {icon}
                <span>{title}</span>
                <div className="flex-1 h-px bg-hud-border ml-1" />
            </div>
            <div className="space-y-1">{children}</div>
        </div>
    );
}

function Row({
    label,
    value,
    valueColor,
}: {
    label: string;
    value: string;
    valueColor?: string;
}) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-hud-text-dim text-[10px]">{label}</span>
            <span className="text-hud-text text-[11px]" style={{ color: valueColor }}>
                {value}
            </span>
        </div>
    );
}
