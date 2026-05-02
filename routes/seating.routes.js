const express = require("express");
const pool = require("../db");
// const requireAuth = require("../middleware/auth.middleware");

const router = express.Router();

/* 🔒 ALL SEATING ROUTES REQUIRE TOKEN - COMMENTED OUT FOR NOW */
// router.use(requireAuth);

/* ============================================
   SEATING TABLES
============================================ */

/* GET ALL TABLES WITH OCCUPANCY COUNTS */
router.get("/tables", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        st.table_id,
        st.table_name,
        st.capacity,
        st.notes,
        COUNT(sa.seating_id) AS occupancy
      FROM wedding.seating_table st
      LEFT JOIN wedding.seating_assignment sa ON st.table_id = sa.table_id
      GROUP BY st.table_id, st.table_name, st.capacity, st.notes
      ORDER BY st.table_name
    `);

    res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* GET SPECIFIC TABLE WITH ALL ASSIGNMENTS & GUEST DETAILS */
router.get("/tables/:table_id", async (req, res) => {
  const { table_id } = req.params;

  try {
    // Get table details
    const tableResult = await pool.query(
      `SELECT * FROM wedding.seating_table WHERE table_id = $1`,
      [table_id]
    );

    if (tableResult.rows.length === 0) {
      return res.status(404).json({ error: "Table not found" });
    }

    const table = tableResult.rows[0];

    // Get all assignments with guest details
    const assignmentsResult = await pool.query(`
      SELECT 
        sa.seating_id,
        sa.table_id,
        sa.guest_list_id,
        sa.seat_number,
        sa.notes,
        gl.guest_name,
        gl.email,
        gl.phone,
        gl.rsvp_status
      FROM wedding.seating_assignment sa
      LEFT JOIN wedding.guest_list gl ON sa.guest_list_id = gl.guest_list_id
      WHERE sa.table_id = $1
      ORDER BY sa.seat_number, sa.seating_id
    `, [table_id]);

    res.json({
      table,
      assignments: assignmentsResult.rows,
      occupancy: assignmentsResult.rows.length
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* CREATE NEW TABLE */
router.post("/tables", async (req, res) => {
  const { table_name, capacity, notes } = req.body;

  if (!table_name) {
    return res.status(400).json({ error: "table_name is required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO wedding.seating_table (table_name, capacity, notes)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [table_name, capacity || 0, notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* UPDATE TABLE */
router.put("/tables/:table_id", async (req, res) => {
  const { table_id } = req.params;
  const { table_name, capacity, notes } = req.body;

  try {
    // Check if table exists
    const checkResult = await pool.query(
      `SELECT * FROM wedding.seating_table WHERE table_id = $1`,
      [table_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Table not found" });
    }

    // Update table (only provided fields)
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (table_name !== undefined) {
      updates.push(`table_name = $${paramCount}`);
      values.push(table_name);
      paramCount++;
    }

    if (capacity !== undefined) {
      updates.push(`capacity = $${paramCount}`);
      values.push(capacity);
      paramCount++;
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramCount}`);
      values.push(notes);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(table_id);

    const result = await pool.query(
      `UPDATE wedding.seating_table
       SET ${updates.join(", ")}
       WHERE table_id = $${paramCount}
       RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* DELETE TABLE (HARD DELETE, CASCADES TO ASSIGNMENTS) */
router.delete("/tables/:table_id", async (req, res) => {
  const { table_id } = req.params;

  try {
    // Check if table exists
    const checkResult = await pool.query(
      `SELECT * FROM wedding.seating_table WHERE table_id = $1`,
      [table_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Table not found" });
    }

    // Delete table (cascades to assignments via FK)
    await pool.query(
      `DELETE FROM wedding.seating_table WHERE table_id = $1`,
      [table_id]
    );

    res.json({ ok: true, message: "Table deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ============================================
   SEATING ASSIGNMENTS
============================================ */

/* GET ALL ASSIGNMENTS WITH GUEST DETAILS */
router.get("/assignments", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        sa.seating_id,
        sa.table_id,
        sa.guest_list_id,
        sa.seat_number,
        sa.notes,
        st.table_name,
        gl.guest_name,
        gl.email,
        gl.phone,
        gl.rsvp_status
      FROM wedding.seating_assignment sa
      JOIN wedding.seating_table st ON sa.table_id = st.table_id
      LEFT JOIN wedding.guest_list gl ON sa.guest_list_id = gl.guest_list_id
      ORDER BY st.table_name, sa.seat_number, sa.seating_id
    `);

    res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ASSIGN GUEST TO TABLE (AUTO-HANDLES OVERWRITE) */
