import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { flightPoller } from '../services/flightPoller';
import { Flight, FlightStats, WebSocketMessage } from '../types';

interface WSClient {
    socket: WebSocket;
    id: string;
    filter?: {
        categories?: string[];
        bounds?: { min_lat: number; max_lat: number; min_lon: number; max_lon: number };
    };
}

const clients = new Map<string, WSClient>();
let clientIdCounter = 0;

function sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

function broadcastFlights(flights: Flight[], stats: FlightStats): void {
    clients.forEach((client) => {
        let filtered = flights;

        if (client.filter?.categories?.length) {
            filtered = filtered.filter((f) => client.filter!.categories!.includes(f.category));
        }

        if (client.filter?.bounds) {
            const { min_lat, max_lat, min_lon, max_lon } = client.filter.bounds;
            filtered = filtered.filter(
                (f) =>
                    f.latitude !== null &&
                    f.longitude !== null &&
                    f.latitude >= min_lat &&
                    f.latitude <= max_lat &&
                    f.longitude >= min_lon &&
                    f.longitude <= max_lon
            );
        }

        sendMessage(client.socket, {
            type: 'flights_update',
            payload: { flights: filtered, stats },
            timestamp: Date.now(),
        });
    });
}

function broadcastError(status: string): void {
    const message: WebSocketMessage = {
        type: 'error',
        payload: {
            status,
            message:
                status === 'rate_limited'
                    ? 'OpenSky Network rate limit reached. Retrying with backoff.'
                    : status === 'unavailable'
                        ? 'OpenSky Network is temporarily unavailable. Retrying.'
                        : 'Failed to fetch flight data from OpenSky Network. Retrying.',
        },
        timestamp: Date.now(),
    };
    clients.forEach((client) => sendMessage(client.socket, message));
}

export async function websocketRoutes(fastify: FastifyInstance): Promise<void> {
    fastify.get('/ws', { websocket: true }, (socket, _request) => {
        const clientId = `client_${++clientIdCounter}`;
        const client: WSClient = { socket, id: clientId };
        clients.set(clientId, client);

        console.log(`[WS] Client connected: ${clientId} (total: ${clients.size})`);

        // Send current real data immediately on connect
        flightPoller.getCurrentFlights().then((flights) => {
            sendMessage(socket, {
                type: 'flights_update',
                payload: { flights, stats: null },
                timestamp: Date.now(),
            });

            // Also send current poller status if degraded
            const status = flightPoller.getStatus();
            if (status !== 'ok') {
                sendMessage(socket, {
                    type: 'error',
                    payload: { status, message: `Data source status: ${status}` },
                    timestamp: Date.now(),
                });
            }
        });

        socket.on('message', (data: Buffer) => {
            try {
                const msg = JSON.parse(data.toString());

                if (msg.type === 'set_filter') {
                    client.filter = msg.payload;
                }

                if (msg.type === 'ping') {
                    sendMessage(socket, {
                        type: 'stats',
                        payload: {
                            pong: true,
                            source: 'OpenSky Network',
                            status: flightPoller.getStatus(),
                            lastPoll: flightPoller.getLastSuccessfulPoll(),
                        },
                        timestamp: Date.now(),
                    });
                }
            } catch {
                // ignore malformed messages
            }
        });

        socket.on('close', () => {
            clients.delete(clientId);
            console.log(`[WS] Client disconnected: ${clientId} (total: ${clients.size})`);
        });

        socket.on('error', (err) => {
            console.error(`[WS] Client ${clientId} error:`, err.message);
            clients.delete(clientId);
        });
    });

    flightPoller.onUpdate(broadcastFlights);
    flightPoller.onError(broadcastError);
}

export function getConnectedClients(): number {
    return clients.size;
}
