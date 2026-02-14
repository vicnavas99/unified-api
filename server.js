/**
 * Unified API - server.js (PRODUCTION-SAFE)
 * - Fixes CORS preflight OPTIONS (no more 500)
 * - Optional allowlist via CORS_ORIGINS
 * - Basic security: helmet + rate limit + compression
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

app.set("trust proxy", 1);

// -------------------- SECURITY / MIDDLEWARE --------------------
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(compression());
app.use(express.json({ limit: "1mb" }));

// -------------------- CORS (FIXED) --------------------
// IMPORTANT: DO NOT throw inside CORS origin callback.
// Throwing causes OPTIONS preflight to become 500.

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// If allowlist not set, default to allowing same-site usage safely
// Since you proxy from nginx and frontend is same domain, this is fine.
function isAllowedOrigin(origin) {
  if (!origin) return true; // curl / server-to-server
  if (allowedOrigins.length === 0) return true; // allow all if no allowlist configured
  return allowedOrigins.includes(origin);
}

const corsOptions = {
  origin: (origin, cb) => {
    // ✅ Never error: just allow/deny by returning true/false
    cb(null, isAllowedOrigin(origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));

// ✅ Ensure preflight ALWAYS returns 204 and never 500
app.options("*", cors(corsOptions));
app.use("/api", (req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// -------------------- RATE LIMIT (API ONLY) --------------------
if (IS_PROD) {
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use("/api", apiLimiter);
}

// -------------------- DATABASE --------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: IS_PROD ? { rejectUnauthorized: false } : false
});

(async () => {
  try {
    const result = await pool.query("SELECT current_database()");
    console.log("✅ DB connected:", result.rows[0].current_database);
  } catch (err) {
    console.error("❌ DB connection failed:", err.message);
  }
})();

app.locals.db = pool;

// -------------------- STATIC FRONTEND (OPTIONAL) --------------------
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

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

// Global error handler
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  console.error("❌ Error:", IS_PROD ? err.message : err);
  res.status(status).json({
    error: status === 500 ? "Internal server error" : err.message
  });
});

// -------------------- START SERVER --------------------
const server = app.listen(PORT, () => {
  console.log(`🚀 Unified API running on port ${PORT} (${NODE_ENV})`);
});

// Graceful shutdown
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
