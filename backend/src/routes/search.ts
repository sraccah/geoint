import { FastifyInstance } from 'fastify';
import { flightPoller } from '../services/flightPoller';
import { searchCameras } from '../services/cameras';
import { searchSatellites } from '../services/satellites';
import { Flight } from '../types';

export async function searchRoutes(fastify: FastifyInstance): Promise<void> {
    // GET /search?q=ISS — search flights + cameras + satellites
    fastify.get<{ Querystring: { q: string; type?: 'flights' | 'cameras' | 'satellites' | 'all' } }>(
        '/search',
        async (request, reply) => {
            const { q, type = 'all' } = request.query;
            if (!q || q.trim().length < 2) {
                return reply.send({ flights: [], cameras: [], satellites: [], total: 0 });
            }

            const query = q.trim().toLowerCase();
            const results: { flights: Flight[]; cameras: unknown[]; satellites: unknown[]; total: number } = {
                flights: [],
                cameras: [],
                satellites: [],
                total: 0,
            };

            const tasks: Promise<void>[] = [];

            if (type === 'all' || type === 'flights') {
                tasks.push(
                    flightPoller.getCurrentFlights().then((flights) => {
                        results.flights = flights.filter((f) =>
                            f.flight_id.toLowerCase().includes(query) ||
                            f.callsign?.toLowerCase().includes(query) ||
                            f.origin_country?.toLowerCase().includes(query) ||
                            f.origin_airport?.toLowerCase().includes(query) ||
                            f.destination_airport?.toLowerCase().includes(query) ||
                            f.aircraft_type?.toLowerCase().includes(query) ||
                            f.squawk?.includes(query)
                        ).slice(0, 50);
                    })
                );
            }

            if (type === 'all' || type === 'cameras') {
                tasks.push(
                    searchCameras(query).then((cameras) => { results.cameras = cameras; })
                );
            }

            if (type === 'all' || type === 'satellites') {
                tasks.push(
                    searchSatellites(query).then((sats) => { results.satellites = sats; })
                );
            }

            await Promise.allSettled(tasks);
            results.total = results.flights.length + results.cameras.length + results.satellites.length;
            return reply.send({ ...results, timestamp: Date.now() });
        }
    );

    // GET /status — all data source health
    fastify.get('/status', async (_req, reply) => {
        return reply.send({
            status: flightPoller.getStatus(),
            sources: flightPoller.getSourceStatuses(),
            lastPoll: flightPoller.getLastSuccessfulPoll(),
            timestamp: Date.now(),
        });
    });
}
