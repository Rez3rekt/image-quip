const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const saltRounds = 10; // Assuming saltRounds is constant, keep it here or pass it in as well.

function createAuthRouter(db, JWT_SECRET) {
  const router = express.Router();

  // POST /register
  router.post('/register', (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required.' });
    }

    // Basic validation (add more robust validation later)
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    try {
      // Check if email or username already exists in DB
      db.get(
        'SELECT email FROM users WHERE email = ? OR username = ?',
        [email, username],
        async (err, row) => {
          if (err) {
            console.error('DB Error checking user existence:', err.message);
            return res.status(500).json({ message: 'Database error during registration check.' });
          }
          if (row) {
            const existingField = row.email === email ? 'Email' : 'Username';
            return res.status(409).json({ message: `${existingField} already exists.` }); // Conflict
          }

          // Hash password
          const passwordHash = await bcrypt.hash(password, saltRounds);

          // Insert new user into DB
          db.run(
            'INSERT INTO users (username, email, passwordHash) VALUES (?, ?, ?)',
            [username, email, passwordHash],
            function (err) {
              // Use function() to get access to 'this'
              if (err) {
                console.error('DB Error inserting user:', err.message);
                return res.status(500).json({ message: 'Database error during registration.' });
              }
              console.log(`User registered successfully with ID: ${this.lastID}`);
              res.status(201).json({
                message: 'User registered successfully!',
                userId: this.lastID, // Send back the new user ID
                username: username,
              });
            },
          );
        },
      );
    } catch (error) {
      console.error('Registration Error:', error);
      res.status(500).json({ message: 'Internal server error during registration.' });
    }
  });

  // POST /login
  router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email/username and password are required.' });
    }

    try {
      // Check if input is an email (contains @ symbol)
      const isEmail = email.includes('@');

      // Use appropriate query based on whether input is email or username
      const query = isEmail
        ? 'SELECT * FROM users WHERE email = ?'
        : 'SELECT * FROM users WHERE username = ?';

      // Find user by email or username in DB
      db.get(query, [email], async (err, user) => {
        if (err) {
          console.error('DB Error finding user:', err.message);
          return res.status(500).json({ message: 'Database error during login.' });
        }

        if (!user) {
          console.log(
            `Login attempt failed: ${isEmail ? 'Email' : 'Username'} not found - ${email}`,
          );
          return res.status(401).json({ message: 'Invalid credentials.' }); // Unauthorized
        }

        // Compare submitted password with stored hash
        const match = await bcrypt.compare(password, user.passwordHash);

        if (match) {
          console.log(`Login successful for user: ${user.username}`);

          // Generate JWT Token
          const tokenPayload = { userId: user.id, username: user.username };
          // const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour
          const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' }); // Extend expiration to 7 days

          res.status(200).json({
            success: true,
            message: 'Login successful!',
            token: token, // Send the generated token
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              defaultIcon: user.defaultIcon,
            },
          });
        } else {
          console.log(
            `Login attempt failed: Password mismatch for ${isEmail ? 'email' : 'username'} ${email}`,
          );
          res.status(401).json({ message: 'Invalid credentials.' }); // Unauthorized
        }
      });
    } catch (error) {
      console.error('Login Error:', error);
      res.status(500).json({ message: 'Internal server error during login.' });
    }
  });

  // POST /reset-password - Simple password reset for development
  router.post('/reset-password', (req, res) => {
    const { email, newPassword } = req.body;
    
    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and new password are required.' });
    }

    // Basic validation
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    try {
      // Check if input is an email (contains @ symbol)
      const isEmail = email.includes('@');
      const query = isEmail
        ? 'SELECT * FROM users WHERE email = ?'
        : 'SELECT * FROM users WHERE username = ?';

      // Find user by email or username
      db.get(query, [email], async (err, user) => {
        if (err) {
          console.error('DB Error finding user for password reset:', err.message);
          return res.status(500).json({ message: 'Database error during password reset.' });
        }

        if (!user) {
          console.log(`Password reset failed: ${isEmail ? 'Email' : 'Username'} not found - ${email}`);
          return res.status(404).json({ message: 'User not found.' });
        }

        try {
          // Hash the new password
          const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

          // Update the password in the database
          db.run(
            'UPDATE users SET passwordHash = ? WHERE id = ?',
            [newPasswordHash, user.id],
            function (err) {
              if (err) {
                console.error('DB Error updating password:', err.message);
                return res.status(500).json({ message: 'Database error updating password.' });
              }

              console.log(`Password reset successful for user: ${user.username}`);
              res.status(200).json({
                success: true,
                message: 'Password reset successfully! You can now login with your new password.',
              });
            }
          );
        } catch (hashError) {
          console.error('Error hashing new password:', hashError);
          res.status(500).json({ message: 'Error processing new password.' });
        }
      });
    } catch (error) {
      console.error('Password Reset Error:', error);
      res.status(500).json({ message: 'Internal server error during password reset.' });
    }
  });

  return router;
}

module.exports = createAuthRouter;
