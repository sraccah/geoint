export type FlightCategory =
    | 'commercial'
    | 'cargo'
    | 'military'
    | 'private'
    | 'helicopter'
    | 'glider'
    | 'unknown';

export interface Flight {
    flight_id: string;
    callsign: string | null;
    latitude: number | null;
    longitude: number | null;
    altitude: number | null;
    velocity: number | null;
    heading: number | null;
    vertical_rate: number | null;
    origin_country: string | null;
    origin_airport: string | null;
    destination_airport: string | null;
    aircraft_type: string | null;
    category: FlightCategory;
    on_ground: boolean;
    last_contact: number;
    squawk: string | null;
}

export type CameraType = 'traffic' | 'street' | 'webcam' | 'airport' | 'other';

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

export interface FlightFilter {
    categories: FlightCategory[];
    minAltitude: number;
    maxAltitude: number;
    minSpeed: number;
    maxSpeed: number;
    showOnGround: boolean;
}

export interface MapViewState {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch: number;
    bearing: number;
}

export interface WebSocketMessage {
    type: 'flights_update' | 'flight_delta' | 'camera_update' | 'stats' | 'error';
    payload: unknown;
    timestamp: number;
}
