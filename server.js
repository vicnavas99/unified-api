/**
 * Unified API - server.js
 * Works in local + production automatically
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

// Route files
const logsRoutes = require("./routes/logs.routes");
const authRoutes = require("./routes/auth.routes");
const todoRoutes = require("./routes/todo.routes");

// -------------------- APP SETUP --------------------
const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";

app.use(cors());
app.use(express.json());

// -------------------- DATABASE --------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});


// Test DB connection on startup
(async () => {
  try {
    const result = await pool.query("SELECT current_database()");
    console.log("✅ DB connected:", result.rows[0].current_database);
  } catch (err) {
    console.error("❌ DB connection failed:", err.message);
  }
})();

// Make pool available to routes
app.locals.db = pool;

// -------------------- ROUTES --------------------
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    env: NODE_ENV,
    time: new Date().toISOString()
  });
});

app.use("/api/todo", todoRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/auth", authRoutes);

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  console.log(`🚀 Unified API running on port ${PORT} (${NODE_ENV})`);
});
