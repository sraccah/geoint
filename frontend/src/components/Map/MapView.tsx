'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import axios from 'axios';
import { useFlightStore } from '@/store/flightStore';
import { useCameraStore } from '@/store/cameraStore';
import { useUIStore } from '@/store/uiStore';
import { Flight } from '@/types';
import { getCategoryColor } from '@/lib/utils';
import { FlightPopup } from './FlightPopup';
import { MapControls } from './MapControls';
import { IntelTicker } from './IntelTicker';
import { MAP_STYLES, MapStyleDef, DEFAULT_STYLE_ID } from '@/lib/mapStyles';

const GLOBE_ZOOM = 5;
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
const TRAIL_SOURCE = 'flight-trail';
const TRAIL_LAYER = 'flight-trail-line';
const BUILDINGS_LAYER = 'buildings-3d';

function makeAircraftEl(color: string, heading: number, size: number): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = `width:${size}px;height:${size}px;cursor:pointer;`;
    el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"
    viewBox="0 0 24 24" style="transform:rotate(${heading}deg);display:block;">
    <path d="M12 2L7 12H3l3 2-2 5h4l4 5 4-5h4l-2-5 3-2h-4z"
      fill="${color}" stroke="rgba(0,0,0,0.7)" stroke-width="0.8"/>
  </svg>`;
    return el;
}

function makeCameraEl(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = 'width:14px;height:14px;cursor:pointer;';
    el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="rgba(0,255,136,0.15)" stroke="#00ff88" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="4" fill="#00ff88"/>
  </svg>`;
    return el;
}

// Darken vector style layers for HUD theme
function applyDarkTheme(map: maplibregl.Map) {
    for (const layer of map.getStyle().layers) {
        try {
            if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', '#050a0f');
            else if (layer.type === 'fill') { map.setPaintProperty(layer.id, 'fill-color', '#0a1520'); map.setPaintProperty(layer.id, 'fill-opacity', 0.95); }
            else if (layer.type === 'line') { map.setPaintProperty(layer.id, 'line-color', '#0d2137'); map.setPaintProperty(layer.id, 'line-opacity', 0.5); }
            else if (layer.type === 'symbol') map.setLayoutProperty(layer.id, 'visibility', 'none');
        } catch { /* skip */ }
    }
}

// Add trail + 3D building sources/layers after style loads
function addOverlayLayers(map: maplibregl.Map) {
    // Trail line
    if (!map.getSource(TRAIL_SOURCE)) {
        map.addSource(TRAIL_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
            id: TRAIL_LAYER,
            type: 'line',
            source: TRAIL_SOURCE,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#00d4ff', 'line-width': 2, 'line-opacity': 0.8, 'line-dasharray': [3, 2] },
        });
    }
}

