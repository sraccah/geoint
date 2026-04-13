export interface Flight {
    flight_id: string;
    callsign: string | null;
    latitude: number | null;
    longitude: number | null;
    altitude: number | null; // meters
    velocity: number | null; // m/s
    heading: number | null; // degrees
    vertical_rate: number | null; // m/s
    origin_country: string | null;
    origin_airport: string | null;
    destination_airport: string | null;
    aircraft_type: string | null;
    category: FlightCategory;
    on_ground: boolean;
    last_contact: number; // unix timestamp
    squawk: string | null;
}

export type FlightCategory =
    | 'commercial'
    | 'cargo'
    | 'military'
    | 'private'
    | 'helicopter'
    | 'glider'
    | 'unknown';

export interface Camera {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    stream_url: string | null;
    image_url: string | null;
    type: CameraType;
    country: string | null;
    city: string | null;
    active: boolean;
}

export type CameraType = 'traffic' | 'street' | 'webcam' | 'airport' | 'other';

export interface FlightFilter {
    categories?: FlightCategory[];
    min_altitude?: number;
    max_altitude?: number;
    min_speed?: number;
    max_speed?: number;
    bounds?: BoundingBox;
    on_ground?: boolean;
}

export interface BoundingBox {
    min_lat: number;
    max_lat: number;
    min_lon: number;
    max_lon: number;
}

export interface OpenSkyState {
    icao24: string;
    callsign: string | null;
    origin_country: string;
    time_position: number | null;
    last_contact: number;
    longitude: number | null;
    latitude: number | null;
    baro_altitude: number | null;
    on_ground: boolean;
    velocity: number | null;
    true_track: number | null;
    vertical_rate: number | null;
    sensors: number[] | null;
    geo_altitude: number | null;
    squawk: string | null;
    spi: boolean;
    position_source: number;
    category: number;
}

export interface WebSocketMessage {
    type: 'flights_update' | 'flight_delta' | 'camera_update' | 'stats' | 'error' | 'ai_alerts';
    payload: unknown;
    timestamp: number;
}

export interface FlightStats {
    total: number;
    commercial: number;
    cargo: number;
    military: number;
    private: number;
    helicopter: number;
    unknown: number;
    on_ground: number;
    airborne: number;
}

// ── Satellite types ───────────────────────────────────────────────────────────

export interface SatelliteGP {
    OBJECT_NAME: string;
    OBJECT_ID: string;
    NORAD_CAT_ID: number;
    EPOCH: string;
    MEAN_MOTION: number;        // revs/day
    ECCENTRICITY: number;
    INCLINATION: number;        // degrees
    RA_OF_ASC_NODE: number;     // degrees
    ARG_OF_PERICENTER: number;  // degrees
    MEAN_ANOMALY: number;       // degrees
    BSTAR: number;
    MEAN_MOTION_DOT: number;
    MEAN_MOTION_DDOT: number;
    CLASSIFICATION_TYPE: string;
    REV_AT_EPOCH: number;
    ELEMENT_SET_NO?: number;
}

export interface SatelliteGroup {
    id: string;
    label: string;
    color: string;
    icon: string;
    description: string;
    celestrakGroup: string;
    maxCount?: number;
}

export type OrbitType = 'LEO' | 'MEO' | 'GEO' | 'HEO' | 'SSO' | 'Polar' | 'Unknown';
