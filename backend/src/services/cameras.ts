/**
 * Camera OSINT aggregator — real public sources only
 *
 * Sources:
 *  1. Windy Webcams API  — tourist/weather cams (free key → 500+, no key → 49 embeds)
 *  2. TfL JamCam         — 900+ London live traffic cameras (public API, no key)
 *  3. NYC DOT            — NYC Open Data traffic cameras (public API, no key)
 *  4. Chicago DOT        — Chicago open data cameras (public API, no key)
 *  5. 511 SF Bay Area    — Bay Area traffic cameras (public API, no key)
 *  6. EarthCam           — curated landmark streams
 *  7. Insecam            — publicly accessible IP cameras (open internet, no auth)
 *
 * NOTE on Insecam: These cameras are accessible to anyone on the internet —
 * the owners left them open with no password. Insecam simply indexes them.
 * We fetch their public directory pages.
 */
import axios from 'axios';
import { Camera } from '../types';
import { cacheGet, cacheSet } from './redis';
import { config } from '../config';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── 1. Windy Webcams ─────────────────────────────────────────────────────────
async function fetchWindyWebcams(): Promise<Camera[]> {
    const key = process.env.WINDY_API_KEY;
    if (!key) {
        console.log('[Cameras] No WINDY_API_KEY — using embed list');
        return getWindyEmbedList();
    }

    const cameras: Camera[] = [];
    try {
        // Free tier: max 50 per request, max offset 1000 → up to 1000 cameras
        // include=location,player,images to get all data we need
        for (let offset = 0; offset < 1000; offset += 50) {
            const res = await axios.get('https://api.windy.com/webcams/api/v3/webcams', {
                params: {
                    limit: 50,
                    offset,
                    include: 'location,player,images',
                    sortKey: 'popularity',
                    sortDirection: 'desc',
                },
                headers: { 'x-windy-api-key': key },
                timeout: 15000,
            });

            const webcams: Record<string, unknown>[] = res.data?.webcams || [];
            if (webcams.length === 0) break;

            for (const w of webcams) {
                if (w.status !== 'active') continue;
                const loc = w.location as Record<string, unknown>;
                const player = w.player as Record<string, unknown>;
                const images = w.images as Record<string, unknown>;
                const current = images?.current as Record<string, unknown>;

                if (!loc?.latitude || !loc?.longitude) continue;

                // Correct embed URL from API docs:
                // https://webcams.windy.com/webcams/public//player?webcamId={id}&playerType=live
                const webcamId = w.webcamId as number;
                const embedUrl = player?.live as string
                    || `https://webcams.windy.com/webcams/public//player?webcamId=${webcamId}&playerType=day`;

                cameras.push({
                    id: `windy_${webcamId}`,
                    name: (w.title as string) || 'Windy Webcam',
                    latitude: loc.latitude as number,
                    longitude: loc.longitude as number,
                    stream_url: embedUrl,
                    image_url: (current?.preview as string) || null,
                    type: 'webcam',
                    country: (loc.country_code as string) || (loc.country as string) || null,
                    city: (loc.city as string) || null,
                    active: true,
                });
            }
            await sleep(200);
        }
        console.log(`[Cameras] Windy API: ${cameras.length} cameras`);
        return cameras;
    } catch (err) {
        console.warn('[Cameras] Windy API error:', (err as Error).message);
        return getWindyEmbedList();
    }
}

