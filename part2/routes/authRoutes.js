const express = require('express');
const router = express.Router();
const db = require('../models/db');

// added POST /auth/login route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.execute(
      'SELECT * FROM Users WHERE username = ? AND password_hash = ?',
      [username, password]
    ); // find user
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

// added GET /auth/logout route
router.get('/logout', (req, res) => {
  req.session.destroy((err) => { // destroys session
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid'); // clears cookie data
    res.redirect('/'); // returns to index.html page for login form
  });
});

module.exports = router;
