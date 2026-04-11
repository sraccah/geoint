/**
 * airplanes.live — free, no auth, community ADS-B aggregator
 * https://airplanes.live
 */
import axios from 'axios';
import { Flight } from '../types';
import { classifyFlight } from './flightClassifier';

const BASE = 'https://api.airplanes.live/v2';

interface AirplanesLiveAircraft {
    hex: string;
    flight?: string;
    r?: string;
    t?: string;
    lat?: number;
    lon?: number;
    alt_baro?: number | string;
    alt_geom?: number;
    gs?: number;
    track?: number;
    baro_rate?: number;
    squawk?: string;
    category?: string;
    seen?: number;
    seen_pos?: number;
    dbFlags?: number; // bit flags: 1=military, 2=interesting, 4=PIA, 8=LADD
}

export async function fetchAirplanesLive(): Promise<Flight[]> {
    try {
        // Fetch all aircraft — airplanes.live has no global endpoint, use large radius from center
        const res = await axios.get<{ ac: AirplanesLiveAircraft[]; total: number }>(
            `${BASE}/point/0/0/20000`, // 20000nm radius = global
            { timeout: 20000, headers: { 'User-Agent': 'GeoINT-OSINT/1.0' } }
        );

        const aircraft = res.data?.ac || [];
        console.log(`[airplanes.live] ${aircraft.length} aircraft`);

        return aircraft
            .filter((a) => a.lat !== undefined && a.lon !== undefined)
            .map((a): Flight => {
                const altFt = typeof a.alt_baro === 'number' ? a.alt_baro : null;
                // dbFlags bit 1 = military
                const isMilitary = (a.dbFlags ?? 0) & 1;
                const category = isMilitary
                    ? 'military'
                    : classifyFlight(a.hex, a.flight || '', a.category || '', a.t || '');

                return {
                    flight_id: a.hex,
                    callsign: a.flight?.trim() || null,
                    latitude: a.lat!,
                    longitude: a.lon!,
                    altitude: altFt !== null ? altFt * 0.3048 : null,
                    velocity: a.gs !== undefined ? a.gs * 0.514444 : null,
                    heading: a.track ?? null,
                    vertical_rate: a.baro_rate !== undefined ? (a.baro_rate * 0.3048) / 60 : null,
                    origin_country: null,
                    origin_airport: null,
                    destination_airport: null,
                    aircraft_type: a.t || null,
                    category,
                    on_ground: a.alt_baro === 'ground',
                    last_contact: Math.floor(Date.now() / 1000) - (a.seen ?? 0),
                    squawk: a.squawk || null,
                };
            });
    } catch (err) {
        console.warn('[airplanes.live] Error:', (err as Error).message);
        return [];
    }
}
