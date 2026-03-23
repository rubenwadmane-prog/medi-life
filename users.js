const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const supabase = require('../db/database');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// ─── GET /api/users/profile ───────────────────────────────────────────────────
router.get('/profile', async (req, res) => {
  try {
    const { data: rows, error } = await supabase
      .from('consultations')
      .select('mode, created_at')
      .eq('user_id', req.user.id);

    if (error) throw error;

    const totalConsultations = rows.length;
    const onlineCount        = rows.filter(r => r.mode === 'online').length;
    const offlineCount       = rows.filter(r => r.mode === 'offline').length;
    const lastConsultation   = rows.length > 0
      ? rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at
      : null;

    res.json({
      user: {
        id:        req.user.id,
        name:      req.user.name,
        email:     req.user.email,
        avatar:    req.user.avatar,
        provider:  req.user.provider,
        createdAt: req.user.created_at,
      },
      stats: { totalConsultations, onlineCount, offlineCount, lastConsultation },
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ─── PATCH /api/users/profile ─────────────────────────────────────────────────
router.patch('/profile', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

    const { error } = await supabase
      .from('users')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', req.user.id);

    if (error) throw error;

    const { data: updated } = await supabase.from('users').select('*').eq('id', req.user.id).single();
    res.json({ user: { id: updated.id, name: updated.name, email: updated.email, avatar: updated.avatar } });
  } catch (err) {
    console.error('Update profile error:', err);
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

    const { data: user } = await supabase.from('users').select('*').eq('id', req.user.id).single();
    if (!user.password)
      return res.status(400).json({ error: 'Password change not available for Google accounts' });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    const { error } = await supabase
      .from('users')
      .update({ password: hash, updated_at: new Date().toISOString() })
      .eq('id', req.user.id);

    if (error) throw error;
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ─── DELETE /api/users/account ────────────────────────────────────────────────
router.delete('/account', async (req, res) => {
  try {
    const { error } = await supabase.from('users').delete().eq('id', req.user.id);
    if (error) throw error;
    res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
