const express = require('express');
const path = require('path');
require('dotenv').config();

const session = require('express-session'); // added

const app = express();

app.use(express.json());



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