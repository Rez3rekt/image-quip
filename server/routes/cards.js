const express = require('express');
const sharp = require('sharp');

// Note: This router requires db, authenticateToken, cardUpload, path, fs, cardUploadsDir to be passed in.
function createCardRouter(db, authenticateToken, cardUpload, path, fs, cardUploadsDir) {
  const router = express.Router();

  // Upload a new card - Apply auth middleware, use req.user.userId
  // POST /api/cards/upload -> POST /upload
  router.post('/upload', authenticateToken, cardUpload.single('image'), async (req, res) => {
    const userId = req.user.userId; // Get user ID from authenticated token
    console.log(`[POST /api/cards/upload] Upload attempt for user ID: ${userId}`, {
      hasFile: !!req.file,
    });

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: 'No image file uploaded or field name mismatch.' });
    }

    let generatedFilename;
    let userSpecificCardDir;
    let destinationPath;
    const timestamp = Date.now(); // Define timestamp here for reuse
    const randomSuffix = Math.random().toString(16).substring(2, 8); // Define suffix here

    try {
      generatedFilename = `${timestamp}-${randomSuffix}.webp`; // Enforce .webp extension

      // <<< Create user-specific directory >>>
      userSpecificCardDir = path.join(cardUploadsDir, `user_${userId}`);
      if (!fs.existsSync(userSpecificCardDir)) {
        fs.mkdirSync(userSpecificCardDir, { recursive: true });
        console.log(`[POST /api/cards/upload] Created directory: ${userSpecificCardDir}`);
      }
      destinationPath = path.join(userSpecificCardDir, generatedFilename);

      // <<< Use sharp to optimize and convert >>>
      console.log(`[POST /api/cards/upload] Optimizing image for user ${userId}...`);
      const optimizedBuffer = await sharp(req.file.buffer)
        .resize({ width: 800, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 }) // Convert to WebP with quality 80
        .toBuffer();
      console.log(`[POST /api/cards/upload] Image optimized. Writing to: ${destinationPath}`);

      // <<< Write the OPTIMIZED buffer >>>
      // fs.writeFileSync(destinationPath, req.file.buffer); // OLD way
      await fs.promises.writeFile(destinationPath, optimizedBuffer); // Use async write with optimized buffer

      // <<< Check if file exists after async write (optional but good) >>>
      // if (!fs.existsSync(destinationPath)) {
      //     throw new Error('File failed to save to disk after optimization.');
      // }
      // <<< End Check >>>

      // <<< Update relativeImagePath to include user-specific folder >>>
      const relativeImagePath = `/uploads/cards/user_${userId}/${generatedFilename}`;
      const newCardId = `card-${timestamp}-${randomSuffix}`;
      const defaultName = path.basename(req.file.originalname, path.extname(req.file.originalname)); // Use original base name
      const defaultTags = '[]'; // Store as JSON string

      // Insert into DB
      const stmt = db.prepare(
        'INSERT INTO cards (id, userId, imagePath, fileName, name, tags) VALUES (?, ?, ?, ?, ?, ?)',
      );
      stmt.run(
        newCardId,
        userId,
        relativeImagePath,
        generatedFilename,
        defaultName,
        defaultTags,
        function (err) {
          stmt.finalize(); // Finalize statement
          if (err) {
            console.error(
              `[POST /api/cards/upload] DB Error inserting card for user ${userId}:`,
              err.message,
            );
            // Clean up saved file if DB insert fails
            fs.unlink(destinationPath, unlinkErr => {
              if (unlinkErr) {
                console.error(
                  `Error cleaning up file ${destinationPath} after DB error:`,
                  unlinkErr,
                );
              }
            });
            return res.status(500).json({ success: false, message: 'Database error saving card.' });
          }
          console.log(
            `[POST /api/cards/upload] Card created in DB: ${newCardId} for user ${userId}`,
          );
          // Send back the full card object as created in the DB
          res.status(201).json({
            success: true,
            card: {
              id: newCardId,
              userId: userId,
              imagePath: relativeImagePath,
              fileName: generatedFilename,
              name: defaultName,
              tags: JSON.parse(defaultTags), // Parse tags back for client
              createdAt: new Date().toISOString(), // Approximate creation time
            },
          });
        },
      );
    } catch (error) {
      console.error(
        `[POST /api/cards/upload] Error during file write or card creation for user ${userId}:`,
        error,
      );
      if (destinationPath && fs.existsSync(destinationPath)) {
        fs.unlink(destinationPath, err => {
          if (err) {
            console.error(
              `[POST /api/cards/upload] Error cleaning up file ${destinationPath} after error:`,
              err,
            );
          }
        });
      }
      res.status(500).json({ success: false, message: 'Internal server error processing upload.' });
    }
  });

  // Get all cards for the logged-in user - Apply auth middleware, use req.user.userId
  // GET /api/cards -> GET /
  router.get('/', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    try {
      db.all(
        'SELECT id, userId, imagePath, fileName, name, tags, createdAt, lifetimeVotes FROM cards WHERE userId = ? ORDER BY createdAt DESC',
        [userId],
        (err, rows) => {
          if (err) {
            console.error(
              `[GET /api/cards] DB Error fetching cards for user ${userId}:`,
              err.message,
            );
            return res
              .status(500)
              .json({ success: false, message: 'Database error retrieving cards.' });
          }
          // Parse the JSON tags string back into an array for each card
          const cards = rows.map(card => ({
            ...card,
            tags: JSON.parse(card.tags || '[]'),
          }));
          res.json({ success: true, cards: cards });
        },
      );
    } catch (error) {
      console.error(`[GET /api/cards] Error for user ${userId}:`, error);
      res.status(500).json({ success: false, message: 'Failed to retrieve cards.' });
    }
  });

  // GET /api/users/me/cards - Get owned card image paths for the logged-in user
  // GET /api/cards/me/paths
  router.get('/me/paths', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    console.log(`[GET /api/cards/me/paths] Fetching card paths for user ${userId}`);
    try {
      // Select only the imagePath column
      db.all('SELECT imagePath FROM cards WHERE userId = ?', [userId], (err, rows) => {
        if (err) {
          console.error(
            `[GET /api/cards/me/paths] DB Error fetching card paths for user ${userId}:`,
            err.message,
          );
          return res
            .status(500)
            .json({ success: false, message: 'Database error retrieving card paths.' });
        }
        const ownedPaths = rows.map(row => row.imagePath);
        console.log(
          `[GET /api/cards/me/paths] Found ${ownedPaths.length} paths for user ${userId}`,
        );
        res.json({ success: true, ownedCards: ownedPaths }); // Send back an array of strings
      });
    } catch (error) {
      console.error(`[GET /api/cards/me/paths] Error for user ${userId}:`, error);
      res.status(500).json({ success: false, message: 'Failed to retrieve owned cards.' });
    }
  });

  // POST /api/users/me/cards - Add a card (by imagePath) to the logged-in user's collection
  // POST /api/cards/me/add
  router.post('/me/add', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const { imagePath } = req.body;

    console.log(`[POST /api/cards/me/add] Request from user ${userId} to add card: ${imagePath}`);

    if (!imagePath || typeof imagePath !== 'string' || !imagePath.startsWith('/uploads/cards/')) {
      console.warn(`[POST /api/cards/me/add] Invalid imagePath received: ${imagePath}`);
      return res.status(400).json({ success: false, message: 'Invalid imagePath provided.' });
    }

    try {
      // 1. Check if the user already owns this card path
      db.get(
        'SELECT id FROM cards WHERE userId = ? AND imagePath = ?',
        [userId, imagePath],
        (err, existingCard) => {
          if (err) {
            console.error(
              `[POST /api/cards/me/add] DB Error checking existence for user ${userId}, path ${imagePath}:`,
              err.message,
            );
            return res
              .status(500)
              .json({ success: false, message: 'Database error checking card ownership.' });
          }

          if (existingCard) {
            console.log(
              `[POST /api/cards/me/add] User ${userId} already owns card path ${imagePath}. No action needed.`,
            );
            // Card already exists for this user, return success (or maybe 200 OK)
            return res
              .status(200)
              .json({
                success: true,
                message: 'Card already in collection.',
                cardId: existingCard.id,
              });
          }

          // 2. Card doesn't exist for this user, create a new entry
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(16).substring(2, 8);
          const newCardId = `card-${timestamp}-${randomSuffix}`;
          const fileName = path.basename(imagePath); // Extract filename from path
          const defaultName = '';
          const defaultTags = '[]';

          const stmt = db.prepare(
            'INSERT INTO cards (id, userId, imagePath, fileName, name, tags) VALUES (?, ?, ?, ?, ?, ?)',
          );
          stmt.run(
            newCardId,
            userId,
            imagePath,
            fileName,
            defaultName,
            defaultTags,
            function (err) {
              stmt.finalize();
              if (err) {
                console.error(
                  `[POST /api/cards/me/add] DB Error inserting new card entry for user ${userId}, path ${imagePath}:`,
                  err.message,
                );
                return res
                  .status(500)
                  .json({ success: false, message: 'Database error adding card to collection.' });
              }
              console.log(
                `[POST /api/cards/me/add] Card path ${imagePath} added to collection for user ${userId} with new ID ${newCardId}`,
              );
              res.status(201).json({
                success: true,
                message: 'Card added to your collection!',
                card: {
                  // Send back some info about the newly created record
                  id: newCardId,
                  userId: userId,
                  imagePath: imagePath,
                  fileName: fileName,
                  name: defaultName,
                  tags: JSON.parse(defaultTags),
                },
              });
            },
          );
        },
      );
    } catch (error) {
      console.error(
        `[POST /api/cards/me/add] Error processing request for user ${userId}, path ${imagePath}:`,
        error,
      );
      res.status(500).json({ success: false, message: 'Internal server error adding card.' });
    }
  });

  // Delete a specific card for the logged-in user - Apply auth, use req.user.userId
  // DELETE /api/cards/:cardId -> DELETE /:cardId
  router.delete('/:cardId', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const { cardId } = req.params;
    try {
      // First, get the imagePath to delete the file
      db.get(
        'SELECT imagePath FROM cards WHERE id = ? AND userId = ?',
        [cardId, userId],
        (err, card) => {
          if (err) {
            console.error(
              `[DELETE /api/cards/:cardId] DB Error finding card ${cardId} for user ${userId}:`,
              err.message,
            );
            return res
              .status(500)
              .json({ success: false, message: 'Database error finding card.' });
          }
          if (!card) {
            return res
              .status(404)
              .json({ success: false, message: 'Card not found or not owned by user.' });
          }

          // Construct absolute path for deletion
          // Assumes server.js is in root of server/, and routes/ is in server/
          // So, path is relative to THIS file (cards.js)
          const imagePathToDelete = path.join(__dirname, '..', card.imagePath); // Go up one dir from routes/

          // Delete the record from the database
          db.run('DELETE FROM cards WHERE id = ? AND userId = ?', [cardId, userId], function (err) {
            if (err) {
              console.error(
                `[DELETE /api/cards/:cardId] DB Error deleting card ${cardId} for user ${userId}:`,
                err.message,
              );
              return res
                .status(500)
                .json({ success: false, message: 'Database error deleting card.' });
            }
            if (this.changes === 0) {
              return res
                .status(404)
                .json({
                  success: false,
                  message: 'Card not found or not owned by user (delete step).',
                });
            }

            // Remove deleted card ID from user's decks
            console.log(
              `[DELETE /api/cards/:cardId] Card ${cardId} deleted from table. Now removing from decks for user ${userId}.`,
            );
            db.all(
              'SELECT id, cardIds FROM decks WHERE userId = ?',
              [userId],
              (deckErr, userDecks) => {
                if (deckErr) {
                  console.error(
                    `[DELETE /api/cards/:cardId] DB Error fetching decks for user ${userId} during card cleanup:`,
                    deckErr.message,
                  );
                  // Continue regardless
                } else if (userDecks && userDecks.length > 0) {
                  const updateStmt = db.prepare(
                    'UPDATE decks SET cardIds = ? WHERE id = ? AND userId = ?',
                  );
                  let decksUpdatedCount = 0;
                  userDecks.forEach(deck => {
                    try {
                      const currentCardIds = JSON.parse(deck.cardIds || '[]');
                      if (currentCardIds.includes(cardId)) {
                        const updatedCardIds = currentCardIds.filter(id => id !== cardId);
                        const updatedCardIdsJson = JSON.stringify(updatedCardIds);
                        updateStmt.run(updatedCardIdsJson, deck.id, userId, updateErr => {
                          if (updateErr) {
                            console.error(
                              `[DELETE /api/cards/:cardId] DB Error updating deck ${deck.id}:`,
                              updateErr.message,
                            );
                          }
                        });
                        decksUpdatedCount++;
                      }
                    } catch (parseError) {
                      console.error(
                        `[DELETE /api/cards/:cardId] Error parsing cardIds JSON for deck ${deck.id}:`,
                        parseError,
                      );
                    }
                  });
                  updateStmt.finalize(finalizeErr => {
                    if (finalizeErr) {
                      console.error(
                        '[DELETE /api/cards/:cardId] Error finalizing deck update stmt:',
                        finalizeErr.message,
                      );
                    }
                    console.log(
                      `[DELETE /api/cards/:cardId] Finished attempting to remove card ${cardId} from ${decksUpdatedCount} deck(s).`,
                    );
                    deleteFileAndSendResponse(); // Proceed after trying deck updates
                  });
                } else {
                  console.log(
                    `[DELETE /api/cards/:cardId] No decks found for user ${userId}. Proceeding without deck update.`,
                  );
                  deleteFileAndSendResponse(); // No decks to update, proceed directly
                }
              },
            );

            // Function to contain the file deletion and response logic
            const deleteFileAndSendResponse = () => {
              // Delete the image file after successful DB deletion
              fs.unlink(imagePathToDelete, unlinkErr => {
                if (unlinkErr) {
                  // If file doesn't exist (ENOENT), it's not a critical error here
                  if (unlinkErr.code !== 'ENOENT') {
                    console.error(
                      `[DELETE /api/cards/:cardId] Failed to delete image file: ${imagePathToDelete}`,
                      unlinkErr,
                    );
                  } else {
                    console.warn(
                      `[DELETE /api/cards/:cardId] Image file not found for deletion (may have already been deleted): ${imagePathToDelete}`,
                    );
                  }
                } else {
                  console.log(
                    `[DELETE /api/cards/:cardId] Deleted image file: ${imagePathToDelete}`,
                  );
                }
                // Still send success even if file deletion fails or deck update had issues
                res.json({ success: true, message: 'Card deleted successfully.' });
              });
            };
          });
        },
      );
    } catch (error) {
      console.error(`[DELETE /api/cards/:cardId] Error for user ${userId}, card ${cardId}:`, error);
      res.status(500).json({ success: false, message: 'Failed to delete card.' });
    }
  });

  // Update Card Details (Name, Tags) - Apply auth, use req.user.userId
  // PUT /api/cards/:cardId -> PUT /:cardId
  router.put('/:cardId', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const { cardId } = req.params;
    const { name, tags } = req.body;

    console.log(`[PUT /api/cards/:cardId] User ${userId} updating card ${cardId} with:`, req.body);

    if (typeof name === 'undefined' || !Array.isArray(tags)) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Invalid request body. Required: name (string), tags (array).',
        });
    }

    // Ensure tags are strings and stringify for DB storage
    const validTags = tags.filter(t => typeof t === 'string');
    const tagsJson = JSON.stringify(validTags);

    try {
      const stmt = db.prepare('UPDATE cards SET name = ?, tags = ? WHERE id = ? AND userId = ?');
      stmt.run(name.trim(), tagsJson, cardId, userId, function (err) {
        stmt.finalize();
        if (err) {
          console.error(
            `[PUT /api/cards/:cardId] DB Error updating card ${cardId} for user ${userId}:`,
            err.message,
          );
          return res.status(500).json({ success: false, message: 'Database error updating card.' });
        }
        if (this.changes === 0) {
          return res
            .status(404)
            .json({ success: false, message: 'Card not found or not owned by user.' });
        }
        console.log(`[PUT /api/cards/:cardId] Updated card ${cardId} for user ${userId}`);
        res.json({ success: true, message: 'Card details updated.' });
      });
    } catch (error) {
      console.error(
        `[PUT /api/cards/:cardId] Error processing request for ${userId}, card ${cardId}:`,
        error,
      );
      res
        .status(500)
        .json({ success: false, message: 'Internal server error updating card details.' });
    }
  });

  return router;
}

module.exports = createCardRouter;
