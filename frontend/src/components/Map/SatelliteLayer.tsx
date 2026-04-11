'use client';

import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { useSatelliteStore } from '@/store/satelliteStore';
import { computePosition, computeOrbitPath } from '@/lib/satelliteUtils';
import { SatelliteGP } from '@/types/satellite';

const ORBIT_SOURCE = 'satellite-orbit';
const ORBIT_LAYER = 'satellite-orbit-line';
const UPDATE_INTERVAL = 5000; // 5s

// Group color map
const GROUP_COLORS: Record<string, string> = {
    stations: '#00d4ff',
    starlink: '#aa44ff',
    gps: '#00ff88',
    glonass: '#44aaff',
    galileo: '#ffaa00',
    weather: '#00d4ff',
    military: '#ff3355',
    amateur: '#ffaa00',
    iridium: '#aa44ff',
    oneweb: '#44aaff',
};

function makeSatEl(color: string, isStation: boolean): HTMLElement {
    const el = document.createElement('div');
    const size = isStation ? 14 : 8;
    el.style.cssText = `width:${size}px;height:${size}px;cursor:pointer;`;
    el.innerHTML = isStation
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
        <polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" fill="${color}" stroke="rgba(0,0,0,0.5)" stroke-width="0.5"/>
      </svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8">
        <circle cx="4" cy="4" r="3" fill="${color}" opacity="0.9"/>
      </svg>`;
    return el;
}

interface Props {
    mapRef: React.MutableRefObject<maplibregl.Map | null>;
    styleReady: React.MutableRefObject<boolean>;
}

export function SatelliteLayer({ mapRef, styleReady }: Props) {
    const markersRef = useRef<Map<number, maplibregl.Marker>>(new Map());
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const { getAllActiveSatellites, selectedSatellite, selectSatellite, activeGroups } = useSatelliteStore();

    // Add orbit source/layer once style is ready
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !styleReady.current) return;

        if (!map.getSource(ORBIT_SOURCE)) {
            map.addSource(ORBIT_SOURCE, {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            });
            map.addLayer({
                id: ORBIT_LAYER,
                type: 'line',
                source: ORBIT_SOURCE,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#00d4ff',
                    'line-width': 1,
                    'line-opacity': 0.5,
                    'line-dasharray': [4, 3],
                },
            });
        }
    }, [mapRef, styleReady]);

    // Draw orbit path for selected satellite
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !styleReady.current) return;

        const src = map.getSource(ORBIT_SOURCE) as maplibregl.GeoJSONSource | undefined;
        if (!src) return;

        if (!selectedSatellite) {
            src.setData({ type: 'FeatureCollection', features: [] });
            return;
        }

        const points = computeOrbitPath(selectedSatellite, 95, 30); // ~1 orbit
        if (points.length < 2) return;

        // Split at antimeridian crossings to avoid line wrapping
        const segments: [number, number][][] = [];
        let current: [number, number][] = [points[0]];
        for (let i = 1; i < points.length; i++) {
            if (Math.abs(points[i][0] - points[i - 1][0]) > 180) {
                segments.push(current);
                current = [points[i]];
            } else {
                current.push(points[i]);
            }
        }
        segments.push(current);

        src.setData({
            type: 'FeatureCollection',
            features: segments.map((seg) => ({
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: seg },
            })),
        });

        // Fly to satellite
        const pos = computePosition(selectedSatellite);
        if (pos) {
            map.flyTo({ center: [pos.longitude, pos.latitude], zoom: Math.max(map.getZoom(), 3), duration: 1200 });
        }
    }, [selectedSatellite, mapRef, styleReady]);

    // Update satellite positions
    const updatePositions = useCallback(() => {
        const map = mapRef.current;
        if (!map) return;

        const allSats = getAllActiveSatellites();
        const now = new Date();
        const currentIds = new Set<number>();

        // Determine group for each satellite (for color)
        const groupMap = new Map<number, string>();
        const { satellites, activeGroups: ag } = useSatelliteStore.getState();
        for (const groupId of ag) {
            const sats = satellites.get(groupId) || [];
            for (const s of sats) groupMap.set(s.NORAD_CAT_ID, groupId);
        }

        for (const sat of allSats) {
            const pos = computePosition(sat, now);
            if (!pos) continue;

            currentIds.add(sat.NORAD_CAT_ID);
            const groupId = groupMap.get(sat.NORAD_CAT_ID) || 'stations';
            const color = GROUP_COLORS[groupId] || '#00d4ff';
            const isStation = groupId === 'stations';
            const isSelected = selectedSatellite?.NORAD_CAT_ID === sat.NORAD_CAT_ID;

            const existing = markersRef.current.get(sat.NORAD_CAT_ID);
            if (existing) {
                existing.setLngLat([pos.longitude, pos.latitude]);
                existing.getElement().style.filter = isSelected ? `drop-shadow(0 0 5px ${color})` : '';
            } else {
                const el = makeSatEl(color, isStation);
                el.title = sat.OBJECT_NAME;
                el.style.filter = isSelected ? `drop-shadow(0 0 5px ${color})` : '';
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectSatellite(sat);
                });
                const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                    .setLngLat([pos.longitude, pos.latitude])
                    .addTo(map);
                markersRef.current.set(sat.NORAD_CAT_ID, marker);
            }
        }

        // Remove stale markers
        markersRef.current.forEach((marker, id) => {
            if (!currentIds.has(id)) {
                marker.remove();
                markersRef.current.delete(id);
            }
        });
    }, [getAllActiveSatellites, selectedSatellite, selectSatellite]);

    // Start/stop update loop based on active groups
    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);

        if (activeGroups.size === 0) {
            markersRef.current.forEach((m) => m.remove());
            markersRef.current.clear();
            return;
        }

        updatePositions();
        intervalRef.current = setInterval(updatePositions, UPDATE_INTERVAL);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [activeGroups, updatePositions]);

    return null; // renders via MapLibre markers
}