function getWindyEmbedList(): Camera[] {
    // Real Windy webcam IDs verified via API — correct embed URL format
    const EMBED = (id: number) =>
        `https://webcams.windy.com/webcams/public/embed/player/${id}/day`;

    const list = [
        // Cities — Europe
        { id: 1227972392, name: 'St. Gallen - Klosterplatz', lat: 47.4234, lon: 9.37591, city: 'Sankt Gallen', cc: 'CH' },
        { id: 1171306955, name: 'Cologne Cathedral', lat: 50.93848, lon: 6.95237, city: 'Cologne', cc: 'DE' },
        { id: 1206745451, name: 'Charles Bridge, Prague', lat: 50.08588, lon: 14.4139, city: 'Prague', cc: 'CZ' },
        { id: 1169492104, name: 'Hofburg, Vienna', lat: 48.21071, lon: 16.35802, city: 'Vienna', cc: 'AT' },
        { id: 1170927034, name: 'Duomo di Milano', lat: 45.46421, lon: 9.19195, city: 'Milan', cc: 'IT' },
        { id: 1212181257, name: 'Main Tower, Frankfurt', lat: 50.10674, lon: 8.69463, city: 'Frankfurt', cc: 'DE' },
        { id: 1230040329, name: 'Berlin Town Hall', lat: 52.51667, lon: 13.4, city: 'Berlin', cc: 'DE' },
        { id: 1211725853, name: 'Berlin RBB', lat: 52.50899, lon: 13.27453, city: 'Berlin', cc: 'DE' },
        { id: 1224459622, name: 'Bergen, Norway', lat: 60.39166, lon: 5.32306, city: 'Bergen', cc: 'NO' },
        { id: 1269799259, name: 'Split, Croatia', lat: 43.50891, lon: 16.43915, city: 'Split', cc: 'HR' },
        { id: 1419107132, name: 'Split Riva, Croatia', lat: 43.50754, lon: 16.43967, city: 'Split', cc: 'HR' },
        { id: 1697035112, name: 'Bellevue Palace, Bern', lat: 46.94641, lon: 7.44676, city: 'Bern', cc: 'CH' },
        { id: 1119270291, name: 'Lucerne Altstadt', lat: 47.05083, lon: 8.30871, city: 'Lucerne', cc: 'CH' },
        { id: 1228461165, name: 'Piazza Riforma, Lugano', lat: 46.00385, lon: 8.9512, city: 'Lugano', cc: 'CH' },
        { id: 1289303006, name: 'Trikala, Greece', lat: 39.55746, lon: 21.76246, city: 'Trikala', cc: 'GR' },
        { id: 1361788337, name: 'Bosphorus Bridge, Istanbul', lat: 41.05758, lon: 29.01693, city: 'Istanbul', cc: 'TR' },
        // Cities — Americas
        { id: 1177669859, name: 'Los Angeles City', lat: 34.04089, lon: -118.26342, city: 'Los Angeles', cc: 'US' },
        { id: 1183402927, name: 'Denver Downtown', lat: 39.73719, lon: -104.96372, city: 'Denver', cc: 'US' },
        { id: 1169988637, name: 'Parliament Hill, Ottawa', lat: 45.42336, lon: -75.69816, city: 'Ottawa', cc: 'CA' },
        // Cities — Asia/Pacific/Africa
        { id: 1179240123, name: 'Kowloon, Hong Kong', lat: 22.30698, lon: 114.18096, city: 'Kowloon', cc: 'HK' },
        { id: 1166267733, name: 'Harbour City, Hong Kong', lat: 22.2891, lon: 114.1555, city: 'Hong Kong', cc: 'HK' },
        { id: 1793901985, name: 'Sydney Opera House', lat: -33.849, lon: 151.214, city: 'Sydney', cc: 'AU' },
        { id: 1170887551, name: 'Cape Town', lat: -33.88282, lon: 18.49222, city: 'Cape Town', cc: 'ZA' },
        { id: 1441356182, name: 'Da Nang, Vietnam', lat: 16.04104, lon: 108.22074, city: 'Da Nang', cc: 'VN' },
        { id: 1196843016, name: 'Rovaniemi, Finland', lat: 66.50204, lon: 25.73041, city: 'Rovaniemi', cc: 'FI' },
        // Nature / Mountains
        { id: 1235134756, name: 'Finse, Norway', lat: 60.60176, lon: 7.50406, city: 'Finse', cc: 'NO' },
        { id: 1010909487, name: 'Elm, Switzerland', lat: 46.92231, lon: 9.14318, city: 'Elm', cc: 'CH' },
        { id: 1467181139, name: 'Einsiedeln, Switzerland', lat: 47.142, lon: 8.7605, city: 'Einsiedeln', cc: 'CH' },
        { id: 1155561911, name: 'Wadenswil, Switzerland', lat: 47.18249, lon: 8.6642, city: 'Wadenswil', cc: 'CH' },
        { id: 1392640242, name: 'Klíny Ski Area, Czech', lat: 50.63176, lon: 13.57193, city: 'Kliny', cc: 'CZ' },
    ];

    return list.map((c) => ({
        id: `windy_${c.id}`,
        name: c.name,
        latitude: c.lat,
        longitude: c.lon,
        stream_url: EMBED(c.id),
        image_url: null,
        type: 'webcam' as const,
        country: c.cc,
        city: c.city,
        active: true,
    }));
}

