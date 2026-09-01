CREATE SCHEMA IF NOT EXISTS plants;

CREATE TABLE IF NOT EXISTS plants.plant_data (
    id BIGSERIAL PRIMARY KEY,
    plant_name VARCHAR(150) NOT NULL,
    sensor_id VARCHAR(100) NOT NULL UNIQUE,
    battery_level NUMERIC(5, 2) NOT NULL CHECK (battery_level >= 0),
    humidity_number NUMERIC(10, 2) NOT NULL,
    humidity_percentage NUMERIC(5, 2) NOT NULL
        CHECK (humidity_percentage >= 0 AND humidity_percentage <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS plant_data_plant_name_idx
    ON plants.plant_data (plant_name);
