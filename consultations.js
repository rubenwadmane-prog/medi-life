const router   = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../db/database');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// ─── POST /api/consultations ──────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { symptoms, mode, summary, conditions, specialist, urgency, aiResponse, doctors } = req.body;
    if (!symptoms || !mode) return res.status(400).json({ error: 'symptoms and mode are required' });

    const id = uuidv4();

    const { error: consultError } = await supabase.from('consultations').insert({
      id,
      user_id:    req.user.id,
      symptoms,
      mode,
      summary:    summary    || null,
      conditions: conditions || null,
      specialist: specialist || null,
      urgency:    urgency    || null,
      ai_response: aiResponse || null,
    });
    if (consultError) throw consultError;

    // Save doctors if provided (online mode)
    if (Array.isArray(doctors) && doctors.length > 0) {
      const doctorRows = doctors.map(d => ({
        id:              uuidv4(),
        consultation_id: id,
        name:            d.name,
        specialisation:  d.spec || d.specialisation,
        hospital:        d.hospital,
        distance:        d.distance,
        rating:          d.rating,
        type:            d.type,
      }));
      const { error: docError } = await supabase.from('doctors').insert(doctorRows);
      if (docError) throw docError;
    }

    const { data: saved } = await supabase.from('consultations').select('*').eq('id', id).single();
    res.status(201).json({ consultation: formatConsultation(saved) });
  } catch (err) {
    console.error('Save consultation error:', err);
    res.status(500).json({ error: 'Failed to save consultation' });
  }
});

// ─── GET /api/consultations ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const { count } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    const { data: rows, error } = await supabase
      .from('consultations')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      consultations: rows.map(formatConsultation),
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  } catch (err) {
    console.error('List consultations error:', err);
    res.status(500).json({ error: 'Failed to fetch consultations' });
  }
});

// ─── GET /api/consultations/:id ───────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { data: consultation, error } = await supabase
      .from('consultations')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!consultation) return res.status(404).json({ error: 'Consultation not found' });

    const { data: doctors } = await supabase
      .from('doctors')
      .select('*')
      .eq('consultation_id', req.params.id);

    res.json({ consultation: { ...formatConsultation(consultation), doctors: doctors || [] } });
  } catch (err) {
    console.error('Get consultation error:', err);
    res.status(500).json({ error: 'Failed to fetch consultation' });
  }
});

// ─── DELETE /api/consultations/:id ───────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('consultations')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: 'Consultation not found' });

    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Delete consultation error:', err);
    res.status(500).json({ error: 'Failed to delete consultation' });
  }
});

// ─── DELETE /api/consultations ────────────────────────────────────────────────
router.delete('/', async (req, res) => {
  try {
    const { error } = await supabase
      .from('consultations')
      .delete()
      .eq('user_id', req.user.id);

    if (error) throw error;
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
    conditions: c.conditions || [],
    specialist: c.specialist,
    urgency:    c.urgency,
    aiResponse: c.ai_response || null,
    createdAt:  c.created_at,
  };
}

module.exports = router;
