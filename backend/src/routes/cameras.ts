import { FastifyInstance } from 'fastify';
import { getCameras } from '../services/cameras';
import { Camera } from '../types';
import { cacheDel } from '../services/redis';
import { config } from '../config';

export async function cameraRoutes(fastify: FastifyInstance): Promise<void> {
    // GET /cameras
    fastify.get<{
        Querystring: {
            type?: string;
            country?: string;
            min_lat?: string;
            max_lat?: string;
            min_lon?: string;
            max_lon?: string;
        };
    }>('/cameras', async (request, reply) => {
        const q = request.query;
        let cameras = await getCameras();

        if (q.type) {
            cameras = cameras.filter((c) => c.type === q.type);
        }
        if (q.country) {
            cameras = cameras.filter(
                (c) => c.country?.toLowerCase() === q.country!.toLowerCase()
            );
        }
        if (q.min_lat && q.max_lat && q.min_lon && q.max_lon) {
            const minLat = parseFloat(q.min_lat);
            const maxLat = parseFloat(q.max_lat);
            const minLon = parseFloat(q.min_lon);
            const maxLon = parseFloat(q.max_lon);
            cameras = cameras.filter(
                (c) =>
                    c.latitude >= minLat &&
                    c.latitude <= maxLat &&
                    c.longitude >= minLon &&
                    c.longitude <= maxLon
            );
        }

        return reply.send({ data: cameras, total: cameras.length, timestamp: Date.now() });
    });

    // GET /cameras/:id
    fastify.get<{ Params: { id: string } }>('/cameras/:id', async (request, reply) => {
        const cameras = await getCameras();
        const camera = cameras.find((c) => c.id === request.params.id);
        if (!camera) return reply.status(404).send({ error: 'Camera not found' });
        return reply.send({ data: camera, timestamp: Date.now() });
    });

    // POST /cameras/refresh — bust cache and re-fetch all sources
    fastify.post('/cameras/refresh', async (_req, reply) => {
        await cacheDel(config.cacheKeys.cameras);
        // Trigger async re-fetch (don't await — returns immediately)
        getCameras().catch((e) => console.error('[Cameras] Refresh error:', e));
        return reply.send({ message: 'Camera cache cleared, re-fetching in background' });
    });
}
