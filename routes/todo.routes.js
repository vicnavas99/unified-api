const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth.middleware");

const router = express.Router();

/* 🔒 ALL TODO ROUTES REQUIRE TOKEN */
router.use(requireAuth);

/* ===============================
   GET ALL LISTS
================================ */
router.get("/lists", async (req, res) => {
  const result = await pool.query(
    `SELECT DISTINCT list
     FROM victornavas.todolist
     WHERE show = true
     ORDER BY list`
  );

  res.json(result.rows.map(r => ({ name: r.list })));
});

/* ===============================
   GET TASKS BY LIST
================================ */
router.get("/lists/:list/tasks", async (req, res) => {
  const { list } = req.params;

  const result = await pool.query(
    `SELECT id, message AS text, done AS completed
     FROM victornavas.todolist
     WHERE list=$1 AND show=true
     ORDER BY created_at`,
    [list]
  );

  res.json(result.rows);
});

/* ===============================
   CREATE TASK
================================ */
router.post("/lists/:list/tasks", async (req, res) => {
  const { list } = req.params;
  const { text } = req.body;

  await pool.query(
    `INSERT INTO victornavas.todolist
     (list, message, done, show)
     VALUES ($1,$2,false,true)`,
    [list, text]
  );

  res.json({ success: true });
});

/* ===============================
   UPDATE TASK
================================ */
router.put("/tasks/:id", async (req, res) => {
  const { completed } = req.body;

  await pool.query(
    `UPDATE victornavas.todolist
     SET done=$1
     WHERE id=$2`,
    [completed, req.params.id]
  );

  res.json({ success: true });
});

/* ===============================
   DELETE TASK (SOFT DELETE)
================================ */
router.delete("/tasks/:id", async (req, res) => {
  await pool.query(
    `UPDATE victornavas.todolist
     SET show=false
     WHERE id=$1`,
    [req.params.id]
  );

  res.json({ success: true });
});

module.exports = router;
