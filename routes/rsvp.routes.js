const express = require("express");
const router = express.Router();
const XLSX = require("xlsx");

/**
 * POST /api/rsvp/gate
 * Body: { firstName, lastName }
 * Checks if guest exists in wedding.guest_list
 */
router.post("/gate", async (req, res) => {
  try {
    const db = req.app.locals.db;

    const firstName = String(req.body.firstName || "").trim();
    const lastName  = String(req.body.lastName || "").trim();

    if (!firstName || !lastName) {
      return res.status(400).json({
        ok: false,
        message: "firstName y lastName son requeridos."
      });
    }

    // ✅ matches your real table columns
    const q = `
      SELECT * 
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
 * Returns everyone in the same group_id
 */
router.get("/group/:groupId", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const groupId = Number(req.params.groupId);

    if (!Number.isFinite(groupId)) {
      return res.status(400).json({ ok: false, message: "Invalid group id" });
    }

    const q = `
      SELECT * 
      FROM wedding.guest_list
      WHERE group_id = $1
      ORDER BY first_name, last_name
    `;

    const result = await db.query(q, [groupId]);

    return res.json({
      ok: true,
      group: result.rows
    });
  } catch (err) {
    console.error("RSVP group error:", err);
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
 * POST /api/rsvp/gate
 * Body: { firstName, lastName }
 * Checks if guest exists in wedding.guest_list
 */
router.get("/groupList/:groupIdList", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const groupId = req.params.groupIdList;

    const q = `
      SELECT *
      FROM wedding.guest_list 
      WHERE group_id IN (${groupId})
      ORDER BY first_name, last_name`;

    const result = await db.query(q);

    return res.json({
      ok: true,
      group: result.rows
    });
  } catch (err) {
    console.error("RSVP group list error:", err);
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
 * Optional: quick test endpoint
 */
router.get("/ping", (_req, res) => {
  res.json({ ok: true, message: "rsvp routes working" });
});

/**
 * POST /api/rsvp/updateUser
 * Body: { guestListId, specialMessage, status, songRecomenation,usersWithStatusChange array of {guest_list_id, status} }
 * Updates guests in wedding.guest_list
 */
router.post("/updateUser", async (req, res) => {
  try {
    const db = req.app.locals.db;

    const guestListId = Number(req.body.guestListId);
    const guestName = String(req.body.guestName || "").trim();
    const hotel = Number(req.body.hotel || 0);
    const specialMessage = String(req.body.specialMessage || "").trim();
    const status = String(req.body.status || "").trim();
    const songRecomenation = String(req.body.songRecomenation || "").trim();
    const allergy = String(req.body.allergyComment || "").trim();
    const usersWithStatusChange = req.body.usersWithStatusChange || [];
    let going = "", notGoing = "", pending = "";

    if (!guestListId || !status) {
      return res.status(400).json({
        ok: false,
        message: "guestListId y status son requeridos."
      });
    }
    
    if(usersWithStatusChange.length > 0) {
      for (const user of usersWithStatusChange) {
        if (user.status === 1) going += user.guest_list_id + ",";
        else if (user.status === 2) notGoing += user.guest_list_id + ",";
        else if (user.status === 0) pending += user.guest_list_id + ",";
      }
      // Remove trailing commas
      going = going.replace(/,$/, "");
      notGoing = notGoing.replace(/,$/, "");
      pending = pending.replace(/,$/, "");
    }

    // ✅ matches your real table columns
    let q = `
      UPDATE wedding.guest_list
      SET status = ${status}, hotel = ${hotel}, special_message = '${specialMessage}', song_recommendation = '${songRecomenation}', allergy = '${allergy}', updatedby = '${guestName}'
      WHERE guest_list_id = ${guestListId};
    `;

    if (going)  q += ` UPDATE wedding.guest_list SET status = 1 WHERE guest_list_id IN (${going});`;
    if (notGoing) q += ` UPDATE wedding.guest_list SET status = 2 WHERE guest_list_id IN (${notGoing});`;
    if (pending) q += ` UPDATE wedding.guest_list SET status = 0 WHERE guest_list_id IN (${pending});`;

    const result = await db.query(q);

    return res.json({
      ok: true
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
 * GET /api/admin/guests
 * Returns all guests in wedding.guest_list
 */
router.get("/guests", async (req, res) => {
  try {
    const db = req.app.locals.db;

    const q = `
      SELECT *
      FROM wedding.guest_list
      ORDER BY group_id, last_name, first_name
    `;

    const result = await db.query(q);

    res.json({ ok: true, guests: result.rows });
  } catch (err) {
    console.error("ADMIN guests error:", err);
    res.status(500).json({ ok: false, message: "Internal server error" });
  }
});

/**
 * GET /api/admin/guests.xlsx
 * Downloads the guest list as an .xlsx file
 */
router.get("/guests.xlsx", async (req, res) => {
  try {
    const db = req.app.locals.db;

    const q = `
      SELECT
        guest_list_id,
        group_id,
        first_name,
        last_name,
        classification,
        status,
        special_message,
        allergy,
        song_recommendation,
        hotel
      FROM wedding.guest_list
      ORDER BY group_id, last_name, first_name
    `;

    const result = await db.query(q);

    // Convert rows -> worksheet
    const ws = XLSX.utils.json_to_sheet(result.rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Guests");

    // Write workbook to buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="wedding-guests.xlsx"`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    return res.send(buffer);
  } catch (err) {
    console.error("ADMIN xlsx error:", err);
    res.status(500).json({ ok: false, message: "Internal server error" });
  }
});

module.exports = router;

module.exports = router;
