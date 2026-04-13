'use client';

import { useFlightStore } from '@/store/flightStore';
import { useUIStore } from '@/store/uiStore';
import { useSatelliteStore } from '@/store/satelliteStore';
import { cn } from '@/lib/utils';
import { PanelLeft, PanelRight, Globe, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SearchBar } from './SearchBar';

export function TopBar() {
    const { isConnected, stats } = useFlightStore();
    const { toggleLeftPanel, toggleRightPanel, leftPanelOpen } = useUIStore();
    const { visibleGroups, satellites, groups } = useSatelliteStore();
    const [time, setTime] = useState('');

    useEffect(() => {
        const update = () => setTime(new Date().toISOString().replace('T', ' ').substring(0, 19) + 'Z');
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="hud-panel border-b border-hud-border flex items-center gap-3 px-3 py-2 z-20 shrink-0">
            {/* Left */}
            <div className="flex items-center gap-3 shrink-0">
                <button onClick={toggleLeftPanel}
                    className={cn('p-1.5 rounded border transition-colors',
                        leftPanelOpen ? 'border-hud-cyan text-hud-cyan' : 'border-hud-border text-hud-text-dim hover:border-hud-cyan hover:text-hud-cyan')}>
                    <PanelLeft size={13} />
                </button>
                <div className="flex items-center gap-2">
                    <Globe size={15} className="text-hud-cyan" />
                    <span className="font-mono font-bold text-hud-text-bright tracking-widest text-sm">
                        GEO<span className="text-hud-cyan">INT</span>
                    </span>
                </div>
            </div>

            {/* Center: Search + Stats */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <SearchBar />

                {/* Flight stats */}
                <div className="hidden 2xl:flex items-center gap-3 font-mono text-xs shrink-0">
                    {/* Divider */}
                    <div className="w-px h-5 bg-hud-border" />
                    <StatBadge label="AIRBORNE" value={stats?.airborne ?? '—'} color="#00d4ff" />
                    <StatBadge label="COMM" value={stats?.commercial ?? '—'} color="#00d4ff" />
                    <StatBadge label="CARGO" value={stats?.cargo ?? '—'} color="#ffaa00" />
                    <StatBadge label="MIL ✈" value={stats?.military ?? '—'} color="#ff3355" />
                    <StatBadge label="GROUND" value={stats?.on_ground ?? '—'} color="#4a7a99" />

                    {/* Divider */}
                    <div className="w-px h-5 bg-hud-border" />

                    {/* Satellite stats — one per group */}
                    {groups.map((g) => {
                        const count = satellites.get(g.id)?.length ?? 0;
                        const visible = visibleGroups.has(g.id);
                        return (
                            <StatBadge
                                key={g.id}
                                label={g.icon + ' ' + g.label.substring(0, 5).toUpperCase()}
                                value={count || '—'}
                                color={visible && count > 0 ? g.color : '#4a7a99'}
                            />
                        );
                    })}
                </div>

                {/* Compact stats for smaller screens */}
                <div className="hidden xl:flex 2xl:hidden items-center gap-3 font-mono text-xs shrink-0">
                    <StatBadge label="AIRBORNE" value={stats?.airborne ?? '—'} color="#00d4ff" />
                    <StatBadge label="MIL ✈" value={stats?.military ?? '—'} color="#ff3355" />
                    <StatBadge label="CARGO" value={stats?.cargo ?? '—'} color="#ffaa00" />
                    <div className="w-px h-5 bg-hud-border" />
                    {groups.filter((g) => ['military', 'stations', 'starlink'].includes(g.id)).map((g) => (
                        <StatBadge key={g.id} label={g.icon + ' ' + g.label.substring(0, 4).toUpperCase()}
                            value={satellites.get(g.id)?.length || '—'}
                            color={visibleGroups.has(g.id) ? g.color : '#4a7a99'} />
                    ))}
                </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5 font-mono text-xs">
                    <Activity size={11} className={cn(isConnected ? 'text-hud-green animate-pulse' : 'text-hud-red')} />
                    <span className={isConnected ? 'text-hud-green' : 'text-hud-red'}>
                        {isConnected ? 'LIVE' : 'OFFLINE'}
                    </span>
                </div>
                <div className="font-mono text-xs text-hud-text-dim hidden lg:block">{time}</div>
                <button onClick={toggleRightPanel}
                    className="p-1.5 rounded border border-hud-border text-hud-text-dim hover:border-hud-cyan hover:text-hud-cyan transition-colors">
                    <PanelRight size={13} />
                </button>
            </div>
        </div>
    );
}

function StatBadge({ label, value, color }: { label: string; value: number | string; color: string }) {
    return (
        <div className="flex flex-col items-center min-w-0">
            <span className="font-bold text-sm" style={{ color }}>{value}</span>
            <span className="text-hud-text-dim text-[9px] tracking-wider truncate max-w-[52px]">{label}</span>
        </div>
    );
}
