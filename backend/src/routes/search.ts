import { FastifyInstance } from 'fastify';
import { flightPoller } from '../services/flightPoller';
import { searchCameras } from '../services/cameras';
import { Flight } from '../types';

export async function searchRoutes(fastify: FastifyInstance): Promise<void> {
    // GET /search?q=IBE0125  — search flights + cameras
    fastify.get<{ Querystring: { q: string; type?: 'flights' | 'cameras' | 'all' } }>(
        '/search',
        async (request, reply) => {
            const { q, type = 'all' } = request.query;
            if (!q || q.trim().length < 2) {
                return reply.send({ flights: [], cameras: [], total: 0 });
            }

            const query = q.trim().toLowerCase();
            const results: { flights: Flight[]; cameras: unknown[]; total: number } = {
                flights: [],
                cameras: [],
                total: 0,
            };

            if (type === 'all' || type === 'flights') {
                const flights = await flightPoller.getCurrentFlights();
                results.flights = flights.filter((f) => {
                    return (
                        f.flight_id.toLowerCase().includes(query) ||
                        f.callsign?.toLowerCase().includes(query) ||
                        f.origin_country?.toLowerCase().includes(query) ||
                        f.origin_airport?.toLowerCase().includes(query) ||
                        f.destination_airport?.toLowerCase().includes(query) ||
                        f.aircraft_type?.toLowerCase().includes(query) ||
                        f.squawk?.includes(query)
                    );
                }).slice(0, 50);
            }

            if (type === 'all' || type === 'cameras') {
                results.cameras = await searchCameras(query);
            }

            results.total = results.flights.length + results.cameras.length;
            return reply.send({ ...results, timestamp: Date.now() });
        }
    );

    // GET /status — data source health
    fastify.get('/status', async (_req, reply) => {
        return reply.send({
            status: flightPoller.getStatus(),
            sources: flightPoller.getSourceStatuses(),
            lastPoll: flightPoller.getLastSuccessfulPoll(),
            timestamp: Date.now(),
        });
    });
}
