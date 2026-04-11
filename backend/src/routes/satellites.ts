import { FastifyInstance } from 'fastify';
import {
    getSatelliteGroup,
    getSatelliteByNorad,
    searchSatellites,
    SATELLITE_GROUPS,
} from '../services/satellites';

export async function satelliteRoutes(fastify: FastifyInstance): Promise<void> {
    // GET /satellites/groups — list all available groups with metadata
    fastify.get('/satellites/groups', async (_req, reply) => {
        return reply.send({ data: SATELLITE_GROUPS, timestamp: Date.now() });
    });

    // GET /satellites/search?q=ISS — search by name, NORAD ID, or object ID
    fastify.get<{ Querystring: { q: string } }>(
        '/satellites/search',
        async (request, reply) => {
            const { q } = request.query;
            if (!q || q.trim().length < 2) {
                return reply.send({ data: [], total: 0 });
            }
            const results = await searchSatellites(q.trim());
            return reply.send({ data: results, total: results.length, timestamp: Date.now() });
        }
    );

    // GET /satellites/norad/:id — single satellite by NORAD catalog number
    fastify.get<{ Params: { id: string } }>(
        '/satellites/norad/:id',
        async (request, reply) => {
            const noradId = parseInt(request.params.id, 10);
            if (isNaN(noradId)) return reply.status(400).send({ error: 'Invalid NORAD ID' });
            const sat = await getSatelliteByNorad(noradId);
            if (!sat) return reply.status(404).send({ error: 'Satellite not found' });
            return reply.send({ data: sat, timestamp: Date.now() });
        }
    );

    // GET /satellites/:groupId — orbital elements for a group (lazy-loaded, cached)
    fastify.get<{ Params: { groupId: string } }>(
        '/satellites/:groupId',
        async (request, reply) => {
            const { groupId } = request.params;
            const satellites = await getSatelliteGroup(groupId);
            if (!satellites.length) {
                return reply.status(404).send({ error: `Group '${groupId}' not found or empty` });
            }
            return reply.send({
                data: satellites,
                total: satellites.length,
                group: SATELLITE_GROUPS.find((g) => g.id === groupId),
                timestamp: Date.now(),
            });
        }
    );
}
