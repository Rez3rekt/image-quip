const express = require('express');
const sharp = require('sharp');

// Note: This router requires cardUpload, cardStore, path, fs, cardUploadsDir to be passed in.
// cardStore is assumed to be a mutable object (like a Map or plain object) shared from server.js
function createGuestRouter(cardUpload, cardStore, path, fs, cardUploadsDir) {
  const router = express.Router();

  // Upload a guest card
  // POST /api/guest-cards/upload/:clientId -> POST /upload/:clientId
  router.post('/upload/:clientId', cardUpload.single('image'), async (req, res) => {
    const { clientId } = req.params;

    if (!req.file || !clientId) {
      return res
        .status(400)
        .json({ success: false, message: 'Client ID and image file required.' });
    }

    let generatedFilename;
    let guestSpecificDir;
    let destinationPath;
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(16).substring(2, 8);

    try {
      generatedFilename = `${timestamp}-${randomSuffix}.webp`;

      // Create guest-specific directory
      guestSpecificDir = path.join(cardUploadsDir, 'guest');
      if (!fs.existsSync(guestSpecificDir)) {
        fs.mkdirSync(guestSpecificDir, { recursive: true });
      }
      destinationPath = path.join(guestSpecificDir, generatedFilename);

      const optimizedBuffer = await sharp(req.file.buffer)
        .resize({ width: 800, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      await fs.promises.writeFile(destinationPath, optimizedBuffer);

      const relativeImagePath = `/uploads/cards/guest/${generatedFilename}`;
      const newCard = {
        id: `card-${timestamp}-${randomSuffix}`,
        clientId: clientId,
        imagePath: relativeImagePath,
        fileName: generatedFilename,
        name: path.basename(req.file.originalname, path.extname(req.file.originalname)),
        tags: [],
        lifetimeVotes: 0,
        isGuestCard: true,
      };

      if (!cardStore[clientId]) {
        cardStore[clientId] = [];
      }
      cardStore[clientId].push(newCard);
      res.status(201).json(newCard);
    } catch (error) {
      console.error(`[POST /api/guest-cards/upload] Error for clientId ${clientId}:`, error);
      if (destinationPath && fs.existsSync(destinationPath)) {
        fs.unlink(destinationPath, err => {
          if (err) {
            console.error(
              `[POST /api/guest-cards/upload] Error cleaning up file ${destinationPath} after error:`,
              err,
            );
          }
        });
      }
      res.status(500).json({ success: false, message: 'Error processing guest upload.' });
    }
  });

  // Get all cards for a guest client
  // GET /api/guest-cards/:clientId -> GET /:clientId
  router.get('/:clientId', (req, res) => {
    try {
      const { clientId } = req.params;
      const clientCards = cardStore[clientId] || [];
      res.json({ success: true, cards: clientCards });
    } catch (error) {
      console.error(`[GET /api/guest-cards] Error for client ${req.params.clientId}:`, error);
      res.status(500).json({ success: false, message: 'Failed to retrieve guest cards.' });
    }
  });

  // Delete a specific guest card
  // DELETE /api/guest-cards/:clientId/:cardId -> DELETE /:clientId/:cardId
  router.delete('/:clientId/:cardId', (req, res) => {
    try {
      const { clientId, cardId } = req.params;
      const clientCards = cardStore[clientId];
      if (!clientCards) {
        return res.status(404).json({ success: false, message: 'Client or card not found.' });
      }
      const cardIndex = clientCards.findIndex(card => card.id === cardId);
      if (cardIndex === -1) {
        return res.status(404).json({ success: false, message: 'Card not found.' });
      }
      const cardToDelete = clientCards[cardIndex];
      const baseDir = path.join(__dirname, '..', '..');
      const imagePathToDelete = path.join(baseDir, cardToDelete.imagePath);

      cardStore[clientId].splice(cardIndex, 1);
      fs.unlink(imagePathToDelete, err => {
        if (err) {
          console.error(
            `[DELETE /api/guest-cards] Failed to delete image file: ${imagePathToDelete}`,
            err,
          );
        }
      });
      res.json({ success: true, message: 'Guest card deleted successfully.' });
    } catch (error) {
      console.error(
        `[DELETE /api/guest-cards] Error for client ${req.params.clientId}, card ${req.params.cardId}:`,
        error,
      );
      res.status(500).json({ success: false, message: 'Failed to delete guest card.' });
    }
  });

  // Update Guest Card Details (Name, Tags)
  // PUT /api/guest-cards/:clientId/:cardId -> PUT /:clientId/:cardId
  router.put('/:clientId/:cardId', (req, res) => {
    const { clientId, cardId } = req.params;
    const { name, tags } = req.body;

    if (typeof name === 'undefined' || !Array.isArray(tags)) {
      return res.status(400).json({ success: false, message: 'Invalid request body.' });
    }

    try {
      const clientCards = cardStore[clientId];
      if (!clientCards) {
        return res.status(404).json({ success: false, message: 'Client not found.' });
      }
      const cardIndex = clientCards.findIndex(card => card.id === cardId);
      if (cardIndex === -1) {
        return res.status(404).json({ success: false, message: 'Card not found.' });
      }

      // Update in-memory store
      cardStore[clientId][cardIndex] = {
        ...cardStore[clientId][cardIndex],
        name: name.trim(),
        tags: tags.filter(t => typeof t === 'string'),
      };

      res.json({ success: true, message: 'Guest card details updated.' });
    } catch (error) {
      console.error(
        `[PUT /api/guest-cards] Error for client ${req.params.clientId}, card ${req.params.cardId}:`,
        error,
      );
      res
        .status(500)
        .json({ success: false, message: 'Internal server error updating guest card details.' });
    }
  });

  return router;
}

module.exports = { createGuestRouter };
