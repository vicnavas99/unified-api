const express = require("express");
const pool = require("../db");

const router = express.Router();

const requiredFields = [
  "plant_name",
  "sensor_id",
  "battery_level",
  "humidity_number",
  "humidity_percentage"
];

function validatePlantData(body) {
  const missingFields = requiredFields.filter(
    field => body[field] === undefined || body[field] === null || body[field] === ""
  );

  if (missingFields.length) {
    return `${missingFields.join(", ")} ${missingFields.length === 1 ? "is" : "are"} required`;
  }

  const numericFields = [
    "battery_level",
    "humidity_number",
    "humidity_percentage"
  ];

  for (const field of numericFields) {
    if (!Number.isFinite(Number(body[field]))) {
      return `${field} must be a number`;
    }
  }

  const humidityPercentage = Number(body.humidity_percentage);
  if (humidityPercentage < 0 || humidityPercentage > 100) {
    return "humidity_percentage must be between 0 and 100";
  }

  const batteryLevel = Number(body.battery_level);
  if (batteryLevel < 0) {
    return "battery_level must be greater than or equal to 0";
  }

  return null;
}

router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, plant_name, sensor_id, battery_level,
              humidity_number, humidity_percentage, created_at, updated_at
      FROM plants.plant_data
       ORDER BY plant_name, sensor_id`
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:sensor_id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, plant_name, sensor_id, battery_level,
              humidity_number, humidity_percentage, created_at, updated_at
      FROM plants.plant_data
       WHERE sensor_id = $1`,
      [req.params.sensor_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Plant sensor not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:sensor_id", async (req, res) => {
  const payload = {
    plant_name: req.body.plant_name,
    sensor_id: req.params.sensor_id,
    battery_level: req.body.battery_level,
    humidity_number: req.body.humidity_number,
    humidity_percentage: req.body.humidity_percentage
  };

  const validationError = validatePlantData(payload);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const result = await pool.query(
      `INSERT INTO plants.plant_data
       (plant_name, sensor_id, battery_level, humidity_number, humidity_percentage)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (sensor_id) DO UPDATE SET
         plant_name = EXCLUDED.plant_name,
         battery_level = EXCLUDED.battery_level,
         humidity_number = EXCLUDED.humidity_number,
         humidity_percentage = EXCLUDED.humidity_percentage,
         updated_at = NOW()
       RETURNING id, plant_name, sensor_id, battery_level,
                 humidity_number, humidity_percentage, created_at, updated_at`,
      [
        payload.plant_name,
        payload.sensor_id,
        Number(payload.battery_level),
        Number(payload.humidity_number),
        Number(payload.humidity_percentage)
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
