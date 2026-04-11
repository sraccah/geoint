/**
 * Satellite position computation using SGP4 orbital mechanics
 * Uses satellite.js which implements the SGP4/SDP4 propagator
 */
import * as satellite from 'satellite.js';
import { SatelliteGP } from '@/types/satellite';

export interface SatellitePosition {
    noradId: number;
    name: string;
    latitude: number;
    longitude: number;
    altitude: number; // km
    velocity: number; // km/s
    azimuth?: number;
}

export interface OrbitalInfo {
    period: number;        // minutes
    inclination: number;   // degrees
    altitude: number;      // km (approximate)
    eccentricity: number;
    orbitType: string;
    revsPerDay: number;
}

// Convert GP elements to TLE strings for satellite.js
function gpToTLE(gp: SatelliteGP): [string, string] | null {
    try {
        // Build TLE line 1
        const epoch = new Date(gp.EPOCH);
        const year = epoch.getUTCFullYear() % 100;
        const startOfYear = new Date(epoch.getUTCFullYear(), 0, 1);
        const dayOfYear = (epoch.getTime() - startOfYear.getTime()) / 86400000 + 1;

        const line1 = [
            '1',
            String(gp.NORAD_CAT_ID).padStart(5, '0') + gp.CLASSIFICATION_TYPE,
            (gp.OBJECT_ID || '00000A  ').replace('-', '').padEnd(8, ' ').substring(0, 8),
            String(year).padStart(2, '0') + dayOfYear.toFixed(8).padStart(12, '0'),
            formatExp(gp.MEAN_MOTION_DOT),
            formatExp(gp.MEAN_MOTION_DDOT),
            formatExp(gp.BSTAR),
            '0',
            String(gp.ELEMENT_SET_NO || 999).padStart(4, ' ') + '0',
        ].join(' ');

        // Build TLE line 2
        const line2 = [
            '2',
            String(gp.NORAD_CAT_ID).padStart(5, '0'),
            gp.INCLINATION.toFixed(4).padStart(8, ' '),
            gp.RA_OF_ASC_NODE.toFixed(4).padStart(8, ' '),
            gp.ECCENTRICITY.toFixed(7).substring(2).padStart(7, '0'),
            gp.ARG_OF_PERICENTER.toFixed(4).padStart(8, ' '),
            gp.MEAN_ANOMALY.toFixed(4).padStart(8, ' '),
            gp.MEAN_MOTION.toFixed(8).padStart(11, ' '),
            String(gp.REV_AT_EPOCH || 0).padStart(5, ' ') + '0',
        ].join(' ');

        return [line1, line2];
    } catch {
        return null;
    }
}

function formatExp(val: number): string {
    if (val === 0) return ' 00000-0';
    const exp = Math.floor(Math.log10(Math.abs(val)));
    const mantissa = val / Math.pow(10, exp);
    const sign = val >= 0 ? '+' : '-';
    return ` ${sign}${Math.abs(mantissa).toFixed(5).replace('.', '')}${exp >= 0 ? '+' : '-'}${Math.abs(exp)}`;
}

// Compute current position from GP elements using satellite.js
export function computePosition(gp: SatelliteGP, date: Date = new Date()): SatellitePosition | null {
    try {
        const tle = gpToTLE(gp);
        if (!tle) return null;

        const satrec = satellite.twoline2satrec(tle[0], tle[1]);
        const posVel = satellite.propagate(satrec, date);

        if (!posVel.position || typeof posVel.position === 'boolean') return null;

        const gmst = satellite.gstime(date);
        const geo = satellite.eciToGeodetic(posVel.position as satellite.EciVec3<number>, gmst);

        const lat = satellite.degreesLat(geo.latitude);
        const lon = satellite.degreesLong(geo.longitude);
        const alt = geo.height; // km

        // Velocity magnitude
        const vel = posVel.velocity as satellite.EciVec3<number>;
        const speed = vel ? Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2) : 0;

        if (isNaN(lat) || isNaN(lon) || isNaN(alt)) return null;

        return {
            noradId: gp.NORAD_CAT_ID,
            name: gp.OBJECT_NAME,
            latitude: lat,
            longitude: lon,
            altitude: alt,
            velocity: speed,
        };
    } catch {
        return null;
    }
}

// Compute orbital path (next N minutes)
export function computeOrbitPath(
    gp: SatelliteGP,
    minutes: number = 90,
    stepSeconds: number = 60
): [number, number][] {
    const points: [number, number][] = [];
    const tle = gpToTLE(gp);
    if (!tle) return points;

    try {
        const satrec = satellite.twoline2satrec(tle[0], tle[1]);
        const now = Date.now();

        for (let s = 0; s <= minutes * 60; s += stepSeconds) {
            const date = new Date(now + s * 1000);
            const posVel = satellite.propagate(satrec, date);
            if (!posVel.position || typeof posVel.position === 'boolean') continue;

            const gmst = satellite.gstime(date);
            const geo = satellite.eciToGeodetic(posVel.position as satellite.EciVec3<number>, gmst);
            const lat = satellite.degreesLat(geo.latitude);
            const lon = satellite.degreesLong(geo.longitude);

            if (!isNaN(lat) && !isNaN(lon)) {
                points.push([lon, lat]);
            }
        }
    } catch { /* ignore */ }

    return points;
}

// Classify orbit type from inclination and altitude
export function getOrbitalInfo(gp: SatelliteGP): OrbitalInfo {
    const period = 1440 / gp.MEAN_MOTION; // minutes
    // Approximate altitude from mean motion (vis-viva)
    const mu = 398600.4418; // km³/s²
    const Re = 6371; // km
    const n = gp.MEAN_MOTION * 2 * Math.PI / 86400; // rad/s
    const a = Math.cbrt(mu / (n * n)); // semi-major axis km
    const altitude = a - Re;

    let orbitType = 'LEO';
    if (altitude > 35000) orbitType = 'GEO';
    else if (altitude > 20000) orbitType = 'MEO';
    else if (altitude > 2000) orbitType = 'MEO';
    else if (gp.INCLINATION > 80) orbitType = 'SSO/Polar';
    else orbitType = 'LEO';

    return {
        period,
        inclination: gp.INCLINATION,
        altitude,
        eccentricity: gp.ECCENTRICITY,
        orbitType,
        revsPerDay: gp.MEAN_MOTION,
    };
}
