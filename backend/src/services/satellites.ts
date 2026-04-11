/**
 * Satellite tracking service
 * Data source: CelesTrak GP (General Perturbations) — NORAD/Space-Track public data
 * No API key required. Updated daily by CelesTrak.
 *
 * Architecture mirrors the flight poller:
 *  - Fetch TLE/GP data from CelesTrak
 *  - Cache in Redis (6h TTL — TLEs valid ~2 weeks)
 *  - Persist to PostgreSQL for history/search
 *  - Serve via REST API
 */
import axios from 'axios';
import { getPool } from './database';
import { cacheGet, cacheSet } from './redis';
import { SatelliteGP, SatelliteGroup } from '../types';

const CELESTRAK_BASE = 'https://celestrak.org/NORAD/elements/gp.php';
const CELESTRAK_SUPPLEMENTAL = 'https://celestrak.org/NORAD/elements/supplemental/sup-gp.php';
const CACHE_TTL_SECONDS = 6 * 3600; // 6 hours

export const SATELLITE_GROUPS: SatelliteGroup[] = [
    { id: 'stations', label: 'Space Stations', color: '#00d4ff', icon: '🛸', description: 'ISS, Tiangong, CSS', celestrakGroup: 'stations' },
    // Starlink uses supplemental endpoint (higher frequency updates, avoids "not updated" throttle)
    { id: 'starlink', label: 'Starlink', color: '#aa44ff', icon: '🔵', description: 'SpaceX Starlink constellation', celestrakGroup: 'starlink', maxCount: 500 },
    { id: 'gps', label: 'GPS', color: '#00ff88', icon: '📡', description: 'US GPS navigation (NAVSTAR)', celestrakGroup: 'gps-ops' },
    { id: 'glonass', label: 'GLONASS', color: '#44aaff', icon: '📡', description: 'Russian GLONASS navigation', celestrakGroup: 'glo-ops' },
    { id: 'galileo', label: 'Galileo', color: '#ffaa00', icon: '📡', description: 'European Galileo navigation', celestrakGroup: 'galileo' },
    { id: 'weather', label: 'Weather', color: '#00d4ff', icon: '🌤', description: 'Meteorological satellites', celestrakGroup: 'weather' },
    { id: 'military', label: 'Military', color: '#ff3355', icon: '⚔', description: 'Military/classified satellites', celestrakGroup: 'military' },
    { id: 'amateur', label: 'Amateur', color: '#ffaa00', icon: '📻', description: 'Amateur radio satellites', celestrakGroup: 'amateur' },
    { id: 'iridium', label: 'Iridium NEXT', color: '#aa44ff', icon: '📶', description: 'Iridium NEXT constellation', celestrakGroup: 'iridium-NEXT' },
    { id: 'oneweb', label: 'OneWeb', color: '#44aaff', icon: '🔵', description: 'OneWeb broadband constellation', celestrakGroup: 'oneweb' },
];

// ── Fetch from CelesTrak ──────────────────────────────────────────────────────
// Groups that have supplemental TLE data (higher frequency, avoids "not updated" throttle)
const SUPPLEMENTAL_GROUPS: Record<string, string> = {
    starlink: 'starlink',
    oneweb: 'oneweb',
};

async function fetchSupplemental(file: string, maxCount?: number): Promise<SatelliteGP[]> {
    const res = await axios.get<SatelliteGP[] | string>(CELESTRAK_SUPPLEMENTAL, {
        params: { FILE: file, FORMAT: 'JSON' },
        timeout: 25000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GeoINT/1.0)', 'Accept': 'application/json, */*' },
    });
    if (!Array.isArray(res.data)) return [];
    let data = res.data;
    if (maxCount && data.length > maxCount) data = data.slice(0, maxCount);
    return data;
}

async function fetchFromCelesTrak(group: SatelliteGroup): Promise<SatelliteGP[]> {
    // Use supplemental endpoint for Starlink/OneWeb — not subject to "not updated" throttle
    if (SUPPLEMENTAL_GROUPS[group.id]) {
        try {
            const data = await fetchSupplemental(SUPPLEMENTAL_GROUPS[group.id], group.maxCount);
            if (data.length > 0) {
                console.log(`[Satellites] ${group.label}: ${data.length} objects (supplemental)`);
                return data;
            }
        } catch (err) {
            console.warn(`[Satellites] ${group.label} supplemental failed:`, (err as Error).message);
        }
    }

    const res = await axios.get<SatelliteGP[] | string>(CELESTRAK_BASE, {
        params: { GROUP: group.celestrakGroup, FORMAT: 'JSON' },
        timeout: 25000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; GeoINT/1.0)',
            'Accept': 'application/json, text/plain, */*',
        },
    });

    // CelesTrak returns plain text "GP data has not updated since your last successful download..."
    // when the data hasn't changed since our last fetch (tracked by IP)
    if (typeof res.data === 'string' || !Array.isArray(res.data)) {
        console.log(`[Satellites] ${group.label}: CelesTrak data unchanged`);
        return []; // caller falls back to DB
    }

    let data = res.data;
    if (group.maxCount && data.length > group.maxCount) data = data.slice(0, group.maxCount);
    return data;
}

