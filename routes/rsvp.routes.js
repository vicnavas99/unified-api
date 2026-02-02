const express = require("express");
const router = express.Router();

/**
 * POST /api/rsvp/gate
 * Body: { firstName, lastName }
 * Checks if guest exists in wedding.guest_list
 */
router.post("/gate", async (req, res) => {
  try {
    const db = req.app.locals.db;

    const firstName = String(req.body.firstName || "").trim();
    const lastName = String(req.body.lastName || "").trim();

    if (!firstName || !lastName) {
      return res.status(400).json({
        ok: false,
        message: "firstName y lastName son requeridos."
      });
    }

    // ✅ Case-insensitive match. You can swap to ILIKE if you prefer.
    const q = `
      SELECT guest_list_id, group_id, first_name, last_name, classification, status, special_message
      FROM wedding.guest_list
      WHERE (LOWER(first_name) = LOWER($1) OR LOWER(second_name) = LOWER($1))
        AND LOWER(last_name)  = LOWER($2)
      LIMIT 1
    `;
    const result = await db.query(q, [firstName, lastName]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "No encontramos tu nombre en la lista. Verifica la ortografía."
      });
    }

    // Optional: you may want to block if status means "not invited" / etc.
    // Example:
    // if (result.rows[0].status === 0) { ... }

    return res.json({
      ok: true,
      guest: result.rows[0]
    });
  } catch (err) {
  console.error("RSVP gate error:", err);

  return res.status(500).json({
    ok: false,
    message: "Error interno. Intenta más tarde.",
    debug: process.env.NODE_ENV !== "production"
      ? { message: err.message, code: err.code, detail: err.detail }
      : undefined
  });
}

});

/**
 * GET /api/rsvp/group/:groupId
 * Returns everyone in the same group
 */
router.get("/group/:guestId", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const guestId = Number(req.params.guestId);

    if (guestId === null || guestId === undefined) {
      return res.status(400).json({ ok: false, message: "Invalid group id" });
    }

    const q = `
        SELECT g.*
        FROM wedding.guest_list g
        WHERE g.group_id IN (
            SELECT unnest(group_id_list)
            FROM wedding.guest_list
            WHERE guest_list_id = $1
        )
        ORDER BY g.first_name, g.second_name, g.last_name
    `;

    const result = await db.query(q, [guestId]);
    return res.json({
      ok: true,
      group: result.rows
    });
  } catch (err) {
    console.error("RSVP group error:", err);
    res.status(500).json({
      ok: false,
      message: "Error interno. Intenta más tarde."
    });
  }
});

/**
 * Optional: quick test endpoint
 */
router.get("/ping", (_req, res) => {
  res.json({ ok: true, message: "rsvp routes working" });
});

module.exports = router;
