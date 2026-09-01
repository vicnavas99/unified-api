const express = require("express");
const pool = require("../db");
const bcrypt = require("bcrypt");
const requireAuth = require("../middleware/auth.middleware");

const router = express.Router();

router.use(requireAuth);

router.post("/", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO victornavas.users (username, password_hash)
       VALUES ($1, $2)
       RETURNING id, username, created_at`,
      [username, passwordHash]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Username already exists" });
    }

    console.error("User creation failed:", err.message);
    res.status(500).json({ error: "User creation failed" });
  }
});

router.put("/:id", async (req, res) => {
  const { username, password } = req.body;
  const userId = Number(req.params.id);

  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(400).json({ error: "id must be a positive integer" });
  }

  if (username === undefined && password === undefined) {
    return res.status(400).json({ error: "username or password is required" });
  }

  if (username === "" || password === "") {
    return res.status(400).json({ error: "username and password cannot be empty" });
  }

  try {
    const updates = [];
    const values = [];

    if (username !== undefined) {
      values.push(username);
      updates.push(`username = $${values.length}`);
    }

    if (password !== undefined) {
      values.push(await bcrypt.hash(password, 10));
      updates.push(`password_hash = $${values.length}`);
    }

    values.push(userId);
    const result = await pool.query(
      `UPDATE victornavas.users
       SET ${updates.join(", ")}
       WHERE id = $${values.length}
       RETURNING id, username, created_at`,
      values
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Username already exists" });
    }

    console.error("User update failed:", err.message);
    res.status(500).json({ error: "User update failed" });
  }
});

router.delete("/:id", async (req, res) => {
  const userId = Number(req.params.id);

  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(400).json({ error: "id must be a positive integer" });
  }

  try {
    const result = await pool.query(
      `DELETE FROM victornavas.users
       WHERE id = $1
       RETURNING id, username, created_at`,
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("User deletion failed:", err.message);
    res.status(500).json({ error: "User deletion failed" });
  }
});

module.exports = router;
