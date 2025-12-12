const express = require("express");
const pool = require("../db");
const parseUA = require("../utils/userAgent");
const validateApiKey = require("../middleware/apikey.middleware");

const router = express.Router();

router.post("/:site", validateApiKey, async (req, res) => {
  const site = req.params.site;
  const ip =
    req.headers["x-forwarded-for"] ||
    req.headers["x-real-ip"] ||
    req.ip;

  const ua = req.headers["user-agent"];
  const { browser, os, device_type } = parseUA(ua);

  let country = "Unknown";
  try {
    const geo = await fetch(`https://ipapi.co/${ip}/json/`).then(r => r.json());
    if (geo?.country_name) country = geo.country_name;
  } catch {}

  const { message = "Visitor logged", url = null } = req.body;

  const result = await pool.query(
    `INSERT INTO appdata.logs
     (site_id,message,ip,country,user_agent,device_type,browser,os,url,referrer)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      site, message, ip, country,
      ua, device_type, browser, os,
      url, req.headers.referer || null
    ]
  );

  res.json(result.rows[0]);
});

module.exports = router;
