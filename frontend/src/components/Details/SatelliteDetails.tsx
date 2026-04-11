'use client';

import { useSatelliteStore } from '@/store/satelliteStore';
import { getOrbitalInfo, computePosition } from '@/lib/satelliteUtils';
import { X, Satellite, Globe, Clock, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SatellitePosition } from '@/lib/satelliteUtils';

export function SatelliteDetails() {
    const { selectedSatellite, selectSatellite } = useSatelliteStore();
    const [pos, setPos] = useState<SatellitePosition | null>(null);

    useEffect(() => {
        if (!selectedSatellite) { setPos(null); return; }
        const update = () => setPos(computePosition(selectedSatellite));
        update();
        const interval = setInterval(update, 2000);
        return () => clearInterval(interval);
    }, [selectedSatellite]);

    if (!selectedSatellite) return null;

    const orbital = getOrbitalInfo(selectedSatellite);
    const launchYear = selectedSatellite.OBJECT_ID?.substring(0, 4) || '?';

    return (
        <div className="hud-panel border-l border-hud-border h-full flex flex-col overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-hud-border">
                <div className="flex items-center gap-2">
                    <Satellite size={12} className="text-hud-cyan" />
                    <span className="font-mono text-xs text-hud-cyan tracking-wider">SATELLITE INTEL</span>
                </div>
                <button onClick={() => selectSatellite(null)} className="text-hud-text-dim hover:text-hud-text">
                    <X size={12} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4 font-mono text-xs">
                {/* Name */}
                <div className="text-center py-2 border rounded border-hud-cyan/30 bg-hud-cyan/5">
                    <div className="text-sm font-bold text-hud-cyan">{selectedSatellite.OBJECT_NAME}</div>
                    <div className="text-hud-text-dim text-[10px] mt-0.5">
                        NORAD #{selectedSatellite.NORAD_CAT_ID} · {selectedSatellite.OBJECT_ID}
                    </div>
                    <div className="mt-1 inline-block px-2 py-0.5 rounded border border-hud-cyan/40 text-hud-cyan text-[10px]">
                        {orbital.orbitType}
                    </div>
                </div>

                {/* Live position */}
                <Section title="LIVE POSITION" icon={<Globe size={10} />}>
                    <Row label="LAT" value={pos ? `${pos.latitude.toFixed(4)}°` : '—'} />
                    <Row label="LON" value={pos ? `${pos.longitude.toFixed(4)}°` : '—'} />
                    <Row label="ALTITUDE" value={pos ? `${Math.round(pos.altitude).toLocaleString()} km` : '—'} color="#00d4ff" />
                    <Row label="VELOCITY" value={pos ? `${pos.velocity.toFixed(2)} km/s` : '—'} />
                </Section>

                {/* Orbital parameters */}
                <Section title="ORBITAL ELEMENTS" icon={<Zap size={10} />}>
                    <Row label="ORBIT TYPE" value={orbital.orbitType} color="#00ff88" />
                    <Row label="PERIOD" value={`${orbital.period.toFixed(1)} min`} />
                    <Row label="REVS/DAY" value={orbital.revsPerDay.toFixed(4)} />
                    <Row label="INCLINATION" value={`${orbital.inclination.toFixed(4)}°`} />
                    <Row label="ECCENTRICITY" value={orbital.eccentricity.toFixed(7)} />
                    <Row label="AVG ALTITUDE" value={`~${Math.round(orbital.altitude).toLocaleString()} km`} />
                </Section>

                {/* Metadata */}
                <Section title="METADATA" icon={<Clock size={10} />}>
                    <Row label="LAUNCH YEAR" value={launchYear} />
                    <Row label="CLASSIFICATION" value={selectedSatellite.CLASSIFICATION_TYPE === 'U' ? 'UNCLASSIFIED' : selectedSatellite.CLASSIFICATION_TYPE} />
                    <Row label="EPOCH" value={new Date(selectedSatellite.EPOCH).toISOString().substring(0, 16) + 'Z'} />
                    <Row label="REV AT EPOCH" value={String(selectedSatellite.REV_AT_EPOCH)} />
                </Section>

                <div className="text-[9px] text-hud-text-dim border border-hud-border rounded p-2">
                    ↗ Orbital path drawn on map (next ~95 min). Data: CelesTrak/NORAD.
                </div>
            </div>
        </div>
    );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div>
            <div className="flex items-center gap-1.5 text-hud-text-dim text-[10px] mb-1.5 tracking-wider">
                {icon}<span>{title}</span>
                <div className="flex-1 h-px bg-hud-border ml-1" />
            </div>
            <div className="space-y-1">{children}</div>
        </div>
    );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-hud-text-dim text-[10px]">{label}</span>
            <span className="text-[11px]" style={{ color: color || undefined }}>{value}</span>
        </div>
    );
}