export default function MapView() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const styleReadyRef = useRef(false);
    const flightMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
    const cameraMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
    const canvasFilterRef = useRef<string>('');

    const [isGlobe, setIsGlobe] = useState(true);
    const [coords, setCoords] = useState({ lat: 25, lng: 10, zoom: 2 });
    const [hoveredFlight, setHoveredFlight] = useState<Flight | null>(null);
    const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
    const [currentStyleId, setCurrentStyleId] = useState(DEFAULT_STYLE_ID);
    const [show3D, setShow3D] = useState(false);

    const flights = useFlightStore((s) => s.flights);
    const filter = useFlightStore((s) => s.filter);
    const selectedFlight = useFlightStore((s) => s.selectedFlight);
    const selectFlight = useFlightStore((s) => s.selectFlight);
    const showFlights = useUIStore((s) => s.showFlights);
    const showCameras = useUIStore((s) => s.showCameras);
    const selectCamera = useUIStore((s) => s.selectCamera);
    const cameras = useCameraStore((s) => s.cameras);

    const filteredFlights = flights.filter((f) => {
        if (!filter.categories.includes(f.category)) return false;
        if (!filter.showOnGround && f.on_ground) return false;
        if (f.altitude !== null) {
            if (f.altitude < filter.minAltitude) return false;
            if (f.altitude > filter.maxAltitude) return false;
        }
        if (f.velocity !== null) {
            if (f.velocity < filter.minSpeed) return false;
            if (f.velocity > filter.maxSpeed) return false;
        }
        return true;
    });

    // ── Init map ────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        console.log('[MapLibre] version:', maplibregl.version);

        const initialStyle = MAP_STYLES.find((s) => s.id === DEFAULT_STYLE_ID)!;

        const map = new maplibregl.Map({
            container: mapContainer.current,
            style: initialStyle.url as maplibregl.StyleSpecification,
            center: [10, 25],
            zoom: 2,
            attributionControl: false,
            pitch: 0,
        });

        mapRef.current = map;
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
        map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'bottom-right');
        map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

        map.on('style.load', () => {
            styleReadyRef.current = true;

            // Apply canvas filter for the initial style (e.g. night mode)
            const canvas = map.getCanvas();
            canvas.style.filter = initialStyle.canvasFilter || '';
            canvasFilterRef.current = initialStyle.canvasFilter || '';

            // Globe projection (only works with vector styles)
            try {
                map.setProjection({ type: 'globe' });
                setIsGlobe(true);
                map.setFog({
                    color: 'rgba(5,10,15,0.8)',
                    'high-color': 'rgba(0,15,40,0.9)',
                    'horizon-blend': 0.05,
                    'space-color': '#020508',
                    'star-intensity': 0.9,
                });
                applyDarkTheme(map);
            } catch {
                setIsGlobe(false);
            }

            addOverlayLayers(map);
        });

        map.on('zoom', () => {
            const z = map.getZoom();
            setCoords((c) => ({ ...c, zoom: z }));
            if (!styleReadyRef.current) return;
            try {
                if (z >= GLOBE_ZOOM) { map.setProjection({ type: 'mercator' }); setIsGlobe(false); }
                else { map.setProjection({ type: 'globe' }); setIsGlobe(true); }
            } catch { /* raster styles don't support projection */ }
        });

        map.on('move', () => {
            const c = map.getCenter();
            setCoords((p) => ({ ...p, lat: c.lat, lng: c.lng }));
        });

        return () => {
            styleReadyRef.current = false;
            flightMarkersRef.current.forEach((m) => m.remove());
            flightMarkersRef.current.clear();
            cameraMarkersRef.current.forEach((m) => m.remove());
            cameraMarkersRef.current.clear();
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // ── Style switching ─────────────────────────────────────────────────────────
    const handleStyleChange = useCallback((styleDef: MapStyleDef) => {
        const map = mapRef.current;
        if (!map) return;

        setCurrentStyleId(styleDef.id);
        styleReadyRef.current = false;

        // Apply canvas CSS filter for visual modes
        canvasFilterRef.current = styleDef.canvasFilter || '';
        const canvas = map.getCanvas();
        canvas.style.filter = styleDef.canvasFilter || '';

        // Load new style
        map.setStyle(styleDef.url as maplibregl.StyleSpecification);

        map.once('style.load', () => {
            styleReadyRef.current = true;

            // Try globe (vector styles only)
            try {
                const z = map.getZoom();
                if (z < GLOBE_ZOOM) {
                    map.setProjection({ type: 'globe' });
                    setIsGlobe(true);
                    map.setFog({
                        color: 'rgba(5,10,15,0.8)',
                        'high-color': 'rgba(0,15,40,0.9)',
                        'horizon-blend': 0.05,
                        'space-color': '#020508',
                        'star-intensity': 0.9,
                    });
                } else {
                    map.setProjection({ type: 'mercator' });
                    setIsGlobe(false);
                }
                // Dark theme for vector styles
                if (styleDef.id === 'dark' || styleDef.id === 'crt') applyDarkTheme(map);
            } catch {
                setIsGlobe(false);
            }

            addOverlayLayers(map);

            // Re-add 3D buildings if enabled
            if (show3D) add3DBuildings(map);
        });
    }, [show3D]);

    // ── 3D Buildings ────────────────────────────────────────────────────────────
    const add3DBuildings = (map: maplibregl.Map) => {
        if (map.getLayer(BUILDINGS_LAYER)) return;

        // Add OSM buildings source if not present
        if (!map.getSource('osm-buildings')) {
            map.addSource('osm-buildings', {
                type: 'vector',
                url: 'https://demotiles.maplibre.org/tiles/tiles.json',
            });
        }

        try {
            map.addLayer({
                id: BUILDINGS_LAYER,
                type: 'fill-extrusion',
                source: 'osm-buildings',
                'source-layer': 'buildings',
                minzoom: 14,
                paint: {
                    'fill-extrusion-color': '#0a2040',
                    'fill-extrusion-height': ['coalesce', ['get', 'height'], 10],
                    'fill-extrusion-base': 0,
                    'fill-extrusion-opacity': 0.7,
                },
            });
        } catch { /* source may not have buildings layer */ }
    };

    const toggle3D = useCallback(() => {
        const map = mapRef.current;
        if (!map || !styleReadyRef.current) return;

        if (show3D) {
            try { map.removeLayer(BUILDINGS_LAYER); } catch { /* ignore */ }
            map.easeTo({ pitch: 0, duration: 500 });
            setShow3D(false);
        } else {
            add3DBuildings(map);
            map.easeTo({ pitch: 45, duration: 500 });
            setShow3D(true);
        }
    }, [show3D]);

    // ── Flight markers ──────────────────────────────────────────────────────────
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (!showFlights) {
            flightMarkersRef.current.forEach((m) => m.remove());
            flightMarkersRef.current.clear();
            return;
        }

        const currentIds = new Set(filteredFlights.map((f) => f.flight_id));
        flightMarkersRef.current.forEach((marker, id) => {
            if (!currentIds.has(id)) { marker.remove(); flightMarkersRef.current.delete(id); }
        });

        for (const flight of filteredFlights) {
            if (flight.latitude === null || flight.longitude === null) continue;
            const color = getCategoryColor(flight.category);
            const heading = flight.heading ?? 0;
            const size = flight.on_ground ? 11 : 15;
            const isSelected = selectedFlight?.flight_id === flight.flight_id;

            const existing = flightMarkersRef.current.get(flight.flight_id);
            if (existing) {
                existing.setLngLat([flight.longitude, flight.latitude]);
                const svg = existing.getElement().querySelector('svg');
                if (svg) svg.style.transform = `rotate(${heading}deg)`;
                existing.getElement().style.filter = isSelected ? `drop-shadow(0 0 6px ${color})` : '';
            } else {
                const el = makeAircraftEl(color, heading, size);
                if (isSelected) el.style.filter = `drop-shadow(0 0 6px ${color})`;
                el.addEventListener('mouseenter', (e) => {
                    setHoveredFlight(flight);
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setPopupPos({ x: r.right + 4, y: r.top });
                });
                el.addEventListener('mouseleave', () => { setHoveredFlight(null); setPopupPos(null); });
                el.addEventListener('click', (e) => { e.stopPropagation(); selectFlight(flight); });
                const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                    .setLngLat([flight.longitude, flight.latitude])
                    .addTo(map);
                flightMarkersRef.current.set(flight.flight_id, marker);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredFlights, showFlights, selectedFlight, selectFlight]);

    // ── Camera markers ──────────────────────────────────────────────────────────
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (!showCameras) {
            cameraMarkersRef.current.forEach((m) => m.remove());
            cameraMarkersRef.current.clear();
            return;
        }

        const currentIds = new Set(cameras.map((c) => c.id));
        cameraMarkersRef.current.forEach((m, id) => {
            if (!currentIds.has(id)) { m.remove(); cameraMarkersRef.current.delete(id); }
        });

        for (const camera of cameras) {
            if (cameraMarkersRef.current.has(camera.id)) continue;
            const el = makeCameraEl();
            el.title = camera.name;
            el.addEventListener('click', (e) => { e.stopPropagation(); selectCamera(camera); });
            const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([camera.longitude, camera.latitude])
                .addTo(map);
            cameraMarkersRef.current.set(camera.id, marker);
        }
    }, [cameras, showCameras, selectCamera]);

    // ── Flight trail ────────────────────────────────────────────────────────────
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const clearTrail = () => {
            try {
                const src = map.getSource(TRAIL_SOURCE) as maplibregl.GeoJSONSource | undefined;
                src?.setData({ type: 'FeatureCollection', features: [] });
            } catch { /* ignore */ }
        };

        if (!selectedFlight) { clearTrail(); return; }

        if (selectedFlight.latitude && selectedFlight.longitude) {
            map.flyTo({ center: [selectedFlight.longitude, selectedFlight.latitude], zoom: Math.max(map.getZoom(), 6), duration: 1500 });
        }

        axios.get(`${API_URL}/flights/${selectedFlight.flight_id}/history`, { params: { minutes: 60 } })
            .then((res) => {
                const points: [number, number][] = (res.data.data || [])
                    .filter((p: { lon: number; lat: number }) => p.lon && p.lat)
                    .map((p: { lon: number; lat: number }) => [p.lon, p.lat]);
                if (selectedFlight.longitude && selectedFlight.latitude) {
                    points.push([selectedFlight.longitude, selectedFlight.latitude]);
                }
                if (points.length < 2) { clearTrail(); return; }
                const src = map.getSource(TRAIL_SOURCE) as maplibregl.GeoJSONSource | undefined;
                src?.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points } }] });
            })
            .catch(clearTrail);
    }, [selectedFlight]);

    return (
        <div className="relative w-full h-full">
            <div ref={mapContainer} className="w-full h-full" />

            {/* Globe/2D badge */}
            <div className="absolute top-3 left-3 z-10 font-mono text-[10px] px-2 py-1 rounded border pointer-events-none"
                style={{ background: 'rgba(5,10,15,0.85)', borderColor: isGlobe ? '#00d4ff' : '#0d2137', color: isGlobe ? '#00d4ff' : '#4a7a99' }}>
                {isGlobe ? '🌍 3D GLOBE' : '🗺 2D MAP'}
            </div>

            {/* Intel ticker — live OSINT deductions from flight data */}
            <IntelTicker />

            {/* 3D buildings toggle (only useful when zoomed in) */}
            {!isGlobe && coords.zoom > 12 && (
                <button
                    onClick={toggle3D}
                    className="absolute top-3 left-24 z-10 font-mono text-[10px] px-2 py-1 rounded border transition-colors"
                    style={{
                        background: 'rgba(5,10,15,0.85)',
                        borderColor: show3D ? '#ffaa00' : '#0d2137',
                        color: show3D ? '#ffaa00' : '#4a7a99',
                    }}
                >
                    🏢 3D BLDG
                </button>
            )}

            {/* Unified map controls — style + weather, same design */}
            <MapControls currentStyleId={currentStyleId} onStyleChange={handleStyleChange} />

            {hoveredFlight && popupPos && <FlightPopup flight={hoveredFlight} position={popupPos} />}

            <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-hud-cyan opacity-40 pointer-events-none" />
            <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-hud-cyan opacity-40 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-hud-cyan opacity-40 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-hud-cyan opacity-40 pointer-events-none" />

            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-[10px] text-hud-text-dim bg-hud-bg/80 px-3 py-1 rounded border border-hud-border pointer-events-none">
                {Math.abs(coords.lat).toFixed(4)}°{coords.lat >= 0 ? 'N' : 'S'} {Math.abs(coords.lng).toFixed(4)}°{coords.lng >= 0 ? 'E' : 'W'} | Z{coords.zoom.toFixed(1)}
            </div>
        </div>
    );
}
