import { Pool } from 'pg';
import { config } from '../config';
import { Flight } from '../types';

let pool: Pool | null = null;

// PostgreSQL max params per query = 65535
// History insert: 8 params per row → max 8191 rows per batch
// We use 500 to be safe and keep transactions small
const HISTORY_BATCH_SIZE = 500;
const HISTORY_PARAMS_PER_ROW = 8;

export function getPool(): Pool {
    if (!pool) {
        pool = new Pool({
            connectionString: config.databaseUrl,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });
        pool.on('error', (err) => console.error('PostgreSQL pool error:', err));
    }
    return pool;
}

export async function saveFlights(flights: Flight[]): Promise<void> {
    if (flights.length === 0) return;

    const valid = flights.filter((f) => f.latitude !== null && f.longitude !== null);
    if (valid.length === 0) return;

    const db = getPool();
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        // ── Upsert current positions (one row per flight, individual queries) ──
        for (const f of valid) {
            await client.query(
                `INSERT INTO flights (
           flight_id, callsign, latitude, longitude, altitude, velocity,
           heading, vertical_rate, origin_country, origin_airport,
           destination_airport, aircraft_type, category, on_ground,
           last_contact, position, recorded_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
           ST_SetSRID(ST_MakePoint($16,$17),4326), NOW())
         ON CONFLICT (flight_id) DO UPDATE SET
           callsign=EXCLUDED.callsign, latitude=EXCLUDED.latitude,
           longitude=EXCLUDED.longitude, altitude=EXCLUDED.altitude,
           velocity=EXCLUDED.velocity, heading=EXCLUDED.heading,
           vertical_rate=EXCLUDED.vertical_rate, category=EXCLUDED.category,
           on_ground=EXCLUDED.on_ground, last_contact=EXCLUDED.last_contact,
           position=EXCLUDED.position, recorded_at=NOW()`,
                [
                    f.flight_id, f.callsign, f.latitude, f.longitude,
                    f.altitude, f.velocity, f.heading, f.vertical_rate,
                    f.origin_country, f.origin_airport, f.destination_airport,
                    f.aircraft_type, f.category, f.on_ground,
                    Math.floor(f.last_contact),
                    f.longitude, f.latitude,
                ]
            );
        }

        // ── Insert history in batches to stay under pg's 65535 param limit ──
        for (let i = 0; i < valid.length; i += HISTORY_BATCH_SIZE) {
            const batch = valid.slice(i, i + HISTORY_BATCH_SIZE);

            const valuePlaceholders = batch.map((_, idx) => {
                const base = idx * HISTORY_PARAMS_PER_ROW;
                return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},ST_SetSRID(ST_MakePoint($${base + 8},$${base + 3}),4326),NOW())`;
            }).join(',');

            const params = batch.flatMap((f) => [
                f.flight_id,
                f.callsign,
                f.latitude,
                f.longitude,
                f.altitude,
                f.velocity,
                f.category,
                f.longitude, // MakePoint(lon, lat)
            ]);

            await client.query(
                `INSERT INTO flight_history
           (flight_id, callsign, latitude, longitude, altitude, velocity, category, position, recorded_at)
         VALUES ${valuePlaceholders}`,
                params
            );
        }

        // ── Cleanup history older than 2 hours ──
        await client.query(
            `DELETE FROM flight_history WHERE recorded_at < NOW() - INTERVAL '2 hours'`
        );

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export async function getFlightHistory(
    flightId: string,
    minutes = 60
): Promise<Array<{ lat: number; lon: number; altitude: number | null; recorded_at: string }>> {
    const db = getPool();
    const result = await db.query(
        `SELECT latitude as lat, longitude as lon, altitude, recorded_at
     FROM flight_history
     WHERE flight_id = $1
       AND recorded_at > NOW() - ($2 || ' minutes')::INTERVAL
     ORDER BY recorded_at ASC`,
        [flightId, minutes]
    );
    return result.rows;
}

export async function closePool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
    }
}
