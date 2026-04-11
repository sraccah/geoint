/**
 * ADSB.fi — free, no auth, no military filtering
 * https://api.adsb.fi
 */
import axios from 'axios';
import { Flight } from '../types';
import { classifyFlight } from './flightClassifier';

const BASE = 'https://api.adsb.fi/v1';

interface AdsbFiAircraft {
    hex: string;
    flight?: string;
    r?: string;        // registration
    t?: string;        // aircraft type
    lat?: number;
    lon?: number;
    alt_baro?: number | string;
    alt_geom?: number;
    gs?: number;       // ground speed (knots)
    track?: number;
    baro_rate?: number;
    squawk?: string;
    on_ground?: boolean;
    seen?: number;
    seen_pos?: number;
    category?: string;
    origin?: string;
    destination?: string;
}

function knotsToMs(knots: number): number {
    return knots * 0.514444;
}

function feetToMeters(feet: number): number {
    return feet * 0.3048;
}

export async function fetchAdsbFiAll(): Promise<Flight[]> {
    try {
        // Correct endpoint is /v1/aircraft (not /v1/flights)
        const res = await axios.get<{ aircraft: AdsbFiAircraft[] }>(`${BASE}/aircraft`, {
            timeout: 20000,
            headers: { 'User-Agent': 'GeoINT-OSINT/1.0' },
        });

        const aircraft = res.data?.aircraft || [];
        console.log(`[ADSB.fi] ${aircraft.length} aircraft`);

        return aircraft
            .filter((a) => a.lat !== undefined && a.lon !== undefined)
            .map((a): Flight => {
                const altFt = typeof a.alt_baro === 'number' ? a.alt_baro : null;
                return {
                    flight_id: a.hex,
                    callsign: a.flight?.trim() || null,
                    latitude: a.lat!,
                    longitude: a.lon!,
                    altitude: altFt !== null ? feetToMeters(altFt) : null,
                    velocity: a.gs !== undefined ? knotsToMs(a.gs) : null,
                    heading: a.track ?? null,
                    vertical_rate: a.baro_rate !== undefined ? feetToMeters(a.baro_rate) / 60 : null,
                    origin_country: null,
                    origin_airport: a.origin || null,
                    destination_airport: a.destination || null,
                    aircraft_type: a.t || null,
                    category: classifyFlight(a.hex, a.flight || '', a.category || '', a.t || ''),
                    on_ground: a.on_ground ?? (a.alt_baro === 'ground'),
                    last_contact: Math.floor(Date.now() / 1000) - (a.seen ?? 0),
                    squawk: a.squawk || null,
                };
            });
    } catch (err) {
        console.warn('[ADSB.fi] Error:', (err as Error).message);
        return [];
    }
}

export async function fetchAdsbFiByArea(
    lat: number, lon: number, radiusNm: number
): Promise<Flight[]> {
    try {
        const res = await axios.get<{ aircraft: AdsbFiAircraft[] }>(
            `${BASE}/point/${lat}/${lon}/${radiusNm}`,
            { timeout: 10000 }
        );
        const aircraft = res.data?.aircraft || [];
        return aircraft
            .filter((a) => a.lat !== undefined && a.lon !== undefined)
            .map((a): Flight => ({
                flight_id: a.hex,
                callsign: a.flight?.trim() || null,
                latitude: a.lat!,
                longitude: a.lon!,
                altitude: typeof a.alt_baro === 'number' ? feetToMeters(a.alt_baro) : null,
                velocity: a.gs !== undefined ? knotsToMs(a.gs) : null,
                heading: a.track ?? null,
                vertical_rate: a.baro_rate !== undefined ? feetToMeters(a.baro_rate) / 60 : null,
                origin_country: null,
                origin_airport: a.origin || null,
                destination_airport: a.destination || null,
                aircraft_type: a.t || null,
                category: classifyFlight(a.hex, a.flight || '', a.category || '', a.t || ''),
                on_ground: a.on_ground ?? (a.alt_baro === 'ground'),
                last_contact: Math.floor(Date.now() / 1000) - (a.seen ?? 0),
                squawk: a.squawk || null,
            }));
    } catch (err) {
        console.warn('[ADSB.fi] Area query error:', (err as Error).message);
        return [];
    }
}
