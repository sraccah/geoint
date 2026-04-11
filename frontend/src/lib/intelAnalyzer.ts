/**
 * Real-time OSINT intelligence analyzer
 * Deduces tactical/strategic situations from live flight data
 */
import { Flight } from '@/types';

export interface IntelAlert {
    id: string;
    level: 'critical' | 'warning' | 'info' | 'nominal';
    category: string;
    message: string;
    detail?: string;
    lat?: number;
    lon?: number;
    flightIds?: string[];
}

// Haversine distance in km
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Cluster flights within radiusKm of each other
function clusterFlights(flights: Flight[], radiusKm: number): Flight[][] {
    const visited = new Set<string>();
    const clusters: Flight[][] = [];

    for (const f of flights) {
        if (visited.has(f.flight_id) || !f.latitude || !f.longitude) continue;
        const cluster: Flight[] = [f];
        visited.add(f.flight_id);

        for (const other of flights) {
            if (visited.has(other.flight_id) || !other.latitude || !other.longitude) continue;
            if (distanceKm(f.latitude, f.longitude, other.latitude, other.longitude) <= radiusKm) {
                cluster.push(other);
                visited.add(other.flight_id);
            }
        }
        if (cluster.length > 1) clusters.push(cluster);
    }
    return clusters;
}

function clusterCenter(cluster: Flight[]): { lat: number; lon: number } {
    const valid = cluster.filter((f) => f.latitude && f.longitude);
    return {
        lat: valid.reduce((s, f) => s + f.latitude!, 0) / valid.length,
        lon: valid.reduce((s, f) => s + f.longitude!, 0) / valid.length,
    };
}

// Reverse geocode approximation using known regions
function approximateRegion(lat: number, lon: number): string {
    if (lat > 35 && lat < 42 && lon > 26 && lon < 45) return 'Eastern Mediterranean / Middle East';
    if (lat > 45 && lat < 70 && lon > 20 && lon < 60) return 'Eastern Europe / Russia';
    if (lat > 20 && lat < 40 && lon > 40 && lon < 65) return 'Arabian Peninsula / Persian Gulf';
    if (lat > 30 && lat < 45 && lon > 100 && lon < 130) return 'East Asia';
    if (lat > 25 && lat < 50 && lon > -130 && lon < -60) return 'North America';
    if (lat > 35 && lat < 60 && lon > -10 && lon < 30) return 'Europe';
    if (lat > -35 && lat < 15 && lon > -80 && lon < -35) return 'South America';
    if (lat > -40 && lat < 40 && lon > -20 && lon < 55) return 'Africa';
    if (lat > 0 && lat < 35 && lon > 60 && lon < 100) return 'South Asia';
    if (lat > -50 && lat < 0 && lon > 110 && lon < 180) return 'Oceania';
    return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
}

