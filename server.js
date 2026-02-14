/**
 * Unified API - server.js (PRODUCTION SAFE)
 * - Helmet + compression + json limit
 * - Rate limit in prod
 * - CORS fixed so browser OPTIONS preflight works
 * - Routes: /api/*
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

// -------------------- CORS (FIXED FOR BROWSER OPTIONS) --------------------
// In production, we allow only known website origins.
// If CORS_ORIGINS env is not set, we fall back to your wedding domains.
const envAllow = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const defaultAllowProd = [
  "https://wedding-jilaryvictor.com",
  "https://www.wedding-jilaryvictor.com"
];

const allowList = IS_PROD
  ? (envAllow.length ? envAllow : defaultAllowProd)
  : ["*"];

const corsOptions = {
  origin: (origin, cb) => {
    // Requests like curl / server-to-server / same-machine checks
    if (!origin) return cb(null, true);

    // Dev: allow everything
    if (!IS_PROD) return cb(null, true);

    // Prod: allow only allowList
    if (allowList.includes(origin)) return cb(null, true);

    // IMPORTANT: Do NOT throw (throwing causes OPTIONS to become 500)
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
// Ensure preflight always responds cleanly
app.options("*", cors(corsOptions));

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

app.get("/", (_req, res) => {
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
