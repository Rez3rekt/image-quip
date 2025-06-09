const express = require('express');

// Note: This router requires db and authenticateToken middleware to be passed in.
function createDeckRouter(db, authenticateToken) {
  const router = express.Router();

  // GET user's decks
  // GET /api/decks -> GET /
  router.get('/', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    db.all(
      'SELECT id, name, cardIds FROM decks WHERE userId = ? ORDER BY createdAt DESC',
      [userId],
      (err, rows) => {
        if (err) {
          console.error('Error fetching decks for user:', userId, err);
          return res.status(500).json({ success: false, message: 'Error fetching decks.' });
        }
        // Parse cardIds string back into an array for each deck
        const decks = rows.map(deck => ({ ...deck, cardIds: JSON.parse(deck.cardIds || '[]') }));
        res.json({ success: true, decks });
      },
    );
  });

  // POST create a new deck
  // POST /api/decks -> POST /
  router.post('/', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const { name, cardIds = [] } = req.body; // Expect name, optional cardIds
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Deck name is required.' });
    }
    // TODO: Validate cardIds if provided (ensure they exist for the user?)
    // Validate cardIds if provided
    if (cardIds.length > 0) {
      try {
        const placeholders = cardIds.map(() => '?').join(',');
        const validateQuery = `
          SELECT id FROM cards 
          WHERE id IN (${placeholders}) AND userId = ?
        `;
        const validCards = db.prepare(validateQuery).all(...cardIds, userId);
        
        if (validCards.length !== cardIds.length) {
          const validCardIds = validCards.map(card => card.id);
          const invalidIds = cardIds.filter(id => !validCardIds.includes(id));
          return res.status(400).json({
            success: false,
            message: `Invalid card IDs: ${invalidIds.join(', ')}. These cards don't exist or don't belong to you.`,
          });
        }
      } catch (error) {
        console.error('Error validating card IDs:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to validate card IDs.',
        });
      }
    }

    const newDeckId = `deck-${Date.now()}-${Math.random().toString(16).substring(2, 8)}`;
    const cardIdsJson = JSON.stringify(cardIds || []);
    const now = new Date().toISOString();

    db.run(
      'INSERT INTO decks (id, userId, name, cardIds, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      [newDeckId, userId, name.trim(), cardIdsJson, now, now],
      function (err) {
        // Use function keyword for `this`
        if (err) {
          console.error('Error creating deck for user:', userId, err);
          return res.status(500).json({ success: false, message: 'Error creating deck.' });
        }
        // Return the newly created deck info
        res
          .status(201)
          .json({
            success: true,
            deck: {
              id: newDeckId,
              userId,
              name: name.trim(),
              cardIds: cardIds || [],
              createdAt: now,
              updatedAt: now,
            },
          });
      },
    );
  });

  // PUT update an existing deck (e.g., add/remove cards, rename)
  // PUT /api/decks/:deckId -> PUT /:deckId
  router.put('/:deckId', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const { deckId } = req.params;
    const { name, cardIds } = req.body;

    if (!name && !cardIds) {
      return res
        .status(400)
        .json({ success: false, message: 'No update data provided (name or cardIds).' });
    }
    // Validate data types
    if (name && (typeof name !== 'string' || name.trim() === '')) {
      return res.status(400).json({ success: false, message: 'Invalid deck name.' });
    }
    if (cardIds && !Array.isArray(cardIds)) {
      return res.status(400).json({ success: false, message: 'cardIds must be an array.' });
    }

    const updates = [];
    const params = [];
    if (name) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (cardIds) {
      updates.push('cardIds = ?');
      params.push(JSON.stringify(cardIds));
    }
    updates.push('updatedAt = ?');
    params.push(new Date().toISOString());

    params.push(deckId); // For WHERE clause
    params.push(userId); // For WHERE clause

    const sql = `UPDATE decks SET ${updates.join(', ')} WHERE id = ? AND userId = ?`;

    db.run(sql, params, function (err) {
      if (err) {
        console.error(`Error updating deck ${deckId} for user ${userId}:`, err);
        return res.status(500).json({ success: false, message: 'Error updating deck.' });
      }
      if (this.changes === 0) {
        return res
          .status(404)
          .json({ success: false, message: 'Deck not found or not owned by user.' });
      }
      res.json({ success: true, message: 'Deck updated successfully.' });
    });
  });

  // DELETE a deck
  // DELETE /api/decks/:deckId -> DELETE /:deckId
  router.delete('/:deckId', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const { deckId } = req.params;

    db.run('DELETE FROM decks WHERE id = ? AND userId = ?', [deckId, userId], function (err) {
      if (err) {
        console.error(`Error deleting deck ${deckId} for user ${userId}:`, err);
        return res.status(500).json({ success: false, message: 'Error deleting deck.' });
      }
      if (this.changes === 0) {
        return res
          .status(404)
          .json({ success: false, message: 'Deck not found or not owned by user.' });
      }
      res.json({ success: true, message: 'Deck deleted successfully.' });
    });
  });

  return router;
}

module.exports = createDeckRouter;
