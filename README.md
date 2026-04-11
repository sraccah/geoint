# 🌍 GeoINT — Open Source Global Intelligence Platform

> Real-time geospatial intelligence. Flight tracking. Satellite orbits. Global CCTV mesh. Live threat analysis. Predictive news from open data.

[![License: MIT](https://img.shields.io/badge/License-MIT-00d4ff.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Compose-0d2137.svg)](docker-compose.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-00d4ff.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![MapLibre](https://img.shields.io/badge/MapLibre-5.x-aa44ff.svg)](https://maplibre.org/)

---

```
  ██████╗ ███████╗ ██████╗ ██╗███╗   ██╗████████╗
 ██╔════╝ ██╔════╝██╔═══██╗██║████╗  ██║╚══██╔══╝
 ██║  ███╗█████╗  ██║   ██║██║██╔██╗ ██║   ██║
 ██║   ██║██╔══╝  ██║   ██║██║██║╚██╗██║   ██║
 ╚██████╔╝███████╗╚██████╔╝██║██║ ╚████║   ██║
  ╚═════╝ ╚══════╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝   ╚═╝
  GLOBAL INTELLIGENCE PLATFORM — OPEN SOURCE
```

---

## What is GeoINT?

GeoINT is a **free, open-source OSINT (Open Source Intelligence) platform** that aggregates publicly available data from multiple sources to provide a real-time global situational awareness dashboard — similar in concept to professional intelligence tools, but built entirely on open data and open standards.

It is designed for:
- **Researchers** studying global air traffic patterns, military posture, and geopolitical events
- **Journalists** tracking movements of interest
- **Security analysts** monitoring anomalies in global airspace
- **Developers** building on top of open geospatial data
- **Curious citizens** who want to understand what's happening in the skies above them

> ⚠️ **All data is sourced from publicly available APIs. This tool is for informational and research purposes only. Not for navigation or safety-critical use.**

---

## One-Command Launch

```bash
git clone https://github.com/your-org/geoint
cd geoint
cp .env.example .env
docker compose up --build
```

Open **http://localhost:8066** — the full platform is running.

---

## Features

### 🌍 3D Globe + 2D Map
- **MapLibre GL v5** with native globe projection
- Automatic transition: 3D globe at zoom < 5, flat 2D map when zoomed in
- 9 map styles: Dark HUD, Streets, Satellite, Topo, Humanitarian, Night Vision, Thermal, NVG, CRT
- 3D building extrusion when zoomed in (zoom > 12)
- Atmosphere, fog, and star field on globe view

### ✈️ Real-Time Flight Tracking
- **3 simultaneous data sources** aggregated and deduplicated:
  - **OpenSky Network** — authenticated via OAuth2, 11,000+ flights, origin country data
  - **airplanes.live** — community ADS-B aggregator, military `dbFlags` detection
  - **ADSB.fi** — free, no auth, fast refresh
- **14,000+ aircraft** tracked simultaneously at peak
- Updates every **5 seconds**
- Flight classification engine: commercial, cargo, military, private, helicopter, glider
- Military detection via ICAO hex prefix blocks, callsign regex patterns, aircraft type codes
- Click any aircraft → full telemetry panel (callsign, altitude, speed, heading, vertical rate, squawk, origin)
- **Flight trail** — click a flight to draw its last 60 minutes of positions on the map (stored in PostGIS)

### 🛰️ Real-Time Satellite Tracking
- **15,000+ active satellites** from CelesTrak/NORAD (public data, no auth)
- 10 toggleable groups: Space Stations, Starlink (500), GPS, GLONASS, Galileo, Weather, Military, Amateur, Iridium NEXT, OneWeb
- Positions computed **client-side** every 5 seconds using **SGP4 orbital mechanics** (`satellite.js`)
- Click any satellite → orbital details panel: orbit type (LEO/MEO/GEO/SSO), period, inclination, eccentricity, live altitude/velocity
- **Orbital path** drawn on map (next ~95 minutes = 1 full orbit), antimeridian-safe
- TLE data cached 6 hours in Redis, persisted to PostgreSQL

### 📷 Global CCTV Mesh
- **940+ cameras** from multiple OSINT sources:
  - **TfL JamCam** — 883 London live traffic cameras (public API)
  - **Windy Webcams** — 49+ landmark webcams with working embed players
  - **NYC DOT** — New York City traffic cameras (open data)
  - **Chicago DOT** — Chicago traffic cameras (open data)
  - **EarthCam** — curated landmark streams
  - **Insecam** — publicly accessible IP cameras (open internet)
- Click any camera marker → live feed viewer with Windy embed player
- Camera list with city-based navigation

### 🧠 Live Intelligence Ticker
- **Real-time OSINT deductions** from flight data, displayed as a scrolling news ticker
- Detections running on every data update:
  - Military formations (8+ aircraft within 200km) → WARNING/CRITICAL
  - Major military operations (20+ aircraft) → CRITICAL
  - Emergency squawk 7700 (MAYDAY)
  - Hijack squawk 7500
  - Radio failure squawk 7600
  - High-speed military intercepts (>Mach 0.9 above FL360)
  - Rapid descent anomalies (>6,000 fpm commercial aircraft)
  - Elevated military posture (>12% of global traffic)
- Click any alert → flies to the location and selects the aircraft
- Auto-rotates every 6 seconds, pauses on hover

### 🔍 Global Search
- Search across **all data types simultaneously**: flights, cameras, satellites
- Flight search: callsign, ICAO hex, origin country, airports, aircraft type, squawk
- Camera search: city, country, type
- Satellite search: name, NORAD ID, object ID
- 300ms debounce, keyboard shortcut `⌘K`

### 🎛️ Filters
- Default view: **military flights only** (performance-optimized)
- Toggle any flight category: commercial, cargo, military, private, helicopter, glider
- Altitude range slider (0–15,000m)
- Speed range slider (0–1,000 m/s)
- Show/hide ground traffic
- "ALL" button to show everything instantly

### ☁️ Weather Overlay
- Windy.com forecast integration (ECMWF model)
- 6 weather layers: Wind, Rain, Clouds, Temperature, Pressure, Waves
- Embedded Windy player in the map controls panel

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NGINX (port 8066)                             │
│         Reverse proxy — routes /api/* and /ws to backend        │
└──────────────┬──────────────────────────┬───────────────────────┘
               │                          │
    ┌──────────▼──────────┐    ┌──────────▼──────────┐
    │   Next.js Frontend  │    │   Fastify Backend    │
    │   MapLibre GL v5    │    │   TypeScript         │
    │   Zustand stores    │    │   WebSocket stream   │
    │   satellite.js SGP4 │    │   REST API           │
    │   port 3666         │    │   port 3661          │
    └─────────────────────┘    └──────────┬──────────┘
                                          │
                               ┌──────────┴──────────┐
                               │                     │
                    ┌──────────▼──────┐   ┌──────────▼──────┐
                    │  PostgreSQL 15  │   │   Redis 7        │
                    │  + PostGIS 3.3  │   │   Cache layer    │
                    │  port 5466      │   │   port 6366      │
                    └─────────────────┘   └─────────────────┘
```

### Data Flow

```
External APIs (every 5s)          CelesTrak (every 6h)
  OpenSky Network ──┐               GPS, Starlink, ──┐
  airplanes.live  ──┼─► FlightPoller  Military...    │
  ADSB.fi         ──┘     │                          ▼
                           │                   SatelliteService
                           ▼                         │
                    Merge + Deduplicate        Redis Cache (6h)
                    Classify flights           PostgreSQL persist
                           │
                    Redis Cache (15s)
                    PostgreSQL persist
                           │
                    WebSocket broadcast ──► All connected clients
                    (delta updates, 5s)       (real-time)
```

---

## Data Sources

| Source | Data | Update Rate | Auth |
|--------|------|-------------|------|
| [OpenSky Network](https://opensky-network.org) | ADS-B flights, origin country | 5s | OAuth2 (free) |
| [airplanes.live](https://airplanes.live) | ADS-B flights, military flags | 5s | None |
| [ADSB.fi](https://api.adsb.fi) | ADS-B flights | 5s | None |
| [CelesTrak](https://celestrak.org) | Satellite TLE/GP elements | 6h | None |
| [TfL JamCam](https://api.tfl.gov.uk) | London traffic cameras | On demand | None |
| [NYC Open Data](https://data.cityofnewyork.us) | NYC traffic cameras | On demand | None |
| [Chicago Open Data](https://data.cityofchicago.org) | Chicago cameras | On demand | None |
| [Windy Webcams](https://api.windy.com) | Global webcams | On demand | Free key |
| [OpenStreetMap](https://openstreetmap.org) | Map tiles | On demand | None |

---

## Codebase

```
geoint/
├── backend/src/                    # 2,099 lines TypeScript
│   ├── services/
│   │   ├── opensky.ts              # 157 lines — OpenSky OAuth2 + ADS-B parsing
│   │   ├── adsbfi.ts               # 113 lines — ADSB.fi aggregator
│   │   ├── airplaneslive.ts        # 74 lines  — airplanes.live + military flags
│   │   ├── flightPoller.ts         # 218 lines — multi-source aggregator, dedup, merge
│   │   ├── flightClassifier.ts     # 142 lines — military/cargo/commercial detection
│   │   ├── satellites.ts           # 248 lines — CelesTrak GP, Redis+DB caching
│   │   ├── cameras.ts              # 401 lines — TfL, NYC, Chicago, Windy, EarthCam
│   │   ├── database.ts             # 129 lines — PostGIS, batched inserts, history
│   │   └── redis.ts                # 51 lines  — cache layer
│   ├── routes/
│   │   ├── flights.ts              # 131 lines — REST + filtering
│   │   ├── satellites.ts           # 57 lines  — satellite REST API
│   │   ├── cameras.ts              # 62 lines  — camera REST API
│   │   └── search.ts               # 70 lines  — unified search (flights+cameras+sats)
│   ├── websocket/
│   │   └── flightStream.ts         # 139 lines — WebSocket, per-client filters
│   ├── types/index.ts              # 131 lines — Flight, Camera, Satellite types
│   ├── config.ts                   # 29 lines
│   └── index.ts                    # 98 lines  — Fastify bootstrap
│
├── frontend/src/                   # 3,575 lines TypeScript/TSX
│   ├── components/
│   │   ├── Map/
│   │   │   ├── MapView.tsx         # 433 lines — MapLibre globe, markers, trails
│   │   │   ├── SatelliteLayer.tsx  # 192 lines — SGP4 positions, orbit paths
│   │   │   ├── IntelTicker.tsx     # 137 lines — live OSINT news ticker
│   │   │   ├── MapControls.tsx     # 148 lines — style + weather panel
│   │   │   └── FlightPopup.tsx     # 51 lines  — hover tooltip
│   │   ├── Details/
│   │   │   ├── FlightDetailsPanel.tsx  # 165 lines — flight telemetry
│   │   │   ├── SatelliteDetails.tsx    # 104 lines — orbital parameters
│   │   │   └── CameraViewer.tsx        # 169 lines — live feed embed
│   │   ├── HUD/
│   │   │   ├── TopBar.tsx          # 90 lines  — stats + search bar
│   │   │   ├── SearchBar.tsx       # 225 lines — unified search UI
│   │   │   └── StatusBar.tsx       # 51 lines  — connection status
│   │   └── Sidebar/
│   │       ├── DataLayersPanel.tsx # 125 lines — layer toggles + satellite groups
│   │       └── FiltersPanel.tsx    # 129 lines — flight filters + sliders
│   ├── lib/
│   │   ├── intelAnalyzer.ts        # 262 lines — OSINT deduction engine
│   │   ├── satelliteUtils.ts       # 170 lines — SGP4 propagation, orbit paths
│   │   ├── mapStyles.ts            # 148 lines — 9 map style definitions
│   │   └── utils.ts                # 75 lines  — formatters
│   ├── store/
│   │   ├── flightStore.ts          # 68 lines  — Zustand flight state
│   │   ├── satelliteStore.ts       # 62 lines  — Zustand satellite state
│   │   ├── cameraStore.ts          # 12 lines
│   │   └── uiStore.ts              # 42 lines
│   └── hooks/
│       ├── useWebSocket.ts         # 100 lines — WS with auto-reconnect
│       ├── useCameras.ts           # 28 lines
│       └── useSatellites.ts        # 35 lines
│
├── infra/
│   ├── postgres/init.sql           # PostGIS schema, indexes, satellite table
│   └── nginx/nginx.dev.conf        # Reverse proxy config
│
├── docker-compose.yml              # 5 services: frontend, backend, postgres, redis, nginx
└── .env.example                    # All configuration options documented
```

**Total: ~6,073 lines of TypeScript across 49 files**

---

## Intelligence Analysis Engine

The `intelAnalyzer.ts` module runs on every flight data update and produces real-time OSINT deductions:

```typescript
// Example detections from live data:

[CRITICAL] MILITARY OPERATION
  → 23 aircraft over Eastern Europe / Russia
  → RCH123, JAKE45, IRON67 +20 more

[WARNING] HIGH-SPEED INTERCEPT
  → Military aircraft over Arabian Peninsula
  → 547 kts at FL410

[CRITICAL] EMERGENCY SQUAWK 7700
  → MAYDAY — UAL234 declaring emergency over North America
  → Alt: 37,000 ft

[INFO] GLOBAL AIRSPACE
  → 14,295 aircraft tracked globally across all sources
```

Detection thresholds are calibrated to avoid noise:
- Military clusters: **8+ aircraft within 200km** minimum
- Major operations: **20+ aircraft** for CRITICAL
- Military % anomaly: **>12%** of global traffic
- Rapid descent: **>6,000 fpm** at altitude >16,000ft

---

## Satellite Tracking

Positions are computed entirely client-side using the **SGP4/SDP4 orbital mechanics** propagator:

```
CelesTrak GP Data → TLE conversion → satellite.js SGP4 → ECI coordinates
→ GMST rotation → Geodetic (lat/lon/alt) → MapLibre marker
```

Orbit types detected automatically from mean motion and inclination:
- **LEO** (Low Earth Orbit) — < 2,000 km, period ~90 min (ISS, Starlink)
- **MEO** (Medium Earth Orbit) — 2,000–35,000 km (GPS, GLONASS, Galileo)
- **GEO** (Geostationary) — ~35,786 km, period 24h (weather, comms)
- **SSO/Polar** — inclination > 80° (reconnaissance, weather)

---

## Configuration

```env
# OpenSky OAuth2 (free at opensky-network.org — higher rate limits)
OPENSKY_CLIENT_ID=your-client-id
OPENSKY_CLIENT_SECRET=your-secret

# Windy Webcams API (free at api.windy.com — 1,000 live webcams)
WINDY_API_KEY=your-key

# Windy Map Forecast (free at api.windy.com — weather overlays)
WINDY_FORECAST_KEY=your-key

# Thunderforest (free at thunderforest.com — transport map style)
THUNDERFOREST_KEY=your-key

# Custom ports (defaults shown)
# PostgreSQL: 5466, Redis: 6366, Backend: 3661, Frontend: 3666, Nginx: 8066
```

---

## API Reference

### Flights
```
GET /api/flights                    All flights (with filters)
GET /api/flights/stats              Aggregate statistics
GET /api/flights/:id                Single flight details
GET /api/flights/:id/history        Flight path history (last 60 min)
```

### Satellites
```
GET /api/satellites/groups          List all satellite groups
GET /api/satellites/:groupId        Orbital elements for a group
GET /api/satellites/norad/:id       Single satellite by NORAD ID
GET /api/satellites/search?q=ISS    Search satellites
```

### Cameras
```
GET /api/cameras                    All cameras (with filters)
GET /api/cameras/:id                Single camera
POST /api/cameras/refresh           Force cache refresh
```

### Search
```
GET /api/search?q=query             Search flights + cameras + satellites
GET /api/status                     Data source health
```

### WebSocket
```
ws://localhost:3661/ws              Real-time flight stream

Client → Server:
  { "type": "set_filter", "payload": { "categories": ["military"] } }
  { "type": "ping" }

Server → Client:
  { "type": "flights_update", "payload": { "flights": [...], "stats": {...} } }
  { "type": "error", "payload": { "status": "rate_limited", "message": "..." } }
```

---

## Running Locally (Development)

```bash
# Full stack
docker compose up --build

# Backend only (hot reload)
cd backend && npm install && npm run dev

# Frontend only (hot reload)
cd frontend && npm install && npm run dev

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Force camera cache refresh
curl -X POST http://localhost:3661/cameras/refresh

# Check satellite data
curl http://localhost:3661/satellites/stations | python3 -m json.tool | head -30
```

---

## Roadmap

- [ ] **Historical playback** — scrub through past 2 hours of flight data
- [ ] **Heatmap layer** — traffic density visualization
- [ ] **Alert system** — push notifications for critical intel events
- [ ] **ADS-B Exchange** integration (unfiltered military data)
- [ ] **Vessel tracking** — AIS maritime data (MarineTraffic open API)
- [ ] **Earthquake overlay** — USGS real-time seismic data
- [ ] **Predictive routing** — ML-based flight path prediction
- [ ] **Export** — GeoJSON/KML export of any layer
- [ ] **Mobile** — responsive layout for field use
- [ ] **Multi-user** — shared sessions, collaborative annotation
- [ ] **Custom alerts** — user-defined geofences and thresholds

---

## Contributing

This is an open-source OSINT tool. Contributions welcome:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/vessel-tracking`
3. All data sources must be **publicly available** — no scraped private data
4. Add appropriate attribution for any new data source
5. Submit a pull request

---

## Legal & Ethics

- All data is sourced from **publicly available APIs and open datasets**
- Flight positions are from ADS-B transponders — publicly broadcast by aircraft
- Satellite orbital elements are published by NORAD/Space-Track
- Camera feeds are publicly accessible streams
- **This tool does not enable any surveillance beyond what is already publicly visible**
- Data accuracy is not guaranteed — do not use for navigation or safety decisions
- Respect the terms of service of each data provider

---

## License

MIT License — free to use, modify, and distribute. See [LICENSE](LICENSE).

---

*Built with ❤️ using open data, open standards, and open source software.*
*OpenSky Network · CelesTrak · OpenStreetMap · MapLibre · TfL · Windy.com*
