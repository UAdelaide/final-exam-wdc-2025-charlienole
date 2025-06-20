const express = require('express');
const path = require('path');
require('dotenv').config();
const db = require('/models/db'); // added

const session = require('express-session'); // added

const app = express();

app.use(express.json());

// added /api/dogs route here, modified to return dog id and owner id too
app.get('/api/dogs', async (req, res) => {
    try {
        const [result] = await db.execute(`
            SELECT
                Dogs.dog_id,
                Dogs.name AS dog_name,
                Dogs.size,
                Dogs.owner_id,
                Users.username AS owner_username
            FROM Dogs
            JOIN Users ON Dogs.owner_id = Users.user_id;
        `);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve data' });
    }
});

app.use(express.static(path.join(__dirname, '/public')));

// added session middleware
app.use(session({
  secret: 'user_session',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Routes
const walkRoutes = require('./routes/walkRoutes');
const userRoutes = require('./routes/userRoutes');
var authRoutes = require('./routes/authRoutes'); // added


app.use('/api/walks', walkRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes); // added

// Export the app instead of listening here
module.exports = app;