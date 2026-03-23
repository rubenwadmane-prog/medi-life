const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const db      = require('../db/database');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// ─── GET /api/users/profile ───────────────────────────────────────────────────
router.get('/profile', (req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as totalConsultations,
      SUM(CASE WHEN mode='online'  THEN 1 ELSE 0 END) as onlineCount,
      SUM(CASE WHEN mode='offline' THEN 1 ELSE 0 END) as offlineCount,
      MAX(created_at) as lastConsultation
    FROM consultations WHERE user_id = ?
  `).get(req.user.id);

  res.json({
    user: {
      id:        req.user.id,
      name:      req.user.name,
      email:     req.user.email,
      avatar:    req.user.avatar,
      provider:  req.user.provider,
      createdAt: req.user.created_at,
    },
    stats,
  });
});

// ─── PATCH /api/users/profile ─────────────────────────────────────────────────
router.patch('/profile', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

    db.prepare(`UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(name.trim(), req.user.id);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: { id: updated.id, name: updated.name, email: updated.email, avatar: updated.avatar } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ─── POST /api/users/change-password ─────────────────────────────────────────
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user.password)
      return res.status(400).json({ error: 'Password change not available for Google accounts' });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    db.prepare(`UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(hash, req.user.id);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ─── DELETE /api/users/account ────────────────────────────────────────────────
router.delete('/account', (req, res) => {
  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
