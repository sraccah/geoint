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
    const { visibleGroups, satellites } = useSatelliteStore();
    const [time, setTime] = useState('');

    useEffect(() => {
        const update = () => setTime(new Date().toISOString().replace('T', ' ').substring(0, 19) + 'Z');
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, []);

    // Count visible satellites
    const visibleSatCount = [...visibleGroups].reduce(
        (sum, gid) => sum + (satellites.get(gid)?.length ?? 0), 0
    );
    const militarySatCount = satellites.get('military')?.length ?? 0;

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
            <div className="flex items-center gap-4 flex-1 min-w-0">
                <SearchBar />
                <div className="hidden xl:flex items-center gap-3 font-mono text-xs shrink-0">
                    {/* Flight stats */}
                    <StatBadge label="AIRBORNE" value={stats?.airborne ?? '—'} color="cyan" />
                    <StatBadge label="COMMERCIAL" value={stats?.commercial ?? '—'} color="cyan" />
                    <StatBadge label="CARGO" value={stats?.cargo ?? '—'} color="amber" />
                    <StatBadge label="MIL ✈" value={stats?.military ?? '—'} color="red" />
                    <StatBadge label="GROUND" value={stats?.on_ground ?? '—'} color="dim" />
                    {/* Divider */}
                    <div className="w-px h-6 bg-hud-border mx-1" />
                    {/* Satellite stats */}
                    <StatBadge label="SAT VISIBLE" value={visibleSatCount || '—'} color="purple" />
                    <StatBadge label="MIL 🛰" value={militarySatCount || '—'} color="red" />
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

function StatBadge({ label, value, color }: {
    label: string; value: number | string;
    color: 'cyan' | 'amber' | 'red' | 'green' | 'dim' | 'purple';
}) {
    const colorClass = {
        cyan: 'text-hud-cyan', amber: 'text-hud-amber', red: 'text-hud-red',
        green: 'text-hud-green', dim: 'text-hud-text-dim', purple: 'text-purple-400',
    }[color];
    return (
        <div className="flex flex-col items-center">
            <span className={cn('font-bold text-sm', colorClass)}>{value}</span>
            <span className="text-hud-text-dim text-[9px] tracking-wider">{label}</span>
        </div>
    );
}