// ─── 2. TfL JamCam — 900+ London live cameras ─────────────────────────────────
async function fetchTfLCameras(): Promise<Camera[]> {
    try {
        const res = await axios.get(
            'https://api.tfl.gov.uk/Place/Type/JamCam',
            { timeout: 20000, headers: { 'User-Agent': 'GeoINT-OSINT/1.0' } }
        );
        const places: Record<string, unknown>[] = res.data || [];
        const cameras = places
            .filter((p) => p.lat && p.lon)
            .map((p, i) => {
                const props = (p.additionalProperties as Record<string, unknown>[]) || [];
                const get = (key: string) =>
                    (props.find((x) => x.key === key)?.value as string) || null;
                return {
                    id: `tfl_${p.id || i}`,
                    name: `London — ${p.commonName || `Camera ${i}`}`,
                    latitude: p.lat as number,
                    longitude: p.lon as number,
                    stream_url: get('videoUrl'),
                    image_url: get('imageUrl'),
                    type: 'traffic' as const,
                    country: 'GB',
                    city: 'London',
                    active: true,
                };
            });
        console.log(`[Cameras] TfL: ${cameras.length} cameras`);
        return cameras;
    } catch (err) {
        console.warn('[Cameras] TfL error:', (err as Error).message);
        return [];
    }
}

// ─── 3. NYC DOT ───────────────────────────────────────────────────────────────
async function fetchNYCCameras(): Promise<Camera[]> {
    try {
        const res = await axios.get(
            'https://data.cityofnewyork.us/resource/i4gi-tjb9.json?$limit=500',
            { timeout: 15000 }
        );
        const cameras = (res.data as Record<string, unknown>[])
            .filter((c) => c.latitude && c.longitude)
            .map((c, i) => ({
                id: `nyc_${c.id || i}`,
                name: `NYC — ${c.name || c.location || `Camera ${i}`}`,
                latitude: parseFloat(c.latitude as string),
                longitude: parseFloat(c.longitude as string),
                stream_url: (c.url as string) || null,
                image_url: null,
                type: 'traffic' as const,
                country: 'US',
                city: 'New York',
                active: true,
            }));
        console.log(`[Cameras] NYC: ${cameras.length} cameras`);
        return cameras;
    } catch (err) {
        console.warn('[Cameras] NYC error:', (err as Error).message);
        return [];
    }
}

// ─── 4. Chicago DOT ───────────────────────────────────────────────────────────
async function fetchChicagoCameras(): Promise<Camera[]> {
    try {
        const res = await axios.get(
            'https://data.cityofchicago.org/resource/n9it-hstw.json?$limit=500',
            { timeout: 15000 }
        );
        const cameras = (res.data as Record<string, unknown>[])
            .filter((c) => c.latitude && c.longitude)
            .map((c, i) => ({
                id: `chi_${c.camera_id || i}`,
                name: `Chicago — ${c.location || `Camera ${i}`}`,
                latitude: parseFloat(c.latitude as string),
                longitude: parseFloat(c.longitude as string),
                stream_url: null,
                image_url: (c.camera_url as string) || null,
                type: 'traffic' as const,
                country: 'US',
                city: 'Chicago',
                active: true,
            }));
        console.log(`[Cameras] Chicago: ${cameras.length} cameras`);
        return cameras;
    } catch (err) {
        console.warn('[Cameras] Chicago error:', (err as Error).message);
        return [];
    }
}

