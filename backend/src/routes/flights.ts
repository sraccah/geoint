import { FastifyInstance } from 'fastify';
import { flightPoller } from '../services/flightPoller';
import { cacheGet } from '../services/redis';
import { getFlightHistory } from '../services/database';
import { config } from '../config';
import { Flight, FlightFilter, FlightStats } from '../types';

function applyFilters(flights: Flight[], filter: FlightFilter): Flight[] {
    return flights.filter((f) => {
        if (filter.categories && filter.categories.length > 0) {
            if (!filter.categories.includes(f.category)) return false;
        }
        if (filter.min_altitude !== undefined && f.altitude !== null) {
            if (f.altitude < filter.min_altitude) return false;
        }
        if (filter.max_altitude !== undefined && f.altitude !== null) {
            if (f.altitude > filter.max_altitude) return false;
        }
        if (filter.min_speed !== undefined && f.velocity !== null) {
            if (f.velocity < filter.min_speed) return false;
        }
        if (filter.max_speed !== undefined && f.velocity !== null) {
            if (f.velocity > filter.max_speed) return false;
        }
        if (filter.on_ground !== undefined) {
            if (f.on_ground !== filter.on_ground) return false;
        }
        if (filter.bounds) {
            const { min_lat, max_lat, min_lon, max_lon } = filter.bounds;
            if (f.latitude === null || f.longitude === null) return false;
            if (f.latitude < min_lat || f.latitude > max_lat) return false;
            if (f.longitude < min_lon || f.longitude > max_lon) return false;
        }
        return true;
    });
}

export async function flightRoutes(fastify: FastifyInstance): Promise<void> {
    // GET /flights - all current flights with optional filters
    fastify.get<{
        Querystring: {
            categories?: string;
            min_altitude?: string;
            max_altitude?: string;
            min_speed?: string;
            max_speed?: string;
            min_lat?: string;
            max_lat?: string;
            min_lon?: string;
            max_lon?: string;
            on_ground?: string;
        };
    }>('/flights', async (request, reply) => {
        const q = request.query;

        const filter: FlightFilter = {};

        if (q.categories) {
            filter.categories = q.categories.split(',') as FlightFilter['categories'];
        }
        if (q.min_altitude) filter.min_altitude = parseFloat(q.min_altitude);
        if (q.max_altitude) filter.max_altitude = parseFloat(q.max_altitude);
        if (q.min_speed) filter.min_speed = parseFloat(q.min_speed);
        if (q.max_speed) filter.max_speed = parseFloat(q.max_speed);
        if (q.on_ground !== undefined) filter.on_ground = q.on_ground === 'true';

        if (q.min_lat && q.max_lat && q.min_lon && q.max_lon) {
            filter.bounds = {
                min_lat: parseFloat(q.min_lat),
                max_lat: parseFloat(q.max_lat),
                min_lon: parseFloat(q.min_lon),
                max_lon: parseFloat(q.max_lon),
            };
        }

        const flights = await flightPoller.getCurrentFlights();
        const filtered = applyFilters(flights, filter);

        return reply.send({
            data: filtered,
            total: filtered.length,
            timestamp: Date.now(),
        });
    });

    // GET /flights/stats
    fastify.get('/flights/stats', async (_request, reply) => {
        const stats = await cacheGet<FlightStats>(config.cacheKeys.stats);
        const flights = await flightPoller.getCurrentFlights();

        const computed = stats || {
            total: flights.length,
            commercial: flights.filter((f) => f.category === 'commercial').length,
            cargo: flights.filter((f) => f.category === 'cargo').length,
            military: flights.filter((f) => f.category === 'military').length,
            private: flights.filter((f) => f.category === 'private').length,
            helicopter: flights.filter((f) => f.category === 'helicopter').length,
            unknown: flights.filter((f) => f.category === 'unknown').length,
            on_ground: flights.filter((f) => f.on_ground).length,
            airborne: flights.filter((f) => !f.on_ground).length,
        };

        return reply.send({ data: computed, timestamp: Date.now() });
    });

    // GET /flights/:id - single flight details
    fastify.get<{ Params: { id: string } }>('/flights/:id', async (request, reply) => {
        const flights = await flightPoller.getCurrentFlights();
        const flight = flights.find((f) => f.flight_id === request.params.id);

        if (!flight) {
            return reply.status(404).send({ error: 'Flight not found' });
        }

        return reply.send({ data: flight, timestamp: Date.now() });
    });

    // GET /flights/:id/history
    fastify.get<{ Params: { id: string }; Querystring: { minutes?: string } }>(
        '/flights/:id/history',
        async (request, reply) => {
            const minutes = parseInt(request.query.minutes || '30', 10);
            try {
                const history = await getFlightHistory(request.params.id, minutes);
                return reply.send({ data: history, timestamp: Date.now() });
            } catch (err) {
                return reply.status(500).send({ error: 'Failed to fetch history' });
            }
        }
    );
}
