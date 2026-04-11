# GeoINT Platform

A real-time geospatial intelligence web application — flight tracking, global camera feeds, and situational awareness dashboard.

![GeoINT Platform](https://img.shields.io/badge/status-production--ready-00d4ff)

## Quick Start

```bash
# 1. Clone and configure
cp .env.example .env

# 2. Launch everything
docker compose up --build

# 3. Open browser
open http://localhost:3000
```

That's it. One command.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    NGINX (port 80)                   │
│              Reverse proxy + WebSocket               │
└──────────────┬──────────────────┬───────────────────┘
               │                  │
    ┌──────────▼──────┐  ┌────────▼────────┐
    │  Frontend        │  │  Backend         │
    │  Next.js 14      │  │  Fastify + WS    │
    │  MapLibre GL     │  │  TypeScript      │
    │  Zustand         │  │  port 3001       │
    │  port 3000       │  └────────┬────────┘
    └─────────────────┘           │
                          ┌───────┴────────┐
                          │                │
               ┌──────────▼──┐  ┌──────────▼──┐
               │ PostgreSQL   │  │    Redis     │
               │ + PostGIS    │  │  (cache)     │
               └─────────────┘  └─────────────┘
```

### Data Flow

```
OpenSky Network API
       │
       ▼ (every 10s)
  FlightPoller
       │
       ├──► Redis (cache 15s)
       ├──► PostgreSQL (history 2h)
       └──► WebSocket broadcast
                │
                ▼
         Frontend clients
         (real-time updates)
```

---

## Services

| Service    | Port | Description                        |
|------------|------|------------------------------------|
| Frontend   | 3000 | Next.js dashboard                  |
| Backend    | 3001 | Fastify API + WebSocket            |
| PostgreSQL | 5432 | PostGIS geospatial database        |
| Redis      | 6379 | Real-time data cache               |
| Nginx      | 80   | Reverse proxy                      |

---

## API Reference

### REST Endpoints

```
GET  /health                    Health check
GET  /flights                   All flights (with filters)
GET  /flights/stats             Aggregate statistics
GET  /flights/:id               Single flight details
GET  /flights/:id/history       Flight path history (last 30min)
GET  /cameras                   All camera feeds
GET  /cameras/:id               Single camera details
```

### Query Parameters (GET /flights)

| Param         | Type   | Example                          |
|---------------|--------|----------------------------------|
| categories    | string | `commercial,cargo,military`      |
| min_altitude  | number | `3000`                           |
| max_altitude  | number | `12000`                          |
| min_speed     | number | `100`                            |
| max_speed     | number | `900`                            |
| on_ground     | bool   | `false`                          |
| min_lat       | number | `35.0`                           |
| max_lat       | number | `55.0`                           |
| min_lon       | number | `-10.0`                          |
| max_lon       | number | `30.0`                           |

### WebSocket

Connect to `ws://localhost:3001/ws`

**Server → Client:**
```json
{
  "type": "flights_update",
  "payload": {
    "flights": [...],
    "stats": { "total": 8432, "commercial": 6100, ... }
  },
  "timestamp": 1712345678000
}
```

**Client → Server (optional filter):**
```json
{
  "type": "set_filter",
  "payload": {
    "categories": ["military", "cargo"],
    "bounds": { "min_lat": 30, "max_lat": 60, "min_lon": -20, "max_lon": 40 }
  }
}
```

---

## Configuration

Copy `.env.example` to `.env` and configure:

```env
# Optional: OpenSky credentials for higher rate limits
OPENSKY_USERNAME=your_username
OPENSKY_PASSWORD=your_password

# Optional: MapTiler key for premium map styles
MAPTILER_KEY=your_key

# Poll interval (ms) — minimum 10000 for anonymous access
FLIGHT_POLL_INTERVAL=10000
```

---

## Data Sources

| Source | Data | License |
|--------|------|---------|
| [OpenSky Network](https://opensky-network.org) | Live flight ADS-B | CC BY 4.0 |
| [OpenStreetMap](https://openstreetmap.org) | Map tiles + camera locations | ODbL |
| [Overpass API](https://overpass-api.de) | OSM webcam nodes | ODbL |

**Disclaimer:** All data is for informational purposes only. Not for navigation or safety-critical use. Flight positions may be delayed or inaccurate.

---

## Features

- **Real-time flight tracking** — 8,000+ aircraft globally via OpenSky Network
- **Flight classification** — Commercial, cargo, military, private, helicopter
- **Interactive map** — Dark-themed MapLibre GL with OSM tiles
- **Filters panel** — Filter by type, altitude, speed, ground status
- **Flight details** — Click any aircraft for full telemetry
- **Camera feeds** — Global webcam markers with viewer
- **WebSocket streaming** — Live delta updates, no polling
- **Flight history** — 2-hour rolling path storage in PostGIS
- **Fallback mode** — Mock data when API is rate-limited

---

## Development

```bash
# Backend only
cd backend && npm install && npm run dev

# Frontend only  
cd frontend && npm install && npm run dev

# Full stack with Docker
docker compose up --build

# View logs
docker compose logs -f backend
docker compose logs -f frontend
```

---

## Future Improvements

- [ ] CesiumJS 3D globe mode
- [ ] ADS-B Exchange integration
- [ ] Historical playback slider
- [ ] Traffic heatmap layer
- [ ] Satellite imagery overlay
- [ ] Alert system (military/unusual activity)
- [ ] User preferences persistence
- [ ] Mobile responsive layout
- [ ] Flight path prediction
- [ ] Airport database integration
