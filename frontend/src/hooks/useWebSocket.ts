'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useFlightStore } from '@/store/flightStore';
import { useAIStore } from '@/store/aiStore';
import { Flight, FlightStats, WebSocketMessage } from '@/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || '';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useWebSocket(): void {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectAttempts = useRef(0);
    const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
    const pingTimer = useRef<NodeJS.Timeout | null>(null);
    const { setFlights, setStats, setConnected, setDataSourceError } = useFlightStore();
    const { setAlerts } = useAIStore();

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        try {
            const wsBase = WS_URL || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
            const ws = new WebSocket(`${wsBase}/ws`);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[WS] Connected to GeoINT backend');
                setConnected(true);
                setDataSourceError(null);
                reconnectAttempts.current = 0;

                pingTimer.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'ping' }));
                    } else {
                        if (pingTimer.current) clearInterval(pingTimer.current);
                    }
                }, 30000);
            };

            ws.onmessage = (event) => {
                try {
                    const msg: WebSocketMessage = JSON.parse(event.data);

                    if (msg.type === 'flights_update') {
                        const payload = msg.payload as { flights: Flight[]; stats: FlightStats | null };
                        if (payload.flights) {
                            setFlights(payload.flights);
                            setDataSourceError(null);
                        }
                        if (payload.stats) setStats(payload.stats);
                    }

                    if (msg.type === 'ai_alerts') {
                        const alerts = msg.payload as Parameters<typeof setAlerts>[0];
                        if (Array.isArray(alerts) && alerts.length > 0) {
                            setAlerts(alerts);
                            console.log(`[WS] Received ${alerts.length} AI alerts`);
                        }
                    }

                    if (msg.type === 'error') {
                        const payload = msg.payload as { status: string; message: string };
                        console.warn('[WS] Data source error:', payload.message);
                        setDataSourceError(payload.message);
                    }
                } catch (err) {
                    console.error('[WS] Parse error:', err);
                }
            };

            ws.onclose = () => {
                console.log('[WS] Disconnected');
                setConnected(false);
                if (pingTimer.current) clearInterval(pingTimer.current);
                wsRef.current = null;

                if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts.current++;
                    const delay = RECONNECT_DELAY * Math.min(reconnectAttempts.current, 5);
                    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
                    reconnectTimer.current = setTimeout(connect, delay);
                }
            };

            ws.onerror = () => {
                console.error('[WS] Connection error');
            };
        } catch (err) {
            console.error('[WS] Connection failed:', err);
        }
    }, [setFlights, setStats, setConnected, setDataSourceError]);

    useEffect(() => {
        // Delay avoids React StrictMode double-mount closing the socket immediately
        const timer = setTimeout(connect, 150);
        return () => {
            clearTimeout(timer);
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            if (pingTimer.current) clearInterval(pingTimer.current);
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [connect]);
}