export function analyzeFlights(flights: Flight[]): IntelAlert[] {
    const alerts: IntelAlert[] = [];
    const airborne = flights.filter((f) => !f.on_ground && f.latitude && f.longitude);

    // ── 1. Military cluster detection ──────────────────────────────────────────
    const military = airborne.filter((f) => f.category === 'military');
    const milClusters = clusterFlights(military, 200); // 200km radius

    for (const cluster of milClusters) {
        if (cluster.length < 8) continue; // ignore small groups — bases/patrols are normal
        const center = clusterCenter(cluster);
        const region = approximateRegion(center.lat, center.lon);
        const callsigns = cluster.map((f) => f.callsign || f.flight_id.toUpperCase()).slice(0, 5).join(', ');

        if (cluster.length >= 20) {
            alerts.push({
                id: `mil_cluster_${center.lat.toFixed(1)}_${center.lon.toFixed(1)}`,
                level: 'critical',
                category: 'MILITARY OPERATION',
                message: `MAJOR MILITARY OPERATION — ${cluster.length} aircraft over ${region}`,
                detail: `${callsigns}${cluster.length > 5 ? ` +${cluster.length - 5} more` : ''}`,
                lat: center.lat,
                lon: center.lon,
                flightIds: cluster.map((f) => f.flight_id),
            });
        } else if (cluster.length >= 12) {
            alerts.push({
                id: `mil_cluster_${center.lat.toFixed(1)}_${center.lon.toFixed(1)}`,
                level: 'warning',
                category: 'MILITARY CONCENTRATION',
                message: `${cluster.length} military aircraft concentrated over ${region}`,
                detail: callsigns,
                lat: center.lat,
                lon: center.lon,
                flightIds: cluster.map((f) => f.flight_id),
            });
        } else {
            alerts.push({
                id: `mil_cluster_${center.lat.toFixed(1)}_${center.lon.toFixed(1)}`,
                level: 'info',
                category: 'MILITARY ACTIVITY',
                message: `${cluster.length} military aircraft near ${region}`,
                detail: callsigns,
                lat: center.lat,
                lon: center.lon,
            });
        }
    }

    // ── 2. High-altitude fast movers (potential recon/interceptors) ─────────────
    const fastHighAlt = airborne.filter(
        (f) => f.altitude !== null && f.velocity !== null &&
            f.altitude > 11000 && f.velocity > 280 && // >280 m/s ≈ Mach 0.9+
            f.category === 'military'
    );
    if (fastHighAlt.length > 0) {
        const f = fastHighAlt[0];
        const region = approximateRegion(f.latitude!, f.longitude!);
        alerts.push({
            id: `fast_mover_${f.flight_id}`,
            level: 'warning',
            category: 'HIGH-SPEED INTERCEPT',
            message: `High-speed military aircraft over ${region} — ${Math.round((f.velocity || 0) * 1.944)} kts at FL${Math.round((f.altitude || 0) / 30.48)}`,
            detail: f.callsign || f.flight_id.toUpperCase(),
            lat: f.latitude!,
            lon: f.longitude!,
            flightIds: [f.flight_id],
        });
    }

    // ── 3. Squawk 7700 (emergency) ──────────────────────────────────────────────
    const emergencies = airborne.filter((f) => f.squawk === '7700');
    for (const f of emergencies) {
        const region = approximateRegion(f.latitude!, f.longitude!);
        alerts.push({
            id: `squawk_7700_${f.flight_id}`,
            level: 'critical',
            category: '⚠ EMERGENCY SQUAWK 7700',
            message: `MAYDAY — ${f.callsign || f.flight_id.toUpperCase()} declaring emergency over ${region}`,
            detail: `Alt: ${f.altitude ? Math.round(f.altitude * 3.28084).toLocaleString() : '?'} ft`,
            lat: f.latitude!,
            lon: f.longitude!,
            flightIds: [f.flight_id],
        });
    }

    // ── 4. Squawk 7600 (radio failure) ─────────────────────────────────────────
    const radioFail = airborne.filter((f) => f.squawk === '7600');
    for (const f of radioFail.slice(0, 2)) {
        alerts.push({
            id: `squawk_7600_${f.flight_id}`,
            level: 'warning',
            category: 'RADIO FAILURE 7600',
            message: `${f.callsign || f.flight_id.toUpperCase()} — NORDO (no radio contact)`,
            lat: f.latitude!,
            lon: f.longitude!,
            flightIds: [f.flight_id],
        });
    }

    // ── 5. Squawk 7500 (hijack) ─────────────────────────────────────────────────
    const hijack = airborne.filter((f) => f.squawk === '7500');
    for (const f of hijack) {
        const region = approximateRegion(f.latitude!, f.longitude!);
        alerts.push({
            id: `squawk_7500_${f.flight_id}`,
            level: 'critical',
            category: '🚨 HIJACK SQUAWK 7500',
            message: `HIJACK ALERT — ${f.callsign || f.flight_id.toUpperCase()} over ${region}`,
            lat: f.latitude!,
            lon: f.longitude!,
            flightIds: [f.flight_id],
        });
    }

    // ── 6. Cargo cluster (logistics hub activity) ───────────────────────────────
    const cargo = airborne.filter((f) => f.category === 'cargo');
    const cargoClusters = clusterFlights(cargo, 50);
    for (const cluster of cargoClusters) {
        if (cluster.length < 20) continue; // only flag exceptional hub activity
        const center = clusterCenter(cluster);
        const region = approximateRegion(center.lat, center.lon);
        alerts.push({
            id: `cargo_hub_${center.lat.toFixed(0)}_${center.lon.toFixed(0)}`,
            level: 'info',
            category: 'LOGISTICS HUB',
            message: `Exceptional cargo activity — ${cluster.length} freighters near ${region}`,
            lat: center.lat,
            lon: center.lon,
        });
    }

    // ── 7. Global traffic density ───────────────────────────────────────────────
    const total = airborne.length;
    if (total > 15000) {
        alerts.push({
            id: 'global_traffic_high',
            level: 'nominal',
            category: 'GLOBAL AIRSPACE',
            message: `Peak global air traffic — ${total.toLocaleString()} aircraft airborne`,
        });
    } else if (total > 10000) {
        alerts.push({
            id: 'global_traffic_normal',
            level: 'nominal',
            category: 'GLOBAL AIRSPACE',
            message: `${total.toLocaleString()} aircraft tracked globally across all sources`,
        });
    }

    // ── 8. Military % anomaly ───────────────────────────────────────────────────
    const milPct = total > 0 ? (military.length / total) * 100 : 0;
    if (milPct > 12) { // >12% is genuinely anomalous
        alerts.push({
            id: 'mil_pct_high',
            level: 'warning',
            category: 'ELEVATED MILITARY POSTURE',
            message: `Military aircraft at ${milPct.toFixed(1)}% of global traffic — above normal threshold`,
            detail: `${military.length} military aircraft tracked`,
        });
    }

    // ── 9. Vertical rate anomalies (rapid descent) ──────────────────────────────
    const rapidDescent = airborne.filter(
        (f) => f.vertical_rate !== null && f.vertical_rate < -30 && // >30 m/s = ~6000 fpm — truly unusual
            f.altitude !== null && f.altitude > 5000 &&
            f.category === 'commercial'
    );
    if (rapidDescent.length > 0) {
        const f = rapidDescent[0];
        const region = approximateRegion(f.latitude!, f.longitude!);
        alerts.push({
            id: `rapid_descent_${f.flight_id}`,
            level: 'warning',
            category: 'RAPID DESCENT',
            message: `${f.callsign || f.flight_id.toUpperCase()} — unusual descent rate over ${region}`,
            detail: `${Math.round((f.vertical_rate || 0) * 196.85)} fpm`,
            lat: f.latitude!,
            lon: f.longitude!,
            flightIds: [f.flight_id],
        });
    }

    // Sort: critical first, then warning, info, nominal
    const order = { critical: 0, warning: 1, info: 2, nominal: 3 };
    return alerts.sort((a, b) => order[a.level] - order[b.level]);
}
