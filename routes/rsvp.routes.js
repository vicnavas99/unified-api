const express = require("express");
const router = express.Router();

/**
 * POST /api/rsvp/gate
 * Checks if guest exists
 */
router.post("/gate", async (req, res) => {
  const { firstName, lastName } = req.body;

  if (!firstName || !lastName) {
    return res.status(400).json({
      ok: false,
      message: "Nombre y apellido requeridos"
    });
  }

  try {
    const db = req.app.locals.db;

    const query = `
      SELECT guest_list_id, group_id, first_name, last_name, status
      FROM wedding.guest_list
      WHERE LOWER(first_name) = LOWER($1)
        AND LOWER(last_name) = LOWER($2)
      LIMIT 1
    `;

    const result = await db.query(query, [firstName, lastName]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: "No encontramos tu nombre en la lista"
      });
    }

    const guest = result.rows[0];

    res.json({
      ok: true,
      guest
    });

  } catch (err) {
    console.error("RSVP gate error:", err);
    res.status(500).json({
      ok: false,
      message: "Error del servidor"
    });
  }
});

module.exports = router;
