'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useFlightStore } from '@/store/flightStore';
import { useAIStore, AIAlert } from '@/store/aiStore';
import { analyzeFlights, IntelAlert } from '@/lib/intelAnalyzer';
import { cn } from '@/lib/utils';
import { AlertTriangle, Radio, Globe, ChevronRight, ChevronLeft, Brain, Zap } from 'lucide-react';

const ROTATE_INTERVAL = 6000;

type CombinedAlert = (IntelAlert & { source: 'rule' }) | (AIAlert & { message: string; category: string; level: 'critical' | 'warning' | 'info' | 'nominal' });

const LEVEL_STYLES: Record<string, { border: string; text: string; bg: string; dot: string }> = {
    critical: { border: '#ff3355', text: '#ff3355', bg: 'rgba(255,51,85,0.08)', dot: 'bg-red-500 animate-pulse' },
    warning: { border: '#ffaa00', text: '#ffaa00', bg: 'rgba(255,170,0,0.08)', dot: 'bg-amber-400 animate-pulse' },
    info: { border: '#00d4ff', text: '#00d4ff', bg: 'rgba(0,212,255,0.06)', dot: 'bg-cyan-400' },
    nominal: { border: '#00ff88', text: '#00ff88', bg: 'rgba(0,255,136,0.05)', dot: 'bg-green-400' },
};

function LevelIcon({ level }: { level: string }) {
    if (level === 'critical' || level === 'warning') return <AlertTriangle size={11} className={level === 'critical' ? 'text-red-500 shrink-0' : 'text-amber-400 shrink-0'} />;
    if (level === 'info') return <Radio size={11} className="text-cyan-400 shrink-0" />;
    return <Globe size={11} className="text-green-400 shrink-0" />;
}

