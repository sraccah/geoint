'use client';

import { useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useFlightStore, ALL_CATEGORIES } from '@/store/flightStore';
import { useCameraStore } from '@/store/cameraStore';
import { useSatelliteStore, ALL_ORBIT_TYPES, OrbitType } from '@/store/satelliteStore';
import { useSatelliteGroups, useLoadAllSatelliteGroups } from '@/hooks/useSatellites';
import { FlightCategory } from '@/types';
import { getCategoryColor, getCategoryLabel } from '@/lib/utils';
import { cn } from '@/lib/utils';
import * as Slider from '@radix-ui/react-slider';
import { Plane, Camera, Satellite, Eye, EyeOff, ChevronDown, ChevronRight, Filter, RotateCcw, Loader } from 'lucide-react';

// ── Shared section header ─────────────────────────────────────────────────────
function SectionHeader({ icon, label, open, onToggle, badge, right }: {
    icon: React.ReactNode; label: string; open: boolean;
    onToggle: () => void; badge?: React.ReactNode; right?: React.ReactNode;
}) {
    return (
        <button onClick={onToggle}
            className="w-full flex items-center justify-between px-3 py-2 border-b border-hud-border hover:bg-hud-border/20 transition-colors shrink-0">
            <div className="flex items-center gap-2">
                <span className="text-hud-cyan">{icon}</span>
                <span className="font-mono text-xs text-hud-cyan tracking-wider">{label}</span>
                {badge}
            </div>
            <div className="flex items-center gap-2">
                {right}
                {open ? <ChevronDown size={10} className="text-hud-text-dim" /> : <ChevronRight size={10} className="text-hud-text-dim" />}
            </div>
        </button>
    );
}

// ── Layer row (eye toggle — for cameras only) ─────────────────────────────────
function LayerRow({ icon, label, count, active, color, loading, onToggle }: {
    icon: React.ReactNode; label: string; count: number | string;
    active: boolean; color: string; loading?: boolean; onToggle: () => void;
}) {
    return (
        <div onClick={onToggle}
            className={cn('flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors border-b border-hud-border/40 hover:bg-hud-border/20', !active && 'opacity-40')}>
            <div className="flex items-center gap-2">
                <span style={{ color }} className="text-xs shrink-0">{icon}</span>
                <span className="font-mono text-xs text-hud-text">{label}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                {loading ? <Loader size={9} className="text-hud-cyan animate-spin" /> : <span className="font-mono text-xs" style={{ color }}>{count}</span>}
                {active ? <Eye size={9} className="text-hud-text-dim" /> : <EyeOff size={9} className="text-hud-text-dim" />}
            </div>
        </div>
    );
}

