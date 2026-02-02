/**
 * Unified API - server.js
 * Works in local + production automatically
 * - Adds basic security (helmet, rate limit)
 * - CORS hardened (configurable)
 * - Serves /public as static (optional, but safe)
 */

require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const { Pool } = require("pg");

// Route files
const logsRoutes = require("./routes/logs.routes");
const authRoutes = require("./routes/auth.routes");
const todoRoutes = require("./routes/todo.routes");
const rsvpRoutes = require("./routes/rsvp.routes");

// -------------------- APP SETUP --------------------
const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";

// If behind nginx / reverse proxy (common in production)
app.set("trust proxy", 1);

// -------------------- SECURITY / MIDDLEWARE --------------------

// Basic hardening headers
app.use(
  helmet({
    // If you end up embedding stuff later, you can loosen this.
    contentSecurityPolicy: false
  })
);

// gzip/deflate for responses
app.use(compression());

// JSON body parsing (limit prevents huge payload abuse)
app.use(express.json({ limit: "1mb" }));

// CORS: allow-list for production, open for dev
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// Example .env:
// CORS_ORIGINS=https://wedding-jilaryvictor.com,https://www.wedding-jilaryvictor.com
app.use(
  cors({
    origin: (origin, cb) => {
      // allow same-origin / curl / server-to-server
      if (!origin) return cb(null, true);

      // dev: allow everything
      if (!IS_PROD) return cb(null, true);

      // prod: require allow list (if set). If none set, allow nothing external.
      if (allowedOrigins.length === 0) return cb(new Error("CORS blocked: no allowlist configured"));

      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked: origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
// -------------------- RATE LIMIT (API ONLY) --------------------
// ✅ Enable only in production so local dev never gets blocked
if (IS_PROD) {
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,                 // per IP
    standardHeaders: true,
    legacyHeaders: false
  });

  app.use("/api", apiLimiter);
}

// -------------------- DATABASE --------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Only require SSL in prod; local usually doesn't use SSL
  ssl: IS_PROD ? { rejectUnauthorized: false } : false
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

// -------------------- STATIC FRONTEND (OPTIONAL) --------------------
// If you put your wedding site in ./public, Express will serve it.
// This does NOT break API-only setups.
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// If you want index.html served automatically when hitting "/"
// (only if you are hosting the frontend through this backend)
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

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
app.use("/api/rsvp", rsvpRoutes);

// 404 handler for API
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler (prevents Express from sending stack traces in prod)
app.use((err, _req, res, _next) => {
  const status = err.status || 500;

  if (!IS_PROD) {
    console.error("❌ Error:", err);
  } else {
    console.error("❌ Error:", err.message);
  }

  res.status(status).json({
    error: status === 500 ? "Internal server error" : err.message
  });
});

// -------------------- START SERVER --------------------
const server = app.listen(PORT, () => {
  console.log(`🚀 Unified API running on port ${PORT} (${NODE_ENV})`);
});

// Graceful shutdown (PM2 / docker / server restarts)
async function shutdown(signal) {
  console.log(`\n🛑 ${signal} received. Shutting down...`);
  server.close(async () => {
    try {
      await pool.end();
      console.log("✅ DB pool closed");
    } catch (e) {
      console.error("❌ Error closing DB pool:", e.message);
    }
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
