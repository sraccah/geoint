/**
 * Satellite position computation using SGP4 orbital mechanics
 * Uses satellite.js which implements the SGP4/SDP4 propagator
 *
 * TLE format is fixed-width — fields must be at exact column positions.
 * The original join(' ') approach broke column alignment causing SGP4 failures.
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
}

export interface OrbitalInfo {
    period: number;      // minutes
    inclination: number; // degrees
    altitude: number;    // km (approximate)
    eccentricity: number;
    orbitType: string;
    revsPerDay: number;
}

// BSTAR drag term in TLE decimal-point-assumed format
function bstarFmt(b: number): string {
    if (b === 0) return ' 00000-0';
    const sign = b < 0 ? '-' : '+';
    const abs = Math.abs(b);
    const exp = Math.floor(Math.log10(abs));
    const mant = Math.round(abs / Math.pow(10, exp) * 100000);
    return sign + String(mant).padStart(5, '0') + (exp >= 0 ? '+' : '-') + Math.abs(exp);
}

// Mean motion first derivative in TLE format
function ndotFmt(n: number): string {
    if (n === 0) return ' .00000000';
    const sign = n < 0 ? '-' : ' ';
    return sign + '.' + Math.abs(n).toFixed(8).replace('0.', '').substring(0, 8);
}

/**
 * Convert GP orbital elements to TLE line pair.
 * TLE is a fixed-width format — each field at exact column positions.
 * Line 1: 69 chars, Line 2: 69 chars.
 */
function gpToTLE(gp: SatelliteGP): [string, string] | null {
    try {
        const epoch = new Date(gp.EPOCH);
        const yr = epoch.getUTCFullYear() % 100;
        const jan1 = Date.UTC(epoch.getUTCFullYear(), 0, 1);
        const day = (epoch.getTime() - jan1) / 86400000 + 1;

        const norad = String(gp.NORAD_CAT_ID).padStart(5, '0');
        const cls = gp.CLASSIFICATION_TYPE || 'U';
        const intldes = (gp.OBJECT_ID || '').replace('-', '').padEnd(8, ' ').substring(0, 8);
        const epochStr = String(yr).padStart(2, '0') + day.toFixed(8).padStart(12, '0');

        // Line 1 — exact fixed-width TLE format
        const line1 = '1 ' + norad + cls + ' ' + intldes + ' ' + epochStr +
            ndotFmt(gp.MEAN_MOTION_DOT) + ' ' + ' 00000-0' + ' ' +
            bstarFmt(gp.BSTAR) + ' 0 ' +
            String(gp.ELEMENT_SET_NO || 999).padStart(4, ' ') + '0';

        // Line 2 — exact fixed-width TLE format
        const inc = gp.INCLINATION.toFixed(4).padStart(8, ' ');
        const raan = gp.RA_OF_ASC_NODE.toFixed(4).padStart(8, ' ');
        const ecc = gp.ECCENTRICITY.toFixed(7).replace('0.', '').padStart(7, '0');
        const aop = gp.ARG_OF_PERICENTER.toFixed(4).padStart(8, ' ');
        const ma = gp.MEAN_ANOMALY.toFixed(4).padStart(8, ' ');
        const mm = gp.MEAN_MOTION.toFixed(8).padStart(11, ' ');
        const rev = String(gp.REV_AT_EPOCH || 0).padStart(5, ' ');

        const line2 = '2 ' + norad + ' ' + inc + ' ' + raan + ' ' + ecc +
            ' ' + aop + ' ' + ma + ' ' + mm + rev + '0';

        return [line1, line2];
    } catch {
        return null;
    }
}

// Compute current position from GP elements
export function computePosition(gp: SatelliteGP, date: Date = new Date()): SatellitePosition | null {
    try {
        const tle = gpToTLE(gp);
        if (!tle) return null;

        const satrec = satellite.twoline2satrec(tle[0], tle[1]);
        if (satrec.error !== 0) return null;

        const posVel = satellite.propagate(satrec, date);
        if (!posVel.position || typeof posVel.position === 'boolean') return null;

        const gmst = satellite.gstime(date);
        const geo = satellite.eciToGeodetic(posVel.position as satellite.EciVec3<number>, gmst);

        const lat = satellite.degreesLat(geo.latitude);
        const lon = satellite.degreesLong(geo.longitude);
        const alt = geo.height; // km

        if (isNaN(lat) || isNaN(lon) || isNaN(alt) || alt < -100) return null;

        const vel = posVel.velocity as satellite.EciVec3<number>;
        const speed = vel ? Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2) : 0;

        return { noradId: gp.NORAD_CAT_ID, name: gp.OBJECT_NAME, latitude: lat, longitude: lon, altitude: alt, velocity: speed };
    } catch {
        return null;
    }
}

// Compute orbital path (next N minutes)
export function computeOrbitPath(gp: SatelliteGP, minutes = 90, stepSeconds = 60): [number, number][] {
    const points: [number, number][] = [];
    const tle = gpToTLE(gp);
    if (!tle) return points;

    try {
        const satrec = satellite.twoline2satrec(tle[0], tle[1]);
        if (satrec.error !== 0) return points;
        const now = Date.now();

        for (let s = 0; s <= minutes * 60; s += stepSeconds) {
            const date = new Date(now + s * 1000);
            const posVel = satellite.propagate(satrec, date);
            if (!posVel.position || typeof posVel.position === 'boolean') continue;

            const gmst = satellite.gstime(date);
            const geo = satellite.eciToGeodetic(posVel.position as satellite.EciVec3<number>, gmst);
            const lat = satellite.degreesLat(geo.latitude);
            const lon = satellite.degreesLong(geo.longitude);

            if (!isNaN(lat) && !isNaN(lon)) points.push([lon, lat]);
        }
    } catch { /* ignore */ }

    return points;
}

// Classify orbit type from mean motion and inclination
export function getOrbitalInfo(gp: SatelliteGP): OrbitalInfo {
    const period = 1440 / gp.MEAN_MOTION; // minutes
    const mu = 398600.4418; // km³/s²
    const Re = 6371; // km
    const n = gp.MEAN_MOTION * 2 * Math.PI / 86400; // rad/s
    const a = Math.cbrt(mu / (n * n)); // semi-major axis km
    const altitude = a - Re;

    let orbitType = 'LEO';
    if (altitude > 35000) orbitType = 'GEO';
    else if (altitude > 20000) orbitType = 'MEO';
    else if (altitude > 2000) orbitType = 'MEO';
    else if (gp.INCLINATION > 80) orbitType = 'SSO';
    else orbitType = 'LEO';

    return { period, inclination: gp.INCLINATION, altitude, eccentricity: gp.ECCENTRICITY, orbitType, revsPerDay: gp.MEAN_MOTION };
}
