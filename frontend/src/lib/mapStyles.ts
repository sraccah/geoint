/**
 * Map style definitions
 * All styles are free/open — no API key required unless noted
 */

export interface MapStyleDef {
    id: string;
    label: string;
    icon: string;
    description: string;
    url: string | object;
    // CSS filter applied on top of the map canvas for visual effects
    canvasFilter?: string;
}

// ── Free tile providers ───────────────────────────────────────────────────────

const OSM_RASTER = (url: string, attribution: string) => ({
    version: 8 as const,
    sources: {
        tiles: { type: 'raster' as const, tiles: [url], tileSize: 256, attribution, maxzoom: 19 },
    },
    layers: [
        { id: 'bg', type: 'background' as const, paint: { 'background-color': '#050a0f' } },
        { id: 'tiles', type: 'raster' as const, source: 'tiles' },
    ],
});

export const MAP_STYLES: MapStyleDef[] = [
    // ── Vector styles (support globe) ──────────────────────────────────────────
    {
        id: 'dark',
        label: 'DARK',
        icon: '🌑',
        description: 'Dark intelligence theme',
        url: 'https://demotiles.maplibre.org/style.json',
    },

    // ── Raster styles (2D only, rich detail) ───────────────────────────────────
    {
        id: 'streets',
        label: 'STREETS',
        icon: '🗺',
        description: 'OpenStreetMap standard',
        url: OSM_RASTER(
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            '© OpenStreetMap contributors'
        ),
    },
    {
        id: 'satellite',
        label: 'SATELLITE',
        icon: '🛰',
        description: 'Esri World Imagery',
        url: OSM_RASTER(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            '© Esri, Maxar, Earthstar Geographics'
        ),
    },
    {
        id: 'topo',
        label: 'TOPO',
        icon: '⛰',
        description: 'OpenTopoMap terrain',
        url: OSM_RASTER(
            'https://tile.opentopomap.org/{z}/{x}/{y}.png',
            '© OpenTopoMap contributors'
        ),
    },
    {
        id: 'humanitarian',
        label: 'HUMANITARIAN',
        icon: '🏥',
        description: 'HOT humanitarian map',
        url: OSM_RASTER(
            'https://tile-a.openstreetmap.fr/hot/{z}/{x}/{y}.png',
            '© OpenStreetMap, HOT'
        ),
    },
    {
        id: 'cycle',
        label: 'TRANSPORT',
        icon: '🚇',
        description: 'Transport & transit lines',
        url: OSM_RASTER(
            `https://tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=${process.env.NEXT_PUBLIC_THUNDERFOREST_KEY || ''}`,
            '© Thunderforest, OpenStreetMap'
        ),
    },

    // ── Visual filter modes (applied via CSS on top of any base style) ──────────
    {
        id: 'night',
        label: 'NIGHT',
        icon: '🌙',
        description: 'Night vision mode',
        url: OSM_RASTER(
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            '© OpenStreetMap contributors'
        ),
        canvasFilter: 'invert(1) hue-rotate(180deg) brightness(0.7) saturate(0.5)',
    },
    {
        id: 'thermal',
        label: 'THERMAL',
        icon: '🌡',
        description: 'Thermal / infrared simulation',
        url: OSM_RASTER(
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            '© OpenStreetMap contributors'
        ),
        canvasFilter: 'grayscale(1) sepia(1) hue-rotate(300deg) saturate(3) brightness(0.8)',
    },
    {
        id: 'nvg',
        label: 'NVG',
        icon: '🟢',
        description: 'Night vision goggles (green)',
        url: OSM_RASTER(
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            '© OpenStreetMap contributors'
        ),
        canvasFilter: 'grayscale(1) brightness(1.2) sepia(0.3) hue-rotate(80deg) saturate(4)',
    },
    {
        id: 'crt',
        label: 'CRT',
        icon: '📺',
        description: 'CRT / retro terminal',
        url: 'https://demotiles.maplibre.org/style.json',
        canvasFilter: 'sepia(0.4) hue-rotate(160deg) saturate(2) brightness(0.85) contrast(1.2)',
    },
];

export const DEFAULT_STYLE_ID = 'night';

// Windy forecast key for weather overlay
export const WINDY_FORECAST_KEY = process.env.NEXT_PUBLIC_WINDY_FORECAST_KEY || '';

// Windy weather layers available via their embed API
export const WINDY_LAYERS = [
    { id: 'wind', label: 'WIND', icon: '💨' },
    { id: 'rain', label: 'RAIN', icon: '🌧' },
    { id: 'clouds', label: 'CLOUDS', icon: '☁️' },
    { id: 'temp', label: 'TEMP', icon: '🌡' },
    { id: 'pressure', label: 'PRESSURE', icon: '📊' },
    { id: 'waves', label: 'WAVES', icon: '🌊' },
];
