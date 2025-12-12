const { Pool } = require("pg");

const isProd = process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProd ? { rejectUnauthorized: false } : false
});

pool.query("SELECT current_database()")
  .then(res => console.log("API connected to DB:", res.rows[0]))
  .catch(err => console.error("DB connection failed:", err));

module.exports = pool;
