const db = require('../config/db');

exports.searchUsers = async (req, res) => {
  const query = req.query.q || '';
  const currentUserId = req.user.id;

  try {
    let result;
    if (!query.trim()) {
      // Empty query → return ALL users except the current user
      result = await db.query(
        `SELECT id, username, email, avatar_url 
         FROM public.users 
         WHERE id != $1 
         ORDER BY username ASC
         LIMIT 50`,
        [currentUserId]
      );
    } else {
      result = await db.query(
        `SELECT id, username, email, avatar_url 
         FROM public.users 
         WHERE (username ILIKE $1 OR email ILIKE $1) 
           AND id != $2 
         LIMIT 15`,
        [`%${query.trim()}%`, currentUserId]
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error('User search error:', err);
    res.status(500).json({ error: 'Failed to search users' });
  }
};

exports.updateProfile = async (req, res) => {
  const { username, email } = req.body;
  if (!username?.trim() || !email?.trim()) return res.status(400).json({ error: 'Username and email are required' });
  try {
    const result = await db.query(
      `UPDATE users SET username = $1, email = LOWER($2)
       WHERE id = $3
       RETURNING id, username, email, avatar_url, last_seen`,
      [username.trim(), email.trim(), req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Username or email is already in use' });
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Unable to update profile' });
  }
};
