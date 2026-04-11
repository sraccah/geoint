'use client';

import { useUIStore } from '@/store/uiStore';
import { useFlightStore } from '@/store/flightStore';
import { useCameraStore } from '@/store/cameraStore';
import { cn } from '@/lib/utils';
import { Plane, Camera, Layers, Eye, EyeOff } from 'lucide-react';

interface LayerRowProps {
    icon: React.ReactNode;
    label: string;
    count: number | string;
    active: boolean;
    color: string;
    onToggle: () => void;
}

function LayerRow({ icon, label, count, active, color, onToggle }: LayerRowProps) {
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
                <span className="font-mono text-xs" style={{ color }}>
                    {count}
                </span>
                {active ? (
                    <Eye size={10} className="text-hud-text-dim" />
                ) : (
                    <EyeOff size={10} className="text-hud-text-dim" />
                )}
            </div>
        </div>
    );
}

export function DataLayersPanel() {
    const { showFlights, showCameras, toggleFlights, toggleCameras } = useUIStore();
    const { stats } = useFlightStore();
    const { cameras } = useCameraStore();

    return (
        <div className="hud-panel border-r border-hud-border flex flex-col h-fit">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-hud-border">
                <Layers size={12} className="text-hud-cyan" />
                <span className="font-mono text-xs text-hud-cyan tracking-wider">DATA LAYERS</span>
            </div>

            {/* Layers */}
            <LayerRow
                icon={<Plane size={12} />}
                label="Live Flights"
                count={stats?.airborne ?? '—'}
                active={showFlights}
                color="#00d4ff"
                onToggle={toggleFlights}
            />
            <LayerRow
                icon={<span className="text-xs">✈</span>}
                label="Commercial"
                count={stats?.commercial ?? '—'}
                active={showFlights}
                color="#00d4ff"
                onToggle={toggleFlights}
            />
            <LayerRow
                icon={<span className="text-xs">📦</span>}
                label="Cargo"
                count={stats?.cargo ?? '—'}
                active={showFlights}
                color="#ffaa00"
                onToggle={toggleFlights}
            />
            <LayerRow
                icon={<span className="text-xs">⚔</span>}
                label="Military"
                count={stats?.military ?? '—'}
                active={showFlights}
                color="#ff3355"
                onToggle={toggleFlights}
            />
            <LayerRow
                icon={<span className="text-xs">🚁</span>}
                label="Helicopter"
                count={stats?.helicopter ?? '—'}
                active={showFlights}
                color="#aa44ff"
                onToggle={toggleFlights}
            />
            <LayerRow
                icon={<Camera size={12} />}
                label="CCTV Mesh"
                count={cameras.length}
                active={showCameras}
                color="#00ff88"
                onToggle={toggleCameras}
            />
        </div>
    );
}