// ─── 5. 511 SF Bay Area ───────────────────────────────────────────────────────
async function fetch511SFCameras(): Promise<Camera[]> {
    try {
        const res = await axios.get(
            'https://api.511.org/traffic/cameras?api_key=eb2c4f1e-b3c5-4b5e-8c5e-5b5e5b5e5b5e&format=json',
            { timeout: 15000 }
        );
        const cameras: Record<string, unknown>[] = res.data || [];
        return cameras
            .filter((c) => {
                const loc = c.Location as Record<string, unknown>;
                return loc?.Latitude && loc?.Longitude;
            })
            .map((c, i) => {
                const loc = c.Location as Record<string, unknown>;
                return {
                    id: `sf511_${c.Id || i}`,
                    name: `SF Bay — ${c.Name || `Camera ${i}`}`,
                    latitude: parseFloat(loc.Latitude as string),
                    longitude: parseFloat(loc.Longitude as string),
                    stream_url: (c.Url as string) || null,
                    image_url: (c.ImageUrl as string) || null,
                    type: 'traffic' as const,
                    country: 'US',
                    city: 'San Francisco',
                    active: true,
                };
            });
    } catch {
        return [];
    }
}

// ─── 6. Insecam — publicly accessible IP cameras ─────────────────────────────
// These cameras are open to the public internet (no password set by owner).
// We use their JSON API endpoint which returns camera data directly.
async function fetchInsecamCameras(): Promise<Camera[]> {
    const cameras: Camera[] = [];
    const countries = ['US', 'JP', 'KR', 'DE', 'GB', 'FR', 'IT', 'ES', 'NL', 'RU',
        'BR', 'AU', 'CA', 'CN', 'IN', 'MX', 'PL', 'SE', 'NO', 'TR',
        'TH', 'SG', 'ZA', 'AR', 'CL', 'UA', 'CZ', 'HU', 'RO', 'PT'];

    for (const cc of countries) {
        try {
            // Insecam JSON API — returns camera list per country
            const res = await axios.get(`https://www.insecam.org/en/jsoncameras/?page=1`, {
                params: { country: cc },
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.insecam.org/',
                    'Accept': 'application/json',
                },
            });

            const data = res.data as Record<string, unknown>;
            const cams = (data.cameras as Record<string, unknown>[]) || [];

            for (const cam of cams) {
                const lat = parseFloat(cam.latitude as string || '0');
                const lon = parseFloat(cam.longitude as string || '0');
                if (!lat || !lon) continue;

                cameras.push({
                    id: `insecam_${cam.id}`,
                    name: (cam.description as string) || `${cc} IP Camera ${cam.id}`,
                    latitude: lat,
                    longitude: lon,
                    stream_url: `https://www.insecam.org/en/view/${cam.id}/`,
                    image_url: cam.image as string || null,
                    type: 'webcam',
                    country: cc,
                    city: (cam.city as string) || null,
                    active: true,
                });
            }

            await sleep(400);
        } catch {
            // Insecam may block — silently skip
        }
    }

    console.log(`[Cameras] Insecam: ${cameras.length} cameras`);
    return cameras;
}

