import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FlightCategory } from '@/types';

export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

export function formatAltitude(meters: number | null): string {
    if (meters === null) return 'N/A';
    const feet = Math.round(meters * 3.28084);
    return `${feet.toLocaleString()} ft`;
}

export function formatSpeed(ms: number | null): string {
    if (ms === null) return 'N/A';
    const knots = Math.round(ms * 1.94384);
    return `${knots} kts`;
}

export function formatHeading(degrees: number | null): string {
    if (degrees === null) return 'N/A';
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round(degrees / 22.5) % 16;
    return `${Math.round(degrees)}° ${dirs[idx]}`;
}

export function formatVerticalRate(ms: number | null): string {
    if (ms === null) return 'N/A';
    const fpm = Math.round(ms * 196.85);
    const sign = fpm > 0 ? '+' : '';
    return `${sign}${fpm.toLocaleString()} fpm`;
}

export function getCategoryColor(category: FlightCategory): string {
    const colors: Record<FlightCategory, string> = {
        commercial: '#00d4ff',
        cargo: '#ffaa00',
        military: '#ff3355',
        private: '#00ff88',
        helicopter: '#aa44ff',
        glider: '#44aaff',
        unknown: '#4a7a99',
    };
    return colors[category] || colors.unknown;
}

export function getCategoryLabel(category: FlightCategory): string {
    const labels: Record<FlightCategory, string> = {
        commercial: 'Commercial',
        cargo: 'Cargo',
        military: 'Military',
        private: 'Private',
        helicopter: 'Helicopter',
        glider: 'Glider',
        unknown: 'Unknown',
    };
    return labels[category] || 'Unknown';
}

export function timeAgo(unixTimestamp: number): string {
    const seconds = Math.floor(Date.now() / 1000 - unixTimestamp);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
}

export function formatCoord(val: number | null, type: 'lat' | 'lon'): string {
    if (val === null) return 'N/A';
    const abs = Math.abs(val);
    const deg = Math.floor(abs);
    const min = ((abs - deg) * 60).toFixed(2);
    const dir = type === 'lat' ? (val >= 0 ? 'N' : 'S') : val >= 0 ? 'E' : 'W';
    return `${deg}°${min}'${dir}`;
}