router.post("/assignments", async (req, res) => {
  const { guest_list_id, table_id, seat_number, notes } = req.body;

  if (!guest_list_id || !table_id) {
    return res.status(400).json({ error: "guest_list_id and table_id are required" });
  }

  try {
    // Validate guest exists
    const guestCheck = await pool.query(
      `SELECT * FROM wedding.guest_list WHERE guest_list_id = $1`,
      [guest_list_id]
    );

    if (guestCheck.rows.length === 0) {
      return res.status(404).json({ error: "Guest not found" });
    }

    // Validate table exists
    const tableCheck = await pool.query(
      `SELECT * FROM wedding.seating_table WHERE table_id = $1`,
      [table_id]
    );

    if (tableCheck.rows.length === 0) {
      return res.status(404).json({ error: "Table not found" });
    }

    // Check if guest is already assigned (overwrite strategy)
    const existingAssignment = await pool.query(
      `SELECT * FROM wedding.seating_assignment WHERE guest_list_id = $1`,
      [guest_list_id]
    );

    if (existingAssignment.rows.length > 0) {
      // Delete the old assignment
      await pool.query(
        `DELETE FROM wedding.seating_assignment WHERE guest_list_id = $1`,
        [guest_list_id]
      );
    }

    // Create new assignment
    const result = await pool.query(
      `INSERT INTO wedding.seating_assignment (guest_list_id, table_id, seat_number, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [guest_list_id, table_id, seat_number || null, notes || null]
    );

    // Return assignment with guest & table details
    const assignmentWithDetails = await pool.query(`
      SELECT 
        sa.seating_id,
        sa.table_id,
        sa.guest_list_id,
        sa.seat_number,
        sa.notes,
        st.table_name,
        gl.guest_name,
        gl.email,
        gl.phone,
        gl.rsvp_status
      FROM wedding.seating_assignment sa
      JOIN wedding.seating_table st ON sa.table_id = st.table_id
      LEFT JOIN wedding.guest_list gl ON sa.guest_list_id = gl.guest_list_id
      WHERE sa.seating_id = $1
    `, [result.rows[0].seating_id]);

    res.status(201).json({
      ok: true,
      message: existingAssignment.rows.length > 0 ? "Guest reassigned to new table" : "Guest assigned to table",
      assignment: assignmentWithDetails.rows[0]
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* UPDATE ASSIGNMENT (SEAT NUMBER, NOTES) */
router.put("/assignments/:seating_id", async (req, res) => {
  const { seating_id } = req.params;
  const { seat_number, notes } = req.body;

  try {
    // Check if assignment exists
    const checkResult = await pool.query(
      `SELECT * FROM wedding.seating_assignment WHERE seating_id = $1`,
      [seating_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    // Update assignment (only provided fields)
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (seat_number !== undefined) {
      updates.push(`seat_number = $${paramCount}`);
      values.push(seat_number);
      paramCount++;
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramCount}`);
      values.push(notes);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(seating_id);

    const result = await pool.query(
      `UPDATE wedding.seating_assignment
       SET ${updates.join(", ")}
       WHERE seating_id = $${paramCount}
       RETURNING *`,
      values
    );

    // Return updated assignment with guest & table details
    const assignmentWithDetails = await pool.query(`
      SELECT 
        sa.seating_id,
        sa.table_id,
        sa.guest_list_id,
        sa.seat_number,
        sa.notes,
        st.table_name,
        gl.guest_name,
        gl.email,
        gl.phone,
        gl.rsvp_status
      FROM wedding.seating_assignment sa
      JOIN wedding.seating_table st ON sa.table_id = st.table_id
      LEFT JOIN wedding.guest_list gl ON sa.guest_list_id = gl.guest_list_id
      WHERE sa.seating_id = $1
    `, [seating_id]);

    res.json(assignmentWithDetails.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* DELETE ASSIGNMENT */
router.delete("/assignments/:seating_id", async (req, res) => {
  const { seating_id } = req.params;

  try {
    // Check if assignment exists
    const checkResult = await pool.query(
      `SELECT * FROM wedding.seating_assignment WHERE seating_id = $1`,
      [seating_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    // Delete assignment
    await pool.query(
      `DELETE FROM wedding.seating_assignment WHERE seating_id = $1`,
      [seating_id]
    );

    res.json({ ok: true, message: "Assignment deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ============================================
   BULK OPERATIONS
============================================ */

/* CLEAR ALL ASSIGNMENTS FROM A TABLE */
router.delete("/tables/:table_id/assignments", async (req, res) => {
  const { table_id } = req.params;

  try {
    // Check if table exists
    const checkResult = await pool.query(
      `SELECT * FROM wedding.seating_table WHERE table_id = $1`,
      [table_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Table not found" });
    }

    // Delete all assignments for this table
    const result = await pool.query(
      `DELETE FROM wedding.seating_assignment WHERE table_id = $1`,
      [table_id]
    );

    res.json({ ok: true, message: `Cleared ${result.rowCount} assignments from table` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* ============================================
   REPORTS & ANALYTICS
============================================ */

/* CAPACITY REPORT - TABLE OCCUPANCY */
router.get("/reports/capacity", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        st.table_id,
        st.table_name,
        st.capacity,
        COUNT(sa.seating_id) AS occupancy,
        CASE 
          WHEN st.capacity = 0 THEN 0
          ELSE ROUND((COUNT(sa.seating_id)::float / st.capacity::float) * 100, 2)
        END AS fullness_percentage,
        CASE
          WHEN st.capacity = 0 THEN 'No capacity set'
          WHEN COUNT(sa.seating_id) >= st.capacity THEN 'Full'
          ELSE 'Available'
        END AS status
      FROM wedding.seating_table st
      LEFT JOIN wedding.seating_assignment sa ON st.table_id = sa.table_id
      GROUP BY st.table_id, st.table_name, st.capacity
      ORDER BY st.table_name
    `);

    res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* UNASSIGNED GUESTS REPORT */
router.get("/reports/unassigned", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        gl.guest_list_id,
        gl.guest_name,
        gl.email,
        gl.phone,
        gl.rsvp_status,
        gl.party_size
      FROM wedding.guest_list gl
      WHERE gl.guest_list_id NOT IN (
        SELECT DISTINCT guest_list_id FROM wedding.seating_assignment
      )
      ORDER BY gl.guest_name
    `);

    res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* SEARCH GUESTS & TABLES BY NAME */
router.get("/search", async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim().length === 0) {
    return res.status(400).json({ error: "Search query required" });
  }

  const searchTerm = `%${q.toLowerCase()}%`;

  try {
    // Search tables
    const tablesResult = await pool.query(`
      SELECT 'table' AS type, table_id AS id, table_name AS name, capacity, null AS email
      FROM wedding.seating_table
      WHERE LOWER(table_name) LIKE $1
      ORDER BY table_name
    `, [searchTerm]);

    // Search guests
    const guestsResult = await pool.query(`
      SELECT 'guest' AS type, guest_list_id AS id, guest_name AS name, null AS capacity, email
      FROM wedding.guest_list
      WHERE LOWER(guest_name) LIKE $1
      ORDER BY guest_name
    `, [searchTerm]);

    res.json({
      tables: tablesResult.rows,
      guests: guestsResult.rows
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
