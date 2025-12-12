const siteKeys = require("../utils/keys");

module.exports = function validateApiKey(req, res, next) {
  const site = req.params.site;
  const key = req.headers["x-api-key"];

  if (!siteKeys[site]) {
    return res.status(400).json({ error: "Unknown site" });
  }

  if (siteKeys[site] !== key) {
    return res.status(403).json({ error: "Invalid API Key" });
  }

  next();
};