// ── Persist to PostgreSQL ─────────────────────────────────────────────────────
async function saveSatellitesToDB(groupId: string, satellites: SatelliteGP[]): Promise<void> {
    if (satellites.length === 0) return;
    const db = getPool();
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        for (const s of satellites) {
            await client.query(
                `INSERT INTO satellites (
          norad_id, object_name, object_id, group_id, epoch,
          mean_motion, eccentricity, inclination, ra_of_asc_node,
          arg_of_pericenter, mean_anomaly, bstar, mean_motion_dot,
          mean_motion_ddot, classification_type, rev_at_epoch,
          element_set_no, fetched_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
        ON CONFLICT (norad_id) DO UPDATE SET
          object_name = EXCLUDED.object_name,
          group_id = EXCLUDED.group_id,
          epoch = EXCLUDED.epoch,
          mean_motion = EXCLUDED.mean_motion,
          eccentricity = EXCLUDED.eccentricity,
          inclination = EXCLUDED.inclination,
          ra_of_asc_node = EXCLUDED.ra_of_asc_node,
          arg_of_pericenter = EXCLUDED.arg_of_pericenter,
          mean_anomaly = EXCLUDED.mean_anomaly,
          bstar = EXCLUDED.bstar,
          mean_motion_dot = EXCLUDED.mean_motion_dot,
          mean_motion_ddot = EXCLUDED.mean_motion_ddot,
          classification_type = EXCLUDED.classification_type,
          rev_at_epoch = EXCLUDED.rev_at_epoch,
          element_set_no = EXCLUDED.element_set_no,
          fetched_at = NOW()`,
                [
                    s.NORAD_CAT_ID,
                    s.OBJECT_NAME,
                    s.OBJECT_ID || null,
                    groupId,
                    s.EPOCH ? new Date(s.EPOCH) : null,
                    s.MEAN_MOTION,
                    s.ECCENTRICITY,
                    s.INCLINATION,
                    s.RA_OF_ASC_NODE,
                    s.ARG_OF_PERICENTER,
                    s.MEAN_ANOMALY,
                    s.BSTAR,
                    s.MEAN_MOTION_DOT,
                    s.MEAN_MOTION_DDOT,
                    s.CLASSIFICATION_TYPE || 'U',
                    s.REV_AT_EPOCH || 0,
                    s.ELEMENT_SET_NO || null,
                ]
            );
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Satellites] DB save error for ${groupId}:`, (err as Error).message);
    } finally {
        client.release();
    }
}

// ── Main public API ───────────────────────────────────────────────────────────
export async function getSatelliteGroup(groupId: string): Promise<SatelliteGP[]> {
    const group = SATELLITE_GROUPS.find((g) => g.id === groupId);
    if (!group) {
        console.warn(`[Satellites] Unknown group: ${groupId}`);
        return [];
    }

    const cacheKey = `geoint:satellites:${groupId}`;

    // 1. Try Redis cache
    const cached = await cacheGet<SatelliteGP[]>(cacheKey);
    if (cached) {
        console.log(`[Satellites] ${group.label}: ${cached.length} objects (from cache)`);
        return cached;
    }

    // 2. Try PostgreSQL (stale but better than nothing)
    try {
        const db = getPool();
        const result = await db.query<SatelliteGP>(
            `SELECT
        norad_id AS "NORAD_CAT_ID",
        object_name AS "OBJECT_NAME",
        object_id AS "OBJECT_ID",
        TO_CHAR(epoch, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "EPOCH",
        mean_motion AS "MEAN_MOTION",
        eccentricity AS "ECCENTRICITY",
        inclination AS "INCLINATION",
        ra_of_asc_node AS "RA_OF_ASC_NODE",
        arg_of_pericenter AS "ARG_OF_PERICENTER",
        mean_anomaly AS "MEAN_ANOMALY",
        bstar AS "BSTAR",
        mean_motion_dot AS "MEAN_MOTION_DOT",
        mean_motion_ddot AS "MEAN_MOTION_DDOT",
        classification_type AS "CLASSIFICATION_TYPE",
        rev_at_epoch AS "REV_AT_EPOCH",
        element_set_no AS "ELEMENT_SET_NO"
      FROM satellites
      WHERE group_id = $1
        AND fetched_at > NOW() - INTERVAL '24 hours'
      ORDER BY norad_id`,
            [groupId]
        );

        if (result.rows.length > 0) {
            console.log(`[Satellites] ${group.label}: ${result.rows.length} objects (from DB)`);
            await cacheSet(cacheKey, result.rows, CACHE_TTL_SECONDS);
            return result.rows;
        }
    } catch (err) {
        console.warn(`[Satellites] DB read error for ${groupId}:`, (err as Error).message);
    }

    // 3. Fetch fresh from CelesTrak
    try {
        console.log(`[Satellites] Fetching ${group.label} from CelesTrak...`);
        const data = await fetchFromCelesTrak(group);

        if (data.length === 0) {
            // CelesTrak said "data unchanged" — try DB with relaxed time window
            try {
                const db = getPool();
                const result = await db.query<SatelliteGP>(
                    `SELECT norad_id AS "NORAD_CAT_ID", object_name AS "OBJECT_NAME",
                     object_id AS "OBJECT_ID",
                     TO_CHAR(epoch, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "EPOCH",
                     mean_motion AS "MEAN_MOTION", eccentricity AS "ECCENTRICITY",
                     inclination AS "INCLINATION", ra_of_asc_node AS "RA_OF_ASC_NODE",
                     arg_of_pericenter AS "ARG_OF_PERICENTER", mean_anomaly AS "MEAN_ANOMALY",
                     bstar AS "BSTAR", mean_motion_dot AS "MEAN_MOTION_DOT",
                     mean_motion_ddot AS "MEAN_MOTION_DDOT",
                     classification_type AS "CLASSIFICATION_TYPE",
                     rev_at_epoch AS "REV_AT_EPOCH", element_set_no AS "ELEMENT_SET_NO"
                     FROM satellites WHERE group_id = $1 ORDER BY norad_id`,
                    [groupId]
                );
                if (result.rows.length > 0) {
                    console.log(`[Satellites] ${group.label}: ${result.rows.length} objects (DB fallback after unchanged)`);
                    await cacheSet(cacheKey, result.rows, CACHE_TTL_SECONDS);
                    return result.rows;
                }
            } catch { /* ignore */ }
            return [];
        }

        console.log(`[Satellites] ${group.label}: ${data.length} objects (from CelesTrak)`);
        await cacheSet(cacheKey, data, CACHE_TTL_SECONDS);
        saveSatellitesToDB(groupId, data).catch((err) =>
            console.error(`[Satellites] DB persist error:`, err.message)
        );
        return data;
    } catch (err) {
        console.error(`[Satellites] CelesTrak fetch failed for ${groupId}:`, (err as Error).message);
        return [];
    }
}

export async function getSatelliteByNorad(noradId: number): Promise<SatelliteGP | null> {
    // Check DB first
    try {
        const db = getPool();
        const result = await db.query(
            `SELECT
        norad_id AS "NORAD_CAT_ID", object_name AS "OBJECT_NAME",
        object_id AS "OBJECT_ID",
        TO_CHAR(epoch, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "EPOCH",
        mean_motion AS "MEAN_MOTION", eccentricity AS "ECCENTRICITY",
        inclination AS "INCLINATION", ra_of_asc_node AS "RA_OF_ASC_NODE",
        arg_of_pericenter AS "ARG_OF_PERICENTER", mean_anomaly AS "MEAN_ANOMALY",
        bstar AS "BSTAR", mean_motion_dot AS "MEAN_MOTION_DOT",
        mean_motion_ddot AS "MEAN_MOTION_DDOT",
        classification_type AS "CLASSIFICATION_TYPE",
        rev_at_epoch AS "REV_AT_EPOCH", element_set_no AS "ELEMENT_SET_NO"
      FROM satellites WHERE norad_id = $1`,
            [noradId]
        );
        if (result.rows[0]) return result.rows[0];
    } catch { /* fall through to CelesTrak */ }

    // Fetch from CelesTrak
    try {
        const res = await axios.get<SatelliteGP[]>(CELESTRAK_BASE, {
            params: { CATNR: noradId, FORMAT: 'JSON' },
            timeout: 10000,
        });
        return res.data?.[0] || null;
    } catch {
        return null;
    }
}

export async function searchSatellites(query: string): Promise<SatelliteGP[]> {
    try {
        const db = getPool();
        const result = await db.query(
            `SELECT
        norad_id AS "NORAD_CAT_ID", object_name AS "OBJECT_NAME",
        object_id AS "OBJECT_ID", group_id,
        TO_CHAR(epoch, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "EPOCH",
        mean_motion AS "MEAN_MOTION", eccentricity AS "ECCENTRICITY",
        inclination AS "INCLINATION", ra_of_asc_node AS "RA_OF_ASC_NODE",
        arg_of_pericenter AS "ARG_OF_PERICENTER", mean_anomaly AS "MEAN_ANOMALY",
        bstar AS "BSTAR", mean_motion_dot AS "MEAN_MOTION_DOT",
        mean_motion_ddot AS "MEAN_MOTION_DDOT",
        classification_type AS "CLASSIFICATION_TYPE",
        rev_at_epoch AS "REV_AT_EPOCH"
      FROM satellites
      WHERE object_name ILIKE $1 OR object_id ILIKE $1 OR norad_id::text = $2
      LIMIT 50`,
            [`%${query}%`, query]
        );
        return result.rows;
    } catch {
        return [];
    }
}
