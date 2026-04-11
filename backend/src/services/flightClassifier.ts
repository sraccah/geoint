/**
 * Shared flight classification logic used by all data sources
 */
import { FlightCategory } from '../types';

// Military ICAO hex prefixes by country
// Source: https://www.adsbexchange.com/ads-b-data-field-explanations/
const MILITARY_HEX_PREFIXES = [
    'ADF', // US military
    '43C', '43D', '43E', '43F', // UK military
    '3A0', '3A1', // French military
    '6800', '6801', // Chinese military
    'AE', // US military (large block)
];

// Military callsign patterns
const MILITARY_CALLSIGNS = [
    /^RCH\d/i,   // USAF Reach
    /^CNV\d/i,   // US Navy Convoy
    /^JAKE\d/i,
    /^IRON\d/i,
    /^DUKE\d/i,
    /^VIPER\d/i,
    /^HAWK\d/i,
    /^EAGLE\d/i,
    /^FALCON\d/i,
    /^RAPTOR\d/i,
    /^GHOST\d/i,
    /^SHADOW\d/i,
    /^COBRA\d/i,
    /^WOLF\d/i,
    /^BEAR\d/i,
    /^TIGER\d/i,
    /^RANGER\d/i,
    /^USAF\d/i,
    /^NAVY\d/i,
    /^ARMY\d/i,
    /^USMC\d/i,
    /^USCG\d/i,
    /^NATO\d/i,
    /^RRR\d/i,
    /^AAR\d/i,
    /^BAF\d/i,   // Belgian Air Force
    /^GAF\d/i,   // German Air Force
    /^FAF\d/i,   // French Air Force
    /^RAF\d/i,   // Royal Air Force
    /^SAF\d/i,   // Swedish Air Force
    /^FORTE\d/i, // RAF
    /^ASCOT\d/i, // RAF
    /^TARTAN\d/i,
    /^NOTOS\d/i,
    /^ZEUS\d/i,
    /^ATLAS\d/i,
    /^HERKY\d/i, // C-130 Hercules
    /^SPAR\d/i,  // US VIP transport
    /^SAM\d/i,   // Special Air Mission (Air Force One type)
    /^VENUS\d/i,
    /^TOPAZ\d/i,
    /^MAGMA\d/i,
];

// Cargo airline ICAO callsign prefixes
const CARGO_PREFIXES = [
    'FDX', 'UPS', 'ABX', 'GTI', 'CLX', 'MPH', 'ATN',
    'KFS', 'PAC', 'SWG', 'TGO', 'CKS', 'FFL', 'POL',
    'DHL', 'TAY', 'BCS', 'ICL', 'MAS', 'CAL', 'AHK',
    'SQC', 'ETD', 'QAC', 'UAE', 'KAL', 'CPA', 'FIN',
    'NCA', 'ACA', 'LCO', 'WOA', 'NCR', 'OAL',
];

// Aircraft type → category mapping
const TYPE_CATEGORY: Record<string, FlightCategory> = {
    // Helicopters
    'EC35': 'helicopter', 'EC45': 'helicopter', 'EC55': 'helicopter',
    'B06': 'helicopter', 'B07': 'helicopter', 'B212': 'helicopter',
    'R22': 'helicopter', 'R44': 'helicopter', 'R66': 'helicopter',
    'S76': 'helicopter', 'S92': 'helicopter', 'AW139': 'helicopter',
    'H60': 'helicopter', 'H47': 'helicopter', 'UH1': 'helicopter',
    'AS32': 'helicopter', 'AS50': 'helicopter', 'AS65': 'helicopter',
    // Military fixed wing
    'F16': 'military', 'F18': 'military', 'F22': 'military', 'F35': 'military',
    'B52': 'military', 'B1': 'military', 'B2': 'military',
    'C130': 'military', 'C17': 'military', 'C5': 'military',
    'E3': 'military', 'E8': 'military', 'RC135': 'military',
    'U2': 'military', 'SR71': 'military', 'A10': 'military',
    'P8': 'military', 'P3': 'military',
    // Gliders
    'GLID': 'glider', 'ASK21': 'glider', 'DG1000': 'glider',
};

// ADS-B category codes
const ADSB_CATEGORY: Record<string, FlightCategory> = {
    'A1': 'unknown',  // No info
    'A2': 'private',  // Light < 15500 lbs
    'A3': 'private',  // Small 15500-75000 lbs
    'A4': 'commercial', // Large 75000-300000 lbs
    'A5': 'commercial', // High vortex large
    'A6': 'commercial', // Heavy > 300000 lbs
    'A7': 'commercial', // High performance
    'B1': 'glider',
    'B2': 'private',  // Lighter than air
    'B3': 'unknown',  // Parachutist
    'B4': 'glider',   // Ultralight
    'B6': 'helicopter',
    'B7': 'unknown',  // UAV
    'C1': 'unknown',  // Surface emergency
    'C2': 'unknown',  // Surface service
    'C3': 'unknown',  // Ground obstruction
};

export function classifyFlight(
    icao: string,
    callsign: string,
    adsbCategory: string,
    aircraftType: string
): FlightCategory {
    const cs = callsign.trim().toUpperCase();
    const hex = icao.toUpperCase();
    const type = aircraftType.toUpperCase();

    // 1. Check military hex prefix blocks
    if (MILITARY_HEX_PREFIXES.some((p) => hex.startsWith(p))) return 'military';

    // 2. Check military callsign patterns
    if (MILITARY_CALLSIGNS.some((re) => re.test(cs))) return 'military';

    // 3. Check aircraft type
    const typeMatch = Object.keys(TYPE_CATEGORY).find((t) => type.includes(t));
    if (typeMatch) return TYPE_CATEGORY[typeMatch];

    // 4. Check cargo prefixes
    if (CARGO_PREFIXES.some((p) => cs.startsWith(p))) return 'cargo';

    // 5. ADS-B category code
    const catMapped = ADSB_CATEGORY[adsbCategory];
    if (catMapped && catMapped !== 'unknown') return catMapped;

    // 6. Heuristic: IATA airline code pattern (2-3 letters + 1-4 digits)
    if (/^[A-Z]{2,3}\d{1,4}[A-Z]?$/.test(cs)) return 'commercial';

    return 'unknown';
}
