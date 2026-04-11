'use client';

import { useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useFlightStore, ALL_CATEGORIES } from '@/store/flightStore';
import { useCameraStore } from '@/store/cameraStore';
import { useSatelliteStore } from '@/store/satelliteStore';
import { useSatelliteGroups, useSatelliteGroup } from '@/hooks/useSatellites';
import { FlightCategory } from '@/types';
import { getCategoryColor, getCategoryLabel } from '@/lib/utils';
import { cn } from '@/lib/utils';
import * as Slider from '@radix-ui/react-slider';
import {
    Plane, Camera, Satellite, Layers, Eye, EyeOff,
    ChevronDown, ChevronRight, Filter, RotateCcw, Loader,
} from 'lucide-react';

// ── Reusable section header ───────────────────────────────────────────────────
function SectionHeader({
    icon, label, open, onToggle, right,
}: {
    icon: React.ReactNode;
    label: string;
    open: boolean;
    onToggle: () => void;
    right?: React.ReactNode;
}) {
    return (
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between px-3 py-2 border-b border-hud-border hover:bg-hud-border/20 transition-colors"
        >
            <div className="flex items-center gap-2">
                <span className="text-hud-cyan">{icon}</span>
                <span className="font-mono text-xs text-hud-cyan tracking-wider">{label}</span>
            </div>
            <div className="flex items-center gap-2">
                {right}
                {open ? <ChevronDown size={10} className="text-hud-text-dim" /> : <ChevronRight size={10} className="text-hud-text-dim" />}
            </div>
        </button>
    );
}

// ── Layer row ─────────────────────────────────────────────────────────────────
function LayerRow({
    icon, label, count, active, color, loading, onToggle,
}: {
    icon: React.ReactNode; label: string; count: number | string;
    active: boolean; color: string; loading?: boolean; onToggle: () => void;
}) {
    return (
        <div
            onClick={onToggle}
            className={cn(
                'flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors border-b border-hud-border/40 hover:bg-hud-border/20',
                !active && 'opacity-40'
            )}
        >
            <div className="flex items-center gap-2">
                <span style={{ color }} className="text-xs">{icon}</span>
                <span className="font-mono text-xs text-hud-text">{label}</span>
            </div>
            <div className="flex items-center gap-1.5">
                {loading
                    ? <Loader size={9} className="text-hud-cyan animate-spin" />
                    : <span className="font-mono text-xs" style={{ color }}>{count}</span>
                }
                {active
                    ? <Eye size={9} className="text-hud-text-dim" />
                    : <EyeOff size={9} className="text-hud-text-dim" />
                }
            </div>
        </div>
    );
}

// ── Satellite group row (lazy loads on first toggle) ──────────────────────────
function SatGroupRow({ groupId }: { groupId: string }) {
    const { groups, activeGroups, satellites, loading, toggleGroup } = useSatelliteStore();
    const [triggered, setTriggered] = useState(false);
    useSatelliteGroup(triggered ? groupId : null);

    const group = groups.find((g) => g.id === groupId);
    if (!group) return null;

    const active = activeGroups.has(groupId);
    const count = satellites.get(groupId)?.length ?? '—';
    const isLoading = loading.has(groupId);

    return (
        <LayerRow
            icon={group.icon}
            label={group.label}
            count={count}
            active={active}
            color={group.color}
            loading={isLoading}
            onToggle={() => { if (!triggered) setTriggered(true); toggleGroup(groupId); }}
        />
    );
}