export function IntelTicker() {
    const flights = useFlightStore((s) => s.flights);
    const selectFlight = useFlightStore((s) => s.selectFlight);
    const { alerts: aiAlerts, aiModeEnabled, toggleAIMode, lastGenerated, loading: aiLoading } = useAIStore();

    const [ruleAlerts, setRuleAlerts] = useState<IntelAlert[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [paused, setPaused] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Re-analyze rule-based alerts on flight updates — but DON'T reset index
    useEffect(() => {
        if (flights.length === 0) return;
        setRuleAlerts(analyzeFlights(flights));
        // Don't reset currentIdx here — it causes the 1→2→1 loop
    }, [flights]);

    // Combine rule-based + AI alerts
    // AI alerts shown FIRST within the same level — they are more contextual
    const allAlerts: CombinedAlert[] = [
        ...(aiModeEnabled ? aiAlerts.map((a) => ({ ...a, message: a.message, category: a.category })) : []),
        ...ruleAlerts.map((a) => ({ ...a, source: 'rule' as const })),
    ].sort((a, b) => {
        const order = { critical: 0, warning: 1, info: 2, nominal: 3 };
        const levelDiff = order[a.level] - order[b.level];
        if (levelDiff !== 0) return levelDiff;
        // Within same level: AI first
        const aIsAI = 'source' in a && (a as AIAlert).source === 'ai';
        const bIsAI = 'source' in b && (b as AIAlert).source === 'ai';
        if (aIsAI && !bIsAI) return -1;
        if (!aIsAI && bIsAI) return 1;
        return 0;
    });

    const next = useCallback(() => setCurrentIdx((i) => allAlerts.length > 0 ? (i + 1) % allAlerts.length : 0), [allAlerts.length]);
    const prev = useCallback(() => setCurrentIdx((i) => allAlerts.length > 0 ? (i - 1 + allAlerts.length) % allAlerts.length : 0), [allAlerts.length]);

    useEffect(() => {
        if (paused || allAlerts.length <= 1) return;
        timerRef.current = setInterval(next, ROTATE_INTERVAL);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [paused, allAlerts.length, next]);

    // Keep index in bounds when alerts change
    useEffect(() => {
        if (currentIdx >= allAlerts.length && allAlerts.length > 0) setCurrentIdx(0);
    }, [allAlerts.length, currentIdx]);

    if (allAlerts.length === 0) return null;

    const alert = allAlerts[Math.min(currentIdx, allAlerts.length - 1)];
    const style = LEVEL_STYLES[alert.level] || LEVEL_STYLES.info;
    const isAI = 'source' in alert && alert.source === 'ai';

    const handleClick = () => {
        if (!isAI && 'flightIds' in alert && alert.flightIds?.length) {
            const flight = flights.find((f) => f.flight_id === (alert as IntelAlert).flightIds![0]);
            if (flight) selectFlight(flight);
        }
    };

    return (
        <div
            className="absolute z-10 font-mono flex items-center gap-2"
            style={{ top: '12px', left: '120px', right: '12px' }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            {/* Main ticker */}
            <div
                className="flex items-center gap-2 px-3 py-1.5 rounded border text-[11px] cursor-pointer transition-all flex-1 min-w-0"
                style={{ background: style.bg, borderColor: style.border, boxShadow: `0 0 12px ${style.border}22` }}
                onClick={handleClick}
            >
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', style.dot)} />

                {/* AI badge */}
                {isAI && (
                    <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded border border-purple-500/50 bg-purple-500/10 text-purple-400 text-[9px] font-bold">
                        <Brain size={8} />AI
                    </span>
                )}

                {/* Category */}
                <span className="shrink-0 text-[9px] tracking-widest font-bold px-1.5 py-0.5 rounded border"
                    style={{ color: style.text, borderColor: style.border + '66' }}>
                    {alert.category}
                </span>

                <LevelIcon level={alert.level} />

                {/* Message */}
                <span className="flex-1 truncate" style={{ color: style.text }}>{alert.message}</span>

                {/* Detail */}
                {'detail' in alert && alert.detail && (
                    <span className="text-hud-text-dim text-[10px] shrink-0 hidden md:block truncate max-w-[180px]">
                        {alert.detail}
                    </span>
                )}

                {/* AI model tag */}
                {isAI && (
                    <span className="text-[9px] text-purple-400/60 shrink-0 hidden lg:block">
                        [{(alert as AIAlert).model.split(':')[0]}]
                    </span>
                )}

                {/* Click to track */}
                {!isAI && 'flightIds' in alert && (alert as IntelAlert).flightIds?.length ? (
                    <span className="text-[9px] text-hud-text-dim shrink-0 hidden lg:block">[TRACK]</span>
                ) : null}

                {/* Counter + nav */}
                <div className="flex items-center gap-1 shrink-0 ml-1">
                    <button onClick={(e) => { e.stopPropagation(); prev(); }} className="text-hud-text-dim hover:text-hud-text">
                        <ChevronLeft size={12} />
                    </button>
                    <span className="text-hud-text-dim text-[9px] w-10 text-center">
                        {currentIdx + 1}/{allAlerts.length}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); next(); }} className="text-hud-text-dim hover:text-hud-text">
                        <ChevronRight size={12} />
                    </button>
                </div>
            </div>

            {/* AI mode toggle — calls backend API, persists in Redis, no restart needed */}
            <button
                onClick={() => toggleAIMode()}
                disabled={aiLoading}
                title={aiModeEnabled ? 'AI ON — click to disable (saves resources)' : 'AI OFF — click to enable'}
                className={cn(
                    'shrink-0 flex items-center gap-1 px-2 py-1.5 rounded border font-mono text-[10px] transition-all',
                    aiLoading ? 'opacity-50 cursor-wait' : '',
                    aiModeEnabled
                        ? 'border-purple-500 text-purple-400 bg-purple-500/10'
                        : 'border-hud-border text-hud-text-dim hover:border-purple-500/50'
                )}
            >
                <Brain size={11} />
                {aiLoading
                    ? <span className="text-[9px]">...</span>
                    : <Zap size={9} className={aiModeEnabled ? 'text-purple-400' : 'text-hud-text-dim'} />
                }
                {lastGenerated && aiModeEnabled && (
                    <span className="text-[9px] text-purple-400/60 hidden lg:block">
                        {Math.round((Date.now() - lastGenerated) / 60000)}m ago
                    </span>
                )}
            </button>
        </div>
    );
}
