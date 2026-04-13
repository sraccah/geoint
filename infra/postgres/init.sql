-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Flights table with geospatial support
CREATE TABLE IF NOT EXISTS flights (
  id SERIAL PRIMARY KEY,
  flight_id VARCHAR(32) NOT NULL UNIQUE,
  callsign VARCHAR(16),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  velocity DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  vertical_rate DOUBLE PRECISION,
  origin_country VARCHAR(64),
  origin_airport VARCHAR(8),
  destination_airport VARCHAR(8),
  aircraft_type VARCHAR(32),
  category VARCHAR(32) DEFAULT 'unknown',
  on_ground BOOLEAN DEFAULT FALSE,
  last_contact BIGINT,
  position GEOMETRY(Point, 4326),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for geospatial queries
CREATE INDEX IF NOT EXISTS idx_flights_position ON flights USING GIST(position);
CREATE INDEX IF NOT EXISTS idx_flights_flight_id ON flights(flight_id);
CREATE INDEX IF NOT EXISTS idx_flights_recorded_at ON flights(recorded_at);
CREATE INDEX IF NOT EXISTS idx_flights_category ON flights(category);

-- Cameras table
CREATE TABLE IF NOT EXISTS cameras (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(64) UNIQUE,
  name VARCHAR(256),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  stream_url TEXT,
  image_url TEXT,
  type VARCHAR(32) DEFAULT 'webcam',
  country VARCHAR(64),
  city VARCHAR(64),
  active BOOLEAN DEFAULT TRUE,
  position GEOMETRY(Point, 4326),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cameras_position ON cameras USING GIST(position);
CREATE INDEX IF NOT EXISTS idx_cameras_type ON cameras(type);

-- Flight history for playback (last 2 hours rolling)
CREATE TABLE IF NOT EXISTS flight_history (
  id SERIAL PRIMARY KEY,
  flight_id VARCHAR(32) NOT NULL,
  callsign VARCHAR(16),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  velocity DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  category VARCHAR(32),
  position GEOMETRY(Point, 4326),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flight_history_flight_id ON flight_history(flight_id);
CREATE INDEX IF NOT EXISTS idx_flight_history_recorded_at ON flight_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_flight_history_position ON flight_history USING GIST(position);

-- Satellites table — stores TLE/GP orbital elements
CREATE TABLE IF NOT EXISTS satellites (
  id SERIAL PRIMARY KEY,
  norad_id INTEGER NOT NULL UNIQUE,
  object_name VARCHAR(64) NOT NULL,
  object_id VARCHAR(16),
  group_id VARCHAR(32) NOT NULL,
  epoch TIMESTAMP WITH TIME ZONE,
  mean_motion DOUBLE PRECISION,
  eccentricity DOUBLE PRECISION,
  inclination DOUBLE PRECISION,
  ra_of_asc_node DOUBLE PRECISION,
  arg_of_pericenter DOUBLE PRECISION,
  mean_anomaly DOUBLE PRECISION,
  bstar DOUBLE PRECISION,
  mean_motion_dot DOUBLE PRECISION,
  mean_motion_ddot DOUBLE PRECISION,
  classification_type CHAR(1) DEFAULT 'U',
  rev_at_epoch INTEGER,
  element_set_no INTEGER,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_satellites_norad_id ON satellites(norad_id);
CREATE INDEX IF NOT EXISTS idx_satellites_group_id ON satellites(group_id);
CREATE INDEX IF NOT EXISTS idx_satellites_epoch ON satellites(epoch);

-- AI news history — stores every AI generation with prompt and response
CREATE TABLE IF NOT EXISTS ai_news_history (
  id SERIAL PRIMARY KEY,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  model VARCHAR(64) NOT NULL,
  alerts JSONB NOT NULL DEFAULT '[]',
  alert_count INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_news_generated_at ON ai_news_history(generated_at);