// ── Satellite group tag button (same pattern as flight category tags) ──────────
function SatGroupTag({ groupId }: { groupId: string }) {
    const { groups, visibleGroups, satellites, loading, toggleGroupVisibility } = useSatelliteStore();
    const group = groups.find((g) => g.id === groupId);
    if (!group) return null;

    const visible = visibleGroups.has(groupId);
    const count = satellites.get(groupId)?.length;
    const isLoading = loading.has(groupId);
    const color = group.color;

    return (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-hud-border/40">
            {/* Tag button — toggles visibility */}
            <button
                onClick={() => toggleGroupVisibility(groupId)}
                className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded border font-mono text-[10px] transition-all flex-1 mr-2', !visible && 'opacity-40 hover:opacity-70')}
                style={{ borderColor: visible ? color : '#0d2137', color: visible ? color : '#4a7a99', background: visible ? `${color}11` : 'transparent' }}
            >
                <span>{group.icon}</span>
                <span>{group.label}</span>
            </button>
            {/* Count — always shown regardless of visibility */}
            <span className="font-mono text-xs shrink-0" style={{ color: count ? color : '#4a7a99' }}>
                {isLoading ? <Loader size={9} className="animate-spin" style={{ color }} /> : (count ?? '—')}
            </span>
        </div>
    );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function LeftPanel() {
    const [camerasOpen, setCamerasOpen] = useState(true);
    const [flightsOpen, setFlightsOpen] = useState(true);
    const [flightFiltersOpen, setFlightFiltersOpen] = useState(true);
    const [satellitesOpen, setSatellitesOpen] = useState(true);
    const [satFiltersOpen, setSatFiltersOpen] = useState(true);

    const { showFlights, showCameras, toggleFlights, toggleCameras } = useUIStore();
    const { stats, filter, setFilter } = useFlightStore();
    const { cameras } = useCameraStore();
    const { groups, orbitFilter, toggleOrbitType, setOrbitFilter, visibleGroups, satellites } = useSatelliteStore();

    // Load group list, then eagerly load all TLE data
    useSatelliteGroups();
    useLoadAllSatelliteGroups();

    const toggleCategory = (cat: FlightCategory) => {
        const c = filter.categories;
        setFilter({ categories: c.includes(cat) ? c.filter((x) => x !== cat) : [...c, cat] });
    };

    const resetFlightFilters = () => setFilter({
        categories: ['military'], minAltitude: 0, maxAltitude: 15000,
        minSpeed: 0, maxSpeed: 1000, showOnGround: false,
    });

    // Total count across ALL groups (loaded or not)
    const totalSatCount = groups.reduce((sum, g) => sum + (satellites.get(g.id)?.length ?? 0), 0);
    const visibleSatCount = [...visibleGroups].reduce((sum, gid) => sum + (satellites.get(gid)?.length ?? 0), 0);

    return (
        <div className="hud-panel border-r border-hud-border flex flex-col h-full overflow-y-auto">

            {/* ── 1. CAMERAS ──────────────────────────────────────────────── */}
            <SectionHeader icon={<Camera size={12} />} label="CAMERAS" open={camerasOpen}
                onToggle={() => setCamerasOpen((o) => !o)}
                badge={<span className="font-mono text-[10px] text-hud-green ml-1">{cameras.length}</span>} />
            {camerasOpen && (
                <LayerRow icon={<Camera size={11} />} label="CCTV Mesh" count={cameras.length}
                    active={showCameras} color="#00ff88" onToggle={toggleCameras} />
            )}

            {/* ── 2. FLIGHTS ──────────────────────────────────────────────── */}
            <SectionHeader icon={<Plane size={12} />} label="FLIGHTS" open={flightsOpen}
                onToggle={() => setFlightsOpen((o) => !o)}
                badge={<span className="font-mono text-[10px] text-hud-cyan ml-1">{stats?.airborne ?? '—'}</span>} />
            {flightsOpen && (
                <>
                    <LayerRow icon={<Plane size={11} />} label="All Flights" count={stats?.airborne ?? '—'} active={showFlights} color="#00d4ff" onToggle={toggleFlights} />
                    <LayerRow icon="✈" label="Commercial" count={stats?.commercial ?? '—'} active={showFlights} color="#00d4ff" onToggle={toggleFlights} />
                    <LayerRow icon="📦" label="Cargo" count={stats?.cargo ?? '—'} active={showFlights} color="#ffaa00" onToggle={toggleFlights} />
                    <LayerRow icon="⚔" label="Military" count={stats?.military ?? '—'} active={showFlights} color="#ff3355" onToggle={toggleFlights} />
                    <LayerRow icon="🚁" label="Helicopter" count={stats?.helicopter ?? '—'} active={showFlights} color="#aa44ff" onToggle={toggleFlights} />
                </>
            )}

            {/* ── 3. FLIGHT FILTERS ───────────────────────────────────────── */}
            <SectionHeader icon={<Filter size={11} />} label="FLIGHT FILTERS" open={flightFiltersOpen}
                onToggle={() => setFlightFiltersOpen((o) => !o)}
                right={<button onClick={(e) => { e.stopPropagation(); resetFlightFilters(); }} className="text-hud-text-dim hover:text-hud-cyan"><RotateCcw size={9} /></button>} />
            {flightFiltersOpen && (
                <div className="p-3 space-y-3">
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
                                    <button key={cat} onClick={() => toggleCategory(cat)}
                                        className={cn('px-2 py-1 rounded border font-mono text-[10px] transition-all', !active && 'opacity-30 hover:opacity-60')}
                                        style={{ borderColor: active ? color : '#0d2137', color: active ? color : '#4a7a99', background: active ? `${color}11` : 'transparent' }}>
                                        {getCategoryLabel(cat)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between font-mono text-[10px] text-hud-text-dim mb-1.5">
                            <span className="tracking-wider">ALTITUDE (m)</span>
                            <span className="text-hud-text">{filter.minAltitude.toLocaleString()}–{filter.maxAltitude.toLocaleString()}</span>
                        </div>
                        <Slider.Root className="relative flex items-center w-full h-4" min={0} max={15000} step={500}
                            value={[filter.minAltitude, filter.maxAltitude]}
                            onValueChange={([min, max]) => setFilter({ minAltitude: min, maxAltitude: max })}>
                            <Slider.Track className="relative h-[3px] grow rounded-full bg-hud-border"><Slider.Range className="absolute h-full rounded-full bg-hud-cyan" /></Slider.Track>
                            <Slider.Thumb className="block w-3 h-3 rounded-full bg-hud-cyan border-2 border-hud-bg focus:outline-none cursor-pointer" />
                            <Slider.Thumb className="block w-3 h-3 rounded-full bg-hud-cyan border-2 border-hud-bg focus:outline-none cursor-pointer" />
                        </Slider.Root>
                    </div>
                    <div>
                        <div className="flex justify-between font-mono text-[10px] text-hud-text-dim mb-1.5">
                            <span className="tracking-wider">SPEED (m/s)</span>
                            <span className="text-hud-text">{filter.minSpeed}–{filter.maxSpeed}</span>
                        </div>
                        <Slider.Root className="relative flex items-center w-full h-4" min={0} max={1000} step={10}
                            value={[filter.minSpeed, filter.maxSpeed]}
                            onValueChange={([min, max]) => setFilter({ minSpeed: min, maxSpeed: max })}>
                            <Slider.Track className="relative h-[3px] grow rounded-full bg-hud-border"><Slider.Range className="absolute h-full rounded-full bg-hud-amber" /></Slider.Track>
                            <Slider.Thumb className="block w-3 h-3 rounded-full bg-hud-amber border-2 border-hud-bg focus:outline-none cursor-pointer" />
                            <Slider.Thumb className="block w-3 h-3 rounded-full bg-hud-amber border-2 border-hud-bg focus:outline-none cursor-pointer" />
                        </Slider.Root>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-hud-text-dim tracking-wider">SHOW ON GROUND</span>
                        <button onClick={() => setFilter({ showOnGround: !filter.showOnGround })}
                            className={cn('w-8 h-4 rounded-full border transition-all relative', filter.showOnGround ? 'bg-hud-cyan/20 border-hud-cyan' : 'bg-transparent border-hud-border')}>
                            <span className={cn('absolute top-0.5 w-3 h-3 rounded-full transition-all', filter.showOnGround ? 'left-4 bg-hud-cyan' : 'left-0.5 bg-hud-text-dim')} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── 4. SATELLITES ───────────────────────────────────────────── */}
            <SectionHeader icon={<Satellite size={12} />} label="SATELLITES" open={satellitesOpen}
                onToggle={() => setSatellitesOpen((o) => !o)}
                badge={
                    <span className="font-mono text-[10px] text-hud-cyan ml-1">
                        {visibleSatCount > 0 ? `${visibleSatCount}/` : ''}{totalSatCount || '—'}
                    </span>
                } />
            {satellitesOpen && groups.map((g) => <SatGroupTag key={g.id} groupId={g.id} />)}

            {/* ── 5. SATELLITE FILTERS ────────────────────────────────────── */}
            <SectionHeader icon={<Filter size={11} />} label="SAT FILTERS" open={satFiltersOpen}
                onToggle={() => setSatFiltersOpen((o) => !o)}
                right={<button onClick={(e) => { e.stopPropagation(); setOrbitFilter([...ALL_ORBIT_TYPES]); }} className="text-hud-text-dim hover:text-hud-cyan"><RotateCcw size={9} /></button>} />
            {satFiltersOpen && (
                <div className="p-3 space-y-2">
                    <div className="font-mono text-[10px] text-hud-text-dim mb-1.5 tracking-wider flex justify-between">
                        <span>ORBIT TYPE</span>
                        <button onClick={() => setOrbitFilter([...ALL_ORBIT_TYPES])} className="text-hud-cyan hover:underline">ALL</button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                        {ALL_ORBIT_TYPES.map((orbit) => {
                            const active = orbitFilter.includes(orbit);
                            const color = orbit === 'LEO' ? '#00d4ff' : orbit === 'MEO' ? '#00ff88'
                                : orbit === 'GEO' ? '#ffaa00' : orbit === 'SSO' || orbit === 'Polar' ? '#aa44ff' : '#4a7a99';
                            return (
                                <button key={orbit} onClick={() => toggleOrbitType(orbit)}
                                    className={cn('px-1.5 py-1 rounded border font-mono text-[9px] transition-all', !active && 'opacity-30 hover:opacity-60')}
                                    style={{ borderColor: active ? color : '#0d2137', color: active ? color : '#4a7a99', background: active ? `${color}11` : 'transparent' }}>
                                    {orbit}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
