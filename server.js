require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const siteKeys = require('./utils/keys');

const app = express();
app.use(express.json());
app.use(cors());

// DB Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
pool.query("SELECT current_database()", (err, result) => {
    console.log("API connected to DB:", result?.rows?.[0]);
});

// Validate API Key middleware
function validateApiKey(req, res, next) {
    const site = req.params.site;
    const key = req.headers['x-api-key'];

    if (!siteKeys[site]) {
        return res.status(400).json({ error: "Unknown site" });
    }
    if (siteKeys[site] !== key) {
        return res.status(403).json({ error: "Invalid API Key" });
    }

    next();
}

//// -------- ROUTES -------- ////

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: "ok", time: new Date() });
});

// GET logs for a site
app.get('/api/logs/:site', validateApiKey, async (req, res) => {
    const site = req.params.site;

    try {
        const result = await pool.query(
            "SELECT * FROM appdata.logs WHERE site_id=$1 ORDER BY created_at DESC",
            [site]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a log entry for a site
const fetch = require("node-fetch");

// Helper: detect browser + OS from user-agent
function parseUserAgent(ua) {
    ua = ua || "";

    let browser = "Unknown";
    if (/chrome/i.test(ua)) browser = "Chrome";
    else if (/safari/i.test(ua)) browser = "Safari";
    else if (/firefox/i.test(ua)) browser = "Firefox";
    else if (/edge/i.test(ua)) browser = "Edge";
    else if (/msie|trident/i.test(ua)) browser = "Internet Explorer";

    let os = "Unknown";
    if (/windows/i.test(ua)) os = "Windows";
    else if (/macintosh|mac os/i.test(ua)) os = "MacOS";
    else if (/android/i.test(ua)) os = "Android";
    else if (/iphone|ipad|ios/i.test(ua)) os = "iOS";
    else if (/linux/i.test(ua)) os = "Linux";

    let device_type =
        /mobile/i.test(ua) ? "Mobile" :
        /tablet/i.test(ua) ? "Tablet" :
        "Desktop";

    return { browser, os, device_type };
}

app.post('/api/logs/:site', validateApiKey, async (req, res) => {
    const site = req.params.site;

    // 1. Extract IP and fallback values
    const ip =
        req.headers["x-real-ip"] ||
        req.headers["x-forwarded-for"] ||
        req.ip ||
        "Unknown";

    const ua = req.headers["user-agent"] || null;
    const referrer = req.headers["referer"] || null;
    const url = req.body.url || null;
    const message = req.body.message || "Visitor logged";

    // 2. Parse UA -> browser, OS, device
    const { browser, os, device_type } = parseUserAgent(ua);

    // 3. GeoIP lookup (free API)
    const geoApiUrl = `https://ipapi.co/${ip}/json/`;
    let country = "Unknown";

    try {
        const geoResponse = await fetch(geoApiUrl);
        if (geoResponse.ok) {
            const geo = await geoResponse.json();
            if (geo && geo.country_name) {
                country = geo.country_name;
            }
        }
    } catch (err) {
        console.error("GeoIP lookup failed:", err.message);
    }

    // 4. Save into DB
    try {
        const result = await pool.query(
            `INSERT INTO appdata.logs 
            (site_id, message, ip, country, user_agent, device_type, browser, os, url, referrer) 
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            RETURNING *`,
            [
                site, message, ip, country,
                ua, device_type, browser, os,
                url, referrer
            ]
        );

        res.json(result.rows[0]);

    } catch (err) {
        console.error("DB ERROR:", err);
        res.status(500).json({ error: err.message });
    }
});



//// -------- START SERVER -------- ////

app.listen(3001, () =>
    console.log("Unified API running on port 3001")
);
