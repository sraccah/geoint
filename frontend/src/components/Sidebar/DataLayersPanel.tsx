'use client';

import { useUIStore } from '@/store/uiStore';
import { useFlightStore } from '@/store/flightStore';
import { useCameraStore } from '@/store/cameraStore';
import { useSatelliteStore } from '@/store/satelliteStore';
import { useSatelliteGroups, useSatelliteGroup } from '@/hooks/useSatellites';
import { cn } from '@/lib/utils';
import { Plane, Camera, Layers, Eye, EyeOff, Satellite, Loader } from 'lucide-react';
import { useState } from 'react';

interface LayerRowProps {
    icon: React.ReactNode;
    label: string;
    count: number | string;
    active: boolean;
    color: string;
    loading?: boolean;
    onToggle: () => void;
}

function LayerRow({ icon, label, count, active, color, loading, onToggle }: LayerRowProps) {
    return (
        <div
            className={cn(
                'flex items-center justify-between px-3 py-2 cursor-pointer transition-colors border-b border-hud-border/50',
                'hover:bg-hud-border/30',
                active ? 'opacity-100' : 'opacity-40'
            )}
            onClick={onToggle}
        >
            <div className="flex items-center gap-2">
                <span style={{ color }}>{icon}</span>
                <span className="font-mono text-xs text-hud-text">{label}</span>
            </div>
            <div className="flex items-center gap-2">
                {loading ? (
                    <Loader size={10} className="text-hud-cyan animate-spin" />
                ) : (
                    <span className="font-mono text-xs" style={{ color }}>{count}</span>
                )}
                {active ? <Eye size={10} className="text-hud-text-dim" /> : <EyeOff size={10} className="text-hud-text-dim" />}
            </div>
        </div>
    );
}

// Satellite group row — loads data on first toggle
function SatGroupRow({ groupId }: { groupId: string }) {
    const { groups, activeGroups, satellites, loading, toggleGroup } = useSatelliteStore();
    const [triggered, setTriggered] = useState(false);

    // Load when triggered
    useSatelliteGroup(triggered ? groupId : null);

    const group = groups.find((g) => g.id === groupId);
    if (!group) return null;

    const active = activeGroups.has(groupId);
    const count = satellites.get(groupId)?.length ?? '—';
    const isLoading = loading.has(groupId);

    const handleToggle = () => {
        if (!triggered) setTriggered(true);
        toggleGroup(groupId);
    };

    return (
        <LayerRow
            icon={<span className="text-xs">{group.icon}</span>}
            label={group.label}
            count={count}
            active={active}
            color={group.color}
            loading={isLoading}
            onToggle={handleToggle}
        />
    );
}

export function DataLayersPanel() {
    const { showFlights, showCameras, toggleFlights, toggleCameras } = useUIStore();
    const { stats } = useFlightStore();
    const { cameras } = useCameraStore();
    const { groups } = useSatelliteStore();
    const [showSatellites, setShowSatellites] = useState(false);

    useSatelliteGroups();

    return (
        <div className="hud-panel border-r border-hud-border flex flex-col h-fit overflow-y-auto max-h-[calc(100vh-200px)]">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-hud-border sticky top-0 bg-hud-panel z-10">
                <Layers size={12} className="text-hud-cyan" />
                <span className="font-mono text-xs text-hud-cyan tracking-wider">DATA LAYERS</span>
            </div>

            {/* Flights */}
            <LayerRow icon={<Plane size={12} />} label="Live Flights" count={stats?.airborne ?? '—'} active={showFlights} color="#00d4ff" onToggle={toggleFlights} />
            <LayerRow icon={<span className="text-xs">✈</span>} label="Commercial" count={stats?.commercial ?? '—'} active={showFlights} color="#00d4ff" onToggle={toggleFlights} />
            <LayerRow icon={<span className="text-xs">📦</span>} label="Cargo" count={stats?.cargo ?? '—'} active={showFlights} color="#ffaa00" onToggle={toggleFlights} />
            <LayerRow icon={<span className="text-xs">⚔</span>} label="Military" count={stats?.military ?? '—'} active={showFlights} color="#ff3355" onToggle={toggleFlights} />
            <LayerRow icon={<span className="text-xs">🚁</span>} label="Helicopter" count={stats?.helicopter ?? '—'} active={showFlights} color="#aa44ff" onToggle={toggleFlights} />

            {/* Cameras */}
            <LayerRow icon={<Camera size={12} />} label="CCTV Mesh" count={cameras.length} active={showCameras} color="#00ff88" onToggle={toggleCameras} />

            {/* Satellites section */}
            <div
                className="flex items-center justify-between px-3 py-2 border-b border-hud-border cursor-pointer hover:bg-hud-border/30 sticky top-8 bg-hud-panel z-10"
                onClick={() => setShowSatellites((s) => !s)}
            >
                <div className="flex items-center gap-2">
                    <Satellite size={12} className="text-hud-cyan" />
                    <span className="font-mono text-xs text-hud-cyan tracking-wider">SATELLITES</span>
                </div>
                <span className="font-mono text-[10px] text-hud-text-dim">{showSatellites ? '▲' : '▼'}</span>
            </div>

            {showSatellites && groups.map((g) => (
                <SatGroupRow key={g.id} groupId={g.id} />
            ))}
        </div>
    );
}
