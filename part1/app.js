var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mysql = require('mysql2/promise'); // added

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// database code added below
let db;

(async () => {
    try {
        // connect to MySQL without specifying database
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: ''
        });

        // create the database as per provided dogwalks.sql file
        await connection.query('DROP DATABASE IF EXISTS DogWalkService');
        await connection.query('CREATE DATABASE DogWalkService');
        await connection.end();

        // connect to the newly created database
        db = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'DogWalkService',
            multipleStatements: true
        });

        // create tables as per provided dogwalks.sql file
        await db.query(`
        CREATE TABLE Users (
            user_id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('owner', 'walker') NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE Dogs (
            dog_id INT AUTO_INCREMENT PRIMARY KEY,
            owner_id INT NOT NULL,
            name VARCHAR(50) NOT NULL,
            size ENUM('small', 'medium', 'large') NOT NULL,
            FOREIGN KEY (owner_id) REFERENCES Users(user_id)
        );

        CREATE TABLE WalkRequests (
            request_id INT AUTO_INCREMENT PRIMARY KEY,
            dog_id INT NOT NULL,
            requested_time DATETIME NOT NULL,
            duration_minutes INT NOT NULL,
            location VARCHAR(255) NOT NULL,
            status ENUM('open', 'accepted', 'completed', 'cancelled') DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (dog_id) REFERENCES Dogs(dog_id)
        );

        CREATE TABLE WalkApplications (
            application_id INT AUTO_INCREMENT PRIMARY KEY,
            request_id INT NOT NULL,
            walker_id INT NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
            FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
            FOREIGN KEY (walker_id) REFERENCES Users(user_id),
            CONSTRAINT unique_application UNIQUE (request_id, walker_id)
        );

        CREATE TABLE WalkRatings (
            rating_id INT AUTO_INCREMENT PRIMARY KEY,
            request_id INT NOT NULL,
            walker_id INT NOT NULL,
            owner_id INT NOT NULL,
            rating INT CHECK (rating BETWEEN 1 AND 5),
            comments TEXT,
            rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
            FOREIGN KEY (walker_id) REFERENCES Users(user_id),
            FOREIGN KEY (owner_id) REFERENCES Users(user_id),
            CONSTRAINT unique_rating_per_walk UNIQUE (request_id)
        );
    `);

        // insert Users as per query from previous part
        await db.query(`
      INSERT INTO Users (username, email, password_hash, role)
      VALUES
      ('alice123', 'alice@example.com', 'hashed123', 'owner'),
      ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
      ('carol123', 'carol@example.com', 'hashed789', 'owner'),
      ('derek_w', 'derek@example.com', 'hashed000', 'walker'),
      ('emily_o', 'emily@example.com', 'hashed999', 'owner');
    `);

        // insert Dogs using subqueries as per query from previous part
        await db.query(`
      INSERT INTO Dogs (owner_id, name, size)
      VALUES
      ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Max', 'medium'),
      ((SELECT user_id FROM Users WHERE username = 'carol123'), 'Bella', 'small'),
      ((SELECT user_id FROM Users WHERE username = 'emily_o'), 'Charlie', 'large'),
      ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Luna', 'small'),
      ((SELECT user_id FROM Users WHERE username = 'carol123'), 'Rocky', 'medium');
    `);

        // insert WalkRequests using subqueries as per query from previous part
        await db.query(`
      INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status)
      VALUES
      ((SELECT dog_id FROM Dogs WHERE name = 'Max'), '2025-06-10 08:00:00', 30, 'Parklands', 'open'),
      ((SELECT dog_id FROM Dogs WHERE name = 'Bella'), '2025-06-10 09:30:00', 45, 'Beachside Ave', 'accepted'),
      ((SELECT dog_id FROM Dogs WHERE name = 'Charlie'), '2025-06-11 10:00:00', 60, 'Central Park', 'open'),
      ((SELECT dog_id FROM Dogs WHERE name = 'Luna'), '2025-06-12 07:45:00', 30, 'Northside Trail', 'completed'),
      ((SELECT dog_id FROM Dogs WHERE name = 'Rocky'), '2025-06-13 11:15:00', 40, 'City Square', 'cancelled');
    `);

        console.log('Database set up and records inserted.');
    } catch (err) {
        console.error('Error setting up database:', err);
    }
})();


// /api routes added below
app.get('/api/dogs', async (req, res) => {
    try {
        const [result] = await db.execute(`
        SELECT
            Dogs.name AS dog_name,
            Dogs.size,
            Users.username AS owner_username
        FROM Dogs
        JOIN Users ON Dogs.owner_id = Users.user_id;
    `);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve data' });
    }
});


app.get('/api/walkrequests/open', async (req, res) => {
    try {
        const [result] = await db.execute(`
        SELECT
            WalkRequests.request_id,
            Dogs.name AS dog_name,
            WalkRequests.requested_time,
            WalkRequests.duration_minutes,
            WalkRequests.location,
            Users.username AS owner_username
        FROM WalkRequests
        JOIN Dogs ON WalkRequests.dog_id = Dogs.dog_id
        JOIN Users ON Dogs.owner_id = Users.user_id
        WHERE WalkRequests.status = 'open';
    `);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve walk requests' });
    }
});


app.get('/api/walkers/summary', async (req, res) => {
    try {
        const [result] = await db.execute(`
        SELECT
            Users.username AS walker_username,
            COUNT(DISTINCT WalkRatings.rating_id) AS total_ratings,
            ROUND(AVG(WalkRatings.rating), 2) AS average_rating,
            COUNT(DISTINCT CASE WHEN WalkRequests.status = 'completed' THEN WalkRequests.request_id END) AS completed_walks
        FROM Users
        LEFT JOIN WalkRatings ON Users.user_id = WalkRatings.walker_id
        LEFT JOIN WalkApplications ON Users.user_id = WalkApplications.walker_id
        LEFT JOIN WalkRequests ON WalkApplications.request_id = WalkRequests.request_id AND WalkRequests.status = 'completed'
        WHERE Users.role = 'walker'
        GROUP BY Users.user_id;
        `);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve walker summary' });
    }
});


app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

module.exports = app;
