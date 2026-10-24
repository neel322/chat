// chat-backend/src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { validateAuthInput } = require('../utils/validators');

exports.register = async (req, res) => {
  const { username, email, password } = req.body;

  // 1. Run format validations
  const validationError = validateAuthInput({ username, email, password, isRegistration: true });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  try {
    // 2. Check if username or email already exists
    const existingCheck = await db.query(
      `SELECT id, username, email FROM public.users 
       WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2) 
       LIMIT 1`,
      [cleanUsername, cleanEmail]
    );

    if (existingCheck.rows.length > 0) {
      const match = existingCheck.rows[0];
      if (match.username.toLowerCase() === cleanUsername.toLowerCase()) {
        return res.status(409).json({ error: 'Username is already taken. Please choose another.' });
      }
      if (match.email.toLowerCase() === cleanEmail.toLowerCase()) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
    }

    // 3. Hash password and insert
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await db.query(
      `INSERT INTO public.users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, avatar_url, created_at`,
      [cleanUsername, cleanEmail, passwordHash]
    );

    const newUser = result.rows[0];

    // 4. Generate JWT
    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user: newUser, token });
  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username or email is already registered' });
    }
    res.status(500).json({ error: 'Registration failed due to a server error' });
  }
};

exports.login = async (req, res) => {
  const { identifier, password } = req.body; // identifier can be username or email

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required' });
  }

  const cleanId = identifier.trim();

  try {
    const userRes = await db.query(
      `SELECT * FROM public.users 
       WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) 
       LIMIT 1`,
      [cleanId]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      user: { id: user.id, username: user.username, email: user.email, avatar_url: user.avatar_url },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};