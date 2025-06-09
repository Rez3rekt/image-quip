const express = require('express');

function createAccountRouter(db, authenticateToken) {
  const router = express.Router();

  // GET current user preferences
  router.get('/prefs', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    console.log(`[GET /api/account/prefs] Fetching prefs for userId: ${userId}`);
    db.get('SELECT username, defaultIcon FROM users WHERE id = ?', [userId], (err, row) => {
      if (err) {
        console.error('Error fetching preferences for user:', userId, err);
        return res.status(500).json({ success: false, message: 'Error fetching preferences.' });
      }
      if (!row) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
      const prefs = {
        defaultNickname: row.username, // Use username as the default nickname
        defaultIcon: row.defaultIcon,
      };
      console.log(`[GET /api/account/prefs] Found prefs for user ${userId}:`, prefs);
      res.json(prefs); // Send the preferences directly
    });
  });

  // PUT update user preferences
  router.put('/prefs', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const { defaultNickname, defaultIcon } = req.body;
    console.log(`[PUT /api/account/prefs] Updating prefs for userId: ${userId}`, {
      defaultNickname,
      defaultIcon,
    });

    // Basic validation
    if (
      typeof defaultNickname !== 'string' ||
      defaultNickname.trim().length === 0 ||
      defaultNickname.trim().length > 12
    ) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid nickname (must be 1-12 characters).' });
    }
    if (typeof defaultIcon !== 'string' || defaultIcon.length > 5) {
      // Basic emoji length check
      return res.status(400).json({ success: false, message: 'Invalid icon.' });
    }

    db.run(
      'UPDATE users SET username = ?, defaultIcon = ? WHERE id = ?',
      [defaultNickname.trim(), defaultIcon, userId],
      function (err) {
        if (err) {
          console.error(`Error updating preferences for user ${userId}:`, err);
          // Check for UNIQUE constraint violation (if nickname already exists)
          if (err.message.includes('UNIQUE constraint failed: users.username')) {
            return res.status(409).json({ success: false, message: 'Nickname already taken.' });
          }
          return res.status(500).json({ success: false, message: 'Error updating preferences.' });
        }
        if (this.changes === 0) {
          // Should not happen if token is valid, but good practice
          return res.status(404).json({ success: false, message: 'User not found for update.' });
        }
        console.log(`[PUT /api/account/prefs] Preferences updated for user ${userId}`);
        res.json({ success: true, message: 'Preferences updated successfully.' });
      },
    );
  });

  return router;
}

module.exports = createAccountRouter;
