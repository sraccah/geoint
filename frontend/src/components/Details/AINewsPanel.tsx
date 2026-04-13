'use client';

import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Brain, AlertTriangle, Radio, Globe, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIStore } from '@/store/aiStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface AIAlert {
    id: string;
    level: 'critical' | 'warning' | 'info' | 'nominal';
    category: string;
    message: string;
    detail?: string;
    model: string;
}

interface AIHistoryEntry {
    id: number;
    model: string;
    alerts: AIAlert[];
    alert_count: number;
    generated_at: string;
}

const LEVEL_COLORS: Record<string, string> = {
    critical: '#ff3355',
    warning: '#ffaa00',
    info: '#00d4ff',
    nominal: '#00ff88',
};

function LevelIcon({ level }: { level: string }) {
    if (level === 'critical') return <AlertTriangle size={10} className="text-red-500 shrink-0" />;
    if (level === 'warning') return <AlertTriangle size={10} className="text-amber-400 shrink-0" />;
    if (level === 'info') return <Radio size={10} className="text-cyan-400 shrink-0" />;
    return <Globe size={10} className="text-green-400 shrink-0" />;
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export function AINewsPanel() {
    const [history, setHistory] = useState<AIHistoryEntry[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await axios.get<{ data: AIHistoryEntry[] }>(`${API_URL}/ai/history?hours=24`);
            setHistory(res.data.data || []);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    };

    // Track WebSocket AI alerts — when new ones arrive, refresh from DB
    const wsAlerts = useAIStore((s) => s.alerts);
    const lastWsUpdate = useAIStore((s) => s.lastGenerated);
    const prevWsUpdate = useRef<number | null>(null);

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 300000);
        return () => clearInterval(interval);
    }, []);

    // Auto-refresh when new AI alerts arrive via WebSocket
    useEffect(() => {
        if (lastWsUpdate && lastWsUpdate !== prevWsUpdate.current) {
            prevWsUpdate.current = lastWsUpdate;
            // Small delay to let the DB write complete
            setTimeout(fetchHistory, 2000);
        }
    }, [lastWsUpdate]);

    // Flatten all alerts from all history entries, newest first
    const allAlerts = history.flatMap((entry) =>
        entry.alerts.map((alert) => ({
            ...alert,
            generatedAt: entry.generated_at,
            model: entry.model,
        }))
    );

    return (
        <div className="hud-panel border-l border-hud-border h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-purple-500/30 shrink-0">
                <div className="flex items-center gap-2">
                    <Brain size={12} className="text-purple-400" />
                    <span className="font-mono text-xs text-purple-400 tracking-wider">AI INTEL FEED</span>
                </div>
                <button
                    onClick={fetchHistory}
                    className={cn('text-hud-text-dim hover:text-purple-400 transition-colors', loading && 'animate-spin')}
                    title="Refresh"
                >
                    <RefreshCw size={11} />
                </button>
            </div>

            {/* Subtitle */}
            <div className="px-3 py-1.5 border-b border-hud-border font-mono text-[10px] text-hud-text-dim shrink-0">
                Last 24h · {allAlerts.length} alerts from {history.length} generations
            </div>

            {/* Alert list */}
            <div className="flex-1 overflow-y-auto">
                {allAlerts.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center h-full text-hud-text-dim font-mono text-xs text-center p-4">
                        <Brain size={24} className="mb-2 opacity-20" />
                        <div>No AI news yet</div>
                        <div className="text-[10px] mt-1">Enable AI mode to generate intelligence reports</div>
                    </div>
                )}

                {loading && allAlerts.length === 0 && (
                    <div className="flex items-center justify-center h-32 font-mono text-xs text-hud-text-dim">
                        Loading AI history...
                    </div>
                )}

                {allAlerts.map((alert, i) => {
                    const color = LEVEL_COLORS[alert.level] || '#4a7a99';
                    return (
                        <div
                            key={`${alert.id}-${i}`}
                            className="px-3 py-2 border-b border-hud-border/40 hover:bg-hud-border/20 transition-colors"
                        >
                            {/* Level + category + time */}
                            <div className="flex items-center gap-1.5 mb-1">
                                <LevelIcon level={alert.level} />
                                <span
                                    className="font-mono text-[9px] tracking-wider font-bold px-1.5 py-0.5 rounded border"
                                    style={{ color, borderColor: color + '44' }}
                                >
                                    {alert.category}
                                </span>
                                <span className="flex-1" />
                                <span className="font-mono text-[9px] text-hud-text-dim flex items-center gap-1">
                                    <Clock size={8} />
                                    {timeAgo(alert.generatedAt)}
                                </span>
                            </div>

                            {/* Message */}
                            <div className="font-mono text-[11px] leading-relaxed" style={{ color }}>
                                {alert.message}
                            </div>

                            {/* Detail */}
                            {alert.detail && (
                                <div className="font-mono text-[10px] text-hud-text-dim mt-0.5">
                                    {alert.detail}
                                </div>
                            )}

                            {/* Model tag */}
                            <div className="mt-1 flex items-center gap-1">
                                <Brain size={8} className="text-purple-400/50" />
                                <span className="font-mono text-[9px] text-purple-400/50">
                                    {alert.model}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="px-3 py-1.5 border-t border-hud-border font-mono text-[9px] text-hud-text-dim shrink-0">
                Powered by local Ollama LLM · Data stored in PostgreSQL
            </div>
        </div>
    );
}
