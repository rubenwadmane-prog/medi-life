const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { verifyToken } = require('../middleware/auth');

// All routes require auth
router.use(verifyToken);

// ─── POST /api/consultations ──────────────────────────────────────────────────
// Save a consultation result from the frontend AI call
router.post('/', (req, res) => {
  try {
    const { symptoms, mode, summary, conditions, specialist, urgency, aiResponse, doctors } = req.body;
    if (!symptoms || !mode) return res.status(400).json({ error: 'symptoms and mode are required' });

    const id = uuidv4();
    db.prepare(`
      INSERT INTO consultations (id, user_id, symptoms, mode, summary, conditions, specialist, urgency, ai_response)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.user.id,
      symptoms,
      mode,
      summary || null,
      conditions ? JSON.stringify(conditions) : null,
      specialist || null,
      urgency    || null,
      aiResponse ? JSON.stringify(aiResponse) : null
    );

    // Save doctors if provided (online mode)
    if (Array.isArray(doctors) && doctors.length > 0) {
      const insertDoc = db.prepare(`
        INSERT INTO doctors (id, consultation_id, name, specialisation, hospital, distance, rating, type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertMany = db.transaction((docs) => {
        for (const d of docs) {
          insertDoc.run(uuidv4(), id, d.name, d.spec || d.specialisation, d.hospital, d.distance, d.rating, d.type);
        }
      });
      insertMany(doctors);
    }

    const saved = db.prepare('SELECT * FROM consultations WHERE id = ?').get(id);
    res.status(201).json({ consultation: formatConsultation(saved) });
  } catch (err) {
    console.error('Save consultation error:', err);
    res.status(500).json({ error: 'Failed to save consultation' });
  }
});

// ─── GET /api/consultations ───────────────────────────────────────────────────
// List all consultations for current user (paginated)
router.get('/', (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const total = db.prepare('SELECT COUNT(*) as n FROM consultations WHERE user_id = ?').get(req.user.id).n;
    const rows  = db.prepare(`
      SELECT * FROM consultations WHERE user_id = ?
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(req.user.id, limit, offset);

    res.json({
      consultations: rows.map(formatConsultation),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('List consultations error:', err);
    res.status(500).json({ error: 'Failed to fetch consultations' });
  }
});

// ─── GET /api/consultations/:id ───────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const consultation = db.prepare(
      'SELECT * FROM consultations WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!consultation) return res.status(404).json({ error: 'Consultation not found' });

    const doctors = db.prepare('SELECT * FROM doctors WHERE consultation_id = ?').all(req.params.id);
    res.json({ consultation: { ...formatConsultation(consultation), doctors } });
  } catch (err) {
    console.error('Get consultation error:', err);
    res.status(500).json({ error: 'Failed to fetch consultation' });
  }
});

// ─── DELETE /api/consultations/:id ───────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare(
      'DELETE FROM consultations WHERE id = ? AND user_id = ?'
    ).run(req.params.id, req.user.id);

    if (result.changes === 0) return res.status(404).json({ error: 'Consultation not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Delete consultation error:', err);
    res.status(500).json({ error: 'Failed to delete consultation' });
  }
});

// ─── DELETE /api/consultations ────────────────────────────────────────────────
// Clear all history for current user
router.delete('/', (req, res) => {
  try {
    db.prepare('DELETE FROM consultations WHERE user_id = ?').run(req.user.id);
    res.json({ message: 'All consultations cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear consultations' });
  }
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function formatConsultation(c) {
  return {
    id:         c.id,
    symptoms:   c.symptoms,
    mode:       c.mode,
    summary:    c.summary,
    conditions: c.conditions ? JSON.parse(c.conditions) : [],
    specialist: c.specialist,
    urgency:    c.urgency,
    aiResponse: c.ai_response ? JSON.parse(c.ai_response) : null,
    createdAt:  c.created_at,
  };
}

module.exports = router;
