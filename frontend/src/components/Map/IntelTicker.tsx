'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useFlightStore } from '@/store/flightStore';
import { analyzeFlights, IntelAlert } from '@/lib/intelAnalyzer';
import { cn } from '@/lib/utils';
import { AlertTriangle, Radio, Globe, ChevronRight, ChevronLeft } from 'lucide-react';

const ROTATE_INTERVAL = 6000; // ms per alert

const LEVEL_STYLES: Record<IntelAlert['level'], { border: string; text: string; bg: string; dot: string }> = {
    critical: { border: '#ff3355', text: '#ff3355', bg: 'rgba(255,51,85,0.08)', dot: 'bg-red-500 animate-pulse' },
    warning: { border: '#ffaa00', text: '#ffaa00', bg: 'rgba(255,170,0,0.08)', dot: 'bg-amber-400 animate-pulse' },
    info: { border: '#00d4ff', text: '#00d4ff', bg: 'rgba(0,212,255,0.06)', dot: 'bg-cyan-400' },
    nominal: { border: '#00ff88', text: '#00ff88', bg: 'rgba(0,255,136,0.05)', dot: 'bg-green-400' },
};

function LevelIcon({ level }: { level: IntelAlert['level'] }) {
    if (level === 'critical') return <AlertTriangle size={11} className="text-red-500 shrink-0" />;
    if (level === 'warning') return <AlertTriangle size={11} className="text-amber-400 shrink-0" />;
    if (level === 'info') return <Radio size={11} className="text-cyan-400 shrink-0" />;
    return <Globe size={11} className="text-green-400 shrink-0" />;
}

export function IntelTicker() {
    const flights = useFlightStore((s) => s.flights);
    const selectFlight = useFlightStore((s) => s.selectFlight);
    const [alerts, setAlerts] = useState<IntelAlert[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [paused, setPaused] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Re-analyze whenever flights update
    useEffect(() => {
        if (flights.length === 0) return;
        const newAlerts = analyzeFlights(flights);
        setAlerts(newAlerts);
        setCurrentIdx(0);
    }, [flights]);

    const next = useCallback(() => {
        setCurrentIdx((i) => (alerts.length > 0 ? (i + 1) % alerts.length : 0));
    }, [alerts.length]);

    const prev = useCallback(() => {
        setCurrentIdx((i) => (alerts.length > 0 ? (i - 1 + alerts.length) % alerts.length : 0));
    }, [alerts.length]);

    // Auto-rotate
    useEffect(() => {
        if (paused || alerts.length <= 1) return;
        timerRef.current = setInterval(next, ROTATE_INTERVAL);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [paused, alerts.length, next]);

    if (alerts.length === 0) return null;

    const alert = alerts[currentIdx];
    const style = LEVEL_STYLES[alert.level];

    const handleClick = () => {
        if (!alert.flightIds?.length) return;
        const flight = flights.find((f) => f.flight_id === alert.flightIds![0]);
        if (flight) selectFlight(flight);
    };

    return (
        <div
            className="absolute z-10 font-mono"
            style={{ top: '12px', left: '120px', right: '12px' }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            <div
                className="flex items-center gap-2 px-3 py-1.5 rounded border text-[11px] cursor-pointer transition-all"
                style={{
                    background: style.bg,
                    borderColor: style.border,
                    boxShadow: `0 0 12px ${style.border}22`,
                }}
                onClick={handleClick}
            >
                {/* Dot */}
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', style.dot)} />

                {/* Category badge */}
                <span
                    className="shrink-0 text-[9px] tracking-widest font-bold px-1.5 py-0.5 rounded border"
                    style={{ color: style.text, borderColor: style.border + '66' }}
                >
                    {alert.category}
                </span>

                {/* Icon */}
                <LevelIcon level={alert.level} />

                {/* Message */}
                <span className="flex-1 truncate" style={{ color: style.text }}>
                    {alert.message}
                </span>

                {/* Detail */}
                {alert.detail && (
                    <span className="text-hud-text-dim text-[10px] shrink-0 hidden md:block truncate max-w-[200px]">
                        {alert.detail}
                    </span>
                )}

                {/* Clickable indicator */}
                {alert.flightIds?.length ? (
                    <span className="text-[9px] text-hud-text-dim shrink-0 hidden lg:block">
                        [CLICK TO TRACK]
                    </span>
                ) : null}

                {/* Counter + nav */}
                <div className="flex items-center gap-1 shrink-0 ml-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); prev(); }}
                        className="text-hud-text-dim hover:text-hud-text transition-colors"
                    >
                        <ChevronLeft size={12} />
                    </button>
                    <span className="text-hud-text-dim text-[9px] w-8 text-center">
                        {currentIdx + 1}/{alerts.length}
                    </span>
                    <button
                        onClick={(e) => { e.stopPropagation(); next(); }}
                        className="text-hud-text-dim hover:text-hud-text transition-colors"
                    >
                        <ChevronRight size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
}