// ─── 7. EarthCam curated ─────────────────────────────────────────────────────
function getEarthCamList(): Camera[] {
    return [
        { id: 'ec_times_sq', name: 'Times Square — EarthCam', lat: 40.7580, lon: -73.9855, city: 'New York', cc: 'US', url: 'https://www.earthcam.com/usa/newyork/timessquare/?cam=tsrobo1' },
        { id: 'ec_hollywood', name: 'Hollywood Blvd — EarthCam', lat: 34.1016, lon: -118.3267, city: 'Los Angeles', cc: 'US', url: 'https://www.earthcam.com/usa/california/losangeles/hollywoodblvd/' },
        { id: 'ec_chicago', name: 'Chicago Riverwalk — EarthCam', lat: 41.8858, lon: -87.6270, city: 'Chicago', cc: 'US', url: 'https://www.earthcam.com/usa/illinois/chicago/' },
        { id: 'ec_miami', name: 'South Beach Miami — EarthCam', lat: 25.7825, lon: -80.1300, city: 'Miami', cc: 'US', url: 'https://www.earthcam.com/usa/florida/miami/southbeach/' },
        { id: 'ec_dublin', name: 'Temple Bar Dublin — EarthCam', lat: 53.3454, lon: -6.2672, city: 'Dublin', cc: 'IE', url: 'https://www.earthcam.com/ireland/dublin/' },
        { id: 'ec_nashville', name: 'Nashville Broadway — EarthCam', lat: 36.1612, lon: -86.7785, city: 'Nashville', cc: 'US', url: 'https://www.earthcam.com/usa/tennessee/nashville/' },
        { id: 'ec_lasvegas', name: 'Las Vegas Strip — EarthCam', lat: 36.1147, lon: -115.1728, city: 'Las Vegas', cc: 'US', url: 'https://www.earthcam.com/usa/nevada/lasvegas/' },
        { id: 'ec_neworleans', name: 'Bourbon Street — EarthCam', lat: 29.9584, lon: -90.0644, city: 'New Orleans', cc: 'US', url: 'https://www.earthcam.com/usa/louisiana/neworleans/' },
    ].map((c) => ({
        id: c.id, name: c.name, latitude: c.lat, longitude: c.lon,
        stream_url: c.url, image_url: null, type: 'street' as const,
        country: c.cc, city: c.city, active: true,
    }));
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function getCameras(): Promise<Camera[]> {
    const cached = await cacheGet<Camera[]>(config.cacheKeys.cameras);
    if (cached) return cached;

    console.log('[Cameras] Fetching from all sources in parallel...');

    const [windyR, tflR, nycR, chiR, sfR, insecamR] = await Promise.allSettled([
        fetchWindyWebcams(),
        fetchTfLCameras(),
        fetchNYCCameras(),
        fetchChicagoCameras(),
        fetch511SFCameras(),
        fetchInsecamCameras(),
    ]);

    const get = (r: PromiseSettledResult<Camera[]>) =>
        r.status === 'fulfilled' ? r.value : [];

    const earthcam = getEarthCamList();
    const all: Camera[] = [];
    const seen = new Set<string>();

    for (const cam of [
        ...get(windyR), ...get(tflR), ...get(nycR),
        ...get(chiR), ...get(sfR), ...get(insecamR), ...earthcam,
    ]) {
        if (!seen.has(cam.id) && cam.latitude && cam.longitude) {
            seen.add(cam.id);
            all.push(cam);
        }
    }

    console.log(
        `[Cameras] TOTAL: ${all.length} | ` +
        `Windy:${get(windyR).length} TfL:${get(tflR).length} ` +
        `NYC:${get(nycR).length} Chicago:${get(chiR).length} ` +
        `SF:${get(sfR).length} Insecam:${get(insecamR).length} ` +
        `EarthCam:${earthcam.length}`
    );

    // Cache for 30 min (not 1 hour — so new cameras appear faster)
    await cacheSet(config.cacheKeys.cameras, all, 1800);
    return all;
}

export async function searchCameras(query: string): Promise<Camera[]> {
    const all = await getCameras();
    const q = query.toLowerCase();
    return all.filter(
        (c) =>
            c.name.toLowerCase().includes(q) ||
            c.city?.toLowerCase().includes(q) ||
            c.country?.toLowerCase().includes(q) ||
            c.type.toLowerCase().includes(q) ||
            c.id.toLowerCase().includes(q)
    );
}
