'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Search, X, Plane, Camera, Loader, Satellite } from 'lucide-react';
import { Flight, Camera as CameraType } from '@/types';
import { SatelliteGP } from '@/types/satellite';
import { useFlightStore } from '@/store/flightStore';
import { useUIStore } from '@/store/uiStore';
import { useSatelliteStore } from '@/store/satelliteStore';
import { getCategoryColor, formatAltitude, formatSpeed } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface SearchResults {
    flights: Flight[];
    cameras: CameraType[];
    satellites: SatelliteGP[];
    total: number;
}

export function SearchBar() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResults | null>(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const search = useCallback(async (q: string) => {
        if (q.trim().length < 2) { setResults(null); return; }
        setLoading(true);
        try {
            const res = await axios.get<SearchResults>(`${API_URL}/search`, { params: { q } });
            setResults(res.data);
        } catch {
            setResults(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => search(query), 300);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [query, search]);

    const { selectFlight } = useFlightStore();
    const { selectCamera } = useUIStore();
    const { selectSatellite } = useSatelliteStore();

    const handleFlightSelect = (flight: Flight) => {
        selectFlight(flight);
        setOpen(false); setQuery(''); setResults(null);
    };

    const handleCameraSelect = (camera: CameraType) => {
        selectCamera(camera);
        setOpen(false); setQuery(''); setResults(null);
    };

    const handleSatelliteSelect = (sat: SatelliteGP) => {
        selectSatellite(sat);
        setOpen(false); setQuery(''); setResults(null);
    };

    const clear = () => { setQuery(''); setResults(null); setOpen(false); };

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') clear();
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                inputRef.current?.focus();
                setOpen(true);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const hasResults = results && results.total > 0;

    return (
        <div className="relative flex-1 max-w-md">
            {/* Input */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-colors ${open ? 'border-hud-cyan bg-hud-panel' : 'border-hud-border bg-hud-bg hover:border-hud-border-bright'
                }`}>
                {loading ? (
                    <Loader size={12} className="text-hud-cyan animate-spin shrink-0" />
                ) : (
                    <Search size={12} className="text-hud-text-dim shrink-0" />
                )}
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder="Search callsign, ICAO, city, country... (⌘K)"
                    className="flex-1 bg-transparent font-mono text-xs text-hud-text placeholder-hud-text-dim outline-none min-w-0"
                />
                {query && (
                    <button onClick={clear} className="text-hud-text-dim hover:text-hud-text shrink-0">
                        <X size={10} />
                    </button>
                )}
            </div>

            {/* Dropdown */}
            {open && query.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 hud-panel rounded border border-hud-border-bright max-h-96 overflow-y-auto shadow-xl"
                    style={{ boxShadow: '0 0 30px rgba(0,212,255,0.1)' }}>

                    {!hasResults && !loading && (
                        <div className="px-4 py-3 font-mono text-xs text-hud-text-dim text-center">
                            No results for "{query}"
                        </div>
                    )}

                    {/* Flights */}
                    {results && results.flights.length > 0 && (
                        <div>
                            <div className="px-3 py-1.5 font-mono text-[10px] text-hud-text-dim tracking-wider border-b border-hud-border flex items-center gap-1.5">
                                <Plane size={9} className="text-hud-cyan" />
                                FLIGHTS ({results.flights.length})
                            </div>
                            {results.flights.map((f) => (
                                <button
                                    key={f.flight_id}
                                    onClick={() => handleFlightSelect(f)}
                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-hud-border/30 transition-colors border-b border-hud-border/30"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-mono text-xs font-bold" style={{ color: getCategoryColor(f.category) }}>
                                            {f.callsign || f.flight_id.toUpperCase()}
                                        </span>
                                        {f.aircraft_type && (
                                            <span className="font-mono text-[10px] text-hud-text-dim">{f.aircraft_type}</span>
                                        )}
                                        {f.origin_country && (
                                            <span className="font-mono text-[10px] text-hud-text-dim truncate">{f.origin_country}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 font-mono text-[10px] text-hud-text-dim">
                                        {f.altitude !== null && <span>{formatAltitude(f.altitude)}</span>}
                                        {f.velocity !== null && <span>{formatSpeed(f.velocity)}</span>}
                                        <span className="px-1.5 py-0.5 rounded border text-[9px]"
                                            style={{ borderColor: getCategoryColor(f.category) + '44', color: getCategoryColor(f.category) }}>
                                            {f.category}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Cameras */}
                    {results && results.cameras.length > 0 && (
                        <div>
                            <div className="px-3 py-1.5 font-mono text-[10px] text-hud-text-dim tracking-wider border-b border-hud-border flex items-center gap-1.5">
                                <Camera size={9} className="text-hud-green" />
                                CAMERAS ({results.cameras.length})
                            </div>
                            {results.cameras.slice(0, 20).map((c) => (
                                <button
                                    key={c.id}
                                    onClick={() => handleCameraSelect(c)}
                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-hud-border/30 transition-colors border-b border-hud-border/30"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Camera size={10} className="text-hud-green shrink-0" />
                                        <span className="font-mono text-xs text-hud-text truncate">{c.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 font-mono text-[10px] text-hud-text-dim">
                                        {c.city && <span>{c.city}</span>}
                                        {c.country && <span>{c.country}</span>}
                                        <span className="px-1.5 py-0.5 rounded border border-hud-green/30 text-hud-green text-[9px]">
                                            {c.type}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Satellites */}
                    {results && results.satellites && results.satellites.length > 0 && (
                        <div>
                            <div className="px-3 py-1.5 font-mono text-[10px] text-hud-text-dim tracking-wider border-b border-hud-border flex items-center gap-1.5">
                                <Satellite size={9} className="text-hud-cyan" />
                                SATELLITES ({results.satellites.length})
                            </div>
                            {results.satellites.slice(0, 10).map((s) => (
                                <button
                                    key={s.NORAD_CAT_ID}
                                    onClick={() => handleSatelliteSelect(s)}
                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-hud-border/30 transition-colors border-b border-hud-border/30"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Satellite size={10} className="text-hud-cyan shrink-0" />
                                        <span className="font-mono text-xs text-hud-text truncate">{s.OBJECT_NAME}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 font-mono text-[10px] text-hud-text-dim">
                                        <span>#{s.NORAD_CAT_ID}</span>
                                        <span className="px-1.5 py-0.5 rounded border border-hud-cyan/30 text-hud-cyan text-[9px]">
                                            {s.INCLINATION.toFixed(1)}° inc
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Click outside to close */}
            {open && (
                <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            )}
        </div>
    );
}
