const express = require('express');
const router = express.Router();
const db = require('../models/db');

// POST /auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.execute(
      'SELECT * FROM Users WHERE username = ? AND password_hash = ?',
      [username, password]
    );
    await db.end();

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = rows[0];
    req.session.user = {
      user_id: user.user_id,
      username: user.username,
      role: user.role
    };

    res.json({ role: user.role });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



module.exports = router;