// ── Satellite filters ─────────────────────────────────────────────────────────
function SatelliteFilters() {
    const { activeGroups, groups } = useSatelliteStore();
    const [orbitFilter, setOrbitFilter] = useState<string[]>(['LEO', 'MEO', 'GEO', 'SSO', 'Polar']);
    const orbits = ['LEO', 'MEO', 'GEO', 'SSO', 'Polar'];

    const toggleOrbit = (o: string) =>
        setOrbitFilter((f) => f.includes(o) ? f.filter((x) => x !== o) : [...f, o]);

    if (activeGroups.size === 0) {
        return (
            <div className="px-3 py-2 font-mono text-[10px] text-hud-text-dim">
                Enable a satellite group to filter
            </div>
        );
    }

    return (
        <div className="p-3 space-y-3">
            <div>
                <div className="font-mono text-[10px] text-hud-text-dim mb-1.5 tracking-wider">ORBIT TYPE</div>
                <div className="grid grid-cols-3 gap-1">
                    {orbits.map((o) => (
                        <button
                            key={o}
                            onClick={() => toggleOrbit(o)}
                            className={cn(
                                'px-1.5 py-1 rounded border font-mono text-[9px] transition-all',
                                orbitFilter.includes(o)
                                    ? 'border-hud-cyan text-hud-cyan bg-hud-cyan/10'
                                    : 'border-hud-border text-hud-text-dim opacity-40 hover:opacity-70'
                            )}
                        >
                            {o}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Main unified left panel ───────────────────────────────────────────────────
export function LeftPanel() {
    const [flightsOpen, setFlightsOpen] = useState(true);
    const [camerasOpen, setCamerasOpen] = useState(true);
    const [satellitesOpen, setSatellitesOpen] = useState(false);
    const [flightFiltersOpen, setFlightFiltersOpen] = useState(true);
    const [satFiltersOpen, setSatFiltersOpen] = useState(false);

    const { showFlights, showCameras, toggleFlights, toggleCameras } = useUIStore();
    const { stats, filter, setFilter } = useFlightStore();
    const { cameras } = useCameraStore();
    const { groups } = useSatelliteStore();

    useSatelliteGroups();

    const toggleCategory = (cat: FlightCategory) => {
        const current = filter.categories;
        setFilter({
            categories: current.includes(cat)
                ? current.filter((c) => c !== cat)
                : [...current, cat],
        });
    };

    const resetFilters = () => setFilter({
        categories: ['military'],
        minAltitude: 0, maxAltitude: 15000,
        minSpeed: 0, maxSpeed: 1000,
        showOnGround: false,
    });

    return (
        <div className="hud-panel border-r border-hud-border flex flex-col h-full overflow-y-auto">

            {/* ── FLIGHTS ─────────────────────────────────────────────────────── */}
            <SectionHeader
                icon={<Plane size={12} />}
                label="FLIGHTS"
                open={flightsOpen}
                onToggle={() => setFlightsOpen((o) => !o)}
                right={<span className="font-mono text-[10px] text-hud-cyan">{stats?.airborne ?? '—'}</span>}
            />
            {flightsOpen && (
                <>
                    <LayerRow icon={<Plane size={11} />} label="All Flights" count={stats?.airborne ?? '—'} active={showFlights} color="#00d4ff" onToggle={toggleFlights} />
                    <LayerRow icon="✈" label="Commercial" count={stats?.commercial ?? '—'} active={showFlights} color="#00d4ff" onToggle={toggleFlights} />
                    <LayerRow icon="📦" label="Cargo" count={stats?.cargo ?? '—'} active={showFlights} color="#ffaa00" onToggle={toggleFlights} />
                    <LayerRow icon="⚔" label="Military" count={stats?.military ?? '—'} active={showFlights} color="#ff3355" onToggle={toggleFlights} />
                    <LayerRow icon="🚁" label="Helicopter" count={stats?.helicopter ?? '—'} active={showFlights} color="#aa44ff" onToggle={toggleFlights} />
                </>
            )}

            {/* ── FLIGHT FILTERS ──────────────────────────────────────────────── */}
            <SectionHeader
                icon={<Filter size={11} />}
                label="FLIGHT FILTERS"
                open={flightFiltersOpen}
                onToggle={() => setFlightFiltersOpen((o) => !o)}
                right={
                    <button onClick={(e) => { e.stopPropagation(); resetFilters(); }} className="text-hud-text-dim hover:text-hud-cyan" title="Reset">
                        <RotateCcw size={9} />
                    </button>
                }
            />
            {flightFiltersOpen && (
                <div className="p-3 space-y-3">
                    {/* Category toggles */}
                    <div>
                        <div className="font-mono text-[10px] text-hud-text-dim mb-1.5 tracking-wider flex justify-between">
                            <span>FLIGHT TYPE</span>
                            <button onClick={() => setFilter({ categories: [...ALL_CATEGORIES] })} className="text-hud-cyan hover:underline">ALL</button>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                            {ALL_CATEGORIES.map((cat) => {
                                const active = filter.categories.includes(cat);
                                const color = getCategoryColor(cat);
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => toggleCategory(cat)}
                                        className={cn('px-2 py-1 rounded border font-mono text-[10px] transition-all', !active && 'opacity-30 hover:opacity-60')}
                                        style={{ borderColor: active ? color : '#0d2137', color: active ? color : '#4a7a99', background: active ? `${color}11` : 'transparent' }}
                                    >
                                        {getCategoryLabel(cat)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Altitude */}
                    <div>
                        <div className="flex justify-between font-mono text-[10px] text-hud-text-dim mb-1.5">
                            <span className="tracking-wider">ALTITUDE (m)</span>
                            <span className="text-hud-text">{filter.minAltitude.toLocaleString()}–{filter.maxAltitude.toLocaleString()}</span>
                        </div>
                        <Slider.Root className="relative flex items-center w-full h-4" min={0} max={15000} step={500}
                            value={[filter.minAltitude, filter.maxAltitude]}
                            onValueChange={([min, max]) => setFilter({ minAltitude: min, maxAltitude: max })}>
                            <Slider.Track className="relative h-[3px] grow rounded-full bg-hud-border">
                                <Slider.Range className="absolute h-full rounded-full bg-hud-cyan" />
                            </Slider.Track>
                            <Slider.Thumb className="block w-3 h-3 rounded-full bg-hud-cyan border-2 border-hud-bg focus:outline-none cursor-pointer" />
                            <Slider.Thumb className="block w-3 h-3 rounded-full bg-hud-cyan border-2 border-hud-bg focus:outline-none cursor-pointer" />
                        </Slider.Root>
                    </div>

                    {/* Speed */}
                    <div>
                        <div className="flex justify-between font-mono text-[10px] text-hud-text-dim mb-1.5">
                            <span className="tracking-wider">SPEED (m/s)</span>
                            <span className="text-hud-text">{filter.minSpeed}–{filter.maxSpeed}</span>
                        </div>
                        <Slider.Root className="relative flex items-center w-full h-4" min={0} max={1000} step={10}
                            value={[filter.minSpeed, filter.maxSpeed]}
                            onValueChange={([min, max]) => setFilter({ minSpeed: min, maxSpeed: max })}>
                            <Slider.Track className="relative h-[3px] grow rounded-full bg-hud-border">
                                <Slider.Range className="absolute h-full rounded-full bg-hud-amber" />
                            </Slider.Track>
                            <Slider.Thumb className="block w-3 h-3 rounded-full bg-hud-amber border-2 border-hud-bg focus:outline-none cursor-pointer" />
                            <Slider.Thumb className="block w-3 h-3 rounded-full bg-hud-amber border-2 border-hud-bg focus:outline-none cursor-pointer" />
                        </Slider.Root>
                    </div>

                    {/* On ground */}
                    <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-hud-text-dim tracking-wider">SHOW ON GROUND</span>
                        <button
                            onClick={() => setFilter({ showOnGround: !filter.showOnGround })}
                            className={cn('w-8 h-4 rounded-full border transition-all relative', filter.showOnGround ? 'bg-hud-cyan/20 border-hud-cyan' : 'bg-transparent border-hud-border')}
                        >
                            <span className={cn('absolute top-0.5 w-3 h-3 rounded-full transition-all', filter.showOnGround ? 'left-4 bg-hud-cyan' : 'left-0.5 bg-hud-text-dim')} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── CAMERAS ─────────────────────────────────────────────────────── */}
            <SectionHeader
                icon={<Camera size={12} />}
                label="CAMERAS"
                open={camerasOpen}
                onToggle={() => setCamerasOpen((o) => !o)}
                right={<span className="font-mono text-[10px] text-hud-green">{cameras.length}</span>}
            />
            {camerasOpen && (
                <LayerRow icon={<Camera size={11} />} label="CCTV Mesh" count={cameras.length} active={showCameras} color="#00ff88" onToggle={toggleCameras} />
            )}

            {/* ── SATELLITES ──────────────────────────────────────────────────── */}
            <SectionHeader
                icon={<Satellite size={12} />}
                label="SATELLITES"
                open={satellitesOpen}
                onToggle={() => setSatellitesOpen((o) => !o)}
            />
            {satellitesOpen && (
                <>
                    {groups.map((g) => <SatGroupRow key={g.id} groupId={g.id} />)}

                    {/* Satellite filters */}
                    <SectionHeader
                        icon={<Filter size={11} />}
                        label="SAT FILTERS"
                        open={satFiltersOpen}
                        onToggle={() => setSatFiltersOpen((o) => !o)}
                    />
                    {satFiltersOpen && <SatelliteFilters />}
                </>
            )}
        </div>
    );
}
